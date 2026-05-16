import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Plus, Save, Trash2 } from 'lucide-react';
import { createModelConfig, deleteModelConfig, listModelConfigs, ModelConfigResponse, updateModelConfig } from '../lib/api';

type Capability = 'text' | 'image' | 'video' | 'audio';
type CompatibilityMode = 'openai' | 'qwave-task' | 'qingyun-task';

const capabilities: Array<{ id: Capability; label: string; hint: string }> = [
  { id: 'text', label: '文本模型', hint: '剧本、规划、总结' },
  { id: 'image', label: '生图模型', hint: '关键帧、参考图' },
  { id: 'video', label: '视频模型', hint: '图生视频、文生视频' },
  { id: 'audio', label: '音频模型', hint: '配乐、音效、旁白' },
];

const emptyForm = {
  id: '',
  capability: 'text' as Capability,
  provider: 'openai-compatible',
  displayName: '兼容接口',
  baseUrl: 'https://api.openai.com/v1',
  modelName: '',
  compatibilityMode: 'openai' as CompatibilityMode,
  apiKey: '',
  enabled: true,
};

export default function ModelSettingsView() {
  const [configs, setConfigs] = useState<ModelConfigResponse[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listModelConfigs()
      .then(setConfigs)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '模型配置加载失败'));
  }, []);

  const grouped = useMemo(() => {
    return capabilities.map((capability) => ({
      ...capability,
      configs: configs.filter((config) => config.capability === capability.id),
    }));
  }, [configs]);

  const selectConfig = (config: ModelConfigResponse) => {
    setError('');
    setMessage('');
    setForm({
      id: config.id,
      capability: config.capability,
      provider: config.provider,
      displayName: config.displayName,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      compatibilityMode: config.compatibilityMode || 'openai',
      apiKey: '',
      enabled: config.enabled,
    });
  };

  const resetForm = (capability: Capability = 'text') => {
    setError('');
    setMessage('');
    setForm({ ...emptyForm, capability });
  };

  const saveConfig = async () => {
    if (!form.modelName.trim() || !form.baseUrl.trim() || !form.displayName.trim()) {
      setError('请填写显示名称、接口地址和模型名称。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        capability: form.capability,
        provider: form.provider,
        displayName: form.displayName,
        baseUrl: form.baseUrl,
        modelName: form.modelName,
        compatibilityMode: form.compatibilityMode,
        apiKey: form.apiKey,
        enabled: form.enabled,
      };
      const saved = form.id
        ? await updateModelConfig(form.id, payload)
        : await createModelConfig(payload);
      setConfigs((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setForm({ ...form, id: saved.id, apiKey: '' });
      setMessage('模型配置已保存。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const removeConfig = async () => {
    if (!form.id) return;
    setSaving(true);
    setError('');
    try {
      await deleteModelConfig(form.id);
      setConfigs((current) => current.filter((item) => item.id !== form.id));
      resetForm(form.capability);
      setMessage('模型配置已删除。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '删除失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0B0B0C]/70 text-slate-200">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 text-xs font-bold tracking-[0.24em] text-brand">模型设置</div>
            <h1 className="text-2xl font-bold text-white">模型配置</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            每个用户维护自己的模型接入。优先使用兼容接口的地址、密钥、模型名三件套，后续接 OpenAI、兼容网关或第三方适配器都走同一套配置。
          </p>
          <p className="mt-2 text-xs text-yellow-200/80">
            当前版本只保存配置，不执行连接测试；保存后请通过工作区生成链路验证模型可用性。
          </p>
        </div>
          <button
            type="button"
            onClick={() => resetForm('text')}
            className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <Plus size={16} />
            新建配置
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm text-brand">{message}</div>}

        <div className="grid gap-4 xl:grid-cols-4">
          {grouped.map((group) => (
            <section key={group.id} className="rounded-lg border border-white/10 bg-[#121213] p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">{group.label}</h2>
                  <p className="mt-1 text-xs text-slate-500">{group.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => resetForm(group.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  title={`新增${group.label}`}
                  aria-label={`新增${group.label}`}
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="space-y-2">
                {group.configs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/10 p-3 text-xs text-slate-500">还没有配置</div>
                ) : group.configs.map((config) => (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => selectConfig(config)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      form.id === config.id
                        ? 'border-brand/60 bg-brand/10'
                        : 'border-white/10 bg-black/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-white">{config.displayName}</span>
                      {config.enabled && <CheckCircle2 size={14} className="shrink-0 text-brand" />}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">{config.modelName}</div>
                    <div className="mt-1 truncate text-[11px] text-slate-500">
                      {config.compatibilityMode === 'qingyun-task'
                        ? '青云/Vidu 异步任务接口'
                        : config.compatibilityMode === 'qwave-task'
                          ? 'QWave 异步任务接口'
                          : 'OpenAI 兼容接口'}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                      <KeyRound size={12} />
                      <span>{config.apiKeyPreview || '未保存密钥'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="w-[380px] shrink-0 border-l border-white/10 bg-[#121213] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">{form.id ? '编辑配置' : '新建配置'}</h2>
          <p className="mt-1 text-xs text-slate-500">密钥保存后只显示掩码；编辑时留空会保留原密钥。</p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">模型类型</span>
            <select
              value={form.capability}
              onChange={(event) => setForm({ ...form, capability: event.target.value as Capability })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
            >
              {capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">服务商</span>
            <select
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
            >
              <option value="openai-compatible">OpenAI 兼容</option>
              <option value="qingyun">青云接口</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="kling">可灵适配器</option>
              <option value="runway">Runway 适配器</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">显示名称</span>
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
              placeholder="例如 OpenAI GPT-5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">接口地址</span>
            <input
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">接口兼容模式</span>
            <select
              value={form.compatibilityMode}
              onChange={(event) => setForm({ ...form, compatibilityMode: event.target.value as CompatibilityMode })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
            >
              <option value="openai">OpenAI 兼容接口</option>
              <option value="qingyun-task">青云/Vidu 异步任务接口</option>
              <option value="qwave-task">QWave 异步任务接口</option>
            </select>
            <span className="mt-1 block text-[11px] leading-5 text-slate-500">
              OpenAI 兼容模式使用聊天/生图同步接口；青云/Vidu 和 QWave 用于异步任务式图片、视频模型。
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">模型名称</span>
            <input
              value={form.modelName}
              onChange={(event) => setForm({ ...form, modelName: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
              placeholder="例如 gpt-5.1、dall-e-3、kling-v1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">接口密钥</span>
            <input
              value={form.apiKey}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm outline-none focus:border-brand/50"
              placeholder={form.id ? '留空则保持原密钥' : 'sk-...'}
              type="password"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-sm font-semibold text-slate-300">启用配置</span>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={saveConfig}
              disabled={saving}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              <Save size={16} />
              保存
            </button>
            {form.id && (
              <button
                type="button"
                onClick={removeConfig}
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                title="删除"
                aria-label="删除"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
