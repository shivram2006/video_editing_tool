import React, { useEffect, useState } from 'react';
import {
  Layers,
  Cpu,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Server,
  Film,
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { HistoryItem } from '../types';

interface WorkspaceProps {
  onNavigate: (page: string) => void;
}

export const WorkspacePage: React.FC<WorkspaceProps> = ({ onNavigate }) => {
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [health, history] = await Promise.all([
        api.getSystemHealth(),
        api.getHistory(),
      ]);
      setSystemHealth(health);
      setHistoryItems(history);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const completedCount = historyItems.filter((i) => i.status === 'completed').length;
  const processingCount = historyItems.filter((i) => i.status === 'processing').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
              Operations
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Processing Workspace</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time telemetry, active inpainting pipeline status, and worker health.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Visual Inpainting Pipeline Architecture Banner */}
      <div className="mt-8 rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-2xl backdrop-blur-md">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-purple-400" />
          <span>Neural Inpainting Pipeline Architecture</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { step: '1', title: 'Media Ingest', desc: 'Format check & resolution scaling' },
            { step: '2', title: 'Overlay Detector', desc: 'Edge gradients & canonical priors' },
            { step: '3', title: 'Mask Refinement', desc: 'Dilation & feathered borders' },
            { step: '4', title: 'Neural Inpainter', desc: 'Texture synthesis & Poisson solve' },
            { step: '5', title: 'FFmpeg Mux', desc: 'Audio preservation & MP4 export' },
          ].map((s, idx) => (
            <div
              key={s.step}
              className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-center hover:bg-white/[0.04] transition-all"
            >
              <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-purple-600/20 text-xs font-bold text-purple-300 border border-purple-500/30 mb-2">
                {s.step}
              </div>
              <h4 className="font-semibold text-xs text-white">{s.title}</h4>
              <p className="mt-1 text-[10px] text-slate-400">{s.desc}</p>
              {idx < 4 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Server & Engine Telemetry */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#12141e]/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>FastAPI Server</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="mt-2 text-xl font-bold text-white">{systemHealth?.status || 'Online'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Version {systemHealth?.version || '2.1.0'}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#12141e]/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Computer Vision</span>
            <Cpu className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-purple-300">OpenCV {systemHealth?.opencv_version || '5.0'}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Telea + Navier-Stokes PDE</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#12141e]/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Video & Audio Muxer</span>
            <Film className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-cyan-300">
            {systemHealth?.ffmpeg_available ? 'FFmpeg 9.0' : 'OpenCV Fallback'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Zero-loss AAC audio muxing</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#12141e]/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Queue Jobs</span>
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-white">{completedCount} Completed</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{processingCount} Active in queue</p>
        </div>
      </div>

      {/* Active Pipeline Jobs Table */}
      <div className="mt-8 rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Recent Pipeline Processing Jobs</h3>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <span>View Full History</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {historyItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No active jobs. Upload an image or video to begin background inpainting.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-3 font-semibold">Media File</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Algorithm</th>
                  <th className="pb-3 font-semibold">Resolution</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {historyItems.slice(0, 8).map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-medium text-white flex items-center gap-2">
                      {item.media_type === 'video' ? (
                        <Film className="h-4 w-4 text-purple-400 shrink-0" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[200px]">{item.filename}</span>
                    </td>
                    <td className="py-3 uppercase text-[10px] text-slate-400">{item.media_type}</td>
                    <td className="py-3 text-[11px] text-purple-300">{item.algorithm_used}</td>
                    <td className="py-3 font-mono text-[11px] text-slate-400">{item.resolution || 'Original'}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : item.status === 'processing'
                            ? 'bg-purple-500/20 text-purple-300 animate-pulse'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {item.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {item.result_url && (
                        <a
                          href={item.result_url}
                          download
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10 transition-all"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
