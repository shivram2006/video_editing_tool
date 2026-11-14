import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Eye, Download, Maximize2 } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalUrl: string;
  cleanedUrl: string;
  originalLabel?: string;
  cleanedLabel?: string;
  className?: string;
  onDownload?: () => void;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalUrl,
  cleanedUrl,
  originalLabel = 'Original Overlay',
  cleanedLabel = 'AI Reconstructed',
  className = '',
  onDownload,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Viewer Container */}
      <div
        ref={containerRef}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onTouchMove={handleTouchMove}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f17] shadow-2xl cursor-ew-resize max-h-[70vh] flex items-center justify-center"
      >
        {/* Cleaned Image (Bottom/Right layer) */}
        <img
          src={cleanedUrl}
          alt="AI Reconstructed Clean"
          className="block max-h-[70vh] w-auto max-w-full object-contain pointer-events-none"
        />

        {/* Original Image (Top/Left clipped layer) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={originalUrl}
            alt="Original Overlay"
            className="absolute top-0 left-0 max-h-[70vh] w-auto max-w-none h-full object-contain pointer-events-none"
            style={{
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Vertical Divider Line */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-gradient-to-b from-purple-400 via-white to-blue-400 shadow-[0_0_12px_rgba(255,255,255,0.8)] pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Draggable Circle Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900/90 shadow-xl backdrop-blur-md transition-transform hover:scale-110">
            <div className="flex items-center gap-1">
              <div className="h-2 w-0.5 rounded-full bg-purple-400" />
              <div className="h-2.5 w-0.5 rounded-full bg-white" />
              <div className="h-2 w-0.5 rounded-full bg-blue-400" />
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-rose-300 backdrop-blur-md border border-rose-500/20">
          <ImageIcon className="h-3.5 w-3.5" />
          <span>{originalLabel}</span>
        </div>

        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-full bg-purple-950/70 px-3 py-1 text-xs font-semibold text-purple-200 backdrop-blur-md border border-purple-500/30">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>{cleanedLabel}</span>
        </div>
      </div>

      {/* Slider Controls Bar */}
      <div className="mt-4 flex w-full max-w-xl items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-400">
        <button
          onClick={() => setSliderPosition(0)}
          className="rounded-lg px-2.5 py-1 font-medium hover:bg-white/5 hover:text-white transition-all"
        >
          100% Cleaned
        </button>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-[11px] text-slate-500">Compare</span>
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="text-[11px] font-mono text-purple-400 w-8">{Math.round(sliderPosition)}%</span>
        </div>
        <button
          onClick={() => setSliderPosition(100)}
          className="rounded-lg px-2.5 py-1 font-medium hover:bg-white/5 hover:text-white transition-all"
        >
          100% Original
        </button>
      </div>
    </div>
  );
};
