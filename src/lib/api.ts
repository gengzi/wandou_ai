export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface AgentRunResponse {
  runId: string;
  conversationId: string;
  canvasId: string;
  status: string;
  streamUrl: string;
}

export async function startAgentRun(payload: {
  projectId?: string;
  conversationId?: string;
  canvasId?: string;
  message: string;
  agentName?: string;
}): Promise<AgentRunResponse> {
  const response = await fetch(`${API_BASE_URL}/api/agent/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to start agent run: ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<AgentRunResponse>;
  if (!result.success) {
    throw new Error(result.message || 'Failed to start agent run');
  }
  return result.data;
}

export function createRunEventSource(runId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/api/agent/runs/${runId}/events`);
}
