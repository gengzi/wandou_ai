import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Upload, FileVideo, Image as ImageIcon, FileText, FileAudio, Folder, MoreVertical, X, Plus } from 'lucide-react';
import { AssetResponse, createAsset, getAsset, listAssets, listProjects, ProjectResponse } from '../lib/api';

const assetTabs = [
  { id: 'all', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
  { id: 'model', label: '项目模型' },
];

const folderPalettes = [
  { tab: '#7bd9ae', back: 'rgba(123,217,174,0.20)', front: 'rgba(122, 224, 177, 0.62)', glow: 'rgba(123,217,174,0.24)' },
  { tab: '#88d9ff', back: 'rgba(136,217,255,0.18)', front: 'rgba(140, 220, 255, 0.58)', glow: 'rgba(136,217,255,0.22)' },
  { tab: '#9b7cff', back: 'rgba(155,124,255,0.20)', front: 'rgba(157, 126, 245, 0.64)', glow: 'rgba(155,124,255,0.26)' },
  { tab: '#f4b86a', back: 'rgba(244,184,106,0.18)', front: 'rgba(248, 196, 122, 0.55)', glow: 'rgba(244,184,106,0.22)' },
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
    <button onClick={onClick} className="group flex w-[260px] shrink-0 flex-col items-center text-center">
      <div className="relative h-[170px] w-[246px] transition-transform duration-300 group-hover:-translate-y-1">
        <div
          className="absolute left-6 top-2 h-[124px] w-[190px] rounded-[16px] border backdrop-blur-xl"
          style={{
            borderColor: palette.tab,
            background: palette.back,
            boxShadow: active ? `0 22px 70px ${palette.glow}` : `0 16px 45px ${palette.glow}`,
          }}
        />
        <div
          className="absolute left-34 top-2 h-7 w-24 rounded-t-[14px] border border-b-0"
          style={{ borderColor: palette.tab, background: palette.back }}
        />
        <div className="absolute left-12 top-40 h-[92px] w-[154px] rounded-[12px] border border-white/45 bg-white/60 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-md" />
        <div className="absolute left-4 top-[54px] h-[106px] w-[220px] rounded-[15px] border border-white/35 bg-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.20)] backdrop-blur-xl" />
        {previews.slice(0, 2).map((preview, index) => (
          <img
            key={`${title}-${preview}-${index}`}
            src={preview}
            alt=""
            className={`absolute rounded-xl border border-white/50 object-cover shadow-lg ${index === 0 ? 'right-14 top-8 h-16 w-20' : 'right-8 top-14 h-20 w-24 blur-[1px] opacity-75'}`}
          />
        ))}
        <div
          className={`absolute left-2 top-[54px] h-[112px] w-[226px] overflow-hidden rounded-[15px] border border-white/25 backdrop-blur-md transition-all duration-300 ${active ? 'ring-2 ring-white/45' : ''}`}
          style={{ background: palette.front, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 18px 45px ${palette.glow}` }}
        >
          <div className="absolute inset-x-0 top-0 h-8 bg-white/18" />
          <div className="absolute bottom-7 left-6 text-xl font-black text-white drop-shadow">{title.slice(0, 14)}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="rounded-md bg-white/8 px-2 py-1 text-xs font-semibold text-slate-400">默认</span>
        <span className="max-w-[160px] truncate text-base font-bold text-slate-100">{title}</span>
      </div>
      <div className="mt-3 text-sm text-slate-500">{count}个素材</div>
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetResponse | null>(null);
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

  useEffect(() => {
    refresh();
  }, []);

  const visibleAssets = assets.filter((asset) => {
    if (selectedProjectId === 'unassigned') return !asset.projectId;
    if (selectedProjectId !== 'all') return asset.projectId === selectedProjectId;
    return true;
  });

  const filteredAssets = visibleAssets.filter((asset) => {
    const matchesType = activeType === 'all' || asset.type === activeType;
    const projectName = projectById.get(asset.projectId)?.name || '';
    const searchText = `${asset.name} ${asset.type} ${asset.projectId} ${projectName}`.toLowerCase();
    return matchesType && searchText.includes(query.trim().toLowerCase());
  });

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
      setShowCreateForm(false);
      setNotice('素材已登记到项目资产库。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '素材登记失败');
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

        <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-6 py-7">
          <div className="flex gap-8 overflow-x-auto pb-2">
            <button onClick={openCreateForm} className="group flex w-[230px] shrink-0 flex-col items-center text-center">
              <div className="relative h-[170px] w-[220px] rounded-[20px] bg-slate-800/70 shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-transform duration-300 group-hover:-translate-y-1">
                <div className="absolute left-0 top-4 h-[136px] w-[220px] rounded-[20px] bg-slate-700/80" />
                <div className="absolute left-24 top-0 h-8 w-72 rounded-t-[18px] bg-slate-700/80" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-slate-400">
                  <Plus size={34} />
                  <div className="text-sm font-semibold leading-6">
                    点击新建或拖拽本地<br />文件夹到这里
                  </div>
                </div>
              </div>
              <div className="mt-5 text-sm text-slate-500">新建项目素材</div>
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
          <div className="mt-1 text-sm text-slate-500">{visibleAssets.length} 个素材</div>
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
              <button type="button" onClick={() => setNotice('真实文件上传需要对象存储接口。本轮先支持登记已有素材 URL。')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">上传文件</button>
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
              {filteredAssets.length > 0 ? filteredAssets.map((asset) => (
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
                    {visibleAssets.length === 0 ? '当前项目暂无素材。Agent Run 生成或手动登记的素材会出现在这里。' : '没有匹配当前搜索和类型筛选的素材。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
