import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BadgeHelp,
  Bot,
  Box,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  FileVideo,
  Film,
  Image as ImageIcon,
  Layers3,
  MessageSquareText,
  Moon,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Shirt,
  Sparkles,
  Sun,
  Video,
  WalletCards,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AssetResponse, createProject, getAuthToken, listAssetsPage, listProjects, ProjectResponse, updateProject, uploadAsset, UserResponse } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

interface HomeViewProps {
  onNavigate: (prompt?: string, projectId?: string) => void;
  currentUser?: UserResponse | null;
}

const withAssetAuthQuery = (url: string) => {
  if (!url || !url.startsWith('/api/')) return url;
  const token = getAuthToken();
  if (!token) return url;
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set('Authorization', `Bearer ${token}`);
  return nextUrl.pathname + nextUrl.search;
};

const previewableAssetUrl = (url?: string) => {
  if (!url) return '';
  if (
    url.startsWith('/api/')
    || url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('data:')
  ) {
    return withAssetAuthQuery(url);
  }
  return '';
};

const mediaPreviewAssets = (assets: AssetResponse[]) => (
  assets
    .filter((asset) => ['image', 'video', 'character', 'scene'].includes(asset.type))
    .filter((asset) => asset.url || asset.thumbnailUrl)
    .slice(0, 4)
);

