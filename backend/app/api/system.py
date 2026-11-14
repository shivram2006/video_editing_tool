import shutil
from pathlib import Path
from fastapi import APIRouter
import cv2
from app.config import settings, SAMPLE_DIR
from app.services.sample_generator import generate_sample_media

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "opencv_version": cv2.__version__,
        "ffmpeg_available": bool(settings.ffmpeg_bin),
        "ffmpeg_path": settings.ffmpeg_bin
    }

@router.get("/samples")
async def get_samples():
    generate_sample_media()
    samples = []
    for f in SAMPLE_DIR.glob("*.*"):
        media_type = "video" if f.suffix.lower() in [".mp4", ".mov", ".webm"] else "image"
        samples.append({
            "name": f.stem.replace("sample_", "").replace("_", " ").title(),
            "filename": f.name,
            "type": media_type,
            "url": f"/api/uploads/{f.name}",
            "description": "Instagram Reel overlay with @username & logo" if "reel" in f.name else "Timestamp and watermark proof"
        })
    return samples
