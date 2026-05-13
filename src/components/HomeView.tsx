import React from 'react';
import { Search, Sparkles, ChevronRight, Plus, Users, Wallet, HelpCircle, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  onNavigate: () => void;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide pb-20">
      {/* Top Banner Mockup */}
      <div className="bg-gradient-to-r from-brand/20 via-brand/10 to-transparent p-2 text-center text-[10px] text-white flex items-center justify-center space-x-2">
        <Sparkles size={12} className="text-brand" />
        <span>Seedance2.0 最低至 $0.1 元/秒！充值优惠活动倒计时！</span>
        <button className="bg-brand px-2 py-0.5 rounded-full text-[8px] font-bold">去看看</button>
      </div>

      {/* Header */}
      <header className="px-10 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <span className="text-white font-black text-lg">Oii</span>
          </div>
          <span className="text-xl font-bold tracking-tight">OiiOii</span>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4 text-xs text-slate-400 font-medium">
            <span className="hover:text-white cursor-pointer">简体中文</span>
            <span className="hover:text-white cursor-pointer">常见问题</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center space-x-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-white font-bold">300</span>
              <span className="text-slate-500">FREE</span>
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-brand/40 overflow-hidden">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" alt="Avatar" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Hero Input */}
      <section className="flex-1 flex flex-col items-center justify-center pt-20 px-6">
        <div className="w-full max-w-3xl relative">
          <div className="absolute -top-12 right-10">
            <div className="relative">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-xl">🔥</div>
              <div className="absolute -bottom-2 -left-4 bg-white text-black text-[8px] px-2 py-0.5 rounded-full font-bold shadow-lg">New!</div>
            </div>
          </div>

          <div className="glass rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <textarea
              className="w-full bg-transparent border-none outline-none text-lg text-slate-200 placeholder-slate-600 resize-none h-32"
              placeholder="拖拽/粘贴 🏞️ 图片到这里，来试试【角色】、【风格】参考"
            ></textarea>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white">
                  <Plus size={20} />
                </button>
                <button className="px-4 py-1.5 rounded-full bg-white/5 text-slate-300 text-xs font-medium border border-white/5 flex items-center space-x-2">
                   <Gamepad2 size={14} />
                   <span>剧本</span>
                </button>
              </div>
              <button className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white shadow-lg shadow-brand/40 hover:scale-105 active:scale-95 transition-all">
                <Plus size={24} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {['Seedance 2.0故事动画', '自由画布', '剧情故事短片', '角色设计'].map((tag, i) => (
              <button 
                key={tag}
                onClick={onNavigate}
                className="px-4 py-2 rounded-full border border-white/5 bg-white/5 hover:bg-brand/10 hover:border-brand/40 text-xs text-slate-400 hover:text-brand transition-all flex items-center space-x-1"
              >
                <Sparkles size={12} />
                <span>{tag}</span>
                {i === 1 && <span className="text-[8px] bg-white/10 px-1 rounded ml-1">多模型</span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <div className="px-10 mt-20 space-y-12">
        {/* Recent Projects */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Sparkles className="text-brand" size={18} />
              <h2 className="text-xl font-bold">最近项目</h2>
            </div>
            <div className="flex space-x-4">
              <button className="text-xs text-slate-400 px-3 py-1 bg-white/5 rounded-full">+ 新建项目</button>
              <button className="text-xs text-slate-400 flex items-center space-x-1">
                <span>查看全部</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4">
            {[
              { title: '衍生品设计', time: '2026-05-12 13:59', img: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&auto=format&fit=crop' },
              { title: '生成一个小马的视频', time: '2026-05-12 13:39', img: 'https://images.unsplash.com/photo-1614850523296-e8c1d4704a96?w=400&auto=format&fit=crop' },
              { title: '自由画布', time: '2026-05-12 13:38', img: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&auto=format&fit=crop' },
              { title: '场景设计', time: '2026-05-12 13:35', img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&auto=format&fit=crop' },
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -5 }}
                className="w-72 shrink-0 glass rounded-3xl overflow-hidden cursor-pointer"
              >
                <div className="h-40 relative">
                  <img src={item.img} className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border border-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-[10px] font-black opacity-30">OiiOii</span>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-[10px] text-slate-500 mt-1">{item.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Highlights */}
        <section className="pb-20">
          <div className="flex items-center space-x-2 mb-6">
            <Sparkles className="text-brand" size={18} />
            <h2 className="text-xl font-bold">亮点</h2>
          </div>
          <div className="grid grid-cols-2 gap-6">
             <div className="h-64 rounded-3xl bg-white/5 border border-white/5 relative overflow-hidden group">
                <img src="https://images.unsplash.com/photo-1634157703432-3205030621aa?w=1000&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform" />
             </div>
             <div className="h-64 rounded-3xl bg-white/5 border border-white/5 relative overflow-hidden group">
                <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform" />
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
