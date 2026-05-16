import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, Upload, FileVideo, Image as ImageIcon, FileText, FileAudio, Folder, MoreVertical, X, Plus } from 'lucide-react';
import { AssetPageResponse, AssetResponse, createAsset, getAsset, listAssets, listAssetsPage, listProjects, ProjectResponse, uploadAsset } from '../lib/api';

const assetTabs = [
  { id: 'all', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
  { id: 'model', label: '项目模型' },
];

const folderPalettes = [
  { tab: '#8adfb2', back: 'rgba(138,223,178,0.16)', front: 'rgba(138,223,178,0.42)', lip: 'rgba(255,255,255,0.22)', glow: 'rgba(138,223,178,0.22)' },
  { tab: '#91d9ff', back: 'rgba(145,217,255,0.15)', front: 'rgba(145,217,255,0.40)', lip: 'rgba(255,255,255,0.23)', glow: 'rgba(145,217,255,0.20)' },
  { tab: '#9f82ff', back: 'rgba(159,130,255,0.17)', front: 'rgba(159,130,255,0.44)', lip: 'rgba(255,255,255,0.22)', glow: 'rgba(159,130,255,0.24)' },
  { tab: '#f1bf76', back: 'rgba(241,191,118,0.14)', front: 'rgba(241,191,118,0.36)', lip: 'rgba(255,255,255,0.20)', glow: 'rgba(241,191,118,0.20)' },
];

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
    <button onClick={onClick} className="group flex w-[232px] shrink-0 flex-col items-center text-center">
      <div className="relative h-[130px] w-[224px] transition-transform duration-300 group-hover:-translate-y-1">
        <div
          className="absolute left-5 top-4 h-[86px] w-[184px] rounded-[15px] border backdrop-blur-xl"
          style={{
            borderColor: palette.tab,
            background: palette.back,
            boxShadow: active ? `0 18px 58px ${palette.glow}` : `0 12px 34px ${palette.glow}`,
          }}
        />
        <div
          className="absolute left-[126px] top-4 h-7 w-[72px] rounded-t-[14px] border border-b-0 backdrop-blur-xl"
          style={{ borderColor: palette.tab, background: palette.back }}
        />
        {previews.slice(0, 2).map((preview, index) => (
          <img
            key={`${title}-${preview}-${index}`}
            src={preview}
            alt=""
            className={`absolute rounded-xl border border-white/45 object-cover shadow-lg ${index === 0 ? 'right-14 top-[24px] h-11 w-[60px]' : 'right-8 top-[40px] h-13 w-[66px] blur-[1px] opacity-70'}`}
          />
        ))}
        <div
          className={`absolute left-2 top-[54px] h-[72px] w-[216px] overflow-hidden rounded-[15px] border border-white/25 backdrop-blur-md transition-all duration-300 ${active ? 'ring-2 ring-white/40' : ''}`}
          style={{ background: palette.front, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.36), 0 14px 34px ${palette.glow}` }}
        >
          <div className="absolute inset-x-0 top-0 h-6" style={{ background: palette.lip }} />
          <div className="absolute bottom-5 left-7 max-w-[154px] truncate text-lg font-black text-white drop-shadow-sm">{title}</div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-semibold text-slate-500">默认</span>
        <span className="max-w-[148px] truncate text-base font-bold text-slate-100">{title}</span>
      </div>
      <div className="mt-2 text-sm text-slate-500">{count}个素材</div>
    </button>
  );
};

export default function AssetsView() {
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeType, setActiveType] = useState('all');
  const [query, setQuery] = useState('');
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
  const [saving, setSaving] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    projectId: '',
    canvasId: '',
    nodeId: '',
    type: 'image',
    name: '',
    url: '',
    thumbnailUrl: '',
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
      grouped.set(key, [...(grouped.get(key) || []), asset]);
    });
    return grouped;
  }, [assets]);

  const refresh = () => {
    Promise.all([listProjects(), listAssets()])
      .then(([nextProjects, nextAssets]) => {
        setProjects(nextProjects);
        setAssets(nextAssets);
        if (selectedProjectId !== 'all' && selectedProjectId !== 'unassigned' && !nextProjects.some((project) => project.id === selectedProjectId)) {
          setSelectedProjectId('all');
        }
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '素材加载失败'));
  };

  const refreshPage = () => {
    setLoadingPage(true);
    const projectId = selectedProjectId === 'all' || selectedProjectId === 'unassigned' ? undefined : selectedProjectId;
    listAssetsPage({
      projectId,
      type: activeType,
      keyword: query.trim(),
      page,
      size: pageSize,
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
  }, [selectedProjectId, activeType, query, page, pageSize]);

  useEffect(() => {
    setPage(0);
  }, [selectedProjectId, activeType, query, pageSize]);

  const visibleAssets = assets.filter((asset) => {
    if (selectedProjectId === 'unassigned') return !asset.projectId;
    if (selectedProjectId !== 'all') return asset.projectId === selectedProjectId;
    return true;
  });

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
    });
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
      const asset = await createAsset({
        projectId: form.projectId.trim(),
        canvasId: form.canvasId.trim() || projectById.get(form.projectId.trim())?.canvasId,
        nodeId: form.nodeId.trim() || undefined,
        type: form.type.trim(),
        name: form.name.trim(),
        url: form.url.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      });
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setSelectedProjectId(asset.projectId || form.projectId);
      setPage(0);
      refreshPage();
      setShowCreateForm(false);
      setNotice('素材已登记到项目资产库。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '素材登记失败');
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
    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'asset';
    setSaving(true);
    setError(null);
    try {
      const asset = await uploadAsset({
        projectId: form.projectId.trim(),
        canvasId: form.canvasId.trim() || project?.canvasId,
        nodeId: form.nodeId.trim() || undefined,
        type,
        name: form.name.trim() || file.name,
        file,
      });
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setSelectedProjectId(asset.projectId || form.projectId);
      setPage(0);
      refreshPage();
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
    switch (type) {
      case 'folder': return <Folder className="text-blue-400" size={24} />;
      case 'video': return <FileVideo className="text-brand" size={24} />;
      case 'image': return <ImageIcon className="text-purple-400" size={24} />;
      case 'audio': return <FileAudio className="text-yellow-400" size={24} />;
      default: return <FileText className="text-slate-400" size={24} />;
    }
  };

  const projectLabel = (projectId: string) => projectById.get(projectId)?.name || (projectId ? `项目 ${projectId}` : '未归档');

  const previewsFor = (projectId: string) => {
    return (assetsByProject.get(projectId) || [])
      .filter((asset) => asset.thumbnailUrl || asset.url)
      .map((asset) => asset.thumbnailUrl || asset.url)
      .slice(0, 2);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0B0B0C] text-slate-200">
      <main className="flex min-h-full min-w-0 flex-col p-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-brand">项目素材</div>
            <h1 className="mt-1 truncate text-2xl font-bold text-white">素材管理</h1>
            <p className="mt-1 text-sm text-slate-500">项目文件夹、媒体资源和生成资产统一归档</p>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setNotice('项目内文件夹/标签会在资产目录模型接入后启用；当前先按项目、类型和搜索管理。')} className="px-4 py-2 bg-[#1A1A1C] hover:bg-white/5 border border-white/10 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors">
              <Folder size={16} />
              <span>项目文件夹</span>
            </button>
            <button onClick={openCreateForm} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-brand/20">
              <Upload size={16} />
              <span>登记素材</span>
            </button>
          </div>
        </header>

        <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] px-6 py-7">
          <div className="flex items-start gap-8 overflow-x-auto pb-2">
            <button onClick={openCreateForm} className="group flex w-[210px] shrink-0 flex-col items-center text-center">
              <div className="relative h-[130px] w-[196px] transition-transform duration-300 group-hover:-translate-y-1">
                <div className="absolute left-0 top-4 h-[82px] w-[172px] rounded-[18px] bg-slate-800/70 shadow-[0_12px_34px_rgba(0,0,0,0.20)]" />
                <div className="absolute left-[88px] top-2 h-7 w-[72px] rounded-t-[16px] bg-slate-800/70" />
                <div className="absolute inset-x-0 top-[34px] h-[78px] rounded-[18px] border border-white/10 bg-slate-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
                <div className="absolute inset-x-4 top-[44px] flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-slate-700/50 text-slate-400">
                  <Plus size={24} />
                  <div className="text-sm font-semibold leading-5">
                    点击新建或拖拽<br />文件夹到这里
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-500">新建项目素材</div>
            </button>

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
          </div>
        </section>

        <div className="mb-4 min-w-0">
          <h2 className="truncate text-xl font-bold text-white">
            {selectedProjectId === 'all' ? '全部项目素材' : selectedProjectId === 'unassigned' ? '未归档素材' : projectLabel(selectedProjectId)}
          </h2>
          <div className="mt-1 text-sm text-slate-500">{assetPage.totalElements} 个素材</div>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex bg-[#1A1A1C] rounded-lg border border-white/5 p-1">
            {assetTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveType(tab.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeType === tab.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex space-x-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand transition-colors" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} type="text" placeholder="搜索当前项目素材..." className="w-72 bg-[#1A1A1C] border border-white/5 focus:border-brand/50 rounded-lg pl-9 pr-4 py-2 outline-none text-sm transition-all" />
            </div>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-lg border border-white/5 bg-[#1A1A1C] px-3 py-2 text-sm text-slate-300 outline-none focus:border-brand/50"
            >
              <option value={10}>10 / 页</option>
              <option value={20}>20 / 页</option>
              <option value={50}>50 / 页</option>
            </select>
            <button onClick={() => setNotice('高级筛选会和项目标签、节点来源一起接入；当前支持项目、类型和搜索。')} className="p-2 border border-white/5 rounded-lg bg-[#1A1A1C] hover:bg-white/5 text-slate-400 transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-brand">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-xs font-semibold text-slate-300 hover:text-white">关闭</button>
          </div>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreateAsset} className="mb-5 rounded-xl border border-white/10 bg-[#121213] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">登记项目素材</h2>
              <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="名称" />
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
                <option value="image">图片</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
                <option value="model">模型</option>
                <option value="file">文件</option>
              </select>
              <select value={form.projectId} onChange={(event) => handleProjectChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
                <option value="">选择项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleUploadFile} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">上传文件</button>
              <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="lg:col-span-2 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="素材 URL" />
              <input value={form.thumbnailUrl} onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })} className="lg:col-span-2 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="缩略图 URL（可选）" />
              <input value={form.canvasId} onChange={(event) => setForm({ ...form, canvasId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="画布 ID" />
              <input value={form.nodeId} onChange={(event) => setForm({ ...form, nodeId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="节点 ID（可选）" />
              <button type="submit" disabled={saving} className="lg:col-span-2 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60">{saving ? '保存中...' : '保存到项目'}</button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-hidden rounded-2xl border border-white/5 bg-[#121213]">
          {error && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-500">
                <th className="px-6 py-4 font-medium">名称</th>
                <th className="px-6 py-4 font-medium">项目</th>
                <th className="px-6 py-4 font-medium">来源节点</th>
                <th className="px-6 py-4 font-medium">修改日期</th>
                <th className="px-6 py-4 font-medium w-16"></th>
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
                <tr key={asset.id} onClick={() => openAsset(asset.id)} className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer">
                  <td className="px-6 py-4 flex items-center space-x-3">
                    {getIcon(asset.type)}
                    <div>
                      <div className="text-sm font-medium text-slate-200 group-hover:text-brand transition-colors">{asset.name}</div>
                      <div className="text-xs text-slate-500">{asset.type}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">{projectLabel(asset.projectId)}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{asset.nodeId || '--'}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{new Date(asset.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(event) => { event.stopPropagation(); setNotice('素材重命名/删除需要后端资产管理接口。'); }} className="p-1 hover:bg-white/10 rounded text-slate-400">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-6 py-4 text-sm text-slate-400">
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
      </main>

      {selectedAsset && (
        <div className="fixed inset-y-0 right-0 z-40 w-[360px] border-l border-white/10 bg-[#121213] p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">素材详情</h2>
            <button onClick={() => setSelectedAsset(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>
          <div className="space-y-4 text-sm">
            {(selectedAsset.thumbnailUrl || selectedAsset.url) && (
              <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {selectedAsset.type === 'video' ? (
                  <video src={selectedAsset.url} poster={selectedAsset.thumbnailUrl} controls className="h-full w-full object-cover" />
                ) : (
                  <img src={selectedAsset.thumbnailUrl || selectedAsset.url} className="h-full w-full object-cover" alt={selectedAsset.name} />
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
            <div>
              <div className="text-xs text-slate-500">URL</div>
              <a href={selectedAsset.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-brand hover:text-brand/80">{selectedAsset.url}</a>
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
          </div>
        </div>
      )}
    </div>
  );
}
