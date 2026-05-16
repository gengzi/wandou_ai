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
  monitor?: AgentRunMonitorResponse;
  events: SseEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunMonitorResponse {
  runId: string;
  status: string;
  currentStep: string;
  bottleneckStep: string;
  runDurationMs: number;
  eventCount: number;
  interruptionCount: number;
  confirmationWaitCount: number;
  totalConfirmationWaitMs: number;
  steps: AgentStepMonitorResponse[];
  designSignals: string[];
  updatedAt: string;
}

export interface AgentStepMonitorResponse {
  step: string;
  title: string;
  agentName: string;
  status: string;
  reason: string;
  modelSource: string;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
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

export interface AssetPageResponse {
  content: AssetResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
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
  usedCredits: number;
  remainingCredits: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserPageResponse {
  content: UserResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface UserSummaryResponse {
  totalUsers: number;
  adminUsers: number;
  activeUsers: number;
  permissionCount: number;
}

export interface ModelUsageRecordResponse {
  id: string;
  runId?: string;
  projectId?: string;
  canvasId?: string;
  nodeId?: string;
  capability: string;
  provider: string;
  modelName: string;
  modelDisplayName?: string;
  compatibilityMode?: string;
  endpoint: string;
  requestCount: number;
  inputChars: number;
  outputChars: number;
  credits: number;
  status: string;
  errorMessage?: string;
  providerRequestId?: string;
  createdAt: string;
  completedAt: string;
  durationMs: number;
}

export interface UsageSummaryResponse {
  initialCredits: number;
  usedCredits: number;
  remainingCredits: number;
  requestCount: number;
  recentRecords: ModelUsageRecordResponse[];
}

export interface ModelUsageRecordPageResponse {
  content: ModelUsageRecordResponse[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface LoginResponse {
  tokenName: string;
  tokenValue: string;
  tokenType: string;
  user: UserResponse;
}

export interface ModelConfigResponse {
  id: string;
  capability: 'text' | 'image' | 'video' | 'audio';
  provider: string;
  displayName: string;
  baseUrl: string;
  modelName: string;
  compatibilityMode: 'openai' | 'qwave-task' | 'qingyun-task' | 'pollinations';
  apiKeyPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationResponse {
  type: 'chat' | 'image' | 'video';
  message: string;
  asset?: AssetResponse;
  node?: CanvasNodeResponse;
  metadata: Record<string, unknown>;
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
    throw new Error(await responseErrorMessage(response));
  }

  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) {
    throw new Error(result.message || 'Request failed');
  }
  return result.data;
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `请求失败：${response.status}`;
  try {
    const text = await response.text();
    if (!text) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(text) as Partial<ApiResponse<unknown>> & { error?: string };
      return parsed.message || parsed.error || fallback;
    } catch {
      return text.length > 240 ? `${text.slice(0, 240)}...` : text;
    }
  } catch {
    return fallback;
  }
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

export async function getUserSummary(): Promise<UserSummaryResponse> {
  return requestJson<UserSummaryResponse>('/api/users/summary');
}

export async function listUsersPage(payload: {
  keyword?: string;
  role?: string;
  status?: string;
  page?: number;
  size?: number;
}): Promise<UserPageResponse> {
  const url = new URL(apiUrl('/api/users/page'));
  if (payload.keyword) url.searchParams.set('keyword', payload.keyword);
  if (payload.role) url.searchParams.set('role', payload.role);
  if (payload.status) url.searchParams.set('status', payload.status);
  url.searchParams.set('page', String(payload.page ?? 0));
  url.searchParams.set('size', String(payload.size ?? 10));
  return requestJson<UserPageResponse>(url.toString());
}

export async function getMyUsage(): Promise<UsageSummaryResponse> {
  return requestJson<UsageSummaryResponse>('/api/usage/me');
}

export async function listMyUsageRecords(limit = 50): Promise<ModelUsageRecordResponse[]> {
  return requestJson<ModelUsageRecordResponse[]>(`/api/usage/me/records?limit=${limit}`);
}

export async function listMyUsageRecordPage(page = 0, size = 10): Promise<ModelUsageRecordPageResponse> {
  return requestJson<ModelUsageRecordPageResponse>(`/api/usage/me/records/page?page=${page}&size=${size}`);
}

export async function inviteUser(payload: { name: string; email: string; role: string }): Promise<UserResponse> {
  return requestJson<UserResponse>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listModelConfigs(): Promise<ModelConfigResponse[]> {
  return requestJson<ModelConfigResponse[]>('/api/model-configs');
}

export async function createModelConfig(payload: {
  capability: string;
  provider: string;
  displayName: string;
  baseUrl: string;
  modelName: string;
  compatibilityMode?: string;
  apiKey?: string;
  enabled?: boolean;
}): Promise<ModelConfigResponse> {
  return requestJson<ModelConfigResponse>('/api/model-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateModelConfig(id: string, payload: {
  capability: string;
  provider: string;
  displayName: string;
  baseUrl: string;
  modelName: string;
  compatibilityMode?: string;
  apiKey?: string;
  enabled?: boolean;
}): Promise<ModelConfigResponse> {
  return requestJson<ModelConfigResponse>(`/api/model-configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteModelConfig(id: string): Promise<void> {
  return requestJson<void>(`/api/model-configs/${id}`, { method: 'DELETE' });
}

export async function listProjects(): Promise<ProjectResponse[]> {
  return requestJson<ProjectResponse[]>('/api/projects');
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>(`/api/projects/${projectId}`);
}

export async function createProject(payload: {
  name?: string;
  description?: string;
  aspectRatio?: string;
  prompt?: string;
}): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateProject(projectId: string, payload: { name: string }): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>(`/api/projects/${projectId}`, {
    method: 'PATCH',
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

export async function updateCanvasNodeOutput(
  canvasId: string,
  nodeId: string,
  payload: { status?: string; output: Record<string, unknown> },
): Promise<CanvasNodeResponse> {
  return requestJson<CanvasNodeResponse>(`/api/canvas/${canvasId}/nodes/${nodeId}/output`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createCanvasNode(canvasId: string, payload: {
  type: string;
  title: string;
  status?: string;
  position?: CanvasPosition;
  data?: Record<string, unknown>;
}): Promise<CanvasNodeResponse> {
  return requestJson<CanvasNodeResponse>(`/api/canvas/${canvasId}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createCanvasEdge(canvasId: string, payload: { source: string; target: string }): Promise<CanvasEdgeResponse> {
  return requestJson<CanvasEdgeResponse>(`/api/canvas/${canvasId}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteCanvasNode(canvasId: string, nodeId: string): Promise<void> {
  return requestJson<void>(`/api/canvas/${canvasId}/nodes/${nodeId}`, { method: 'DELETE' });
}

export async function deleteCanvasEdge(canvasId: string, edgeId: string): Promise<void> {
  return requestJson<void>(`/api/canvas/${canvasId}/edges/${edgeId}`, { method: 'DELETE' });
}

export async function listAssets(projectId?: string): Promise<AssetResponse[]> {
  const url = new URL(apiUrl('/api/assets'));
  if (projectId) {
    url.searchParams.set('projectId', projectId);
  }
  return requestJson<AssetResponse[]>(url.toString());
}

export async function listAssetsPage(payload: {
  projectId?: string;
  type?: string;
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<AssetPageResponse> {
  const url = new URL(apiUrl('/api/assets/page'));
  if (payload.projectId) url.searchParams.set('projectId', payload.projectId);
  if (payload.type) url.searchParams.set('type', payload.type);
  if (payload.keyword) url.searchParams.set('keyword', payload.keyword);
  url.searchParams.set('page', String(payload.page ?? 0));
  url.searchParams.set('size', String(payload.size ?? 10));
  return requestJson<AssetPageResponse>(url.toString());
}

export async function getAsset(assetId: string): Promise<AssetResponse> {
  return requestJson<AssetResponse>(`/api/assets/${assetId}`);
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

export async function uploadAsset(payload: {
  projectId?: string;
  canvasId?: string;
  nodeId?: string;
  type?: string;
  name?: string;
  file: File;
}): Promise<AssetResponse> {
  const formData = new FormData();
  formData.set('file', payload.file);
  if (payload.projectId) formData.set('projectId', payload.projectId);
  if (payload.canvasId) formData.set('canvasId', payload.canvasId);
  if (payload.nodeId) formData.set('nodeId', payload.nodeId);
  if (payload.type) formData.set('type', payload.type);
  if (payload.name) formData.set('name', payload.name);
  return requestJson<AssetResponse>('/api/assets/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function generateChat(payload: {
  projectId?: string;
  canvasId?: string;
  conversationId?: string;
  prompt: string;
}): Promise<GenerationResponse> {
  return requestJson<GenerationResponse>('/api/generation/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function generateImage(payload: {
  projectId?: string;
  canvasId?: string;
  conversationId?: string;
  prompt: string;
}): Promise<GenerationResponse> {
  return requestJson<GenerationResponse>('/api/generation/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function generateVideo(payload: {
  projectId?: string;
  canvasId?: string;
  conversationId?: string;
  prompt: string;
}): Promise<GenerationResponse> {
  return requestJson<GenerationResponse>('/api/generation/video', {
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

export async function getTask(taskId: string): Promise<TaskResponse> {
  return requestJson<TaskResponse>(`/api/tasks/${taskId}`);
}
