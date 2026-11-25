import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Video as VideoIcon,
  Sparkles,
  Wand2,
  Download,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Layers,
  Volume2,
  ShieldCheck,
  Tag,
  X,
  Eye,
  Film,
  Crosshair,
  MousePointer,
  Move,
  Clock,
  RotateCcw,
  Scissors,
  Plus,
  Trash2,
  FolderPlus,
  ArrowRight,
  Type,
  Edit3,
  Palette,
  FastForward,
  VolumeX,
  Music,
  Headphones,
  Radio,
} from 'lucide-react';
import { VideoTimelineScrubber } from '../components/VideoTimelineScrubber';
import { ProcessingProgressModal } from '../components/ProcessingProgressModal';
import { LegalConfirmationModal } from '../components/LegalConfirmationModal';
import { BoundingBox, VideoMetadata, VideoJobStatus, DetectionResult, CutRange, InsertClip, TextOverlay, AudioTrackInfo } from '../types';
import { api } from '../services/api';

interface VideoCleanerProps {
  onJobInitiated?: (jobId: string) => void;
  preloadedMetadata?: VideoMetadata | null;
}

export const VideoCleanerPage: React.FC<VideoCleanerProps> = ({
  onJobInitiated,
  preloadedMetadata,
}) => {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(preloadedMetadata || null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Watermark boxes & Interactive selection state
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectTool, setSelectTool] = useState<'draw' | 'select'>('draw');

  // Studio Mode: 'watermark' | 'text' | 'cut_stitch' | 'audio'
  const [studioMode, setStudioMode] = useState<'watermark' | 'text' | 'cut_stitch' | 'audio'>('watermark');

  // Text Overlays & Replacement state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Video Cut / Trim state
  const [cutRanges, setCutRanges] = useState<CutRange[]>([]);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);
  const [cutStartMark, setCutStartMark] = useState<number | null>(null);

  // Insert Clips state (Intro/Outro)
  const [insertClips, setInsertClips] = useState<InsertClip[]>([]);
  const [isUploadingClip, setIsUploadingClip] = useState<boolean>(false);

  // Audio Replacement & Mixing state
  const [audioMode, setAudioMode] = useState<'original' | 'mute' | 'replace' | 'mix'>('original');
  const [uploadedAudio, setUploadedAudio] = useState<AudioTrackInfo | null>(null);
  const [newAudioVolume, setNewAudioVolume] = useState<number>(1.0);
  const [originalAudioVolume, setOriginalAudioVolume] = useState<number>(1.0);
  const [audioLoop, setAudioLoop] = useState<boolean>(true);
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [isPlayingAudioPreview, setIsPlayingAudioPreview] = useState<boolean>(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  const [interaction, setInteraction] = useState<{
    type: 'draw' | 'move' | 'resize';
    startClientX: number;
    startClientY: number;
    currClientX?: number;
    currClientY?: number;
    boxId?: string;
    textId?: string;
    handle?: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    origBox?: BoundingBox;
    origText?: TextOverlay;
  } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut to delete active box, text overlay, or cut segment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
        if (selectedBoxId) {
          setBoxes((prev) => prev.filter((b) => b.id !== selectedBoxId));
          setSelectedBoxId(null);
        } else if (selectedTextId) {
          setTextOverlays((prev) => prev.filter((t) => t.id !== selectedTextId));
          setSelectedTextId(null);
        } else if (selectedCutId) {
          setCutRanges((prev) => prev.filter((c) => c.id !== selectedCutId));
          setSelectedCutId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedBoxId(null);
        setSelectedTextId(null);
        setSelectedCutId(null);
        setCutStartMark(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBoxId, selectedTextId, selectedCutId]);

  // Settings
  const [trackingMode, setTrackingMode] = useState<string>('static');
  const [temporalConsistency, setTemporalConsistency] = useState<boolean>(true);
  const [preserveAudio, setPreserveAudio] = useState<boolean>(true);
  const [exportResolution, setExportResolution] = useState<string>('original');

  // Job status
  const [activeJob, setActiveJob] = useState<VideoJobStatus | null>(null);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Poll active video job
  useEffect(() => {
    let interval: any = null;
    if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const status = await api.getVideoJobStatus(activeJob.job_id);
          setActiveJob(status);
        } catch (e) {
          console.error('Job polling error:', e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeJob]);

  // Upload handler
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMsg(null);
    setBoxes([]);
    try {
      const data = await api.uploadVideo(file);
      setMetadata(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Video upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const loadSampleVideo = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    setBoxes([]);
    try {
      const res = await fetch('/api/uploads/sample_reel_video.mp4');
      const blob = await res.blob();
      const file = new File([blob], 'sample_reel_video.mp4', { type: 'video/mp4' });
      await handleFileUpload(file);
    } catch (e) {
      setErrorMsg('Failed to load sample video');
      setIsUploading(false);
    }
  };

  // Video playback listeners
  const [cutPreviewMode, setCutPreviewMode] = useState<{
    type: 'segment' | 'skip';
    cutId: string;
    stopAt: number;
    jumpTo?: number;
  } | null>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setCutPreviewMode(null);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      if (cutPreviewMode) {
        if (cutPreviewMode.type === 'segment') {
          if (cur >= cutPreviewMode.stopAt) {
            videoRef.current.pause();
            setIsPlaying(false);
            setCutPreviewMode(null);
          }
        } else if (cutPreviewMode.type === 'skip') {
          const cut = cutRanges.find((c) => c.id === cutPreviewMode.cutId);
          if (cut && cur >= cut.start_time && cur < cut.end_time && cutPreviewMode.jumpTo != null) {
            videoRef.current.currentTime = cutPreviewMode.jumpTo;
          }
          if (cur >= cutPreviewMode.stopAt) {
            videoRef.current.pause();
            setIsPlaying(false);
            setCutPreviewMode(null);
          }
        }
      }
    }
  };

  const handleSeek = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      setCurrentTime(timeSec);
    }
  };

  // Auto detect overlays on reference frame or current scrubber frame
  const handleDetect = async () => {
    if (!metadata) return;
    setIsDetecting(true);
    setErrorMsg(null);
    try {
      const result: DetectionResult = await api.detectVideoWatermarks(metadata.media_id, currentTime);
      if (result.detected_boxes && result.detected_boxes.length > 0) {
        setBoxes(result.detected_boxes);
      } else {
        setErrorMsg('No distinct overlays detected on this frame. Try scrubbing to a frame where the watermark is visible or drag a box manually.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Video watermark detection failed');
    } finally {
      setIsDetecting(false);
    }
  };

  // Format seconds to mm:ss.s
  const formatSec = (sec?: number) => {
    if (sec == null) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const updateBoxTiming = (id: string, startTime?: number, endTime?: number) => {
    const maxDur = metadata?.duration_sec || 9999;
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        let newStart = startTime !== undefined && !isNaN(startTime) ? Math.max(0, Math.min(maxDur, Math.round(startTime * 10) / 10)) : undefined;
        let newEnd = endTime !== undefined && !isNaN(endTime) ? Math.max(0, Math.min(maxDur, Math.round(endTime * 10) / 10)) : undefined;

        if (newStart !== undefined && newEnd !== undefined) {
          if (newStart >= newEnd) {
            if (startTime !== b.start_time) {
              newEnd = Math.min(maxDur, Math.round((newStart + 0.5) * 10) / 10);
            } else {
              newStart = Math.max(0, Math.round((newEnd - 0.5) * 10) / 10);
            }
          }
        }
        return { ...b, start_time: newStart, end_time: newEnd };
      })
    );
  };

  const adjustBoxTiming = (id: string, field: 'start' | 'end', delta: number) => {
    if (!metadata) return;
    const box = boxes.find((b) => b.id === id);
    if (!box) return;
    const maxDur = metadata.duration_sec;
    const currentStart = box.start_time ?? 0;
    const currentEnd = box.end_time ?? maxDur;

    if (field === 'start') {
      const targetStart = Math.max(0, Math.round((currentStart + delta) * 10) / 10);
      let newEnd = box.end_time;
      if (newEnd !== undefined && targetStart >= newEnd) {
        newEnd = Math.min(maxDur, Math.round((targetStart + 0.5) * 10) / 10);
      }
      updateBoxTiming(id, targetStart, newEnd);
      handleSeek(targetStart);
    } else {
      const targetEnd = Math.min(maxDur, Math.round((currentEnd + delta) * 10) / 10);
      let newStart = box.start_time;
      if (newStart !== undefined && targetEnd <= newStart) {
        newStart = Math.max(0, Math.round((targetEnd - 0.5) * 10) / 10);
      }
      updateBoxTiming(id, newStart, targetEnd);
      handleSeek(targetEnd);
    }
  };

  const setBoxPointToPlayhead = (id: string, field: 'start' | 'end') => {
    if (!metadata) return;
    const box = boxes.find((b) => b.id === id);
    if (!box) return;
    const maxDur = metadata.duration_sec;
    const playhead = Math.round(currentTime * 10) / 10;

    if (field === 'start') {
      let newEnd = box.end_time;
      if (newEnd !== undefined && playhead >= newEnd) {
        newEnd = Math.min(maxDur, Math.round((playhead + 0.5) * 10) / 10);
      }
      updateBoxTiming(id, playhead, newEnd);
      handleSeek(playhead);
    } else {
      let newStart = box.start_time;
      if (newStart !== undefined && playhead <= newStart) {
        newStart = Math.max(0, Math.round((playhead - 0.5) * 10) / 10);
      }
      updateBoxTiming(id, newStart, playhead);
      handleSeek(playhead);
    }
  };

  const updateTextOverlayTiming = (id: string, startTime?: number, endTime?: number) => {
    const maxDur = metadata?.duration_sec || 9999;
    setTextOverlays((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        let newStart = startTime !== undefined && !isNaN(startTime) ? Math.max(0, Math.min(maxDur, Math.round(startTime * 10) / 10)) : undefined;
        let newEnd = endTime !== undefined && !isNaN(endTime) ? Math.max(0, Math.min(maxDur, Math.round(endTime * 10) / 10)) : undefined;

        if (newStart !== undefined && newEnd !== undefined) {
          if (newStart >= newEnd) {
            if (startTime !== t.start_time) {
              newEnd = Math.min(maxDur, Math.round((newStart + 0.5) * 10) / 10);
            } else {
              newStart = Math.max(0, Math.round((newEnd - 0.5) * 10) / 10);
            }
          }
        }
        return { ...t, start_time: newStart, end_time: newEnd };
      })
    );
  };

  const adjustTextOverlayTiming = (id: string, field: 'start' | 'end', delta: number) => {
    if (!metadata) return;
    const text = textOverlays.find((t) => t.id === id);
    if (!text) return;
    const maxDur = metadata.duration_sec;
    const currentStart = text.start_time ?? 0;
    const currentEnd = text.end_time ?? maxDur;

    if (field === 'start') {
      const targetStart = Math.max(0, Math.round((currentStart + delta) * 10) / 10);
      let newEnd = text.end_time;
      if (newEnd !== undefined && targetStart >= newEnd) {
        newEnd = Math.min(maxDur, Math.round((targetStart + 0.5) * 10) / 10);
      }
      updateTextOverlayTiming(id, targetStart, newEnd);
      handleSeek(targetStart);
    } else {
      const targetEnd = Math.min(maxDur, Math.round((currentEnd + delta) * 10) / 10);
      let newStart = text.start_time;
      if (newStart !== undefined && targetEnd <= newStart) {
        newStart = Math.max(0, Math.round((targetEnd - 0.5) * 10) / 10);
      }
      updateTextOverlayTiming(id, newStart, targetEnd);
      handleSeek(targetEnd);
    }
  };

  const setTextOverlayPointToPlayhead = (id: string, field: 'start' | 'end') => {
    if (!metadata) return;
    const text = textOverlays.find((t) => t.id === id);
    if (!text) return;
    const maxDur = metadata.duration_sec;
    const playhead = Math.round(currentTime * 10) / 10;

    if (field === 'start') {
      let newEnd = text.end_time;
      if (newEnd !== undefined && playhead >= newEnd) {
        newEnd = Math.min(maxDur, Math.round((playhead + 0.5) * 10) / 10);
      }
      updateTextOverlayTiming(id, playhead, newEnd);
      handleSeek(playhead);
    } else {
      let newStart = text.start_time;
      if (newStart !== undefined && playhead <= newStart) {
        newStart = Math.max(0, Math.round((playhead - 0.5) * 10) / 10);
      }
      updateTextOverlayTiming(id, newStart, playhead);
      handleSeek(playhead);
    }
  };

  // Cut segment operations
  const updateCutTiming = (id: string, startTime: number, endTime: number) => {
    setCutRanges((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const s = Math.max(0, Math.min(startTime, endTime - 0.1));
        const e = Math.min(metadata?.duration_sec || 9999, Math.max(endTime, startTime + 0.1));
        return {
          ...c,
          start_time: Math.round(s * 10) / 10,
          end_time: Math.round(e * 10) / 10,
        };
      })
    );
  };

  const adjustSelectedCut = (field: 'start' | 'end', delta: number) => {
    if (!selectedCutId || !metadata) return;
    const cut = cutRanges.find((c) => c.id === selectedCutId);
    if (!cut) return;
    if (field === 'start') {
      const newStart = Math.max(0, Math.min(cut.end_time - 0.1, cut.start_time + delta));
      const rounded = Math.round(newStart * 10) / 10;
      updateCutTiming(cut.id, rounded, cut.end_time);
      handleSeek(rounded);
    } else {
      const newEnd = Math.min(metadata.duration_sec, Math.max(cut.start_time + 0.1, cut.end_time + delta));
      const rounded = Math.round(newEnd * 10) / 10;
      updateCutTiming(cut.id, cut.start_time, rounded);
      handleSeek(rounded);
    }
  };

  const setCutPointToPlayhead = (field: 'start' | 'end') => {
    if (!selectedCutId || !metadata) return;
    const cut = cutRanges.find((c) => c.id === selectedCutId);
    if (!cut) return;
    const roundedPlayhead = Math.round(currentTime * 10) / 10;
    if (field === 'start') {
      if (roundedPlayhead >= cut.end_time) {
        const newEnd = Math.min(metadata.duration_sec, roundedPlayhead + 1.0);
        updateCutTiming(cut.id, roundedPlayhead, newEnd);
      } else {
        updateCutTiming(cut.id, roundedPlayhead, cut.end_time);
      }
      handleSeek(roundedPlayhead);
    } else {
      if (roundedPlayhead <= cut.start_time) {
        const newStart = Math.max(0, roundedPlayhead - 1.0);
        updateCutTiming(cut.id, newStart, roundedPlayhead);
      } else {
        updateCutTiming(cut.id, cut.start_time, roundedPlayhead);
      }
      handleSeek(roundedPlayhead);
    }
  };

  const handleMarkCutStart = () => {
    setCutStartMark(Math.round(currentTime * 10) / 10);
  };

  const handleCompleteCut = () => {
    if (cutStartMark === null || !metadata) return;
    const start = Math.min(cutStartMark, currentTime);
    const end = Math.max(cutStartMark, currentTime);
    if (end - start < 0.2) {
      setErrorMsg('Cut segment must be at least 0.2s in duration');
      return;
    }
    const newCut: CutRange = {
      id: Math.random().toString(36).substring(2, 9),
      start_time: Math.round(start * 10) / 10,
      end_time: Math.round(end * 10) / 10,
      label: `Cut Segment ${cutRanges.length + 1}`,
    };
    setCutRanges([...cutRanges, newCut]);
    setSelectedCutId(newCut.id);
    setCutStartMark(null);
  };

  const handleCompleteCutWithDuration = (durationSec: number) => {
    if (cutStartMark === null || !metadata) return;
    const start = cutStartMark;
    const end = Math.min(metadata.duration_sec, Math.round((start + durationSec) * 10) / 10);
    if (end <= start) return;
    const newCut: CutRange = {
      id: Math.random().toString(36).substring(2, 9),
      start_time: start,
      end_time: end,
      label: `Cut Segment ${cutRanges.length + 1}`,
    };
    setCutRanges([...cutRanges, newCut]);
    setSelectedCutId(newCut.id);
    setCutStartMark(null);
  };

  const addCutAtPlayhead = (durationSec = 2.0) => {
    if (!metadata) return;
    const start = Math.round(currentTime * 10) / 10;
    const end = Math.min(metadata.duration_sec, Math.round((start + durationSec) * 10) / 10);
    if (end <= start) return;
    const newCut: CutRange = {
      id: Math.random().toString(36).substring(2, 9),
      start_time: start,
      end_time: end,
      label: `Cut Segment ${cutRanges.length + 1}`,
    };
    setCutRanges([...cutRanges, newCut]);
    setSelectedCutId(newCut.id);
  };

  const handleQuickCut = (durationSec: number) => {
    addCutAtPlayhead(durationSec);
  };

  const deleteCut = (id: string) => {
    setCutRanges((prev) => prev.filter((c) => c.id !== id));
    if (selectedCutId === id) setSelectedCutId(null);
    if (cutPreviewMode?.cutId === id) setCutPreviewMode(null);
  };

  const previewCutSegment = (cut: CutRange) => {
    if (!videoRef.current) return;
    handleSeek(cut.start_time);
    setCutPreviewMode({
      type: 'segment',
      cutId: cut.id,
      stopAt: cut.end_time,
    });
    videoRef.current.play();
    setIsPlaying(true);
  };

  const previewSkipCut = (cut: CutRange) => {
    if (!videoRef.current) return;
    const preTime = Math.max(0, cut.start_time - 1.5);
    handleSeek(preTime);
    setCutPreviewMode({
      type: 'skip',
      cutId: cut.id,
      stopAt: Math.min(metadata?.duration_sec || 9999, cut.end_time + 1.5),
      jumpTo: cut.end_time,
    });
    videoRef.current.play();
    setIsPlaying(true);
  };

  // Insert clip operations
  const handleUploadInsertClip = async (file: File, position: 'start' | 'end' = 'end') => {
    setIsUploadingClip(true);
    setErrorMsg(null);
    try {
      const data = await api.uploadVideo(file);
      const newClip: InsertClip = {
        id: Math.random().toString(36).substring(2, 9),
        media_id: data.media_id,
        filename: file.name,
        position,
        label: position === 'start' ? 'Intro Clip' : 'Outro Clip',
        duration_sec: data.duration_sec,
        preview_url: data.reference_frame_url || data.thumbnails?.[0]?.url,
      };
      setInsertClips((prev) => [...prev, newClip]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload additional clip');
    } finally {
      setIsUploadingClip(false);
    }
  };

  const toggleClipPosition = (id: string) => {
    setInsertClips((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              position: c.position === 'start' ? 'end' : 'start',
              label: c.position === 'start' ? 'Outro Clip' : 'Intro Clip',
            }
          : c
      )
    );
  };

  const deleteInsertClip = (id: string) => {
    setInsertClips((prev) => prev.filter((c) => c.id !== id));
  };

  // Text Overlay management
  const addTextOverlay = (preset?: 'handle' | 'title' | 'cta') => {
    if (!metadata) return;
    const w = metadata.width;
    const h = metadata.height;
    const initialStart = currentTime > 0.5 ? Math.round(currentTime * 10) / 10 : undefined;

    let text = 'Your Custom Text';
    let x = Math.round(w * 0.1);
    let y = Math.round(h * 0.15);
    let fontSize = 36;
    let fontColor = 'white';
    let bgColor = 'black@0.6';

    if (preset === 'handle') {
      text = '@your_handle';
      x = Math.round(w * 0.05);
      y = Math.round(h * 0.88);
      fontSize = 28;
      fontColor = 'yellow';
    } else if (preset === 'title') {
      text = 'Main Video Title';
      x = Math.round(w * 0.08);
      y = Math.round(h * 0.08);
      fontSize = 44;
      fontColor = 'white';
    } else if (preset === 'cta') {
      text = 'Subscribe For More 🔥';
      x = Math.round(w * 0.15);
      y = Math.round(h * 0.75);
      fontSize = 32;
      fontColor = 'cyan';
    }

    const newText: TextOverlay = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      x,
      y,
      font_size: fontSize,
      font_color: fontColor,
      bg_color: bgColor,
      start_time: initialStart,
      end_time: undefined,
    };

    setTextOverlays((prev) => [...prev, newText]);
    setSelectedTextId(newText.id);
    setSelectedBoxId(null);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  // Helper to update box replacement text & styling
  const updateBoxReplacement = (
    id: string,
    replacementText?: string,
    fontSize?: number,
    fontColor?: string,
    bgColor?: string
  ) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              replacement_text: replacementText !== undefined ? replacementText : b.replacement_text,
              font_size: fontSize !== undefined ? fontSize : b.font_size,
              font_color: fontColor !== undefined ? fontColor : b.font_color,
              bg_color: bgColor !== undefined ? bgColor : b.bg_color,
            }
          : b
      )
    );
  };

  // Quick preset watermarks for Instagram / Reels / TikTok standard zones
  const addPreset = (type: 'handle' | 'logo' | 'bottom_right' | 'top_left') => {
    if (!metadata) return;
    const w = metadata.width;
    const h = metadata.height;
    const initialStart = currentTime > 0.5 ? Math.round(currentTime * 10) / 10 : undefined;
    let newBox: BoundingBox;

    if (type === 'handle') {
      newBox = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.round(w * 0.05),
        y: Math.round(h * 0.88),
        width: Math.round(w * 0.45),
        height: Math.round(h * 0.06),
        label: 'Username / Handle',
        confidence: 1.0,
        type: 'handle',
        start_time: initialStart,
      };
    } else if (type === 'logo') {
      newBox = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.round(w * 0.70),
        y: Math.round(h * 0.04),
        width: Math.round(w * 0.26),
        height: Math.round(h * 0.07),
        label: 'Reels / Platform Logo',
        confidence: 1.0,
        type: 'logo',
        start_time: initialStart,
      };
    } else if (type === 'bottom_right') {
      newBox = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.round(w * 0.55),
        y: Math.round(h * 0.88),
        width: Math.round(w * 0.40),
        height: Math.round(h * 0.07),
        label: 'Audio / Tag Overlay',
        confidence: 1.0,
        type: 'custom',
        start_time: initialStart,
      };
    } else {
      newBox = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.round(w * 0.04),
        y: Math.round(h * 0.03),
        width: Math.round(w * 0.35),
        height: Math.round(h * 0.06),
        label: 'Timestamp / Header',
        confidence: 1.0,
        type: 'timestamp',
        start_time: initialStart,
      };
    }

    setBoxes([...boxes, newBox]);
    setSelectedBoxId(newBox.id);
  };

  // Normalized coordinate helper
  const getOverlayPoint = (clientX: number, clientY: number) => {
    if (!overlayRef.current || !metadata) return { normX: 0, normY: 0, videoX: 0, videoY: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
    const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));
    const normX = rect.width > 0 ? (clampedX - rect.left) / rect.width : 0;
    const normY = rect.height > 0 ? (clampedY - rect.top) / rect.height : 0;
    return {
      normX,
      normY,
      videoX: Math.round(normX * metadata.width),
      videoY: Math.round(normY * metadata.height),
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
  };

  // Pointer interactions for drawing, moving, and resizing boxes
  const handlePointerDownOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!metadata) return;
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    setSelectedBoxId(null);
    setInteraction({
      type: 'draw',
      startClientX: e.clientX,
      startClientY: e.clientY,
      currClientX: e.clientX,
      currClientY: e.clientY,
    });
  };

  const handlePointerDownBox = (e: React.PointerEvent<HTMLDivElement>, box: BoundingBox) => {
    if (!metadata) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    setSelectedBoxId(box.id);
    if (overlayRef.current) {
      try {
        overlayRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }

    setInteraction({
      type: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      boxId: box.id,
      origBox: { ...box },
    });
  };

  const handlePointerDownHandle = (
    e: React.PointerEvent<HTMLDivElement>,
    box: BoundingBox,
    handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  ) => {
    if (!metadata) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    setSelectedBoxId(box.id);
    if (overlayRef.current) {
      try {
        overlayRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }

    setInteraction({
      type: 'resize',
      startClientX: e.clientX,
      startClientY: e.clientY,
      boxId: box.id,
      handle,
      origBox: { ...box },
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interaction || !metadata || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (interaction.type === 'draw') {
      setInteraction({
        ...interaction,
        currClientX: e.clientX,
        currClientY: e.clientY,
      });
    } else if (interaction.type === 'move' && interaction.origBox && interaction.boxId) {
      const scaleX = metadata.width / rect.width;
      const scaleY = metadata.height / rect.height;
      const dx = (e.clientX - interaction.startClientX) * scaleX;
      const dy = (e.clientY - interaction.startClientY) * scaleY;
      const orig = interaction.origBox;

      const newX = Math.round(Math.max(0, Math.min(metadata.width - orig.width, orig.x + dx)));
      const newY = Math.round(Math.max(0, Math.min(metadata.height - orig.height, orig.y + dy)));

      setBoxes((prev) =>
        prev.map((b) => (b.id === interaction.boxId ? { ...b, x: newX, y: newY } : b))
      );
    } else if (interaction.type === 'move' && interaction.origText && interaction.textId) {
      const scaleX = metadata.width / rect.width;
      const scaleY = metadata.height / rect.height;
      const dx = (e.clientX - interaction.startClientX) * scaleX;
      const dy = (e.clientY - interaction.startClientY) * scaleY;
      const orig = interaction.origText;

      const newX = Math.round(Math.max(0, Math.min(metadata.width - 30, orig.x + dx)));
      const newY = Math.round(Math.max(0, Math.min(metadata.height - 30, orig.y + dy)));

      setTextOverlays((prev) =>
        prev.map((t) => (t.id === interaction.textId ? { ...t, x: newX, y: newY } : t))
      );
    } else if (
      interaction.type === 'resize' &&
      interaction.origBox &&
      interaction.boxId &&
      interaction.handle
    ) {
      const scaleX = metadata.width / rect.width;
      const scaleY = metadata.height / rect.height;
      const dx = (e.clientX - interaction.startClientX) * scaleX;
      const dy = (e.clientY - interaction.startClientY) * scaleY;
      const orig = interaction.origBox;
      const handle = interaction.handle;

      let x = orig.x;
      let y = orig.y;
      let w = orig.width;
      let h = orig.height;

      if (handle.includes('e')) {
        w = Math.max(16, Math.min(metadata.width - x, orig.width + dx));
      }
      if (handle.includes('s')) {
        h = Math.max(16, Math.min(metadata.height - y, orig.height + dy));
      }
      if (handle.includes('w')) {
        const candidateX = Math.max(0, Math.min(orig.x + orig.width - 16, orig.x + dx));
        w = orig.x + orig.width - candidateX;
        x = candidateX;
      }
      if (handle.includes('n')) {
        const candidateY = Math.max(0, Math.min(orig.y + orig.height - 16, orig.y + dy));
        h = orig.y + orig.height - candidateY;
        y = candidateY;
      }

      setBoxes((prev) =>
        prev.map((b) =>
          b.id === interaction.boxId
            ? {
                ...b,
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(w),
                height: Math.round(h),
              }
            : b
        )
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interaction || !metadata) return;

    if (
      interaction.type === 'draw' &&
      interaction.currClientX !== undefined &&
      interaction.currClientY !== undefined
    ) {
      const p1 = getOverlayPoint(interaction.startClientX, interaction.startClientY);
      const p2 = getOverlayPoint(interaction.currClientX, interaction.currClientY);

      const minX = Math.min(p1.videoX, p2.videoX);
      const minY = Math.min(p1.videoY, p2.videoY);
      const w = Math.abs(p2.videoX - p1.videoX);
      const h = Math.abs(p2.videoY - p1.videoY);

      if (w >= 10 && h >= 10) {
        const isTextMode = studioMode === 'text';
        const newBox: BoundingBox = {
          id: Math.random().toString(36).substring(2, 9),
          x: Math.round(minX),
          y: Math.round(minY),
          width: Math.round(w),
          height: Math.round(h),
          label: isTextMode ? `Text Replace ${boxes.length + 1}` : `Custom Region ${boxes.length + 1}`,
          confidence: 1.0,
          type: isTextMode ? 'text' : 'custom',
          start_time: currentTime > 0.5 ? Math.round(currentTime * 10) / 10 : undefined,
          replacement_text: isTextMode ? '' : undefined,
          font_size: 32,
          font_color: '#ffffff',
          bg_color: 'black@0.7',
        };
        setBoxes((prev) => [...prev, newBox]);
        setSelectedBoxId(newBox.id);
        setSelectedTextId(null);
      }
    }

    setInteraction(null);
    try {
      if (overlayRef.current?.hasPointerCapture(e.pointerId)) {
        overlayRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  const deleteBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  // Audio Handlers
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioUploadError(null);
    try {
      const res = await api.uploadAudio(file);
      setUploadedAudio(res);
      if (audioMode === 'original' || audioMode === 'mute') {
        setAudioMode('replace');
      }
    } catch (err: any) {
      setAudioUploadError(err.message || 'Audio upload failed');
    } finally {
      setIsUploadingAudio(false);
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    }
  };

  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingAudioPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingAudioPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingAudioPreview(true);
    }
  };

  // Processing trigger
  const handleStartProcess = () => {
    if (!metadata) return;
    if (
      boxes.length === 0 &&
      cutRanges.length === 0 &&
      insertClips.length === 0 &&
      textOverlays.length === 0 &&
      audioMode === 'original'
    ) {
      setErrorMsg('Please select a watermark region, edit text, mark a cut, or configure audio.');
      return;
    }
    setShowLegalModal(true);
  };

  const executeProcess = async () => {
    setShowLegalModal(false);
    if (!metadata) return;

    try {
      const response = await api.processVideo({
        media_id: metadata.media_id,
        boxes,
        tracking_mode: trackingMode,
        temporal_consistency: temporalConsistency,
        preserve_audio: audioMode !== 'mute',
        audio_mode: audioMode,
        new_audio_id: uploadedAudio?.audio_id,
        new_audio_volume: newAudioVolume,
        original_audio_volume: originalAudioVolume,
        audio_loop: audioLoop,
        export_resolution: exportResolution,
        confirm_rights: true,
        cut_ranges: cutRanges.length > 0 ? cutRanges : undefined,
        insert_clips: insertClips.length > 0 ? insertClips : undefined,
        text_overlays: textOverlays.length > 0 ? textOverlays : undefined,
      });

      const initialStatus: VideoJobStatus = {
        job_id: response.job_id,
        status: 'queued',
        progress: 0.0,
        current_frame: 0,
        total_frames: metadata.total_frames,
        fps: metadata.fps,
        eta_seconds: 0.0,
        original_url: metadata.url,
        message: 'Queued for processing',
      };

      setActiveJob(initialStatus);
      setShowProgressModal(true);
      if (onJobInitiated) onJobInitiated(response.job_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start video processing');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
              Video Studio
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Video Watermark Cleaner</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Multi-frame temporal inpainting with optical flow tracking and audio preservation.
          </p>
        </div>

        {/* Load Sample Video Button */}
        <button
          onClick={loadSampleVideo}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-all"
        >
          Load Sample Reel Video (5s)
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty State / Upload Card */}
      {!metadata ? (
        <div className="mt-12 flex flex-col items-center justify-center">
          <label className="group relative flex h-80 w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-[#12141e]/50 p-6 text-center transition-all hover:border-purple-500/50 hover:bg-[#12141e]/80">
            <input
              type="file"
              accept=".mp4,.mov,.webm"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Film className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              {isUploading ? 'Extracting Video Frames...' : 'Drop MP4, MOV, or WEBM video here'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Supports MP4, MOV, WEBM (up to 150MB, max 2 minutes)
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Full audio stream preservation enabled via FFmpeg</span>
            </div>
          </label>
        </div>
      ) : (
        /* Video Cleaner Studio */
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Video & Timeline (Left 3 columns) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Studio Mode Selector Tabs */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12141e]/90 p-1.5 shadow-xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => setStudioMode('watermark')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  studioMode === 'watermark'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>Watermarks</span>
                {boxes.length > 0 && (
                  <span className="ml-1 rounded-full bg-purple-950/80 px-1.5 py-0.5 text-[10px] text-purple-200 border border-purple-400/30">
                    {boxes.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStudioMode('text');
                  setSelectTool('draw');
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  studioMode === 'text'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Type className="h-4 w-4" />
                <span>Text Edit / Replace</span>
                {(textOverlays.length > 0 || boxes.filter((b) => b.replacement_text !== undefined).length > 0) && (
                  <span className="ml-1 rounded-full bg-cyan-950/80 px-1.5 py-0.5 text-[10px] text-cyan-200 border border-cyan-400/30">
                    {textOverlays.length + boxes.filter((b) => b.replacement_text !== undefined).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStudioMode('cut_stitch')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  studioMode === 'cut_stitch'
                    ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-orange-600 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Scissors className="h-4 w-4" />
                <span>Cut & Stitch</span>
                {(cutRanges.length > 0 || insertClips.length > 0) && (
                  <span className="ml-1 rounded-full bg-rose-950/80 px-1.5 py-0.5 text-[10px] text-rose-200 border border-rose-400/30">
                    {cutRanges.length}c • {insertClips.length}v
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStudioMode('audio')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                  studioMode === 'audio'
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Music className="h-4 w-4" />
                <span>Audio Studio</span>
                {audioMode !== 'original' && (
                  <span className="ml-1 rounded-full bg-emerald-950/80 px-1.5 py-0.5 text-[10px] text-emerald-200 border border-emerald-400/30 font-mono">
                    {audioMode === 'mute' ? 'Muted' : audioMode === 'replace' ? 'Replaced' : 'Mixed'}
                  </span>
                )}
              </button>
            </div>

            {/* Context Toolbar */}
            {studioMode === 'watermark' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#12141e]/90 px-4 py-2.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1.5">Selection Tool:</span>
                  <button
                    type="button"
                    onClick={() => setSelectTool('draw')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      selectTool === 'draw'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                        : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    <span>Draw Box</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectTool('select')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      selectTool === 'select'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                        : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                  >
                    <MousePointer className="h-3.5 w-3.5" />
                    <span>Move & Resize</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  {selectedBoxId ? (
                    <span className="text-purple-300 font-medium">
                      1 watermark selected • Add replacement text or set timestamp below
                    </span>
                  ) : (
                    <span>Click & drag anywhere on video to add a watermark box</span>
                  )}
                </div>
              </div>
            ) : studioMode === 'text' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-2.5 shadow-xl backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Tool:</span>
                  <button
                    type="button"
                    onClick={() => setSelectTool('draw')}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      selectTool === 'draw'
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300 font-extrabold'
                        : 'text-cyan-200 hover:text-white bg-white/5 border border-cyan-500/30'
                    }`}
                    title="Click & drag over unwanted text on video to select and replace it"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    <span>🔲 Select Old Text on Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectTool('select')}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      selectTool === 'select'
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300 font-bold'
                        : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                    title="Move or resize existing text boxes"
                  >
                    <MousePointer className="h-3.5 w-3.5" />
                    <span>Move & Resize</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDetect}
                    disabled={isDetecting}
                    className="flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/25 transition-all"
                    title="Auto-detect watermarks/text on this frame to replace"
                  >
                    <Wand2 className={`h-3.5 w-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                    <span>Auto-Detect Text</span>
                  </button>

                  <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />

                  <button
                    type="button"
                    onClick={() => addTextOverlay()}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                    title="Add a new floating text overlay anywhere on the video"
                  >
                    <Plus className="h-3.5 w-3.5 text-cyan-400" />
                    <span>+ Floating Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addTextOverlay('handle')}
                    className="rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-all"
                  >
                    + @Handle
                  </button>
                </div>

                <div className="text-[11px] font-mono text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  Playhead: {formatSec(currentTime)}
                </div>
              </div>
            ) : studioMode === 'cut_stitch' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 px-4 py-2.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-200">
                  <Scissors className="h-4 w-4 text-rose-400" />
                  <span>Cut & Stitch Studio Active</span>
                  <span className="text-[11px] text-slate-400 font-normal ml-2">
                    Mark start and end points below to remove unwanted video parts or add custom clips.
                  </span>
                </div>
                <div className="text-[11px] font-mono text-rose-300 bg-rose-900/60 px-2 py-0.5 rounded border border-rose-500/30">
                  Playhead: {formatSec(currentTime)}
                </div>
              </div>
            ) : (
              /* AUDIO STUDIO TOOLBAR */
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                  <Music className="h-4 w-4 text-emerald-400" />
                  <span>Audio Studio:</span>
                  <span className="text-[11px] text-slate-300 font-normal">
                    {audioMode === 'mute'
                      ? '🔇 Sound stripped completely (100% silent video)'
                      : audioMode === 'replace'
                      ? '🎧 Original sound replaced with uploaded audio'
                      : audioMode === 'mix'
                      ? '🎚️ Blending original dialogue with new background music'
                      : '🎵 Keeping original video audio stream'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1 font-semibold text-emerald-200 hover:bg-emerald-600/30 transition-all">
                    <Upload className="h-3 w-3" />
                    <span>{isUploadingAudio ? 'Uploading...' : uploadedAudio ? 'Replace Audio File' : '+ Upload Audio'}</span>
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.wma"
                      onChange={handleAudioUpload}
                      disabled={isUploadingAudio}
                      className="hidden"
                    />
                  </label>
                  {uploadedAudio && (
                    <button
                      type="button"
                      onClick={toggleAudioPreview}
                      className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-1 text-emerald-100 font-semibold hover:bg-emerald-500/30"
                    >
                      {isPlayingAudioPreview ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      <span>{isPlayingAudioPreview ? 'Pause Audio' : 'Preview Audio'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Video Player & Selection Canvas */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07080d] p-3 flex items-center justify-center min-h-[360px] max-h-[62vh] shadow-2xl">
              <div
                className="relative flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-black"
                style={{
                  aspectRatio: `${metadata.width} / ${metadata.height}`,
                  maxHeight: '56vh',
                  maxWidth: '100%',
                }}
              >
                <video
                  ref={videoRef}
                  src={metadata.url}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-fill block pointer-events-none select-none"
                />

                {/* Interactive Bounding Box Overlay Layer (Draw, Move, Resize directly on video) */}
                <div
                  ref={overlayRef}
                  onPointerDown={handlePointerDownOverlay}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`absolute inset-0 select-none touch-none ${
                    selectTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                >
                  {/* Drawing live preview indicator */}
                  {(() => {
                    if (
                      interaction?.type !== 'draw' ||
                      interaction.currClientX === undefined ||
                      interaction.currClientY === undefined ||
                      !metadata ||
                      !overlayRef.current
                    )
                      return null;
                    const p1 = getOverlayPoint(interaction.startClientX, interaction.startClientY);
                    const p2 = getOverlayPoint(interaction.currClientX, interaction.currClientY);
                    const leftPct = (Math.min(p1.videoX, p2.videoX) / metadata.width) * 100;
                    const topPct = (Math.min(p1.videoY, p2.videoY) / metadata.height) * 100;
                    const widthPct = (Math.abs(p2.videoX - p1.videoX) / metadata.width) * 100;
                    const heightPct = (Math.abs(p2.videoY - p1.videoY) / metadata.height) * 100;
                    const wPx = Math.abs(p2.videoX - p1.videoX);
                    const hPx = Math.abs(p2.videoY - p1.videoY);

                    return (
                      <div
                        className="absolute border-2 border-purple-400 bg-purple-500/30 rounded pointer-events-none z-30 shadow-lg"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                      >
                        <div className="absolute -top-7 left-0 rounded bg-purple-950/95 border border-purple-400/80 px-1.5 py-0.5 text-[10px] font-mono font-bold text-purple-200 shadow-md whitespace-nowrap">
                          {wPx} × {hPx} px
                        </div>
                      </div>
                    );
                  })()}

                  {/* Rendered bounding boxes with interactive selection & handles */}
                  {boxes.map((box) => {
                    const isSelected = selectedBoxId === box.id;
                    const isTimeActive =
                      (box.start_time == null || currentTime >= box.start_time) &&
                      (box.end_time == null || currentTime <= box.end_time);

                    const leftPct = (box.x / metadata.width) * 100;
                    const topPct = (box.y / metadata.height) * 100;
                    const widthPct = (box.width / metadata.width) * 100;
                    const heightPct = (box.height / metadata.height) * 100;

                    return (
                      <div
                        key={box.id}
                        onPointerDown={(e) => handlePointerDownBox(e, box)}
                        className={`absolute rounded transition-all group ${
                          isSelected
                            ? isTimeActive
                              ? 'border-2 border-purple-400 bg-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.5)] z-20 cursor-move'
                              : 'border-2 border-dashed border-amber-400/90 bg-amber-500/15 shadow-[0_0_12px_rgba(251,191,36,0.3)] z-20 cursor-move opacity-80'
                            : isTimeActive
                              ? 'border-2 border-purple-400/70 bg-purple-500/20 hover:border-purple-300 hover:bg-purple-500/30 z-10 cursor-pointer'
                              : 'border-2 border-dashed border-slate-500/40 bg-slate-800/20 opacity-40 hover:opacity-75 z-10 cursor-pointer'
                        }`}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                      >
                        {/* Title pill and delete button */}
                        <div
                          className={`absolute -top-6 left-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border shadow-lg whitespace-nowrap select-none ${
                            box.replacement_text !== undefined
                              ? isSelected
                                ? 'bg-cyan-950/95 text-cyan-100 border-cyan-400 ring-1 ring-cyan-300'
                                : 'bg-cyan-950/80 text-cyan-200 border-cyan-500/50'
                              : isSelected
                                ? 'bg-purple-950/95 text-white border-purple-400/80 ring-1 ring-purple-400/50'
                                : isTimeActive
                                  ? 'bg-black/90 text-purple-200 border-purple-500/40'
                                  : 'bg-slate-900/90 text-slate-400 border-slate-700'
                          }`}
                        >
                          {box.replacement_text !== undefined ? (
                            <span className="font-bold flex items-center gap-1 text-cyan-300">
                              <span>✏️ Replace:</span>
                              <span className="text-white truncate max-w-[140px]">
                                "{box.replacement_text || 'Type New Text'}"
                              </span>
                            </span>
                          ) : (
                            <span>{box.label}</span>
                          )}
                          <span className="text-[9px] text-purple-300 font-mono">
                            ({box.width}×{box.height})
                          </span>
                          <span
                            className={`rounded px-1 text-[9px] font-mono ${
                              isTimeActive
                                ? 'text-emerald-300 bg-emerald-950/60'
                                : 'text-amber-300 bg-amber-950/60'
                            }`}
                          >
                            ⏱️ {box.start_time != null ? `${formatSec(box.start_time)}→${box.end_time != null ? formatSec(box.end_time) : 'End'}` : 'Full Video'}
                          </span>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBox(box.id);
                            }}
                            className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
                            title="Delete this region (or press Del)"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Live replacement text preview inside watermark box (covers old text) */}
                        {box.replacement_text !== undefined && (
                          <div
                            className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden pointer-events-none select-none font-bold text-center"
                            style={{
                              color: box.font_color || 'white',
                              fontSize: `${Math.max(12, Math.min(28, (box.font_size || 32) * 0.45))}px`,
                              backgroundColor:
                                box.bg_color === 'transparent'
                                  ? 'transparent'
                                  : box.bg_color?.startsWith('black@')
                                    ? `rgba(0,0,0,${box.bg_color.split('@')[1] || '0.75'})`
                                    : 'rgba(0,0,0,0.85)',
                            }}
                          >
                            <span className="truncate">
                              {box.replacement_text || (isSelected ? '✍️ Type new text...' : '(Old text replaced)')}
                            </span>
                          </div>
                        )}

                        {/* 8 Resize Handles when box is selected */}
                        {isSelected && (
                          <>
                            {/* NW */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'nw')}
                              className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* N */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'n')}
                              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-ns-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* NE */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'ne')}
                              className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* E */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'e')}
                              className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-ew-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* SE */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'se')}
                              className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* S */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 's')}
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-ns-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* SW */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'sw')}
                              className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                            />
                            {/* W */}
                            <div
                              onPointerDown={(e) => handlePointerDownHandle(e, box, 'w')}
                              className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-purple-600 rounded-sm shadow-md cursor-ew-resize z-30 hover:scale-125 transition-transform"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Rendered Text Overlays with interactive movement */}
                  {textOverlays.map((to) => {
                    const isSelected = selectedTextId === to.id;
                    const isTimeActive =
                      (to.start_time == null || currentTime >= to.start_time) &&
                      (to.end_time == null || currentTime <= to.end_time);

                    const leftPct = (to.x / metadata.width) * 100;
                    const topPct = (to.y / metadata.height) * 100;

                    return (
                      <div
                        key={to.id}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedTextId(to.id);
                          setSelectedBoxId(null);
                          if (overlayRef.current) {
                            try {
                              overlayRef.current.setPointerCapture(e.pointerId);
                            } catch {}
                          }
                          setInteraction({
                            type: 'move',
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            textId: to.id,
                            origText: { ...to },
                          });
                        }}
                        className={`absolute select-none cursor-move rounded-lg px-2.5 py-1 transition-all z-25 font-bold ${
                          isSelected
                            ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.7)]'
                            : 'hover:ring-1 hover:ring-cyan-300/60'
                        } ${!isTimeActive ? 'opacity-40 border border-dashed border-cyan-500/40' : ''}`}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          color: to.font_color || 'white',
                          fontSize: `${Math.max(12, Math.min(48, (to.font_size || 36) * 0.45))}px`,
                          backgroundColor: to.bg_color === 'transparent' ? 'transparent' : 'rgba(0,0,0,0.65)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span>{to.text}</span>
                          {isSelected && (
                            <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/80 px-1 rounded">
                              Drag to move
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Video Scrubber Component with Active Overlay Ranges, Cuts & Text */}
            <VideoTimelineScrubber
              metadata={metadata}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onPlayToggle={togglePlay}
              onSeek={handleSeek}
              boxes={boxes}
              selectedBoxId={selectedBoxId}
              onSelectBox={setSelectedBoxId}
              cutRanges={cutRanges}
              selectedCutId={selectedCutId}
              onSelectCut={setSelectedCutId}
              onUpdateCut={updateCutTiming}
              cutStartMark={cutStartMark}
              textOverlays={textOverlays}
              selectedTextId={selectedTextId}
              onSelectText={setSelectedTextId}
            />

            {/* STUDIO MODE CONTENT: Watermark Inpainting vs Cut & Stitch */}
            {studioMode === 'watermark' ? (
              <div className="flex flex-col gap-4">
                {/* Quick Watermark Zone Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                  <span className="text-[11px] font-medium text-slate-400">1-Click Watermark Presets:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => addPreset('handle')}
                      className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300 hover:bg-purple-500/20 transition-all"
                    >
                      + Instagram @Handle
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset('logo')}
                      className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/20 transition-all"
                    >
                      + Top-Right Logo
                    </button>
                    <button
                      type="button"
                      onClick={() => addPreset('bottom_right')}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20 transition-all"
                    >
                      + Audio / Bottom Tag
                    </button>
                    {boxes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBoxes([])}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition-all ml-2"
                      >
                        Clear All ({boxes.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Box Timing Inspector (Appears when any box is selected) */}
                {(() => {
                  const selectedBox = boxes.find((b) => b.id === selectedBoxId);
                  if (!selectedBox) return null;

                  return (
                    <div className="flex flex-col gap-3 rounded-2xl border border-purple-500/40 bg-purple-950/40 p-4 shadow-xl backdrop-blur-md animate-fadeIn">
                      {/* Top Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-purple-500/20">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                Target Timing: <span className="text-purple-300 font-semibold">{selectedBox.label}</span>
                              </span>
                              <span className="rounded bg-purple-900/70 px-2 py-0.5 text-[11px] font-mono text-purple-200 border border-purple-400/40">
                                {selectedBox.start_time != null || selectedBox.end_time != null
                                  ? `${formatSec(selectedBox.start_time ?? 0)} → ${selectedBox.end_time != null ? formatSec(selectedBox.end_time) : formatSec(metadata.duration_sec)}`
                                  : '0:00 → End (Full Video)'}
                              </span>
                              {selectedBox.start_time != null || selectedBox.end_time != null ? (
                                <span className="text-[10px] text-purple-300/80 font-mono">
                                  ({Math.round(((selectedBox.end_time ?? metadata.duration_sec) - (selectedBox.start_time ?? 0)) * 10) / 10}s active)
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {selectedBox.start_time != null || selectedBox.end_time != null
                                ? `Watermark will ONLY be removed between ${formatSec(selectedBox.start_time ?? 0)} and ${selectedBox.end_time != null ? formatSec(selectedBox.end_time) : 'the end of video'}.`
                                : 'Watermark is removed across the entire video duration.'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => updateBoxTiming(selectedBox.id, undefined, undefined)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all shadow-sm ${
                            selectedBox.start_time == null && selectedBox.end_time == null
                              ? 'border-purple-500 bg-purple-600/30 text-white font-bold ring-1 ring-purple-400'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                          title="Apply watermark removal to the entire video (0:00 to end)"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Full Video</span>
                        </button>
                      </div>

                      {/* Independent Start (In) and End (Out) Control Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Start (In-Point) Card */}
                        <div className="rounded-xl border border-purple-500/30 bg-black/40 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-purple-300 flex items-center gap-1.5">
                              <span>⏱️ Start Time:</span>
                              <span className="font-mono text-white text-xs bg-purple-900/80 px-2 py-0.5 rounded border border-purple-400/40">
                                {selectedBox.start_time != null ? formatSec(selectedBox.start_time) : '0:00.0 (Video Start)'}
                              </span>
                            </span>
                            {selectedBox.start_time != null && (
                              <button
                                type="button"
                                onClick={() => handleSeek(selectedBox.start_time!)}
                                className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer"
                              >
                                Jump to Frame
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'start', -1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 1.0 second"
                            >
                              -1.0s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'start', -0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 0.1 second"
                            >
                              -0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'start', 0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 0.1 second"
                            >
                              +0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'start', 1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 1.0 second"
                            >
                              +1.0s
                            </button>
                            <button
                              type="button"
                              onClick={() => setBoxPointToPlayhead(selectedBox.id, 'start')}
                              className="flex-1 rounded-lg border border-purple-500/50 bg-purple-600/30 py-1 text-[11px] font-bold text-purple-100 hover:bg-purple-600/50 transition-all text-center truncate shadow-sm ml-1"
                              title="Set Start to current playhead timestamp"
                            >
                              📍 Playhead ({formatSec(currentTime)})
                            </button>
                          </div>
                        </div>

                        {/* End (Out-Point) Card */}
                        <div className="rounded-xl border border-indigo-500/30 bg-black/40 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                              <span>⏱️ End Time:</span>
                              <span className="font-mono text-white text-xs bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-400/40">
                                {selectedBox.end_time != null ? formatSec(selectedBox.end_time) : `${formatSec(metadata.duration_sec)} (End)`}
                              </span>
                            </span>
                            {selectedBox.end_time != null && (
                              <button
                                type="button"
                                onClick={() => handleSeek(selectedBox.end_time!)}
                                className="text-[10px] text-indigo-300 hover:text-white underline cursor-pointer"
                              >
                                Jump to Frame
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'end', -1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 1.0 second"
                            >
                              -1.0s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'end', -0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 0.1 second"
                            >
                              -0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'end', 0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 0.1 second"
                            >
                              +0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBoxTiming(selectedBox.id, 'end', 1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 1.0 second"
                            >
                              +1.0s
                            </button>
                            <button
                              type="button"
                              onClick={() => setBoxPointToPlayhead(selectedBox.id, 'end')}
                              className="flex-1 rounded-lg border border-indigo-500/50 bg-indigo-600/30 py-1 text-[11px] font-bold text-indigo-100 hover:bg-indigo-600/50 transition-all text-center truncate shadow-sm ml-1"
                              title="Set End to current playhead timestamp"
                            >
                              📍 Playhead ({formatSec(currentTime)})
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Text Replacement Input & Style for Watermark */}
                      <div className="w-full mt-2 pt-2.5 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                          <div className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold whitespace-nowrap">
                            <Type className="h-3.5 w-3.5 text-purple-400" />
                            <span>Replace With Text:</span>
                          </div>
                          <input
                            type="text"
                            value={selectedBox.replacement_text || ''}
                            onChange={(e) => updateBoxReplacement(selectedBox.id, e.target.value)}
                            placeholder="Type new text to burn over cleaned watermark..."
                            className="flex-1 rounded-lg border border-purple-500/30 bg-purple-950/60 px-2.5 py-1 text-xs text-white placeholder-purple-400/50 focus:border-purple-400 focus:outline-none"
                          />
                        </div>

                        {selectedBox.replacement_text && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[10px] text-slate-400">Color:</span>
                            {['white', 'yellow', 'cyan', 'lime', 'coral'].map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => updateBoxReplacement(selectedBox.id, undefined, undefined, c)}
                                className={`h-4 w-4 rounded-full border ${
                                  (selectedBox.font_color || 'white') === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                            <span className="text-[10px] text-slate-400 ml-1">Size:</span>
                            {[24, 32, 42].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateBoxReplacement(selectedBox.id, undefined, s)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                  (selectedBox.font_size || 32) === s
                                    ? 'bg-purple-500 text-white font-bold'
                                    : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s}px
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Selected Targets List with Timestamp Status */}
                {boxes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-400 mr-2">
                      <Tag className="h-3.5 w-3.5 text-purple-400" />
                      <span>Tracked Video Overlays ({boxes.length}):</span>
                    </div>
                    {boxes.map((b) => {
                      const isSelected = selectedBoxId === b.id;
                      const isTimeActive =
                        (b.start_time == null || currentTime >= b.start_time) &&
                        (b.end_time == null || currentTime <= b.end_time);

                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBoxId(b.id)}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-400 bg-purple-500/25 text-white ring-1 ring-purple-400/50 shadow-md'
                              : 'border-white/10 bg-white/5 text-purple-200 hover:bg-white/10'
                          }`}
                        >
                          <span className="font-semibold">{b.label}</span>
                          {b.replacement_text && (
                            <span className="rounded bg-cyan-950/70 text-cyan-300 px-1 text-[9px] font-mono border border-cyan-400/30">
                              → "{b.replacement_text}"
                            </span>
                          )}
                          <span className="text-[10px] text-purple-300 font-mono">
                            {b.width}x{b.height}px
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${
                              isTimeActive
                                ? 'bg-purple-900/60 text-purple-200 border border-purple-400/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            ⏱️ {b.start_time != null ? `${formatSec(b.start_time)}→${b.end_time != null ? formatSec(b.end_time) : 'End'}` : 'Full Video'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBox(b.id);
                            }}
                            className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
                            title="Delete this watermark overlay"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : studioMode === 'text' ? (
              /* TEXT EDIT & REPLACEMENT STUDIO */
              <div className="flex flex-col gap-4">
                {/* Active Inspector (Works for both Text Replacements on video and Floating Overlays) */}
                {(() => {
                  const selectedBox = boxes.find((b) => b.id === selectedBoxId);
                  const selectedText = textOverlays.find((t) => t.id === selectedTextId);

                  // CASE 1: A Bounding Box is selected for Text Replacement!
                  if (selectedBox) {
                    return (
                      <div className="flex flex-col gap-3.5 rounded-2xl border-2 border-cyan-500/50 bg-[#0d1624]/95 p-4 shadow-xl backdrop-blur-md animate-fadeIn">
                        {/* Header: Replace Old Text */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              <Edit3 className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>Replace Old Text on Video</span>
                                </h4>
                                <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono text-cyan-200 border border-cyan-400/40">
                                  Area: {selectedBox.width}×{selectedBox.height}px
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Old text inside this selected region will be erased and replaced with your new text.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                updateBoxReplacement(selectedBox.id, '');
                              }}
                              className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded-lg border border-white/5 bg-white/5"
                              title="Clear text (keeps region as watermark inpaint)"
                            >
                              Clear Text
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBox(selectedBox.id)}
                              className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition-all"
                              title="Delete this region"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Region</span>
                            </button>
                          </div>
                        </div>

                        {/* Big New Replacement Text Input */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-cyan-300 flex items-center justify-between">
                            <span>Type New Text to Replace Old Text:</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Live preview visible on video canvas above
                            </span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              autoFocus
                              value={selectedBox.replacement_text || ''}
                              onChange={(e) => updateBoxReplacement(selectedBox.id, e.target.value)}
                              placeholder="Type new replacement text here (e.g. @mynewhandle, Follow Us, etc.)..."
                              className="w-full rounded-xl border-2 border-cyan-500/60 bg-black/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-bold tracking-wide"
                            />
                            {selectedBox.replacement_text && (
                              <button
                                type="button"
                                onClick={() => updateBoxReplacement(selectedBox.id, '')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Quick suggestions chips */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-500">Quick suggestions:</span>
                            {['@your_handle', 'Subscribe Now 🔥', 'Created with AI', 'Follow for more'].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateBoxReplacement(selectedBox.id, s)}
                                className="rounded-md border border-cyan-500/20 bg-cyan-950/40 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-900/60 hover:text-white transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Styling: Color, Font Size, Background Cover */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-cyan-500/20 text-xs">
                          {/* Font Color */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-300">Text Color:</span>
                            <div className="flex items-center gap-1.5">
                              {[
                                { id: 'white', name: 'White', color: '#ffffff' },
                                { id: 'yellow', name: 'Yellow', color: '#facc15' },
                                { id: 'cyan', name: 'Cyan', color: '#22d3ee' },
                                { id: 'gold', name: 'Gold', color: '#fbbf24' },
                                { id: 'lime', name: 'Lime', color: '#a3e635' },
                                { id: 'coral', name: 'Coral', color: '#f87171' },
                                { id: 'black', name: 'Black', color: '#000000' },
                              ].map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => updateBoxReplacement(selectedBox.id, undefined, undefined, c.id)}
                                  className={`h-5 w-5 rounded-full border transition-all ${
                                    (selectedBox.font_color || 'white') === c.id
                                      ? 'ring-2 ring-white scale-125 border-cyan-400'
                                      : 'border-white/20 opacity-70 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: c.color }}
                                  title={c.name}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Font Size */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-slate-300">Size:</span>
                            {[20, 28, 36, 48, 64].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateBoxReplacement(selectedBox.id, undefined, s)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                                  (selectedBox.font_size || 32) === s
                                    ? 'bg-cyan-500 text-black shadow-sm'
                                    : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s}px
                              </button>
                            ))}
                          </div>

                          {/* Background Cover Pill */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-slate-300">Background Cover:</span>
                            {[
                              { id: 'black@0.65', label: 'Dark Translucent' },
                              { id: 'black@0.95', label: 'Solid Black' },
                              { id: 'transparent', label: 'Transparent' },
                            ].map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => updateBoxReplacement(selectedBox.id, undefined, undefined, undefined, b.id)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                                  (selectedBox.bg_color || 'black@0.7') === b.id
                                    ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-400/50'
                                    : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                                }`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Dual Independent Timing Controls */}
                        <div className="flex flex-col gap-2.5 pt-2.5 border-t border-cyan-500/20 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-cyan-400" />
                              <span className="text-[11px] text-slate-400">Replaced Duration:</span>
                              <span className="rounded bg-cyan-900/60 px-2 py-0.5 text-[10px] font-mono text-cyan-200 border border-cyan-400/30">
                                {selectedBox.start_time != null || selectedBox.end_time != null
                                  ? `${formatSec(selectedBox.start_time ?? 0)} → ${selectedBox.end_time != null ? formatSec(selectedBox.end_time) : formatSec(metadata.duration_sec)}`
                                  : '0:00 → End (Full Video)'}
                              </span>
                              {selectedBox.start_time != null || selectedBox.end_time != null ? (
                                <span className="text-[10px] text-cyan-300/80 font-mono">
                                  ({Math.round(((selectedBox.end_time ?? metadata.duration_sec) - (selectedBox.start_time ?? 0)) * 10) / 10}s active)
                                </span>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => updateBoxTiming(selectedBox.id, undefined, undefined)}
                              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs transition-all ${
                                selectedBox.start_time == null && selectedBox.end_time == null
                                  ? 'border-cyan-400 bg-cyan-500/30 text-white font-bold ring-1 ring-cyan-300'
                                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                              }`}
                              title="Replace across the entire video"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Full Video</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {/* Start Time Card */}
                            <div className="rounded-xl border border-cyan-500/30 bg-black/40 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                                  <span>Start:</span>
                                  <span className="font-mono text-white text-xs bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-400/30">
                                    {selectedBox.start_time != null ? formatSec(selectedBox.start_time) : '0:00.0 (Start)'}
                                  </span>
                                </span>
                                {selectedBox.start_time != null && (
                                  <button
                                    type="button"
                                    onClick={() => handleSeek(selectedBox.start_time!)}
                                    className="text-[10px] text-cyan-300 hover:text-white underline cursor-pointer"
                                  >
                                    Jump
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'start', -1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'start', -0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'start', 0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'start', 1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBoxPointToPlayhead(selectedBox.id, 'start')}
                                  className="flex-1 rounded border border-cyan-500/40 bg-cyan-600/30 py-0.5 text-[10px] font-bold text-cyan-100 hover:bg-cyan-600/50 truncate text-center"
                                  title="Set Start to current playhead position"
                                >
                                  📍 Playhead ({formatSec(currentTime)})
                                </button>
                              </div>
                            </div>

                            {/* End Time Card */}
                            <div className="rounded-xl border border-blue-500/30 bg-black/40 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-blue-300 flex items-center gap-1.5">
                                  <span>End:</span>
                                  <span className="font-mono text-white text-xs bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-400/30">
                                    {selectedBox.end_time != null ? formatSec(selectedBox.end_time) : `${formatSec(metadata.duration_sec)} (End)`}
                                  </span>
                                </span>
                                {selectedBox.end_time != null && (
                                  <button
                                    type="button"
                                    onClick={() => handleSeek(selectedBox.end_time!)}
                                    className="text-[10px] text-blue-300 hover:text-white underline cursor-pointer"
                                  >
                                    Jump
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'end', -1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'end', -0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'end', 0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustBoxTiming(selectedBox.id, 'end', 1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBoxPointToPlayhead(selectedBox.id, 'end')}
                                  className="flex-1 rounded border border-blue-500/40 bg-blue-600/30 py-0.5 text-[10px] font-bold text-blue-100 hover:bg-blue-600/50 truncate text-center"
                                  title="Set End to current playhead position"
                                >
                                  📍 Playhead ({formatSec(currentTime)})
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // CASE 2: A Floating Text Overlay is selected!
                  if (selectedText) {
                    return (
                      <div className="flex flex-col gap-3 rounded-2xl border border-cyan-500/40 bg-cyan-950/30 p-4 shadow-xl backdrop-blur-md animate-fadeIn">
                        {/* Header with edit text input */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              <Type className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[11px] font-bold text-cyan-200">Floating Text Overlay Content:</label>
                              <input
                                type="text"
                                value={selectedText.text}
                                onChange={(e) => updateTextOverlay(selectedText.id, { text: e.target.value })}
                                placeholder="Type floating text content..."
                                className="mt-1 w-full rounded-xl border border-cyan-500/40 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-semibold"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => deleteTextOverlay(selectedText.id)}
                              className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition-all"
                              title="Delete this text layer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Styling: Color, Font Size, Background Pill */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-cyan-500/20 text-xs">
                          {/* Font Color */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-300">Color:</span>
                            <div className="flex items-center gap-1.5">
                              {[
                                { id: 'white', name: 'White', color: '#ffffff' },
                                { id: 'yellow', name: 'Yellow', color: '#facc15' },
                                { id: 'cyan', name: 'Cyan', color: '#22d3ee' },
                                { id: 'gold', name: 'Gold', color: '#fbbf24' },
                                { id: 'lime', name: 'Lime', color: '#a3e635' },
                                { id: 'coral', name: 'Coral', color: '#f87171' },
                                { id: 'black', name: 'Black', color: '#000000' },
                              ].map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => updateTextOverlay(selectedText.id, { font_color: c.id })}
                                  className={`h-5 w-5 rounded-full border transition-all ${
                                    (selectedText.font_color || 'white') === c.id
                                      ? 'ring-2 ring-white scale-125 border-cyan-400'
                                      : 'border-white/20 opacity-70 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: c.color }}
                                  title={c.name}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Font Size */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-slate-300">Size:</span>
                            {[24, 32, 42, 56].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateTextOverlay(selectedText.id, { font_size: s })}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                                  (selectedText.font_size || 36) === s
                                    ? 'bg-cyan-500 text-black shadow-sm'
                                    : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s}px
                              </button>
                            ))}
                          </div>

                          {/* Background Pill */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-slate-300">Background:</span>
                            {[
                              { id: 'black@0.6', label: 'Dark Pill' },
                              { id: 'black@0.9', label: 'Solid' },
                              { id: 'transparent', label: 'None' },
                            ].map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => updateTextOverlay(selectedText.id, { bg_color: b.id })}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                                  (selectedText.bg_color || 'black@0.6') === b.id
                                    ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-400/50'
                                    : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                                }`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Dual Independent Timing Controls */}
                        <div className="flex flex-col gap-2.5 pt-2 border-t border-cyan-500/20 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-cyan-400" />
                              <span className="text-[11px] text-slate-400">Display Duration:</span>
                              <span className="rounded bg-cyan-900/60 px-2 py-0.5 text-[10px] font-mono text-cyan-200 border border-cyan-400/30">
                                {selectedText.start_time != null || selectedText.end_time != null
                                  ? `${formatSec(selectedText.start_time ?? 0)} → ${selectedText.end_time != null ? formatSec(selectedText.end_time) : formatSec(metadata.duration_sec)}`
                                  : '0:00 → End (Full Video)'}
                              </span>
                              {selectedText.start_time != null || selectedText.end_time != null ? (
                                <span className="text-[10px] text-cyan-300/80 font-mono">
                                  ({Math.round(((selectedText.end_time ?? metadata.duration_sec) - (selectedText.start_time ?? 0)) * 10) / 10}s active)
                                </span>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                updateTextOverlayTiming(selectedText.id, undefined, undefined)
                              }
                              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs transition-all ${
                                selectedText.start_time == null && selectedText.end_time == null
                                  ? 'border-cyan-400 bg-cyan-500/30 text-white font-bold ring-1 ring-cyan-300'
                                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                              }`}
                              title="Display across the entire video"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Full Video</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {/* Start Time Card */}
                            <div className="rounded-xl border border-cyan-500/30 bg-black/40 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                                  <span>Start:</span>
                                  <span className="font-mono text-white text-xs bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-400/30">
                                    {selectedText.start_time != null ? formatSec(selectedText.start_time) : '0:00.0 (Start)'}
                                  </span>
                                </span>
                                {selectedText.start_time != null && (
                                  <button
                                    type="button"
                                    onClick={() => handleSeek(selectedText.start_time!)}
                                    className="text-[10px] text-cyan-300 hover:text-white underline cursor-pointer"
                                  >
                                    Jump
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'start', -1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'start', -0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'start', 0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'start', 1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTextOverlayPointToPlayhead(selectedText.id, 'start')}
                                  className="flex-1 rounded border border-cyan-500/40 bg-cyan-600/30 py-0.5 text-[10px] font-bold text-cyan-100 hover:bg-cyan-600/50 truncate text-center"
                                  title="Set Start to current playhead position"
                                >
                                  📍 Playhead ({formatSec(currentTime)})
                                </button>
                              </div>
                            </div>

                            {/* End Time Card */}
                            <div className="rounded-xl border border-blue-500/30 bg-black/40 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-blue-300 flex items-center gap-1.5">
                                  <span>End:</span>
                                  <span className="font-mono text-white text-xs bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-400/30">
                                    {selectedText.end_time != null ? formatSec(selectedText.end_time) : `${formatSec(metadata.duration_sec)} (End)`}
                                  </span>
                                </span>
                                {selectedText.end_time != null && (
                                  <button
                                    type="button"
                                    onClick={() => handleSeek(selectedText.end_time!)}
                                    className="text-[10px] text-blue-300 hover:text-white underline cursor-pointer"
                                  >
                                    Jump
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'end', -1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'end', -0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  -0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'end', 0.1)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +0.1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTextOverlayTiming(selectedText.id, 'end', 1.0)}
                                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:bg-white/10"
                                >
                                  +1s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTextOverlayPointToPlayhead(selectedText.id, 'end')}
                                  className="flex-1 rounded border border-blue-500/40 bg-blue-600/30 py-0.5 text-[10px] font-bold text-blue-100 hover:bg-blue-600/50 truncate text-center"
                                  title="Set End to current playhead position"
                                >
                                  📍 Playhead ({formatSec(currentTime)})
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // CASE 3: Neither is selected! Prompt user with clear actions
                  return (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-cyan-500/30 bg-cyan-950/10 p-6 text-center text-xs">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        <Edit3 className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Select Old Text on Video to Replace</h4>
                        <p className="mt-1 text-[11px] text-slate-400 max-w-md">
                          Click <strong>"Select Old Text on Video"</strong> below and drag a box directly over any username, watermark, or subtitle on the video to replace it with your own text.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setSelectTool('draw')}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all cursor-pointer"
                        >
                          <Crosshair className="h-4 w-4" />
                          <span>🔲 Click & Drag over Old Text on Video</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDetect}
                          disabled={isDetecting}
                          className="flex items-center gap-1.5 rounded-xl border border-purple-500/50 bg-purple-500/20 px-3.5 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/30 transition-all"
                        >
                          <Wand2 className={`h-4 w-4 ${isDetecting ? 'animate-spin' : ''}`} />
                          <span>✨ Auto-Detect Old Text</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => addTextOverlay()}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                        >
                          <Plus className="h-4 w-4 text-cyan-400" />
                          <span>+ Add Floating Text</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Unified Text Replacements & Floating Overlays List */}
                {(boxes.length > 0 || textOverlays.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-cyan-300 mr-2">
                      <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Text Items ({boxes.length + textOverlays.length}):</span>
                    </div>

                    {/* Text Replacement Boxes */}
                    {boxes.map((b) => {
                      const isSelected = selectedBoxId === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSelectedBoxId(b.id);
                            setSelectedTextId(null);
                            if (b.start_time) handleSeek(b.start_time);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/25 text-white ring-1 ring-cyan-400/50 shadow-md'
                              : 'border-cyan-500/30 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-900/40'
                          }`}
                        >
                          <span className="font-bold text-cyan-300">✏️ Replace:</span>
                          <span className="font-semibold truncate max-w-[140px]">
                            {b.replacement_text ? `"${b.replacement_text}"` : '(Type new text)'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {b.width}×{b.height}px
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBox(b.id);
                            }}
                            className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
                            title="Remove this replacement"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Floating Text Overlays */}
                    {textOverlays.map((t, idx) => {
                      const isSelected = selectedTextId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedTextId(t.id);
                            setSelectedBoxId(null);
                            if (t.start_time) handleSeek(t.start_time);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/25 text-white ring-1 ring-cyan-400/50 shadow-md'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-[10px] text-cyan-400 font-mono">🔤 Overlay:</span>
                          <span className="font-semibold truncate max-w-[140px]">{t.text || `Text #${idx + 1}`}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTextOverlay(t.id);
                            }}
                            className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
                            title="Remove this text layer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : studioMode === 'cut_stitch' ? (
              /* CUT & STITCH CLIPS STUDIO */
              <div className="flex flex-col gap-4">
                {/* Cut Segment Marking / Creator Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <Scissors className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Cut / Trim Unwanted Video Scenes</span>
                        <span className="text-[11px] font-mono text-rose-300 bg-rose-900/60 px-2 py-0.5 rounded border border-rose-400/30">
                          Playhead: {formatSec(currentTime)}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {cutStartMark != null
                          ? `In-Point marked at ${formatSec(cutStartMark)}. Scrub playhead to the end of the scene and click 'Complete Cut'.`
                          : 'Set Start (In) and End (Out) points, or drag handles directly on the timeline scrubber above.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {cutStartMark == null ? (
                      <>
                        <button
                          type="button"
                          onClick={handleMarkCutStart}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-600/30 px-3.5 py-2 font-bold text-rose-200 hover:bg-rose-600/50 hover:border-rose-400 transition-all shadow-md shadow-rose-900/40"
                          title="Set In-Point to current playhead timestamp"
                        >
                          <Scissors className="h-3.5 w-3.5" />
                          <span>[ Mark Cut Start ({formatSec(currentTime)})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => addCutAtPlayhead(2.0)}
                          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all"
                          title="Add a 2-second cut at current playhead and fine-tune it"
                        >
                          <Plus className="h-3.5 w-3.5 text-rose-400" />
                          <span>+ Add 2s Cut</span>
                        </button>

                        <div className="h-5 w-[1px] bg-white/10 mx-1 hidden sm:block" />

                        <button
                          type="button"
                          onClick={() => handleQuickCut(3)}
                          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                          title="Cut next 3 seconds starting from current playhead"
                        >
                          <span>+3s</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickCut(5)}
                          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                          title="Cut next 5 seconds starting from current playhead"
                        >
                          <span>+5s</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCompleteCut}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/60 bg-emerald-600/30 px-3.5 py-2 font-bold text-emerald-200 hover:bg-emerald-600/50 hover:border-emerald-400 transition-all shadow-md shadow-emerald-900/40 animate-pulse"
                          title="Complete cut segment using current playhead as End Point"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Complete Cut ({formatSec(cutStartMark)} → {formatSec(currentTime)})</span>
                        </button>

                        {/* Quick complete offsets */}
                        <button
                          type="button"
                          onClick={() => handleCompleteCutWithDuration(2.0)}
                          className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-900/50"
                        >
                          +2s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteCutWithDuration(3.0)}
                          className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-900/50"
                        >
                          +3s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteCutWithDuration(5.0)}
                          className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-900/50"
                        >
                          +5s
                        </button>

                        <button
                          type="button"
                          onClick={() => setCutStartMark(null)}
                          className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Precision Selected Cut Inspector (Appears when any cut segment is selected) */}
                {(() => {
                  const selectedCut = cutRanges.find((c) => c.id === selectedCutId);
                  if (!selectedCut) return null;
                  const cutDuration = Math.round((selectedCut.end_time - selectedCut.start_time) * 10) / 10;

                  return (
                    <div className="rounded-2xl border-2 border-rose-500/50 bg-[#160c14]/90 p-4 shadow-xl backdrop-blur-md animate-fadeIn space-y-3">
                      {/* Inspector Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rose-500/20">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/30 text-rose-300 border border-rose-500/40">
                            <Scissors className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                Fine-Tune Cut: <span className="text-rose-300">{selectedCut.label}</span>
                              </span>
                              <span className="rounded-md bg-rose-900/80 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-200 border border-rose-400/40">
                                -{cutDuration}s will be removed
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              Adjust start/end timestamps below or drag the handles on the timeline.
                            </p>
                          </div>
                        </div>

                        {/* Cut Preview & Delete Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => previewCutSegment(selectedCut)}
                            className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-all shadow-sm"
                            title="Play only the segment that will be cut"
                          >
                            <Play className="h-3 w-3" />
                            <span>Play Cut Part</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => previewSkipCut(selectedCut)}
                            className="flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/30 transition-all shadow-sm"
                            title="Preview video playback with this cut skipped (simulates final edited video)"
                          >
                            <FastForward className="h-3.5 w-3.5" />
                            <span>Test Skip Transition</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteCut(selectedCut.id)}
                            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                            title="Delete this cut segment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Dual Start (In) and End (Out) Precision Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Cut Start Control Card */}
                        <div className="rounded-xl border border-rose-500/20 bg-black/40 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-rose-300 flex items-center gap-1.5">
                              <span>[ Cut Start (In-Point):</span>
                              <span className="font-mono text-white text-sm bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40">
                                {formatSec(selectedCut.start_time)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSeek(selectedCut.start_time)}
                              className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer"
                            >
                              Jump to Frame
                            </button>
                          </div>

                          {/* Stepper Buttons & Playhead Syncer */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('start', -1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 1.0 second"
                            >
                              -1.0s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('start', -0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 0.1 second"
                            >
                              -0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => setCutPointToPlayhead('start')}
                              className="flex-1 rounded-lg border border-rose-500/40 bg-rose-600/30 py-1 text-[11px] font-bold text-rose-100 hover:bg-rose-600/50 transition-all text-center truncate shadow-sm"
                              title="Set Cut Start to current playhead"
                            >
                              📍 Set to Playhead ({formatSec(currentTime)})
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('start', 0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 0.1 second"
                            >
                              +0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('start', 1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 1.0 second"
                            >
                              +1.0s
                            </button>
                          </div>
                        </div>

                        {/* Cut End Control Card */}
                        <div className="rounded-xl border border-rose-500/20 bg-black/40 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-rose-300 flex items-center gap-1.5">
                              <span>] Cut End (Out-Point):</span>
                              <span className="font-mono text-white text-sm bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40">
                                {formatSec(selectedCut.end_time)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSeek(selectedCut.end_time)}
                              className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer"
                            >
                              Jump to Frame
                            </button>
                          </div>

                          {/* Stepper Buttons & Playhead Syncer */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('end', -1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 1.0 second"
                            >
                              -1.0s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('end', -0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step backward 0.1 second"
                            >
                              -0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => setCutPointToPlayhead('end')}
                              className="flex-1 rounded-lg border border-rose-500/40 bg-rose-600/30 py-1 text-[11px] font-bold text-rose-100 hover:bg-rose-600/50 transition-all text-center truncate shadow-sm"
                              title="Set Cut End to current playhead"
                            >
                              📍 Set to Playhead ({formatSec(currentTime)})
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('end', 0.1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 0.1 second"
                            >
                              +0.1s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSelectedCut('end', 1.0)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Step forward 1.0 second"
                            >
                              +1.0s
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>💡 Tip: Drag the left edge [ or right edge ] on the scrubber above to visually resize this cut with live frame preview.</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCutId(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          Close Inspector ✕
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Cut Segments List */}
                {cutRanges.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/10 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-rose-300 mr-2">
                      <Scissors className="h-3.5 w-3.5 text-rose-400" />
                      <span>Segments to Cut ({cutRanges.length}):</span>
                    </div>
                    {cutRanges.map((cut, idx) => {
                      const isSelected = selectedCutId === cut.id;
                      const duration = Math.round((cut.end_time - cut.start_time) * 10) / 10;
                      return (
                        <div
                          key={cut.id}
                          onClick={() => {
                            setSelectedCutId(cut.id);
                            handleSeek(cut.start_time);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-rose-400 bg-rose-500/25 text-white ring-1 ring-rose-400/50 shadow-md'
                              : 'border-rose-500/30 bg-rose-950/30 text-rose-200 hover:bg-rose-900/40'
                          }`}
                        >
                          <span className="font-semibold">{cut.label || `Cut #${idx + 1}`}</span>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-black/50 text-rose-300 border border-rose-500/30">
                            {formatSec(cut.start_time)} → {formatSec(cut.end_time)} (-{duration}s)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCut(cut.id);
                            }}
                            className="text-slate-400 hover:text-rose-300 ml-1 transition-colors"
                            title="Remove this cut"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setCutRanges([])}
                      className="ml-auto text-[11px] text-slate-400 hover:text-rose-300"
                    >
                      Clear All Cuts
                    </button>
                  </div>
                )}

                {/* Add / Stitch Additional Clip (Intro / Outro) Section */}
                <div className="rounded-2xl border border-white/10 bg-[#12141e]/90 p-4 shadow-xl backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Film className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Stitch Additional Clip (Intro / Outro)</h4>
                        <p className="text-[11px] text-slate-400">
                          Add custom intro/outro videos. Video Engine automatically normalizes aspect ratio and audio tracks.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/30 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition-all shadow-sm">
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isUploadingClip ? 'Uploading Clip...' : '+ Upload Clip to Stitch'}</span>
                      <input
                        type="file"
                        accept=".mp4,.mov,.webm"
                        disabled={isUploadingClip}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadInsertClip(e.target.files[0], 'end');
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Inserted Clips List */}
                  {insertClips.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {insertClips.map((clip) => (
                        <div
                          key={clip.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d0e15] p-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {clip.preview_url ? (
                              <img
                                src={clip.preview_url}
                                alt={clip.filename}
                                className="h-10 w-10 rounded-lg object-cover border border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-300">
                                <Film className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate max-w-[150px]">{clip.filename}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {clip.duration_sec ? `${clip.duration_sec}s` : 'Video Clip'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleClipPosition(clip.id)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all ${
                                clip.position === 'start'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                              }`}
                              title="Click to toggle between Intro and Outro"
                            >
                              {clip.position === 'start' ? '🎬 Intro (Start)' : '🎬 Outro (End)'}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteInsertClip(clip.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                              title="Remove this clip"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-4 text-center text-slate-500 text-xs">
                      No additional clips added yet. Upload an intro or outro video above to stitch with your main video.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* AUDIO STUDIO WORKSTATION */
              <div className="flex flex-col gap-4">
                {/* Audio Master Control Header */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-xl backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Headphones className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>Audio Track & Sound Replacement Studio</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            audioMode === 'mute'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-400/40'
                              : audioMode === 'replace'
                              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-400/40'
                              : audioMode === 'mix'
                              ? 'bg-cyan-950/80 text-cyan-200 border-cyan-400/40'
                              : 'bg-white/10 text-slate-300 border-white/20'
                          }`}>
                            {audioMode === 'mute' ? '🔇 Mute (Silent Video)' : audioMode === 'replace' ? '🎧 Audio Replaced' : audioMode === 'mix' ? '🎚️ Mixed Audio' : '🎵 Original Audio'}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Completely remove existing sound from video and upload new background music or voiceovers.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-emerald-500/50 bg-emerald-600/30 hover:bg-emerald-600/50 px-3.5 py-2 text-xs font-bold text-emerald-100 transition-all shadow-md shadow-emerald-900/30">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploadingAudio ? 'Uploading Audio...' : uploadedAudio ? 'Replace Audio File' : '+ Upload New Audio (MP3/WAV)'}</span>
                      <input
                        ref={audioFileInputRef}
                        type="file"
                        accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.wma"
                        disabled={isUploadingAudio}
                        onChange={handleAudioUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* 4 Interactive Audio Mode Selection Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Mode 1: Original Audio */}
                  <div
                    onClick={() => setAudioMode('original')}
                    className={`cursor-pointer rounded-2xl border p-3.5 flex flex-col justify-between gap-2 transition-all shadow-md ${
                      audioMode === 'original'
                        ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-400/50 shadow-emerald-900/30'
                        : 'border-white/10 bg-[#12141e]/80 hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        audioMode === 'original' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/5 text-slate-400'
                      }`}>
                        <Volume2 className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        audioMode === 'original' ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {audioMode === 'original' ? '● Active' : 'Select'}
                      </span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Keep Original Audio</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Preserves original video sound with 100% lossless FFmpeg copy.
                      </p>
                    </div>
                  </div>

                  {/* Mode 2: Completely Remove Audio (Mute) */}
                  <div
                    onClick={() => setAudioMode('mute')}
                    className={`cursor-pointer rounded-2xl border p-3.5 flex flex-col justify-between gap-2 transition-all shadow-md ${
                      audioMode === 'mute'
                        ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-400/50 shadow-rose-900/30'
                        : 'border-white/10 bg-[#12141e]/80 hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        audioMode === 'mute' ? 'bg-rose-500/30 text-rose-300' : 'bg-white/5 text-slate-400'
                      }`}>
                        <VolumeX className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        audioMode === 'mute' ? 'text-rose-400' : 'text-slate-500'
                      }`}>
                        {audioMode === 'mute' ? '● Active' : 'Select'}
                      </span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Completely Remove Audio</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Strips all sound tracks. Exports a 100% silent video.
                      </p>
                    </div>
                  </div>

                  {/* Mode 3: Replace Audio Completely */}
                  <div
                    onClick={() => setAudioMode('replace')}
                    className={`cursor-pointer rounded-2xl border p-3.5 flex flex-col justify-between gap-2 transition-all shadow-md ${
                      audioMode === 'replace'
                        ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-400/50 shadow-cyan-900/30'
                        : 'border-white/10 bg-[#12141e]/80 hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        audioMode === 'replace' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/5 text-slate-400'
                      }`}>
                        <Headphones className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        audioMode === 'replace' ? 'text-cyan-400' : 'text-slate-500'
                      }`}>
                        {audioMode === 'replace' ? '● Active' : 'Select'}
                      </span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Replace Audio Track</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Removes old audio completely and burns in your new uploaded track.
                      </p>
                    </div>
                  </div>

                  {/* Mode 4: Mix Background Music */}
                  <div
                    onClick={() => setAudioMode('mix')}
                    className={`cursor-pointer rounded-2xl border p-3.5 flex flex-col justify-between gap-2 transition-all shadow-md ${
                      audioMode === 'mix'
                        ? 'border-teal-500 bg-teal-950/40 ring-1 ring-teal-400/50 shadow-teal-900/30'
                        : 'border-white/10 bg-[#12141e]/80 hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        audioMode === 'mix' ? 'bg-teal-500/30 text-teal-300' : 'bg-white/5 text-slate-400'
                      }`}>
                        <Radio className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        audioMode === 'mix' ? 'text-teal-400' : 'text-slate-500'
                      }`}>
                        {audioMode === 'mix' ? '● Active' : 'Select'}
                      </span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Mix Audio Streams</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Blends original video audio with new background music.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Uploaded Audio Inspector & Fine-Tuning Panel (shown for replace or mix mode) */}
                {(audioMode === 'replace' || audioMode === 'mix') && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-[#0f151c]/90 p-5 shadow-xl backdrop-blur-md animate-fadeIn space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <Music className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">
                            {audioMode === 'replace' ? 'New Replacement Audio Track' : 'Background Audio Track (Mixing)'}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {uploadedAudio
                              ? `Ready to mux with video (${formatSec(uploadedAudio.duration_sec)} duration)`
                              : 'Please upload an audio file (MP3, WAV, M4A, AAC, OGG)'}
                          </p>
                        </div>
                      </div>

                      {uploadedAudio && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleAudioPreview}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/30 transition-all shadow-sm cursor-pointer"
                          >
                            {isPlayingAudioPreview ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            <span>{isPlayingAudioPreview ? 'Pause Audio' : 'Preview Audio'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isPlayingAudioPreview && audioPreviewRef.current) {
                                audioPreviewRef.current.pause();
                                setIsPlayingAudioPreview(false);
                              }
                              setUploadedAudio(null);
                            }}
                            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Audio File Details or Upload Dropzone */}
                    {uploadedAudio ? (
                      <div className="flex flex-col gap-4">
                        {/* Audio Track Info Card */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-black/40 p-3 text-xs">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                              <Music className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{uploadedAudio.original_name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span className="font-mono text-emerald-300">Duration: {formatSec(uploadedAudio.duration_sec)}</span>
                                <span>•</span>
                                <span>Size: {(uploadedAudio.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                                <span>•</span>
                                <span className="text-slate-300">Target Video: {formatSec(metadata.duration_sec)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Hidden Audio player for in-browser preview */}
                          <audio
                            ref={audioPreviewRef}
                            src={uploadedAudio.url}
                            onEnded={() => setIsPlayingAudioPreview(false)}
                            className="hidden"
                          />
                        </div>

                        {/* Audio Controls Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* New Audio Volume Slider */}
                          <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-emerald-300">New Audio Track Volume:</span>
                              <span className="font-mono text-white text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-400/40">
                                {Math.round(newAudioVolume * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.05"
                              value={newAudioVolume}
                              onChange={(e) => setNewAudioVolume(parseFloat(e.target.value))}
                              className="w-full accent-emerald-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                              <span>0% (Silent)</span>
                              <span>100% (Normal)</span>
                              <span>200% (Boosted)</span>
                            </div>
                          </div>

                          {/* Original Audio Volume (shown only in Mix Mode) or Loop Settings */}
                          {audioMode === 'mix' ? (
                            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-teal-300">Original Video Audio Volume:</span>
                                <span className="font-mono text-white text-xs bg-teal-950/80 px-2 py-0.5 rounded border border-teal-400/40">
                                  {Math.round(originalAudioVolume * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={originalAudioVolume}
                                onChange={(e) => setOriginalAudioVolume(parseFloat(e.target.value))}
                                className="w-full accent-teal-500 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                <span>0% (Muted)</span>
                                <span>50% (Background Dialogue)</span>
                                <span>100% (Full)</span>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex flex-col justify-between">
                              <div>
                                <span className="font-bold text-emerald-300 text-xs">Seamless Audio Looping</span>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  If your audio track ({formatSec(uploadedAudio.duration_sec)}) is shorter than your video ({formatSec(metadata.duration_sec)}), loop it automatically until the video finishes.
                                </p>
                              </div>
                              <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-semibold text-white">
                                <input
                                  type="checkbox"
                                  checked={audioLoop}
                                  onChange={(e) => setAudioLoop(e.target.checked)}
                                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                                />
                                <span>Enable Audio Loop</span>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Extra Loop Option for Mix Mode */}
                        {audioMode === 'mix' && (
                          <div className="rounded-xl border border-white/10 bg-black/40 p-3 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-emerald-300 text-xs">Seamless Background Music Looping</span>
                              <p className="text-[11px] text-slate-400">
                                Loops background music continuously until the video ends.
                              </p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                              <input
                                type="checkbox"
                                checked={audioLoop}
                                onChange={(e) => setAudioLoop(e.target.checked)}
                                className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                              />
                              <span>Loop Music</span>
                            </label>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Empty Upload State */
                      <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-950/10 p-8 text-center cursor-pointer hover:bg-emerald-950/20 hover:border-emerald-500/50 transition-all">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Music className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            {isUploadingAudio ? 'Uploading & Analyzing Audio...' : 'Click to Upload Audio File or Drag Here'}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">
                            Supports MP3, WAV, M4A, AAC, OGG, FLAC (Up to 150MB)
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.wma"
                          disabled={isUploadingAudio}
                          onChange={handleAudioUpload}
                          className="hidden"
                        />
                      </label>
                    )}

                    {audioUploadError && (
                      <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                        <span>{audioUploadError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Video Settings Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            {/* Actions Panel */}
            <div className="rounded-2xl border border-white/10 bg-[#12141e]/90 p-5 shadow-xl backdrop-blur-md">
              <h3 className="text-sm font-bold text-white mb-3">AI Studio & Video Actions</h3>

              {/* Edit Summary Overview */}
              <div className="mb-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Watermarks Selected:</span>
                  <span className="font-semibold text-purple-300 font-mono">{boxes.length}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Text Overlays / Edits:</span>
                  <span className="font-semibold text-cyan-300 font-mono">
                    {textOverlays.length + boxes.filter((b) => b.replacement_text).length}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cut Segments:</span>
                  <span className="font-semibold text-rose-300 font-mono">{cutRanges.length}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Added Stitch Clips:</span>
                  <span className="font-semibold text-indigo-300 font-mono">{insertClips.length}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Audio Track:</span>
                  <span className={`font-semibold font-mono ${
                    audioMode === 'mute' ? 'text-rose-400' : audioMode === 'replace' ? 'text-emerald-400' : audioMode === 'mix' ? 'text-teal-400' : 'text-slate-300'
                  }`}>
                    {audioMode === 'mute' ? 'Muted (Silent)' : audioMode === 'replace' ? 'Replaced' : audioMode === 'mix' ? 'Mixed' : 'Original'}
                  </span>
                </div>
              </div>

              <button
                disabled={isDetecting}
                onClick={handleDetect}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 py-2.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all disabled:opacity-50"
              >
                <Wand2 className={`h-4 w-4 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Detecting Overlays...' : 'Auto-Detect Overlays'}</span>
              </button>

              <button
                disabled={boxes.length === 0 && cutRanges.length === 0 && insertClips.length === 0 && textOverlays.length === 0 && audioMode === 'original'}
                onClick={handleStartProcess}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {audioMode !== 'original' && boxes.length === 0 && cutRanges.length === 0 && insertClips.length === 0 && textOverlays.length === 0
                    ? audioMode === 'mute' ? 'Export (Mute Video Audio)' : 'Export (Replace Audio)'
                    : boxes.length > 0 && (cutRanges.length > 0 || insertClips.length > 0 || textOverlays.length > 0 || audioMode !== 'original')
                    ? 'Export Video (Multi-Feature)'
                    : textOverlays.length > 0 && boxes.length === 0 && cutRanges.length === 0 && insertClips.length === 0
                      ? 'Export Video (Text Overlays)'
                      : cutRanges.length > 0 || insertClips.length > 0
                        ? 'Export (Apply Cuts & Clips)'
                        : 'Start Video Inpainting'}
                </span>
              </button>

              <button
                onClick={() => {
                  setMetadata(null);
                  setBoxes([]);
                  setCutRanges([]);
                  setInsertClips([]);
                  setTextOverlays([]);
                  setSelectedTextId(null);
                }}
                className="mt-2 w-full text-center text-[11px] text-slate-500 hover:text-slate-300 py-1"
              >
                Upload different video
              </button>
            </div>

            {/* Video Inpainting Parameters */}
            <div className="rounded-2xl border border-white/10 bg-[#12141e]/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold text-white mb-4">
                <Sliders className="h-4 w-4 text-purple-400" />
                <span>Video Inpainting Engine</span>
              </div>

              {/* Tracking Mode */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Overlay Tracking Mode:</label>
                <div className="mt-2 space-y-1.5 text-xs">
                  {[
                    { id: 'static', name: 'Fixed Static Region (Recommended)', desc: 'Optimal for Instagram handles, Reels & corner logos (60+ FPS)' },
                    { id: 'optical_flow', name: 'Optical Flow / Motion Tracking', desc: 'Tracks moving overlays & floating watermarks' },
                    { id: 'csrt', name: 'CSRT Correlation Tracker', desc: 'High accuracy object tracking filter' },
                  ].map((t) => (
                    <label
                      key={t.id}
                      onClick={() => setTrackingMode(t.id)}
                      className={`block cursor-pointer rounded-xl border p-2 transition-all ${
                        trackingMode === t.id
                          ? 'border-purple-500 bg-purple-500/10 text-white'
                          : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <span className="font-medium text-[11px]">{t.name}</span>
                      <p className="text-[9px] text-slate-500">{t.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="mt-5 space-y-3 pt-4 border-t border-white/5 text-xs">
                {/* Temporal Consistency */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200">Temporal Anti-Flicker</span>
                    <p className="text-[10px] text-slate-500">Smooths consecutive frame differences</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={temporalConsistency}
                    onChange={(e) => setTemporalConsistency(e.target.checked)}
                    className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
                  />
                </label>

                {/* Audio Mode Quick Configuration */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-medium text-slate-200 text-xs">Audio Configuration:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudioMode('audio')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Open Audio Studio
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAudioMode('original')}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        audioMode === 'original'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 font-bold'
                          : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      🎵 Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioMode('mute')}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        audioMode === 'mute'
                          ? 'border-rose-500 bg-rose-500/20 text-rose-200 font-bold'
                          : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      🔇 Mute All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioMode('replace');
                        setStudioMode('audio');
                      }}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        audioMode === 'replace'
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200 font-bold'
                          : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      🎧 Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioMode('mix');
                        setStudioMode('audio');
                      }}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        audioMode === 'mix'
                          ? 'border-teal-500 bg-teal-500/20 text-teal-200 font-bold'
                          : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      🎚️ Mix Track
                    </button>
                  </div>

                  {uploadedAudio && (
                    <div className="flex items-center justify-between text-[10px] text-emerald-300 bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                      <span className="truncate max-w-[130px] font-semibold">{uploadedAudio.original_name}</span>
                      <span className="font-mono text-emerald-400">{formatSec(uploadedAudio.duration_sec)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Export Resolution */}
              <div className="mt-5 pt-4 border-t border-white/5 text-xs">
                <span className="font-medium text-slate-300">Export Resolution:</span>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {['original', '1080p', '720p'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setExportResolution(r)}
                      className={`rounded-lg py-1 text-center font-mono text-[11px] font-semibold uppercase transition-all ${
                        exportResolution === r
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress & Result Modal */}
      <ProcessingProgressModal
        isOpen={showProgressModal}
        job={activeJob}
        onClose={() => setShowProgressModal(false)}
        onViewResult={(url) => {
          window.open(url, '_blank');
        }}
      />

      {/* Rights Confirmation */}
      <LegalConfirmationModal
        isOpen={showLegalModal}
        mediaName={metadata?.filename}
        onClose={() => setShowLegalModal(false)}
        onConfirm={executeProcess}
      />
    </div>
  );
};
