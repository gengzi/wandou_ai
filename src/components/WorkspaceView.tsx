import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Share2, Plus, Wand2, Video, MessageSquare, MousePointer2, Send, ImagePlus, Settings2, RefreshCw, CheckCircle2, PauseCircle, XCircle, X, ChevronDown } from 'lucide-react';
import { ReactFlow, useNodesState, useEdgesState, addEdge, ReactFlowProvider, Node, Edge, Connection, MiniMap, ReactFlowInstance, MarkerType, ConnectionLineType } from '@xyflow/react';
import { ScriptNode, CharacterNode, StoryboardNode, ImagesNode, AudioNode, FinalVideoNode } from './CanvasNodes';
import { AgentRunDetailResponse, AssetResponse, CanvasEdgeResponse, CanvasNodeResponse, CanvasResponse, ConversationResponse, GenerationResponse, ModelConfigResponse, TaskResponse, UsageSummaryResponse, cancelAgentRun, confirmAgentRun, createCanvasEdge, createCanvasNode, createProject, createRunEventSource, deleteCanvasEdge, deleteCanvasNode, generateChat, generateImage, generateVideo, getAgentRun, getAuthToken, getCanvas, getConversation, getMyUsage, getProject, getTask, interruptAgentRun, listAgentRuns, listAssets, listModelConfigs, listTasks, ProjectResponse, resumeAgentRun, SseEvent, startAgentRun, updateCanvasNodeOutput, updateCanvasNodePosition, uploadAsset } from '../lib/api';

const nodeTypes = {
  script: ScriptNode,
  character: CharacterNode,
  storyboard: StoryboardNode,
  images: ImagesNode,
  video: ImagesNode,
  audio: AudioNode,
  final: FinalVideoNode,
};

