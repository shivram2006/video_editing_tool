import React from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  Zap,
  ArrowRight,
  Layers,
  Wand2,
  Sliders,
  CheckCircle2,
  FileCheck,
  Lock,
  Cpu,
} from 'lucide-react';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { SampleMedia } from '../types';

interface LandingPageProps {
  onNavigate: (page: string) => void;
  onSelectSample: (sample: SampleMedia) => void;
  samples: SampleMedia[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onSelectSample,
  samples,
}) => {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      <section className="relative w-full max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 text-center">
        {/* Glow ambient background lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-blue-600/15 blur-[100px] pointer-events-none" />

        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 shadow-lg shadow-purple-500/10 mb-8 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>Next-Generation Neural Inpainting 2.0</span>
          <span className="text-white/30">•</span>
          <span className="text-slate-300">Image & Video Watermark Cleaner</span>
        </div>

        {/* Hero Title */}
        <h1 className="mx-auto max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
          Erase Distractions.{' '}
          <span className="gradient-text">
            Reconstruct Perfection.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed">
          Clean unwanted Instagram handles, Reels watermarks, date stamps, and platform overlays from your media. Powered by true background reconstruction, not blur or crop.
        </p>

        {/* Call to Actions */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onNavigate('image-cleaner')}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-500/25 transition-all hover:scale-105 active:scale-95"
          >
            <ImageIcon className="h-4 w-4" />
            <span>Launch Image Studio</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </button>

          <button
            onClick={() => onNavigate('video-cleaner')}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
          >
            <Video className="h-4 w-4 text-purple-400" />
            <span>Launch Video Studio</span>
          </button>
        </div>

        {/* Interactive Before/After Showcase */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-2 shadow-2xl backdrop-blur-xl">
            <BeforeAfterSlider
              originalUrl="/api/uploads/sample_instagram_reel.jpg"
              cleanedUrl="/api/uploads/sample_instagram_reel.jpg"
              originalLabel="Original with @nature_explorer & REELS watermark"
              cleanedLabel="CleanFrame AI Reconstructed Background"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Drag the slider to inspect intelligent texture synthesis and seamless Poisson blending.
          </p>
        </div>

        {/* Sample Media Quick Launch Cards */}
        {samples.length > 0 && (
          <div className="mt-16">
            <div className="text-center mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Instant Test</span>
              <h3 className="text-xl font-bold text-white mt-1">Try One-Click Demo Samples</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {samples.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectSample(sample)}
                  className="group cursor-pointer rounded-2xl border border-white/10 bg-[#12141e]/80 p-4 text-left transition-all hover:border-purple-500/40 hover:bg-[#181a28] hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                      {sample.type}
                    </span>
                    <Sparkles className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h4 className="mt-3 font-semibold text-white text-sm group-hover:text-purple-300 transition-colors">
                    {sample.name}
                  </h4>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                    {sample.description}
                  </p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
                    <span>Load in Studio</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Feature Pillars Grid */}
      <section className="w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Engineering Highlights</span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Built for Pristine Media Restoration
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            True neural inpainting replaces intrusive overlays by reconstructing the natural textures, gradients, and lighting of the background scene.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-white/10 bg-[#12141e]/60 p-6 backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-5">
              <Wand2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">AI Overlay Auto-Detection</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Detects Instagram handles, Reels logos, timestamps, and typography with high precision edge connectivity and layout prior heuristics.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-white/10 bg-[#12141e]/60 p-6 backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-5">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Video Temporal Coherence</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Eliminates flicker across video frames. Background revealed in adjacent frames is warped and synthesized into the watermark region.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-white/10 bg-[#12141e]/60 p-6 backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-5">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Audio & Quality Preservation</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Powered by FFmpeg, the original audio tracks, sample rates, channels, and framerates are maintained with zero loss or sync drift.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Ethical Safeguards */}
      <section className="w-full max-w-5xl px-4 py-16 sm:px-6 mb-12">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-8 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Ethical & Authorized Media Policy</h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                CleanFrame AI operates under strict ethical guidelines. We provide content restoration exclusively for creators who own the media or hold authorized rights. Content ownership confirmation is verified prior to all processing tasks.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
