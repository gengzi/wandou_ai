const base = process.env.BACKEND_URL || 'http://localhost:8080';
const runTimeoutMs = Number(process.env.SMOKE_RUN_TIMEOUT_MS || 45_000);
let token = '';

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, got: ${text.slice(0, 200)}`);
  }
}

async function get(path) {
  const response = await fetch(`${base}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return readJson(response);
}

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  return readJson(response);
}

async function patch(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`PATCH ${path} failed with ${response.status}`);
  }
  return readJson(response);
}

async function waitForRun(runId) {
  const url = new URL(`${base}/api/agent/runs/${runId}/events`);
  url.searchParams.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`SSE connection failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const ids = [];
  const events = [];
  const startedAt = Date.now();

  while (Date.now() - startedAt < runTimeoutMs) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      const line = chunk.split('\n').find((item) => item.startsWith('data:'));
      if (!line) continue;

      const event = JSON.parse(line.slice(5).trim());
      ids.push(event.id || `${event.event}:${event.createdAt}`);
      events.push(event.event);
      if (event.event === 'agent.confirmation.required') {
        await post(`/api/agent/runs/${runId}/confirm`, {
          comment: `Smoke test confirms ${event.data?.checkpoint || 'checkpoint'}`,
        });
      }
      if (event.event === 'run.completed' || event.event === 'run.failed') {
        await reader.cancel();
        return { ids, events };
      }
    }
  }

  throw new Error('SSE timeout waiting for run completion');
}

const health = await get('/actuator/health');
const login = await post('/api/auth/login', {
  email: process.env.SMOKE_EMAIL || 'admin@wandou.ai',
  password: process.env.SMOKE_PASSWORD || 'Wandou@123456',
});
token = login.data.tokenValue;

const project = await post('/api/projects', {
  name: 'Smoke Test',
  description: 'Automated backend smoke test',
  aspectRatio: '16:9',
});

const run = await post('/api/agent/runs', {
  projectId: project.data.id,
  canvasId: project.data.canvasId,
  conversationId: project.data.conversationId,
  message: '生成一条宇宙少女抱猫视频',
  agentName: '导演',
});

const eventResult = await waitForRun(run.data.runId);
const detail = await get(`/api/agent/runs/${run.data.runId}`);
const canvas = await get(`/api/canvas/${project.data.canvasId}`);
const imageNode = canvas.data.nodes.find((node) => node.type === 'images');
if (!imageNode) {
  throw new Error('Expected generated image node');
}
const movedNode = await patch(`/api/canvas/${project.data.canvasId}/nodes/script-1/position`, {
  position: { x: 220, y: 180 },
});
const manualEdge = await post(`/api/canvas/${project.data.canvasId}/edges`, {
  source: 'script-1',
  target: imageNode.id,
});
const manualAsset = await post('/api/assets', {
  projectId: project.data.id,
  canvasId: project.data.canvasId,
  nodeId: imageNode.id,
  type: 'image',
  name: 'Smoke Reference',
  url: 'https://example.com/smoke-reference.png',
});
const conversation = await get(`/api/conversations/${project.data.conversationId}`);
const tasks = await get(`/api/tasks?projectId=${project.data.id}`);
const assets = await get(`/api/assets?projectId=${project.data.id}`);
const videoNode = canvas.data.nodes.find((node) => node.type === 'video');
const videoAsset = assets.data.find((asset) => asset.type === 'video');

const result = {
  health: health.status,
  runStatus: detail.data.status,
  eventCount: eventResult.events.length,
  uniqueEventIds: new Set(eventResult.ids).size,
  canvasNodes: canvas.data.nodes.length,
  messages: conversation.data.messages.length,
  task: tasks.data[0] && {
    status: tasks.data[0].status,
    progress: tasks.data[0].progress,
  },
  assets: assets.data.length,
  hasVideoAsset: Boolean(videoAsset),
  videoUrl: videoNode?.output?.url || '',
  movedNodeX: movedNode.data.position.x,
  manualEdge: `${manualEdge.data.source}->${manualEdge.data.target}`,
  manualAsset: manualAsset.data.name,
  hasVideoThumbnail: Boolean(videoNode?.output?.thumbnailUrl),
};

console.log(JSON.stringify(result, null, 2));

if (
  result.health !== 'UP' ||
  result.runStatus !== 'success' ||
  result.eventCount !== result.uniqueEventIds ||
  result.canvasNodes < 6 ||
  result.messages < 2 ||
  result.task?.status !== 'success' ||
  result.task?.progress !== 100 ||
  result.assets < 1 ||
  !result.hasVideoAsset ||
  !String(result.videoUrl).includes('/api/assets/') ||
  result.movedNodeX !== 220 ||
  result.manualEdge !== `script-1->${imageNode.id}` ||
  result.manualAsset !== 'Smoke Reference' ||
  !result.hasVideoThumbnail
) {
  throw new Error('Smoke test failed');
}
