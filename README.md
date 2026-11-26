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

### 4. 🎵 Complete Audio Studio & Sound Replacement
- **Mute / Complete Removal:** Strip all audio tracks from a video to produce 100% silent output with ultra-fast stream-copy.
- **Audio Track Replacement:** Replace the video's original audio with any uploaded MP3, WAV, M4A, or AAC track.
- **Audio Mixing (Background Music):** Blend dialogue with background music with separate volume sliders (0% to 200%).
- **Seamless Looping:** Automatically loop background music or audio tracks until the video completes.

### 5. 🎙️ Video to Text (AI Speech-to-Text & Subtitles Generator)
- **Automatic Speech Recognition (STT):** Transcribe spoken words in the video with timestamps into clear text (supports Hindi, Indian English, US English, and more).
- **Subtitles Export:** Download timestamped `.srt` subtitle files or plain `.txt` transcripts.
- **1-Click Subtitles Burn:** Instantly convert all timestamped transcript segments into styled on-screen video text overlays.

### 6. ⬇️ Video to Audio (Instant MP3/WAV Extractor)
- Extract the audio stream from any video file in less than 1 second.
- Direct in-browser download or one-click load into the Audio Studio for editing.

### 7. 🗣️ Text to Audio (AI Neural Voiceover Generator)
- Type or paste script text to synthesize natural neural speech.
- Supports high-quality Microsoft Neural voices (Hindi Male/Female: *Madhur*, *Swara*; English India: *Prabhat*, *Neerja*; English US: *Guy*, *Jenny*).
- Directly burns into video as replacement sound or background commentary.

### 8. 🖼️ Single Image Restoration Studio
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
The frontend interface will open at `http://localhost:2006` (or `http://127.0.0.1:2006`).

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/videos/upload` | Upload video file for editing |
| `POST` | `/api/videos/process` | Unified processing: watermark removal, cuts, text overlay, & audio |
| `POST` | `/api/videos/extract-audio` | Extract audio stream from video as MP3 or WAV |
| `POST` | `/api/videos/transcribe` | Transcribe speech in video to text & generate SRT/VTT subtitles |
| `POST` | `/api/videos/text-to-speech` | Synthesize natural neural voiceover audio from text |
| `GET`  | `/api/videos/tts-voices` | Retrieve available neural voices for Hindi, English, etc. |
| `POST` | `/api/videos/upload-audio` | Upload custom MP3/WAV/AAC audio track |
| `POST` | `/api/images/inpaint` | Restore single image using mask coordinates |
| `GET`  | `/api/system/health` | Health check endpoint |

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
