# 🎬 CleanFrame AI — Intelligent Video Editing & Restoration Suite

> A modern, full-stack media restoration and video editing suite designed for frame-accurate watermark removal, on-screen text replacement, timeline trimming, and seamless clip stitching with lossless audio preservation.

---

## 🌟 Key Features

### 1. 🎯 Timestamp-Scoped Watermark & Logo Inpainting
- **Time-Accurate Removal:** Inpainting targets only the exact timestamp range ($t_{start} \to t_{end}$) where a logo, username, or watermark appears, leaving the rest of the video untouched.
- **Advanced Inpainting Algorithms:**
  - **Static & SIMD Inpainting:** Blends background textures across frames with high-speed performance.
  - **Temporal & Optical Flow Inpainting:** Leverages motion vectors from preceding/following frames for dynamic camera motion.
- **Multi-Region Selection:** Select and track multiple bounding boxes simultaneously.

### 2. ✂️ Precision Cut & Trim Studio
- **Dual Draggable Timeline Handles:** Frame-accurate In-point (`[`) and Out-point (`]`) drag handles directly on the timeline scrubber.
- **Frame Stepping Controls:** Precision frame nudging (`-1f` / `+1f`) and second nudging (`-1.0s` / `+1.0s`) with live video frame preview.
- **In-Browser Cut Preview:** Test cut transitions and review cut segments before backend processing.
- **Multi-Segment Removal & Intro/Outro Stitching:** Remove unwanted segments or stitch intro/outro clips seamlessly without desyncing audio.

### 3. ✏️ On-Screen Text Edit & Replacement
- **Select & Replace:** Drag a selection box directly over old on-screen text or watermarks. The engine inpaints the original text and overlays new customized text.
- **Rich Typography Controls:** Full control over font size, text color palette, font weights, and background badge padding to match original styling.
- **Floating Text Layers:** Add independent text annotations and lower-thirds with customizable start/end display durations.

### 4. 🔊 Lossless Audio Synchronization
- **Direct Stream Copy:** Uses FFmpeg stream copying to maintain 100% of original audio bitrates, channels, and sample rates without lossy re-compression.
- **Time-Shift Compensation:** Audio timestamps are recalculated and aligned with video frames during cut/stitch operations to eliminate audio drift.

### 5. 🖼️ Single Image Restoration Studio
- **Interactive Canvas:** High-resolution image canvas with pan, zoom, brush masking, and marquee tools.
- **Telea & Navier-Stokes Inpainting:** Instant restoration for photos, screenshots, and visual assets.

---

## 🏗️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)              │
│  - TypeScript, Tailwind CSS, Lucide Icons              │
│  - Interactive HTML5 Canvas Masking & Text Overlay     │
│  - Custom Frame-Accurate Timeline Scrubber             │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST APIs
┌──────────────────────────▼─────────────────────────────┐
│                    Backend (FastAPI)                   │
│  - Python 3.10+, Uvicorn, Pydantic                     │
│  - OpenCV (cv2) SIMD Inpainting & Mask Processing      │
│  - FFmpeg Audio Multiplexing & Lossless Stream Copy    │
└────────────────────────────────────────────────────────┘
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause video playback |
| `[` | Set Cut In-Point at current playhead position |
| `]` | Set Cut Out-Point at current playhead position |
| `←` / `→` | Step backward / forward 1 frame |
| `Shift + ←` / `Shift + →` | Step backward / forward 1 second |
| `Esc` | Deselect active bounding box or cut segment |
| `Del` / `Backspace` | Remove selected box or cut segment |

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **FFmpeg** installed and accessible in system PATH

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
```
The backend API documentation will be available at `http://127.0.0.1:8005/docs`.

### 2. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
The frontend interface will open at `http://localhost:5173` (or the next available port).

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/upload` | Upload video file for editing |
| `POST` | `/api/clean-video` | Apply timestamp-scoped watermark inpainting & text replacement |
| `POST` | `/api/stitch-video` | Apply timeline cuts and stitch remaining segments with audio |
| `POST` | `/api/inpaint` | Restore single image using mask coordinates |
| `POST` | `/api/detect-text` | Detect on-screen text regions within video frames |
| `GET`  | `/api/health` | Health check endpoint |

---

## 📁 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (upload, clean, stitch, inpaint)
│   │   ├── core/         # Config, logging, and security utilities
│   │   ├── models/       # Pydantic request & response schemas
│   │   └── services/     # Inpainting engine, FFmpeg pipeline, audio sync
│   ├── uploads/          # Uploaded source media (git-ignored)
│   ├── outputs/          # Processed outputs (git-ignored)
│   ├── temp/             # Temporary intermediate frames & audio chunks
│   └── requirements.txt  # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # Timeline scrubber, canvas editor, UI modals
│   │   ├── pages/        # VideoCleanerPage, ImageCleanerPage
│   │   ├── services/     # Axios API service client
│   │   └── types/        # TypeScript interface definitions
│   ├── package.json      # Node.js dependencies
│   └── vite.config.ts    # Vite bundler configuration
├── .gitignore            # Root gitignore rules
└── README.md             # Project documentation
```

---

## 📄 License
This project is licensed under the MIT License.
