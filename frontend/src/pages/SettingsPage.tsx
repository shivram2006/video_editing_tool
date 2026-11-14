import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  ShieldCheck,
  Cpu,
  Key,
  Trash2,
  CheckCircle2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [defaultMethod, setDefaultMethod] = useState<string>('hybrid_texture');
  const [sensitivity, setSensitivity] = useState<string>('medium');
  const [temporalFactor, setTemporalFactor] = useState<number>(0.65);
  const [autoFeather, setAutoFeather] = useState<boolean>(true);
  const [preserveAudioDefault, setPreserveAudioDefault] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>('sk_live_cleanframe_production_demo_key');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleClearCache = async () => {
    if (confirm('Clear temporary processed media cache?')) {
      await api.clearHistory();
      alert('Media cache cleaned successfully.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="pb-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
            Preferences
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Application Settings</h1>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Configure AI inpainting engines, auto-detection thresholds, audio codecs, and API keys.
        </p>
      </div>

      {savedSuccess && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Inpainting Engine Defaults */}
        <div className="rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-xl backdrop-blur-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-purple-400" />
            <span>AI Inpainting & Reconstruction</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-300">Default Image Inpainting Method</label>
              <select
                value={defaultMethod}
                onChange={(e) => setDefaultMethod(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="hybrid_texture">Hybrid AI Texture Synthesis (Recommended)</option>
                <option value="telea">Fast Marching Method (Telea)</option>
                <option value="navier_stokes">Navier-Stokes Partial Differential Equation</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Hybrid AI uses context-aware texture injection to reconstruct natural film grain and surface texture.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Video Temporal Blending Factor (EMA):</span>
                <span className="font-mono text-purple-400">{Math.round(temporalFactor * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.9"
                step="0.05"
                value={temporalFactor}
                onChange={(e) => setTemporalFactor(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Controls anti-flicker smoothness between consecutive video frames.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div>
                <span className="font-semibold text-slate-200">Auto Edge Feathering</span>
                <p className="text-[10px] text-slate-500">Smooth distance transform boundary interpolation</p>
              </div>
              <input
                type="checkbox"
                checked={autoFeather}
                onChange={(e) => setAutoFeather(e.target.checked)}
                className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Audio & Media Export */}
        <div className="rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-xl backdrop-blur-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Volume2 className="h-4 w-4 text-cyan-400" />
            <span>Audio & Export Format</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Preserve Audio Tracks by Default</span>
                <p className="text-[10px] text-slate-500">Muxes original AAC / MP3 streams with zero re-encoding loss</p>
              </div>
              <input
                type="checkbox"
                checked={preserveAudioDefault}
                onChange={(e) => setPreserveAudioDefault(e.target.checked)}
                className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300">Detection Sensitivity</label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="high">High Sensitivity (Picks up faint / semi-transparent watermarks)</option>
                <option value="medium">Balanced (Standard social media overlays)</option>
                <option value="low">Conservative (Only solid text and high contrast logos)</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Keys & External Integrations */}
        <div className="rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-xl backdrop-blur-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-indigo-400" />
            <span>API & SDK Credentials</span>
          </h3>

          <div className="text-xs space-y-2">
            <label className="font-semibold text-slate-300">REST API Bearer Token</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-xs text-purple-300 focus:border-purple-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">
              Use this key to authorize automated batch jobs through the Python SDK or CLI.
            </p>
          </div>
        </div>

        {/* Data Maintenance */}
        <div className="rounded-3xl border border-white/10 bg-[#12141e]/90 p-6 shadow-xl backdrop-blur-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Trash2 className="h-4 w-4 text-rose-400" />
            <span>Data Maintenance</span>
          </h3>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-200">Clear Temporary Media Cache</span>
              <p className="text-[10px] text-slate-500">Deletes temporary frame buffers and past previews</p>
            </div>
            <button
              onClick={handleClearCache}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-all"
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95 transition-all"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
