export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
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

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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
  const result = await requestJson<LoginResponse>(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  setAuthToken(result.tokenValue);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await requestJson<void>(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}

export async function getCurrentUser(): Promise<UserResponse> {
  return requestJson<UserResponse>(`${API_BASE_URL}/api/auth/me`);
}

export async function listUsers(): Promise<UserResponse[]> {
  return requestJson<UserResponse[]>(`${API_BASE_URL}/api/users`);
}

export async function inviteUser(payload: { name: string; email: string; role: string }): Promise<UserResponse> {
  return requestJson<UserResponse>(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listProjects(): Promise<ProjectResponse[]> {
  return requestJson<ProjectResponse[]>(`${API_BASE_URL}/api/projects`);
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

export async function updateCanvasNodePosition(canvasId: string, nodeId: string, position: CanvasPosition): Promise<CanvasNodeResponse> {
  return requestJson<CanvasNodeResponse>(`${API_BASE_URL}/api/canvas/${canvasId}/nodes/${nodeId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

export async function createCanvasEdge(canvasId: string, payload: { source: string; target: string }): Promise<CanvasEdgeResponse> {
  return requestJson<CanvasEdgeResponse>(`${API_BASE_URL}/api/canvas/${canvasId}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listAssets(projectId?: string): Promise<AssetResponse[]> {
  const url = new URL(`${API_BASE_URL}/api/assets`);
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
  return requestJson<AssetResponse>(`${API_BASE_URL}/api/assets`, {
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
  return requestJson<AgentRunResponse>(`${API_BASE_URL}/api/agent/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function createRunEventSource(runId: string): EventSource {
  const token = getAuthToken();
  const url = new URL(`${API_BASE_URL}/api/agent/runs/${runId}/events`);
  if (token) {
    url.searchParams.set('Authorization', `Bearer ${token}`);
  }
  return new EventSource(url.toString());
}
