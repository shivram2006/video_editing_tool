import uuid
import time
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.config import UPLOAD_DIR, settings
from app.models.schemas import (
    VideoProcessRequest, VideoJobStatus, HistoryItem, DetectionResponse, AudioUploadResponse,
    ExtractAudioRequest, TranscribeRequest, TranscribeResponse, TTSRequest, TTSVoice
)
from app.services.video_engine import video_engine
from app.services.detector import detector
from app.services.history import history_manager
from app.services.ai_audio_service import ai_audio_service

router = APIRouter(prefix="/videos", tags=["Videos"])

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma"}

def find_video_file(media_id: str) -> Path:
    for p in UPLOAD_DIR.iterdir():
        if p.name == media_id or p.stem == media_id or p.name.startswith(f"{media_id}_") or p.name.startswith(media_id):
            return p
    raise HTTPException(status_code=404, detail=f"Video file '{media_id}' not found in uploads")

def find_audio_file(audio_id: str) -> Path:
    for p in UPLOAD_DIR.iterdir():
        if p.name == audio_id or p.stem == audio_id or p.name.startswith(f"{audio_id}_") or p.name.startswith(audio_id):
            return p
    raise HTTPException(status_code=404, detail=f"Audio file '{audio_id}' not found in uploads")

@router.post("/upload-audio", response_model=AudioUploadResponse)
async def upload_audio(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}. Supported: MP3, WAV, M4A, AAC, OGG, FLAC, WMA")

    audio_id = str(uuid.uuid4())[:8]
    filename = f"{audio_id}_{file.filename}"
    file_path = UPLOAD_DIR / filename

    content = await file.read()
    if len(content) > settings.MAX_VIDEO_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Audio exceeds max size of {settings.MAX_VIDEO_SIZE_MB}MB")

    with open(file_path, "wb") as f:
        f.write(content)

    # Probe duration
    duration = 0.0
    try:
        import subprocess, json
        cmd = [
            settings.ffprobe_bin,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            str(file_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            data = json.loads(res.stdout)
            duration = float(data.get("format", {}).get("duration", 0.0))
    except Exception:
        pass

    return AudioUploadResponse(
        audio_id=audio_id,
        filename=filename,
        original_name=file.filename or filename,
        url=f"/api/uploads/{filename}",
        duration_sec=round(duration, 2),
        file_size=len(content)
    )

@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported video format: {ext}. Supported: MP4, MOV, WEBM")

    media_id = str(uuid.uuid4())[:8]
    filename = f"{media_id}_{file.filename}"
    file_path = UPLOAD_DIR / filename

    content = await file.read()
    if len(content) > settings.MAX_VIDEO_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Video exceeds max size of {settings.MAX_VIDEO_SIZE_MB}MB")

    with open(file_path, "wb") as f:
        f.write(content)

    # Extract metadata and scrubber thumbnails
    meta = video_engine.extract_metadata_and_previews(file_path, media_id)
    meta["url"] = f"/api/uploads/{filename}"
    meta["file_size"] = len(content)
    return meta

@router.get("/metadata/{media_id}")
async def get_video_metadata(media_id: str):
    file_path = find_video_file(media_id)
    return video_engine.extract_metadata_and_previews(file_path, media_id)

import cv2
from typing import Optional
from app.config import UPLOAD_DIR, OUTPUT_DIR, settings

@router.post("/detect", response_model=DetectionResponse)
async def detect_video_watermarks(
    media_id: str = Form(...),
    timestamp: Optional[float] = Form(None)
):
    file_path = find_video_file(media_id)
    cap = cv2.VideoCapture(str(file_path))
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Could not open video file for detection")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0.0

    # If specific timestamp requested, detect on that exact frame
    if timestamp is not None and timestamp > 0:
        target_frame = min(total_frames - 1, max(0, int(timestamp * fps)))
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            raise HTTPException(status_code=500, detail="Could not extract target frame for detection")
        target_path = OUTPUT_DIR / f"detect_frame_{media_id}_{target_frame}.jpg"
        cv2.imwrite(str(target_path), frame)
        det_res = detector.detect(target_path, media_id)
        # Intelligently anchor start_time to this specific timestamp so content prior to this timestamp is not affected
        for b in det_res.detected_boxes:
            b.start_time = round(float(timestamp), 1)
        return det_res

    # Otherwise, multi-sample keyframes across the video to detect all persistent overlays
    sample_times = [
        min(duration * 0.1, 1.5),
        min(duration * 0.25, 4.0),
        min(duration * 0.5, 10.0),
    ]
    all_boxes = []
    primary_frame_path = None

    for idx, t in enumerate(sample_times):
        f_idx = min(total_frames - 1, max(0, int(t * fps)))
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if ret:
            fpath = OUTPUT_DIR / f"detect_sample_{media_id}_{idx}.jpg"
            cv2.imwrite(str(fpath), frame)
            if primary_frame_path is None:
                primary_frame_path = fpath
            res = detector.detect(fpath, f"{media_id}_{idx}")
            all_boxes.extend(res.detected_boxes)

    cap.release()

    # Merge overlapping detections from across frames
    merged_boxes = detector._merge_overlapping_boxes(all_boxes, w, h)

    # Generate composite mask
    import numpy as np
    mask = np.zeros((h, w), dtype=np.uint8)
    for b in merged_boxes:
        pad_x = max(6, int(b.width * 0.10))
        pad_y = max(6, int(b.height * 0.12))
        x1 = max(0, b.x - pad_x)
        y1 = max(0, b.y - pad_y)
        x2 = min(w, b.x + b.width + pad_x)
        y2 = min(h, b.y + b.height + pad_y)
        cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

    mask_filename = f"mask_{media_id}_{int(time.time())}.png"
    mask_path = OUTPUT_DIR / mask_filename
    cv2.imwrite(str(mask_path), mask)

    return DetectionResponse(
        media_id=media_id,
        width=w,
        height=h,
        detected_boxes=merged_boxes,
        mask_url=f"/api/outputs/{mask_filename}",
        execution_time_ms=50.0,
        message=f"Intelligently detected {len(merged_boxes)} overlay(s) across video"
    )

@router.post("/process")
async def start_video_clean(req: VideoProcessRequest):
    if not req.confirm_rights:
        raise HTTPException(status_code=403, detail="You must confirm you have authorized rights to edit this content.")

    file_path = find_video_file(req.media_id)

    # If audio_mode is mute, preserve_audio should be false
    effective_preserve = req.preserve_audio and (req.audio_mode != "mute")

    job_id = video_engine.start_video_processing(
        video_path=file_path,
        media_id=req.media_id,
        boxes=req.boxes or [],
        tracking_mode=req.tracking_mode,
        temporal_consistency=req.temporal_consistency,
        preserve_audio=effective_preserve,
        export_resolution=req.export_resolution,
        cut_ranges=req.cut_ranges,
        insert_clips=req.insert_clips,
        text_overlays=req.text_overlays,
        audio_mode=req.audio_mode,
        new_audio_id=req.new_audio_id,
        new_audio_volume=req.new_audio_volume,
        original_audio_volume=req.original_audio_volume,
        audio_loop=req.audio_loop
    )

    # Pre-record in history as processing
    history_item = HistoryItem(
        id=job_id,
        media_type="video",
        filename=file_path.name,
        original_url=f"/api/uploads/{file_path.name}",
        result_url=f"/api/outputs/cleaned_video_{job_id}.mp4",
        status="processing",
        file_size_bytes=file_path.stat().st_size if file_path.exists() else 0,
        resolution=req.export_resolution,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        algorithm_used=f"Temporal Flow ({req.tracking_mode})"
    )
    history_manager.add(history_item)

    return {
        "job_id": job_id,
        "message": "Video processing initiated",
        "status": "queued"
    }

@router.get("/status/{job_id}", response_model=VideoJobStatus)
async def get_job_status(job_id: str):
    status = video_engine.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # If completed, update history status
    if status.status == "completed":
        items = history_manager.get_all()
        for item in items:
            if item.id == job_id:
                item.status = "completed"
                item.result_url = status.result_url
                break
    return status

@router.post("/extract-audio", response_model=AudioUploadResponse)
async def extract_audio_from_video(req: ExtractAudioRequest):
    """Extract audio stream from an uploaded video as MP3 or WAV"""
    file_path = find_video_file(req.media_id)
    try:
        return ai_audio_service.extract_audio(file_path, output_format=req.format)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio extraction failed: {str(e)}")

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_video(req: TranscribeRequest):
    """Transcribe speech in video to text with timestamps, generating SRT/VTT subtitles"""
    file_path = find_video_file(req.media_id)
    try:
        return ai_audio_service.transcribe_video(
            video_path=file_path,
            language=req.language,
            chunk_duration=req.chunk_duration
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.get("/tts-voices")
async def get_tts_voices():
    """Get list of natural neural voices for text-to-speech"""
    return ai_audio_service.get_voices()

@router.post("/text-to-speech", response_model=AudioUploadResponse)
async def text_to_speech(req: TTSRequest):
    """Generate high-quality natural voiceover audio from text"""
    try:
        return await ai_audio_service.generate_tts(
            text=req.text,
            voice=req.voice,
            rate=req.rate,
            pitch=req.pitch
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

