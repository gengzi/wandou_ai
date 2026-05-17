import React from 'react';
import { FolderClosed, Home, LogOut, PenTool, Settings, Users, WalletCards } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from '../lib/i18n';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentView, onViewChange, onLogout }: SidebarProps) {
  const { t } = useI18n();
  const items = [
    { id: 'home', icon: Home, label: t('nav.home') },
    { id: 'workspace', icon: PenTool, label: t('nav.workspace'), badge: t('badge.pro') },
    { id: 'assets', icon: FolderClosed, label: t('nav.assets') },
    { id: 'usage', icon: WalletCards, label: t('nav.usage') },
    { id: 'users', icon: Users, label: t('nav.users') },
  ];

  return (
    <div className="wandou-app-sidebar w-16 h-full flex flex-col items-center justify-between py-6 bg-[#0B0B0C] z-20 shrink-0">
      <div className="flex flex-col items-center space-y-6">
        <button
          type="button"
          onClick={() => onViewChange('home')}
          className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center mb-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          aria-label={t('nav.backHome')}
          title={t('nav.backHome')}
        >
          <span className="text-white font-black text-2xl tracking-tighter italic">W</span>
        </button>
        
        {items.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewChange(item.id)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer relative group transition-all duration-300 ${
              currentView === item.id 
                ? 'bg-[#1A1A1C] text-brand border border-white/5' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={item.label}
            aria-label={item.label}
          >
            <item.icon size={20} strokeWidth={1.5} />
            {item.badge && (
              <div className="absolute -top-1 -right-2 px-1 h-3.5 bg-brand rounded-full border border-[#0B0B0C] flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                {item.badge}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col items-center space-y-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onViewChange('settings')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer transition-colors bg-[#1A1A1C] border border-white/5"
          title={t('nav.settings')}
          aria-label={t('nav.settings')}
        >
          <Settings size={18} strokeWidth={1.5} />
        </motion.div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLogout}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-200 cursor-pointer transition-colors bg-[#1A1A1C] border border-white/5 hover:border-red-500/30 hover:bg-red-500/10"
          title={t('nav.logout')}
          aria-label={t('nav.logout')}
        >
          <LogOut size={18} strokeWidth={1.5} />
        </motion.button>
      </div>
    </div>
  );
}
