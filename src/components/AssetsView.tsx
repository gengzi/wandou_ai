import React, { useEffect, useState } from 'react';
import { Search, Filter, FolderPlus, Upload, FileVideo, Image as ImageIcon, FileText, FileAudio, Folder, MoreVertical, X } from 'lucide-react';
import { AssetResponse, createAsset, getAsset, listAssets } from '../lib/api';

const assetTabs = [
  { id: 'all', label: '全部 (All)' },
  { id: 'image', label: '图片 (Images)' },
  { id: 'video', label: '视频 (Videos)' },
  { id: 'audio', label: '音频 (Audio)' },
  { id: 'model', label: '项目模型 (Models)' },
];

export default function AssetsView() {
  const [assets, setAssets] = useState<AssetResponse[]>([]);
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

  const refreshAssets = () => {
    listAssets()
      .then(setAssets)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '素材加载失败'));
  };

  useEffect(() => {
    refreshAssets();
  }, []);

  const filteredAssets = assets.filter((asset) => {
    const matchesType = activeType === 'all' || asset.type === activeType;
    const searchText = `${asset.name} ${asset.type} ${asset.projectId}`.toLowerCase();
    return matchesType && searchText.includes(query.trim().toLowerCase());
  });

  const handleCreateAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.type.trim() || !form.url.trim()) {
      setError('请填写素材名称、类型和 URL。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const asset = await createAsset({
        projectId: form.projectId.trim() || undefined,
        canvasId: form.canvasId.trim() || undefined,
        nodeId: form.nodeId.trim() || undefined,
        type: form.type.trim(),
        name: form.name.trim(),
        url: form.url.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      });
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setShowCreateForm(false);
      setForm({ projectId: '', canvasId: '', nodeId: '', type: 'image', name: '', url: '', thumbnailUrl: '' });
      setNotice('素材已登记到后端资产库。');
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

  const handleUploadUnavailable = () => {
    setNotice('真实文件上传需要对象存储接口。本轮先支持登记已有素材 URL。');
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

  return (
    <div className="h-full flex flex-col bg-[#0B0B0C] text-slate-200 p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">素材管理 (Assets Management)</h1>
          <p className="text-sm text-slate-400">管理、上传和组织你的所有媒体和生成资源</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => setNotice('文件夹归档需要后端目录/标签接口，当前可通过搜索和类型过滤管理素材。')} className="px-4 py-2 bg-[#1A1A1C] hover:bg-white/5 border border-white/10 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors">
            <FolderPlus size={16} />
            <span>新建文件夹</span>
          </button>
          <button onClick={() => setShowCreateForm(true)} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-brand/20">
            <Upload size={16} />
            <span>登记素材</span>
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between mb-6">
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="text" placeholder="搜索素材..." className="w-64 bg-[#1A1A1C] border border-white/5 focus:border-brand/50 rounded-lg pl-9 pr-4 py-2 outline-none text-sm transition-all" />
          </div>
          <button onClick={() => setNotice('高级筛选需要后端标签/项目维度接口，当前支持本地搜索和类型筛选。')} className="p-2 border border-white/5 rounded-lg bg-[#1A1A1C] hover:bg-white/5 text-slate-400 transition-colors">
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
            <h2 className="text-sm font-bold text-white">登记外部素材</h2>
            <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="名称" />
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50">
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="audio">audio</option>
              <option value="model">model</option>
              <option value="file">file</option>
            </select>
            <input value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="项目 ID（可选）" />
            <button type="button" onClick={handleUploadUnavailable} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">上传文件</button>
            <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="lg:col-span-2 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="素材 URL" />
            <input value={form.thumbnailUrl} onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })} className="lg:col-span-2 rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="缩略图 URL（可选）" />
            <input value={form.canvasId} onChange={(event) => setForm({ ...form, canvasId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="画布 ID（可选）" />
            <input value={form.nodeId} onChange={(event) => setForm({ ...form, nodeId: event.target.value })} className="rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50" placeholder="节点 ID（可选）" />
            <button type="submit" disabled={saving} className="lg:col-span-2 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60">{saving ? '保存中...' : '保存素材'}</button>
          </div>
        </form>
      )}

      <div className="flex-1 bg-[#121213] border border-white/5 rounded-2xl overflow-hidden">
        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs text-slate-500">
              <th className="px-6 py-4 font-medium">名称</th>
              <th className="px-6 py-4 font-medium">大小</th>
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
                <td className="px-6 py-4 text-sm text-slate-400">--</td>
                <td className="px-6 py-4 text-sm text-slate-400">{new Date(asset.createdAt).toLocaleString()}</td>
                <td className="px-6 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(event) => { event.stopPropagation(); setNotice('素材重命名/删除需要后端资产管理接口。'); }} className="p-1 hover:bg-white/10 rounded text-slate-400">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                  {assets.length === 0 ? '后端资产库暂无素材。Agent Run 生成或手动登记的素材会出现在这里。' : '没有匹配当前搜索和类型筛选的素材。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
              <div className="text-xs text-slate-500">类型</div>
              <div className="mt-1 text-slate-300">{selectedAsset.type}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">URL</div>
              <a href={selectedAsset.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-brand hover:text-brand/80">{selectedAsset.url}</a>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-slate-500">项目</div>
                <div className="mt-1 break-all">{selectedAsset.projectId || '--'}</div>
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
