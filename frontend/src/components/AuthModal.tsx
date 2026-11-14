import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  Mail,
  User,
  ArrowRight,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('creator@cleanframe.ai');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const user = await api.login('alex.sterling@creative-studio.io', 'demo1234');
      onSuccess(user);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#12141e] p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/25">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">
            {mode === 'login' ? 'Welcome back to CleanFrame' : 'Create your CleanFrame account'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {mode === 'login'
              ? 'Access your saved media restorations and high-res exports'
              : 'Start inpainting unwanted overlays with 25 free credits'}
          </p>
        </div>

        {/* One-click Demo Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/60 transition-all shadow-md"
          >
            <Zap className="h-4 w-4 fill-purple-400" />
            <span>1-Click Instant Demo Login</span>
          </button>
        </div>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5" />
          </div>
          <span className="relative bg-[#12141e] px-3 text-[10px] uppercase font-semibold text-slate-500">
            or continue with email
          </span>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-300">Email Address</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@studio.com"
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-300">Password</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <span>{mode === 'login' ? 'Sign In to Studio' : 'Create Free Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                onClick={() => setMode('register')}
                className="font-semibold text-purple-400 hover:text-purple-300"
              >
                Sign up free
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="font-semibold text-purple-400 hover:text-purple-300"
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
