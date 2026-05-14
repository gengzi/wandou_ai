import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Wand2, Trash2, Maximize2, Play, CopyPlus, RefreshCw, Download, Video, Layers, Image as ImageIcon, Music, Clapperboard, CheckCircle2 } from 'lucide-react';

export const ScriptNode = ({ id, data }: any) => {
  const { setNodes } = useReactFlow();
  const title = data?.title || '智能剧本生成';
  const status = data?.status || 'idle';
  const summary = data?.output?.summary || '等待 Agent Run 生成剧本摘要。';
  const style = data?.output?.style;
  
  return (
    <div className="w-[340px] bg-[#111112] rounded-2xl border border-white/10 shadow-2xl overflow-hidden group">
      <div className="bg-[#1A1A1C] px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-purple-500/20 text-purple-400">
            <Wand2 size={14} />
          </div>
          <span className="text-xs font-bold text-slate-300">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${status === 'success' ? 'text-brand border-brand/30 bg-brand/10' : status === 'running' ? 'text-yellow-300 border-yellow-300/20 bg-yellow-300/10' : 'text-slate-500 border-white/10 bg-white/5'}`}>{status}</span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-brand transition-colors" title="引入到对话">
            <CopyPlus size={14} />
          </button>
          <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <h4 className="text-[11px] font-bold text-slate-400 mb-2 flex items-center justify-between">
            <span>剧本摘要</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-brand/20 text-brand rounded">AI Generated</span>
          </h4>
          <p className="text-[13px] text-slate-300 leading-relaxed bg-[#1A1A1C] p-3 rounded-xl border border-white/5">{summary}</p>
          {style && <p className="text-[11px] text-slate-500 mt-2">风格：{style}</p>}
        </div>
        <div>
          <h4 className="text-[11px] font-bold text-slate-400 mb-2">提取角色场景</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1A1C] p-3 rounded-xl border border-white/5 hover:border-brand/40 transition-colors cursor-pointer group/item">
              <div className="text-[13px] font-medium text-slate-200 mb-1 flex items-center justify-between">
                <span>未来宇航少女</span>
                <ImageIcon size={12} className="text-slate-500 group-hover/item:text-brand" />
              </div>
              <div className="text-[11px] text-slate-500 line-clamp-3">外貌：一头柔顺的粉色长发，在失重环境中轻轻飘逸...</div>
            </div>
            <div className="bg-[#1A1A1C] p-3 rounded-xl border border-white/5 hover:border-brand/40 transition-colors cursor-pointer group/item">
              <div className="text-[13px] font-medium text-slate-200 mb-1 flex items-center justify-between">
                <span>机器小猫</span>
                <ImageIcon size={12} className="text-slate-500 group-hover/item:text-brand" />
              </div>
              <div className="text-[11px] text-slate-500 line-clamp-3">一只拥有金属外壳和蓝色电子眼的机器小猫，小巧可爱...</div>
            </div>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-brand border-none" />
    </div>
  );
};

export const CharacterNode = ({ id, data }: any) => {
  const { setNodes } = useReactFlow();
  const title = data?.title || '角色一致性生成 (Character Design)';
  const status = data?.status || 'idle';
  const characters = Array.isArray(data?.output?.characters) ? data.output.characters : [];

  return (
    <div className="w-[420px] bg-[#111112] rounded-2xl border border-white/10 shadow-2xl overflow-hidden cursor-default group hover:border-white/20 transition-colors">
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-brand border-none" />
      <div className="bg-[#1A1A1C] px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-500/20 text-blue-400">
            <ImageIcon size={14} />
          </div>
          <span className="text-xs font-bold text-slate-300">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${status === 'success' ? 'text-brand border-brand/30 bg-brand/10' : status === 'running' ? 'text-yellow-300 border-yellow-300/20 bg-yellow-300/10' : 'text-slate-500 border-white/10 bg-white/5'}`}>{status}</span>
          <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-slate-400">LoRA 模型应用</span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-brand transition-colors" title="引入到对话">
            <CopyPlus size={14} />
          </button>
          <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
                <h4 className="text-[13px] font-bold text-slate-200">角色1: {characters[0]?.name || '未来宇航少女'}</h4>
                <button className="text-[11px] text-brand hover:text-brand/80 flex items-center space-x-1"><RefreshCw size={10} /><span>重新生成</span></button>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 bg-[#1A1A1C] p-2 rounded-lg border border-white/5">Prompt: {characters[0]?.prompt || '外貌：一头柔顺的粉色长发，在失重环境中轻轻飘逸，身着设计精良、线条流畅的白色宇航服，其上点缀着未来科技感的蓝色光带...'}</p>
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map(i => (
                <div key={i} className={`aspect-[3/4] rounded-xl bg-slate-900 border ${i===1?'border-brand shadow-[0_0_10px_rgba(16,185,129,0.2)]':'border-white/5'} overflow-hidden relative group/img cursor-pointer hover:border-brand/50 transition-all`}>
                  <img src={`https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80&auto=format&fit=crop&crop=face&seed=${i}`} className="w-full h-full object-cover transition-transform group-hover/img:scale-105" alt="Pose" />
                  
                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 opacity-0 group-hover/img:opacity-100 flex flex-col justify-between p-1.5 transition-opacity">
                    <div className="flex justify-end">
                      <button className="p-1.5 bg-black/60 backdrop-blur rounded-lg hover:bg-brand text-slate-300 hover:text-white transition-colors" title="高清看图">
                        <Maximize2 size={12} />
                      </button>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button className="w-full py-1.5 bg-brand/90 hover:bg-brand text-white rounded-[6px] text-[10px] font-medium transition-colors flex items-center justify-center space-x-1 shadow-lg">
                        <Video size={10} />
                        <span>生成视频</span>
                      </button>
                      <button className="w-full py-1 bg-white/10 hover:bg-white/20 backdrop-blur text-slate-300 hover:text-white rounded-[6px] text-[10px] transition-colors">
                        设为主角色
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
                <h4 className="text-[13px] font-bold text-slate-200">角色2: {characters[1]?.name || '机器小猫'}</h4>
                <button className="text-[11px] text-brand hover:text-brand/80 flex items-center space-x-1"><RefreshCw size={10} /><span>重新生成</span></button>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 bg-[#1A1A1C] p-2 rounded-lg border border-white/5">Prompt: {characters[1]?.prompt || '一只拥有金属外壳和蓝色电子眼的机器小猫，小巧可爱，但因为故障而显得非常害怕和脆弱。'}</p>
            <div className="grid grid-cols-2 gap-2">
                <div className="aspect-[4/3] rounded-xl bg-slate-900 border border-white/5 overflow-hidden relative group/img cursor-pointer hover:border-brand/50 transition-all">
                  <img src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&auto=format&fit=crop" className="w-full h-full object-cover transition-transform group-hover/img:scale-105" alt="Cat" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 opacity-0 group-hover/img:opacity-100 flex flex-col justify-end p-1.5 transition-opacity">
                      <button className="w-full py-1.5 bg-brand/90 hover:bg-brand text-white rounded-[6px] text-[10px] font-medium transition-colors flex items-center justify-center space-x-1">
                        <Video size={10} />
                        <span>生成视频</span>
                      </button>
                  </div>
                </div>
                <div className="aspect-[4/3] rounded-xl bg-slate-900 border border-brand/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] overflow-hidden relative group/img cursor-pointer hover:border-brand transition-all">
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-brand text-white rounded text-[9px] font-bold z-10">SELECTED</span>
                  <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop" className="w-full h-full object-cover transition-transform group-hover/img:scale-105" alt="Bot" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 opacity-0 group-hover/img:opacity-100 flex flex-col justify-end p-2 transition-opacity">
                      <div className="flex space-x-2">
                        <button className="flex-1 py-1.5 bg-brand/90 hover:bg-brand text-white rounded-[8px] text-[11px] font-medium transition-colors flex items-center justify-center space-x-1">
                          <Video size={12} />
                          <span>生成视频</span>
                        </button>
                        <button className="px-2 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-[8px] text-white transition-colors">
                          <Maximize2 size={12} />
                        </button>
                      </div>
                  </div>
                </div>
            </div>
          </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-brand border-none" />
    </div>
  );
};

export const StoryboardNode = ({ id, data }: any) => {
  const { setNodes } = useReactFlow();
  const title = data?.title || '分镜设计';
  const status = data?.status || 'idle';
  const scenes = Array.isArray(data?.output?.scenes) ? data.output.scenes : [];

  return (
    <div className="w-[360px] bg-[#111112] rounded-2xl border border-white/10 shadow-2xl overflow-hidden group">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-brand border-none" />
      <div className="bg-[#1A1A1C] px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-500/20 text-brand">
            <Clapperboard size={14} />
          </div>
          <span className="text-xs font-bold text-slate-300">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${status === 'success' ? 'text-brand border-brand/30 bg-brand/10' : status === 'running' ? 'text-yellow-300 border-yellow-300/20 bg-yellow-300/10' : 'text-slate-500 border-white/10 bg-white/5'}`}>{status}</span>
        </div>
        <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {(scenes.length ? scenes : [
          { shot: '01', duration: '2s', content: '等待 Agent 生成建立镜头。' },
          { shot: '02', duration: '3s', content: '等待 Agent 生成角色动作。' },
          { shot: '03', duration: '3s', content: '等待 Agent 生成结尾镜头。' },
        ]).map((scene: any) => (
          <div key={scene.shot} className="rounded-xl border border-white/5 bg-[#1A1A1C] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand">Shot {scene.shot}</span>
              <span className="text-[10px] text-slate-500">{scene.duration}</span>
            </div>
            <p className="text-[12px] leading-5 text-slate-300">{scene.content}</p>
          </div>
        ))}
        {data?.output?.camera && <p className="text-[11px] text-slate-500">运镜：{data.output.camera}</p>}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-brand border-none" />
    </div>
  );
};

export const ImagesNode = ({ id, data }: any) => {
  const { setNodes } = useReactFlow();
  const title = data?.title || (data?.imageSrc ? '生成分镜视频' : '场景概念图生成');
  const status = data?.status || 'idle';
  const imageSrc = data?.imageSrc || data?.output?.thumbnailUrl;

  // 如果是视频节点
  if (imageSrc || data?.type === 'video' || title.includes('视频')) {
    return (
      <div className="w-[320px] bg-[#111112] p-3 rounded-2xl border border-white/10 shadow-2xl group relative hover:border-brand/40 transition-all">
        <Handle type="target" position={Position.Left} className="w-2 h-2 bg-brand border-none" />
        
        {/* Node Toolbar on hover */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A1A1C] border border-white/10 p-1.5 rounded-xl shadow-xl z-50">
          <button className="px-2 py-1 flex items-center space-x-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors text-[11px] whitespace-nowrap">
            <RefreshCw size={12} />
            <span>重摇 (Regen)</span>
          </button>
          <div className="w-px h-3 bg-white/10 mx-1" />
          <button className="px-2 py-1 flex items-center space-x-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors text-[11px] whitespace-nowrap">
            <Download size={12} />
            <span>导出高画质</span>
          </button>
          <div className="w-px h-3 bg-white/10 mx-1" />
          <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center space-x-1.5">
            <Video size={14} className="text-brand" />
            <span className="text-xs font-bold text-slate-200">{title}</span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'success' ? 'text-brand bg-brand/10' : status === 'running' ? 'text-yellow-300 bg-yellow-300/10' : 'text-slate-500 bg-white/5'}`}>{status}</span>
        </div>

        <div className="aspect-video w-full rounded-xl bg-slate-900 overflow-hidden relative border border-white/5 cursor-pointer group/video">
           <img src={imageSrc || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop'} className="w-full h-full object-cover" alt="Node media" />
           <div className="absolute inset-0 bg-black/20 group-hover/video:bg-black/50 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-brand/90 backdrop-blur-md flex items-center justify-center transform group-hover/video:scale-110 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-white/10">
                <Play size={22} className="fill-white text-white ml-1" />
              </div>
           </div>
           
           {/* Bottom action tags */}
           <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover/video:opacity-100 transition-opacity">
              <span className="px-2 py-1 bg-black/70 backdrop-blur-md rounded-[6px] text-[10px] text-white font-medium">00:04s · 1080P</span>
              <button className="p-1.5 bg-black/70 backdrop-blur-md rounded-[6px] hover:bg-brand text-white transition-colors tooltip">
                 <Maximize2 size={12} />
              </button>
           </div>
        </div>
        <Handle type="source" position={Position.Right} className="w-2 h-2 bg-brand border-none" />
      </div>
    );
  }

  // legacy mode / image grid mode
  return (
    <div className="w-[340px] bg-[#111112] p-4 rounded-2xl border border-white/10 shadow-2xl group relative hover:border-brand/40 transition-all">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-brand border-none" />
      
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A1A1C] border border-white/10 p-1.5 rounded-xl shadow-xl z-50">
        <button className="px-2 py-1 flex items-center space-x-1 hover:bg-white/10 rounded text-slate-300 hover:text-brand transition-colors text-[11px] whitespace-nowrap">
           <Layers size={12} />
           <span>批量操作</span>
        </button>
        <div className="w-px h-3 bg-white/10 mx-1" />
        <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-1.5">
          <ImageIcon size={14} className="text-blue-400" />
          <span className="text-xs font-bold text-slate-200">{title}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'success' ? 'text-brand bg-brand/10' : status === 'running' ? 'text-yellow-300 bg-yellow-300/10' : 'text-slate-500 bg-white/5'}`}>{status}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className={`aspect-[3/4] rounded-xl bg-slate-900 border ${i===1?'border-brand shadow-[0_0_15px_rgba(16,185,129,0.2)]':'border-white/5 hover:border-white/20'} overflow-hidden relative group/inner cursor-pointer transition-all`}>
            {i === 1 && <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-brand text-white rounded text-[9px] font-bold z-10">Best Match</span>}
            <img src={`https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80&auto=format&fit=crop&crop=face&seed=${i + 10}`} className="w-full h-full object-cover transition-transform duration-500 group-hover/inner:scale-110" alt="Var" />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover/inner:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
              <div className="flex justify-end">
                 <button className="p-1.5 bg-black/50 backdrop-blur rounded-lg hover:bg-brand text-white transition-colors" title="高清大图">
                    <Maximize2 size={12} />
                 </button>
              </div>
              <div className="flex flex-col space-y-1.5">
                 <button className="w-full py-1.5 bg-brand hover:bg-brand/90 text-white rounded-[8px] text-[11px] font-medium transition-colors flex items-center justify-center space-x-1 shadow-lg">
                    <Video size={12} />
                    <span>图生视频 (Animate)</span>
                 </button>
                 <div className="flex space-x-1.5">
                    <button className="flex-1 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-[8px] text-[10px] font-medium transition-colors">变体</button>
                    <button className="flex-1 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-[8px] text-[10px] font-medium transition-colors flex items-center justify-center">
                      <Download size={10} />
                    </button>
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-brand border-none" />
    </div>
  );
};

export const AudioNode = ({ id, data }: any) => {
  const { setNodes } = useReactFlow();
  const title = data?.title || '生成音效配乐';
  const status = data?.status || 'idle';

  return (
    <div className="w-[300px] bg-[#111112] p-4 rounded-2xl border border-white/10 shadow-2xl group relative hover:border-brand/40 transition-all">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-brand border-none" />
      
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-yellow-500/20 text-yellow-400">
            <Music size={14} />
          </div>
          <span className="text-xs font-bold text-slate-200">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'success' ? 'text-brand bg-brand/10' : status === 'running' ? 'text-yellow-300 bg-yellow-300/10' : 'text-slate-500 bg-white/5'}`}>{status}</span>
        </div>
        <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="p-1 hover:bg-white/10 rounded text-slate-400 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="bg-[#1A1A1C] p-3 rounded-xl border border-white/5 space-y-3">
         <p className="text-[11px] text-slate-400">Prompt: {data?.output?.prompt || '悠远的电子合成器音效，带着空灵的宇宙回响，适合太空场景'}</p>
         <div className="h-10 bg-slate-900 border border-white/5 rounded-lg flex items-center px-3 space-x-3 group/audio cursor-pointer hover:border-brand/50 transition-colors">
            <button className="w-6 h-6 bg-brand rounded-full flex items-center justify-center">
              <Play size={10} className="fill-white text-white ml-0.5" />
            </button>
            <div className="flex-1 flex items-center space-x-1">
               {[1,2,3,4,5,6,7,5,3,4,6,8,9,6,4,3,2,1].map((h, i) => (
                 <div key={i} className="w-1 bg-brand/60 rounded-full" style={{ height: `${h * 1.5}px` }} />
               ))}
            </div>
            <span className="text-[9px] text-slate-500 font-mono">00:08</span>
         </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-brand border-none" />
    </div>
  );
};

export const FinalVideoNode = ({ id, data }: any) => {
  const { setNodes } = useReactFlow();
  const title = data?.title || '成片合成';
  const status = data?.status || 'idle';
  const thumbnail = data?.output?.thumbnailUrl || 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop';

  return (
    <div className="w-[340px] bg-[#111112] rounded-2xl border border-brand/30 shadow-[0_0_36px_rgba(16,185,129,0.12)] overflow-hidden group">
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-brand border-none" />
      <div className="bg-[#1A1A1C] px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-brand/20 text-brand">
            <CheckCircle2 size={14} />
          </div>
          <span className="text-xs font-bold text-slate-300">{title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'success' ? 'text-brand bg-brand/10' : 'text-slate-500 bg-white/5'}`}>{status}</span>
        </div>
        <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="p-3">
        <div className="aspect-video overflow-hidden rounded-xl border border-white/5 bg-slate-900 relative">
          <img src={thumbnail} className="h-full w-full object-cover" alt="Final video" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-12 h-12 rounded-full bg-brand/90 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Play size={22} className="fill-white text-white ml-1" />
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-slate-300">{data?.output?.summary || '等待合成结果。'}</p>
      </div>
    </div>
  );
};
