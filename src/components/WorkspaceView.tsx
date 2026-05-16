import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Share2, Play, Plus, BrainCircuit, Wand2, Video, MessageSquare, MousePointer2, Send, Paperclip, CopyPlus, Settings2, RefreshCw, CheckCircle2, PauseCircle, XCircle, X } from 'lucide-react';
import { ReactFlow, Background, useNodesState, useEdgesState, addEdge, BackgroundVariant, ReactFlowProvider, Node, Edge, Connection, MiniMap, ReactFlowInstance, MarkerType } from '@xyflow/react';
import { ScriptNode, CharacterNode, StoryboardNode, ImagesNode, AudioNode, FinalVideoNode } from './CanvasNodes';
import { AgentRunDetailResponse, AssetResponse, CanvasEdgeResponse, CanvasNodeResponse, CanvasResponse, ConversationResponse, TaskResponse, cancelAgentRun, confirmAgentRun, createCanvasEdge, createProject, createRunEventSource, deleteCanvasEdge, deleteCanvasNode, generateChat, generateImage, generateVideo, getAgentRun, getCanvas, getConversation, getProject, getTask, interruptAgentRun, listAssets, listTasks, ProjectResponse, resumeAgentRun, SseEvent, startAgentRun, updateCanvasNodePosition } from '../lib/api';

const nodeTypes = {
  script: ScriptNode,
  character: CharacterNode,
  storyboard: StoryboardNode,
  images: ImagesNode,
  video: ImagesNode,
  audio: AudioNode,
  final: FinalVideoNode,
};

const canvasSections = ['总览', '图片/视频', '剧本', '角色', '分镜', '视频'] as const;
type CanvasSection = typeof canvasSections[number];

const initialNodes: Node[] = [
  {
    id: 'script-1',
    type: 'script',
    position: { x: 80, y: 120 },
    data: {},
  }
];

const initialEdges: Edge[] = [];

interface Message {
  id: string;
  sender: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  kind?: 'normal' | 'process';
  status?: 'running' | 'success' | 'failed';
}

interface TaskItem {
  id: string;
  nodeId: string;
  status: string;
  progress: number;
  message: string;
}

interface AssetItem {
  id: string;
  nodeId: string;
  type: string;
  name: string;
  url: string;
  thumbnailUrl: string;
}

interface ConfirmationState {
  checkpoint: string;
  message: string;
}

interface StepOutputState {
  step: string;
  title: string;
  content: string;
  output: Record<string, unknown>;
}

interface WorkspaceViewProps {
  initialPrompt?: string;
  projectId?: string;
}

function getString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

function getDisplayText(...values: unknown[]) {
  const text = getString(...values);
  if (text) return text;
  for (const value of values) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
  }
  return '';
}

function firstItems(value: unknown, limit = 3): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((item) => getDisplayText(item))
    .filter(Boolean);
}

function formatStepOutput(title: string, content: string, output: Record<string, unknown>) {
  const source = sourceLabel(output);
  const summary = getDisplayText(output.summary, output.prompt, output.consistency, output.camera, content);
  const bullets = [
    ...firstItems(output.beats),
    ...firstItems(output.scenes).map((item) => `分镜：${item}`),
    ...firstItems(output.characters).map((item) => `角色：${item}`),
    ...firstItems(output.frames).map((item) => `关键帧：${item}`),
    ...firstItems(output.checks).map((item) => `检查：${item}`),
  ].slice(0, 4);
  const lines = [`完成：${title}`];
  if (source) lines.push(`模型：${source}`);
  if (getString(output.fallbackReason)) lines.push(`说明：模型输出格式不稳定，已回退到结构化模板。`);
  if (summary) lines.push(summary);
  if (bullets.length > 0) {
    lines.push(...bullets.map((item, index) => `${index + 1}. ${item}`));
  }
  return lines.join('\n');
}

function sourceLabel(output?: Record<string, unknown>) {
  const source = getString(output?.modelSource);
  if (source === 'configured-text-model') {
    return getString(output?.modelDisplayName, output?.modelName, '已配置文本模型');
  }
  if (source === 'template-fallback') {
    return '模板 fallback';
  }
  return '';
}

function formatDuration(ms?: number) {
  const value = Number(ms || 0);
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
}

function toFlowNode(node: CanvasNodeResponse): Node {
  const flowType = node.type === 'video' ? 'video' : node.type;
  return {
    id: node.id,
    type: flowType,
    position: node.position,
    data: {
      ...node.data,
      nodeType: flowType,
      title: node.title,
      status: node.status,
      output: node.output,
      updatedAt: node.updatedAt,
      imageSrc: typeof node.output?.thumbnailUrl === 'string' ? node.output.thumbnailUrl : undefined,
    },
  };
}

function sectionForNode(node?: Node | null): CanvasSection {
  if (!node) return '总览';
  if (node.type === 'script') return '剧本';
  if (node.type === 'character') return '角色';
  if (node.type === 'storyboard') return '分镜';
  if (node.type === 'video' || node.type === 'final') return '视频';
  if (node.type === 'images' || node.type === 'audio') return '图片/视频';
  return '总览';
}

function toFlowEdge(edge: CanvasEdgeResponse): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'default',
    animated: false,
    interactionWidth: 18,
    style: { stroke: '#64748b', strokeWidth: 1.35, opacity: 0.62 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#64748b',
      width: 14,
      height: 14,
    },
  };
}

function toMessage(message: ConversationResponse['messages'][number]): Message {
  return {
    id: message.id,
    sender: message.sender || (message.role === 'user' ? '用户' : 'Agent'),
    role: message.role === 'user' ? 'user' : 'agent',
    content: message.content,
    timestamp: new Date(message.createdAt),
  };
}

function toTask(task: TaskResponse): TaskItem {
  return {
    id: task.id,
    nodeId: task.nodeId,
    status: task.status,
    progress: task.progress,
    message: task.message,
  };
}

function toAsset(asset: AssetResponse): AssetItem {
  return {
    id: asset.id,
    nodeId: asset.nodeId,
    type: asset.type,
    name: asset.name,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
  };
}

function looksLikeCreativeCommand(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  const casualMessages = new Set(['你好', '您好', 'hi', 'hello', 'hey', '在吗', '谢谢', 'ok', '好的']);
  if (casualMessages.has(normalized)) return false;
  const creativeKeywords = [
    '生成', '制作', '创建', '做一个', '帮我做', '写一个', '出一个',
    '视频', '短片', '广告', '分镜', '剧本', '脚本', '角色', '关键帧',
    '海报', '图片', '生图', '图生视频', '文生视频', '配音', '音乐', '音效',
  ];
  return creativeKeywords.some((keyword) => normalized.includes(keyword));
}

