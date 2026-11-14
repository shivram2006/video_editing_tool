from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    id: str
    x: int
    y: int
    width: int
    height: int
    label: str = "Watermark"
    confidence: float = 0.95
    type: str = "text" # 'text', 'logo', 'handle', 'timestamp', 'custom'
    start_time: Optional[float] = None # Inpaint only from this timestamp (seconds)
    end_time: Optional[float] = None   # Inpaint only until this timestamp (seconds)
    replacement_text: Optional[str] = None # Custom replacement text over the cleaned watermark
    font_size: Optional[int] = 32
    font_color: Optional[str] = "white"
    bg_color: Optional[str] = "black@0.6"

class DetectionResponse(BaseModel):
    media_id: str
    width: int
    height: int
    detected_boxes: List[BoundingBox] = []
    mask_url: Optional[str] = None
    execution_time_ms: float = 0.0
    message: str = "Detection completed"

class InpaintImageRequest(BaseModel):
    media_id: str
    mask_data: Optional[str] = None  # Base64 PNG mask or data URL
    mask_id: Optional[str] = None    # Pre-generated mask file ID
    boxes: Optional[List[BoundingBox]] = None # List of bounding boxes to mask
    method: str = "hybrid_texture"   # 'hybrid_texture', 'telea', 'navier_stokes'
    dilation_px: int = 4
    feather_px: int = 2
    export_scale: float = 1.0        # 0.5, 1.0, 2.0
    confirm_rights: bool = False

class ImageProcessResponse(BaseModel):
    job_id: str
    original_url: str
    cleaned_url: str
    mask_url: Optional[str] = None
    width: int
    height: int
    execution_time_ms: float
    credits_remaining: int
    status: str = "completed"

class CutRange(BaseModel):
    id: str
    start_time: float
    end_time: float
    label: Optional[str] = "Cut Segment"

class InsertClip(BaseModel):
    id: str
    media_id: str
    filename: str
    position: str = "end" # 'start', 'end'
    label: Optional[str] = "Added Clip"

class TextOverlay(BaseModel):
    id: str
    text: str
    x: int
    y: int
    font_size: int = 36
    font_color: str = "white"              # 'white', 'yellow', 'cyan', 'red', 'green', 'black', 'gold'
    bg_color: Optional[str] = "black@0.6"  # 'black@0.6', 'transparent', etc.
    start_time: Optional[float] = None     # Seconds
    end_time: Optional[float] = None       # Seconds
    font_family: Optional[str] = "Arial"

class VideoProcessRequest(BaseModel):
    media_id: str
    boxes: Optional[List[BoundingBox]] = []
    tracking_mode: str = "optical_flow" # 'static', 'optical_flow', 'csrt'
    temporal_consistency: bool = True
    preserve_audio: bool = True
    export_resolution: str = "original" # 'original', '1080p', '720p'
    confirm_rights: bool = True
    cut_ranges: Optional[List[CutRange]] = None
    insert_clips: Optional[List[InsertClip]] = None
    text_overlays: Optional[List[TextOverlay]] = None

class VideoJobStatus(BaseModel):
    job_id: str
    status: str  # 'queued', 'processing', 'completed', 'failed'
    progress: float = 0.0 # 0.0 to 100.0
    current_frame: int = 0
    total_frames: int = 0
    fps: float = 30.0
    eta_seconds: float = 0.0
    original_url: Optional[str] = None
    result_url: Optional[str] = None
    preview_frame_url: Optional[str] = None
    error_message: Optional[str] = None
    message: str = ""

class HistoryItem(BaseModel):
    id: str
    media_type: str # 'image' | 'video'
    filename: str
    original_url: str
    result_url: Optional[str] = None
    mask_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: str # 'completed', 'processing', 'failed'
    file_size_bytes: int = 0
    resolution: str = ""
    duration_sec: Optional[float] = None
    created_at: str
    processing_time_sec: float = 0.0
    algorithm_used: str = "CleanFrame Hybrid AI"

class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    avatar: str
    plan: str = "Pro" # 'Free', 'Pro', 'Enterprise'
    credits_remaining: int = 25
    credits_total: int = 50
    created_at: str
    is_authenticated: bool = True

class PricingPlan(BaseModel):
    id: str
    name: str
    price_monthly: int
    credits: int
    max_video_duration_sec: int
    max_resolution: str
    features: List[str]
    is_popular: bool = False
