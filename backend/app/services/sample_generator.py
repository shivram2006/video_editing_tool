import cv2
import numpy as np
from pathlib import Path
from app.config import SAMPLE_DIR, UPLOAD_DIR

def generate_sample_media():
    """
    Generates realistic demo images and video with standard watermarks:
    - Instagram handle (@nature_lens)
    - Reels watermark logo
    - Timestamps
    - Stock watermarks
    """
    # 1. Sample Image 1: Mountain landscape with Instagram handle and Reels watermark
    img1_path = SAMPLE_DIR / "sample_instagram_reel.jpg"
    upload1_path = UPLOAD_DIR / "sample_instagram_reel.jpg"
    if not img1_path.exists():
        h, w = 1080, 720
        # Create aesthetic gradient background (sunset colors: deep purple to warm orange)
        img = np.zeros((h, w, 3), dtype=np.uint8)
        for y in range(h):
            ratio = y / float(h)
            # Interpolate from purple (110, 30, 80) to cyan/teal sunset (40, 180, 220)
            b = int(140 * (1 - ratio) + 60 * ratio)
            g = int(40 * (1 - ratio) + 140 * ratio)
            r = int(100 * (1 - ratio) + 240 * ratio)
            img[y, :] = (b, g, r)

        # Draw silhouetted mountains
        mountain1 = np.array([[0, h], [0, int(h * 0.65)], [180, int(h * 0.48)], [360, int(h * 0.58)], [540, int(h * 0.42)], [w, int(h * 0.60)], [w, h]], np.int32)
        cv2.fillPoly(img, [mountain1], (35, 20, 25))

        mountain2 = np.array([[0, h], [0, int(h * 0.75)], [240, int(h * 0.62)], [460, int(h * 0.70)], [w, int(h * 0.55)], [w, h]], np.int32)
        cv2.fillPoly(img, [mountain2], (25, 12, 18))

        # Sun circle
        cv2.circle(img, (int(w * 0.7), int(h * 0.35)), 70, (180, 240, 255), -1)
        # Soft sun glow
        overlay = img.copy()
        cv2.circle(overlay, (int(w * 0.7), int(h * 0.35)), 120, (140, 200, 255), -1)
        cv2.addWeighted(overlay, 0.4, img, 0.6, 0, img)

        # Draw Instagram handle overlay pill in lower region
        pill_x, pill_y, pill_w, pill_h = 50, int(h * 0.82), 290, 56
        sub_img = img[pill_y:pill_y+pill_h, pill_x:pill_x+pill_w]
        white_rect = np.ones(sub_img.shape, dtype=np.uint8) * 30
        res = cv2.addWeighted(sub_img, 0.3, white_rect, 0.7, 0)
        img[pill_y:pill_y+pill_h, pill_x:pill_x+pill_w] = res
        cv2.rectangle(img, (pill_x, pill_y), (pill_x+pill_w, pill_y+pill_h), (255, 255, 255), 1)

        # Draw Instagram camera icon circle
        cv2.circle(img, (pill_x + 28, pill_y + 28), 16, (255, 255, 255), 2)
        cv2.circle(img, (pill_x + 28, pill_y + 28), 6, (255, 255, 255), -1)

        # Draw Username text
        cv2.putText(img, "@nature_explorer", (pill_x + 58, pill_y + 36), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)

        # Draw Reels platform logo in top-right
        reels_x, reels_y, reels_w, reels_h = w - 170, 60, 120, 48
        cv2.putText(img, "REELS", (reels_x, reels_y + 35), cv2.FONT_HERSHEY_DUPLEX, 0.9, (255, 255, 255), 2, cv2.LINE_AA)

        cv2.imwrite(str(img1_path), img)
        cv2.imwrite(str(upload1_path), img)

    # 2. Sample Image 2: Architectural photo with timestamp overlay and logo watermark
    img2_path = SAMPLE_DIR / "sample_architecture_timestamp.jpg"
    upload2_path = UPLOAD_DIR / "sample_architecture_timestamp.jpg"
    if not img2_path.exists():
        h, w = 800, 1200
        img = np.zeros((h, w, 3), dtype=np.uint8)
        # Modern geometric architectural pattern
        for x in range(0, w, 40):
            color_val = int(80 + 120 * np.sin(x / 100.0))
            cv2.line(img, (x, 0), (x + 200, h), (color_val, color_val + 20, color_val + 40), 2)
        cv2.rectangle(img, (200, 150), (1000, 650), (45, 50, 65), -1)
        cv2.rectangle(img, (240, 190), (960, 610), (90, 100, 125), 3)

        # Unwanted Timestamp in bottom-right corner
        cv2.putText(img, "2026-11-13 13:30:45 PST", (w - 420, h - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (20, 240, 240), 2, cv2.LINE_AA)

        # Channel watermark logo in top-left
        cv2.putText(img, "ARCH-DIGEST PROOF", (50, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (200, 200, 200), 2, cv2.LINE_AA)

        cv2.imwrite(str(img2_path), img)
        cv2.imwrite(str(upload2_path), img)

    # 3. Sample Video: Smooth 6-second MP4 with Instagram overlay and audio track
    vid_path = SAMPLE_DIR / "sample_reel_video.mp4"
    vid_upload = UPLOAD_DIR / "sample_reel_video.mp4"
    if not vid_path.exists():
        fps = 24
        duration = 5 # 5 seconds = 120 frames
        w, h = 640, 360
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(str(vid_path), fourcc, fps, (w, h))

        total_frames = fps * duration
        for f in range(total_frames):
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            # Animated dynamic waves
            t = f / float(fps)
            for x in range(0, w, 4):
                wave_y = int(h * 0.5 + 40 * np.sin(x * 0.02 + t * 3.0) + 20 * np.cos(x * 0.01 - t * 2.0))
                cv2.line(frame, (x, wave_y), (x, h), (180, int(100 + 80 * np.sin(t)), 50), 3)

            # Draw static Instagram handle overlay pill in lower left
            px, py, pw, ph = 30, h - 60, 210, 40
            cv2.rectangle(frame, (px, py), (px + pw, py + ph), (20, 20, 20), -1)
            cv2.rectangle(frame, (px, py), (px + pw, py + ph), (255, 255, 255), 1)
            cv2.putText(frame, "@creator_daily", (px + 15, py + 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)

            # Draw watermarked date stamp in top right
            cv2.putText(frame, "REELS ORIGINAL", (w - 180, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1, cv2.LINE_AA)

            out.write(frame)

        out.release()
        import shutil
        shutil.copyfile(str(vid_path), str(vid_upload))
