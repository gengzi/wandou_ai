import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'wandou.theme';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') {
    return 'dark';
  }
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

function applyDocumentTheme(theme: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useLayoutEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => {
    const setTheme = (nextTheme: ThemeMode) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_KEY, nextTheme);
      }
      setThemeState(nextTheme);
      applyDocumentTheme(nextTheme);
    };
    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
