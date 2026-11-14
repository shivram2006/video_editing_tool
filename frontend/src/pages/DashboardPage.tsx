import React from 'react';
import {
  User,
  Zap,
  Sparkles,
  Image as ImageIcon,
  Video,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Download,
  CreditCard,
} from 'lucide-react';
import { UserProfile, HistoryItem } from '../types';

interface DashboardProps {
  user: UserProfile | null;
  history: HistoryItem[];
  onNavigate: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({
  user,
  history,
  onNavigate,
}) => {
  if (!user) return null;

  const creditsPercent = Math.round((user.credits_remaining / user.credits_total) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* User Header Profile Card */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-purple-950/40 via-[#12141e] to-[#0a0b12] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <img
              src={user.avatar}
              alt={user.name}
              className="h-20 w-20 rounded-2xl object-cover ring-2 ring-purple-500/30 shadow-xl"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300 border border-purple-500/30">
                  {user.plan} Tier
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{user.email}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified Creator • Content Rights Authorized</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('pricing')}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:bg-purple-500 transition-all"
            >
              <CreditCard className="h-4 w-4" />
              <span>Manage Subscription</span>
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-all"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Credits Metric Card */}
        <div className="rounded-2xl border border-white/10 bg-[#12141e]/80 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Remaining Credits</span>
            <Zap className="h-4 w-4 text-purple-400 fill-purple-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-white">
            {user.credits_remaining}{' '}
            <span className="text-xs font-normal text-slate-500">/ {user.credits_total}</span>
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
              style={{ width: `${creditsPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Renews on the 1st of next month</p>
        </div>

        {/* Media Processed Card */}
        <div className="rounded-2xl border border-white/10 bg-[#12141e]/80 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Media Cleaned</span>
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-white">
            {history.length + 18}
          </p>
          <p className="mt-3 text-xs text-cyan-400 flex items-center gap-1 font-semibold">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+24% from last month</span>
          </p>
          <p className="mt-2 text-[10px] text-slate-500">100% background reconstruction</p>
        </div>

        {/* Time Saved Card */}
        <div className="rounded-2xl border border-white/10 bg-[#12141e]/80 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Manual Editing Saved</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-white">
            14.2 <span className="text-xs font-normal text-slate-500">Hours</span>
          </p>
          <p className="mt-3 text-xs text-slate-400 leading-snug">
            Avg. 1.2s per image, 8s per video
          </p>
          <p className="mt-2 text-[10px] text-slate-500">Estimated manual cloning time</p>
        </div>

        {/* Restoration Accuracy */}
        <div className="rounded-2xl border border-white/10 bg-[#12141e]/80 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Texture Fidelity</span>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-purple-300">
            99.4%
          </p>
          <p className="mt-3 text-xs text-purple-400 font-semibold">
            Zero boundary haloing
          </p>
          <p className="mt-2 text-[10px] text-slate-500">Multi-pass Poisson solver</p>
        </div>
      </div>

      {/* Quick Launch Studios Banner */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div
          onClick={() => onNavigate('image-cleaner')}
          className="group cursor-pointer rounded-3xl border border-white/10 bg-gradient-to-r from-purple-900/30 to-indigo-900/20 p-6 backdrop-blur-md transition-all hover:border-purple-500/40 hover:scale-[1.01]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Image Inpainting Studio</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Remove Instagram handles, watermarks, and logos from photos.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
            <span>Launch Image Studio</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('video-cleaner')}
          className="group cursor-pointer rounded-3xl border border-white/10 bg-gradient-to-r from-blue-900/30 to-purple-900/20 p-6 backdrop-blur-md transition-all hover:border-blue-500/40 hover:scale-[1.01]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Video Inpainting Studio</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Temporal consistency, optical flow tracking & audio sync.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
            <span>Launch Video Studio</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="mt-10 rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Recent Media Restorations</h3>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No restorations yet. Launch Image Studio or Video Studio to clean your media!
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-300 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center gap-3">
                  {item.media_type === 'video' ? (
                    <Video className="h-4 w-4 text-purple-400" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-blue-400" />
                  )}
                  <span className="font-semibold text-white">{item.filename}</span>
                  <span className="text-slate-500 text-[10px]">• {item.algorithm_used}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] text-slate-400">{item.created_at}</span>
                  {item.result_url && (
                    <a
                      href={item.result_url}
                      download
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