function looksLikeImageCommand(message: string): boolean {
  return ['图片', '生图', '海报', '插画', '照片', '图像', '关键帧', '概念图'].some((keyword) => message.includes(keyword));
}

function looksLikeVideoCommand(message: string): boolean {
  return ['视频', '短片', '广告片', '图生视频', '文生视频', '成片', '8秒', '10秒'].some((keyword) => message.includes(keyword));
}

function looksLikeAgentWorkflowCommand(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return ['完整流程', 'agent run', '分镜', '剧本', '三段确认', '工作流'].some((keyword) => normalized.includes(keyword));
}

function looksLikeQuickVideoCommand(message: string): boolean {
  return ['快速视频', '快速生成视频', '只生成视频', 'mock视频', 'mock video'].some((keyword) => message.toLowerCase().includes(keyword));
}

export default function WorkspaceView({ initialPrompt, projectId }: WorkspaceViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeInstruction, setNodeInstruction] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>('idle');
  const [runError, setRunError] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [stepOutputs, setStepOutputs] = useState<Record<string, StepOutputState>>({});
  const [setupError, setSetupError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskResponse | null>(null);
  const [runDetail, setRunDetail] = useState<AgentRunDetailResponse | null>(null);
  const [activeCanvasSection, setActiveCanvasSection] = useState<CanvasSection>('总览');
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const internallyDeletedNodesRef = useRef<Set<string>>(new Set());
  const internallyDeletedEdgesRef = useRef<Set<string>>(new Set());
  const stepOutputsRef = useRef<Record<string, StepOutputState>>({});
  const autoStartedPromptRef = useRef<string>('');

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const highlightedCanvasSection = selectedNode ? sectionForNode(selectedNode) : activeCanvasSection;
  const runningTaskCount = tasks.filter(task => task.status === 'running').length;
  const confirmationStep = confirmation ? stepOutputs[confirmation.checkpoint] : null;
  const confirmationOutput = confirmationStep?.output;
  const confirmationSummary = getString(confirmationOutput?.summary, confirmationStep?.content, confirmation?.message);
  const confirmationStyle = getString(confirmationOutput?.style);
  const confirmationBeats = Array.isArray(confirmationOutput?.beats) ? confirmationOutput.beats.slice(0, 3).map(String) : [];
  const confirmationSource = sourceLabel(confirmationOutput);
  const runStatusText = confirmation
    ? confirmation.message
    : runStatus === 'interrupted'
      ? '已打断，等待恢复或取消。'
      : runStatus === 'success'
        ? '本次多 Agent 生成已完成。'
        : runStatus === 'cancelled'
          ? '本次生成已取消。'
          : runStatus === 'failed'
            ? runError || '本次生成失败，请查看后端错误。'
            : activeRunId
              ? '多 Agent 生成流程运行中'
              : '等待创作指令';

  const upsertEdge = useCallback((edge: CanvasEdgeResponse) => {
    const nextEdge = toFlowEdge(edge);
    setEdges((currentEdges) => {
      const exists = currentEdges.some((item) => item.id === nextEdge.id || (item.source === nextEdge.source && item.target === nextEdge.target));
      return exists ? currentEdges : [...currentEdges, nextEdge];
    });
  }, [setEdges]);

  const onConnect = useCallback(async (params: Connection | Edge) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'default',
      animated: true,
      interactionWidth: 18,
      style: { stroke: '#10B981', strokeWidth: 2, opacity: 0.82 }
    } as any, eds));

    if (!project || !params.source || !params.target) return;
    try {
      const edge = await createCanvasEdge(project.canvasId, { source: params.source, target: params.target });
      upsertEdge(edge);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `连线保存失败：${error.message}` : '连线保存失败。');
    }
  }, [project, setEdges, upsertEdge]);

  const handleNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
    if (!project) return;
    try {
      await updateCanvasNodePosition(project.canvasId, node.id, node.position);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `节点位置保存失败：${error.message}` : '节点位置保存失败。');
    }
  }, [project]);

  const deleteNodePersistently = useCallback(async (nodeId: string) => {
    if (!project) {
      setSetupError('工作区正在连接后端，请稍后再操作节点。');
      return;
    }
    const previousNodes = nodes;
    const previousEdges = edges;
    internallyDeletedNodesRef.current.add(nodeId);
    edges
      .filter((edge) => edge.source === nodeId || edge.target === nodeId)
      .forEach((edge) => internallyDeletedEdgesRef.current.add(edge.id));
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    try {
      await deleteCanvasNode(project.canvasId, nodeId);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      setNotice('节点已从画布删除。');
    } catch (error) {
      console.error(error);
      setNodes(previousNodes);
      setEdges(previousEdges);
      setSetupError(error instanceof Error ? `节点删除失败：${error.message}` : '节点删除失败。');
    }
  }, [edges, nodes, project, selectedNodeId, setEdges, setNodes]);

  const deleteEdgePersistently = useCallback(async (edgeId: string) => {
    if (!project) {
      setSetupError('工作区正在连接后端，请稍后再操作连线。');
      return;
    }
    const previousEdges = edges;
    internallyDeletedEdgesRef.current.add(edgeId);
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    try {
      await deleteCanvasEdge(project.canvasId, edgeId);
      setNotice('连线已从画布删除。');
    } catch (error) {
      console.error(error);
      setEdges(previousEdges);
      setSetupError(error instanceof Error ? `连线删除失败：${error.message}` : '连线删除失败。');
    }
  }, [edges, project, setEdges]);

  const handleNodesDelete = useCallback((deletedNodes: Node[]) => {
    deletedNodes.forEach((node) => {
      if (internallyDeletedNodesRef.current.delete(node.id)) {
        return;
      }
      void deleteNodePersistently(node.id);
    });
  }, [deleteNodePersistently]);

  const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((edge) => {
      if (internallyDeletedEdgesRef.current.delete(edge.id)) {
        return;
      }
      void deleteEdgePersistently(edge.id);
    });
  }, [deleteEdgePersistently]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setActiveCanvasSection(sectionForNode(node));
    const output = node.data?.output as Record<string, unknown> | undefined;
    const prompt = typeof output?.prompt === 'string' ? output.prompt : '';
    setNodeInstruction(prompt);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const focusCanvasSection = useCallback((section: CanvasSection) => {
    setActiveCanvasSection(section);
    if (section === '总览') {
      setSelectedNodeId(null);
      flowInstance?.fitView({ duration: 450, padding: 0.22 });
      return;
    }

    const candidates = nodes.filter((node) => sectionForNode(node) === section);
    const preferred = candidates.find((node) => node.data?.status === 'running')
      || [...candidates].sort((left, right) => {
        const leftTime = Date.parse(String(left.data?.updatedAt || ''));
        const rightTime = Date.parse(String(right.data?.updatedAt || ''));
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      })[0];

    if (!preferred) {
      setSetupError(`${section} 节点还没有生成，发送创作指令后会自动出现。`);
      return;
    }

    setSetupError(null);
    setSelectedNodeId(preferred.id);
    const output = preferred.data?.output as Record<string, unknown> | undefined;
    setNodeInstruction(typeof output?.prompt === 'string' ? output.prompt : '');
    flowInstance?.setCenter(
      preferred.position.x + 180,
      preferred.position.y + 130,
      { duration: 450, zoom: section === '视频' ? 0.78 : 0.9 }
    );
  }, [flowInstance, nodes]);

  const applyCanvas = useCallback((canvas: CanvasResponse) => {
    setNodes(canvas.nodes.map(toFlowNode));
    setEdges(canvas.edges.map(toFlowEdge));
  }, [setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      try {
        setSetupError(null);
        const nextProject = projectId
          ? await getProject(projectId)
          : await createProject({
              name: 'Wandou Studio 项目',
              description: '前后端联动工作区',
              aspectRatio: '16:9',
            });
        if (cancelled) return;
        setProject(nextProject);
        const [canvas, conversation, nextTasks, nextAssets] = await Promise.all([
          getCanvas(nextProject.canvasId),
          getConversation(nextProject.conversationId),
          listTasks(nextProject.id),
          listAssets(nextProject.id),
        ]);
        if (cancelled) return;
        applyCanvas(canvas);
        setTasks(nextTasks.map(toTask));
        setAssets(nextAssets.map(toAsset));
        const nextMessages = conversation.messages.map(toMessage);
        setMessages(nextMessages.length > 0
          ? nextMessages
          : [{
              id: 'welcome',
              sender: '系统',
              role: 'agent',
              content: '工作区已连接后端。输入创作指令后，Agent Run 会实时更新消息、任务队列和画布节点。',
              timestamp: new Date(),
            }]);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSetupError(error instanceof Error ? error.message : '后端连接失败');
        }
      }
    }

    initWorkspace();
    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
    };
  }, [applyCanvas, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const upsertNode = useCallback((node: CanvasNodeResponse) => {
    setNodes((currentNodes) => {
      const nextNode = toFlowNode(node);
      const exists = currentNodes.some((item) => item.id === nextNode.id);
      return exists
        ? currentNodes.map((item) => item.id === nextNode.id ? { ...item, ...nextNode } : item)
        : [...currentNodes, nextNode];
    });
  }, [setNodes]);

  const updateNodeFromEvent = useCallback((nodeId: string, status?: string, output?: Record<string, unknown>, updatedAt?: string) => {
    setNodes((currentNodes) => currentNodes.map((node) => {
      if (node.id !== nodeId) return node;
      const nextOutput = output ? { ...(node.data?.output as Record<string, unknown> | undefined), ...output } : node.data?.output;
      return {
        ...node,
        data: {
          ...node.data,
          status: status || node.data?.status,
          output: nextOutput,
          updatedAt: updatedAt || new Date().toISOString(),
          imageSrc: typeof nextOutput?.thumbnailUrl === 'string' ? nextOutput.thumbnailUrl : node.data?.imageSrc,
        },
      };
    }));
  }, [setNodes]);

  const upsertTask = useCallback((task: any) => {
    if (!task?.id) return;
    const nextTask: TaskItem = {
      id: task.id,
      nodeId: task.nodeId,
      status: task.status,
      progress: task.progress ?? 0,
      message: task.message || '任务进行中',
    };
    setTasks((current) => {
      const exists = current.some((item) => item.id === nextTask.id);
      return exists
        ? current.map((item) => item.id === nextTask.id ? nextTask : item)
        : [nextTask, ...current];
    });
  }, []);

  const handleRunEvent = useCallback((event: SseEvent<any>) => {
    const eventKey = event.id || `${event.runId}:${event.event}:${event.createdAt}:${JSON.stringify(event.data)}`;
    if (processedEventIdsRef.current.has(eventKey)) {
      return;
    }
    processedEventIdsRef.current.add(eventKey);

    const data = event.data || {};
    if (event.event === 'run.started') {
      setRunStatus('running');
      setRunError('');
    }

    if (event.event === 'message.delta') {
      setIsTyping(true);
      setMessages((prev) => {
        const messageId = `stream-${event.runId}`;
        const content = getString(data.content, data.delta, '正在分析你的创作需求...');
        const nextMessage: Message = {
          id: messageId,
          sender: getString(data.sender, '导演'),
          role: 'agent',
          content,
          timestamp: new Date(event.createdAt),
          kind: 'process',
          status: 'running',
        };
        return prev.some((item) => item.id === messageId)
          ? prev.map((item) => item.id === messageId ? { ...item, ...nextMessage, content: `${item.content}\n${content}`.trim() } : item)
          : [...prev, nextMessage];
      });
    }

    if (event.event === 'message.completed') {
      setMessages((prev) => [...prev, {
        id: `assistant-${event.runId}-${prev.length}`,
        sender: data.sender || '导演',
        role: 'agent',
        content: data.content || '已完成处理。',
        timestamp: new Date(event.createdAt),
      }]);
      setIsTyping(false);
    }

    if (event.event === 'node.created' && data.node) {
      upsertNode(data.node);
      setActiveCanvasSection(sectionForNode(toFlowNode(data.node)));
    }

    if (event.event === 'edge.created' && data.edge) {
      upsertEdge(data.edge);
    }

    if (event.event === 'node.updated') {
      if (data.node) {
        const flowNode = toFlowNode(data.node);
        upsertNode(data.node);
        setActiveCanvasSection(sectionForNode(flowNode));
      } else {
        updateNodeFromEvent(data.nodeId, data.status, data.output, event.createdAt);
      }
    }

    if (event.event === 'task.created' || event.event === 'task.progress' || event.event === 'task.completed' || event.event === 'task.failed') {
      upsertTask(data.task);
    }

    if (event.event === 'agent.step.started') {
      setRunStatus('running');
      setMessages((prev) => [...prev, {
        id: `step-${event.runId}-${String(data.step || event.id)}`,
        sender: data.agentName || 'Agent',
        role: 'agent',
        content: `开始：${data.title || data.step}\n正在读取上下文、调用模型并整理结构化输出...`,
        timestamp: new Date(event.createdAt),
        kind: 'process',
        status: 'running',
      }]);
    }

    if (event.event === 'agent.step.completed') {
      const step = String(data.step || '');
      if (step) {
        const nextStepOutput: StepOutputState = {
          step,
          title: String(data.title || step),
          content: String(data.content || ''),
          output: (data.output && typeof data.output === 'object') ? data.output as Record<string, unknown> : {},
        };
        stepOutputsRef.current = {
          ...stepOutputsRef.current,
          [step]: nextStepOutput,
        };
        setStepOutputs(stepOutputsRef.current);
        setMessages((prev) => {
          const messageId = `step-${event.runId}-${step}`;
          const nextMessage: Message = {
            id: messageId,
            sender: String(data.agentName || 'Agent'),
            role: 'agent',
            content: formatStepOutput(nextStepOutput.title, nextStepOutput.content, nextStepOutput.output),
            timestamp: new Date(event.createdAt),
            kind: 'process',
            status: 'success',
          };
          return prev.some((item) => item.id === messageId)
            ? prev.map((item) => item.id === messageId ? nextMessage : item)
            : [...prev, nextMessage];
        });
      }
    }

    if (event.event === 'run.monitor.updated' && data.monitor) {
      setRunDetail((current) => current && current.runId === event.runId
        ? { ...current, monitor: data.monitor as AgentRunDetailResponse['monitor'] }
        : current);
    }

    if (event.event === 'agent.confirmation.required') {
      setRunStatus('waiting_confirmation');
      setIsTyping(false);
      setConfirmation({
        checkpoint: String(data.checkpoint || 'review'),
        message: String(data.message || '请确认后继续。'),
      });
    }

    if (event.event === 'agent.confirmation.accepted') {
      setConfirmation(null);
      setRunStatus('running');
      setIsTyping(true);
    }

    if (event.event === 'run.interrupted') {
      setRunStatus('interrupted');
      setIsTyping(false);
    }

    if (event.event === 'run.resumed') {
      setRunStatus('running');
      setIsTyping(true);
    }

    if (event.event === 'asset.created' && data.asset) {
      const asset = data.asset as AssetItem;
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      updateNodeFromEvent(asset.nodeId, 'success', {
        assetId: asset.id,
        thumbnailUrl: asset.thumbnailUrl,
        url: asset.url,
      }, event.createdAt);
    }

    if (event.event === 'run.completed' || event.event === 'run.failed' || event.event === 'run.cancelled') {
      setRunStatus(event.event === 'run.completed' ? 'success' : event.event === 'run.cancelled' ? 'cancelled' : 'failed');
      if (event.event === 'run.failed') {
        setRunError(getString(data.error, data.message, '本次生成失败。'));
      }
      setConfirmation(null);
      setIsTyping(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setActiveRunId(null);
    }
  }, [updateNodeFromEvent, upsertEdge, upsertNode, upsertTask]);

  const runAgent = useCallback(async (message: string, options?: { mode?: string; nodeId?: string }) => {
    if (!message.trim()) return;
    if (!project) {
      setSetupError('工作区正在连接后端，请稍后再发送。');
      return;
    }

    const cleanMessage = message.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: '用户',
      role: 'user',
      content: cleanMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    setIsTyping(true);

    try {
      const useAgentWorkflow = Boolean(options?.mode) || looksLikeAgentWorkflowCommand(cleanMessage) || (looksLikeVideoCommand(cleanMessage) && !looksLikeQuickVideoCommand(cleanMessage));
      if (!useAgentWorkflow) {
        setRunStatus('running');
        const payload = {
          projectId: project.id,
          conversationId: project.conversationId,
          canvasId: project.canvasId,
          prompt: cleanMessage,
        };
        const result = looksLikeVideoCommand(cleanMessage)
          ? await generateVideo(payload)
          : looksLikeImageCommand(cleanMessage) || looksLikeCreativeCommand(cleanMessage)
            ? await generateImage(payload)
            : await generateChat(payload);

        setMessages(prev => [...prev, {
          id: `assistant-direct-${Date.now()}`,
          sender: result.type === 'image' ? '图片生成' : result.type === 'video' ? '视频生成' : '对话助手',
          role: 'agent',
          content: result.message,
          timestamp: new Date(),
        }]);
        if (result.node) {
          upsertNode(result.node);
          setActiveCanvasSection(sectionForNode(toFlowNode(result.node)));
        }
        if (result.asset) {
          const asset = toAsset(result.asset);
          setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
        }
        setRunStatus('success');
        setIsTyping(false);
        return;
      }

      eventSourceRef.current?.close();
      processedEventIdsRef.current = new Set();
      stepOutputsRef.current = {};
      setStepOutputs({});
      const run = await startAgentRun({
        projectId: project.id,
        conversationId: project.conversationId,
        canvasId: project.canvasId,
        message: cleanMessage,
        agentName: '导演',
        mode: options?.mode,
        nodeId: options?.nodeId,
      });

      setActiveRunId(run.runId);
      setRunStatus('running');
      setRunError('');
      setConfirmation(null);
      const source = createRunEventSource(run.runId);
      eventSourceRef.current = source;
      const eventNames = [
        'run.started',
        'message.delta',
        'message.completed',
        'agent.step.started',
        'agent.step.completed',
        'run.monitor.updated',
        'agent.confirmation.required',
        'agent.confirmation.accepted',
        'run.interrupted',
        'run.resumed',
        'run.cancelled',
        'node.created',
        'node.updated',
        'edge.created',
        'task.created',
        'task.progress',
        'task.completed',
        'task.failed',
        'video.provider.submitted',
        'asset.created',
        'run.completed',
        'run.failed',
      ];
      eventNames.forEach((eventName) => {
        source.addEventListener(eventName, (rawEvent) => {
          const event = JSON.parse((rawEvent as MessageEvent).data) as SseEvent<any>;
          handleRunEvent(event);
        });
      });
      source.onerror = () => {
        setIsTyping(false);
        source.close();
        if (eventSourceRef.current === source) {
          eventSourceRef.current = null;
        }
      };
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        sender: '系统',
        role: 'agent',
        content: error instanceof Error ? `后端请求失败：${error.message}` : '后端请求失败。',
        timestamp: new Date(),
      }]);
      setIsTyping(false);
    }
  }, [handleRunEvent, project, upsertNode]);

  const handleConfirmRun = async () => {
    if (!activeRunId) return;
    try {
      const result = await confirmAgentRun(activeRunId, '前端确认继续');
      setRunStatus(result.status);
      setConfirmation(null);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `确认失败：${error.message}` : '确认失败。');
    }
  };

  const handleInterruptRun = async () => {
    if (!activeRunId) return;
    try {
      const result = await interruptAgentRun(activeRunId, '用户从前端打断当前生成流程');
      setRunStatus(result.status);
      setIsTyping(false);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `打断失败：${error.message}` : '打断失败。');
    }
  };

  const handleResumeRun = async () => {
    if (!activeRunId) return;
    try {
      const result = await resumeAgentRun(activeRunId, '用户恢复当前生成流程');
      setRunStatus(result.status);
      setIsTyping(true);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `恢复失败：${error.message}` : '恢复失败。');
    }
  };

  const handleCancelRun = async () => {
    if (!activeRunId) return;
    try {
      const result = await cancelAgentRun(activeRunId, '用户取消当前生成流程');
      setRunStatus(result.status);
      setConfirmation(null);
      setIsTyping(false);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `取消失败：${error.message}` : '取消失败。');
    }
  };

  const handleOpenTask = async (taskId: string) => {
    try {
      setSelectedTaskDetail(await getTask(taskId));
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `任务详情加载失败：${error.message}` : '任务详情加载失败。');
    }
  };

  const handleOpenRunDetail = async () => {
    if (!activeRunId) {
      setNotice('当前没有正在运行的 Agent Run。');
      return;
    }
    try {
      setRunDetail(await getAgentRun(activeRunId));
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `Run 详情加载失败：${error.message}` : 'Run 详情加载失败。');
    }
  };

  const handleFileUnavailable = () => {
    setNotice('文件上传需要后端对象存储接口。本轮先支持文本指令和素材 URL 登记。');
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    await runAgent(inputValue);
  };

  const handleRegenerateSelectedNode = async () => {
    if (!selectedNode) {
      setSetupError('请先在画布中选择一个节点。');
      return;
    }
    const fallback = `重新生成 ${String(selectedNode.data?.title || selectedNode.type || '当前节点')}`;
    await runAgent(nodeInstruction.trim() || fallback, {
      mode: 'regenerate-node',
      nodeId: selectedNode.id,
    });
  };

  useEffect(() => {
    const handleNodeAction = (event: Event) => {
      const detail = (event as CustomEvent<{
        action: string;
        nodeId: string;
        title?: string;
        prompt?: string;
        url?: string;
      }>).detail;
      if (!detail?.nodeId) return;

      if (detail.action === 'delete') {
        void deleteNodePersistently(detail.nodeId);
        return;
      }

      if (detail.action === 'quote') {
        setInputValue(detail.prompt || `引用节点：${detail.title || detail.nodeId}`);
        setNotice('节点内容已放入输入框，可继续编辑后发送。');
        return;
      }

      if (detail.action === 'regenerate') {
        void runAgent(detail.prompt || `重新生成 ${detail.title || '当前节点'}`, {
          mode: 'regenerate-node',
          nodeId: detail.nodeId,
        });
        return;
      }

      if (detail.action === 'image-to-video') {
        void runAgent(detail.prompt || `基于节点 ${detail.title || detail.nodeId} 生成视频`, {
          mode: 'regenerate-node',
          nodeId: detail.nodeId,
        });
        return;
      }

      if (detail.action === 'download' && detail.url) {
        window.open(detail.url, '_blank', 'noopener,noreferrer');
        return;
      }

      setNotice('该节点操作需要后端能力补齐，当前版本暂不可用。');
    };

    window.addEventListener('wandou:canvas-node-action', handleNodeAction);
    return () => window.removeEventListener('wandou:canvas-node-action', handleNodeAction);
  }, [deleteNodePersistently, runAgent]);

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || !project || autoStartedPromptRef.current === prompt) {
      return;
    }
    autoStartedPromptRef.current = prompt;
    void runAgent(prompt);
  }, [initialPrompt, project, runAgent]);

  return (
    <div className="h-full flex bg-bg-dark text-slate-200">
      {/* Interaction Sidebar (Left) */}
      <div className="hidden lg:flex lg:w-[320px] xl:w-[360px] h-full border-r border-white/5 bg-[#121213] flex-col z-20 shadow-2xl relative">
        {/* Top Header of Sidebar */}
        <header className="h-[60px] flex items-center justify-between gap-3 px-4 border-b border-white/5 bg-[#121213]">
          <div className="flex min-w-0 items-center space-x-3">
             <div className="w-8 h-8 shrink-0 rounded bg-brand flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="text-white font-black text-sm italic">W</span>
             </div>
             <h1 className="min-w-0 truncate text-[14px] font-bold text-white tracking-wide">Wandou Studio</h1>
          </div>
          <div className="flex shrink-0 items-center space-x-2">
             {/* Credits */}
             <div className="hidden 2xl:flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-full cursor-pointer hover:bg-brand/20 transition-colors tooltip" aria-label="算力点数">
                <div className="w-3.5 h-3.5 rounded-full bg-brand flex items-center justify-center">
                  <Wand2 size={8} className="text-white" />
                </div>
                <span className="text-brand text-[12px] font-bold">1,200</span>
                <Plus size={12} className="text-brand/80" />
             </div>
             
             {/* Tasks */}
             <button onClick={() => setNotice(tasks.length > 0 ? '点击后台任务队列中的条目可查看详情。' : '当前暂无后台任务。')} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="任务">
               <Video size={18} />
               <span className="absolute top-1 right-1 w-2 h-2 bg-brand rounded-full border border-[#121213]"></span>
             </button>

             {/* Share */}
             <button onClick={() => setNotice('分享链接需要项目权限和公开访问策略，当前版本暂未开放。')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[12px] font-medium hover:bg-white/10 transition-colors" title="分享" aria-label="分享">
                <Share2 size={14} className="opacity-80" />
             </button>
             <button onClick={() => setNotice('项目导出会在成片和资产清单格式确定后接入，当前可在素材库查看生成资产。')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-[12px] font-medium text-white shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-brand/90 transition-colors" title="导出项目" aria-label="导出项目">
                <Play size={14} className="fill-white" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide" ref={scrollRef}>
          {/* Task Queue Card */}
          <div className="bg-[#1A1A1C] border border-brand/20 p-4 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center space-x-2">
                <BrainCircuit size={14} className="text-brand animate-pulse" />
                <span className="text-xs font-bold text-slate-300">
                  {runningTaskCount > 0 ? `后台运行中 (${runningTaskCount})` : '后台任务'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Queue</span>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-[11px] text-slate-500">暂无后台任务</div>
              ) : tasks.slice(0, 3).map((task) => (
                <button key={task.id} onClick={() => handleOpenTask(task.id)} className="block w-full space-y-1.5 rounded-lg p-1 text-left transition-colors hover:bg-white/5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2 text-slate-400 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        task.status === 'success'
                          ? 'bg-brand'
                          : task.status === 'failed'
                            ? 'bg-red-400'
                            : 'bg-brand animate-pulse'
                      }`} />
                      <span className="truncate">{task.message}</span>
                    </div>
                    <span className="text-slate-500 font-mono">{task.progress}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#0B0B0C] rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all" style={{ width: `${task.progress}%` }}></div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {setupError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              {setupError}
            </div>
          )}

          {notice && (
            <div className="rounded-xl border border-brand/25 bg-brand/10 p-3 text-[12px] text-brand">
              <div className="flex items-center justify-between gap-3">
                <span>{notice}</span>
                <button onClick={() => setNotice(null)} className="text-[11px] font-semibold text-slate-300 hover:text-white">关闭</button>
              </div>
            </div>
          )}

          {(activeRunId || confirmation || runStatus !== 'idle') && (
            <div className="rounded-xl border border-white/10 bg-[#1A1A1C] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">AgentScope Run</div>
                  <div className="mt-1 truncate text-[13px] font-semibold text-slate-200">
                    {runStatusText}
                  </div>
                </div>
                <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-400">{runStatus}</span>
              </div>
              {activeRunId && (
                <button onClick={handleOpenRunDetail} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-slate-300 hover:bg-white/10">
                  查看 Run 事件详情
                </button>
              )}

              {confirmation && (
                <div className="space-y-3 rounded-lg border border-brand/30 bg-brand/10 p-3 text-[12px] leading-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-brand">检查点：{confirmation.checkpoint}</span>
                    {confirmationSource && (
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] ${
                        confirmationSource === '模板 fallback'
                          ? 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
                          : 'border-brand/30 bg-brand/15 text-brand'
                      }`}>
                        {confirmationSource}
                      </span>
                    )}
                  </div>
                  {confirmationSummary && (
                    <p className="text-slate-200">{confirmationSummary}</p>
                  )}
                  {confirmationStyle && (
                    <p className="text-slate-400">风格：{confirmationStyle}</p>
                  )}
                  {confirmationBeats.length > 0 && (
                    <div className="space-y-1.5">
                      {confirmationBeats.map((beat, index) => (
                        <div key={`${confirmation.checkpoint}-${index}`} className="rounded-md bg-black/20 px-2 py-1.5 text-slate-300">
                          {index + 1}. {beat}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

            <div className="space-y-6 mt-4">
              {messages.map((msg, idx) => (
                <div key={msg.id} className="space-y-4">
                  {msg.role === 'user' ? (
                     <div className="flex justify-end">
                       <div className="bg-transparent text-slate-200 text-[13px] font-medium px-1">
                         {msg.content}
                       </div>
                     </div>
                  ) : (
                    <>
                      {/* Only showing this complex structure for the first pre-filled message mapping to UI */}
                      {idx === 0 && (
                        <div className={`whitespace-pre-wrap text-[13px] leading-relaxed ${
                          msg.kind === 'process'
                            ? 'rounded-xl border border-brand/20 bg-brand/10 p-3 text-slate-300'
                            : 'text-slate-300'
                        }`}>
                          {msg.content}
                        </div>
                      )}

                      {idx === 0 && assets[0] && (
                        <div className="aspect-video w-[180px] rounded-xl bg-slate-900 overflow-hidden relative group border border-white/5 mt-4">
                           <img src={assets[0].thumbnailUrl} className="w-full h-full object-cover opacity-80" alt="Generated Output" />
                           <div className="absolute bottom-2 left-2 right-2 truncate rounded-lg bg-black/50 px-2 py-1 text-[10px] text-slate-200 backdrop-blur">
                             {assets[0].name}
                           </div>
                        </div>
                      )}

                      {idx !== 0 && (
                        <div className={`whitespace-pre-wrap text-[13px] leading-relaxed ${
                          msg.kind === 'process'
                            ? `rounded-xl border p-3 ${
                                msg.status === 'running'
                                  ? 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'
                                  : msg.status === 'failed'
                                    ? 'border-red-400/25 bg-red-500/10 text-red-100'
                                    : 'border-brand/20 bg-brand/10 text-slate-200'
                              }`
                            : 'bg-transparent pt-2 text-slate-300'
                        }`}>
                           {msg.content}
                        </div>
                      )}

                    </>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center space-x-2 text-slate-500">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Input */}
          <div className="p-4 border-t border-white/5 bg-[#121213]">
            {(activeRunId || confirmation) && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                <button
                  onClick={handleConfirmRun}
                  disabled={!activeRunId || !confirmation || runStatus === 'interrupted'}
                  className="flex h-9 items-center justify-center space-x-1.5 rounded-lg bg-brand px-3 text-[12px] font-bold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 size={14} />
                  <span>确认</span>
                </button>
                {runStatus === 'interrupted' ? (
                  <button
                    onClick={handleResumeRun}
                    disabled={!activeRunId}
                    className="flex h-9 items-center justify-center space-x-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] font-bold text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RefreshCw size={14} />
                    <span>恢复</span>
                  </button>
                ) : (
                  <button
                    onClick={handleInterruptRun}
                    disabled={!activeRunId || runStatus === 'success' || runStatus === 'cancelled' || runStatus === 'failed'}
                    className="flex h-9 items-center justify-center space-x-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] font-bold text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PauseCircle size={14} />
                    <span>打断</span>
                  </button>
                )}
                <button
                  onClick={handleCancelRun}
                  disabled={!activeRunId || runStatus === 'success' || runStatus === 'cancelled' || runStatus === 'failed'}
                  className="flex h-9 items-center justify-center space-x-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-[12px] font-bold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <XCircle size={14} />
                  <span>取消</span>
                </button>
              </div>
            )}
            <div className="flex items-center px-4 py-2 rounded-2xl bg-[#1A1A1C] border border-white/5 focus-within:border-white/20 transition-colors group relative">
              <button onClick={handleFileUnavailable} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer mr-1 relative" title="上传附件">
                <Paperclip size={16} />
              </button>
              <button onClick={() => setNotice('请选择画布节点后使用节点卡片或右侧配置中的引用/重跑能力。')} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer mr-2" title="引用画布内容">
                <CopyPlus size={16} />
              </button>
              <input 
                type="text" 
                placeholder="描述或输入指令（支持上传参考图、视频）..." 
                disabled={!project}
                className="flex-1 bg-transparent border-none outline-none text-[13px] text-slate-200 placeholder-slate-500 py-1.5 pr-8 disabled:cursor-not-allowed disabled:opacity-50"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="absolute right-3 flex items-center">
                {inputValue.trim() ? (
                  <button 
                    onClick={handleSendMessage}
                    disabled={isTyping || !project}
                    className="p-1.5 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                ) : (
                  <button disabled={!project} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">
                    <Wand2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
      </div>

      {/* Central Canvas Workspace */}
      <div className="flex-1 min-w-0 flex bg-[#0B0B0C] relative overflow-hidden">
         {/* Center Area container */}
         <div className="flex-1 flex flex-col z-0 relative">
              <div className="flex-1 relative bg-[#0B0B0C]">
                <ReactFlowProvider>
                  {/* Left Canvas Nav */}
                  <div className="absolute left-6 top-6 z-20 hidden xl:flex flex-col space-y-5 rounded-2xl border border-white/10 bg-[#0B0B0C]/70 px-4 py-4 backdrop-blur">
                     {canvasSections.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => focusCanvasSection(item)}
                          className="group flex items-center space-x-4 text-left"
                        >
                           <div className={`h-1.5 w-1.5 rounded-full ${item === highlightedCanvasSection ? 'bg-brand shadow-[0_0_10px_rgba(16,185,129,1)]' : 'bg-slate-600 group-hover:bg-slate-400'} transition-all`} />
                           <span className={`text-[13px] tracking-wide ${item === highlightedCanvasSection ? 'font-medium text-white' : 'text-slate-400 group-hover:text-slate-300'} transition-colors`}>{item}</span>
                        </button>
                     ))}
                  </div>

                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodesDelete={handleNodesDelete}
                    onEdgesDelete={handleEdgesDelete}
                    onNodeClick={handleNodeClick}
                    onNodeDragStop={handleNodeDragStop}
                    onPaneClick={handlePaneClick}
                    onInit={setFlowInstance}
                    nodeTypes={nodeTypes}
                    minZoom={0.1}
                    maxZoom={2}
                    defaultViewport={{ x: 24, y: 28, zoom: 0.72 }}
                    fitView={false}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#555" />
                    <MiniMap className="hidden xl:block" style={{ backgroundColor: '#1A1A1C', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }} nodeColor="#333" maskColor="rgba(0,0,0,0.5)" />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
          </div>

          {!selectedNode && (
            <button
              onClick={() => setSelectedNodeId(nodes[0]?.id || null)}
                  className="absolute right-4 top-4 z-30 flex h-10 items-center space-x-2 rounded-xl border border-white/10 bg-[#121213]/90 px-3 text-[12px] font-semibold text-slate-300 shadow-xl backdrop-blur hover:bg-[#1A1A1C]"
                >
                  <Settings2 size={14} />
              <span className="hidden sm:inline">选择节点配置</span>
            </button>
          )}

          {/* Right Properties Panel */}
          {selectedNode && (
          <div className="absolute left-4 right-4 top-4 bottom-24 lg:left-auto lg:bottom-4 lg:w-[300px] rounded-2xl border border-white/10 bg-[#121213]/95 backdrop-blur-xl shadow-2xl z-30 flex flex-col">
             <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-[#1A1A1C]">
                <span className="text-[12px] font-bold text-slate-300 flex items-center space-x-1"><Settings2 size={14}/><span>节点配置</span></span>
                <button onClick={() => setSelectedNodeId(null)} className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300">关闭</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                   <div className="rounded-xl border border-brand/20 bg-brand/10 p-3">
                     <div className="mb-1 text-[11px] font-bold text-brand">当前选中</div>
                     <div className="truncate text-sm font-bold text-white">{String(selectedNode.data?.title || selectedNode.id)}</div>
                     <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                       <div className="rounded-lg bg-black/20 p-2">
                         <div className="text-slate-500">类型</div>
                         <div className="mt-1 text-slate-200">{selectedNode.type}</div>
                       </div>
                       <div className="rounded-lg bg-black/20 p-2">
                         <div className="text-slate-500">状态</div>
                         <div className="mt-1 text-slate-200">{String(selectedNode.data?.status || 'idle')}</div>
                       </div>
                     </div>
                   </div>

                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-3">生成模型 Engine</h3>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => setNotice('模型选择参数入参化将在下一阶段接入，当前重跑使用后端模型路由。')} className="py-2 bg-brand/20 border border-brand/50 rounded-lg text-[11px] text-brand font-medium">Sora</button>
                       <button onClick={() => setNotice('模型选择参数入参化将在下一阶段接入，当前重跑使用后端模型路由。')} className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">Kling</button>
                    </div>
                 </div>
                 
                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-3">画面比例 Aspect Ratio</h3>
                    <div className="grid grid-cols-3 gap-2">
                       <button onClick={() => setNotice('画面比例已由项目创建时保存，节点级比例参数将在后续接入。')} className="py-2 bg-brand/20 border border-brand/50 rounded-lg text-[11px] text-brand font-medium">16:9</button>
                       <button onClick={() => setNotice('节点级比例参数将在后续接入。')} className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">9:16</button>
                       <button onClick={() => setNotice('节点级比例参数将在后续接入。')} className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">1:1</button>
                    </div>
                 </div>

                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-3">时长 Duration</h3>
                    <div className="grid grid-cols-3 gap-2">
                       <button onClick={() => setNotice('时长参数将在节点重跑请求扩展后接入。')} className="py-2 bg-brand/20 border border-brand/50 rounded-lg text-[11px] text-brand font-medium">4s</button>
                       <button onClick={() => setNotice('时长参数将在节点重跑请求扩展后接入。')} className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">8s</button>
                       <button onClick={() => setNotice('时长参数将在节点重跑请求扩展后接入。')} className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">10s</button>
                    </div>
                 </div>

                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-2">运镜控制 Camera</h3>
                    <div className="space-y-2">
                       <select className="w-full bg-[#1A1A1C] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none">
                          <option>自动 Auto</option>
                          <option>推镜头 Zoom In</option>
                          <option>拉镜头 Zoom Out</option>
                          <option>横移 Pan</option>
                       </select>
                    </div>
                 </div>
                 
                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-2">随机种子 Seed</h3>
                    <div className="flex items-center space-x-2">
                       <input type="text" className="flex-1 bg-[#1A1A1C] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none" value="-1" readOnly />
                       <button onClick={() => setNotice('随机种子将在生成参数入参化后接入。')} className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 rounded-lg transition-colors"><RefreshCw size={14} /></button>
                    </div>
                 </div>

                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-2">节点指令 Node Prompt</h3>
                    <textarea
                      value={nodeInstruction}
                      onChange={(event) => setNodeInstruction(event.target.value)}
                      disabled={!selectedNode || isTyping}
                      className="h-28 w-full resize-none rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-xs leading-5 text-slate-300 outline-none transition-colors placeholder:text-slate-600 focus:border-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="描述这个节点要怎么重新生成..."
                    />
                    <button
                      onClick={handleRegenerateSelectedNode}
                      disabled={!selectedNode || isTyping}
                      className="mt-3 flex w-full items-center justify-center space-x-2 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw size={13} />
                      <span>{isTyping ? '运行中...' : '重跑当前节点'}</span>
                    </button>
                 </div>

                 {selectedNode?.data?.output && (
                   <div>
                     <h3 className="text-xs font-bold text-slate-400 mb-2">输出摘要 Output</h3>
                     <pre className="max-h-44 overflow-auto rounded-lg border border-white/10 bg-[#0B0B0C] p-3 text-[10px] leading-4 text-slate-400">
                       {JSON.stringify(selectedNode.data.output, null, 2)}
                     </pre>
                   </div>
                 )}
             </div>
          </div>
          )}

          {/* Floater Controls (Inside Canvas) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex items-center space-x-2 z-20">
               <div className="bg-[#1A1A1C] h-10 flex items-center px-1 rounded-xl shadow-xl border border-white/5">
                 <button onClick={() => setNotice('对话模式已在左侧输入框中可用。')} className="p-2 text-slate-400 hover:text-white transition-colors"><MessageSquare size={16} /></button>
                 <button onClick={() => setNotice('选择模式已启用：点击画布节点即可查看配置。')} className="p-2 text-slate-400 hover:text-white transition-colors"><MousePointer2 size={16} /></button>
                 <button onClick={() => setNotice('魔法工具会在批量节点操作接入后开放。')} className="p-2 text-slate-400 hover:text-white transition-colors"><Wand2 size={16} /></button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button onClick={() => setNotice('手动新增节点需要画布节点创建接口，当前由 Agent Run 自动创建。')} className="p-2 text-slate-400 hover:text-white transition-colors"><Plus size={16} /></button>
               </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-30 lg:hidden">
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#121213]/95 px-3 py-2 shadow-2xl backdrop-blur">
                <button onClick={handleFileUnavailable} className="p-1.5 text-slate-500">
                  <Paperclip size={16} />
                </button>
                <input
                  type="text"
                  placeholder="输入创作指令..."
                  disabled={!project}
                  className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isTyping || !project || !inputValue.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

          </div>
      {(selectedTaskDetail || runDetail) && (
        <div className="fixed inset-y-0 right-0 z-50 w-[380px] border-l border-white/10 bg-[#121213] p-6 text-slate-200 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{selectedTaskDetail ? '任务详情' : 'Run 详情'}</h2>
            <button
              onClick={() => {
                setSelectedTaskDetail(null);
                setRunDetail(null);
              }}
              className="text-slate-500 hover:text-white"
              aria-label="关闭详情"
            >
              <X size={18} />
            </button>
          </div>

          {selectedTaskDetail && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-slate-500">状态</div>
                <div className="mt-1 font-semibold text-slate-100">{selectedTaskDetail.status}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${selectedTaskDetail.progress}%` }} />
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">消息</div>
                <div className="mt-1 text-slate-300">{selectedTaskDetail.message}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-black/20 p-3">
                  <div className="text-slate-500">类型</div>
                  <div className="mt-1 text-slate-300">{selectedTaskDetail.type}</div>
                </div>
                <div className="rounded-lg bg-black/20 p-3">
                  <div className="text-slate-500">节点</div>
                  <div className="mt-1 break-all text-slate-300">{selectedTaskDetail.nodeId}</div>
                </div>
              </div>
              <pre className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#0B0B0C] p-3 text-[11px] leading-5 text-slate-400">
                {JSON.stringify(selectedTaskDetail, null, 2)}
              </pre>
            </div>
          )}

          {runDetail && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-slate-500">状态</div>
                <div className="mt-1 font-semibold text-slate-100">{runDetail.status}</div>
                {runDetail.error && <div className="mt-2 text-xs text-red-200">{runDetail.error}</div>}
              </div>
              {runDetail.monitor && (
                <div className="space-y-3 rounded-xl border border-brand/20 bg-brand/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">监控链路</div>
                      <div className="mt-1 text-[13px] font-semibold text-slate-100">
                        {runDetail.monitor.currentStep ? `运行中：${runDetail.monitor.currentStep}` : `瓶颈：${runDetail.monitor.bottleneckStep || '待采样'}`}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <div>{formatDuration(runDetail.monitor.runDurationMs)}</div>
                      <div>{runDetail.monitor.eventCount} events</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg bg-black/20 p-2">
                      <div className="text-slate-500">确认点</div>
                      <div className="mt-1 text-slate-200">{runDetail.monitor.confirmationWaitCount}</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2">
                      <div className="text-slate-500">确认等待</div>
                      <div className="mt-1 text-slate-200">{formatDuration(runDetail.monitor.totalConfirmationWaitMs)}</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2">
                      <div className="text-slate-500">打断</div>
                      <div className="mt-1 text-slate-200">{runDetail.monitor.interruptionCount}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(runDetail.monitor.steps || []).map((step) => (
                      <div key={step.step} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-semibold text-slate-200">{step.title || step.step}</span>
                          <span className="text-slate-500">{formatDuration(step.durationMs)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                          <span>{step.status}</span>
                          <span className="truncate">{step.modelSource || step.reason || step.agentName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {(runDetail.monitor.designSignals || []).map((signal, index) => (
                      <div key={`${runDetail.runId}-signal-${index}`} className="rounded-md bg-black/20 px-2 py-1.5 text-[11px] leading-5 text-brand">
                        {signal}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500">指令</div>
                <div className="mt-1 text-slate-300">{runDetail.message}</div>
              </div>
              <div>
                <div className="mb-2 text-xs text-slate-500">事件</div>
                <div className="max-h-[56vh] space-y-2 overflow-auto pr-1">
                  {(runDetail.events || []).map((event: SseEvent<any>) => (
                    <div key={event.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-brand">{event.event}</span>
                        <span className="text-slate-500">{new Date(event.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <pre className="mt-2 max-h-28 overflow-auto text-[10px] leading-4 text-slate-400">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
