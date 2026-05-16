import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BadgeHelp,
  Bot,
  ChevronRight,
  Clapperboard,
  Film,
  Layers3,
  MessageSquareText,
  Paperclip,
  Plus,
  Sparkles,
  Video,
  WalletCards,
} from 'lucide-react';
import { motion } from 'motion/react';
import { createProject, listProjects, ProjectResponse, uploadAsset, UserResponse } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface HomeViewProps {
  onNavigate: (prompt?: string, projectId?: string) => void;
  currentUser?: UserResponse | null;
}

export default function HomeView({ onNavigate, currentUser }: HomeViewProps) {
  const { locale, t, toggleLocale } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [notice, setNotice] = useState('');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [referenceProjectId, setReferenceProjectId] = useState<string | undefined>();
  const [referencePreviewUrl, setReferencePreviewUrl] = useState('');
  const [referenceAssetName, setReferenceAssetName] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    return () => {
      if (referencePreviewUrl) {
        URL.revokeObjectURL(referencePreviewUrl);
      }
    };
  }, [referencePreviewUrl]);

  const recentProjects = useMemo(() => {
    return projects.slice(0, showAllProjects ? projects.length : 4).map((project) => ({
      id: project.id,
      title: project.name,
      time: new Date(project.createdAt).toLocaleString(),
      status: project.aspectRatio,
    }));
  }, [projects, showAllProjects]);

  const submit = () => {
    onNavigate(prompt, referenceProjectId);
  };

  const openReferencePicker = () => {
    if (uploadingReference) return;
    referenceInputRef.current?.click();
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('请上传图片格式的参考图。');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setReferencePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return previewUrl;
    });
    setReferenceAssetName(file.name);
    setUploadingReference(true);
    setNotice('正在上传参考图...');
    try {
      const project = referenceProjectId
        ? projects.find((item) => item.id === referenceProjectId)
        : await createProject({
            name: prompt.trim() ? `参考图项目-${prompt.trim().slice(0, 12)}` : '参考图项目',
            description: '由首页参考图上传自动创建',
            aspectRatio: '16:9',
          });
      if (!project) {
        throw new Error('项目不存在，请重新选择参考图。');
      }
      if (!referenceProjectId) {
        setReferenceProjectId(project.id);
        setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      }
      await uploadAsset({
        projectId: project.id,
        canvasId: project.canvasId,
        type: 'image',
        name: file.name,
        file,
      });
      setNotice('参考图已上传到项目素材库，开始创作时会带入这个项目上下文。');
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? `参考图上传失败：${error.message}` : '参考图上传失败，请稍后重试。');
    } finally {
      setUploadingReference(false);
    }
  };

  const quickActions = [
    { label: t('home.quick.story'), icon: Clapperboard, active: true },
    { label: t('home.quick.canvas'), icon: Layers3 },
    { label: t('home.quick.character'), icon: Bot },
    { label: t('home.quick.storyboard'), icon: Film },
  ];

  const highlights = [
    { title: t('home.highlight.agent.title'), desc: t('home.highlight.agent.desc'), icon: Bot },
    { title: t('home.highlight.assets.title'), desc: t('home.highlight.assets.desc'), icon: Video },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#08090A] text-slate-100 scrollbar-hide">
      <div className="border-b border-brand/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%),linear-gradient(90deg,rgba(16,185,129,0.12),rgba(8,9,10,0.95))] px-8 py-3 text-center text-sm font-semibold text-slate-200">
        <span className="text-brand">{t('home.bannerTitle')}</span>
        <span className="mx-2 text-slate-500">·</span>
        <span>{t('home.bannerDesc')}</span>
      </div>

      <header className="mx-auto flex max-w-[1480px] items-center justify-between px-10 py-6">
        <button onClick={() => onNavigate()} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black italic text-white shadow-[0_0_24px_rgba(16,185,129,0.35)]">W</div>
          <div className="text-left">
            <div className="text-lg font-black tracking-tight text-white">{t('home.product')}</div>
            {t('home.subtitle') && <div className="text-[11px] text-slate-500">{t('home.subtitle')}</div>}
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              toggleLocale();
              setNotice(locale === 'zh-CN' ? '界面已切换为英文。' : '界面已切换为简体中文。');
            }}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
          >
            {t('language.current')}
          </button>
          <button
            onClick={() => setNotice(t('home.faqNotice'))}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <BadgeHelp size={16} />
            {t('home.faq')}
          </button>
          <button
            onClick={() => setNotice(t('home.joinNotice'))}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:bg-brand/90"
          >
            <MessageSquareText size={16} />
            {t('home.join')}
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
            <WalletCards size={16} className="text-brand" />
            {currentUser?.remainingCredits ?? 0}
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">{t('badge.free')}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-10 pb-20">
        {notice && (
          <div className="mx-auto mt-2 max-w-[860px] rounded-xl border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-brand">
            <div className="flex items-center justify-between gap-4">
              <span>{notice}</span>
              <button onClick={() => setNotice('')} className="text-xs font-semibold text-slate-300 hover:text-white">{t('home.close')}</button>
            </div>
          </div>
        )}
        <section className="relative flex min-h-[390px] flex-col items-center justify-center pt-8">
          <div className="pointer-events-none absolute inset-x-16 top-12 h-56 rounded-full bg-brand/10 blur-[90px]" />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-[860px]"
          >
            <div className="absolute -top-12 right-16 flex items-center gap-2 rounded-2xl border border-brand/20 bg-[#101312] px-4 py-2 shadow-[0_0_35px_rgba(16,185,129,0.2)]">
              <Bot size={18} className="text-brand" />
              <span className="text-xs font-semibold text-slate-300">{t('home.agentReady')}</span>
            </div>

            <div className="flex min-h-[132px] items-stretch gap-4 rounded-[34px] border border-brand/35 bg-[radial-gradient(circle_at_34%_0%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(18,20,19,0.95))] px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur">
              <input ref={referenceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
              <button
                onClick={openReferencePicker}
                disabled={uploadingReference}
                className="group relative flex w-[124px] shrink-0 items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:border-brand/40 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-70"
                aria-label={t('home.addAttachment')}
              >
                <span className="relative h-[54px] w-[54px] rotate-[-5deg] overflow-hidden rounded-2xl border border-dashed border-white/28 bg-[#F7FAF9]/[0.04] transition-transform group-hover:rotate-[-2deg]">
                  {referencePreviewUrl ? (
                    <img src={referencePreviewUrl} alt={referenceAssetName} className="h-full w-full object-cover opacity-90" />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center text-slate-400 group-hover:text-white">
                      <Plus size={17} />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-black text-slate-300 group-hover:text-white">
                  <Paperclip size={15} />
                  {uploadingReference ? '上传中' : '附件'}
                </span>
              </button>

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    submit();
                  }
                }}
                className="min-h-[100px] min-w-0 flex-1 resize-none bg-transparent py-2 text-xl leading-8 text-slate-100 outline-none placeholder:text-slate-500"
                placeholder={t('home.promptPlaceholder')}
              />

              <button
                onClick={() => setNotice(t('home.highlight.agent.desc'))}
                className="flex h-14 w-14 shrink-0 self-center items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={t('home.agentMode')}
              >
                <Sparkles size={25} />
              </button>

              <button
                onClick={submit}
                className="flex h-14 w-14 shrink-0 self-center items-center justify-center rounded-full bg-brand text-white shadow-[0_0_25px_rgba(16,185,129,0.38)] transition-transform hover:scale-105 active:scale-95"
                aria-label={t('home.start')}
              >
                <ArrowUp size={24} />
              </button>
            </div>

            <div className="mt-5 flex justify-center">
              <div className="flex min-w-0 items-center rounded-2xl border border-white/10 bg-[#08090A]/45 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <button
                  onClick={() => setNotice(t('home.highlight.agent.desc'))}
                  className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.24)]"
                >
                  <Bot size={16} />
                  {t('home.agentMode')}
                </button>
                <button
                  onClick={() => setNotice(t('home.attachmentNotice'))}
                  className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Video size={16} />
                  {t('home.video')}
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
              <h2 className="text-3xl font-black tracking-tight">{t('home.recentProjects')}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => onNavigate()} className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
                + {t('home.newProject')}
              </button>
              <button
                onClick={() => setShowAllProjects((value) => !value)}
                className="flex items-center gap-1 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
              >
                {showAllProjects ? t('home.collapse') : t('home.showAll')}
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {loadingProjects ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-8 text-sm text-slate-400">
              {t('home.loadingProjects')}
            </div>
          ) : recentProjects.length === 0 ? (
            <button
              onClick={() => onNavigate()}
              className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-8 text-left text-sm text-slate-400 transition-colors hover:border-brand/40 hover:bg-brand/10"
            >
              {t('home.emptyProjects')}
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
            <h2 className="text-3xl font-black tracking-tight">{t('home.highlights')}</h2>
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
