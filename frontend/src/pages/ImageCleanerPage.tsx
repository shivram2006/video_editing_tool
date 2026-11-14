import React, { useState } from 'react';
import {
  Upload,
  Sparkles,
  Wand2,
  Download,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileImage,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { CanvasEditor } from '../components/CanvasEditor';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { LegalConfirmationModal } from '../components/LegalConfirmationModal';
import { BoundingBox, DetectionResult, ImageProcessResponse } from '../types';
import { api } from '../services/api';

interface ImageCleanerProps {
  onJobCompleted?: (result: ImageProcessResponse) => void;
  preloadedMediaId?: string;
  preloadedUrl?: string;
}

export const ImageCleanerPage: React.FC<ImageCleanerProps> = ({
  onJobCompleted,
  preloadedMediaId,
  preloadedUrl,
}) => {
  const [mediaId, setMediaId] = useState<string | null>(preloadedMediaId || null);
  const [imageUrl, setImageUrl] = useState<string | null>(preloadedUrl || null);
  const [filename, setFilename] = useState<string>('Uploaded Image');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Masks and Boxes
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [maskBase64, setMaskBase64] = useState<string | null>(null);

  // Settings
  const [method, setMethod] = useState<string>('hybrid_texture');
  const [dilationPx, setDilationPx] = useState<number>(4);
  const [featherPx, setFeatherPx] = useState<number>(2);
  const [exportScale, setExportScale] = useState<number>(1.0);

  // Result
  const [processResult, setProcessResult] = useState<ImageProcessResponse | null>(null);
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload handler
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMsg(null);
    setProcessResult(null);
    setBoxes([]);
    try {
      const data = await api.uploadImage(file);
      setMediaId(data.media_id);
      setImageUrl(data.url);
      setFilename(data.original_name);
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const loadSample = async (samplePath: string, name: string) => {
    setIsUploading(true);
    setErrorMsg(null);
    setProcessResult(null);
    setBoxes([]);
    try {
      // Fetch sample blob and upload
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const file = new File([blob], name, { type: 'image/jpeg' });
      await handleFileUpload(file);
    } catch (err: any) {
      setErrorMsg('Failed to load sample');
      setIsUploading(false);
    }
  };

  // Run AI overlay detection
  const handleDetect = async () => {
    if (!mediaId) return;
    setIsDetecting(true);
    setErrorMsg(null);
    try {
      const result: DetectionResult = await api.detectImageWatermarks(mediaId);
      setBoxes(result.detected_boxes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Detection failed');
    } finally {
      setIsDetecting(false);
    }
  };

  // Trigger processing
  const handleStartInpaint = () => {
    if (!mediaId) return;
    setShowLegalModal(true);
  };

  const executeInpaint = async () => {
    setShowLegalModal(false);
    if (!mediaId) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await api.inpaintImage({
        media_id: mediaId,
        mask_data: maskBase64 || undefined,
        boxes: boxes.length > 0 ? boxes : undefined,
        method,
        dilation_px: dilationPx,
        feather_px: featherPx,
        export_scale: exportScale,
        confirm_rights: true,
      });

      setProcessResult(result);
      if (onJobCompleted) onJobCompleted(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Inpainting failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
              Studio
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Image Watermark Cleaner</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Intelligently inpaint and reconstruct backgrounds beneath usernames, handles, and logos.
          </p>
        </div>

        {/* Preset Sample Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSample('/api/uploads/sample_instagram_reel.jpg', 'sample_instagram_reel.jpg')}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-all"
          >
            Load Instagram Reel Sample
          </button>
          <button
            onClick={() => loadSample('/api/uploads/sample_architecture_timestamp.jpg', 'sample_architecture_timestamp.jpg')}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-all"
          >
            Load Timestamp Sample
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty Upload State */}
      {!imageUrl ? (
        <div className="mt-12 flex flex-col items-center justify-center">
          <label className="group relative flex h-80 w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-[#12141e]/50 p-6 text-center transition-all hover:border-purple-500/50 hover:bg-[#12141e]/80">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Upload className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              {isUploading ? 'Uploading Image...' : 'Drop image here or click to browse'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Supports high-resolution JPG, JPEG, PNG, WEBP (up to 30MB)
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Media is processed securely with authorized rights protection</span>
            </div>
          </label>
        </div>
      ) : (
        /* Active Image Studio Interface */
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Workspace (Left 3 columns) */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {processResult ? (
              /* Before / After Comparison Screen */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold text-sm">Background Reconstructed Successfully!</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setProcessResult(null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-all"
                    >
                      Back to Editor
                    </button>
                    <a
                      href={processResult.cleaned_url}
                      download={`cleaned_${filename}`}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:scale-105 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Cleaned Image</span>
                    </a>
                  </div>
                </div>

                <BeforeAfterSlider
                  originalUrl={imageUrl}
                  cleanedUrl={processResult.cleaned_url}
                  originalLabel="Original with Overlay"
                  cleanedLabel="CleanFrame AI Inpainted"
                />
              </div>
            ) : (
              /* Interactive Canvas Studio */
              <CanvasEditor
                imageUrl={imageUrl}
                detectedBoxes={boxes}
                onBoxesChange={setBoxes}
                onMaskChange={setMaskBase64}
              />
            )}
          </div>

          {/* Right Parameters Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            {/* Action Bar */}
            <div className="rounded-2xl border border-white/10 bg-[#12141e]/90 p-5 shadow-xl backdrop-blur-md">
              <h3 className="text-sm font-bold text-white mb-3">AI Detection & Actions</h3>

              {/* One-click Auto Detect */}
              <button
                disabled={isDetecting || isProcessing}
                onClick={handleDetect}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 py-2.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all disabled:opacity-50"
              >
                <Wand2 className={`h-4 w-4 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Detecting Overlays...' : 'Auto-Detect Overlays'}</span>
              </button>

              {/* Start Inpainting CTA */}
              <button
                disabled={isProcessing || isDetecting}
                onClick={handleStartInpaint}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Sparkles className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>{isProcessing ? 'Reconstructing...' : 'Restore Background'}</span>
              </button>

              <button
                onClick={() => {
                  setImageUrl(null);
                  setMediaId(null);
                  setProcessResult(null);
                  setBoxes([]);
                }}
                className="mt-2 w-full text-center text-[11px] text-slate-500 hover:text-slate-300 py-1"
              >
                Upload different image
              </button>
            </div>

            {/* Inpainting Engine Controls */}
            <div className="rounded-2xl border border-white/10 bg-[#12141e]/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold text-white mb-4">
                <Sliders className="h-4 w-4 text-purple-400" />
                <span>Inpainting Algorithm</span>
              </div>

              {/* Method radio buttons */}
              <div className="space-y-2 text-xs">
                {[
                  { id: 'hybrid_texture', name: 'Hybrid AI Texture Synthesis', desc: 'Reconstructs high-frequency grain & seamless Poisson gradients' },
                  { id: 'telea', name: 'Fast Marching (Telea)', desc: 'Smooth structural contour propagation' },
                  { id: 'navier_stokes', name: 'Navier-Stokes PDE', desc: 'Fluid isophote matching for smooth gradients' },
                ].map((m) => (
                  <label
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`block cursor-pointer rounded-xl border p-2.5 transition-all ${
                      method === m.id
                        ? 'border-purple-500 bg-purple-500/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px]">{m.name}</span>
                      {method === m.id && <Check className="h-3 w-3 text-purple-400" />}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 leading-snug">{m.desc}</p>
                  </label>
                ))}
              </div>

              {/* Sliders */}
              <div className="mt-5 space-y-4 pt-4 border-t border-white/5">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span className="text-slate-400">Mask Dilation:</span>
                    <span className="font-mono text-purple-400">{dilationPx}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={dilationPx}
                    onChange={(e) => setDilationPx(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Expands perimeter to fully enclose font anti-aliasing.</p>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span className="text-slate-400">Edge Feathering:</span>
                    <span className="font-mono text-purple-400">{featherPx}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    value={featherPx}
                    onChange={(e) => setFeatherPx(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Soft alpha transition along borders.</p>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span className="text-slate-400">Export Resolution:</span>
                    <span className="font-mono text-purple-400">{exportScale === 1.0 ? 'Original (1x)' : `${exportScale}x Scale`}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {[0.5, 1.0, 2.0, 4.0].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setExportScale(s)}
                        className={`rounded-lg py-1 text-center font-mono text-[11px] font-semibold transition-all ${
                          exportScale === s
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legal Confirmation Dialog */}
      <LegalConfirmationModal
        isOpen={showLegalModal}
        mediaName={filename}
        onClose={() => setShowLegalModal(false)}
        onConfirm={executeInpaint}
      />
    </div>
  );
};
