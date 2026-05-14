import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Share2, Play, Plus, BrainCircuit, Wand2, Video, MessageSquare, MousePointer2, Send, Paperclip, CopyPlus, Settings2, RefreshCw } from 'lucide-react';
import { ReactFlow, Background, useNodesState, useEdgesState, addEdge, BackgroundVariant, ReactFlowProvider, Node, Edge, Connection, MiniMap } from '@xyflow/react';
import { ScriptNode, CharacterNode, StoryboardNode, ImagesNode, AudioNode, FinalVideoNode } from './CanvasNodes';
import { CanvasEdgeResponse, CanvasNodeResponse, CanvasResponse, createCanvasEdge, createProject, createRunEventSource, getCanvas, ProjectResponse, SseEvent, startAgentRun, updateCanvasNodePosition } from '../lib/api';

const nodeTypes = {
  script: ScriptNode,
  character: CharacterNode,
  storyboard: StoryboardNode,
  images: ImagesNode,
  video: ImagesNode,
  audio: AudioNode,
  final: FinalVideoNode,
};

const initialNodes: Node[] = [
  {
    id: 'script-1',
    type: 'script',
    position: { x: 80, y: 120 },
    data: {},
  },
  {
    id: 'char-1',
    type: 'character',
    position: { x: 480, y: 120 },
    data: {},
  },
  {
    id: 'img-1',
    type: 'images',
    position: { x: 940, y: 120 },
    data: {},
  },
  {
    id: 'audio-1',
    type: 'audio',
    position: { x: 940, y: 500 },
    data: {},
  }
];

const initialEdges: Edge[] = [
  {
    id: 'e-script-char',
    source: 'script-1',
    target: 'char-1',
    type: 'default',
    animated: true,
    style: { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '4 4' }
  },
  {
    id: 'e-char-img',
    source: 'char-1',
    target: 'img-1',
    type: 'default',
    animated: true,
    style: { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '4 4' }
  },
  {
    id: 'e-script-audio',
    source: 'script-1',
    target: 'audio-1',
    type: 'default',
    animated: true,
    style: { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '4 4' }
  }
];

interface Message {
  id: string;
  sender: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
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

interface WorkspaceViewProps {
  initialPrompt?: string;
}

function toFlowNode(node: CanvasNodeResponse): Node {
  const flowType = node.type === 'video' ? 'video' : node.type;
  return {
    id: node.id,
    type: flowType,
    position: node.position,
    data: {
      ...node.data,
      title: node.title,
      status: node.status,
      output: node.output,
      imageSrc: typeof node.output?.thumbnailUrl === 'string' ? node.output.thumbnailUrl : undefined,
    },
  };
}

function toFlowEdge(edge: CanvasEdgeResponse): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'default',
    animated: true,
    style: { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '4 4' },
  };
}

