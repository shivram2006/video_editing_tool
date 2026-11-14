import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Paintbrush,
  Square,
  Eraser,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  Sliders,
  Check,
  X,
  Tag,
} from 'lucide-react';
import { BoundingBox } from '../types';

interface CanvasEditorProps {
  imageUrl: string;
  detectedBoxes: BoundingBox[];
  onBoxesChange: (boxes: BoundingBox[]) => void;
  onMaskChange: (maskBase64: string) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageUrl,
  detectedBoxes,
  onBoxesChange,
  onMaskChange,
}) => {
  const [tool, setTool] = useState<'brush' | 'rect' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [zoom, setZoom] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectCurrent, setRectCurrent] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize canvas to match image dimensions
  const handleImageLoad = () => {
    if (!imageRef.current || !maskCanvasRef.current) return;
    const img = imageRef.current;
    const canvas = maskCanvasRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    renderAll();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskCanvasRef.current || !imageRef.current) return { x: 0, y: 0 };
    const rect = maskCanvasRef.current.getBoundingClientRect();
    const scaleX = maskCanvasRef.current.width / rect.width;
    const scaleY = maskCanvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);

    if (tool === 'rect') {
      setRectStart(coords);
      setRectCurrent(coords);
    } else {
      drawBrushPoint(coords.x, coords.y);
    }
  };

  const drawBrushPoint = (x: number, y: number) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
    }

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    notifyMaskUpdated();
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);

    if (tool === 'rect') {
      setRectCurrent(coords);
    } else {
      drawBrushPoint(coords.x, coords.y);
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'rect' && rectStart && rectCurrent) {
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const x = Math.min(rectStart.x, rectCurrent.x);
          const y = Math.min(rectStart.y, rectCurrent.y);
          const w = Math.abs(rectCurrent.x - rectStart.x);
          const h = Math.abs(rectCurrent.y - rectStart.y);

          if (w > 5 && h > 5) {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
            ctx.fillRect(x, y, w, h);
            notifyMaskUpdated();

            // Also add as user bounding box
            const newBox: BoundingBox = {
              id: Math.random().toString(36).substring(2, 9),
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(w),
              height: Math.round(h),
              label: 'Manual Selection',
              confidence: 1.0,
              type: 'custom',
            };
            onBoxesChange([...detectedBoxes, newBox]);
          }
        }
      }
      setRectStart(null);
      setRectCurrent(null);
    }
  };

  const notifyMaskUpdated = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const maskData = canvas.toDataURL('image/png');
    onMaskChange(maskData);
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onBoxesChange([]);
    notifyMaskUpdated();
  };

  const deleteBox = (id: string) => {
    onBoxesChange(detectedBoxes.filter((b) => b.id !== id));
  };

  // Render bounding boxes onto visual overlay
  const renderAll = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and re-fill based on boxes
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.65)';

    for (const b of detectedBoxes) {
      ctx.fillRect(b.x, b.y, b.width, b.height);
    }
    notifyMaskUpdated();
  };

  useEffect(() => {
    renderAll();
  }, [detectedBoxes]);

  return (
    <div className="flex flex-col gap-4">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#12141e]/90 p-3 shadow-xl backdrop-blur-md">
        {/* Tool selector */}
        <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-black/40 p-1">
          <button
            onClick={() => setTool('brush')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tool === 'brush'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush className="h-3.5 w-3.5" />
            <span>Brush</span>
          </button>

          <button
            onClick={() => setTool('rect')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tool === 'rect'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Square className="h-3.5 w-3.5" />
            <span>Rectangle</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tool === 'eraser'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            <span>Eraser</span>
          </button>
        </div>

        {/* Brush Size Slider */}
        {tool === 'brush' || tool === 'eraser' ? (
          <div className="flex items-center gap-2 px-2 text-xs text-slate-300">
            <span className="text-slate-500">Size:</span>
            <input
              type="range"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="w-8 font-mono text-purple-400">{brushSize}px</span>
          </div>
        ) : null}

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-black/40 p-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-mono text-slate-300">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(3.0, Math.round((z + 0.25) * 100) / 100))}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            title="Reset Zoom"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Clear Mask Button */}
        <button
          onClick={clearMask}
          className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition-all hover:bg-rose-500/20 hover:border-rose-500/40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Clear Mask</span>
        </button>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        className="relative min-h-[460px] max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-[#0a0b12] p-4 flex items-center justify-center shadow-inner"
      >
        <div
          className="relative inline-block transition-transform duration-100 ease-out origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Base Image */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Source for inpainting"
            onLoad={handleImageLoad}
            crossOrigin="anonymous"
            className="block max-h-[60vh] max-w-full rounded-lg object-contain pointer-events-none select-none shadow-2xl"
          />

          {/* Interactive Mask Canvas Layer */}
          <canvas
            ref={maskCanvasRef}
            onMouseDown={startDrawing}
            onMouseMove={drawMove}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            className={`absolute inset-0 h-full w-full rounded-lg ${
              tool === 'brush' ? 'cursor-crosshair' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
            }`}
          />

          {/* Rectangle Preview when dragging */}
          {tool === 'rect' && isDrawing && rectStart && rectCurrent && maskCanvasRef.current && (
            <div
              className="absolute pointer-events-none border-2 border-purple-400 bg-purple-500/30 rounded"
              style={{
                left: `${(Math.min(rectStart.x, rectCurrent.x) / maskCanvasRef.current.width) * 100}%`,
                top: `${(Math.min(rectStart.y, rectCurrent.y) / maskCanvasRef.current.height) * 100}%`,
                width: `${(Math.abs(rectCurrent.x - rectStart.x) / maskCanvasRef.current.width) * 100}%`,
                height: `${(Math.abs(rectCurrent.y - rectStart.y) / maskCanvasRef.current.height) * 100}%`,
              }}
            />
          )}

          {/* Bounding Box Badges & Interactive Handles */}
          {maskCanvasRef.current &&
            detectedBoxes.map((box) => {
              const canvasW = maskCanvasRef.current?.width || 1;
              const canvasH = maskCanvasRef.current?.height || 1;
              const leftPct = (box.x / canvasW) * 100;
              const topPct = (box.y / canvasH) * 100;
              const widthPct = (box.width / canvasW) * 100;
              const heightPct = (box.height / canvasH) * 100;

              return (
                <div
                  key={box.id}
                  className="absolute group border border-purple-400/80 bg-purple-500/20 rounded pointer-events-none"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-purple-200 border border-purple-500/40 shadow-lg whitespace-nowrap pointer-events-auto">
                    <span>{box.label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBox(box.id);
                      }}
                      className="text-slate-400 hover:text-rose-400 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Detected Regions Pill List */}
      {detectedBoxes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-400 mr-2">
            <Tag className="h-3.5 w-3.5 text-purple-400" />
            <span>Targeted Regions ({detectedBoxes.length}):</span>
          </div>
          {detectedBoxes.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-purple-200"
            >
              <span className="font-medium">{b.label}</span>
              <span className="text-[10px] text-purple-400">
                {b.width}x{b.height}px
              </span>
              <button
                onClick={() => deleteBox(b.id)}
                className="text-purple-400 hover:text-rose-400 transition-colors"
                title="Remove selection"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
