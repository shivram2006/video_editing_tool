export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  type: 'text' | 'logo' | 'handle' | 'timestamp' | 'custom';
  start_time?: number;
  end_time?: number;
  replacement_text?: string;
  font_size?: number;
  font_color?: string;
  bg_color?: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  font_size?: number;
  font_color?: string;
  bg_color?: string;
  start_time?: number;
  end_time?: number;
  font_family?: string;
}

export interface CutRange {
  id: string;
  start_time: number;
  end_time: number;
  label?: string;
}

export interface InsertClip {
  id: string;
  media_id: string;
  filename: string;
  position: 'start' | 'end';
  label?: string;
  duration_sec?: number;
  preview_url?: string;
}

export interface AudioTrackInfo {
  audio_id: string;
  filename: string;
  original_name: string;
  url: string;
  duration_sec: number;
  file_size: number;
}

export interface VideoProcessRequest {
  media_id: string;
  boxes?: BoundingBox[];
  tracking_mode?: string;
  temporal_consistency?: boolean;
  preserve_audio?: boolean;
  audio_mode?: 'original' | 'mute' | 'replace' | 'mix';
  new_audio_id?: string;
  new_audio_volume?: number;
  original_audio_volume?: number;
  audio_loop?: boolean;
  export_resolution?: string;
  confirm_rights: boolean;
  cut_ranges?: CutRange[];
  insert_clips?: InsertClip[];
  text_overlays?: TextOverlay[];
}

export interface DetectionResult {
  media_id: string;
  width: number;
  height: number;
  detected_boxes: BoundingBox[];
  mask_url?: string;
  execution_time_ms: number;
  message: string;
}

export interface ImageProcessResponse {
  job_id: string;
  original_url: string;
  cleaned_url: string;
  mask_url?: string;
  width: number;
  height: number;
  execution_time_ms: number;
  credits_remaining: number;
  status: string;
}

export interface VideoMetadata {
  media_id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  fps: number;
  total_frames: number;
  duration_sec: number;
  file_size: number;
  reference_frame_url: string;
  thumbnails: Array<{
    frame_index: number;
    timestamp: number;
    url: string;
  }>;
}

export interface VideoJobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_frame: number;
  total_frames: number;
  fps: number;
  eta_seconds: number;
  original_url?: string;
  result_url?: string;
  preview_frame_url?: string;
  error_message?: string;
  message: string;
}

export interface HistoryItem {
  id: string;
  media_type: 'image' | 'video';
  filename: string;
  original_url: string;
  result_url?: string;
  mask_url?: string;
  thumbnail_url?: string;
  status: 'completed' | 'processing' | 'failed';
  file_size_bytes: number;
  resolution: string;
  duration_sec?: number;
  created_at: string;
  processing_time_sec?: number;
  algorithm_used: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  credits_remaining: number;
  credits_total: number;
  created_at: string;
  is_authenticated: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  price_monthly: number;
  credits: number;
  max_video_duration_sec: number;
  max_resolution: string;
  features: string[];
  is_popular: boolean;
}

export interface SampleMedia {
  name: string;
  filename: string;
  type: 'image' | 'video';
  url: string;
  description: string;
}
