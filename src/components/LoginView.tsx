import React, { useState } from 'react';
import { Languages, LockKeyhole, LogIn } from 'lucide-react';
import { login, LoginResponse } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface LoginViewProps {
  onAuthenticated: (session: LoginResponse) => void;
}

export default function LoginView({ onAuthenticated }: LoginViewProps) {
  const { t, toggleLocale } = useI18n();
  const [email, setEmail] = useState('admin@wandou.ai');
  const [password, setPassword] = useState('Wandou@123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center bg-bg-dark px-6 text-slate-200">
      <form onSubmit={handleSubmit} className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#121213] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <LockKeyhole size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{t('login.title')}</h1>
              <p className="text-xs text-slate-500">{t('login.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLocale}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label={t('language.switch')}
            title={t('language.switch')}
          >
            <Languages size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('login.email')}</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand/60"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('login.password')}</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1A1A1C] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand/60"
              type="password"
              autoComplete="current-password"
            />
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
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={16} />
          <span>{loading ? t('login.loading') : t('login.submit')}</span>
        </button>
      </form>
    </div>
  );
}
