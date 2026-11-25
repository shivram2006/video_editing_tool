import {
  BoundingBox,
  CutRange,
  InsertClip,
  VideoProcessRequest,
  DetectionResult,
  ImageProcessResponse,
  VideoMetadata,
  VideoJobStatus,
  HistoryItem,
  UserProfile,
  PricingPlan,
  SampleMedia,
  AudioTrackInfo,
} from '../types';

const API_BASE = '/api';

export const api = {
  // System & Samples
  async getSystemHealth() {
    const res = await fetch(`${API_BASE}/system/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async getSampleMedia(): Promise<SampleMedia[]> {
    const res = await fetch(`${API_BASE}/system/samples`);
    if (!res.ok) throw new Error('Failed to load samples');
    return res.json();
  },

  // Images
  async uploadImage(file: File): Promise<{ media_id: string; filename: string; original_name: string; url: string; file_size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/images/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async detectImageWatermarks(media_id: string): Promise<DetectionResult> {
    const formData = new FormData();
    formData.append('media_id', media_id);
    const res = await fetch(`${API_BASE}/images/detect`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Detection failed' }));
      throw new Error(err.detail || 'Detection failed');
    }
    return res.json();
  },

  async inpaintImage(params: {
    media_id: string;
    mask_data?: string;
    boxes?: BoundingBox[];
    method: string;
    dilation_px: number;
    feather_px: number;
    export_scale: number;
    confirm_rights: boolean;
  }): Promise<ImageProcessResponse> {
    const res = await fetch(`${API_BASE}/images/inpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Inpainting failed' }));
      throw new Error(err.detail || 'Inpainting failed');
    }
    return res.json();
  },

  // Videos
  async uploadVideo(file: File): Promise<VideoMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/videos/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Video upload failed' }));
      throw new Error(err.detail || 'Video upload failed');
    }
    return res.json();
  },

  async uploadAudio(file: File): Promise<AudioTrackInfo> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/videos/upload-audio`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Audio upload failed' }));
      throw new Error(err.detail || 'Audio upload failed');
    }
    return res.json();
  },

  async getVideoMetadata(media_id: string): Promise<VideoMetadata> {
    const res = await fetch(`${API_BASE}/videos/metadata/${media_id}`);
    if (!res.ok) throw new Error('Failed to load video metadata');
    return res.json();
  },

  async detectVideoWatermarks(media_id: string, timestamp?: number): Promise<DetectionResult> {
    const formData = new FormData();
    formData.append('media_id', media_id);
    if (timestamp !== undefined && timestamp > 0) {
      formData.append('timestamp', timestamp.toString());
    }
    const res = await fetch(`${API_BASE}/videos/detect`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Video detection failed' }));
      throw new Error(err.detail || 'Video detection failed');
    }
    return res.json();
  },

  async processVideo(params: VideoProcessRequest): Promise<{ job_id: string; message: string; status: string }> {
    const res = await fetch(`${API_BASE}/videos/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Processing start failed' }));
      throw new Error(err.detail || 'Processing start failed');
    }
    return res.json();
  },

  async getVideoJobStatus(job_id: string): Promise<VideoJobStatus> {
    const res = await fetch(`${API_BASE}/videos/status/${job_id}`);
    if (!res.ok) throw new Error('Failed to fetch job status');
    return res.json();
  },

  // History
  async getHistory(): Promise<HistoryItem[]> {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async deleteHistoryItem(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete history item');
  },

  async clearHistory(): Promise<void> {
    const res = await fetch(`${API_BASE}/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear history');
  },

  // Auth & Pricing
  async getCurrentUser(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/me`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },

  async login(email: string, password: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  async register(email: string, password: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  },

  async upgradePlan(plan_name: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_name }),
    });
    if (!res.ok) throw new Error('Plan change failed');
    return res.json();
  },

  async getPricing(): Promise<PricingPlan[]> {
    const res = await fetch(`${API_BASE}/auth/pricing`);
    if (!res.ok) throw new Error('Failed to load pricing');
    return res.json();
  },
};
