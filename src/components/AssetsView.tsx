import React, { useEffect, useState } from 'react';
import { Search, Filter, FolderPlus, Upload, FileVideo, Image as ImageIcon, FileText, FileAudio, Folder, MoreVertical } from 'lucide-react';
import { AssetResponse, listAssets } from '../lib/api';

export default function AssetsView() {
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshAssets = () => {
    listAssets()
      .then(setAssets)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '素材加载失败'));
  };

  useEffect(() => {
    refreshAssets();
  }, []);

  const handleUploadUnavailable = () => {
    setError('素材上传接口尚未接入。当前列表只展示后端资产库中的真实素材。');
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
          <button className="px-4 py-2 bg-[#1A1A1C] hover:bg-white/5 border border-white/10 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors">
            <FolderPlus size={16} />
            <span>新建文件夹</span>
          </button>
          <button onClick={handleUploadUnavailable} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-brand/20">
            <Upload size={16} />
            <span>登记素材</span>
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-[#1A1A1C] rounded-lg border border-white/5 p-1">
          {['全部 (All)', '图片 (Images)', '视频 (Videos)', '音频 (Audio)', '项目模型 (Models)'].map((tab, i) => (
            <button key={tab} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${i === 0 ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex space-x-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand transition-colors" size={16} />
            <input type="text" placeholder="搜索素材..." className="w-64 bg-[#1A1A1C] border border-white/5 focus:border-brand/50 rounded-lg pl-9 pr-4 py-2 outline-none text-sm transition-all" />
          </div>
          <button className="p-2 border border-white/5 rounded-lg bg-[#1A1A1C] hover:bg-white/5 text-slate-400 transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </div>

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
            {assets.length > 0 ? assets.map((asset) => (
              <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer">
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
                  <button className="p-1 hover:bg-white/10 rounded text-slate-400">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                  后端资产库暂无素材。Agent Run 生成的素材会出现在这里。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
