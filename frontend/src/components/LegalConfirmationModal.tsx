import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mediaName?: string;
}

export const LegalConfirmationModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mediaName,
}) => {
  const [ownsContent, setOwnsContent] = useState(false);
  const [noInfringement, setNoInfringement] = useState(false);

  if (!isOpen) return null;

  const canProceed = ownsContent && noInfringement;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#12141e] p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Content Rights & Authorization</h3>
            <p className="text-xs text-slate-400">Legal confirmation required prior to processing</p>
          </div>
        </div>

        {/* Informative Alert */}
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold">Notice on Authorized Media Restoration</p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                CleanFrame AI is designed strictly for creators, editors, and studios to clean overlays from their own media or content they hold explicit licensing or authorized rights to edit.
              </p>
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-300 cursor-pointer hover:bg-white/[0.04] transition-all">
            <input
              type="checkbox"
              checked={ownsContent}
              onChange={(e) => setOwnsContent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-purple-600 cursor-pointer"
            />
            <span>
              I certify that <strong>I own the copyright or have express authorized permission</strong> from the owner to modify and reconstruct {mediaName ? `"${mediaName}"` : 'this media'}.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-300 cursor-pointer hover:bg-white/[0.04] transition-all">
            <input
              type="checkbox"
              checked={noInfringement}
              onChange={(e) => setNoInfringement(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-purple-600 cursor-pointer"
            />
            <span>
              I agree not to use this software to remove copyright notices, watermarks from unauthorized third-party works, or circumvent licensing restrictions.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            disabled={!canProceed}
            onClick={() => {
              if (canProceed) onConfirm();
            }}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold transition-all ${
              canProceed
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Confirm & Proceed</span>
          </button>
        </div>
      </div>
    </div>
  );
};
