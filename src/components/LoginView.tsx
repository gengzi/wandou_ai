import React, { useState } from 'react';
import {
  Bot,
  Clapperboard,
  Film,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Layers3,
  LogIn,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Video,
} from 'lucide-react';
import { login, LoginResponse } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

interface LoginViewProps {
  onAuthenticated: (session: LoginResponse) => void;
}

export default function LoginView({ onAuthenticated }: LoginViewProps) {
  const { t, toggleLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const [email, setEmail] = useState('admin@wandou.ai');
  const [password, setPassword] = useState('Wandou@123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const workflowNodes = [
    { label: t('login.node.script'), icon: Clapperboard, tone: 'text-emerald-300' },
    { label: t('login.node.character'), icon: Bot, tone: 'text-sky-300' },
    { label: t('login.node.storyboard'), icon: Film, tone: 'text-violet-300' },
    { label: t('login.node.video'), icon: Video, tone: 'text-amber-300' },
    { label: t('login.node.assets'), icon: ImageIcon, tone: 'text-lime-300' },
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await login({ email, password });
      onAuthenticated(session);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`wandou-login-page relative z-10 min-h-screen w-full overflow-hidden px-5 py-8 text-slate-200 ${isLight ? 'is-light' : 'is-dark'}`}>
      <div className="wandou-login-grid" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-[1180px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="hidden min-w-0 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-2xl font-black italic text-white shadow-[0_18px_42px_rgba(16,185,129,0.28)]">
              W
            </div>
            <div>
              <div className="text-lg font-black text-white">{t('login.title')}</div>
              <div className="text-xs font-semibold text-brand">{t('login.kicker')}</div>
            </div>
          </div>

          <div className="max-w-[640px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand">
              <ShieldCheck size={15} />
              {t('login.secureBadge')}
            </div>
            <h1 className="max-w-[660px] break-keep text-[32px] font-black leading-tight text-white">
              {t('login.heroTitle')}
            </h1>
            <p className="mt-4 max-w-[560px] text-sm leading-6 text-slate-400">
              {t('login.heroDesc')}
            </p>
          </div>

          <div className="mt-10 max-w-[700px]">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-400">
              <Layers3 size={16} className="text-brand" />
              {t('login.pipelineTitle')}
            </div>
            <div className="wandou-login-flow">
              {workflowNodes.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div key={node.label} className="wandou-login-node">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <Icon size={18} className={node.tone} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-100">{node.label}</div>
                      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-brand/80"
                          style={{ width: `${58 + index * 8}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="wandou-login-card w-full rounded-lg border border-white/10 bg-[#121213]/88 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-xl font-black italic text-white shadow-[0_14px_34px_rgba(16,185,129,0.26)]">
                W
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-brand">
                  <Sparkles size={13} />
                  {t('login.panelKicker')}
                </div>
                <h1 className="mt-1 text-xl font-black text-white">{t('login.panelTitle')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLocale}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label={t('language.switch')}
                title={t('language.switch')}
              >
                <Languages size={16} />
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label={theme === 'dark' ? '切换白天模式' : '切换黑夜模式'}
                title={theme === 'dark' ? '切换白天模式' : '切换黑夜模式'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>

          <p className="mb-6 text-sm leading-6 text-slate-400">{t('login.panelDesc')}</p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('login.email')}</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="wandou-login-input w-full rounded-lg border border-white/10 bg-[#1A1A1C] py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-brand/60"
                  autoComplete="email"
                  placeholder={t('login.emailPlaceholder')}
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('login.password')}</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="wandou-login-input w-full rounded-lg border border-white/10 bg-[#1A1A1C] py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-brand/60"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('login.passwordPlaceholder')}
                />
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(16,185,129,0.22)] transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={16} />
            <span>{loading ? t('login.loading') : t('login.submit')}</span>
          </button>

          <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500">
            {t('login.footer')}
          </div>
        </form>
      </div>
    </div>
  );
}
