import os
import uuid
import json
import asyncio
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
import edge_tts
import speech_recognition as sr
from app.config import UPLOAD_DIR, TEMP_DIR, settings
from app.models.schemas import AudioUploadResponse, TranscribeResponse, TranscribeSegment

def format_timestamp_srt(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def format_timestamp_vtt(seconds: float) -> str:
    """Format seconds into WebVTT timestamp HH:MM:SS.mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

class AIAudioService:
    def __init__(self):
        self.curated_voices = [
            {"id": "hi-IN-MadhurNeural", "name": "Hindi (India) - Madhur", "language": "Hindi", "gender": "Male"},
            {"id": "hi-IN-SwaraNeural", "name": "Hindi (India) - Swara", "language": "Hindi", "gender": "Female"},
            {"id": "en-IN-PrabhatNeural", "name": "English (India) - Prabhat", "language": "English (India)", "gender": "Male"},
            {"id": "en-IN-NeerjaNeural", "name": "English (India) - Neerja", "language": "English (India)", "gender": "Female"},
            {"id": "en-US-GuyNeural", "name": "English (US) - Guy", "language": "English (US)", "gender": "Male"},
            {"id": "en-US-JennyNeural", "name": "English (US) - Jenny", "language": "English (US)", "gender": "Female"},
            {"id": "en-GB-RyanNeural", "name": "English (UK) - Ryan", "language": "English (UK)", "gender": "Male"},
            {"id": "en-GB-SoniaNeural", "name": "English (UK) - Sonia", "language": "English (UK)", "gender": "Female"},
        ]

    def get_voices(self) -> List[Dict[str, Any]]:
        return self.curated_voices

    def extract_audio(self, video_path: Path, output_format: str = "mp3") -> AudioUploadResponse:
        """Extract audio stream from a video into MP3 or WAV"""
        audio_id = str(uuid.uuid4())[:8]
        fmt = output_format.lower().replace(".", "")
        if fmt not in ["mp3", "wav", "aac"]:
            fmt = "mp3"
        
        filename = f"{audio_id}_extracted.{fmt}"
        out_path = UPLOAD_DIR / filename

        # FFmpeg audio extraction command
        if fmt == "mp3":
            cmd = [
                settings.ffmpeg_bin, "-y",
                "-i", str(video_path),
                "-vn",
                "-acodec", "libmp3lame",
                "-q:a", "2",
                str(out_path)
            ]
        elif fmt == "wav":
            cmd = [
                settings.ffmpeg_bin, "-y",
                "-i", str(video_path),
                "-vn",
                "-acodec", "pcm_s16le",
                str(out_path)
            ]
        else:
            cmd = [
                settings.ffmpeg_bin, "-y",
                "-i", str(video_path),
                "-vn",
                "-c:a", "copy",
                str(out_path)
            ]

        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0 or not out_path.exists() or out_path.stat().st_size == 0:
            raise RuntimeError(f"Audio extraction failed: {res.stderr[:300]}")

        # Probe duration
        duration = 0.0
        try:
            probe_cmd = [
                settings.ffprobe_bin, "-v", "quiet",
                "-print_format", "json",
                "-show_format", str(out_path)
            ]
            probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
            if probe_res.returncode == 0:
                data = json.loads(probe_res.stdout)
                duration = float(data.get("format", {}).get("duration", 0.0))
        except Exception:
            pass

        return AudioUploadResponse(
            audio_id=audio_id,
            filename=filename,
            original_name=f"{video_path.stem}_audio.{fmt}",
            url=f"/api/uploads/{filename}",
            duration_sec=round(duration, 2),
            file_size=out_path.stat().st_size
        )

    def transcribe_video(self, video_path: Path, language: str = "hi-IN", chunk_duration: int = 6) -> TranscribeResponse:
        """Transcribe speech in video into text and timestamped subtitle segments"""
        # 1. Probe video for audio stream and duration
        probe_cmd = [
            settings.ffprobe_bin, "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format", str(video_path)
        ]
        probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
        if probe_res.returncode != 0:
            raise RuntimeError(f"Could not probe video file: {probe_res.stderr[:200]}")

        probe_data = json.loads(probe_res.stdout)
        has_audio = any(s.get("codec_type") == "audio" for s in probe_data.get("streams", []))
        if not has_audio:
            raise ValueError("This video has no audio stream to transcribe. Please upload a video with speech or sound.")

        duration = float(probe_data.get("format", {}).get("duration", 0.0))
        if duration <= 0:
            duration = 10.0

        # 2. Extract audio to 16kHz mono WAV for SpeechRecognition
        temp_wav = TEMP_DIR / f"stt_{uuid.uuid4().hex[:8]}.wav"
        temp_wav.parent.mkdir(parents=True, exist_ok=True)
        try:
            cmd = [
                settings.ffmpeg_bin, "-y",
                "-i", str(video_path),
                "-vn",
                "-acodec", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                str(temp_wav)
            ]
            conv_res = subprocess.run(cmd, capture_output=True)
            if conv_res.returncode != 0:
                raise RuntimeError("Failed to extract audio track for transcription.")

            # 3. Chunk and transcribe
            r = sr.Recognizer()
            segments: List[TranscribeSegment] = []
            full_text_list: List[str] = []

            chunk_len = max(3, min(chunk_duration, 15))
            current_time = 0.0
            seg_idx = 1
            chunk_file = TEMP_DIR / f"chunk_{uuid.uuid4().hex[:8]}.wav"

            while current_time < duration:
                start_t = current_time
                end_t = min(current_time + chunk_len, duration)
                seg_dur = end_t - start_t
                if seg_dur < 0.5:
                    break

                # Extract chunk
                cmd_chunk = [
                    settings.ffmpeg_bin, "-y",
                    "-ss", str(start_t),
                    "-t", str(seg_dur),
                    "-i", str(temp_wav),
                    "-acodec", "copy",
                    str(chunk_file)
                ]
                subprocess.run(cmd_chunk, capture_output=True)

                if chunk_file.exists() and chunk_file.stat().st_size > 1000:
                    try:
                        with sr.AudioFile(str(chunk_file)) as source:
                            audio_data = r.record(source)
                            # Google Speech Recognition
                            txt = r.recognize_google(audio_data, language=language)
                            if txt and txt.strip():
                                clean_txt = txt.strip()
                                time_range_str = f"{format_timestamp_srt(start_t)} --> {format_timestamp_srt(end_t)}"
                                segments.append(TranscribeSegment(
                                    id=seg_idx,
                                    start=round(start_t, 2),
                                    end=round(end_t, 2),
                                    text=clean_txt,
                                    timestamp=time_range_str
                                ))
                                full_text_list.append(clean_txt)
                                seg_idx += 1
                    except sr.UnknownValueError:
                        # Inaudible / silence in this interval
                        pass
                    except Exception:
                        pass
                    finally:
                        try:
                            if chunk_file.exists():
                                chunk_file.unlink()
                        except Exception:
                            pass

                current_time = end_t

            # Generate SRT and VTT formats
            srt_lines = []
            vtt_lines = ["WEBVTT\n"]
            for seg in segments:
                srt_lines.append(f"{seg.id}")
                srt_lines.append(f"{format_timestamp_srt(seg.start)} --> {format_timestamp_srt(seg.end)}")
                srt_lines.append(f"{seg.text}\n")

                vtt_lines.append(f"{seg.id}")
                vtt_lines.append(f"{format_timestamp_vtt(seg.start)} --> {format_timestamp_vtt(seg.end)}")
                vtt_lines.append(f"{seg.text}\n")

            full_text = " ".join(full_text_list)
            if not full_text:
                full_text = "(No audible speech detected in the audio track)"

            return TranscribeResponse(
                media_id=video_path.stem,
                full_text=full_text,
                language=language,
                segments=segments,
                srt_content="\n".join(srt_lines),
                vtt_content="\n".join(vtt_lines)
            )

        finally:
            try:
                if temp_wav.exists():
                    temp_wav.unlink()
            except Exception:
                pass

    async def generate_tts(self, text: str, voice: str = "hi-IN-MadhurNeural", rate: str = "+0%", pitch: str = "+0Hz") -> AudioUploadResponse:
        """Generate high quality natural neural voice audio from text"""
        if not text or not text.strip():
            raise ValueError("Text content cannot be empty.")

        audio_id = str(uuid.uuid4())[:8]
        filename = f"{audio_id}_ai_voice.mp3"
        out_path = UPLOAD_DIR / filename
        out_path.parent.mkdir(parents=True, exist_ok=True)

        clean_text = text.strip()
        communicate = edge_tts.Communicate(clean_text, voice, rate=rate, pitch=pitch)
        await communicate.save(str(out_path))

        if not out_path.exists() or out_path.stat().st_size == 0:
            raise RuntimeError("TTS voice generation failed.")

        duration = 0.0
        try:
            probe_cmd = [
                settings.ffprobe_bin, "-v", "quiet",
                "-print_format", "json",
                "-show_format", str(out_path)
            ]
            probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
            if probe_res.returncode == 0:
                data = json.loads(probe_res.stdout)
                duration = float(data.get("format", {}).get("duration", 0.0))
        except Exception:
            pass

        return AudioUploadResponse(
            audio_id=audio_id,
            filename=filename,
            original_name=f"AI_Voice_{voice}.mp3",
            url=f"/api/uploads/{filename}",
            duration_sec=round(duration, 2),
            file_size=out_path.stat().st_size
        )

ai_audio_service = AIAudioService()
