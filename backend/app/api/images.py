import uuid
import time
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from app.config import UPLOAD_DIR, settings
from app.models.schemas import DetectionResponse, InpaintImageRequest, ImageProcessResponse, HistoryItem
from app.services.detector import detector
from app.services.inpainter import inpainter
from app.services.history import history_manager

router = APIRouter(prefix="/images", tags=["Images"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def find_image_file(media_id: str) -> Path:
    # Check exact match, prefix match, or stem match
    for p in UPLOAD_DIR.iterdir():
        if p.name == media_id or p.stem == media_id or p.name.startswith(f"{media_id}_") or p.name.startswith(media_id):
            return p
    raise HTTPException(status_code=404, detail=f"Media file '{media_id}' not found in uploads")

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported image format: {ext}. Supported: JPG, PNG, WEBP")

    media_id = str(uuid.uuid4())[:8]
    filename = f"{media_id}_{file.filename}"
    file_path = UPLOAD_DIR / filename

    content = await file.read()
    if len(content) > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image exceeds max size of {settings.MAX_IMAGE_SIZE_MB}MB")

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "media_id": media_id,
        "filename": filename,
        "original_name": file.filename,
        "url": f"/api/uploads/{filename}",
        "file_size": len(content)
    }

@router.post("/detect", response_model=DetectionResponse)
async def detect_watermarks(media_id: str = Form(...)):
    file_path = find_image_file(media_id)
    try:
        result = detector.detect(file_path, media_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")

@router.post("/inpaint", response_model=ImageProcessResponse)
async def inpaint_image(req: InpaintImageRequest):
    if not req.confirm_rights:
        raise HTTPException(status_code=403, detail="You must confirm you have authorized rights to edit this content.")

    file_path = find_image_file(req.media_id)
    try:
        response = inpainter.inpaint(
            image_path=file_path,
            mask_base64=req.mask_data,
            boxes=req.boxes,
            method=req.method,
            dilation_px=req.dilation_px,
            feather_px=req.feather_px,
            export_scale=req.export_scale
        )

        # Record in history
        history_item = HistoryItem(
            id=response.job_id,
            media_type="image",
            filename=file_path.name,
            original_url=response.original_url,
            result_url=response.cleaned_url,
            mask_url=response.mask_url,
            thumbnail_url=response.cleaned_url,
            status="completed",
            file_size_bytes=file_path.stat().st_size if file_path.exists() else 0,
            resolution=f"{response.width}x{response.height}",
            created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            processing_time_sec=round(response.execution_time_ms / 1000.0, 2),
            algorithm_used="CleanFrame Multi-Pass Inpainter"
        )
        history_manager.add(history_item)

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inpainting failed: {str(e)}")