export default function WorkspaceView({ initialPrompt }: WorkspaceViewProps) {
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
  const [setupError, setSetupError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const autoStartedPromptRef = useRef<string>('');

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const runningTaskCount = tasks.filter(task => task.status === 'running').length;

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
      style: { stroke: '#10B981', strokeWidth: 2, strokeDasharray: '4 4' }
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

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    const output = node.data?.output as Record<string, unknown> | undefined;
    const prompt = typeof output?.prompt === 'string' ? output.prompt : '';
    setNodeInstruction(prompt);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const applyCanvas = useCallback((canvas: CanvasResponse) => {
    setNodes(canvas.nodes.map(toFlowNode));
    setEdges(canvas.edges.map(toFlowEdge));
  }, [setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;

    async function initWorkspace() {
      try {
        const nextProject = await createProject({
          name: 'Wandou Studio 项目',
          description: '前后端联动工作区',
          aspectRatio: '16:9',
        });
        if (cancelled) return;
        setProject(nextProject);
        const canvas = await getCanvas(nextProject.canvasId);
        if (cancelled) return;
        applyCanvas(canvas);
        setMessages([
          {
            id: 'welcome',
            sender: '系统',
            role: 'agent',
            content: '工作区已连接后端。输入创作指令后，Agent Run 会实时更新消息、任务队列和画布节点。',
            timestamp: new Date(),
          },
        ]);
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
  }, [applyCanvas]);

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

  const updateNodeFromEvent = useCallback((nodeId: string, status?: string, output?: Record<string, unknown>) => {
    setNodes((currentNodes) => currentNodes.map((node) => {
      if (node.id !== nodeId) return node;
      const nextOutput = output ? { ...(node.data?.output as Record<string, unknown> | undefined), ...output } : node.data?.output;
      return {
        ...node,
        data: {
          ...node.data,
          status: status || node.data?.status,
          output: nextOutput,
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
    if (event.event === 'message.delta') {
      setIsTyping(true);
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
    }

    if (event.event === 'edge.created' && data.edge) {
      upsertEdge(data.edge);
    }

    if (event.event === 'node.updated') {
      updateNodeFromEvent(data.nodeId, data.status, data.output);
    }

    if (event.event === 'task.created' || event.event === 'task.progress' || event.event === 'task.completed') {
      upsertTask(data.task);
    }

    if (event.event === 'asset.created' && data.asset) {
      const asset = data.asset as AssetItem;
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      updateNodeFromEvent(asset.nodeId, 'success', {
        assetId: asset.id,
        thumbnailUrl: asset.thumbnailUrl,
        url: asset.url,
      });
    }

    if (event.event === 'run.completed' || event.event === 'run.failed') {
      setIsTyping(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
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
      eventSourceRef.current?.close();
      processedEventIdsRef.current = new Set();
      const run = await startAgentRun({
        projectId: project.id,
        conversationId: project.conversationId,
        canvasId: project.canvasId,
        message: cleanMessage,
        agentName: '导演',
        mode: options?.mode,
        nodeId: options?.nodeId,
      });

      const source = createRunEventSource(run.runId);
      eventSourceRef.current = source;
      const eventNames = [
        'run.started',
        'message.delta',
        'message.completed',
        'node.created',
        'node.updated',
        'edge.created',
        'task.created',
        'task.progress',
        'task.completed',
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
  }, [handleRunEvent, project]);

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
        <header className="h-[60px] flex items-center justify-between px-4 xl:px-6 border-b border-white/5 bg-[#121213]">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded bg-brand flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="text-white font-black text-sm italic">W</span>
             </div>
             <h1 className="text-[14px] font-bold text-white tracking-wide truncate w-28 xl:w-40">Wandou Studio</h1>
          </div>
          <div className="flex items-center space-x-2 xl:space-x-3">
             {/* Credits */}
             <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-full cursor-pointer hover:bg-brand/20 transition-colors tooltip" aria-label="算力点数">
                <div className="w-3.5 h-3.5 rounded-full bg-brand flex items-center justify-center">
                  <Wand2 size={8} className="text-white" />
                </div>
                <span className="text-brand text-[12px] font-bold">1,200</span>
                <Plus size={12} className="text-brand/80" />
             </div>
             
             {/* Tasks */}
             <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
               <Video size={18} />
               <span className="absolute top-1 right-1 w-2 h-2 bg-brand rounded-full border border-[#121213]"></span>
             </button>

             {/* Share */}
             <button className="bg-white/5 p-2 xl:px-3 xl:py-1.5 rounded-lg hover:bg-white/10 text-[12px] font-medium flex items-center xl:space-x-1.5 border border-white/10 transition-colors" title="分享">
                <Share2 size={14} className="opacity-80" />
                <span className="hidden xl:inline">分享</span>
             </button>
             <button className="bg-brand p-2 xl:px-3 xl:py-1.5 rounded-lg hover:bg-brand/90 text-[12px] text-white font-medium flex items-center xl:space-x-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-colors" title="导出项目">
                <Play size={14} className="fill-white" />
                <span className="hidden xl:inline">导出项目</span>
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide" ref={scrollRef}>
          {/* Task Queue Card */}
          <div className="bg-[#1A1A1C] border border-brand/20 p-4 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center space-x-2">
                <BrainCircuit size={14} className="text-brand animate-pulse" />
                <span className="text-xs font-bold text-slate-300">后台运行中 ({runningTaskCount})</span>
              </div>
              <span className="text-[10px] text-slate-500">Queue</span>
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-[11px] text-slate-500">暂无后台任务</div>
              ) : tasks.slice(0, 3).map((task) => (
                <div key={task.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2 text-slate-400 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'success' ? 'bg-brand' : 'bg-brand animate-pulse'}`} />
                      <span className="truncate">{task.message}</span>
                    </div>
                    <span className="text-slate-500 font-mono">{task.progress}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#0B0B0C] rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all" style={{ width: `${task.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {setupError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              {setupError}
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
                        <div className="text-[13px] text-slate-300 leading-relaxed">
                          {msg.content}
                        </div>
                      )}
                      
                      {idx === 0 && (
                        <div className="space-y-2">
                           {['生成故事视频', '已生成 1 个视频'].map((step, i) => (
                              <div key={i} className="flex items-center space-x-3 p-3 rounded-xl bg-transparent border border-white/5">
                                <div className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                </div>
                                <span className="text-[13px] text-slate-300">{step}</span>
                              </div>
                           ))}
                        </div>
                      )}

                      {idx === 0 && assets[0] && (
                        <div className="aspect-video w-[180px] rounded-xl bg-slate-900 overflow-hidden relative group border border-white/5 mt-4">
                           <img src={assets[0].thumbnailUrl} className="w-full h-full object-cover opacity-80" alt="Generated Output" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                              <button 
                                onClick={() => {
                                  const newNode = {
                                    id: `video-${Date.now()}`,
                                    type: 'video',
                                    position: { x: 700, y: 300 },
                                    data: { imageSrc: assets[0].thumbnailUrl, title: assets[0].name, status: 'success' }
                                  };
                                  setNodes((nds) => [...nds, newNode]);
                                  setEdges((eds) => [...eds, {
                                    id: `e-char-video-${Date.now()}`,
                                    source: 'char-1',
                                    target: newNode.id,
                                    type: 'default',
                                    animated: true,
                                    style: { stroke: '#10B981', strokeWidth: 2, strokeDasharray: '4 4' }
                                  }]);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-medium flex items-center space-x-1 cursor-pointer hover:bg-brand/80"
                              >
                                <Plus size={12} />
                                <span>添加到画布</span>
                              </button>
                           </div>
                        </div>
                      )}

                      {idx !== 0 && (
                        <div className="text-[13px] text-slate-300 leading-relaxed bg-transparent pt-2">
                           {msg.content}
                        </div>
                      )}

                      {idx === 1 && (
                        <div className="space-y-2 mt-6">
                           <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 text-[13px] hover:bg-white/10 text-slate-200 transition-colors">满意</button>
                           <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 text-[13px] hover:bg-white/10 text-slate-400 transition-colors">差点意思，给我些修改建议</button>
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
            <div className="flex items-center px-4 py-2 rounded-2xl bg-[#1A1A1C] border border-white/5 focus-within:border-white/20 transition-colors group relative">
              <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer mr-1 relative">
                <Paperclip size={16} />
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
              </button>
              <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer mr-2" title="引用画布内容">
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
                     {['总览', '图片/视频', '剧本', '角色', '分镜', '视频'].map((item) => (
                        <div key={item} 
                             className="flex items-center space-x-4 cursor-pointer group">
                           <div className={`w-1.5 h-1.5 rounded-full ${item === '角色' ? 'bg-brand shadow-[0_0_10px_rgba(16,185,129,1)]' : 'bg-slate-600 group-hover:bg-slate-400'} transition-all`} />
                           <span className={`text-[13px] tracking-wide ${item === '角色' ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-300'} transition-colors`}>{item}</span>
                        </div>
                     ))}
                  </div>

                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClick}
                    onNodeDragStop={handleNodeDragStop}
                    onPaneClick={handlePaneClick}
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
                       <button className="py-2 bg-brand/20 border border-brand/50 rounded-lg text-[11px] text-brand font-medium">Sora</button>
                       <button className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">Kling</button>
                    </div>
                 </div>
                 
                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-3">画面比例 Aspect Ratio</h3>
                    <div className="grid grid-cols-3 gap-2">
                       <button className="py-2 bg-brand/20 border border-brand/50 rounded-lg text-[11px] text-brand font-medium">16:9</button>
                       <button className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">9:16</button>
                       <button className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">1:1</button>
                    </div>
                 </div>

                 <div>
                    <h3 className="text-xs font-bold text-slate-400 mb-3">时长 Duration</h3>
                    <div className="grid grid-cols-3 gap-2">
                       <button className="py-2 bg-brand/20 border border-brand/50 rounded-lg text-[11px] text-brand font-medium">4s</button>
                       <button className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">8s</button>
                       <button className="py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:bg-white/10 transition-colors">10s</button>
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
                       <button className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 rounded-lg transition-colors"><RefreshCw size={14} /></button>
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
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><MessageSquare size={16} /></button>
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><MousePointer2 size={16} /></button>
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><Wand2 size={16} /></button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><Plus size={16} /></button>
               </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-30 lg:hidden">
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#121213]/95 px-3 py-2 shadow-2xl backdrop-blur">
                <button className="p-1.5 text-slate-500">
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

            {/* Navigation Menu (Left Floating) */}
            <div className="hidden">
               {['总览', '图片/视频', '剧本', '角色', '分镜', '视频'].map((item, i) => (
                  <div key={item} className={`flex items-center space-x-3 transition-colors cursor-pointer group pointer-events-auto`}>
                    <div className={`w-1 h-1 rounded-full ${i === 3 ? 'bg-brand' : 'bg-slate-700 group-hover:bg-slate-400'}`} />
                    <span className={`text-[11px] font-medium ${i === 3 ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{item}</span>
                  </div>
               ))}
            </div>
          </div>
    </div>
  );
}
