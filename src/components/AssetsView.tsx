import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Clock3,
  FileAudio,
  FileText,
  FileVideo,
  Filter,
  Folder,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  Printer,
  Search,
  Shirt,
  SortAsc,
  SortDesc,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  AssetPageResponse,
  AssetResponse,
  createAsset,
  createDerivative,
  deleteAsset,
  getAsset,
  getAuthToken,
  listAssets,
  listAssetsPage,
  listProjectsPage,
  ProjectResponse,
  updateAsset,
  uploadAsset,
} from '../lib/api';
import ModelPreview, { canPreviewModel } from './ModelPreview';

const PROJECT_FOLDER_PAGE_SIZE = 8;

const assetTabs = [
  { id: 'all', label: '全部' },
  { id: 'character', label: '角色' },
  { id: 'scene', label: '场景' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
];

const derivativeAssetTabs = [
  { id: 'derivative', label: '衍生品' },
  { id: 'model', label: '3D模型' },
  { id: 'print', label: '打印文件' },
];

const typeLabels: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  character: '角色',
  scene: '场景',
  derivative: '衍生品',
  model: '3D模型',
  print: '打印文件',
  file: '文件',
  asset: '素材',
};

const typeLabel = (type: string) => typeLabels[type] || type || '素材';

const purposeLabels: Record<string, string> = {
  script_source: '剧本来源',
  reference_image: '参考图',
  character_reference: '角色参考',
  derivative_design: '衍生设计',
  derivative_mockup: '商品预览',
  model_preview: '3D预览',
  print_package: '生产包',
  library_asset: '普通素材',
};

const purposeLabel = (purpose?: string) => purposeLabels[purpose || 'library_asset'] || purpose || '普通素材';

const parseStatusLabel = (status?: string) => {
  if (status === 'parsed') return '已解析';
  if (status === 'failed') return '解析失败';
  if (status === 'pending') return '等待解析';
  if (status === 'not_required') return '无需解析';
  return status || '无需解析';
};

type DerivativeKind = 'tshirt_print' | 'sticker_set' | 'model_preview';

const derivativeKindLabels: Record<DerivativeKind, string> = {
  tshirt_print: '短袖印花',
  sticker_set: '贴纸套装',
  model_preview: '3D预览',
};

const assetTypeFromFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (['.txt', '.md', '.pdf', '.docx'].some((extension) => lowerName.endsWith(extension))) {
    return 'file';
  }
  if (lowerName.endsWith('.3mf') || lowerName.endsWith('.gcode') || lowerName.endsWith('.zip')) {
    return 'print';
  }
  if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf') || lowerName.endsWith('.obj') || lowerName.endsWith('.fbx') || lowerName.endsWith('.stl')) {
    return 'model';
  }
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'asset';
};

const assetPurposeFromFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (['.glb', '.gltf', '.obj', '.fbx', '.stl'].some((extension) => lowerName.endsWith(extension))) return 'model_preview';
  if (['.3mf', '.gcode', '.zip'].some((extension) => lowerName.endsWith(extension))) return 'print_package';
  if (file.type.startsWith('image/')) return 'reference_image';
  if (file.type.startsWith('text/') || ['.txt', '.md', '.pdf', '.docx'].some((extension) => lowerName.endsWith(extension))) {
    return 'script_source';
  }
  return 'library_asset';
};

const folderPalettes = [
  { tab: '#5ac98e', back: 'rgba(16, 185, 129, 0.12)', front: 'rgba(16, 185, 129, 0.18)', lip: 'rgba(16, 185, 129, 0.24)', glow: 'rgba(16, 185, 129, 0.20)', text: '#d1fae5' },
  { tab: '#60a5fa', back: 'rgba(96, 165, 250, 0.12)', front: 'rgba(96, 165, 250, 0.18)', lip: 'rgba(96, 165, 250, 0.24)', glow: 'rgba(96, 165, 250, 0.18)', text: '#dbeafe' },
  { tab: '#a78bfa', back: 'rgba(167, 139, 250, 0.12)', front: 'rgba(167, 139, 250, 0.18)', lip: 'rgba(167, 139, 250, 0.24)', glow: 'rgba(167, 139, 250, 0.18)', text: '#ede9fe' },
  { tab: '#38bdf8', back: 'rgba(56, 189, 248, 0.12)', front: 'rgba(56, 189, 248, 0.18)', lip: 'rgba(56, 189, 248, 0.24)', glow: 'rgba(56, 189, 248, 0.16)', text: '#e0f2fe' },
];

const withAssetAuthQuery = (url: string) => {
  if (!url || !url.startsWith('/api/')) return url;
  const token = getAuthToken();
  if (!token) return url;
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set('Authorization', `Bearer ${token}`);
  return nextUrl.pathname + nextUrl.search;
};

const isPreviewableUrl = (url: string) => (
  url.startsWith('/api/')
  || url.startsWith('http://')
  || url.startsWith('https://')
  || url.startsWith('data:')
);

