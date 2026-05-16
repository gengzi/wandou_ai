import React, { useEffect, useState } from 'react';
import { Activity, Clock3, Database, WalletCards } from 'lucide-react';
import { getMyUsage, UsageSummaryResponse } from '../lib/api';

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

export default function UsageView() {
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyUsage()
      .then(setUsage)
      .catch((err) => setError(err instanceof Error ? err.message : '积分用量加载失败'));
  }, []);

  const records = usage?.recentRecords || [];

  return (
    <div className="h-full overflow-y-auto bg-[#08090A] px-10 py-8 text-slate-100">
      <div className="mx-auto max-w-[1280px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-brand">积分与用量</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white">积分与模型请求</h1>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            记录每一次模型/API 调用
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-brand/20 bg-brand/10 p-5">
            <WalletCards className="text-brand" size={20} />
            <div className="mt-4 text-xs text-slate-500">剩余积分</div>
            <div className="mt-1 text-3xl font-black text-white">{usage?.remainingCredits ?? '--'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <Database className="text-slate-300" size={20} />
            <div className="mt-4 text-xs text-slate-500">已消耗</div>
            <div className="mt-1 text-3xl font-black text-white">{usage?.usedCredits ?? '--'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <Activity className="text-slate-300" size={20} />
            <div className="mt-4 text-xs text-slate-500">关联请求</div>
            <div className="mt-1 text-3xl font-black text-white">{usage?.requestCount ?? '--'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <Clock3 className="text-slate-300" size={20} />
            <div className="mt-4 text-xs text-slate-500">初始额度</div>
            <div className="mt-1 text-3xl font-black text-white">{usage?.initialCredits ?? '--'}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101112]">
          <div className="grid grid-cols-[1fr_120px_90px_90px_90px] border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div>模型请求</div>
            <div>能力</div>
            <div>积分</div>
            <div>耗时</div>
            <div>状态</div>
          </div>
          {records.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">暂无模型调用记录。</div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="grid grid-cols-[1fr_120px_90px_90px_90px] items-center border-b border-white/5 px-4 py-3 text-sm last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-200">{record.modelDisplayName || record.modelName}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {record.endpoint} · {record.providerRequestId || record.runId || record.id}
                  </div>
                </div>
                <div className="text-slate-400">{record.capability === 'text' ? '文本' : record.capability === 'image' ? '图片' : record.capability === 'video' ? '视频' : record.capability === 'audio' ? '音频' : record.capability}</div>
                <div className="font-semibold text-brand">{record.credits}</div>
                <div className="text-slate-400">{formatDuration(record.durationMs)}</div>
                <div className={record.status === 'success' ? 'text-brand' : 'text-red-200'}>{record.status === 'success' ? '成功' : record.status === 'failed' ? '失败' : record.status}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
