# Video Editing Tool & Media Restoration Engine

A full-stack media restoration and video editing suite designed to remove visual overlays, edit text, and trim video segments while preserving audio quality.

## Features

- **Video Inpainting:** Temporal inpainting, optical flow tracking, and static SIMD filtering for logo and watermark removal.
- **Timestamp Scoping:** Apply removals only during specified time ranges ($t_{start} \to t_{end}$).
- **Text Replacement & Overlays:** Select existing on-screen text regions to remove and replace with customized text, or add floating text layers with customizable fonts, colors, and backgrounds.
- **Timeline Trimming & Stitching:** Dual draggable handles on the scrubber bar, frame-by-frame navigation, instant in-browser cut previews, and intro/outro clip stitching.
- **Audio Preservation:** Direct stream copying via FFmpeg keeps original audio streams intact without re-encoding loss.
- **Image Restoration:** Interactive canvas editor with brush, marquee, dilation, and Telea/Navier-Stokes inpainting algorithms.

## Project Structure

- `frontend/`: React + TypeScript + Vite web interface with canvas editor and timeline scrubber.
- `backend/`: FastAPI application utilizing OpenCV and FFmpeg for video processing.

## Running Locally

### Backend
1. `cd backend`
2. Create and activate a virtual environment: `python -m venv venv && venv\Scripts\activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Run server: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload`

### Frontend
1. `cd frontend`
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
