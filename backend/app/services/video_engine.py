import os
import time
import uuid
import json
import subprocess
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import cv2
import numpy as np

from app.config import settings, OUTPUT_DIR, TEMP_DIR, UPLOAD_DIR
from app.models.schemas import BoundingBox, VideoJobStatus, CutRange, InsertClip, TextOverlay
from app.services.inpainter import inpainter

class VideoProcessingEngine:
    """
    Production-grade AI Video Watermark Inpainting Engine.
    Handles temporal inpainting, optical flow tracking, audio stream preservation,
    and asynchronous progress reporting.
    """

    def __init__(self):
        self.jobs: Dict[str, VideoJobStatus] = {}
        self.lock = threading.Lock()



    def get_job_status(self, job_id: str) -> Optional[VideoJobStatus]:
        with self.lock:
            return self.jobs.get(job_id)

    def extract_metadata_and_previews(self, video_path: Path, media_id: str) -> Dict[str, Any]:
        """
        Extracts duration, resolution, fps, and scrubber thumbnail strip.
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps if fps > 0 else 0.0

        # Extract 8 keyframe thumbnails for scrubber timeline
        thumbnails = []
        sample_indices = np.linspace(0, max(0, total_frames - 1), num=min(8, max(1, total_frames)), dtype=int)

        preview_dir = OUTPUT_DIR / f"previews_{media_id}"
        preview_dir.mkdir(parents=True, exist_ok=True)

        for i, f_idx in enumerate(sample_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(f_idx))
            ret, frame = cap.read()
            if ret:
                thumb_name = f"thumb_{i}_{int(f_idx)}.jpg"
                thumb_path = preview_dir / thumb_name
                thumb_small = cv2.resize(frame, (240, int(240 * (h / w))))
                cv2.imwrite(str(thumb_path), thumb_small, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                thumbnails.append({
                    "frame_index": int(f_idx),
                    "timestamp": round(float(f_idx / fps), 2),
                    "url": f"/api/outputs/previews_{media_id}/{thumb_name}"
                })

        # Save first frame as reference preview
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, first_frame = cap.read()
        ref_url = ""
        if ret:
            ref_path = OUTPUT_DIR / f"ref_{media_id}.jpg"
            cv2.imwrite(str(ref_path), first_frame)
            ref_url = f"/api/outputs/ref_{media_id}.jpg"

        cap.release()

        return {
            "media_id": media_id,
            "filename": video_path.name,
            "width": w,
            "height": h,
            "fps": round(fps, 2),
            "total_frames": total_frames,
            "duration_sec": round(duration, 2),
            "reference_frame_url": ref_url,
            "thumbnails": thumbnails
        }

    def start_video_processing(
        self,
        video_path: Path,
        media_id: str,
        boxes: List[BoundingBox],
        tracking_mode: str = "optical_flow",
        temporal_consistency: bool = True,
        preserve_audio: bool = True,
        export_resolution: str = "original",
        cut_ranges: Optional[List[CutRange]] = None,
        insert_clips: Optional[List[InsertClip]] = None,
        text_overlays: Optional[List[TextOverlay]] = None
    ) -> str:
        job_id = str(uuid.uuid4())[:8]

        job = VideoJobStatus(
            job_id=job_id,
            status="queued",
            progress=0.0,
            current_frame=0,
            total_frames=1,
            fps=30.0,
            eta_seconds=0.0,
            original_url=f"/api/uploads/{video_path.name}",
            message="Queued for processing"
        )

        with self.lock:
            self.jobs[job_id] = job

        # Run processing thread
        thread = threading.Thread(
            target=self._process_video_thread,
            args=(job_id, video_path, boxes, tracking_mode, temporal_consistency, preserve_audio, export_resolution, cut_ranges, insert_clips, text_overlays),
            daemon=True
        )
        thread.start()

        return job_id

    def _process_video_thread(
        self,
        job_id: str,
        video_path: Path,
        boxes: List[BoundingBox],
        tracking_mode: str,
        temporal_consistency: bool,
        preserve_audio: bool,
        export_resolution: str,
        cut_ranges: Optional[List[CutRange]] = None,
        insert_clips: Optional[List[InsertClip]] = None,
        text_overlays: Optional[List[TextOverlay]] = None
    ):
        start_time = time.time()
        final_filename = f"cleaned_video_{job_id}.mp4"
        final_path = OUTPUT_DIR / final_filename

        try:
            with self.lock:
                self.jobs[job_id].status = "processing"
                self.jobs[job_id].message = "Analyzing video structure..."

            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                raise RuntimeError("Failed to open source video file")

            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()

            if total_frames <= 0:
                total_frames = 1

            with self.lock:
                self.jobs[job_id].total_frames = total_frames
                self.jobs[job_id].fps = round(fps, 2)

            # Determine export dimensions
            out_w, out_h = w, h
            if export_resolution == "1080p":
                scale = 1080.0 / min(w, h)
                out_w, out_h = int(w * scale), int(h * scale)
            elif export_resolution == "720p":
                scale = 720.0 / min(w, h)
                out_w, out_h = int(w * scale), int(h * scale)

            # Ensure even dimensions for codecs
            out_w = out_w if out_w % 2 == 0 else out_w - 1
            out_h = out_h if out_h % 2 == 0 else out_h - 1

            ffmpeg_bin = settings.ffmpeg_bin

            has_cuts_or_inserts = bool((cut_ranges and len(cut_ranges) > 0) or (insert_clips and len(insert_clips) > 0))
            has_boxes = bool(boxes and len(boxes) > 0)
            has_text = bool((text_overlays and len(text_overlays) > 0) or any(b.replacement_text for b in (boxes or [])))

            # 1. If user ONLY wants text overlays (no watermark removal, no cut/stitch):
            if not has_boxes and not has_cuts_or_inserts and has_text:
                success = self._apply_text_overlays(
                    job_id=job_id,
                    input_video_path=video_path,
                    output_video_path=final_path,
                    text_overlays=text_overlays,
                    boxes=boxes,
                    preserve_audio=preserve_audio
                )
                if success:
                    self._finalize_job(job_id, final_filename, start_time)
                else:
                    raise RuntimeError("Failed to apply text overlays into video")
                return

            # 2. If user wants cut/stitch without any watermark removal:
            if not has_boxes and has_cuts_or_inserts:
                cut_output_path = (TEMP_DIR / f"intermediate_cut_{job_id}.mp4") if has_text else final_path
                success = self._apply_cuts_and_inserts(
                    job_id=job_id,
                    input_video_path=video_path,
                    output_video_path=cut_output_path,
                    cut_ranges=cut_ranges,
                    insert_clips=insert_clips,
                    target_w=out_w,
                    target_h=out_h,
                    target_fps=fps,
                    preserve_audio=preserve_audio,
                    start_time=start_time
                )
                if not success:
                    raise RuntimeError("Failed to apply cut segments or stitch clips")
                if has_text:
                    success = self._apply_text_overlays(
                        job_id=job_id,
                        input_video_path=cut_output_path,
                        output_video_path=final_path,
                        text_overlays=text_overlays,
                        boxes=boxes,
                        preserve_audio=preserve_audio
                    )
                    if cut_output_path.exists():
                        try: cut_output_path.unlink()
                        except Exception: pass
                    if not success:
                        raise RuntimeError("Failed to apply text overlays to cut video")
                self._finalize_job(job_id, final_filename, start_time)
                return

            # 3. Watermark removal pipeline (with or without cuts/text):
            needs_step_after_inpaint = has_cuts_or_inserts or has_text
            target_inpaint_path = (TEMP_DIR / f"intermediate_{job_id}.mp4") if needs_step_after_inpaint else final_path

            # If static delogo and NO cuts/inserts and has_text:
            # delogo AND drawtext can run together in 1 single pass straight to final_path!
            if tracking_mode == "static" and ffmpeg_bin and boxes and not has_cuts_or_inserts:
                success = self._run_ffmpeg_static_pipeline(
                    job_id=job_id,
                    ffmpeg_bin=ffmpeg_bin,
                    video_path=video_path,
                    final_path=final_path,
                    boxes=boxes,
                    text_overlays=text_overlays,
                    w=w,
                    h=h,
                    out_w=out_w,
                    out_h=out_h,
                    total_frames=total_frames,
                    fps=fps,
                    preserve_audio=preserve_audio,
                    start_time=start_time
                )
                if success:
                    self._finalize_job(job_id, final_filename, start_time)
                    return

            # Otherwise, inpaint first to target_inpaint_path
            if tracking_mode == "static" and ffmpeg_bin and boxes:
                success = self._run_ffmpeg_static_pipeline(
                    job_id=job_id,
                    ffmpeg_bin=ffmpeg_bin,
                    video_path=video_path,
                    final_path=target_inpaint_path,
                    boxes=boxes,
                    text_overlays=None,
                    w=w,
                    h=h,
                    out_w=out_w,
                    out_h=out_h,
                    total_frames=total_frames,
                    fps=fps,
                    preserve_audio=preserve_audio,
                    start_time=start_time
                )
                if not success:
                    self._run_streaming_pipeline(
                        job_id=job_id,
                        ffmpeg_bin=ffmpeg_bin,
                        video_path=video_path,
                        final_path=target_inpaint_path,
                        boxes=boxes,
                        w=w,
                        h=h,
                        out_w=out_w,
                        out_h=out_h,
                        total_frames=total_frames,
                        fps=fps,
                        tracking_mode=tracking_mode,
                        temporal_consistency=temporal_consistency,
                        preserve_audio=preserve_audio,
                        start_time=start_time
                    )
            else:
                self._run_streaming_pipeline(
                    job_id=job_id,
                    ffmpeg_bin=ffmpeg_bin,
                    video_path=video_path,
                    final_path=target_inpaint_path,
                    boxes=boxes,
                    w=w,
                    h=h,
                    out_w=out_w,
                    out_h=out_h,
                    total_frames=total_frames,
                    fps=fps,
                    tracking_mode=tracking_mode,
                    temporal_consistency=temporal_consistency,
                    preserve_audio=preserve_audio,
                    start_time=start_time
                )

            # 4. If cuts or inserts were also requested, apply them now to the inpainted video
            current_step_path = target_inpaint_path
            if has_cuts_or_inserts:
                cut_step_path = (TEMP_DIR / f"intermediate_cut_{job_id}.mp4") if has_text else final_path
                with self.lock:
                    self.jobs[job_id].message = "Applying cuts and stitching added clips..."
                success = self._apply_cuts_and_inserts(
                    job_id=job_id,
                    input_video_path=current_step_path,
                    output_video_path=cut_step_path,
                    cut_ranges=cut_ranges,
                    insert_clips=insert_clips,
                    target_w=out_w,
                    target_h=out_h,
                    target_fps=fps,
                    preserve_audio=preserve_audio,
                    start_time=start_time
                )
                if current_step_path.exists() and current_step_path != video_path:
                    try: current_step_path.unlink()
                    except Exception: pass
                if not success:
                    raise RuntimeError("Failed to apply cut segments or stitch clips to inpainted video")
                current_step_path = cut_step_path

            # 5. Finally, if text overlays or replacement text are requested:
            if has_text:
                with self.lock:
                    self.jobs[job_id].message = "Rendering custom text overlays..."
                success = self._apply_text_overlays(
                    job_id=job_id,
                    input_video_path=current_step_path,
                    output_video_path=final_path,
                    text_overlays=text_overlays,
                    boxes=boxes,
                    preserve_audio=preserve_audio
                )
                if current_step_path.exists() and current_step_path != video_path and current_step_path != final_path:
                    try: current_step_path.unlink()
                    except Exception: pass
                if not success:
                    raise RuntimeError("Failed to burn text overlays into video")

            self._finalize_job(job_id, final_filename, start_time)

        except Exception as e:
            print(f"Error in video processing job {job_id}: {e}")
            with self.lock:
                self.jobs[job_id].status = "failed"
                self.jobs[job_id].error_message = str(e)
                self.jobs[job_id].message = f"Processing failed: {str(e)}"

    def _probe_file(self, path: Path) -> Dict[str, Any]:
        try:
            cmd = [
                settings.ffprobe_bin,
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                "-show_format",
                str(path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
                dur = float(data.get("format", {}).get("duration", 0.0))
                w = 1080
                h = 1920
                fps = 30.0
                for s in data.get("streams", []):
                    if s.get("codec_type") == "video":
                        w = int(s.get("width", 1080))
                        h = int(s.get("height", 1920))
                        if "r_frame_rate" in s:
                            parts = s["r_frame_rate"].split("/")
                            if len(parts) == 2 and float(parts[1]) > 0:
                                fps = float(parts[0]) / float(parts[1])
                        break
                return {"has_audio": has_audio, "duration": dur, "width": w, "height": h, "fps": fps}
        except Exception as e:
            print(f"Probe error for {path}: {e}")
        return {"has_audio": False, "duration": 0.0, "width": 1080, "height": 1920, "fps": 30.0}

    def _resolve_clip_path(self, media_id_or_name: str) -> Optional[Path]:
        for p in UPLOAD_DIR.iterdir():
            if p.name == media_id_or_name or p.stem == media_id_or_name or p.name.startswith(f"{media_id_or_name}_") or p.name.startswith(media_id_or_name):
                return p
        return None

    def _apply_cuts_and_inserts(
        self,
        job_id: str,
        input_video_path: Path,
        output_video_path: Path,
        cut_ranges: Optional[List[CutRange]],
        insert_clips: Optional[List[InsertClip]],
        target_w: int,
        target_h: int,
        target_fps: float,
        preserve_audio: bool = True,
        start_time: float = 0.0
    ) -> bool:
        probe_main = self._probe_file(input_video_path)
        dur_main = probe_main["duration"]
        has_audio_main = probe_main["has_audio"] and preserve_audio

        # 1. Compute keep intervals from cut_ranges
        keep_intervals = []
        if cut_ranges:
            merged_cuts = []
            for c in sorted(cut_ranges, key=lambda x: x.start_time):
                st = max(0.0, min(float(c.start_time), dur_main))
                et = max(0.0, min(float(c.end_time), dur_main))
                if et <= st + 0.05:
                    continue
                if not merged_cuts or merged_cuts[-1][1] < st:
                    merged_cuts.append([st, et])
                else:
                    merged_cuts[-1][1] = max(merged_cuts[-1][1], et)

            cur = 0.0
            for c_st, c_et in merged_cuts:
                if c_st > cur + 0.05:
                    keep_intervals.append((round(cur, 3), round(c_st, 3)))
                cur = max(cur, c_et)
            if cur < dur_main - 0.05:
                keep_intervals.append((round(cur, 3), round(dur_main, 3)))
        else:
            keep_intervals.append((0.0, round(dur_main, 3)))

        # 2. Categorize inserted clips: start (intro) vs end (outro)
        start_clips: List[Tuple[Path, Dict[str, Any]]] = []
        end_clips: List[Tuple[Path, Dict[str, Any]]] = []

        if insert_clips:
            for ic in insert_clips:
                p = self._resolve_clip_path(ic.media_id) or self._resolve_clip_path(ic.filename)
                if p and p.exists():
                    p_info = self._probe_file(p)
                    if ic.position == "start":
                        start_clips.append((p, p_info))
                    else:
                        end_clips.append((p, p_info))

        # Build FFmpeg command inputs
        input_files: List[Path] = [input_video_path]
        start_input_indices = []
        for p, _ in start_clips:
            start_input_indices.append(len(input_files))
            input_files.append(p)

        end_input_indices = []
        for p, _ in end_clips:
            end_input_indices.append(len(input_files))
            input_files.append(p)

        cmd = [settings.ffmpeg_bin, "-y"]
        for p in input_files:
            cmd.extend(["-i", str(p)])

        filter_parts = []
        concat_nodes = []
        node_idx = 0

        # Scale & pad helper string
        scale_filter = (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2,"
            f"setsar=1,fps={target_fps}"
        )

        # 3. Add Intro clips
        for idx, (p, p_info) in zip(start_input_indices, start_clips):
            v_node = f"v{node_idx}"
            a_node = f"a{node_idx}"
            filter_parts.append(f"[{idx}:v]{scale_filter}[{v_node}];")
            if p_info["has_audio"] and preserve_audio:
                filter_parts.append(f"[{idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[{a_node}];")
            else:
                dur = max(0.5, p_info["duration"])
                filter_parts.append(f"aevalsrc=0:d={dur:.3f}:s=44100:c=stereo[{a_node}];")
            concat_nodes.append(f"[{v_node}][{a_node}]")
            node_idx += 1

        # 4. Add Kept segments of main video
        for s, e in keep_intervals:
            v_node = f"v{node_idx}"
            a_node = f"a{node_idx}"
            seg_dur = max(0.1, e - s)
            filter_parts.append(f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,{scale_filter}[{v_node}];")
            if has_audio_main:
                filter_parts.append(f"[0:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[{a_node}];")
            else:
                filter_parts.append(f"aevalsrc=0:d={seg_dur:.3f}:s=44100:c=stereo[{a_node}];")
            concat_nodes.append(f"[{v_node}][{a_node}]")
            node_idx += 1

        # 5. Add Outro clips
        for idx, (p, p_info) in zip(end_input_indices, end_clips):
            v_node = f"v{node_idx}"
            a_node = f"a{node_idx}"
            filter_parts.append(f"[{idx}:v]{scale_filter}[{v_node}];")
            if p_info["has_audio"] and preserve_audio:
                filter_parts.append(f"[{idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[{a_node}];")
            else:
                dur = max(0.5, p_info["duration"])
                filter_parts.append(f"aevalsrc=0:d={dur:.3f}:s=44100:c=stereo[{a_node}];")
            concat_nodes.append(f"[{v_node}][{a_node}]")
            node_idx += 1

        total_nodes = len(concat_nodes)
        if total_nodes == 0:
            return False

        nodes_str = "".join(concat_nodes)
        filter_parts.append(f"{nodes_str}concat=n={total_nodes}:v=1:a=1[v][a]")

        cmd.extend([
            "-filter_complex", "".join(filter_parts),
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            str(output_video_path)
        ])

        with self.lock:
            self.jobs[job_id].message = "Assembling cut segments & stitched clips..."
            self.jobs[job_id].progress = 90.0

        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            print(f"[Cut & Concat] Error: {proc.stderr[-400:]}")
            return False

        return output_video_path.exists() and output_video_path.stat().st_size > 1000

    def _build_drawtext_filters(
        self,
        text_overlays: Optional[List[TextOverlay]],
        boxes: Optional[List[BoundingBox]],
        scale_x: float = 1.0,
        scale_y: float = 1.0
    ) -> List[str]:
        """
        Builds FFmpeg drawtext filter strings for standalone text overlays
        and bounding box replacement text.
        """
        dt_filters = []
        font_file = "C\\:/Windows/Fonts/arial.ttf"
        font_path = Path("C:/Windows/Fonts/arial.ttf")
        if not font_path.exists():
            for f in Path("C:/Windows/Fonts").glob("*.ttf"):
                font_file = str(f).replace("\\", "/").replace(":", r"\:")
                break

        # 1. Replacement text from watermark boxes
        if boxes:
            for b in boxes:
                if b.replacement_text and b.replacement_text.strip():
                    raw_text = b.replacement_text.strip()
                    esc = raw_text.replace("\\", "\\\\").replace("'", r"\'").replace(":", r"\:")
                    tx = max(0, int(b.x * scale_x))
                    ty = max(0, int(b.y * scale_y))
                    fsize = max(12, int((b.font_size or 32) * min(scale_x, scale_y)))
                    fcol = b.font_color or "white"
                    bgcol = b.bg_color or "black@0.6"

                    f_str = f"drawtext=fontfile='{font_file}':text='{esc}':x={tx}:y={ty}:fontsize={fsize}:fontcolor={fcol}"
                    if bgcol and bgcol != "transparent":
                        f_str += f":box=1:boxcolor={bgcol}:boxborderw=6"

                    st = b.start_time
                    et = b.end_time
                    if st is not None and et is not None and et > st:
                        f_str += f":enable='between(t,{st:.2f},{et:.2f})'"
                    elif st is not None and st > 0:
                        f_str += f":enable='gte(t,{st:.2f})'"
                    elif et is not None and et > 0:
                        f_str += f":enable='lte(t,{et:.2f})'"

                    dt_filters.append(f_str)

        # 2. Standalone TextOverlays
        if text_overlays:
            for to in text_overlays:
                if to.text and to.text.strip():
                    raw_text = to.text.strip()
                    esc = raw_text.replace("\\", "\\\\").replace("'", r"\'").replace(":", r"\:")
                    tx = max(0, int(to.x * scale_x))
                    ty = max(0, int(to.y * scale_y))
                    fsize = max(12, int(to.font_size * min(scale_x, scale_y)))
                    fcol = to.font_color or "white"
                    bgcol = to.bg_color or "black@0.6"

                    f_str = f"drawtext=fontfile='{font_file}':text='{esc}':x={tx}:y={ty}:fontsize={fsize}:fontcolor={fcol}"
                    if bgcol and bgcol != "transparent":
                        f_str += f":box=1:boxcolor={bgcol}:boxborderw=6"

                    st = to.start_time
                    et = to.end_time
                    if st is not None and et is not None and et > st:
                        f_str += f":enable='between(t,{st:.2f},{et:.2f})'"
                    elif st is not None and st > 0:
                        f_str += f":enable='gte(t,{st:.2f})'"
                    elif et is not None and et > 0:
                        f_str += f":enable='lte(t,{et:.2f})'"

                    dt_filters.append(f_str)

        return dt_filters

    def _apply_text_overlays(
        self,
        job_id: str,
        input_video_path: Path,
        output_video_path: Path,
        text_overlays: Optional[List[TextOverlay]],
        boxes: Optional[List[BoundingBox]],
        preserve_audio: bool = True
    ) -> bool:
        dt_filters = self._build_drawtext_filters(text_overlays, boxes)
        if not dt_filters:
            if input_video_path != output_video_path:
                import shutil
                shutil.copy2(input_video_path, output_video_path)
            return True

        vf_str = ",".join(dt_filters)
        cmd = [
            settings.ffmpeg_bin, "-y",
            "-i", str(input_video_path),
            "-vf", vf_str,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
            "-pix_fmt", "yuv420p"
        ]
        if preserve_audio:
            cmd.extend(["-c:a", "copy"])
        else:
            cmd.extend(["-an"])
        cmd.append(str(output_video_path))

        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            # If copy failed (audio format mismatch), retry transcoding audio with aac
            cmd_retry = [
                settings.ffmpeg_bin, "-y",
                "-i", str(input_video_path),
                "-vf", vf_str,
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k",
                str(output_video_path)
            ]
            res = subprocess.run(cmd_retry, capture_output=True, text=True)

        return res.returncode == 0 and output_video_path.exists() and output_video_path.stat().st_size > 1000

    def _run_ffmpeg_static_pipeline(
        self,
        job_id: str,
        ffmpeg_bin: str,
        video_path: Path,
        final_path: Path,
        boxes: List[BoundingBox],
        w: int,
        h: int,
        out_w: int,
        out_h: int,
        total_frames: int,
        fps: float,
        preserve_audio: bool,
        start_time: float,
        text_overlays: Optional[List[TextOverlay]] = None
    ) -> bool:
        delogo_filters = []
        for b in boxes:
            bx = max(0, int(b.x))
            by = max(0, int(b.y))
            bw = min(w - bx, int(b.width))
            bh = min(h - by, int(b.height))
            if bw <= 4 or bh <= 4:
                continue
            pad_x = max(8, int(bw * 0.10))
            pad_y = max(8, int(bh * 0.14))
            fx = max(1, min(w - 3, bx - pad_x))
            fy = max(1, min(h - 3, by - pad_y))
            fw = max(2, min(w - 1 - fx, bw + 2 * pad_x))
            fh = max(2, min(h - 1 - fy, bh + 2 * pad_y))
            
            filter_str = f"delogo=x={fx}:y={fy}:w={fw}:h={fh}:show=0"
            st = b.start_time
            et = b.end_time
            if st is not None and et is not None and et > st:
                filter_str += f":enable='between(t,{st:.2f},{et:.2f})'"
            elif st is not None and st > 0:
                filter_str += f":enable='gte(t,{st:.2f})'"
            elif et is not None and et > 0:
                filter_str += f":enable='lte(t,{et:.2f})'"
            
            delogo_filters.append(filter_str)

        # Scale factor for drawtext
        scale_x = out_w / w if w > 0 else 1.0
        scale_y = out_h / h if h > 0 else 1.0
        dt_filters = self._build_drawtext_filters(text_overlays, boxes, scale_x, scale_y)
        delogo_filters.extend(dt_filters)

        if not delogo_filters:
            return False

        if (out_w, out_h) != (w, h):
            delogo_filters.append(f"scale={out_w}:{out_h}")

        vf_str = ",".join(delogo_filters)

        def _execute_ffmpeg(audio_args: List[str]) -> bool:
            cmd = [
                ffmpeg_bin,
                "-y",
                "-i", str(video_path),
                "-vf", vf_str,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "18",
                "-pix_fmt", "yuv420p"
            ]
            cmd.extend(audio_args)
            cmd.extend(["-progress", "pipe:1", str(final_path)])

            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Drain stderr concurrently in background thread to prevent OS pipe buffer deadlock
            err_lines = []
            def _drain_stderr():
                try:
                    for l in proc.stderr:
                        err_lines.append(l)
                except Exception:
                    pass

            t_stderr = threading.Thread(target=_drain_stderr, daemon=True)
            t_stderr.start()

            for line in proc.stdout:
                line = line.strip()
                if line.startswith("frame="):
                    try:
                        curr = int(line.split("=")[1])
                        elapsed = time.time() - start_time
                        fps_cur = curr / elapsed if elapsed > 0 else fps
                        rem_frames = max(0, total_frames - curr)
                        eta = rem_frames / fps_cur if fps_cur > 0 else 0.0
                        pct = min(99.0, round((curr / total_frames) * 100.0, 1))
                        with self.lock:
                            self.jobs[job_id].current_frame = curr
                            self.jobs[job_id].progress = pct
                            self.jobs[job_id].fps = round(fps_cur, 1)
                            self.jobs[job_id].eta_seconds = round(eta, 1)
                            self.jobs[job_id].message = f"Processing frame {curr}/{total_frames} ({pct}%)"
                    except Exception:
                        pass

            proc.wait()
            t_stderr.join(timeout=2.0)
            if proc.returncode != 0:
                print(f"[FFmpeg Delogo] Error (rc={proc.returncode}): {''.join(err_lines[-10:])}")
            return proc.returncode == 0 and final_path.exists() and final_path.stat().st_size > 1000

        audio_params = ["-c:a", "copy"] if preserve_audio else ["-an"]
        success = _execute_ffmpeg(audio_params)
        if not success and preserve_audio:
            # If stream copy failed (e.g. incompatible audio in container), retry with AAC transcoding
            print("[FFmpeg Delogo] Stream copy failed; retrying with high-fidelity AAC encoding...")
            success = _execute_ffmpeg(["-c:a", "aac", "-b:a", "192k"])

        return success

    def _run_streaming_pipeline(
        self,
        job_id: str,
        ffmpeg_bin: Optional[str],
        video_path: Path,
        final_path: Path,
        boxes: List[BoundingBox],
        w: int,
        h: int,
        out_w: int,
        out_h: int,
        total_frames: int,
        fps: float,
        tracking_mode: str,
        temporal_consistency: bool,
        preserve_audio: bool,
        start_time: float
    ):
        import queue

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError("Failed to open source video file")

        # Initialize tracking templates
        templates = []
        if boxes:
            ret_first, first_frame = cap.read()
            if ret_first:
                for b in boxes:
                    bx, by, bw, bh = int(b.x), int(b.y), int(b.width), int(b.height)
                    if bw > 5 and bh > 5 and by + bh <= h and bx + bw <= w:
                        tpl = first_frame[by:by+bh, bx:bx+bw].copy()
                        templates.append({
                            "template": tpl,
                            "x": bx,
                            "y": by,
                            "w": bw,
                            "h": bh
                        })
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        # Setup FFmpeg output pipe or OpenCV VideoWriter fallback
        pipe = None
        writer = None
        temp_video_path = None

        if ffmpeg_bin:
            cmd = [
                ffmpeg_bin,
                "-y",
                "-f", "rawvideo",
                "-vcodec", "rawvideo",
                "-s", f"{w}x{h}",
                "-pix_fmt", "bgr24",
                "-r", str(fps),
                "-i", "-",
                "-i", str(video_path),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-map", "0:v:0",
                "-map", "1:a:0?",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest"
            ]
            if (out_w, out_h) != (w, h):
                cmd.extend(["-vf", f"scale={out_w}:{out_h}"])
            cmd.append(str(final_path))

            pipe = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            temp_video_filename = f"temp_clean_{job_id}.mp4"
            temp_video_path = TEMP_DIR / temp_video_filename
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(temp_video_path), fourcc, fps, (out_w, out_h))

        # Threaded frame reader
        frame_q = queue.Queue(maxsize=16)
        stop_event = threading.Event()

        def frame_reader():
            while not stop_event.is_set():
                ret, frame = cap.read()
                if not ret:
                    frame_q.put(None)
                    break
                frame_q.put(frame)

        t_reader = threading.Thread(target=frame_reader, daemon=True)
        t_reader.start()

        frame_idx = 0
        prev_roi_regions: Dict[int, np.ndarray] = {}

        try:
            while True:
                frame = frame_q.get()
                if frame is None:
                    break

                frame_idx += 1

                # Update boxes with keyframed localized template matching
                active_boxes = []
                if templates and tracking_mode != "static":
                    do_match = (frame_idx % 3 == 0) or (frame_idx == 1)
                    for t_idx, tpl_data in enumerate(templates):
                        cx, cy = tpl_data["x"], tpl_data["y"]
                        tw, th = tpl_data["w"], tpl_data["h"]
                        if do_match:
                            pad = 35
                            sx1 = max(0, cx - pad)
                            sy1 = max(0, cy - pad)
                            sx2 = min(w, cx + tw + pad)
                            sy2 = min(h, cy + th + pad)
                            search_roi = frame[sy1:sy2, sx1:sx2]
                            if search_roi.shape[0] >= th and search_roi.shape[1] >= tw:
                                res = cv2.matchTemplate(search_roi, tpl_data["template"], cv2.TM_CCOEFF_NORMED)
                                _, max_val, _, max_loc = cv2.minMaxLoc(res)
                                if max_val > 0.55:
                                    cx = sx1 + max_loc[0]
                                    cy = sy1 + max_loc[1]
                                    tpl_data["x"] = cx
                                    tpl_data["y"] = cy
                        active_boxes.append((cx, cy, tw, th))
                else:
                    for b in boxes:
                        active_boxes.append((int(b.x), int(b.y), int(b.width), int(b.height)))

                cur_sec = frame_idx / fps if fps > 0 else 0.0

                # Sub-ROI Inpainting directly on frame slices (zero full-frame copy)
                for b_idx, (bx, by, bw, bh) in enumerate(active_boxes):
                    orig_box = boxes[b_idx] if b_idx < len(boxes) else None
                    if orig_box:
                        if orig_box.start_time is not None and cur_sec < orig_box.start_time:
                            continue
                        if orig_box.end_time is not None and cur_sec > orig_box.end_time:
                            continue

                    if bw <= 4 or bh <= 4:
                        continue
                    pad_x = max(8, int(bw * 0.12))
                    pad_y = max(8, int(bh * 0.15))
                    pad = 18

                    mbx1 = max(0, bx - pad_x)
                    mby1 = max(0, by - pad_y)
                    mbx2 = min(w, bx + bw + pad_x)
                    mby2 = min(h, by + bh + pad_y)

                    rx1 = max(0, mbx1 - pad)
                    ry1 = max(0, mby1 - pad)
                    rx2 = min(w, mbx2 + pad)
                    ry2 = min(h, mby2 + pad)

                    roi_w, roi_h = rx2 - rx1, ry2 - ry1
                    if roi_w <= 4 or roi_h <= 4:
                        continue

                    # Local mask with generous bounds
                    local_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
                    cv2.rectangle(
                        local_mask,
                        (mbx1 - rx1, mby1 - ry1),
                        (mbx2 - rx1, mby2 - ry1),
                        255, -1
                    )
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
                    local_dilated = cv2.dilate(local_mask, kernel, iterations=2)

                    roi_frame = frame[ry1:ry2, rx1:rx2]
                    clean_roi = cv2.inpaint(roi_frame, local_dilated, 3, cv2.INPAINT_TELEA)

                    if temporal_consistency and b_idx in prev_roi_regions:
                        prev_roi = prev_roi_regions[b_idx]
                        if prev_roi.shape == clean_roi.shape:
                            m_bool = local_dilated > 0
                            clean_roi[m_bool] = (
                                clean_roi[m_bool].astype(np.float32) * 0.65 +
                                prev_roi[m_bool].astype(np.float32) * 0.35
                            ).astype(np.uint8)

                    prev_roi_regions[b_idx] = clean_roi.copy()
                    frame[ry1:ry2, rx1:rx2] = clean_roi

                # Output write
                if pipe:
                    pipe.stdin.write(frame.tobytes())
                elif writer:
                    if (out_w, out_h) != (w, h):
                        out_frame = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_LANCZOS4)
                    else:
                        out_frame = frame
                    writer.write(out_frame)

                # Periodic progress updates
                if frame_idx % 15 == 0 or frame_idx == total_frames:
                    elapsed = time.time() - start_time
                    fps_cur = frame_idx / elapsed if elapsed > 0 else 1.0
                    frames_left = total_frames - frame_idx
                    eta = frames_left / fps_cur if fps_cur > 0 else 0.0
                    pct = min(99.0, round((frame_idx / total_frames) * 100.0, 1))
                    with self.lock:
                        self.jobs[job_id].current_frame = frame_idx
                        self.jobs[job_id].progress = pct
                        self.jobs[job_id].fps = round(fps_cur, 1)
                        self.jobs[job_id].eta_seconds = round(eta, 1)
                        self.jobs[job_id].message = f"Processing frame {frame_idx}/{total_frames} ({pct}%)"

        finally:
            stop_event.set()
            cap.release()
            if pipe:
                try:
                    pipe.stdin.close()
                    pipe.wait()
                except Exception:
                    pass
            if writer:
                writer.release()

        # If OpenCV writer was used without FFmpeg pipe, handle audio muxing
        if not pipe and temp_video_path and temp_video_path.exists():
            if preserve_audio and ffmpeg_bin:
                try:
                    cmd = [
                        ffmpeg_bin, "-y",
                        "-i", str(temp_video_path),
                        "-i", str(video_path),
                        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
                        "-pix_fmt", "yuv420p",
                        "-map", "0:v:0", "-map", "1:a:0?",
                        "-c:a", "aac", "-b:a", "192k", "-shortest",
                        str(final_path)
                    ]
                    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                except Exception:
                    pass
            if not final_path.exists():
                os.replace(str(temp_video_path), str(final_path))
            if temp_video_path.exists():
                try: temp_video_path.unlink()
                except Exception: pass

    def _finalize_job(self, job_id: str, final_filename: str, start_time: float):
        total_time = round(time.time() - start_time, 2)
        with self.lock:
            self.jobs[job_id].status = "completed"
            self.jobs[job_id].progress = 100.0
            self.jobs[job_id].result_url = f"/api/outputs/{final_filename}"
            self.jobs[job_id].message = f"Video cleaned successfully in {total_time}s with audio preservation!"

        # Update history item
        try:
            from app.services.history import history_manager
            import json
            from app.config import DATA_DIR
            items = history_manager.get_all()
            for it in items:
                if it.id == job_id:
                    it.status = "completed"
                    it.result_url = f"/api/outputs/{final_filename}"
                    it.processing_time_sec = total_time
                    break
            with open(DATA_DIR / "history.json", "w", encoding="utf-8") as f:
                json.dump([i.dict() for i in items], f, indent=2)
        except Exception as hist_err:
            print(f"History update error: {hist_err}")

video_engine = VideoProcessingEngine()