function ProjectPreviewStrip({ assets, aspectRatio }: { assets: AssetResponse[]; aspectRatio: string }) {
  const [failedAssetIds, setFailedAssetIds] = useState<Record<string, boolean>>({});
  const visibleAssets = assets.filter((asset) => !failedAssetIds[asset.id]);
  const mainAsset = visibleAssets[0];
  const thumbnails = visibleAssets.slice(1, 4);

  const markFailed = (assetId: string) => {
    setFailedAssetIds((current) => ({ ...current, [assetId]: true }));
  };

  if (!mainAsset) {
    return (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(148,163,184,0.04))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(16,185,129,0.22),transparent_26%),linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
        <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-brand">
          <Clapperboard size={22} />
        </div>
        <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-brand backdrop-blur">
          {aspectRatio}
        </div>
      </>
    );
  }

  const mainPreview = previewableAssetUrl(mainAsset.thumbnailUrl || (mainAsset.type === 'image' ? mainAsset.url : ''));
  const mainVideoUrl = mainAsset.type === 'video' ? previewableAssetUrl(mainAsset.url) : '';
  const mainImageUrl = mainPreview || (mainAsset.type !== 'video' ? previewableAssetUrl(mainAsset.url) : '');

  return (
    <>
      <div className="absolute inset-0 bg-black">
        {mainAsset.type === 'video' && mainVideoUrl ? (
          <video
            src={mainVideoUrl}
            poster={mainPreview || undefined}
            preload="metadata"
            muted
            playsInline
            onError={() => markFailed(mainAsset.id)}
            className="h-full w-full object-cover opacity-90 transition-transform duration-500 hover:scale-[1.03]"
          />
        ) : mainImageUrl ? (
          <img
            src={mainImageUrl}
            alt={mainAsset.name}
            loading="lazy"
            onError={() => markFailed(mainAsset.id)}
            className="h-full w-full object-cover opacity-90 transition-transform duration-500 hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(148,163,184,0.06))] text-brand">
            <ImageIcon size={28} />
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.66))]" />
      <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-brand backdrop-blur">
        {aspectRatio}
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            {mainAsset.type === 'video' ? <FileVideo size={14} className="text-brand" /> : <ImageIcon size={14} className="text-brand" />}
            <span>{mainAsset.type === 'video' ? '视频预览' : '图片预览'}</span>
          </div>
          <div className="mt-1 max-w-[220px] truncate text-[11px] text-slate-300">{mainAsset.name}</div>
        </div>
        {mainAsset.type === 'video' ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur">
            <Play size={15} fill="currentColor" />
          </div>
        ) : thumbnails.length > 0 ? (
          <div className="flex shrink-0 -space-x-2">
            {thumbnails.map((asset) => {
              const thumbUrl = previewableAssetUrl(asset.thumbnailUrl || (asset.type === 'image' ? asset.url : ''));
              return (
                <span key={asset.id} className="h-10 w-10 overflow-hidden rounded-lg border border-white/20 bg-black/45 shadow-lg">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={asset.name}
                      loading="lazy"
                      onError={() => markFailed(asset.id)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-brand">
                      {asset.type === 'video' ? <FileVideo size={15} /> : <ImageIcon size={15} />}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function HomeView({ onNavigate, currentUser }: HomeViewProps) {
  const { locale, t, toggleLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [notice, setNotice] = useState('');
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [referenceProjectId, setReferenceProjectId] = useState<string | undefined>();
  const [referencePreviewUrl, setReferencePreviewUrl] = useState('');
  const [referenceAssetName, setReferenceAssetName] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectPreviews, setProjectPreviews] = useState<Record<string, AssetResponse[]>>({});
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
      previews: projectPreviews[project.id] || [],
    }));
  }, [projectPreviews, projects, showAllProjects]);

  useEffect(() => {
    const visibleProjectIds = projects.slice(0, showAllProjects ? projects.length : 4).map((project) => project.id);
    const missingProjectIds = visibleProjectIds.filter((projectId) => !Object.prototype.hasOwnProperty.call(projectPreviews, projectId));
    if (missingProjectIds.length === 0) return;

    let cancelled = false;
    Promise.all(missingProjectIds.map(async (projectId) => {
      try {
        const page = await listAssetsPage({ projectId, page: 0, size: 12, sort: 'desc' });
        return [projectId, mediaPreviewAssets(page.content)] as const;
      } catch (error) {
        console.warn('load project previews failed', projectId, error);
        return [projectId, []] as const;
      }
    })).then((entries) => {
      if (cancelled) return;
      setProjectPreviews((current) => {
        const next = { ...current };
        entries.forEach(([projectId, assets]) => {
          next[projectId] = assets;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [projectPreviews, projects, showAllProjects]);

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
            name: '',
            description: '由首页参考图上传自动创建',
            aspectRatio: '16:9',
            prompt: prompt.trim() || file.name,
          });
      if (!project) {
        throw new Error('项目不存在，请重新选择参考图。');
      }
      if (!referenceProjectId) {
        setReferenceProjectId(project.id);
        setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      }
      const uploadedAsset = await uploadAsset({
        projectId: project.id,
        canvasId: project.canvasId,
        type: 'image',
        name: file.name,
        file,
      });
      setProjectPreviews((current) => ({
        ...current,
        [project.id]: mediaPreviewAssets([uploadedAsset, ...(current[project.id] || [])]),
      }));
      setNotice('参考图已上传到项目素材库，开始创作时会带入这个项目上下文。');
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? `参考图上传失败：${error.message}` : '参考图上传失败，请稍后重试。');
    } finally {
      setUploadingReference(false);
    }
  };

  const beginEditProject = (project: { id: string; title: string }) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.title);
  };

  const saveProjectName = async () => {
    if (!editingProjectId) return;
    const nextName = editingProjectName.trim();
    if (!nextName) {
      setNotice('项目标题不能为空。');
      return;
    }
    try {
      const project = await updateProject(editingProjectId, { name: nextName });
      setProjects((current) => current.map((item) => item.id === project.id ? project : item));
      setEditingProjectId(null);
      setNotice('项目标题已更新。');
    } catch (error) {
      setNotice(error instanceof Error ? `标题更新失败：${error.message}` : '标题更新失败。');
    }
  };

  const quickActions = [
    { label: t('home.quick.story'), icon: Clapperboard, active: true },
    { label: t('home.quick.canvas'), icon: Layers3 },
    { label: t('home.quick.character'), icon: Bot },
    { label: t('home.quick.storyboard'), icon: Film },
  ];

  const assetGenerationActions = [
    {
      title: '创建新角色',
      description: '生成角色设定、三视图、表情和动作姿态，沉淀为可复用资产。',
      icon: Sparkles,
      prompt: '创建一个可复用角色资产：先提出 3 个角色方向供我选择，再生成角色设定、三视图描述、表情、动作姿态和后续视频复用说明。',
    },
    {
      title: '创建新场景',
      description: '生成环境概念、道具、空间风格和分镜可用视觉参考。',
      icon: ImageIcon,
      prompt: '创建一个可复用场景资产：先确认故事用途和空间风格，再生成场景设定、环境概念、关键道具、镜头氛围和后续分镜复用说明。',
    },
    {
      title: '生成衍生品',
      description: '基于角色生成短袖印花、贴纸、海报和徽章等商品视觉。',
      icon: Shirt,
      prompt: '基于已有或新建角色生成衍生品方案：先确认角色，再生成短袖印花、贴纸、海报、徽章的视觉方向、提示词和生产资产清单。',
    },
    {
      title: '生成3D模型',
      description: '基于角色生成手办或角色模型方案，输出多视角和材质要求。',
      icon: Box,
      prompt: '基于角色生成 3D 模型资产方案：先确认角色形象，再生成手办或角色模型的建模说明、多视角参考、材质设定和可导出 GLB/OBJ/STL 的需求清单。',
    },
  ];

  const startAssetGeneration = (nextPrompt: string) => {
    setAssetMenuOpen(false);
    onNavigate(nextPrompt);
  };

  const highlights = [
    { title: t('home.highlight.agent.title'), desc: t('home.highlight.agent.desc'), icon: Bot },
    { title: t('home.highlight.assets.title'), desc: t('home.highlight.assets.desc'), icon: Video },
  ];

  return (
    <div className={`h-full overflow-y-auto scrollbar-hide ${isLight ? 'bg-[#F7FBF9] text-slate-900' : 'bg-[#08090A] text-slate-100'}`}>
      <div className={`wandou-sheen border-b px-8 py-3 text-center text-sm font-semibold ${
        isLight
          ? 'border-emerald-100 bg-[linear-gradient(90deg,rgba(236,253,245,0.94),rgba(255,255,255,0.96),rgba(209,250,229,0.82))] text-slate-700'
          : 'border-brand/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%),linear-gradient(90deg,rgba(16,185,129,0.12),rgba(8,9,10,0.95))] text-slate-200'
      }`}>
        <span className="text-brand">{t('home.bannerTitle')}</span>
        <span className="mx-2 text-slate-500">·</span>
        <span>{t('home.bannerDesc')}</span>
      </div>

      <header className="mx-auto flex max-w-[1480px] items-center justify-between px-10 py-6">
        <button onClick={() => onNavigate()} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black italic text-white shadow-[0_0_24px_rgba(16,185,129,0.35)]">W</div>
          <div className="text-left">
            <div className={`text-lg font-black tracking-tight ${isLight ? 'text-slate-950' : 'text-white'}`}>{t('home.product')}</div>
            {t('home.subtitle') && <div className="text-[11px] text-slate-500">{t('home.subtitle')}</div>}
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              isLight ? 'border border-emerald-100 bg-white/70 text-slate-600 shadow-sm hover:bg-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
            title={theme === 'dark' ? '切换白天模式' : '切换黑夜模式'}
            aria-label={theme === 'dark' ? '切换白天模式' : '切换黑夜模式'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={() => {
              toggleLocale();
              setNotice(locale === 'zh-CN' ? '界面已切换为英文。' : '界面已切换为简体中文。');
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              isLight ? 'border border-emerald-100 bg-white/70 text-slate-700 shadow-sm hover:bg-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {t('language.current')}
          </button>
          <button
            onClick={() => setNotice(t('home.faqNotice'))}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              isLight ? 'border border-emerald-100 bg-white/70 text-slate-800 shadow-sm hover:bg-white' : 'bg-white/5 text-slate-200 hover:bg-white/10'
            }`}
          >
            <BadgeHelp size={16} />
            {t('home.faq')}
          </button>
          <div
            className="relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setAssetMenuOpen(false);
              }
            }}
          >
            <button
              onClick={() => setAssetMenuOpen((open) => !open)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                isLight ? 'border border-emerald-100 bg-white/70 text-slate-800 shadow-sm hover:bg-white' : 'bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
              aria-expanded={assetMenuOpen}
              aria-haspopup="menu"
            >
              <Sparkles size={16} className="text-brand" />
              生成资产
              <ChevronDown size={14} className={`text-slate-500 transition-transform ${assetMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {assetMenuOpen && (
              <div className={`absolute right-0 top-full z-40 mt-2 w-[340px] overflow-hidden rounded-2xl border p-2 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${
                isLight ? 'border-emerald-100 bg-white/95 text-slate-900 backdrop-blur' : 'border-white/10 bg-[#121213]/95 text-slate-100 backdrop-blur'
              }`}>
                <div className="px-2 pb-2 pt-1">
                  <div className="text-[11px] font-bold text-brand">智能体生成</div>
                  <div className={`mt-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                    角色、场景、衍生品和 3D 模型由工作区流程生成。
                  </div>
                </div>
                {assetGenerationActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.title}
                      onClick={() => startAssetGeneration(action.prompt)}
                      className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                        isLight ? 'hover:bg-emerald-50' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-brand ${
                        isLight ? 'border-emerald-100 bg-emerald-50' : 'border-white/10 bg-white/5'
                      }`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[12px] font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{action.title}</span>
                        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-slate-500">{action.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={() => setNotice(t('home.joinNotice'))}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:bg-brand/90"
          >
            <MessageSquareText size={16} />
            {t('home.join')}
          </button>
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
            isLight ? 'border border-emerald-100 bg-white/70 text-slate-800 shadow-sm' : 'bg-white/10 text-white'
          }`}>
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
        <section className={`relative flex min-h-[390px] flex-col items-center justify-center pt-8 ${
          isLight ? 'overflow-hidden rounded-[42px] bg-[radial-gradient(circle_at_50%_12%,rgba(187,247,208,0.55),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.78),rgba(240,253,244,0.42),rgba(255,255,255,0))]' : ''
        }`}>
          <div className={`pointer-events-none absolute inset-x-16 top-12 h-56 rounded-full blur-[90px] ${isLight ? 'bg-emerald-200/45' : 'bg-brand/10'}`} />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-[860px]"
          >
            <div className={`wandou-soft-pulse absolute -top-12 right-16 flex items-center gap-2 rounded-2xl border px-4 py-2 ${
              isLight ? 'border-emerald-100 bg-white/80 text-slate-700 shadow-[0_18px_55px_rgba(16,185,129,0.12)] backdrop-blur' : 'border-brand/20 bg-[#101312] shadow-[0_0_35px_rgba(16,185,129,0.2)]'
            }`}>
              <Bot size={18} className="text-brand" />
              <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{t('home.agentReady')}</span>
            </div>

            <div className={`wandou-sheen flex min-h-[132px] items-stretch gap-4 rounded-[34px] border px-5 py-4 backdrop-blur ${
              isLight
                ? 'border-emerald-100 bg-white/72 shadow-[0_24px_70px_rgba(15,118,110,0.14),inset_0_1px_0_rgba(255,255,255,0.92)]'
                : 'border-brand/35 bg-[radial-gradient(circle_at_34%_0%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(18,20,19,0.95))] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_90px_rgba(0,0,0,0.42)]'
            }`}>
              <input ref={referenceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
              <button
                onClick={openReferencePicker}
                disabled={uploadingReference}
                className={`group relative flex w-[124px] shrink-0 items-center justify-center gap-3 rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-all hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-70 ${
                  isLight ? 'border-emerald-100 bg-emerald-50/75 text-slate-700 hover:bg-white' : 'border-white/10 bg-white/[0.045] hover:bg-brand/10'
                }`}
                aria-label={t('home.addAttachment')}
              >
                <span className={`relative h-[54px] w-[54px] rotate-[-5deg] overflow-hidden rounded-2xl border border-dashed transition-transform group-hover:rotate-[-2deg] ${
                  isLight ? 'border-emerald-300/70 bg-white/70' : 'border-white/28 bg-[#F7FAF9]/[0.04]'
                }`}>
                  {referencePreviewUrl ? (
                    <img src={referencePreviewUrl} alt={referenceAssetName} className="h-full w-full object-cover opacity-90" />
                  ) : (
                    <span className={`flex h-full flex-col items-center justify-center ${isLight ? 'text-emerald-600 group-hover:text-emerald-700' : 'text-slate-400 group-hover:text-white'}`}>
                      <Plus size={17} />
                    </span>
                  )}
                </span>
                <span className={`flex items-center gap-1.5 text-sm font-black ${isLight ? 'text-slate-700 group-hover:text-slate-950' : 'text-slate-300 group-hover:text-white'}`}>
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
                className={`min-h-[100px] min-w-0 flex-1 resize-none bg-transparent py-2 text-xl leading-8 outline-none ${
                  isLight ? 'text-slate-900 placeholder:text-slate-500' : 'text-slate-100 placeholder:text-slate-500'
                }`}
                placeholder={t('home.promptPlaceholder')}
              />

              <button
                onClick={() => setNotice(t('home.highlight.agent.desc'))}
                className={`flex h-14 w-14 shrink-0 self-center items-center justify-center rounded-2xl transition-colors ${
                  isLight ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
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
              <div className={`flex min-w-0 items-center rounded-2xl border p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] ${
                isLight ? 'border-emerald-100 bg-white/70' : 'border-white/10 bg-[#08090A]/45'
              }`}>
                <button
                  onClick={() => setNotice(t('home.highlight.agent.desc'))}
                  className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${
                    isLight ? 'bg-slate-900 text-slate-50 shadow-[0_12px_28px_rgba(15,23,42,0.14)]' : 'bg-white text-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.24)]'
                  }`}
                >
                  <Bot size={16} />
                  {t('home.agentMode')}
                </button>
                <button
                  onClick={() => setNotice(t('home.attachmentNotice'))}
                  className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
                    isLight ? 'text-slate-500 hover:bg-emerald-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
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
                  className={`wandou-float-card flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all ${
                    item.active
                      ? isLight
                        ? 'border-emerald-200 bg-white/80 text-emerald-700 shadow-[0_16px_36px_rgba(16,185,129,0.12)]'
                        : 'border-brand/30 bg-brand/20 text-white shadow-[0_0_30px_rgba(16,185,129,0.22)]'
                      : isLight
                        ? 'border-slate-200 bg-white/60 text-slate-600 hover:border-emerald-200 hover:bg-white'
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
              <motion.div
                key={project.id}
                whileHover={{ y: -4 }}
                className="wandou-hover-mask overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-left shadow-2xl"
              >
                <button onClick={() => onNavigate(undefined, project.id)} className="block w-full text-left">
                  <div className="relative h-36 overflow-hidden border-b border-white/10 bg-[#121416]">
                    <ProjectPreviewStrip assets={project.previews} aspectRatio={project.status} />
                  </div>
                </button>
                <div className="p-5">
                  {editingProjectId === project.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveProjectName();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        value={editingProjectName}
                        onChange={(event) => setEditingProjectName(event.target.value)}
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-brand/60"
                      />
                      <button type="submit" className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white">保存</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onNavigate(undefined, project.id)} className="min-w-0 flex-1 text-left">
                        <h3 className="truncate text-lg font-bold text-slate-100">{project.title}</h3>
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          beginEditProject(project);
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-brand"
                        aria-label="编辑项目标题"
                        title="编辑项目标题"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-sm text-slate-500">{project.time}</p>
                </div>
              </motion.div>
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
              <button key={item.title} onClick={() => onNavigate()} className="wandou-hover-mask group relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-[#111315] p-7 text-left transition-colors hover:border-brand/40">
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
