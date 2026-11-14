import React, { useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Film,
  Download,
  Eye,
  X,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VideoJobStatus } from '../types';

interface ProcessingModalProps {
  job: VideoJobStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onViewResult: (resultUrl: string) => void;
}

export const ProcessingProgressModal: React.FC<ProcessingModalProps> = ({
  job,
  isOpen,
  onClose,
  onViewResult,
}) => {
  if (!isOpen || !job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  useEffect(() => {
    if (isCompleted) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [isCompleted]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#12141e] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                isCompleted
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : isFailed
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : isFailed ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isCompleted
                  ? 'Restoration Complete!'
                  : isFailed
                  ? 'Processing Failed'
                  : 'AI Temporal Inpainting in Progress'}
              </h3>
              <p className="text-xs text-slate-400">
                {isCompleted
                  ? 'Media cleaned with full audio preservation'
                  : isFailed
                  ? job.error_message || 'An error occurred'
                  : `Processing frame ${job.current_frame} of ${job.total_frames}`}
              </p>
            </div>
          </div>

          {(isCompleted || isFailed) && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Live Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span className="font-medium text-slate-400">Overall Progress</span>
            <span className="font-mono font-bold text-purple-400">{Math.round(job.progress)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/5 border border-white/5 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.max(5, job.progress)}%` }}
            />
          </div>
        </div>

        {/* Real-time stats grid */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] text-slate-500">Processed Frames</p>
            <p className="mt-1 font-mono text-sm font-semibold text-white">
              {job.current_frame} <span className="text-slate-500 text-xs">/ {job.total_frames}</span>
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] text-slate-500">Processing Rate</p>
            <p className="mt-1 font-mono text-sm font-semibold text-purple-300">
              {job.fps} <span className="text-slate-500 text-xs">FPS</span>
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] text-slate-500">Est. Time Remaining</p>
            <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">
              {isCompleted ? '0s' : `${job.eta_seconds}s`}
            </p>
          </div>
        </div>

        {/* Audio preservation notice */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 p-2.5 text-xs text-slate-400">
          <Volume2 className="h-4 w-4 text-purple-400 shrink-0" />
          <span>Original sound track & timing synchronized with FFmpeg</span>
        </div>

        {/* Actions once completed */}
        {isCompleted && job.result_url && (
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => onViewResult(job.result_url!)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all"
            >
              <Eye className="h-4 w-4" />
              <span>Preview Video</span>
            </button>
            <a
              href={job.result_url}
              download="cleaned_video.mp4"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:scale-105 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Download MP4</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