const withAssetAuthQuery = (url: string) => {
  if (!url || !url.startsWith('/api/')) return url;
  const token = getAuthToken();
  if (!token) return url;
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set('Authorization', `Bearer ${token}`);
  return nextUrl.pathname + nextUrl.search;
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

const NODE_COLLISION_PADDING_X = 72;
const NODE_COLLISION_PADDING_Y = 42;
const NODE_RIGHT_GAP = 430;
const NODE_LANE_STEP_Y = 310;
const WORKFLOW_TOP_Y = 120;
const WORKFLOW_TOP_STACK_GAP_Y = 620;
const WORKFLOW_DETAIL_Y = 640;
const WORKFLOW_DETAIL_GAP_Y = 360;
const WORKFLOW_DETAIL_STACK_GAP_Y = 320;
const DETAIL_NODE_RENDER_LIMIT = 18;
const SHOT_NAV_WINDOW = 9;
const WORKFLOW_COLUMNS = {
  script: 80,
  character: 500,
  storyboard: 920,
  audio: 1340,
  firstFrame: 1340,
  lastFrame: 1680,
  video: 2020,
  final: 2180,
  misc: 2460,
} as const;
type WorkflowStage = keyof typeof WORKFLOW_COLUMNS;
const WORKFLOW_DETAIL_STAGES = new Set<WorkflowStage>(['firstFrame', 'lastFrame', 'video']);

interface WorkflowShotIndex {
  shotIndexByNode: Map<string, number>;
  maxStackByShot: Map<number, number>;
}

interface ShotSummary {
  shotIndex: number;
  nodeCount: number;
  runningCount: number;
  failedCount: number;
  successCount: number;
}

function estimateNodeSize(node: Pick<Node, 'type'>): { width: number; height: number } {
  if (node.type === 'character') return { width: 380, height: 520 };
  if (node.type === 'storyboard') return { width: 340, height: 520 };
  if (node.type === 'script') return { width: 320, height: 420 };
  if (node.type === 'final') return { width: 340, height: 430 };
  if (node.type === 'audio') return { width: 320, height: 260 };
  return { width: 300, height: 260 };
}

function nodesOverlap(left: Node, right: Node): boolean {
  const leftSize = estimateNodeSize(left);
  const rightSize = estimateNodeSize(right);
  return !(
    left.position.x + leftSize.width + NODE_COLLISION_PADDING_X <= right.position.x
    || right.position.x + rightSize.width + NODE_COLLISION_PADDING_X <= left.position.x
    || left.position.y + leftSize.height + NODE_COLLISION_PADDING_Y <= right.position.y
    || right.position.y + rightSize.height + NODE_COLLISION_PADDING_Y <= left.position.y
  );
}

function clampCanvasPosition(position: { x: number; y: number }) {
  return {
    x: Math.max(40, position.x),
    y: Math.max(40, position.y),
  };
}

function resolveNodePosition(candidate: Node, existingNodes: Node[]): Node {
  const occupied = existingNodes.filter((node) => node.id !== candidate.id);
  const base = clampCanvasPosition(candidate.position);
  const candidatePositions = [
    base,
    { x: base.x + NODE_RIGHT_GAP, y: base.y },
    { x: base.x, y: base.y + NODE_LANE_STEP_Y },
    { x: base.x + NODE_RIGHT_GAP, y: base.y + NODE_LANE_STEP_Y },
    { x: base.x + NODE_RIGHT_GAP * 2, y: base.y },
    { x: base.x + NODE_RIGHT_GAP * 2, y: base.y + NODE_LANE_STEP_Y },
  ];

  for (let lane = 0; lane < 16; lane += 1) {
    candidatePositions.push({
      x: base.x + Math.floor(lane / 4) * NODE_RIGHT_GAP,
      y: base.y + (lane % 4) * NODE_LANE_STEP_Y,
    });
  }

  const uniquePositions = candidatePositions.filter((position, index, positions) => (
    positions.findIndex((item) => item.x === position.x && item.y === position.y) === index
  ));

  for (const position of uniquePositions) {
    const next = { ...candidate, position: clampCanvasPosition(position) };
    if (!occupied.some((node) => nodesOverlap(next, node))) {
      return next;
    }
  }

  const rightMostX = occupied.reduce((max, node) => {
    const size = estimateNodeSize(node);
    return Math.max(max, node.position.x + size.width);
  }, base.x);
  return {
    ...candidate,
    position: {
      x: rightMostX + NODE_RIGHT_GAP,
      y: 120 + (occupied.length % 6) * NODE_LANE_STEP_Y,
    },
  };
}

function normalizeCanvasNodes(nextNodes: Node[]): Node[] {
  return nextNodes.reduce<Node[]>((settled, node) => {
    settled.push(resolveNodePosition(node, settled));
    return settled;
  }, []);
}

function nodeDataString(node: Node, key: string): string {
  const value = node.data?.[key];
  return typeof value === 'string' ? value : '';
}

function nodeDataNumber(node: Node, key: string): number | undefined {
  const value = node.data?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function workflowStage(node: Node): WorkflowStage {
  const step = nodeDataString(node, 'step');
  const type = nodeTypeName(node);
  if (type === 'script') return 'script';
  if (type === 'character') return 'character';
  if (type === 'storyboard') return 'storyboard';
  if (type === 'audio') return 'audio';
  if (type === 'final') return 'final';
  if (type === 'video') return 'video';
  if (step === 'first-frame') return 'firstFrame';
  if (step === 'last-frame') return 'lastFrame';
  if (type === 'images') return 'firstFrame';
  return 'misc';
}

function isDetailWorkflowNode(node: Node): boolean {
  return WORKFLOW_DETAIL_STAGES.has(workflowStage(node));
}

function buildWorkflowShotIndex(nextNodes: Node[]): WorkflowShotIndex {
  let fallbackShotIndex = 1;
  const shotIndexByNode = new Map<string, number>();
  const detailStageCounts = new Map<string, number>();
  const maxStackByShot = new Map<number, number>();

  nextNodes.forEach((node) => {
    const stage = workflowStage(node);
    if (!WORKFLOW_DETAIL_STAGES.has(stage)) return;
    const explicitShotIndex = nodeDataNumber(node, 'shotIndex');
    const shotIndex = explicitShotIndex && explicitShotIndex > 0 ? explicitShotIndex : fallbackShotIndex;
    if (!explicitShotIndex) fallbackShotIndex += 1;
    shotIndexByNode.set(node.id, shotIndex);
    const key = `${shotIndex}:${stage}`;
    const count = (detailStageCounts.get(key) || 0) + 1;
    detailStageCounts.set(key, count);
    maxStackByShot.set(shotIndex, Math.max(maxStackByShot.get(shotIndex) || 1, count));
  });

  return { shotIndexByNode, maxStackByShot };
}

function layoutCanvasNodesLeftToRight(nextNodes: Node[]): Node[] {
  const workflowNodes = nextNodes.filter((node) => {
    const type = nodeTypeName(node);
    return ['script', 'character', 'storyboard', 'audio', 'images', 'video', 'final'].includes(type);
  });
  if (workflowNodes.length < 4) {
    return normalizeCanvasNodes(nextNodes);
  }

  const { shotIndexByNode, maxStackByShot } = buildWorkflowShotIndex(nextNodes);

  const orderedShots = Array.from(maxStackByShot.keys()).sort((left, right) => left - right);
  const shotLaneY = new Map<number, number>();
  orderedShots.reduce((cursorY, shotIndex) => {
    shotLaneY.set(shotIndex, cursorY);
    const laneHeight = Math.max(WORKFLOW_DETAIL_GAP_Y, (maxStackByShot.get(shotIndex) || 1) * WORKFLOW_DETAIL_STACK_GAP_Y);
    return cursorY + laneHeight;
  }, WORKFLOW_DETAIL_Y);

  const topStageCounters = new Map<WorkflowStage, number>();
  const detailStageCounters = new Map<string, number>();
  const arranged = nextNodes.map((node) => {
    const stage = workflowStage(node);
    let position: { x: number; y: number };

    if (WORKFLOW_DETAIL_STAGES.has(stage)) {
      const shotIndex = shotIndexByNode.get(node.id) || 1;
      const key = `${shotIndex}:${stage}`;
      const stackIndex = detailStageCounters.get(key) || 0;
      detailStageCounters.set(key, stackIndex + 1);
      position = {
        x: WORKFLOW_COLUMNS[stage],
        y: (shotLaneY.get(shotIndex) || WORKFLOW_DETAIL_Y) + stackIndex * WORKFLOW_DETAIL_STACK_GAP_Y,
      };
    } else {
      const stageIndex = topStageCounters.get(stage) || 0;
      topStageCounters.set(stage, stageIndex + 1);
      position = {
        x: WORKFLOW_COLUMNS[stage],
        y: WORKFLOW_TOP_Y + stageIndex * WORKFLOW_TOP_STACK_GAP_Y,
      };
    }

    return { ...node, position };
  });
  return arranged;
}

function nextNodePositionNear(basePosition: { x: number; y: number }, type: string | undefined, existingNodes: Node[]) {
  const candidate = {
    id: '__candidate__',
    type,
    position: {
      x: basePosition.x + NODE_RIGHT_GAP,
      y: basePosition.y,
    },
    data: {},
  } as Node;
  return resolveNodePosition(candidate, existingNodes).position;
}

interface Message {
  id: string;
  sender: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  kind?: 'normal' | 'process';
  status?: 'running' | 'success' | 'failed';
  media?: MessageMedia;
}

interface MessageMedia {
  type: 'image' | 'video';
  name: string;
  url: string;
  thumbnailUrl: string;
}

interface RestoredProjectContext {
  messageCount: number;
  processCount: number;
  nodeCount: number;
  assetCount: number;
  taskCount: number;
  updatedAt?: string;
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

interface ChatModelSelectProps {
  label: string;
  value: string;
  configs: ModelConfigResponse[];
  onChange: (value: string) => void;
}

interface GenerationSettings {
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  audioEnabled: boolean;
  multiCameraEnabled: boolean;
}

const aspectRatioOptions = ['16:9', '4:3', '1:1', '3:4', '9:16'];
const resolutionOptions = ['720p', '1080p'];
const durationOptions = [3, 4, 5, 6, 7, 8, 10];

const defaultGenerationSettings: GenerationSettings = {
  aspectRatio: '16:9',
  resolution: '720p',
  durationSeconds: 5,
  audioEnabled: true,
  multiCameraEnabled: false,
};

function ChatModelSelect({ label, value, configs, onChange }: ChatModelSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedConfig = configs.find((config) => config.id === value);
  const selectedLabel = selectedConfig?.displayName || selectedConfig?.modelName || '默认';
  const options = [
    { id: '', label: '默认', meta: '使用系统默认模型' },
    ...configs.map((config) => ({
      id: config.id,
      label: config.displayName || config.modelName,
      meta: config.modelName,
    })),
  ];

  return (
    <div
      className="wandou-model-select relative min-w-[160px] text-[10px]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-2 text-left text-slate-400 transition-colors hover:border-brand/30 hover:bg-white/[0.06]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
      <span className="shrink-0 text-slate-500">{label}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-200">{selectedLabel}</span>
        <ChevronDown className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} size={12} />
      </button>
      {open && (
        <div
          className="wandou-model-menu absolute left-0 top-full z-50 mt-1.5 max-h-60 w-[260px] overflow-y-auto rounded-xl border border-white/10 bg-[#18191B]/95 p-1.5 shadow-2xl backdrop-blur"
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.id === value;
            return (
              <button
                key={option.id || 'default'}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? 'bg-brand/15 text-brand'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
                role="option"
                aria-selected={selected}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold">{option.label}</span>
                  <span className="block truncate text-[9px] text-slate-500">{option.meta}</span>
                </span>
                {selected && <CheckCircle2 size={13} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GenerationSettingsPanel({
  settings,
  onChange,
}: {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
}) {
  const patch = (next: Partial<GenerationSettings>) => onChange({ ...settings, ...next });
  return (
    <div className="wandou-generation-panel mb-3 rounded-[20px] border border-white/10 bg-[#101112] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold text-slate-100">生成配置</div>
          <div className="mt-0.5 text-[10px] text-slate-500">启动流程前确认，本次 Run 会带入这些参数。</div>
        </div>
        <div className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand">待确认</div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-slate-400">比例</div>
          <div className="grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {aspectRatioOptions.map((ratio) => (
              <button
                key={ratio}
                onClick={() => patch({ aspectRatio: ratio })}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold transition-colors ${
                  settings.aspectRatio === ratio
                    ? 'border border-brand/30 bg-brand/15 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                }`}
              >
                <span
                  className="block rounded border-2"
                  style={{
                    width: ratio === '16:9' ? 18 : ratio === '4:3' ? 16 : ratio === '1:1' ? 15 : ratio === '3:4' ? 13 : 12,
                    height: ratio === '16:9' ? 10 : ratio === '4:3' ? 12 : ratio === '1:1' ? 15 : ratio === '3:4' ? 17 : 20,
                    borderColor: 'currentColor',
                  }}
                />
                <span>{ratio}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-slate-400">分辨率</div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {resolutionOptions.map((resolution) => (
              <button
                key={resolution}
                onClick={() => patch({ resolution })}
                className={`h-9 rounded-lg text-[12px] font-bold transition-colors ${
                  settings.resolution === resolution
                    ? 'border border-brand/30 bg-brand/15 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                }`}
              >
                {resolution === '1080p' ? (
                  <span>{resolution.toUpperCase()} <span className="rounded-full bg-amber-200 px-1 py-0.5 text-[8px] font-black text-amber-900">VIP</span></span>
                ) : resolution.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-400">视频时长</span>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1 text-[13px] font-bold text-slate-100">
              {settings.durationSeconds}<span className="ml-1 text-[11px] text-slate-500">s</span>
            </div>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            step={1}
            value={settings.durationSeconds}
            onChange={(event) => patch({ durationSeconds: Number(event.target.value) })}
            className="w-full accent-brand"
          />
        </div>

        <div className="space-y-2 border-t border-white/5 pt-2">
          <ToggleRow label="音效" value={settings.audioEnabled} onChange={(value) => patch({ audioEnabled: value })} />
          <ToggleRow label="多镜头" value={settings.multiCameraEnabled} onChange={(value) => patch({ multiCameraEnabled: value })} />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-semibold text-slate-200">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={`relative h-7 w-12 rounded-full border transition-colors ${
          value ? 'border-brand/40 bg-brand/35' : 'border-white/10 bg-white/10'
        }`}
      >
        <span className={`absolute left-1 top-1 h-5 w-5 rounded-full shadow transition-transform ${
          value ? 'translate-x-5 bg-brand' : 'translate-x-0 bg-slate-300'
        }`} />
      </button>
    </div>
  );
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

interface ScriptEditState {
  nodeId: string;
  summary: string;
  style: string;
  beatsText: string;
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

function settingsSummary(settings?: Record<string, unknown>) {
  if (!settings) return '';
  const duration = getDisplayText(settings.duration, settings.durationSeconds);
  const durationText = duration ? (String(duration).endsWith('s') ? String(duration) : `${duration}s`) : '';
  return [
    getDisplayText(settings.aspectRatio),
    getDisplayText(settings.resolution).toUpperCase(),
    durationText,
    typeof settings.audioEnabled === 'boolean' ? (settings.audioEnabled ? '音效开' : '音效关') : '',
    typeof settings.multiCameraEnabled === 'boolean' ? (settings.multiCameraEnabled ? '多镜头' : '单镜头') : '',
  ].filter(Boolean).join(' · ');
}

function nodeCapabilityText(type?: string) {
  if (type === 'script') return '可编辑剧本草稿，确认后会驱动角色、分镜和视频节点。';
  if (type === 'character') return '可查看多个角色设定和参考图，重跑后会影响后续分镜与关键帧。';
  if (type === 'storyboard') return '每个分镜会拆成首帧、尾帧和独立视频片段，最终由成片节点聚合。';
  if (type === 'images') return '可作为关键帧或参考图，支持重新生图、批量变体和图生视频。';
  if (type === 'video') return '单个分镜视频片段，可按节点参数重跑或继续进入最终合成。';
  if (type === 'audio') return '记录配乐、环境声和关键音效设计，后续合成会引用。';
  if (type === 'final') return '聚合所有分镜 clips、音频和审查结果，是最终成片出口。';
  return '可查看节点输出、引用到输入框，或输入指令重跑该节点。';
}

function nodeErrorText(output?: Record<string, unknown>) {
  return getString(
    output?.imageGenerationError,
    output?.videoGenerationError,
    output?.error,
    output?.fallbackReason,
  );
}

function sourceLabel(output?: Record<string, unknown>) {
  const source = getString(output?.modelSource);
  if (source === 'configured-text-model') {
    return getString(output?.modelDisplayName, output?.modelName, '已配置文本模型');
  }
  if (source === 'template-fallback') {
    return '模板兜底';
  }
  return '';
}

function formatDuration(ms?: number) {
  const value = Number(ms || 0);
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
}

function statusLabel(status?: string) {
  if (status === 'success') return '成功';
  if (status === 'running') return '运行中';
  if (status === 'failed') return '失败';
  if (status === 'cancelled') return '已取消';
  if (status === 'interrupted') return '已打断';
  if (status === 'waiting_confirmation') return '等待确认';
  if (status === 'idle') return '待处理';
  return status || '--';
}

function capabilityLabel(type?: string) {
  if (type === 'text' || type === 'chat') return '文本';
  if (type === 'image' || type === 'images') return '图片/关键帧';
  if (type === 'video') return '视频';
  if (type === 'audio') return '音频';
  if (type === 'script') return '剧本';
  if (type === 'character') return '角色';
  if (type === 'storyboard') return '分镜';
  if (type === 'final') return '成片';
  return type || '--';
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
    interactionWidth: 22,
    style: { stroke: '#64748b', strokeWidth: 1.6, opacity: 0.46 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#64748b',
      width: 11,
      height: 11,
    },
  };
}

function nodeTypeName(node?: Node): string {
  return typeof node?.type === 'string' ? node.type : '';
}

function isCoreWorkflowEdge(
  edge: Edge,
  nodeTypeById: Map<string, string>,
  hasCharacterStoryboardEdge: boolean,
  hasAudioFinalEdge: boolean
): boolean {
  const sourceType = nodeTypeById.get(edge.source) || '';
  const targetType = nodeTypeById.get(edge.target) || '';
  if (sourceType === 'script' && targetType === 'character') return true;
  if (sourceType === 'character' && targetType === 'storyboard') return true;
  if (sourceType === 'storyboard' && targetType === 'audio') return true;
  if (sourceType === 'audio' && targetType === 'final') return true;
  if (!hasCharacterStoryboardEdge && sourceType === 'script' && targetType === 'storyboard') return true;
  if (!hasAudioFinalEdge && sourceType === 'storyboard' && targetType === 'final') return true;
  return false;
}

function presentCanvasEdge(edge: Edge, options: { primary: boolean; focused: boolean; muted: boolean }): Edge {
  const color = options.focused ? '#34d399' : options.primary ? '#8fb3d9' : '#5b6f8a';
  const opacity = options.focused ? 0.95 : options.primary ? 0.72 : options.muted ? 0.38 : 0.48;
  return {
    ...edge,
    type: 'default',
    animated: options.focused,
    interactionWidth: options.focused ? 28 : 22,
    zIndex: options.focused ? 10 : options.primary ? 4 : 1,
    style: {
      stroke: color,
      strokeWidth: options.focused ? 2.5 : options.primary ? 1.8 : 1.15,
      opacity,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
      width: options.focused ? 15 : 10,
      height: options.focused ? 15 : 10,
    },
  };
}

function toMessage(message: ConversationResponse['messages'][number]): Message {
  return {
    id: message.id,
    sender: message.sender || (message.role === 'user' ? '用户' : '创作助手'),
    role: message.role === 'user' ? 'user' : 'agent',
    content: message.content,
    timestamp: new Date(message.createdAt),
  };
}

function processMessagesFromRun(run: AgentRunDetailResponse): Message[] {
  const completedSteps = new Set((run.events || [])
    .filter((event) => event.event === 'agent.step.completed')
    .map((event) => String(event.data?.step || ''))
    .filter(Boolean));
  return (run.events || []).flatMap((event): Message[] => {
    const data = event.data || {};
    const timestamp = new Date(event.createdAt);
    if (event.event === 'message.delta') {
      return [{
        id: `history-delta-${event.runId}-${event.id}`,
        sender: getString(data.sender, run.agentName, '创作助手'),
        role: 'agent',
        content: getString(data.content, data.delta, '正在分析你的创作需求...'),
        timestamp,
        kind: 'process',
        status: 'success',
      }];
    }
    if (event.event === 'agent.step.started') {
      if (completedSteps.has(String(data.step || ''))) {
        return [];
      }
      return [{
        id: `history-step-start-${event.runId}-${String(data.step || event.id)}`,
        sender: getString(data.agentName, run.agentName, '创作助手'),
        role: 'agent',
        content: `开始：${getString(data.title, data.step)}\n正在读取上下文、调用模型并整理结构化输出...`,
        timestamp,
        kind: 'process',
        status: 'running',
      }];
    }
    if (event.event === 'agent.step.completed') {
      const step = String(data.step || event.id);
      const output = (data.output && typeof data.output === 'object') ? data.output as Record<string, unknown> : {};
      return [{
        id: `history-step-${event.runId}-${step}`,
        sender: getString(data.agentName, run.agentName, '创作助手'),
        role: 'agent',
        content: formatStepOutput(getString(data.title, step), getString(data.content), output),
        timestamp,
        kind: 'process',
        status: 'success',
      }];
    }
    if (event.event === 'agent.confirmation.required') {
      return [{
        id: `history-confirmation-${event.runId}-${String(data.checkpoint || event.id)}`,
        sender: '系统',
        role: 'agent',
        content: getString(data.message, '请确认后继续。'),
        timestamp,
        kind: 'process',
        status: run.status === 'waiting_confirmation' ? 'running' : 'success',
      }];
    }
    if (event.event === 'agent.confirmation.accepted') {
      return [{
        id: `history-confirmed-${event.runId}-${event.id}`,
        sender: '系统',
        role: 'agent',
        content: '已确认，继续生成。',
        timestamp,
        kind: 'process',
        status: 'success',
      }];
    }
    if (event.event === 'task.failed') {
      const task = data.task && typeof data.task === 'object' ? data.task as Record<string, unknown> : {};
      return [{
        id: `history-task-failed-${event.runId}-${getString(task.id, event.id)}`,
        sender: '系统',
        role: 'agent',
        content: `任务失败：${getString(task.message, data.message, '节点任务执行失败。')}`,
        timestamp,
        kind: 'process',
        status: 'failed',
      }];
    }
    if (event.event === 'run.failed') {
      return [{
        id: `history-run-failed-${event.runId}`,
        sender: '系统',
        role: 'agent',
        content: `失败：${getString(data.error, data.message, run.error, '本次生成失败。')}`,
        timestamp,
        kind: 'process',
        status: 'failed',
      }];
    }
    if (event.event === 'run.completed') {
      return [{
        id: `history-run-completed-${event.runId}`,
        sender: '系统',
        role: 'agent',
        content: '本次智能体流程已完成。',
        timestamp,
        kind: 'process',
        status: 'success',
      }];
    }
    return [];
  });
}

function mergeRestoredMessages(conversationMessages: Message[], runs: AgentRunDetailResponse[]): Message[] {
  const byId = new Map<string, Message>();
  [...conversationMessages, ...runs.flatMap(processMessagesFromRun)].forEach((message) => {
    byId.set(message.id, message);
  });
  return [...byId.values()].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
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

function toMessageMedia(result: GenerationResponse): MessageMedia | undefined {
  if (!result.asset || (result.type !== 'image' && result.type !== 'video')) {
    return undefined;
  }
  return {
    type: result.type,
    name: result.asset.name || (result.type === 'video' ? '生成视频' : '生成图片'),
    url: result.asset.url,
    thumbnailUrl: result.asset.thumbnailUrl || result.asset.url,
  };
}

function friendlyDirectMessage(result: GenerationResponse): string {
  if (result.type === 'image' && result.asset) {
    return '图片已生成，已添加到画布。';
  }
  if (result.type === 'video' && result.asset) {
    return '视频已生成，已添加到画布。';
  }
  return result.message;
}

function MediaMessageCard({ media }: { media: MessageMedia }) {
  const previewUrl = withAssetAuthQuery(media.thumbnailUrl || media.url);
  const mediaUrl = withAssetAuthQuery(media.url);
  const isVideo = media.type === 'video';
  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0C]">
      <div className="relative aspect-video bg-slate-950">
        {isVideo && mediaUrl ? (
          <video
            src={mediaUrl}
            poster={previewUrl || undefined}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={media.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-slate-500">
            媒体已创建，等待预览地址。
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
          <span className="min-w-0 truncate text-[12px] font-semibold text-white">{media.name}</span>
          {mediaUrl && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
            >
              打开
            </a>
          )}
        </div>
      </div>
    </div>
  );
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
  const normalized = message.toLowerCase();
  return ['图片', '生图', '海报', '插画', '照片', '图像', '关键帧', '概念图', 'image', 'picture', 'poster', 'illustration', 'keyframe', 'concept art'].some((keyword) => normalized.includes(keyword));
}

function looksLikeVideoCommand(message: string): boolean {
  const normalized = message.toLowerCase();
  return ['视频', '短片', '广告片', '图生视频', '文生视频', '成片', '8秒', '10秒', 'video', 'short film', 'film', 'clip', 'movie'].some((keyword) => normalized.includes(keyword));
}

function looksLikeAgentWorkflowCommand(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return ['完整流程', 'agent run', '分镜', '剧本', '三段确认', '工作流', 'script', 'storyboard', 'character', 'characters', 'keyframe', 'keyframes', 'workflow'].some((keyword) => normalized.includes(keyword));
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
  const [restoredContext, setRestoredContext] = useState<RestoredProjectContext | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [lastCreativePrompt, setLastCreativePrompt] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeInstruction, setNodeInstruction] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>('idle');
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [stepOutputs, setStepOutputs] = useState<Record<string, StepOutputState>>({});
  const [setupError, setSetupError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [usageSummary, setUsageSummary] = useState<UsageSummaryResponse | null>(null);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigResponse[]>([]);
  const [selectedTextModelId, setSelectedTextModelId] = useState('');
  const [selectedImageModelId, setSelectedImageModelId] = useState('');
  const [selectedVideoModelId, setSelectedVideoModelId] = useState('');
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(defaultGenerationSettings);
  const [generationSettingsOpen, setGenerationSettingsOpen] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskResponse | null>(null);
  const [runDetail, setRunDetail] = useState<AgentRunDetailResponse | null>(null);
  const [scriptEdit, setScriptEdit] = useState<ScriptEditState | null>(null);
  const [activeCanvasSection, setActiveCanvasSection] = useState<CanvasSection>('总览');
  const [expandedShotIndex, setExpandedShotIndex] = useState<number | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const mobilePromptInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const internallyDeletedNodesRef = useRef<Set<string>>(new Set());
  const internallyDeletedEdgesRef = useRef<Set<string>>(new Set());
  const stepOutputsRef = useRef<Record<string, StepOutputState>>({});
  const autoStartedPromptRef = useRef<string>('');
  const restoreFitPendingRef = useRef(false);

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const selectedNodeType = selectedNode?.type ? String(selectedNode.type) : '';
  const selectedNodeOutput = selectedNode?.data?.output as Record<string, unknown> | undefined;
  const selectedNodeParameters = (selectedNodeOutput?.parameters || {}) as Record<string, unknown>;
  const selectedNodeTitle = String(selectedNode?.data?.title || selectedNode?.id || '当前节点');
  const canEditSelectedScript = Boolean(selectedNode && selectedNodeType === 'script');
  const canTuneSelectedVideo = ['image', 'images', 'video', 'final'].includes(selectedNodeType);
  const highlightedCanvasSection = selectedNode ? sectionForNode(selectedNode) : activeCanvasSection;
  const enabledTextModels = modelConfigs.filter((config) => config.enabled && config.capability === 'text');
  const enabledImageModels = modelConfigs.filter((config) => config.enabled && config.capability === 'image');
  const enabledVideoModels = modelConfigs.filter((config) => config.enabled && config.capability === 'video');
  const runningTaskCount = tasks.filter(task => task.status === 'running').length;
  const confirmationReferenceAssets = confirmation ? assets
    .filter((asset) => asset.type === 'image')
    .slice(0, 6) : [];
  const generationSettingsSummary = `${generationSettings.aspectRatio} · ${generationSettings.resolution.toUpperCase()} · ${generationSettings.durationSeconds}s · ${generationSettings.audioEnabled ? '音效开' : '音效关'} · ${generationSettings.multiCameraEnabled ? '多镜头' : '单镜头'}`;
  const latestRunParameters = [...nodes].reverse()
    .map((node) => {
      const output = node.data?.output as Record<string, unknown> | undefined;
      return output?.parameters as Record<string, unknown> | undefined;
    })
    .find((parameters) => Boolean(parameters && Object.keys(parameters).length > 0));
  const latestRunSettingsSummary = settingsSummary(latestRunParameters);
  const selectedNodeSettingsSummary = settingsSummary(selectedNodeParameters);
  const selectedNodeError = nodeErrorText(selectedNodeOutput);
  const workflowShotIndex = useMemo(() => buildWorkflowShotIndex(nodes), [nodes]);
  const detailNodeCount = workflowShotIndex.shotIndexByNode.size;
  const performanceCanvasMode = detailNodeCount > DETAIL_NODE_RENDER_LIMIT;
  const shotSummaries = useMemo<ShotSummary[]>(() => {
    const summaries = new Map<number, ShotSummary>();
    nodes.forEach((node) => {
      const shotIndex = workflowShotIndex.shotIndexByNode.get(node.id);
      if (!shotIndex) return;
      const current = summaries.get(shotIndex) || {
        shotIndex,
        nodeCount: 0,
        runningCount: 0,
        failedCount: 0,
        successCount: 0,
      };
      const status = String(node.data?.status || '');
      current.nodeCount += 1;
      if (status === 'running') current.runningCount += 1;
      if (status === 'failed') current.failedCount += 1;
      if (status === 'success') current.successCount += 1;
      summaries.set(shotIndex, current);
    });
    return Array.from(summaries.values()).sort((left, right) => left.shotIndex - right.shotIndex);
  }, [nodes, workflowShotIndex]);
  const visibleShotSummaries = useMemo(() => {
    if (shotSummaries.length <= SHOT_NAV_WINDOW) return shotSummaries;
    const activeIndex = Math.max(0, shotSummaries.findIndex((shot) => shot.shotIndex === expandedShotIndex));
    const half = Math.floor(SHOT_NAV_WINDOW / 2);
    const start = Math.min(Math.max(0, activeIndex - half), Math.max(0, shotSummaries.length - SHOT_NAV_WINDOW));
    return shotSummaries.slice(start, start + SHOT_NAV_WINDOW);
  }, [expandedShotIndex, shotSummaries]);
  const visibleCanvasNodes = useMemo(() => {
    if (!performanceCanvasMode) return nodes;
    return nodes.filter((node) => {
      const shotIndex = workflowShotIndex.shotIndexByNode.get(node.id);
      if (!shotIndex) return true;
      return expandedShotIndex === shotIndex;
    });
  }, [expandedShotIndex, nodes, performanceCanvasMode, workflowShotIndex]);
  const visibleNodeIds = useMemo(() => new Set(visibleCanvasNodes.map((node) => node.id)), [visibleCanvasNodes]);
  const nodeTypeById = useMemo(() => new Map(nodes.map((node) => [node.id, nodeTypeName(node)])), [nodes]);
  const canvasEdges = useMemo(() => {
    const hasCharacterStoryboardEdge = edges.some((edge) =>
      nodeTypeById.get(edge.source) === 'character' && nodeTypeById.get(edge.target) === 'storyboard'
    );
    const hasAudioFinalEdge = edges.some((edge) =>
      nodeTypeById.get(edge.source) === 'audio' && nodeTypeById.get(edge.target) === 'final'
    );
    return edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        const primary = isCoreWorkflowEdge(edge, nodeTypeById, hasCharacterStoryboardEdge, hasAudioFinalEdge);
        const focused = Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId));
        return presentCanvasEdge(edge, {
          primary,
          focused,
          muted: !primary && !focused,
        });
      });
  }, [edges, nodeTypeById, selectedNodeId, visibleNodeIds]);

  const openScriptEditor = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) {
      setSetupError('未找到可编辑的剧本节点。');
      return;
    }
    const output = (node.data?.output || {}) as Record<string, unknown>;
    const beats = Array.isArray(output.beats) ? output.beats.map(String) : [];
    setScriptEdit({
      nodeId,
      summary: getString(output.summary, output.content),
      style: getString(output.style),
      beatsText: beats.join('\n'),
    });
  }, [nodes]);

  const scriptConfirmationComment = useCallback(() => {
    const scriptNode = nodes.find((node) => node.id === 'script-1' || node.type === 'script');
    const output = (scriptNode?.data?.output || {}) as Record<string, unknown>;
    const summary = getString(output.summary, output.content);
    const style = getString(output.style);
    const beats = Array.isArray(output.beats) ? output.beats.map(String).filter(Boolean) : [];
    if (!summary && !style && beats.length === 0) {
      return '前端确认继续';
    }
    return [
      summary ? `确认后的剧本摘要：${summary}` : '',
      style ? `风格：${style}` : '',
      beats.length > 0 ? `关键节拍：\n${beats.map((beat, index) => `${index + 1}. ${beat}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');
  }, [nodes]);

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
    setExpandedShotIndex(workflowShotIndex.shotIndexByNode.get(node.id) || null);
    const output = node.data?.output as Record<string, unknown> | undefined;
    const prompt = typeof output?.prompt === 'string' ? output.prompt : '';
    setNodeInstruction(prompt);
  }, [workflowShotIndex]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const focusCanvasSection = useCallback((section: CanvasSection) => {
    setActiveCanvasSection(section);
    if (section === '总览') {
      setSelectedNodeId(null);
      setExpandedShotIndex(null);
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
      setNotice(`${section} 节点还没有生成，可直接在对话中发送创作指令。`);
      return;
    }

    setSetupError(null);
    setSelectedNodeId(preferred.id);
    setExpandedShotIndex(workflowShotIndex.shotIndexByNode.get(preferred.id) || null);
    const output = preferred.data?.output as Record<string, unknown> | undefined;
    setNodeInstruction(typeof output?.prompt === 'string' ? output.prompt : '');
    flowInstance?.setCenter(
      preferred.position.x + 70,
      preferred.position.y + 130,
      { duration: 450, zoom: section === '视频' ? 0.78 : 0.9 }
    );
  }, [flowInstance, nodes, workflowShotIndex]);

  const applyCanvas = useCallback((canvas: CanvasResponse) => {
    setNodes(layoutCanvasNodesLeftToRight(canvas.nodes.map(toFlowNode)));
    setEdges(canvas.edges.map(toFlowEdge));
    setExpandedShotIndex(null);
  }, [setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      try {
        setSetupError(null);
        setNotice(null);
        setRestoredContext(null);
        restoreFitPendingRef.current = false;
        const nextProject = projectId
          ? await getProject(projectId)
          : await createProject({
              name: '',
              description: '前后端联动工作区',
              aspectRatio: '16:9',
              prompt: initialPrompt,
            });
        if (cancelled) return;
        setProject(nextProject);
        const [canvas, conversation, nextTasks, nextAssets, restoredRuns] = await Promise.all([
          getCanvas(nextProject.canvasId),
          getConversation(nextProject.conversationId),
          listTasks(nextProject.id),
          listAssets(nextProject.id),
          listAgentRuns(nextProject.id).catch(() => []),
        ]);
        if (cancelled) return;
        applyCanvas(canvas);
        setTasks(nextTasks.map(toTask));
        setAssets(nextAssets.map(toAsset));
        const conversationMessages = conversation.messages.map(toMessage);
        const processMessages = restoredRuns.flatMap(processMessagesFromRun);
        const nextMessages = mergeRestoredMessages(conversationMessages, restoredRuns);
        const latestUserMessage = [...nextMessages].reverse().find((message) => message.role === 'user');
        setLastCreativePrompt(latestUserMessage?.content || initialPrompt || nextProject.description || '');
        setMessages(nextMessages.length > 0
          ? nextMessages
          : [{
              id: 'welcome',
              sender: '系统',
              role: 'agent',
              content: '输入创作指令开始。智能体会在这里确认方向，并同步更新画布节点。',
              timestamp: new Date(),
            }]);
        if (projectId) {
          setRestoredContext({
            messageCount: conversation.messages.length,
            processCount: processMessages.length,
            nodeCount: canvas.nodes.length,
            assetCount: nextAssets.length,
            taskCount: nextTasks.length,
            updatedAt: conversation.updatedAt || canvas.updatedAt,
          });
          restoreFitPendingRef.current = canvas.nodes.length > 0;
        }
        try {
          const configs = await listModelConfigs();
          if (cancelled) return;
          setModelConfigs(configs);
          setSelectedTextModelId((current) => current || configs.find((config) => config.enabled && config.capability === 'text')?.id || '');
          setSelectedImageModelId((current) => current || configs.find((config) => config.enabled && config.capability === 'image')?.id || '');
          setSelectedVideoModelId((current) => current || configs.find((config) => config.enabled && config.capability === 'video')?.id || '');
        } catch (modelError) {
          console.warn('模型配置加载失败', modelError);
        }
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
  }, [applyCanvas, initialPrompt, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!flowInstance || !restoreFitPendingRef.current || nodes.length === 0) {
      return;
    }
    restoreFitPendingRef.current = false;
    window.requestAnimationFrame(() => {
      flowInstance.fitView({ duration: 480, padding: 0.24 });
    });
  }, [flowInstance, nodes]);

  const upsertNode = useCallback((node: CanvasNodeResponse) => {
    setNodes((currentNodes) => {
      const nextNode = toFlowNode(node);
      const exists = currentNodes.some((item) => item.id === nextNode.id);
      return exists
        ? currentNodes.map((item) => item.id === nextNode.id ? { ...item, ...nextNode, position: item.position } : item)
        : [...currentNodes, resolveNodePosition(nextNode, currentNodes)];
    });
  }, [setNodes]);

  const saveScriptEdit = useCallback(async () => {
    if (!project || !scriptEdit) return;
    const beats = scriptEdit.beatsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      const updated = await updateCanvasNodeOutput(project.canvasId, scriptEdit.nodeId, {
        status: 'success',
        output: {
          summary: scriptEdit.summary.trim(),
          style: scriptEdit.style.trim(),
          beats,
          editedByUser: true,
        },
      });
      upsertNode(updated);
      setScriptEdit(null);
      setNotice('剧本已更新，确认后会按修改后的版本继续生成。');
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `剧本保存失败：${error.message}` : '剧本保存失败。');
    }
  }, [project, scriptEdit, upsertNode]);

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
      setLastRunId(event.runId);
      setRunStatus('running');
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
      setMessages((prev) => prev.map((item) => item.id === `stream-${event.runId}`
        ? { ...item, status: 'success' }
        : item));
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
      if (event.event === 'task.failed') {
        const task = data.task || {};
        const message = getString(task.message, data.message, '节点任务执行失败。');
        setMessages((prev) => [...prev, {
          id: `task-failed-${event.runId}-${task.id || event.id || Date.now()}`,
          sender: '系统',
          role: 'agent',
          content: `任务失败：${message}`,
          timestamp: new Date(event.createdAt),
          kind: 'process',
          status: 'failed',
        }]);
      }
    }

    if (event.event === 'agent.step.started') {
      setRunStatus('running');
      setMessages((prev) => [...prev, {
        id: `step-${event.runId}-${String(data.step || event.id)}`,
        sender: data.agentName || '创作助手',
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
            sender: String(data.agentName || '创作助手'),
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
      setMessages((prev) => {
        const messageId = `confirmation-${event.runId}-${String(data.checkpoint || 'review')}`;
        const nextMessage: Message = {
          id: messageId,
          sender: '系统',
          role: 'agent',
          content: String(data.message || '请确认后继续。'),
          timestamp: new Date(event.createdAt),
          kind: 'process',
          status: 'running',
        };
        return prev.some((item) => item.id === messageId)
          ? prev.map((item) => item.id === messageId ? nextMessage : item)
          : [...prev, nextMessage];
      });
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
        const errorMessage = getString(data.error, data.message, '本次生成失败。');
        setMessages((prev) => [...prev, {
          id: `failed-${event.runId}`,
          sender: '系统',
          role: 'agent',
          content: `失败：${errorMessage}`,
          timestamp: new Date(event.createdAt),
          kind: 'process',
          status: 'failed',
        }]);
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
    setLastCreativePrompt(cleanMessage);
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
        const directModelConfigId = looksLikeVideoCommand(cleanMessage)
          ? selectedVideoModelId
          : looksLikeImageCommand(cleanMessage) || looksLikeCreativeCommand(cleanMessage)
            ? selectedImageModelId
            : selectedTextModelId;
        const payload = {
          projectId: project.id,
          conversationId: project.conversationId,
          canvasId: project.canvasId,
          prompt: cleanMessage,
          modelConfigId: directModelConfigId || undefined,
          ...generationSettings,
        };
        const result = looksLikeVideoCommand(cleanMessage)
          ? await generateVideo(payload)
          : looksLikeImageCommand(cleanMessage) || looksLikeCreativeCommand(cleanMessage)
            ? await generateImage(payload)
            : await generateChat(payload);
        const media = toMessageMedia(result);

        setMessages(prev => [...prev, {
          id: `assistant-direct-${Date.now()}`,
          sender: result.type === 'image' ? '图片生成' : result.type === 'video' ? '视频生成' : '对话助手',
          role: 'agent',
          content: friendlyDirectMessage(result),
          timestamp: new Date(),
          media,
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
        textModelConfigId: selectedTextModelId || undefined,
        imageModelConfigId: selectedImageModelId || undefined,
        videoModelConfigId: selectedVideoModelId || undefined,
        ...generationSettings,
      });

      setActiveRunId(run.runId);
      setLastRunId(run.runId);
      setRunStatus('running');
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
        setMessages((prev) => [...prev, {
          id: `stream-error-${run.runId}-${Date.now()}`,
          sender: '系统',
          role: 'agent',
          content: '过程流已断开，请打开运行详情或重试本次智能体流程。',
          timestamp: new Date(),
          kind: 'process',
          status: 'failed',
        }]);
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
  }, [generationSettings, handleRunEvent, project, selectedImageModelId, selectedTextModelId, selectedVideoModelId, upsertNode]);

  const handleConfirmRun = async () => {
    if (!activeRunId) return;
    try {
      const result = await confirmAgentRun(activeRunId, confirmation?.checkpoint === 'script' ? scriptConfirmationComment() : '前端确认继续');
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
    const runId = activeRunId || lastRunId;
    if (!runId) {
      setNotice('当前还没有可查看的智能体运行记录。');
      return;
    }
    try {
      setRunDetail(await getAgentRun(runId));
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `运行详情加载失败：${error.message}` : '运行详情加载失败。');
    }
  };

  const openFilePicker = (mobile = false) => {
    if (!project) {
      setSetupError('项目尚未初始化，请稍后再上传参考图。');
      return;
    }
    (mobile ? mobileFileInputRef.current : fileInputRef.current)?.click();
  };

  const handleAssetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !project) return;
    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'asset';
    setIsUploadingAsset(true);
    try {
      const uploaded = await uploadAsset({
        projectId: project.id,
        canvasId: project.canvasId,
        nodeId: selectedNode?.id,
        type,
        name: file.name,
        file,
      });
      const asset = toAsset(uploaded);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setMessages((current) => [...current, {
        id: `asset-upload-${asset.id}`,
        sender: '系统',
        role: 'agent',
        content: `${type === 'image' ? '参考图' : '素材'}已上传并保存到对象存储，后续智能体流程会把它作为项目上下文使用。`,
        timestamp: new Date(),
        media: type === 'image' || type === 'video'
          ? {
              type: type as 'image' | 'video',
              name: asset.name,
              url: asset.url,
              thumbnailUrl: asset.thumbnailUrl || asset.url,
            }
          : undefined,
      }]);
      setNotice(`${file.name} 已上传为项目${type === 'image' ? '参考图' : '素材'}。`);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请稍后重试。');
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleQuoteSelectedNode = () => {
    if (!selectedNode) {
      setNotice('请先点击画布中的一个节点，再把它的内容引用到指令里。');
      return;
    }
    const output = selectedNodeOutput || {};
    const quote = getString(
      output.summary,
      output.prompt,
      output.content,
      JSON.stringify(output).slice(0, 500),
      selectedNodeTitle
    );
    setInputValue((current) => {
      const prefix = current.trim() ? `${current.trim()}\n\n` : '';
      return `${prefix}参考「${selectedNodeTitle}」：${quote}`;
    });
    setNotice('已把当前节点内容引用到输入框。');
  };

  const handleDraftPrompt = () => {
    const referenceHint = assets.some((asset) => asset.type === 'image')
      ? '，并优先参考已上传的角色/风格图片'
      : '';
    const nodeHint = selectedNode ? `，延续「${selectedNodeTitle}」的内容` : '';
    setInputValue((current) => current.trim() || `生成一个 ${generationSettings.aspectRatio}、${generationSettings.durationSeconds}s、${generationSettings.resolution.toUpperCase()} 的短视频${referenceHint}${nodeHint}，需要包含剧本、角色、分镜、关键帧、逐镜头视频和最终成片。`);
  };

  const handleFocusPrompt = () => {
    promptInputRef.current?.focus();
    mobilePromptInputRef.current?.focus();
  };

  const handleSelectNodeTool = () => {
    const nextNodeId = selectedNode?.id || nodes[0]?.id;
    if (!nextNodeId) {
      setNotice('当前画布还没有可选择的节点。');
      return;
    }
    setSelectedNodeId(nextNodeId);
    setNotice('节点配置已打开。点击画布中的其他节点可切换配置对象。');
  };

  const handleMagicCanvasTool = () => {
    setNodes((current) => layoutCanvasNodesLeftToRight(current));
    window.requestAnimationFrame(() => {
      flowInstance?.fitView({ padding: 0.24, duration: 320 });
    });
    handleDraftPrompt();
    setNotice('已按从左到右的流程整理画布，并生成可编辑的创作指令草稿。');
  };

  const handleAddCanvasNode = async () => {
    if (!project) {
      setSetupError('项目尚未初始化，无法新增节点。');
      return;
    }
    const nextIndex = nodes.length + 1;
    const basePosition = selectedNode?.position || nodes[nodes.length - 1]?.position || { x: 80, y: 260 };
    const position = nextNodePositionNear(basePosition, 'script', nodes);
    try {
      const created = await createCanvasNode(project.canvasId, {
        type: 'script',
        title: `补充剧本节点 ${nextIndex}`,
        status: 'idle',
        position,
        data: { title: `补充剧本节点 ${nextIndex}`, status: 'idle' },
      });
      const flowNode = toFlowNode(created);
      setNodes((current) => [...current, resolveNodePosition(flowNode, current)]);
      if (selectedNode) {
        const edge = await createCanvasEdge(project.canvasId, { source: selectedNode.id, target: created.id });
        setEdges((current) => addEdge(toFlowEdge(edge), current));
      }
      setSelectedNodeId(created.id);
      flowInstance?.setCenter(position.x + 160, position.y + 170, { duration: 360, zoom: 0.72 });
      setNotice('已新增节点，可在右侧配置里输入节点指令并重跑。');
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `新增节点失败：${error.message}` : '新增节点失败。');
    }
  };

  const handleOpenUsage = async () => {
    try {
      const summary = await getMyUsage();
      setUsageSummary(summary);
      const recentCost = summary.recentRecords.slice(0, 3)
        .map((record) => `${capabilityLabel(record.capability)} ${record.credits} 点`)
        .join('，');
      setNotice(`剩余 ${summary.remainingCredits} 点，已用 ${summary.usedCredits} 点，请求 ${summary.requestCount} 次${recentCost ? `。最近：${recentCost}` : '。'}`);
    } catch (error) {
      console.error(error);
      setSetupError(error instanceof Error ? `用量加载失败：${error.message}` : '用量加载失败。');
    }
  };

  const handleOpenVideoTasks = () => {
    setActiveCanvasSection('视频');
    const videoTask = tasks.find((task) => task.nodeId.toLowerCase().includes('video')) || tasks[0];
    if (videoTask) {
      void handleOpenTask(videoTask.id);
      setNotice('已打开视频/任务上下文。');
      return;
    }
    const videoNode = nodes.find((node) => node.type === 'video' || node.type === 'final');
    if (videoNode) {
      setSelectedNodeId(videoNode.id);
      setNotice('已定位到视频节点。');
      return;
    }
    setNotice('当前还没有视频任务。输入视频指令后会在这里同步生成任务上下文。');
  };

  const handleOpenShareDialog = () => {
    if (!project) {
      setSetupError('项目尚未初始化，无法分享回放。');
      return;
    }
    setShareDialogOpen(true);
  };

  const handleShareReplay = async () => {
    if (!project) {
      setSetupError('项目尚未初始化，无法生成回放链接。');
      return;
    }
    const replayUrl = `${window.location.origin}${window.location.pathname}?replayProjectId=${encodeURIComponent(project.id)}`;
    try {
      await navigator.clipboard.writeText(replayUrl);
      setShareDialogOpen(false);
      setNotice('历史回放链接已复制。未登录用户也可以打开查看分享人的完整对话流程。');
    } catch {
      setInputValue((current) => current || replayUrl);
      setNotice('浏览器未允许写入剪贴板，已把历史回放链接放到输入框，也可以在分享弹窗中手动复制。');
    }
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

  const updateSelectedNodeParameters = async (patch: Record<string, unknown>, noticeText: string) => {
    if (!project || !selectedNode) {
      setNotice('请先选择一个节点。');
      return;
    }
    const currentOutput = (selectedNode.data?.output || {}) as Record<string, unknown>;
    try {
      const updated = await updateCanvasNodeOutput(project.canvasId, selectedNode.id, {
        status: String(selectedNode.data?.status || 'success'),
        output: {
          ...currentOutput,
          parameters: {
            ...((currentOutput.parameters || {}) as Record<string, unknown>),
            ...patch,
          },
        },
      });
      upsertNode(updated);
      setGenerationSettings((current) => {
        const nextDuration = typeof patch.durationSeconds === 'number'
          ? patch.durationSeconds
          : typeof patch.duration === 'string'
            ? Number(patch.duration.replace(/\D/g, '')) || current.durationSeconds
            : current.durationSeconds;
        return {
          ...current,
          aspectRatio: typeof patch.aspectRatio === 'string' ? patch.aspectRatio : current.aspectRatio,
          resolution: typeof patch.resolution === 'string' ? patch.resolution : current.resolution,
          durationSeconds: nextDuration,
        };
      });
      setNodeInstruction((current) => {
        const nextHint = Object.entries(patch).map(([key, value]) => `${key}: ${value}`).join('，');
        return current.includes(nextHint) ? current : `${current ? `${current}\n` : ''}参数要求：${nextHint}`;
      });
      setNotice(noticeText);
    } catch (nextError) {
      setSetupError(nextError instanceof Error ? nextError.message : '节点参数保存失败');
    }
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

      if (detail.action === 'edit-script') {
        openScriptEditor(detail.nodeId);
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
          mode: 'image-to-video',
          nodeId: detail.nodeId,
        });
        return;
      }

      if (detail.action === 'image-variant') {
        void runAgent(detail.prompt || `基于节点 ${detail.title || detail.nodeId} 生成视觉变体`, {
          mode: 'image-variant',
          nodeId: detail.nodeId,
        });
        return;
      }

      if (detail.action === 'batch-image') {
        void runAgent(detail.prompt || `基于节点 ${detail.title || detail.nodeId} 批量生成 4 张视觉变体`, {
          mode: 'batch-image',
          nodeId: detail.nodeId,
        });
        return;
      }

      if (detail.action === 'download' && detail.url) {
        window.open(detail.url, '_blank', 'noopener,noreferrer');
        return;
      }

      setNotice('该节点操作已转换为可编辑指令，请确认后发送。');
      setInputValue(detail.prompt || `继续处理节点：${detail.title || detail.nodeId}`);
    };

    window.addEventListener('wandou:canvas-node-action', handleNodeAction);
    return () => window.removeEventListener('wandou:canvas-node-action', handleNodeAction);
  }, [deleteNodePersistently, openScriptEditor, runAgent]);

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || !project || autoStartedPromptRef.current === prompt) {
      return;
    }
    autoStartedPromptRef.current = prompt;
    void runAgent(prompt);
  }, [initialPrompt, project, runAgent]);

  return (
    <div className="wandou-workspace h-full flex bg-bg-dark text-slate-200">
      {/* Interaction Sidebar (Left) */}
      <div className="wandou-workspace-sidebar hidden lg:flex lg:w-[400px] xl:w-[430px] h-full border-r border-white/5 bg-[#151516] flex-col z-20 shadow-2xl relative">
        {/* Top Header of Sidebar */}
        <header className="wandou-workspace-header h-[64px] flex items-center justify-between gap-3 px-5 border-b border-white/5 bg-[#151516]">
          <div className="flex min-w-0 items-center space-x-3">
             <div className="w-8 h-8 shrink-0 rounded-xl bg-brand flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="text-white font-black text-sm italic">W</span>
             </div>
             <div className="min-w-0">
               <h1 className="truncate text-[15px] font-bold text-white tracking-wide">{project?.name || '豌豆工作室'}</h1>
               <div className="truncate text-[10px] text-slate-500">故事短片智能体工作流</div>
             </div>
          </div>
          <div className="flex shrink-0 items-center space-x-2">
             {/* Credits */}
             <button onClick={handleOpenUsage} className="hidden 2xl:flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-full cursor-pointer hover:bg-brand/20 transition-colors tooltip" aria-label="算力点数" title="查看算力用量">
                <div className="w-3.5 h-3.5 rounded-full bg-brand flex items-center justify-center">
                  <Wand2 size={8} className="text-white" />
                </div>
                <span className="text-brand text-[12px] font-bold">{usageSummary?.remainingCredits ?? 1200}</span>
                <Plus size={12} className="text-brand/80" />
             </button>
             
             {/* Tasks */}
             <button onClick={handleOpenVideoTasks} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title={runningTaskCount > 0 ? `视频任务：${runningTaskCount} 个运行中` : '视频任务'}>
               <Video size={18} />
               {tasks.length > 0 && (
                 <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#121213] bg-brand px-1 text-[9px] font-bold text-white">
                   {runningTaskCount || tasks.length}
                 </span>
               )}
             </button>

             {/* Share */}
             <button onClick={handleOpenShareDialog} disabled={!project} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[12px] font-medium hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50" title="分享历史回放" aria-label="分享历史回放">
                <Share2 size={14} className="opacity-80" />
             </button>
          </div>
        </header>

          <div className="wandou-chat-scroll flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide" ref={scrollRef}>

          {setupError && (
            <div className="max-h-28 overflow-auto rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200 [overflow-wrap:anywhere] whitespace-pre-wrap">
              {setupError}
            </div>
          )}

          {notice && (
            <div className="max-h-28 overflow-auto rounded-xl border border-brand/25 bg-brand/10 p-3 text-[12px] text-brand">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap">{notice}</span>
                <button onClick={() => setNotice(null)} className="text-[11px] font-semibold text-slate-300 hover:text-white">关闭</button>
              </div>
            </div>
          )}

          {restoredContext && (
            <div className="rounded-xl border border-brand/20 bg-brand/10 px-3 py-2 text-[11px] text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-brand">项目已恢复</span>
                <span className="text-slate-500">
                  {restoredContext.updatedAt ? new Date(restoredContext.updatedAt).toLocaleString() : ''}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
                <span>{restoredContext.messageCount} 条对话</span>
                <span>{restoredContext.processCount} 条过程</span>
                <span>{restoredContext.nodeCount} 个画布节点</span>
                <span>{restoredContext.assetCount} 个素材</span>
                <span>{restoredContext.taskCount} 个任务</span>
              </div>
            </div>
          )}

            <div className="space-y-5 mt-4">
              {messages.map((msg, idx) => (
                <div key={msg.id} className="space-y-4">
                  {msg.role === 'user' ? (
                     <div className="flex justify-end">
                       <div className="bg-transparent text-slate-200 text-[12px] font-medium px-1">
                         {msg.content}
                       </div>
                     </div>
                  ) : (
                    <>
                      {/* Only showing this complex structure for the first pre-filled message mapping to UI */}
                      {idx === 0 && (
                    <div className={`whitespace-pre-wrap break-words text-[12px] leading-6 ${
                          msg.kind === 'process'
                            ? 'rounded-xl border border-brand/20 bg-brand/10 p-3 text-slate-300'
                            : 'text-slate-300'
                        }`}>
                          {msg.content}
                        </div>
                      )}

                      {idx === 0 && msg.media && <MediaMessageCard media={msg.media} />}

                      {idx !== 0 && (
                        <div className={`whitespace-pre-wrap break-words text-[12px] leading-6 ${
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

                      {idx !== 0 && msg.media && <MediaMessageCard media={msg.media} />}

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

          {scriptEdit && (
            <div className="wandou-script-editor border-t border-white/5 bg-[#121213] p-4">
              <div className="wandou-script-editor-card rounded-xl border border-brand/25 bg-[#171719] p-4 shadow-[0_0_24px_rgba(16,185,129,0.08)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-bold text-slate-200">编辑剧本草稿</div>
                    <div className="mt-1 text-[11px] text-slate-500">保存后再确认，后续角色、分镜和视频会按修改后的版本继续。</div>
                  </div>
                  <button onClick={() => setScriptEdit(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="关闭编辑">
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">摘要</span>
                    <textarea
                      value={scriptEdit.summary}
                      onChange={(event) => setScriptEdit((current) => current ? { ...current, summary: event.target.value } : current)}
                      className="min-h-[78px] w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px] leading-5 text-slate-200 outline-none focus:border-brand/50"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">风格</span>
                    <input
                      value={scriptEdit.style}
                      onChange={(event) => setScriptEdit((current) => current ? { ...current, style: event.target.value } : current)}
                      className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-[12px] text-slate-200 outline-none focus:border-brand/50"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">关键节拍（每行一个）</span>
                    <textarea
                      value={scriptEdit.beatsText}
                      onChange={(event) => setScriptEdit((current) => current ? { ...current, beatsText: event.target.value } : current)}
                      className="min-h-[118px] w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px] leading-5 text-slate-200 outline-none focus:border-brand/50"
                    />
                  </label>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => setScriptEdit(null)} className="h-9 rounded-lg border border-white/10 bg-white/5 text-[12px] font-bold text-slate-300 hover:bg-white/10">
                    取消
                  </button>
                  <button onClick={saveScriptEdit} className="h-9 rounded-lg bg-brand text-[12px] font-bold text-white hover:bg-brand/90">
                    保存剧本
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Chat Input */}
            <div className="wandou-chat-input-shell p-4 border-t border-white/5 bg-[#151516]">
            {(activeRunId || confirmation) && (
              <div className="mb-3 space-y-2">
                {confirmation && confirmationReferenceAssets.length > 0 && (
                  <div className="rounded-xl border border-brand/20 bg-brand/10 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-200">确认使用参考图</span>
                      <span className="text-[10px] text-slate-500">{confirmationReferenceAssets.length} 张</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {confirmationReferenceAssets.map((asset) => {
                        const previewUrl = withAssetAuthQuery(asset.thumbnailUrl || asset.url);
                        return (
                          <div key={asset.id} className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/25" title={asset.name}>
                            <div className="absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] leading-3 text-slate-500">
                              {asset.name || '参考图'}
                            </div>
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={asset.name}
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
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
              </div>
            )}
            <div className="wandou-chat-composer rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_24%_0%,rgba(16,185,129,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(26,26,28,0.96))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors focus-within:border-brand/40">
              <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleAssetUpload} />
              <div className="flex items-start gap-2">
                <button
                  onClick={() => openFilePicker(false)}
                  disabled={!project || isUploadingAsset}
                  className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.035] text-slate-400 transition-all hover:border-brand/35 hover:bg-brand/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  title="上传参考图、视频或音频素材"
                >
                  <ImagePlus size={17} className="transition-transform group-hover:scale-105" />
                </button>
                <button
                  onClick={handleQuoteSelectedNode}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                    selectedNode
                      ? 'border-brand/30 bg-brand/10 text-brand hover:bg-brand/15'
                      : 'border-white/10 bg-white/[0.025] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300'
                  }`}
                  title={selectedNode ? '引用选中节点内容' : '先选择画布节点后引用'}
                >
                  <MousePointer2 size={17} />
                </button>
                <textarea
                  ref={promptInputRef}
                  rows={3}
                  placeholder="描述或输入指令（支持上传参考图、视频）..."
                  disabled={!project}
                  className="max-h-40 min-h-[76px] min-w-0 flex-1 resize-y border-none bg-transparent py-1 text-[12px] leading-5 text-slate-200 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                {inputValue.trim() ? (
                  <button 
                    onClick={handleSendMessage}
                    disabled={isTyping || !project}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-[0_0_18px_rgba(16,185,129,0.26)] transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                    title="发送"
                  >
                    <Send size={14} />
                  </button>
                ) : (
                  <button onClick={handleDraftPrompt} disabled={!project} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40" title="生成指令草稿">
                    <Wand2 size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setGenerationSettingsOpen((open) => !open)}
                className="mt-3 flex w-full min-w-0 items-center justify-between gap-3 border-t border-white/[0.08] pt-2 text-left"
                title={latestRunSettingsSummary ? `最近运行：${latestRunSettingsSummary}` : '展开生成设置'}
                aria-expanded={generationSettingsOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Settings2 size={14} className="shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-slate-200">生成设置</span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {generationSettingsSummary}
                    </span>
                  </span>
                </span>
                <ChevronDown className={`shrink-0 text-slate-500 transition-transform ${generationSettingsOpen ? 'rotate-180' : ''}`} size={14} />
              </button>
            </div>
            {generationSettingsOpen && (
              <div className="mt-2 space-y-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-2">
                  <ChatModelSelect
                    label="文本"
                    value={selectedTextModelId}
                    configs={enabledTextModels}
                    onChange={setSelectedTextModelId}
                  />
                  <ChatModelSelect
                    label="图片"
                    value={selectedImageModelId}
                    configs={enabledImageModels}
                    onChange={setSelectedImageModelId}
                  />
                  <ChatModelSelect
                    label="视频"
                    value={selectedVideoModelId}
                    configs={enabledVideoModels}
                    onChange={setSelectedVideoModelId}
                  />
                  {modelConfigs.length === 0 && (
                    <span className="px-1 text-[10px] text-slate-500">可在模型配置中添加可用模型</span>
                  )}
                </div>
                <GenerationSettingsPanel settings={generationSettings} onChange={setGenerationSettings} />
              </div>
            )}
          </div>
      </div>

      {/* Central Canvas Workspace */}
      <div className="canvas-dot-surface flex-1 min-w-0 flex bg-[#0B0B0C] relative overflow-hidden">
         {/* Center Area container */}
         <div className="flex-1 flex flex-col z-0 relative">
              <div className="flex-1 min-h-0">
                <ReactFlowProvider>
                  <div className="relative h-full min-h-0">
                    {/* Left Canvas Nav */}
                    <aside className="wandou-canvas-nav pointer-events-none absolute left-6 top-6 z-30 hidden xl:block">
                      <div className="pointer-events-auto flex flex-col space-y-4 px-2 py-2">
                        {canvasSections.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => focusCanvasSection(item)}
                            className="group flex min-h-9 items-center space-x-4 text-left"
                          >
                            <div className={`h-1.5 w-1.5 rounded-full ${item === highlightedCanvasSection ? 'bg-brand shadow-[0_0_10px_rgba(16,185,129,1)]' : 'bg-slate-600 group-hover:bg-slate-400'} transition-all`} />
                            <span className={`text-[13px] tracking-wide ${item === highlightedCanvasSection ? 'font-medium text-white' : 'text-slate-400 group-hover:text-slate-300'} transition-colors`}>{item}</span>
                          </button>
                        ))}
                      </div>
                    </aside>

                    <div className="absolute inset-0">
                      <ReactFlow
                        nodes={nodes}
                        edges={canvasEdges}
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
                        connectionLineType={ConnectionLineType.Bezier}
                        connectionLineStyle={{ stroke: '#34d399', strokeWidth: 1.8, opacity: 0.85 }}
                        minZoom={0.1}
                        maxZoom={2}
                        defaultViewport={{ x: 20, y: 28, zoom: 0.62 }}
                        fitView={false}
                      >
                        <MiniMap className="hidden xl:block" style={{ backgroundColor: '#1A1A1C', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }} nodeColor="#333" maskColor="rgba(0,0,0,0.5)" />
                      </ReactFlow>
                    </div>
                  </div>
                </ReactFlowProvider>
              </div>
          </div>

          {/* Right Properties Panel */}
          {selectedNode && (
          <div className="wandou-node-config-panel absolute left-4 right-4 top-4 bottom-24 lg:left-auto lg:bottom-4 lg:w-[300px] rounded-2xl border border-white/10 bg-[#121213]/95 backdrop-blur-xl shadow-2xl z-30 flex flex-col">
             <div className="wandou-node-config-header h-10 border-b border-white/5 flex items-center px-4 justify-between bg-[#1A1A1C]">
                <span className="text-[12px] font-bold text-slate-300 flex items-center space-x-1"><Settings2 size={14}/><span>节点配置</span></span>
                <button onClick={() => setSelectedNodeId(null)} className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300">关闭</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-5">
                   <div className="rounded-xl border border-brand/20 bg-brand/10 p-3">
                     <div className="mb-1 text-[11px] font-bold text-brand">当前选中</div>
                     <div className="truncate text-[13px] font-bold text-white">{selectedNodeTitle}</div>
                     <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                       <div className="rounded-lg bg-black/20 p-2">
                         <div className="text-slate-500">类型</div>
                         <div className="mt-1 text-slate-200">{capabilityLabel(selectedNodeType)}</div>
                       </div>
                       <div className="rounded-lg bg-black/20 p-2">
                         <div className="text-slate-500">状态</div>
                         <div className="mt-1 text-slate-200">{statusLabel(String(selectedNode.data?.status || 'idle'))}</div>
                       </div>
                     </div>
                     <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-2 text-[11px] leading-5 text-slate-400">
                       {nodeCapabilityText(selectedNodeType)}
                     </div>
                     {selectedNodeSettingsSummary && (
                       <div className="mt-2 rounded-lg border border-white/10 bg-black/15 p-2 text-[11px] leading-5 text-slate-400">
                         当前参数：{selectedNodeSettingsSummary}
                       </div>
                     )}
                     {selectedNodeError && (
                       <div className="mt-2 max-h-28 overflow-auto rounded-lg border border-red-500/25 bg-red-500/10 p-2 text-[11px] leading-5 text-red-200 [overflow-wrap:anywhere] whitespace-pre-wrap">
                         {selectedNodeError}
                       </div>
                     )}
                   </div>

                 {canEditSelectedScript && (
                   <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                     <h3 className="mb-2 text-xs font-bold text-slate-300">剧本内容</h3>
                     <p className="max-h-24 overflow-auto text-[12px] leading-5 text-slate-400 [overflow-wrap:anywhere] whitespace-pre-wrap">
                       {getString(selectedNodeOutput?.summary, selectedNodeOutput?.content, '当前剧本还没有生成摘要。')}
                     </p>
                     <button
                       onClick={() => openScriptEditor(selectedNode.id)}
                       className="mt-3 flex w-full items-center justify-center rounded-lg border border-brand/40 bg-brand/15 px-3 py-2 text-xs font-bold text-brand hover:bg-brand/20"
                     >
                       编辑剧本
                     </button>
                   </div>
                 )}

                 {selectedNodeType === 'storyboard' && (
                   <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px] leading-5 text-slate-400">
                     <h3 className="mb-2 text-xs font-bold text-slate-300">分镜信息</h3>
                     <div>镜头数：{Array.isArray(selectedNodeOutput?.scenes) ? selectedNodeOutput.scenes.length : 0}</div>
                     <div className="mt-1 max-h-20 overflow-auto [overflow-wrap:anywhere] whitespace-pre-wrap">
                       {getString(selectedNodeOutput?.camera, '暂无运镜说明。')}
                     </div>
                   </div>
                 )}

                 {selectedNodeType === 'character' && (
                   <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px] leading-5 text-slate-400">
                     <h3 className="mb-2 text-xs font-bold text-slate-300">角色资产</h3>
                     <div>角色数：{Array.isArray(selectedNodeOutput?.characters) ? selectedNodeOutput.characters.length : 0}</div>
                     <div className="mt-1">可在节点卡片中查看参考图，并通过下方指令要求重新生成。</div>
                   </div>
                 )}

                 {canTuneSelectedVideo && (
                   <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                     <h3 className="text-xs font-bold text-slate-300">视频参数</h3>
                     <div>
                       <div className="mb-2 text-[11px] font-bold text-slate-500">画面比例</div>
                       <div className="grid grid-cols-3 gap-2">
                         {aspectRatioOptions.map((ratio) => (
                           <button
                             key={ratio}
                             onClick={() => updateSelectedNodeParameters({ aspectRatio: ratio }, `画面比例已保存为 ${ratio}，重跑当前节点会带入该参数。`)}
                             className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
                               (selectedNodeParameters.aspectRatio || generationSettings.aspectRatio) === ratio
                                 ? 'bg-brand/20 border border-brand/50 text-brand'
                                 : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                             }`}
                           >
                             {ratio}
                           </button>
                         ))}
                       </div>
                     </div>
                     <div>
                       <div className="mb-2 text-[11px] font-bold text-slate-500">分辨率</div>
                       <div className="grid grid-cols-2 gap-2">
                         {resolutionOptions.map((resolution) => (
                           <button
                             key={resolution}
                             onClick={() => updateSelectedNodeParameters({ resolution }, `分辨率已保存为 ${resolution.toUpperCase()}，重跑当前节点会带入该参数。`)}
                             className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
                               String(selectedNodeParameters.resolution || generationSettings.resolution).toLowerCase() === resolution
                                 ? 'bg-brand/20 border border-brand/50 text-brand'
                                 : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                             }`}
                           >
                             {resolution.toUpperCase()}
                           </button>
                         ))}
                       </div>
                     </div>
                     <div>
                       <div className="mb-2 text-[11px] font-bold text-slate-500">时长</div>
                       <div className="grid grid-cols-3 gap-2">
                         {durationOptions.map((duration) => (
                           <button
                             key={duration}
                             onClick={() => updateSelectedNodeParameters({ durationSeconds: duration, duration: `${duration}s` }, `视频时长已保存为 ${duration}s，重跑当前节点会带入该参数。`)}
                             className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
                               Number(String(selectedNodeParameters.durationSeconds || selectedNodeParameters.duration || generationSettings.durationSeconds).replace(/\D/g, '')) === duration
                                 ? 'bg-brand/20 border border-brand/50 text-brand'
                                 : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                             }`}
                           >
                             {duration}s
                           </button>
                         ))}
                       </div>
                     </div>
                   </div>
                 )}

                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-2">节点指令</h3>
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

                 {selectedNodeOutput && (
                   <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                     <summary className="cursor-pointer text-xs font-bold text-slate-400">调试输出</summary>
                     <pre className="mt-3 max-h-44 overflow-auto rounded-lg border border-white/10 bg-[#0B0B0C] p-3 text-[10px] leading-4 text-slate-400 [overflow-wrap:anywhere] whitespace-pre-wrap">
                       {JSON.stringify(selectedNodeOutput, null, 2)}
                     </pre>
                   </details>
                 )}
             </div>
          </div>
          )}

          {/* Floater Controls (Inside Canvas) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex items-center space-x-2 z-20">
               <div className="wandou-canvas-toolbar bg-[#1A1A1C] h-10 flex items-center px-1 rounded-xl shadow-xl border border-white/5">
                 <button onClick={handleFocusPrompt} className="p-2 text-slate-400 hover:text-white transition-colors" title="输入对话指令"><MessageSquare size={16} /></button>
                 <button onClick={handleSelectNodeTool} className="p-2 text-slate-400 hover:text-white transition-colors" title="打开节点配置"><MousePointer2 size={16} /></button>
                 <button onClick={handleMagicCanvasTool} className="p-2 text-slate-400 hover:text-white transition-colors" title="整理画布并生成指令草稿"><Wand2 size={16} /></button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button onClick={handleAddCanvasNode} className="p-2 text-slate-400 hover:text-white transition-colors" title="新增剧本节点"><Plus size={16} /></button>
               </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-30 lg:hidden">
              <div className="wandou-mobile-chat-composer flex items-center gap-2 rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(18,18,19,0.96))] px-2 py-2 shadow-2xl backdrop-blur">
                <input ref={mobileFileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleAssetUpload} />
                <button onClick={() => openFilePicker(true)} disabled={!project || isUploadingAsset} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.04] text-slate-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <ImagePlus size={16} />
                </button>
                <textarea
                  ref={mobilePromptInputRef}
                  rows={2}
                  placeholder="输入创作指令..."
                  disabled={!project}
                  className="max-h-28 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-1.5 text-[12px] leading-5 text-slate-200 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
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
      {shareDialogOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121213] p-5 text-slate-200 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold tracking-[0.22em] text-brand">分享回放</div>
                <h2 className="mt-2 text-lg font-bold text-white">确认分享历史对话</h2>
              </div>
              <button
                onClick={() => setShareDialogOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"
                aria-label="关闭分享确认"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              分享后，拿到链接的人无需登录即可查看这个项目的只读历史回放，包括对话过程、运行事件、画布节点和任务记录。
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 text-[11px] font-semibold text-slate-500">公开回放链接</div>
              <div className="break-all text-xs leading-5 text-slate-300">
                {`${window.location.origin}${window.location.pathname}?replayProjectId=${encodeURIComponent(project.id)}`}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShareDialogOpen(false)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                取消
              </button>
              <button
                onClick={handleShareReplay}
                className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.22)] hover:bg-brand/90"
              >
                确认分享并复制
              </button>
            </div>
          </div>
        </div>
      )}
      {(selectedTaskDetail || runDetail) && (
        <div className="fixed inset-y-0 right-0 z-50 w-[380px] border-l border-white/10 bg-[#121213] p-6 text-slate-200 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{selectedTaskDetail ? '任务详情' : '运行详情'}</h2>
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
                <div className="mt-1 font-semibold text-slate-100">{statusLabel(selectedTaskDetail.status)}</div>
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
                  <div className="mt-1 text-slate-300">{capabilityLabel(selectedTaskDetail.type)}</div>
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
                <div className="mt-1 font-semibold text-slate-100">{statusLabel(runDetail.status)}</div>
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
                      <div>{runDetail.monitor.eventCount} 个事件</div>
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
                          <span>{statusLabel(step.status)}</span>
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
