import React, { useState, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Scissors, Type, Trash2 } from 'lucide-react';
import { VideoMetadata, BoundingBox, CutRange, TextOverlay } from '../types';

interface VideoTimelineScrubberProps {
  metadata: VideoMetadata;
  currentTime: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onSeek: (time: number) => void;
  boxes?: BoundingBox[];
  selectedBoxId?: string | null;
  onSelectBox?: (id: string) => void;
  cutRanges?: CutRange[];
  selectedCutId?: string | null;
  onSelectCut?: (id: string) => void;
  onUpdateCut?: (id: string, startTime: number, endTime: number) => void;
  cutStartMark?: number | null;
  textOverlays?: TextOverlay[];
  selectedTextId?: string | null;
  onSelectText?: (id: string) => void;
}

export const VideoTimelineScrubber: React.FC<VideoTimelineScrubberProps> = ({
  metadata,
  currentTime,
  isPlaying,
  onPlayToggle,
  onSeek,
  boxes,
  selectedBoxId,
  onSelectBox,
  cutRanges,
  selectedCutId,
  onSelectCut,
  onUpdateCut,
  cutStartMark,
  textOverlays,
  selectedTextId,
  onSelectText,
}) => {
  const scrubberBarRef = useRef<HTMLDivElement>(null);

  // Cut drag state: 'start' handle, 'end' handle, or 'move' whole cut
  const [cutDrag, setCutDrag] = useState<{
    cutId: string;
    type: 'start' | 'end' | 'move';
    initialStart: number;
    initialEnd: number;
    startX: number;
  } | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const fps = metadata.fps > 0 ? metadata.fps : 30;
  const frameDuration = 1 / fps;
  const progressPercent = metadata.duration_sec > 0 ? (currentTime / metadata.duration_sec) * 100 : 0;

  // Handle cut edge/body dragging
  const handleCutHandlePointerDown = (
    e: React.PointerEvent,
    cut: CutRange,
    type: 'start' | 'end' | 'move'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (onSelectCut) onSelectCut(cut.id);

    setCutDrag({
      cutId: cut.id,
      type,
      initialStart: cut.start_time,
      initialEnd: cut.end_time,
      startX: e.clientX,
    });

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleCutHandlePointerMove = (e: React.PointerEvent) => {
    if (!cutDrag || !scrubberBarRef.current || !metadata.duration_sec) return;
    const rect = scrubberBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const deltaX = e.clientX - cutDrag.startX;
    const deltaSec = (deltaX / rect.width) * metadata.duration_sec;

    if (cutDrag.type === 'start') {
      const newStart = Math.max(0, Math.min(cutDrag.initialEnd - 0.1, cutDrag.initialStart + deltaSec));
      const rounded = Math.round(newStart * 10) / 10;
      if (onUpdateCut) onUpdateCut(cutDrag.cutId, rounded, cutDrag.initialEnd);
      onSeek(rounded);
    } else if (cutDrag.type === 'end') {
      const newEnd = Math.min(
        metadata.duration_sec,
        Math.max(cutDrag.initialStart + 0.1, cutDrag.initialEnd + deltaSec)
      );
      const rounded = Math.round(newEnd * 10) / 10;
      if (onUpdateCut) onUpdateCut(cutDrag.cutId, cutDrag.initialStart, rounded);
      onSeek(rounded);
    } else if (cutDrag.type === 'move') {
      const dur = cutDrag.initialEnd - cutDrag.initialStart;
      const newStart = Math.max(0, Math.min(metadata.duration_sec - dur, cutDrag.initialStart + deltaSec));
      const roundedStart = Math.round(newStart * 10) / 10;
      const roundedEnd = Math.round((roundedStart + dur) * 10) / 10;
      if (onUpdateCut) onUpdateCut(cutDrag.cutId, roundedStart, roundedEnd);
      onSeek(roundedStart);
    }
  };

  const handleCutHandlePointerUp = (e: React.PointerEvent) => {
    if (cutDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setCutDrag(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#12141e]/90 p-4 shadow-xl backdrop-blur-md select-none">
      {/* Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={onPlayToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-md shadow-purple-500/20 hover:bg-purple-500 transition-all active:scale-95"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          {/* Jump to 0:00 */}
          <button
            type="button"
            onClick={() => onSeek(0)}
            className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Return to start (00:00.00)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Frame & Precision Stepping Buttons */}
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, currentTime - 1.0))}
              className="px-1.5 py-1 text-[10px] font-mono font-medium text-slate-300 hover:text-white rounded hover:bg-white/10 transition-colors"
              title="Step backward 1.0 second"
            >
              -1.0s
            </button>
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, currentTime - frameDuration))}
              className="px-1.5 py-1 text-[10px] font-mono font-bold text-purple-300 hover:text-white rounded hover:bg-purple-600/30 transition-colors"
              title={`Step backward 1 frame (${(frameDuration * 1000).toFixed(1)}ms)`}
            >
              -1f
            </button>
            <button
              type="button"
              onClick={() => onSeek(Math.min(metadata.duration_sec, currentTime + frameDuration))}
              className="px-1.5 py-1 text-[10px] font-mono font-bold text-purple-300 hover:text-white rounded hover:bg-purple-600/30 transition-colors"
              title={`Step forward 1 frame (${(frameDuration * 1000).toFixed(1)}ms)`}
            >
              +1f
            </button>
            <button
              type="button"
              onClick={() => onSeek(Math.min(metadata.duration_sec, currentTime + 1.0))}
              className="px-1.5 py-1 text-[10px] font-mono font-medium text-slate-300 hover:text-white rounded hover:bg-white/10 transition-colors"
              title="Step forward 1.0 second"
            >
              +1.0s
            </button>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-1.5 font-mono text-purple-300 ml-1">
            <Clock className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-semibold text-white">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{formatTime(metadata.duration_sec)}</span>
          </div>
        </div>

        {/* Video Specs Badges */}
        <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-mono">
          <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5">{metadata.width}x{metadata.height}</span>
          <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5">{metadata.fps} FPS</span>
          <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5">{metadata.total_frames} Frames</span>
        </div>
      </div>

      {/* Scrubber Timeline Bar with Keyframe Thumbnails */}
      <div
        ref={scrubberBarRef}
        onClick={(e) => {
          if (cutDrag) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(clickX / rect.width, 1));
          onSeek(pct * metadata.duration_sec);
        }}
        className="relative mt-2 h-16 w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#0d0e15]"
      >
        {/* Background Keyframe Thumbnails Strip */}
        <div className="absolute inset-0 flex h-full w-full opacity-60">
          {metadata.thumbnails.map((thumb, idx) => (
            <div key={idx} className="relative flex-1 h-full overflow-hidden border-r border-white/5">
              <img
                src={thumb.url}
                alt={`frame-${thumb.frame_index}`}
                className="h-full w-full object-cover pointer-events-none select-none"
              />
            </div>
          ))}
        </div>

        {/* Played Time Gradient Fill */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-purple-500/25 border-r-2 border-purple-400 backdrop-brightness-125 pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Pending In-Progress Cut Range (when user marked cut start) */}
        {cutStartMark != null && (
          <div
            className="absolute top-0 bottom-0 border-x-2 border-dashed border-rose-400 bg-rose-500/35 animate-pulse pointer-events-none z-10"
            style={{
              left: `${(Math.min(cutStartMark, currentTime) / metadata.duration_sec) * 100}%`,
              width: `${(Math.abs(currentTime - cutStartMark) / metadata.duration_sec) * 100}%`,
              backgroundImage:
                'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(244,63,94,0.3) 6px, rgba(244,63,94,0.3) 12px)',
            }}
          >
            <div className="absolute top-1 left-1.5 flex items-center gap-1 text-[9px] font-bold text-rose-100 bg-black/85 px-1.5 py-0.5 rounded border border-rose-500/50 shadow">
              ✂️ Marking: {formatTime(Math.min(cutStartMark, currentTime))} → {formatTime(Math.max(cutStartMark, currentTime))}
            </div>
          </div>
        )}

        {/* Cut Segments (With Draggable Start & End Handles!) */}
        {cutRanges && cutRanges.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
            {cutRanges.map((cut) => {
              const leftPct = (cut.start_time / metadata.duration_sec) * 100;
              const widthPct = Math.max(1, ((cut.end_time - cut.start_time) / metadata.duration_sec) * 100);
              const isSelected = selectedCutId === cut.id;
              const durationSec = Math.round((cut.end_time - cut.start_time) * 10) / 10;

              return (
                <div
                  key={cut.id}
                  className={`absolute top-0 bottom-0 pointer-events-auto transition-all ${
                    isSelected
                      ? 'bg-rose-500/40 border-y-2 border-rose-400 ring-2 ring-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.7)]'
                      : 'bg-rose-600/30 border-y border-rose-500/70 hover:bg-rose-500/35'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(244,63,94,0.25) 6px, rgba(244,63,94,0.25) 12px)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectCut) onSelectCut(cut.id);
                    onSeek(cut.start_time);
                  }}
                  title={`Cut Segment: ${formatTime(cut.start_time)} - ${formatTime(cut.end_time)} (-${durationSec}s)`}
                >
                  {/* Left Draggable Handle (Cut Start Adjuster) */}
                  <div
                    onPointerDown={(e) => handleCutHandlePointerDown(e, cut, 'start')}
                    onPointerMove={handleCutHandlePointerMove}
                    onPointerUp={handleCutHandlePointerUp}
                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center bg-rose-600 hover:bg-rose-400 active:bg-white text-white rounded-l transition-colors z-20 group"
                    title={`Drag to adjust Cut Start (Current: ${formatTime(cut.start_time)})`}
                  >
                    <div className="w-1 h-5 bg-white/90 rounded-full group-hover:scale-y-125 transition-transform" />
                  </div>

                  {/* Middle Draggable Body (Slide Cut Window) */}
                  <div
                    onPointerDown={(e) => handleCutHandlePointerDown(e, cut, 'move')}
                    onPointerMove={handleCutHandlePointerMove}
                    onPointerUp={handleCutHandlePointerUp}
                    className="absolute left-3 right-3 top-0 bottom-0 cursor-grab active:cursor-grabbing flex flex-col justify-between p-1"
                    title={`Drag to move cut window (${formatTime(cut.start_time)} → ${formatTime(cut.end_time)})`}
                  >
                    <div className="flex items-center gap-1 text-[9px] font-bold text-rose-200 bg-black/80 px-1 py-0.5 rounded shadow max-w-fit">
                      ✂️ Cut (-{durationSec}s)
                    </div>
                  </div>

                  {/* Right Draggable Handle (Cut End Adjuster) */}
                  <div
                    onPointerDown={(e) => handleCutHandlePointerDown(e, cut, 'end')}
                    onPointerMove={handleCutHandlePointerMove}
                    onPointerUp={handleCutHandlePointerUp}
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center bg-rose-600 hover:bg-rose-400 active:bg-white text-white rounded-r transition-colors z-20 group"
                    title={`Drag to adjust Cut End (Current: ${formatTime(cut.end_time)})`}
                  >
                    <div className="w-1 h-5 bg-white/90 rounded-full group-hover:scale-y-125 transition-transform" />
                  </div>

                  {/* Active Drag Tooltip */}
                  {cutDrag && cutDrag.cutId === cut.id && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/95 text-rose-300 border border-rose-500/60 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-30">
                      {cutDrag.type === 'start' && `Start: ${formatTime(cut.start_time)}`}
                      {cutDrag.type === 'end' && `End: ${formatTime(cut.end_time)}`}
                      {cutDrag.type === 'move' && `${formatTime(cut.start_time)} → ${formatTime(cut.end_time)}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Text Overlay Range Indicators on Timeline */}
        {textOverlays && textOverlays.length > 0 && (
          <div className="absolute top-1 left-0 right-0 z-10 flex flex-col gap-0.5 px-1 pointer-events-none">
            {textOverlays.map((to) => {
              const start = Math.max(0, to.start_time ?? 0);
              const end = to.end_time ?? metadata.duration_sec;
              const safeEnd = Math.max(start + 0.1, end);
              const leftPct = (start / metadata.duration_sec) * 100;
              const widthPct = Math.max(2, Math.min(100 - leftPct, ((safeEnd - start) / metadata.duration_sec) * 100));
              const isSelected = selectedTextId === to.id;

              return (
                <div
                  key={to.id}
                  className={`h-3 rounded-full border transition-all pointer-events-auto cursor-pointer flex items-center px-1 text-[8px] font-bold truncate ${
                    isSelected
                      ? 'bg-cyan-400 border-white text-black shadow-[0_0_8px_rgba(34,211,238,0.9)] ring-1 ring-cyan-200'
                      : 'bg-cyan-600/80 border-cyan-300/50 text-cyan-100 hover:bg-cyan-500'
                  }`}
                  style={{
                    marginLeft: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectText) onSelectText(to.id);
                    onSeek(start);
                  }}
                  title={`Text Overlay "${to.text}": Active from ${formatTime(start)} to ${formatTime(end)}`}
                >
                  <span className="truncate">✏️ {to.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Overlay Active Time Range Bars on Timeline Strip */}
        {boxes && boxes.length > 0 && (
          <div className="absolute bottom-1.5 left-0 right-0 z-10 flex flex-col gap-1 px-1 pointer-events-none">
            {boxes.map((b) => {
              const start = Math.max(0, b.start_time ?? 0);
              const end = b.end_time ?? metadata.duration_sec;
              const safeEnd = Math.max(start + 0.1, end);
              const leftPct = (start / metadata.duration_sec) * 100;
              const widthPct = Math.max(2, Math.min(100 - leftPct, ((safeEnd - start) / metadata.duration_sec) * 100));
              const isSelected = selectedBoxId === b.id;

              return (
                <div
                  key={b.id}
                  className={`h-2 rounded-full border transition-all pointer-events-auto cursor-pointer ${
                    isSelected
                      ? 'bg-purple-400 border-white shadow-[0_0_8px_rgba(168,85,247,0.9)] ring-1 ring-purple-300'
                      : 'bg-purple-600/80 border-purple-300/50 hover:bg-purple-500'
                  }`}
                  style={{
                    marginLeft: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectBox) onSelectBox(b.id);
                    onSeek(start);
                  }}
                  title={`${b.label}: Active from ${formatTime(start)} to ${formatTime(end)}`}
                />
              );
            })}
          </div>
        )}

        {/* Scrubber Playhead Needle */}
        <div
          className="absolute top-0 bottom-0 z-25 w-1 bg-white shadow-[0_0_10px_white] pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md border-2 border-purple-600" />
        </div>
      </div>
    </div>
  );
};