const assetIcon = (type: string, size = 24) => {
  switch (type) {
    case 'folder': return <Folder className="text-blue-400" size={size} />;
    case 'video': return <FileVideo className="text-brand" size={size} />;
    case 'image': return <ImageIcon className="text-purple-400" size={size} />;
    case 'audio': return <FileAudio className="text-yellow-400" size={size} />;
    case 'character': return <Sparkles className="text-pink-400" size={size} />;
    case 'scene': return <ImageIcon className="text-cyan-400" size={size} />;
    case 'derivative': return <Shirt className="text-lime-300" size={size} />;
    case 'model': return <Box className="text-orange-300" size={size} />;
    case 'print': return <Printer className="text-emerald-300" size={size} />;
    default: return <FileText className="text-slate-400" size={size} />;
  }
};

function AssetThumbnail({ asset }: { asset: AssetResponse }) {
  const [failed, setFailed] = useState(false);
  const rawThumbnail = asset.thumbnailUrl || (asset.type === 'image' ? asset.url : '');
  const thumbnailUrl = rawThumbnail && isPreviewableUrl(rawThumbnail) ? withAssetAuthQuery(rawThumbnail) : '';
  const videoUrl = asset.type === 'video' && asset.url && isPreviewableUrl(asset.url) ? withAssetAuthQuery(asset.url) : '';
  const canRender = !failed && (thumbnailUrl || videoUrl);

  return (
    <div className="relative h-12 w-[76px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#171719] shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
      {canRender ? (
        asset.type === 'video' ? (
          <video
            src={videoUrl}
            poster={thumbnailUrl || undefined}
            preload="metadata"
            muted
            playsInline
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={thumbnailUrl}
            alt={asset.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.03]">
          {assetIcon(asset.type, 22)}
        </div>
      )}
      {asset.type === 'video' && (
        <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
          <FileVideo size={12} />
        </div>
      )}
    </div>
  );
}

interface ProjectFolderCardProps {
  title: string;
  count: number;
  active: boolean;
  palette: typeof folderPalettes[number];
  previews: string[];
  onClick: () => void;
}

const ProjectFolderCard: React.FC<ProjectFolderCardProps> = ({
  title,
  count,
  active,
  palette,
  previews,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`group flex w-[180px] shrink-0 flex-col items-center text-center transition-all duration-300 ${active ? 'scale-[1.02]' : 'hover:-translate-y-1'}`}
    >
      <div className="relative h-[202px] w-[180px]">
        <div
          className="absolute left-[30px] top-[44px] h-[96px] w-[120px] rounded-[14px] border backdrop-blur-xl"
          style={{
            borderColor: palette.tab,
            background: palette.back,
            boxShadow: `0 16px 44px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.10)`,
          }}
        />
        <div
          className="absolute left-[70px] top-[36px] h-[24px] w-[64px] rounded-t-[14px] border border-b-0 backdrop-blur-xl"
          style={{ borderColor: palette.tab, background: palette.back }}
        />
        <div className="absolute left-[42px] top-[60px] h-[82px] w-[96px] rounded-[12px] bg-black/30 shadow-[0_10px_22px_rgba(0,0,0,0.22)]" />
        <div className="absolute left-[54px] top-[70px] h-[82px] w-[96px] rounded-[12px] bg-white/[0.06] shadow-[0_10px_26px_rgba(0,0,0,0.18)]" />
        {previews.slice(0, 3).length > 0 && (
          <div className="absolute left-[42px] top-[56px] h-[86px] w-[96px]">
            {previews.slice(0, 3).map((preview, index) => (
              <div
                key={`${title}-${preview}-${index}`}
                className={`wandou-folder-preview absolute h-[86px] w-[86px] overflow-hidden rounded-[8px] border border-white/10 bg-black/30 shadow-[-2px_3px_8px_rgba(0,0,0,0.28)] ${
                  index === 0 ? 'left-0 top-0 rotate-[-7deg]' : index === 1 ? 'left-[32px] top-[8px] rotate-[5deg]' : 'left-[16px] top-[18px]'
                }`}
              >
              <img
                src={withAssetAuthQuery(preview)}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                className="h-full w-full object-cover"
              />
              </div>
            ))}
          </div>
        )}
        <div
          className={`absolute left-[14px] top-[104px] h-[70px] w-[152px] overflow-hidden rounded-[18px] border border-white/48 backdrop-blur-md transition-all duration-300 ${active ? 'ring-2 ring-slate-950/10' : ''}`}
          style={{ background: palette.front, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 24px 44px ${palette.glow}` }}
        >
          <div className="absolute inset-x-0 top-0 h-[24px]" style={{ background: palette.lip }} />
          <div className="absolute inset-x-0 bottom-5 text-center text-[18px] font-black tracking-[-0.01em] drop-shadow-sm" style={{ color: palette.text }}>Wandou</div>
          <div className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold tracking-[0.18em] text-white/70">素材库</div>
        </div>
      </div>
      <div className="-mt-3 flex min-w-0 items-center justify-center gap-1.5">
        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">默认</span>
        <span className="min-w-0 max-w-[118px] truncate text-[13px] font-semibold text-slate-100">{title}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">{count}个素材</div>
    </button>
  );
};

function NewProjectFolderCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-[180px] shrink-0 flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative h-[202px] w-[180px]">
        <div className="absolute left-[24px] top-[48px] h-[96px] w-[126px] rounded-[18px] bg-white/10" />
        <div className="absolute left-[76px] top-[39px] h-[24px] w-[64px] rounded-t-[13px] bg-white/15" />
        <div className="absolute left-[12px] top-[102px] h-[72px] w-[154px] rounded-[18px] bg-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.22)]" />
        <div className="absolute left-[30px] top-[74px] flex h-[90px] w-[120px] flex-col items-center justify-center rounded-[16px] bg-[#171719] text-slate-400">
          <Plus size={28} strokeWidth={1.8} />
          <div className="mt-3 text-xs font-semibold leading-5">
            <div>新建或上传</div>
            <div>项目素材</div>
          </div>
        </div>
      </div>
      <div className="-mt-3 text-[13px] font-medium text-slate-400">新建项目素材</div>
    </button>
  );
}

export default function AssetsView() {
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [projectFolderPage, setProjectFolderPage] = useState(0);
  const [projectFolderTotal, setProjectFolderTotal] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [hasMoreProjects, setHasMoreProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeType, setActiveType] = useState('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [assetPage, setAssetPage] = useState<AssetPageResponse>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    page: 0,
    size: 10,
  });
  const [loadingPage, setLoadingPage] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDerivativeForm, setShowDerivativeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetResponse | null>(null);
  const [derivativeSource, setDerivativeSource] = useState<AssetResponse | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const foldersRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    projectId: '',
    canvasId: '',
    nodeId: '',
    type: 'image',
    name: '',
    url: '',
    thumbnailUrl: '',
    purpose: 'auto',
  });
  const [derivativeForm, setDerivativeForm] = useState({
    kind: 'tshirt_print' as DerivativeKind,
    prompt: '',
    size: '30cm x 40cm',
    technique: 'DTF/DTG 印花',
  });

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const projectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach((asset) => counts.set(asset.projectId || 'unassigned', (counts.get(asset.projectId || 'unassigned') || 0) + 1));
    return counts;
  }, [assets]);

  const activeProject = selectedProjectId === 'all' || selectedProjectId === 'unassigned'
    ? null
    : projectById.get(selectedProjectId) || null;

  const assetsByProject = useMemo(() => {
    const grouped = new Map<string, AssetResponse[]>();
    assets.forEach((asset) => {
      const key = asset.projectId || 'unassigned';
      const projectAssets = grouped.get(key) || [];
      projectAssets.push(asset);
      grouped.set(key, projectAssets);
    });
    return grouped;
  }, [assets]);

  const loadProjectFolders = useCallback((pageToLoad: number, replace = false) => {
    setLoadingProjects(true);
    return listProjectsPage(pageToLoad, PROJECT_FOLDER_PAGE_SIZE)
      .then((nextPage) => {
        setProjectFolderPage(nextPage.page);
        setProjectFolderTotal(nextPage.totalElements);
        setHasMoreProjects(nextPage.page + 1 < nextPage.totalPages);
        setProjects((current) => {
          const merged = replace ? nextPage.content : [...current, ...nextPage.content];
          return Array.from(new Map(merged.map((project) => [project.id, project])).values());
        });
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '项目文件夹加载失败'))
      .finally(() => setLoadingProjects(false));
  }, []);

  const refresh = () => {
    setProjectFolderPage(0);
    setProjectFolderTotal(0);
    setHasMoreProjects(true);
    Promise.all([loadProjectFolders(0, true), listAssets()])
      .then(([, nextAssets]) => {
        setAssets(nextAssets);
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '素材加载失败'));
  };

  const handleProjectFolderScroll = () => {
    const container = foldersRef.current;
    if (!container || loadingProjects || !hasMoreProjects) return;
    if (container.scrollLeft < 24) return;
    const distanceToEnd = container.scrollWidth - container.scrollLeft - container.clientWidth;
    if (distanceToEnd < 360) {
      void loadProjectFolders(projectFolderPage + 1);
    }
  };

  const refreshPage = (pageOverride = page, projectIdOverride = selectedProjectId) => {
    setLoadingPage(true);
    const projectId = projectIdOverride === 'all'
      ? undefined
      : projectIdOverride === 'unassigned'
        ? '__unassigned__'
        : projectIdOverride;
    listAssetsPage({
      projectId,
      type: activeType,
      keyword: query.trim(),
      page: pageOverride,
      size: pageSize,
      sort: sortDirection,
    })
      .then(setAssetPage)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '分页素材加载失败'))
      .finally(() => setLoadingPage(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    refreshPage();
  }, [selectedProjectId, activeType, query, page, pageSize, sortDirection]);

  useEffect(() => {
    setPage(0);
  }, [selectedProjectId, activeType, query, pageSize, sortDirection]);

  const filteredAssets = assetPage.content;
  const totalPages = Math.max(1, assetPage.totalPages || 1);
  const currentPage = Math.min(assetPage.page, totalPages - 1);
  const pageStart = assetPage.totalElements === 0 ? 0 : currentPage * assetPage.size + 1;
  const pageEnd = Math.min(assetPage.totalElements, currentPage * assetPage.size + filteredAssets.length);

  const openCreateForm = () => {
    const project = activeProject || projects[0] || null;
    setForm({
      projectId: project?.id || '',
      canvasId: project?.canvasId || '',
      nodeId: '',
      type: 'image',
      name: '',
      url: '',
      thumbnailUrl: '',
      purpose: 'auto',
    });
    setEditingAssetId(null);
    setShowCreateForm(true);
  };

  const openEditAssetForm = (asset: AssetResponse) => {
    setForm({
      projectId: asset.projectId || '',
      canvasId: asset.canvasId || '',
      nodeId: asset.nodeId || '',
      type: asset.type || 'image',
      name: asset.name || '',
      url: asset.url || '',
      thumbnailUrl: asset.thumbnailUrl || '',
      purpose: asset.purpose || 'library_asset',
    });
    setEditingAssetId(asset.id);
    setShowCreateForm(true);
  };

  const openDerivativeForm = (kind: DerivativeKind) => {
    if (!selectedAsset) return;
    setDerivativeSource(selectedAsset);
    setDerivativeForm({
      kind,
      prompt: '',
      size: kind === 'sticker_set' ? 'A5 贴纸排版' : kind === 'model_preview' ? '按上传模型单位' : '30cm x 40cm',
      technique: kind === 'sticker_set' ? '高清不干胶/模切' : kind === 'model_preview' ? 'GLB/OBJ/STL 预览' : 'DTF/DTG 印花',
    });
    setShowDerivativeForm(true);
  };

  const openModelUploadForm = (asset: AssetResponse) => {
    setForm({
      projectId: asset.projectId || activeProject?.id || projects[0]?.id || '',
      canvasId: asset.canvasId || activeProject?.canvasId || projects[0]?.canvasId || '',
      nodeId: asset.nodeId || '',
      type: 'model',
      name: asset.name.replace(/待上传$/, '').trim(),
      url: '',
      thumbnailUrl: asset.thumbnailUrl || '',
      purpose: 'model_preview',
    });
    setEditingAssetId(null);
    setShowCreateForm(true);
  };

  const handleProjectChange = (projectId: string) => {
    const project = projectById.get(projectId);
    setForm({
      ...form,
      projectId,
      canvasId: project?.canvasId || '',
    });
  };

  const handleCreateAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.projectId.trim()) {
      setError('请先选择素材所属项目。');
      return;
    }
    if (!form.name.trim() || !form.type.trim() || !form.url.trim()) {
      setError('请填写素材名称、类型和 URL。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        projectId: form.projectId.trim(),
        canvasId: form.canvasId.trim() || projectById.get(form.projectId.trim())?.canvasId,
        nodeId: form.nodeId.trim() || undefined,
        type: form.type.trim(),
        name: form.name.trim(),
        url: form.url.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
        purpose: form.purpose === 'auto' ? undefined : form.purpose,
      };
      const asset = editingAssetId
        ? await updateAsset(editingAssetId, payload)
        : await createAsset(payload);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setSelectedProjectId(asset.projectId || form.projectId);
      setPage(0);
      refreshPage(0, asset.projectId || form.projectId);
      setShowCreateForm(false);
      setEditingAssetId(null);
      setSelectedAsset(asset);
      setNotice(editingAssetId ? '素材信息已更新。' : '素材已登记到项目资产库。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '素材登记失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDerivative = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!derivativeSource) {
      setError('请先选择角色素材。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createDerivative({
        sourceAssetId: derivativeSource.id,
        kind: derivativeForm.kind,
        prompt: derivativeForm.prompt.trim() || undefined,
        settings: {
          size: derivativeForm.size,
          technique: derivativeForm.technique,
        },
      });
      const createdAssets = [result.asset, result.mockupAsset, result.printAsset].filter(Boolean) as AssetResponse[];
      setAssets((current) => [
        ...createdAssets,
        ...current.filter((item) => !createdAssets.some((asset) => asset.id === item.id)),
      ]);
      const nextType = result.kind === 'model_preview' ? 'model' : 'derivative';
      setActiveType(nextType);
      setSelectedProjectId(result.asset.projectId || derivativeSource.projectId || selectedProjectId);
      setPage(0);
      refreshPage(0, result.asset.projectId || derivativeSource.projectId || selectedProjectId);
      setSelectedAsset(result.asset);
      setShowDerivativeForm(false);
      setDerivativeSource(null);
      setNotice(result.kind === 'model_preview'
        ? '3D预览资产已创建，请上传 GLB/OBJ/STL 模型文件。'
        : `${derivativeKindLabels[result.kind]}已生成，生产包已写入素材库。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '衍生品生成失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (asset: AssetResponse) => {
    setSaving(true);
    setError(null);
    try {
      await deleteAsset(asset.id);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setSelectedAsset(null);
      setPage(0);
      refreshPage(0, selectedProjectId);
      setNotice('素材已删除。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '素材删除失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!form.projectId.trim()) {
      setError('请先选择素材所属项目，再上传文件。');
      return;
    }
    const project = projectById.get(form.projectId.trim());
    const type = assetTypeFromFile(file);
    const purpose = form.purpose === 'auto' ? assetPurposeFromFile(file) : form.purpose || assetPurposeFromFile(file);
    setSaving(true);
    setError(null);
    try {
      const asset = await uploadAsset({
        projectId: form.projectId.trim(),
        canvasId: form.canvasId.trim() || project?.canvasId,
        nodeId: form.nodeId.trim() || undefined,
        type,
        name: form.name.trim() || file.name,
        purpose,
        file,
      });
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setSelectedProjectId(asset.projectId || form.projectId);
      setPage(0);
      refreshPage(0, asset.projectId || form.projectId);
      setShowCreateForm(false);
      setNotice(`${file.name} 已上传到项目素材库。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '文件上传失败');
    } finally {
      setSaving(false);
    }
  };

  const openAsset = async (assetId: string) => {
    setError(null);
    try {
      setSelectedAsset(await getAsset(assetId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '素材详情加载失败');
    }
  };

  const getIcon = (type: string) => {
    return assetIcon(type);
  };

  const projectLabel = (projectId: string) => projectById.get(projectId)?.name || (projectId ? `项目 ${projectId}` : '未归档');

  const previewsFor = (projectId: string) => {
    return (assetsByProject.get(projectId) || [])
      .filter((asset) => asset.thumbnailUrl || asset.url)
      .map((asset) => asset.thumbnailUrl || asset.url)
      .slice(0, 2);
  };

  const selectedAssetUrl = selectedAsset ? withAssetAuthQuery(selectedAsset.url) : '';
  const selectedAssetThumbnailUrl = selectedAsset ? withAssetAuthQuery(selectedAsset.thumbnailUrl || selectedAsset.url) : '';
  const selectedAssetCanDerive = Boolean(selectedAsset && (
    selectedAsset.type === 'character'
    || selectedAsset.purpose === 'character_reference'
    || selectedAsset.purpose === 'reference_image'
  ));
  const selectedAssetCanPreviewModel = Boolean(selectedAsset?.type === 'model' && canPreviewModel(selectedAssetUrl));

  return (
    <div className="h-full overflow-y-auto bg-bg-dark text-slate-300">
      <main className="flex min-h-full min-w-0 flex-col p-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-brand">项目素材</div>
            <h1 className="mt-1 truncate text-xl font-bold text-white">素材管理</h1>
            <p className="mt-1 text-xs text-slate-500">项目文件夹、媒体资源和生成资产统一归档</p>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => foldersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex items-center space-x-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              <Folder size={16} />
              <span>项目文件夹</span>
            </button>
            <button
              onClick={openCreateForm}
              className="flex items-center space-x-2 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand/90"
            >
              <Upload size={16} />
              <span>上传素材</span>
            </button>
          </div>
        </header>

        <section className="mb-8 overflow-hidden bg-bg-dark px-2 py-3">
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-white">项目文件夹</h2>
            <span className="text-xs text-slate-500">
              已加载 {projects.length}{projectFolderTotal ? ` / ${projectFolderTotal}` : ''} 个项目，横向滚动加载更多
            </span>
          </div>
          <div
            ref={foldersRef}
            onScroll={handleProjectFolderScroll}
            className="flex items-start gap-8 overflow-x-auto pb-6"
          >
            <NewProjectFolderCard onClick={openCreateForm} />

            <ProjectFolderCard
              title="全部项目"
              count={assets.length}
              active={selectedProjectId === 'all'}
              palette={folderPalettes[1]}
              previews={assets.filter((asset) => asset.thumbnailUrl || asset.url).map((asset) => asset.thumbnailUrl || asset.url).slice(0, 2)}
              onClick={() => setSelectedProjectId('all')}
            />

            {projects.map((project, index) => (
              <ProjectFolderCard
                key={project.id}
                title={project.name}
                count={projectCounts.get(project.id) || 0}
                active={selectedProjectId === project.id}
                palette={folderPalettes[index % folderPalettes.length]}
                previews={previewsFor(project.id)}
                onClick={() => setSelectedProjectId(project.id)}
              />
            ))}

            {(projectCounts.get('unassigned') || 0) > 0 && (
              <ProjectFolderCard
                title="未归档"
                count={projectCounts.get('unassigned') || 0}
                active={selectedProjectId === 'unassigned'}
                palette={folderPalettes[3]}
                previews={previewsFor('unassigned')}
                onClick={() => setSelectedProjectId('unassigned')}
              />
            )}

            {loadingProjects && (
              <div className="flex h-[252px] w-[180px] shrink-0 flex-col items-center justify-center text-center text-xs text-slate-500">
                <div className="mb-3 h-12 w-12 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                加载项目中...
              </div>
            )}

            {!loadingProjects && hasMoreProjects && (
              <button
                type="button"
                onClick={() => loadProjectFolders(projectFolderPage + 1)}
                className="flex h-[252px] w-[180px] shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs font-semibold text-slate-500 transition-colors hover:border-brand/35 hover:bg-brand/5 hover:text-brand"
              >
                加载更多项目
              </button>
            )}
          </div>
        </section>

        <section className="mb-8 border-y border-white/10 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">角色衍生资产</h2>
              <div className="mt-1 text-xs text-slate-500">衍生品、3D 模型和打印文件</div>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
              {derivativeAssetTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveType(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeType === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mb-4 min-w-0">
          <h2 className="truncate text-lg font-bold text-white">
            {selectedProjectId === 'all' ? '全部项目素材' : selectedProjectId === 'unassigned' ? '未归档素材' : projectLabel(selectedProjectId)}
          </h2>
          <div className="mt-1 text-xs text-slate-500">{assetPage.totalElements} 个素材</div>
        </div>

        <div className="wandou-assets-toolbar sticky top-0 z-20 mb-6 flex items-center justify-between gap-4 border-y border-white/10 bg-bg-dark/95 py-3 backdrop-blur">
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
            {assetTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveType(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeType === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setViewMode((mode) => mode === 'timeline' ? 'table' : 'timeline')} className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
              viewMode === 'timeline'
                ? 'border-brand/40 bg-brand/15 text-brand'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}>
              <Clock3 size={16} />
              {viewMode === 'timeline' ? '列表视图' : '时间轴'}
            </button>
            <button
              onClick={() => setSortDirection((direction) => direction === 'desc' ? 'asc' : 'desc')}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {sortDirection === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
              {sortDirection === 'desc' ? '新到旧' : '旧到新'}
            </button>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand transition-colors" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} type="text" placeholder="搜索当前项目素材..." className="wandou-assets-input h-8 w-64 rounded-lg border border-white/10 bg-[#1A1A1C] py-1.5 pl-9 pr-4 text-xs text-slate-200 outline-none transition-all placeholder:text-slate-500 focus:border-brand/50" />
            </div>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="wandou-assets-input h-8 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand/50"
            >
              <option value={10}>10 / 页</option>
              <option value={20}>20 / 页</option>
              <option value={50}>50 / 页</option>
            </select>
            <button onClick={() => setNotice('高级筛选会和项目标签、节点来源一起接入；当前支持项目、类型和搜索。')} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-brand/25 bg-brand/10 px-4 py-3 text-xs text-brand">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-xs font-semibold text-brand hover:text-emerald-700">关闭</button>
          </div>
        )}

        {viewMode === 'timeline' ? (
          <div className="wandou-assets-table flex-1 rounded-2xl border border-white/10 bg-[#111112] p-5 shadow-2xl">
            {error && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
            {loadingPage ? (
              <div className="py-16 text-center text-sm text-slate-500">正在加载素材...</div>
            ) : filteredAssets.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:left-5 before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-white/10">
                {filteredAssets.map((asset) => {
                  const preview = withAssetAuthQuery(asset.thumbnailUrl || asset.url);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => openAsset(asset.id)}
                      className="relative grid w-full grid-cols-[40px_96px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-white/5 bg-white/[0.025] p-3 text-left transition-colors hover:border-brand/30 hover:bg-white/[0.05]"
                    >
                      <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171719]">
                        {getIcon(asset.type)}
                      </div>
                      <div className="aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/30">
                        {preview ? (
                          asset.type === 'video' ? (
                            <video src={withAssetAuthQuery(asset.url)} poster={preview} className="h-full w-full object-cover" />
                          ) : (
                            <img src={preview} alt={asset.name} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                          )
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-100">{asset.name}</div>
	                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
	                          <span>{typeLabel(asset.type)}</span>
	                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">{purposeLabel(asset.purpose)}</span>
	                          {asset.purpose === 'script_source' && (
	                            <span className={`rounded px-1.5 py-0.5 ${asset.parseStatus === 'failed' ? 'bg-red-500/10 text-red-300' : asset.parseStatus === 'parsed' ? 'bg-brand/10 text-brand' : 'bg-white/5 text-slate-400'}`}>
	                              {parseStatusLabel(asset.parseStatus)}
	                            </span>
	                          )}
	                          <span>{projectLabel(asset.projectId)}</span>
	                          {asset.nodeId && <span className="max-w-[180px] truncate">节点 {asset.nodeId}</span>}
	                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">{new Date(asset.createdAt).toLocaleString()}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">
                当前条件暂无素材。
              </div>
            )}
          </div>
        ) : (
        <div className="wandou-assets-table flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#111112] shadow-2xl">
          {error && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] text-slate-500">
                <th className="px-6 py-3 font-medium">名称</th>
                <th className="px-6 py-3 font-medium">项目</th>
                <th className="px-6 py-3 font-medium">来源节点</th>
                <th className="px-6 py-3 font-medium">修改日期</th>
                <th className="px-6 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loadingPage ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    正在加载素材...
                  </td>
                </tr>
              ) : filteredAssets.length > 0 ? filteredAssets.map((asset) => (
                <tr key={asset.id} onClick={() => openAsset(asset.id)} className="group cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.04]">
                  <td className="flex items-center space-x-3 px-6 py-2.5">
                    <AssetThumbnail asset={asset} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 transition-colors group-hover:text-brand">{asset.name}</div>
	                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
	                        <span>{typeLabel(asset.type)}</span>
	                        <span>{purposeLabel(asset.purpose)}</span>
	                        {asset.purpose === 'script_source' && <span>{parseStatusLabel(asset.parseStatus)}</span>}
	                      </div>
	                    </div>
	                  </td>
                  <td className="px-6 py-2.5 text-xs text-slate-500">{projectLabel(asset.projectId)}</td>
                  <td className="px-6 py-2.5 text-xs text-slate-500">{asset.nodeId || '--'}</td>
                  <td className="px-6 py-2.5 text-xs text-slate-500">{new Date(asset.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(event) => { event.stopPropagation(); openEditAssetForm(asset); }} className="p-1 hover:bg-white/10 rounded text-slate-400">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    {assetPage.totalElements === 0 ? '当前条件暂无素材。智能体流程生成或手动登记的素材会出现在这里。' : '没有匹配当前搜索和类型筛选的素材。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-3 text-xs text-slate-500">
            <div>
              {assetPage.totalElements > 0
                ? `显示 ${pageStart}-${pageEnd} / ${assetPage.totalElements}`
                : '暂无素材'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(0)}
                disabled={currentPage === 0 || loadingPage}
                className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                首页
              </button>
              <button
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={currentPage === 0 || loadingPage}
                className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <span className="min-w-[86px] text-center text-slate-500">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                disabled={currentPage >= totalPages - 1 || loadingPage}
                className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1 || loadingPage}
                className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                末页
              </button>
            </div>
          </div>
        </div>
        )}

        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-8 backdrop-blur-sm">
            <form onSubmit={handleCreateAsset} className="wandou-assets-modal w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#121213] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-white">{editingAssetId ? '编辑项目素材' : '登记项目素材'}</h2>
                  <p className="mt-1 text-xs text-slate-500">{editingAssetId ? '更新素材名称、类型和访问地址。' : '上传文件或登记外链，素材会归档到所选项目。'}</p>
                </div>
                <button type="button" onClick={() => { setShowCreateForm(false); setEditingAssetId(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="关闭登记素材">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-3 p-5 md:grid-cols-2">
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="名称" />
	                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                  <option value="audio">音频</option>
                  <option value="character">角色</option>
                  <option value="scene">场景</option>
                  <option value="derivative">衍生品</option>
                  <option value="model">3D模型</option>
                  <option value="print">打印文件</option>
	                  <option value="file">文件</option>
	                </select>
	                <select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
	                  <option value="auto">自动判定用途</option>
	                  <option value="script_source">剧本来源</option>
	                  <option value="reference_image">参考图</option>
	                  <option value="character_reference">角色参考</option>
	                  <option value="derivative_design">衍生设计</option>
	                  <option value="derivative_mockup">商品预览</option>
	                  <option value="model_preview">3D预览</option>
	                  <option value="print_package">生产包</option>
	                  <option value="library_asset">普通素材</option>
	                </select>
	                <select value={form.projectId} onChange={(event) => handleProjectChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
                  <option value="">选择项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">
                  <Upload size={16} />
                  上传文件
                </button>
	                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.txt,.md,.pdf,.docx,.glb,.gltf,.obj,.fbx,.stl,.3mf,.gcode,.zip" className="hidden" onChange={handleUploadFile} />
                <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="md:col-span-2 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="素材 URL" />
                <input value={form.thumbnailUrl} onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })} className="md:col-span-2 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="缩略图 URL（可选）" />
                <input value={form.canvasId} onChange={(event) => setForm({ ...form, canvasId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="画布 ID" />
                <input value={form.nodeId} onChange={(event) => setForm({ ...form, nodeId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="节点 ID（可选）" />
              </div>
              <div className="flex justify-end gap-3 border-t border-white/5 px-5 py-4">
                <button type="button" onClick={() => { setShowCreateForm(false); setEditingAssetId(null); }} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
                  取消
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60">
                  {saving ? '保存中...' : editingAssetId ? '保存修改' : '保存到项目'}
                </button>
              </div>
            </form>
          </div>
        )}

        {showDerivativeForm && derivativeSource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-8 backdrop-blur-sm">
            <form onSubmit={handleCreateDerivative} className="wandou-assets-modal w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#121213] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-white">创建角色衍生品</h2>
                  <p className="mt-1 text-xs text-slate-500">{derivativeSource.name}</p>
                </div>
                <button type="button" onClick={() => { setShowDerivativeForm(false); setDerivativeSource(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="关闭角色衍生品">
                  <X size={16} />
                </button>
              </div>
              <div className="grid gap-3 p-5">
                <div className="grid grid-cols-3 gap-2">
                  {(['tshirt_print', 'sticker_set', 'model_preview'] as DerivativeKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setDerivativeForm({
                        ...derivativeForm,
                        kind,
                        size: kind === 'sticker_set' ? 'A5 贴纸排版' : kind === 'model_preview' ? '按上传模型单位' : '30cm x 40cm',
                        technique: kind === 'sticker_set' ? '高清不干胶/模切' : kind === 'model_preview' ? 'GLB/OBJ/STL 预览' : 'DTF/DTG 印花',
                      })}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${derivativeForm.kind === kind ? 'border-brand/50 bg-brand/15 text-brand' : 'border-white/10 bg-white/5 text-slate-300 hover:border-brand/30 hover:text-white'}`}
                    >
                      {derivativeKindLabels[kind]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={derivativeForm.prompt}
                  onChange={(event) => setDerivativeForm({ ...derivativeForm, prompt: event.target.value })}
                  rows={4}
                  className="resize-none rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm leading-6 outline-none focus:border-brand/50"
                  placeholder="补充风格、动作、图案位置或商品要求"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={derivativeForm.size}
                    onChange={(event) => setDerivativeForm({ ...derivativeForm, size: event.target.value })}
                    className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
                    placeholder="尺寸"
                  />
                  <input
                    value={derivativeForm.technique}
                    onChange={(event) => setDerivativeForm({ ...derivativeForm, technique: event.target.value })}
                    className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
                    placeholder="工艺"
                  />
                </div>
                {derivativeForm.kind === 'model_preview' && (
                  <div className="rounded-xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs leading-6 text-orange-100">
                    创建后会生成 3D 预览资产和画布节点，模型文件通过上传 GLB、OBJ 或 STL 补充。
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-white/5 px-5 py-4">
                <button type="button" onClick={() => { setShowDerivativeForm(false); setDerivativeSource(null); }} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
                  取消
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60">
                  {saving ? '处理中...' : derivativeForm.kind === 'model_preview' ? '创建预览资产' : '生成衍生品'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {selectedAsset && (
        <div className="wandou-assets-detail fixed inset-y-0 right-0 z-40 w-[360px] border-l border-white/10 bg-[#121213] p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">素材详情</h2>
            <button onClick={() => setSelectedAsset(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>
          <div className="space-y-4 text-sm">
            {(selectedAssetCanPreviewModel || selectedAssetThumbnailUrl || selectedAssetUrl) && (
              <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {selectedAssetCanPreviewModel ? (
                  <ModelPreview url={selectedAssetUrl} name={selectedAsset.name} />
                ) : selectedAsset.type === 'video' ? (
                  <video src={selectedAssetUrl} poster={selectedAssetThumbnailUrl || undefined} controls className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={selectedAssetThumbnailUrl || selectedAssetUrl}
                    className="h-full w-full object-cover"
                    alt={selectedAsset.name}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">名称</div>
              <div className="mt-1 font-semibold text-slate-200">{selectedAsset.name}</div>
            </div>
	            <div>
	              <div className="text-xs text-slate-500">所属项目</div>
	              <div className="mt-1 text-slate-300">{projectLabel(selectedAsset.projectId)}</div>
	            </div>
	            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
	              <div className="rounded-lg bg-black/20 p-3">
	                <div className="text-slate-500">用途</div>
	                <div className="mt-1 text-slate-200">{purposeLabel(selectedAsset.purpose)}</div>
	              </div>
	              <div className="rounded-lg bg-black/20 p-3">
	                <div className="text-slate-500">解析状态</div>
	                <div className={`mt-1 ${selectedAsset.parseStatus === 'failed' ? 'text-red-300' : selectedAsset.parseStatus === 'parsed' ? 'text-brand' : 'text-slate-300'}`}>
	                  {parseStatusLabel(selectedAsset.parseStatus)}
	                </div>
	              </div>
	            </div>
	            {selectedAsset.parsedSummary && (
	              <div className="rounded-xl border border-brand/15 bg-brand/5 p-3">
	                <div className="text-xs font-bold text-brand">剧本摘要</div>
	                <div className="mt-2 text-xs leading-6 text-slate-300">{selectedAsset.parsedSummary}</div>
	              </div>
	            )}
	            {selectedAsset.parseError && (
	              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-6 text-red-200">
	                解析失败：{selectedAsset.parseError}
	              </div>
	            )}
            <div>
              <div className="text-xs text-slate-500">URL</div>
              <a href={selectedAssetUrl || selectedAsset.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-brand hover:text-brand/80">{selectedAsset.url}</a>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-slate-500">画布</div>
                <div className="mt-1 break-all">{selectedAsset.canvasId || '--'}</div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-slate-500">节点</div>
                <div className="mt-1 break-all">{selectedAsset.nodeId || '--'}</div>
              </div>
            </div>
            {selectedAssetCanDerive && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-3 text-xs font-bold text-slate-300">角色衍生</div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => openDerivativeForm('tshirt_print')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-brand/40 hover:text-white">
                    短袖印花
                  </button>
                  <button onClick={() => openDerivativeForm('sticker_set')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-brand/40 hover:text-white">
                    贴纸套装
                  </button>
                  <button onClick={() => openDerivativeForm('model_preview')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-brand/40 hover:text-white">
                    3D预览
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openEditAssetForm(selectedAsset)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
              >
                编辑信息
              </button>
              <button
                onClick={() => handleDeleteAsset(selectedAsset)}
                disabled={saving}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                删除素材
              </button>
              <button
                onClick={() => selectedAssetUrl && window.open(selectedAssetUrl, '_blank', 'noopener,noreferrer')}
                disabled={!selectedAssetUrl}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                打开原文件
              </button>
              {selectedAsset.type === 'model' && selectedAsset.purpose === 'model_preview' && (
                <button
                  onClick={() => openModelUploadForm(selectedAsset)}
                  className="rounded-lg border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-bold text-orange-100 hover:bg-orange-400/15"
                >
                  上传模型
                </button>
              )}
              <button
                onClick={() => selectedAssetUrl && window.open(selectedAssetUrl, '_blank', 'noopener,noreferrer')}
                disabled={!selectedAssetUrl || !['print', 'model', 'file'].includes(selectedAsset.type)}
                className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                导出打印
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
