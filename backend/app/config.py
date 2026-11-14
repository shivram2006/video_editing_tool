import os
import shutil
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
TEMP_DIR = BASE_DIR / "temp"
SAMPLE_DIR = BASE_DIR / "sample_media"
DATA_DIR = BASE_DIR / "data"

for directory in [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR, SAMPLE_DIR, DATA_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    PROJECT_NAME: str = "CleanFrame AI"
    VERSION: str = "2.1.0"
    API_PREFIX: str = "/api"
    MAX_IMAGE_SIZE_MB: int = 30
    MAX_VIDEO_SIZE_MB: int = 150
    MAX_VIDEO_DURATION_SEC: int = 120
    DEFAULT_CREDITS: int = 25
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]
    
    @property
    def ffmpeg_bin(self) -> str:
        # Check standard PATH
        system_ffmpeg = shutil.which("ffmpeg")
        if system_ffmpeg:
            return system_ffmpeg
        
        # Check WinGet common Gyan FFmpeg path
        winget_path = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
        if winget_path.exists():
            ffmpeg_matches = list(winget_path.glob("**/ffmpeg.exe"))
            if ffmpeg_matches:
                return str(ffmpeg_matches[0])
        
        return "ffmpeg"

    @property
    def ffprobe_bin(self) -> str:
        system_ffprobe = shutil.which("ffprobe")
        if system_ffprobe:
            return system_ffprobe
        
        winget_path = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
        if winget_path.exists():
            ffprobe_matches = list(winget_path.glob("**/ffprobe.exe"))
            if ffprobe_matches:
                return str(ffprobe_matches[0])
        
        return "ffprobe"

settings = Settings()
