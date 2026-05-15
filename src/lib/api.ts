export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_TOKEN_KEY = 'wandou.auth.token';

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

export interface AgentRunControlResponse {
  runId: string;
  status: string;
  message: string;
}

export interface AgentRunDetailResponse {
  runId: string;
  projectId: string;
  conversationId: string;
  canvasId: string;
  status: string;
  agentName: string;
  message: string;
  error?: string;
  checkpoint?: string;
  streamUrl: string;
  events: SseEvent[];
  createdAt: string;
  updatedAt: string;
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

export interface AssetResponse {
  id: string;
  projectId: string;
  canvasId: string;
  nodeId: string;
  type: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  createdAt: string;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  role: string;
  sender: string;
  content: string;
  createdAt: string;
}

export interface ConversationResponse {
  id: string;
  projectId: string;
  messages: MessageResponse[];
  updatedAt: string;
}

export interface TaskResponse {
  id: string;
  runId: string;
  projectId: string;
  canvasId: string;
  nodeId: string;
  type: string;
  status: string;
  progress: number;
  message: string;
  updatedAt: string;
}

export interface SseEvent<T = Record<string, unknown>> {
  id: string;
  event: string;
  runId: string;
  data: T;
  createdAt: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginResponse {
  tokenName: string;
  tokenValue: string;
  tokenType: string;
  user: UserResponse;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  const token = getAuthToken();
  if (token && !nextHeaders.has('Authorization')) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  return nextHeaders;
}

function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const base = API_BASE_URL || window.location.origin;
  return new URL(path, base).toString();
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), {
    ...options,
    headers: authHeaders(options?.headers),
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) {
    throw new Error(result.message || 'Request failed');
  }
  return result.data;
}

export async function login(payload: { email: string; password: string }): Promise<LoginResponse> {
  const result = await requestJson<LoginResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  setAuthToken(result.tokenValue);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await requestJson<void>('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}

export async function getCurrentUser(): Promise<UserResponse> {
  return requestJson<UserResponse>('/api/auth/me');
}

export async function listUsers(): Promise<UserResponse[]> {
  return requestJson<UserResponse[]>('/api/users');
}

export async function inviteUser(payload: { name: string; email: string; role: string }): Promise<UserResponse> {
  return requestJson<UserResponse>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listProjects(): Promise<ProjectResponse[]> {
  return requestJson<ProjectResponse[]>('/api/projects');
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>(`/api/projects/${projectId}`);
}

export async function createProject(payload: {
  name: string;
  description?: string;
  aspectRatio?: string;
}): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCanvas(canvasId: string): Promise<CanvasResponse> {
  return requestJson<CanvasResponse>(`/api/canvas/${canvasId}`);
}

export async function updateCanvasNodePosition(canvasId: string, nodeId: string, position: CanvasPosition): Promise<CanvasNodeResponse> {
  return requestJson<CanvasNodeResponse>(`/api/canvas/${canvasId}/nodes/${nodeId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

export async function createCanvasEdge(canvasId: string, payload: { source: string; target: string }): Promise<CanvasEdgeResponse> {
  return requestJson<CanvasEdgeResponse>(`/api/canvas/${canvasId}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listAssets(projectId?: string): Promise<AssetResponse[]> {
  const url = new URL(apiUrl('/api/assets'));
  if (projectId) {
    url.searchParams.set('projectId', projectId);
  }
  return requestJson<AssetResponse[]>(url.toString());
}

export async function createAsset(payload: {
  projectId?: string;
  canvasId?: string;
  nodeId?: string;
  type: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
}): Promise<AssetResponse> {
  return requestJson<AssetResponse>('/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function startAgentRun(payload: {
  projectId?: string;
  conversationId?: string;
  canvasId?: string;
  message: string;
  agentName?: string;
  mode?: string;
  nodeId?: string;
}): Promise<AgentRunResponse> {
  return requestJson<AgentRunResponse>('/api/agent/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function confirmAgentRun(runId: string, comment?: string): Promise<AgentRunControlResponse> {
  return requestJson<AgentRunControlResponse>(`/api/agent/runs/${runId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
}

export async function interruptAgentRun(runId: string, comment?: string): Promise<AgentRunControlResponse> {
  return requestJson<AgentRunControlResponse>(`/api/agent/runs/${runId}/interrupt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
}

export async function resumeAgentRun(runId: string, comment?: string): Promise<AgentRunControlResponse> {
  return requestJson<AgentRunControlResponse>(`/api/agent/runs/${runId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
}

export async function cancelAgentRun(runId: string, comment?: string): Promise<AgentRunControlResponse> {
  return requestJson<AgentRunControlResponse>(`/api/agent/runs/${runId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
}

export function createRunEventSource(runId: string): EventSource {
  const token = getAuthToken();
  const url = new URL(apiUrl(`/api/agent/runs/${runId}/events`));
  if (token) {
    url.searchParams.set('Authorization', `Bearer ${token}`);
  }
  return new EventSource(url.toString());
}

export async function getAgentRun(runId: string): Promise<AgentRunDetailResponse> {
  return requestJson<AgentRunDetailResponse>(`/api/agent/runs/${runId}`);
}

export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  return requestJson<ConversationResponse>(`/api/conversations/${conversationId}`);
}

export async function listTasks(projectId?: string): Promise<TaskResponse[]> {
  const url = new URL(apiUrl('/api/tasks'));
  if (projectId) {
    url.searchParams.set('projectId', projectId);
  }
  return requestJson<TaskResponse[]>(url.toString());
}
