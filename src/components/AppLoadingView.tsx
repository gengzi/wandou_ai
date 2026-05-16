import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../lib/theme';

interface AppLoadingViewProps {
  message: string;
}

export default function AppLoadingView({ message }: AppLoadingViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className={`wandou-loading-shell ${isLight ? 'is-light' : 'is-dark'}`}>
      <div className="wandou-loading-grid" />
      <div className="wandou-loading-card" role="status" aria-live="polite">
        <div className="wandou-loading-orbit" aria-hidden="true">
          <div className="wandou-loading-logo">W</div>
          <span className="wandou-loading-dot dot-a" />
          <span className="wandou-loading-dot dot-b" />
          <span className="wandou-loading-dot dot-c" />
          <span className="wandou-loading-ring ring-a" />
          <span className="wandou-loading-ring ring-b" />
        </div>

        <div className="wandou-loading-copy">
          <div className="wandou-loading-kicker">
            <Sparkles size={14} />
            Wandou Agent Studio
          </div>
          <h1>豌豆正在准备工作台</h1>
          <p>{message}</p>
        </div>

        <div className="wandou-loading-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
