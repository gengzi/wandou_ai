import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Share2, Play, Plus, BrainCircuit, Wand2, Video, Languages, MessageSquare, ZoomIn, ZoomOut, MousePointer2, Send, Users, Paperclip, CopyPlus } from 'lucide-react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, BackgroundVariant, ReactFlowProvider, Node, Edge, Connection } from '@xyflow/react';
import { ScriptNode, CharacterNode, ImagesNode } from './CanvasNodes';

const nodeTypes = {
  script: ScriptNode,
  character: CharacterNode,
  images: ImagesNode,
};

const initialNodes: Node[] = [
  {
    id: 'script-1',
    type: 'script',
    position: { x: 100, y: 100 },
    data: {},
  },
  {
    id: 'char-1',
    type: 'character',
    position: { x: -50, y: 400 },
    data: {},
  },
  {
    id: 'img-1',
    type: 'images',
    position: { x: 950, y: 200 },
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
  }
];

interface Message {
  id: string;
  sender: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export default function WorkspaceView() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({
      ...params,
      type: 'default',
      animated: true,
      style: { stroke: '#10B981', strokeWidth: 2, strokeDasharray: '4 4' }
    }, eds)),
    [setEdges],
  );

  const [zoom, setZoom] = useState(35);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: '系统',
      role: 'agent',
      content: '重新生成分镜6的视频，使其包含更多远景，少女抱着猫，窗外是浩瀚的宇宙',
      timestamp: new Date()
    },
    {
      id: '2',
      sender: '导演',
      role: 'agent',
      content: '好的，我已经根据您的要求重新生成了分镜6的视频，增加了远景，并突出了少女抱着猫以及窗外浩瀚宇宙的场景。\n请问您对修改后的分镜视频是否满意？',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: '用户',
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputValue, agentName: '导演' })
      });
      
      const data = await response.json();
      
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: '导演',
        role: 'agent',
        content: data.text || "抱歉，我现在遇到了一些问题。",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex bg-bg-dark text-slate-200">
      {/* Interaction Sidebar (Left) */}
      <div className="w-[400px] h-full border-r border-white/5 bg-[#121213] flex flex-col z-20 shadow-2xl relative">
        {/* Top Header of Sidebar */}
        <header className="h-[60px] flex items-center justify-between px-6 border-b border-white/5 bg-[#121213]">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded bg-brand flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="text-white font-black text-sm italic">W</span>
             </div>
             <h1 className="text-[14px] font-bold text-white tracking-wide truncate w-40">Wandou Studio</h1>
          </div>
          <div className="flex items-center space-x-4">
             {/* Credits */}
             <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-full cursor-pointer hover:bg-brand/20 transition-colors tooltip" aria-label="算力点数">
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
             <button className="bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-[12px] font-medium flex items-center space-x-1.5 border border-white/10 transition-colors">
                <Share2 size={14} className="opacity-80" />
                <span>分享</span>
             </button>
             <button className="bg-brand px-3 py-1.5 rounded-lg hover:bg-brand/90 text-[12px] text-white font-medium flex items-center space-x-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-colors">
                <Play size={14} className="fill-white" />
                <span>导出项目</span>
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide" ref={scrollRef}>
          {/* Status Card 1 */}
          <div className="bg-[#1A1A1C] border border-white/5 p-4 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <div className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <span>Update Storyboard</span>
              </div>
            </div>
          </div>

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

                      {idx === 0 && (
                        <div className="aspect-video w-[180px] rounded-xl bg-slate-900 overflow-hidden relative group border border-white/5 mt-4">
                           <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-80" alt="Generated Output" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                              <button 
                                onClick={() => {
                                  const newNode = {
                                    id: `video-${Date.now()}`,
                                    type: 'images',
                                    position: { x: 700, y: 300 },
                                    data: { imageSrc: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop' }
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
                className="flex-1 bg-transparent border-none outline-none text-[13px] text-slate-200 placeholder-slate-500 py-1.5 pr-8"
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
                    disabled={isTyping}
                    className="p-1.5 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <Send size={14} />
                  </button>
                ) : (
                  <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                    <Wand2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
      </div>

          {/* Central Canvas Workspace */}
          <div className="flex-1 relative bg-[#0B0B0C] overflow-hidden">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                fitView
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#555" />
                <Controls showInteractive={false} className="hidden" />
              </ReactFlow>
            </ReactFlowProvider>

            {/* Floater Controls (Bottom Right) */}
            <div className="absolute bottom-6 right-6 flex items-center space-x-2 z-20">
               <div className="bg-[#1A1A1C] h-10 flex items-center px-1 rounded-xl shadow-xl border border-white/5">
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><MessageSquare size={16} /></button>
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><MousePointer2 size={16} /></button>
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><Wand2 size={16} /></button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button className="p-2 text-slate-400 hover:text-white transition-colors"><Plus size={16} /></button>
               </div>
            </div>

            {/* Navigation Menu (Left Floating) */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col space-y-5 z-20 pointer-events-none">
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
