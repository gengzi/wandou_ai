import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  BadgeHelp,
  Bot,
  ChevronRight,
  Clapperboard,
  Film,
  ImagePlus,
  Layers3,
  MessageSquareText,
  Plus,
  Sparkles,
  Video,
  WalletCards,
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { listProjects, ProjectResponse } from '../lib/api';

interface HomeViewProps {
  onNavigate: (prompt?: string, projectId?: string) => void;
}

const quickActions = [
  { label: '故事视频', icon: Clapperboard, active: true },
  { label: '自由画布', icon: Layers3 },
  { label: '角色设定', icon: Bot },
  { label: '分镜生成', icon: Film },
];

const highlights = [
  {
    title: 'Agent Run 编排',
    desc: '导演、剧本、分镜和视频任务会同步到会话、任务队列与画布节点。',
    icon: Bot,
  },
  {
    title: '画布式资产流',
    desc: '每一次生成都会沉淀为可追踪节点，素材、任务和会话保持同一个上下文。',
    icon: Video,
  },
];

export default function HomeView({ onNavigate }: HomeViewProps) {
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  const recentProjects = useMemo(() => {
    return projects.slice(0, 4).map((project) => ({
      id: project.id,
      title: project.name,
      time: new Date(project.createdAt).toLocaleString(),
      status: project.aspectRatio,
    }));
  }, [projects]);

  const submit = () => {
    onNavigate(prompt);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#08090A] text-slate-100 scrollbar-hide">
      <div className="border-b border-brand/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%),linear-gradient(90deg,rgba(16,185,129,0.12),rgba(8,9,10,0.95))] px-8 py-3 text-center text-sm font-semibold text-slate-200">
        <span className="text-brand">Wandou Agent Studio</span>
        <span className="mx-2 text-slate-500">·</span>
        <span>剧本、分镜、视频任务和资产流已接入同一工作台</span>
      </div>

      <header className="mx-auto flex max-w-[1480px] items-center justify-between px-10 py-6">
        <button onClick={() => onNavigate()} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black italic text-white shadow-[0_0_24px_rgba(16,185,129,0.35)]">W</div>
          <div className="text-left">
            <div className="text-lg font-black tracking-tight text-white">Wandou Studio</div>
            <div className="text-[11px] text-slate-500">AI video canvas</div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10">
            简体中文
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
            <BadgeHelp size={16} />
            常见问题
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:bg-brand/90">
            <MessageSquareText size={16} />
            加入创作项目
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
            <WalletCards size={16} className="text-brand" />
            1,200
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">FREE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-10 pb-20">
        <section className="relative flex min-h-[390px] flex-col items-center justify-center pt-8">
          <div className="pointer-events-none absolute inset-x-16 top-12 h-56 rounded-full bg-brand/10 blur-[90px]" />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-[860px]"
          >
            <div className="absolute -top-12 right-16 flex items-center gap-2 rounded-2xl border border-brand/20 bg-[#101312] px-4 py-2 shadow-[0_0_35px_rgba(16,185,129,0.2)]">
              <Bot size={18} className="text-brand" />
              <span className="text-xs font-semibold text-slate-300">导演 Agent 待命</span>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-[#0D0F0E]/95 p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_30px_100px_rgba(0,0,0,0.45)]">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    submit();
                  }
                }}
                className="h-32 w-full resize-none bg-transparent px-1 text-lg leading-8 text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="输入你的短片想法，例如：少女抱着机器猫站在空间站窗前，窗外是星云，生成剧本、角色、分镜和视频任务..."
              />

              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/15">
                    <Plus size={19} />
                  </button>
                  <button className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/15">
                    <ImagePlus size={16} />
                    参考图
                  </button>
                  <button className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/15">
                    <Wand2 size={16} />
                    剧本
                  </button>
                </div>
                <button
                  onClick={submit}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-[0_0_25px_rgba(16,185,129,0.38)] transition-transform hover:scale-105 active:scale-95"
                  aria-label="开始创作"
                >
                  <ArrowUp size={22} />
                </button>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {quickActions.map((item) => (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.label)}
                  className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all ${
                    item.active
                      ? 'border-brand/30 bg-brand/20 text-white shadow-[0_0_30px_rgba(16,185,129,0.22)]'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-brand/30 hover:bg-brand/10'
                  }`}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="text-brand" size={22} />
              <h2 className="text-3xl font-black tracking-tight">最近项目</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => onNavigate()} className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
                + 新建项目
              </button>
              <button className="flex items-center gap-1 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
                查看全部
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {loadingProjects ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-8 text-sm text-slate-400">
              正在从后端加载项目...
            </div>
          ) : recentProjects.length === 0 ? (
            <button
              onClick={() => onNavigate()}
              className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-8 text-left text-sm text-slate-400 transition-colors hover:border-brand/40 hover:bg-brand/10"
            >
              后端暂无项目。创建第一个项目后，它会出现在这里。
            </button>
          ) : (
          <div className="grid grid-cols-4 gap-5">
            {recentProjects.map((project) => (
              <motion.button
                key={project.id}
                whileHover={{ y: -4 }}
                onClick={() => onNavigate(undefined, project.id)}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-left shadow-2xl"
              >
                <div className="relative h-36 overflow-hidden border-b border-white/10 bg-[#121416]">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(148,163,184,0.04))]" />
                  <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-brand">
                    <Clapperboard size={22} />
                  </div>
                  <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-brand backdrop-blur">
                    {project.status}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100">{project.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{project.time}</p>
                </div>
              </motion.button>
            ))}
          </div>
          )}
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="text-brand" size={22} />
            <h2 className="text-3xl font-black tracking-tight">亮点</h2>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {highlights.map((item) => (
              <button key={item.title} onClick={() => onNavigate()} className="group relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-[#111315] p-7 text-left transition-colors hover:border-brand/40">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(15,23,42,0.12))]" />
                <div className="relative flex h-full flex-col justify-end">
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
                    <item.icon size={22} />
                  </div>
                  <h3 className="text-2xl font-black text-white">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
