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

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  aspectRatio: string;
  canvasId: string;
  conversationId: string;
  createdAt: string;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasNodeResponse {
  id: string;
  type: string;
  title: string;
  status: string;
  position: CanvasPosition;
  data: Record<string, unknown>;
  output: Record<string, unknown>;
  updatedAt: string;
}

export interface CanvasEdgeResponse {
  id: string;
  source: string;
  target: string;
}

export interface CanvasResponse {
  id: string;
  projectId: string;
  nodes: CanvasNodeResponse[];
  edges: CanvasEdgeResponse[];
  updatedAt: string;
}

export interface SseEvent<T = Record<string, unknown>> {
  id: string;
  event: string;
  runId: string;
  data: T;
  createdAt: string;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) {
    throw new Error(result.message || 'Request failed');
  }
  return result.data;
}

export async function createProject(payload: {
  name: string;
  description?: string;
  aspectRatio?: string;
}): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCanvas(canvasId: string): Promise<CanvasResponse> {
  return requestJson<CanvasResponse>(`${API_BASE_URL}/api/canvas/${canvasId}`);
}

export async function startAgentRun(payload: {
  projectId?: string;
  conversationId?: string;
  canvasId?: string;
  message: string;
  agentName?: string;
}): Promise<AgentRunResponse> {
  return requestJson<AgentRunResponse>(`${API_BASE_URL}/api/agent/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function createRunEventSource(runId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/api/agent/runs/${runId}/events`);
}
