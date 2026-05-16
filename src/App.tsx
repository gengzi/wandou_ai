import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.tsx';
import HomeView from './components/HomeView.tsx';
import WorkspaceView from './components/WorkspaceView.tsx';
import AssetsView from './components/AssetsView.tsx';
import UsersView from './components/UsersView.tsx';
import ModelSettingsView from './components/ModelSettingsView.tsx';
import UsageView from './components/UsageView.tsx';
import BackgroundStars from './components/BackgroundStars.tsx';
import LoginView from './components/LoginView.tsx';
import { AnimatePresence, motion } from 'motion/react';
import { clearAuthToken, getAuthToken, getCurrentUser, LoginResponse, logout, UserResponse } from './lib/api.ts';
import { useI18n } from './lib/i18n.tsx';

export default function App() {
  const { t } = useI18n();
  const [view, setView] = useState<string>('home');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getAuthToken()));

  useEffect(() => {
    if (!getAuthToken()) {
      return;
    }

    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => clearAuthToken())
      .finally(() => setCheckingSession(false));
  }, []);

  const openWorkspace = (prompt?: string, projectId?: string) => {
    if (prompt?.trim()) {
      setInitialPrompt(prompt.trim());
    } else {
      setInitialPrompt('');
    }
    setWorkspaceProjectId(projectId);
    setView('workspace');
  };

  const handleAuthenticated = (session: LoginResponse) => {
    setCurrentUser(session.user);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setView('home');
    setWorkspaceProjectId(undefined);
    setInitialPrompt('');
  };

  if (checkingSession) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-dark text-sm text-slate-400">
        {t('app.restoreSession')}
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flex h-screen w-full bg-bg-dark overflow-hidden selection:bg-brand/30 selection:text-white relative">
      <BackgroundStars />
      
      <Sidebar currentView={view} onViewChange={setView} onLogout={handleLogout} />

      <main className="flex-1 flex overflow-hidden relative z-10">
        <AnimatePresence mode="wait">
          {view === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full h-full"
            >
              <HomeView onNavigate={openWorkspace} currentUser={currentUser} />
            </motion.div>
          ) : view === 'assets' ? (
            <motion.div
              key="assets"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full h-full"
            >
              <AssetsView />
            </motion.div>
          ) : view === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full h-full"
            >
              <UsersView />
            </motion.div>
          ) : view === 'usage' ? (
            <motion.div
              key="usage"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full h-full"
            >
              <UsageView />
            </motion.div>
          ) : view === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full h-full"
            >
              <ModelSettingsView />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full h-full"
            >
              <WorkspaceView initialPrompt={initialPrompt} projectId={workspaceProjectId} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-0 px-10" 
           style={{ backgroundImage: 'radial-gradient(circle, white 0.5px, transparent 0.5px)', backgroundSize: '40px 40px' }} />
    </div>
  );
}
