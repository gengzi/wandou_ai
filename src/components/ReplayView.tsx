import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Film, MessageSquareText, Play, Share2, Sparkles } from 'lucide-react';
import { getPublicReplay, ProjectReplayResponse, SseEvent } from '../lib/api';

interface ReplayViewProps {
  projectId: string;
}

type ReplayItem = {
  id: string;
  time: string;
  title: string;
  body: string;
  tone: 'user' | 'agent' | 'event';
};

function eventBody(event: SseEvent) {
  const data = event.data as Record<string, unknown>;
  const content = typeof data?.content === 'string' ? data.content : '';
  const message = typeof data?.message === 'string' ? data.message : '';
  const title = typeof data?.title === 'string' ? data.title : '';
  return content || message || title || event.event;
}

export default function ReplayView({ projectId }: ReplayViewProps) {
  const [replay, setReplay] = useState<ProjectReplayResponse | null>(null);
  const [error, setError] = useState('');
  const [replayStarted, setReplayStarted] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayCursor, setReplayCursor] = useState(0);

  useEffect(() => {
    setReplayStarted(false);
    setReplayPlaying(false);
    setReplayCursor(0);
    getPublicReplay(projectId)
      .then(setReplay)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '回放加载失败'));
  }, [projectId]);

  const timeline = useMemo<ReplayItem[]>(() => {
    if (!replay) return [];
    const messages = replay.conversation.messages.map((message) => ({
      id: message.id,
      time: message.createdAt,
      title: message.role === 'user' ? '用户提问' : message.sender || '智能体回复',
      body: message.content,
      tone: message.role === 'user' ? 'user' as const : 'agent' as const,
    }));
    const events = replay.runs.flatMap((run) => run.events.map((event) => ({
      id: event.id,
      time: event.createdAt,
      title: run.agentName || event.event,
      body: eventBody(event),
      tone: 'event' as const,
    })));
    return [...messages, ...events].sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
  }, [replay]);

  useEffect(() => {
    if (!replayPlaying) return undefined;
    if (replayCursor >= timeline.length) {
      setReplayPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setReplayCursor((current) => Math.min(timeline.length, current + 1));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [replayCursor, replayPlaying, timeline.length]);

  const visibleTimeline = replayStarted ? timeline.slice(0, replayCursor) : timeline;
  const startReplay = () => {
    setReplayStarted(true);
    setReplayCursor(0);
    setReplayPlaying(true);
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#08090A] px-6 text-slate-200">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-100">{error}</div>
      </div>
    );
  }

  if (!replay) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#08090A] text-slate-400">
        正在加载历史回放...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090A] text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(16,185,129,0.16),transparent_34%),rgba(255,255,255,0.04)] p-6 shadow-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.22em] text-brand">
            <Play size={14} className="fill-brand" />
            历史对话回放
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">{replay.project.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                这是分享人创作流程的只读回放，包含历史对话、运行事件、画布节点和任务状态。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <button
                type="button"
                onClick={startReplay}
                disabled={timeline.length === 0 || replayPlaying}
                className="flex h-9 items-center gap-2 rounded-xl bg-brand px-4 font-bold text-white shadow-[0_0_22px_rgba(16,185,129,0.24)] transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={14} className="fill-white" />
                {replayPlaying ? '回放中' : replayStarted ? '重新播放' : '播放回放'}
              </button>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                {replayStarted ? `${visibleTimeline.length}/${timeline.length}` : timeline.length} 条时间线
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{replay.canvas.nodes.length} 个节点</span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <main className="space-y-4">
            {replayStarted && visibleTimeline.length === 0 && (
              <div className="rounded-2xl border border-brand/20 bg-brand/10 p-6 text-sm text-brand">
                正在从第一条记录开始回放...
              </div>
            )}
            {visibleTimeline.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 ${
                  item.tone === 'user'
                    ? 'border-brand/25 bg-brand/10'
                    : item.tone === 'agent'
                      ? 'border-white/10 bg-white/[0.045]'
                      : 'border-yellow-400/20 bg-yellow-400/10'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-2 font-bold text-slate-300">
                    <MessageSquareText size={14} />
                    {item.title}
                  </span>
                  <time>{new Date(item.time).toLocaleString()}</time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{item.body}</p>
              </article>
            ))}
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Sparkles size={15} className="text-brand" />
                画布节点
              </h2>
              <div className="space-y-2">
                {replay.canvas.nodes.map((node) => (
                  <div key={node.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span>{node.title}</span>
                      <span className="text-[10px] text-brand">{node.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{node.type}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Clock3 size={15} className="text-brand" />
                任务
              </h2>
              <div className="space-y-2">
                {replay.tasks.length === 0 && <div className="text-xs text-slate-500">暂无任务记录</div>}
                {replay.tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{task.type}</span>
                      <span className="text-brand">{task.progress}%</span>
                    </div>
                    <div className="mt-1 text-slate-500">{task.message}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Film size={15} className="text-brand" />
                运行记录
              </h2>
              <div className="space-y-2">
                {replay.runs.map((run) => (
                  <div key={run.runId} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-200">
                      <CheckCircle2 size={13} className="text-brand" />
                      {run.agentName}
                    </div>
                    <div className="mt-1 text-slate-500">{run.status} · {run.events.length} 个事件</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <footer className="flex items-center justify-center gap-2 pb-6 text-xs text-slate-600">
          <Share2 size={13} />
          公开只读回放，不需要登录。
        </footer>
      </div>
    </div>
  );
}
