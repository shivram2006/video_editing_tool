import React from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Layers,
  History,
  CreditCard,
  Settings,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  user,
  onOpenAuth,
}) => {
  const navItems = [
    { id: 'landing', label: 'Overview', icon: Sparkles },
    { id: 'image-cleaner', label: 'Image Studio', icon: ImageIcon },
    { id: 'video-cleaner', label: 'Video Studio', icon: Video },
    { id: 'workspace', label: 'Workspace', icon: Layers },
    { id: 'history', label: 'History', icon: History },
    { id: 'pricing', label: 'Pricing', icon: CreditCard },
    { id: 'dashboard', label: 'Dashboard', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#08090d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('landing')}
          className="group flex cursor-pointer items-center gap-3 transition-transform hover:scale-105"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 shadow-lg shadow-purple-500/25 ring-1 ring-white/20">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">CleanFrame</span>
              <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300 ring-1 ring-purple-500/30">
                AI 2.0
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-400">Media Inpainting Suite</p>
          </div>
        </div>

        {/* Central Nav Links */}
        <nav className="hidden lg:flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] p-1 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Action Bar */}
        <div className="flex items-center gap-3">
          {/* Ethical Shield Tooltip */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Ethical Rights Guard</span>
          </div>

          {/* Credits Balance */}
          {user && (
            <div
              onClick={() => onNavigate('pricing')}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 transition-all hover:bg-purple-500/20 hover:border-purple-500/50"
            >
              <Zap className="h-3.5 w-3.5 fill-purple-400 text-purple-400" />
              <span>{user.credits_remaining} credits</span>
            </div>
          )}

          {/* User Button */}
          {user?.is_authenticated ? (
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 pr-3 text-xs font-medium text-slate-200 transition-all hover:border-white/20 hover:bg-white/10"
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20"
              />
              <span className="hidden sm:inline font-medium">{user.name.split(' ')[0]}</span>
              <span className="rounded bg-indigo-500/20 px-1 py-0.5 text-[9px] font-semibold text-indigo-300">
                {user.plan}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-purple-500/20 transition-all hover:opacity-95 hover:scale-105 active:scale-95"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="lg:hidden flex overflow-x-auto border-t border-white/5 bg-[#0a0b10] px-4 py-2 gap-2 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                isActive ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
