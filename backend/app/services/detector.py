import time
import uuid
import cv2
import numpy as np
from pathlib import Path
from typing import List, Tuple
from app.models.schemas import BoundingBox, DetectionResponse
from app.config import OUTPUT_DIR, TEMP_DIR

class WatermarkDetector:
    """
    AI-powered detection engine that identifies:
    - Instagram handles & usernames
    - Reels logos and badges
    - Text watermarks and captions
    - Timestamps and date stamps
    - Semi-transparent overlays & platform watermarks
    """

    def detect(self, image_path: Path, media_id: str) -> DetectionResponse:
        t0 = time.time()
        img = cv2.imread(str(image_path))
        if img is None:
            raise ValueError(f"Could not load image at {image_path}")
        
        h, w, c = img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        boxes: List[BoundingBox] = []

        # 1. Text & typography detector via morphological gradient & edge connectivity
        text_boxes = self._detect_text_regions(gray, w, h)
        boxes.extend(text_boxes)

        # 2. Canonical social media overlay priors (Instagram handles, Reels icons)
        social_boxes = self._detect_social_overlays(img, gray, w, h)
        boxes.extend(social_boxes)

        # 3. Semi-transparent logo / watermark detection
        semi_trans_boxes = self._detect_transparent_watermarks(img, gray, w, h)
        boxes.extend(semi_trans_boxes)

        # 4. Non-Maximum Suppression / Overlap Merging
        merged_boxes = self._merge_overlapping_boxes(boxes, w, h)

        # 5. Generate composite binary mask
        mask = np.zeros((h, w), dtype=np.uint8)
        for b in merged_boxes:
            # Add padding
            pad_x = max(2, int(b.width * 0.04))
            pad_y = max(2, int(b.height * 0.08))
            x1 = max(0, b.x - pad_x)
            y1 = max(0, b.y - pad_y)
            x2 = min(w, b.x + b.width + pad_x)
            y2 = min(h, b.y + b.height + pad_y)
            cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

        mask_filename = f"mask_{media_id}_{int(time.time())}.png"
        mask_path = OUTPUT_DIR / mask_filename
        cv2.imwrite(str(mask_path), mask)

        t1 = time.time()
        execution_time = (t1 - t0) * 1000.0

        return DetectionResponse(
            media_id=media_id,
            width=w,
            height=h,
            detected_boxes=merged_boxes,
            mask_url=f"/api/outputs/{mask_filename}",
            execution_time_ms=round(execution_time, 2),
            message=f"Detected {len(merged_boxes)} potential overlay(s)"
        )

    def _detect_text_regions(self, gray: np.ndarray, w: int, h: int) -> List[BoundingBox]:
        boxes = []
        # Morphological gradient to detect high frequency stroke edges
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)

        # Binarize gradient
        _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

        # Connect horizontally to merge letters into words
        horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 3))
        connected = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, horiz_kernel)

        contours, _ = cv2.findContours(connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            x, y, bw_val, bh_val = cv2.boundingRect(cnt)
            # Filter out whole-image bounds or tiny noise
            if bw_val < 25 or bh_val < 10 or bw_val > w * 0.85 or bh_val > h * 0.5:
                continue

            aspect_ratio = bw_val / float(bh_val)
            area = bw_val * bh_val

            # Typical text overlays have aspect ratio >= 1.5 and reasonable font sizes
            if 1.5 <= aspect_ratio <= 18.0 and (12 <= bh_val <= h * 0.15):
                # Check location heuristics
                label = "Text Overlay"
                box_type = "text"
                confidence = 0.88

                # If in lower third and horizontal, often a username handle
                if y > h * 0.70 and bw_val < w * 0.6:
                    label = "Instagram Handle"
                    box_type = "handle"
                    confidence = 0.94
                # Timestamp detection: short, often top corners or bottom corners
                elif (y < h * 0.20 or y > h * 0.80) and 2.5 <= aspect_ratio <= 7.0 and bw_val < w * 0.35:
                    label = "Timestamp / Date"
                    box_type = "timestamp"
                    confidence = 0.91

                boxes.append(BoundingBox(
                    id=str(uuid.uuid4())[:8],
                    x=int(x),
                    y=int(y),
                    width=int(bw_val),
                    height=int(bh_val),
                    label=label,
                    confidence=confidence,
                    type=box_type
                ))
        return boxes

    def _detect_social_overlays(self, img: np.ndarray, gray: np.ndarray, w: int, h: int) -> List[BoundingBox]:
        boxes = []
        # Social media zones:
        # Bottom-left: Instagram @username pill or TikTok username
        # Top-right: Platform watermark logo
        # Bottom-right: Watermark logo or audio name
        zones = [
            ("Instagram Handle", "handle", 0.03, 0.78, 0.42, 0.14),
            ("Reels / TikTok Watermark", "logo", 0.72, 0.04, 0.25, 0.12),
            ("Watermark / Audio Tag", "logo", 0.60, 0.85, 0.38, 0.12),
            ("Date / Time Overlay", "timestamp", 0.04, 0.04, 0.30, 0.10),
        ]

        for label, box_type, rx, ry, rw, rh in zones:
            zx = int(w * rx)
            zy = int(h * ry)
            zw = int(w * rw)
            zh = int(h * rh)

            roi_gray = gray[zy:zy+zh, zx:zx+zw]
            if roi_gray.size == 0:
                continue

            # Compute standard deviation of laplacian (sharp edge density)
            lap_var = cv2.Laplacian(roi_gray, cv2.CV_64F).var()
            
            # High edge energy in canonical overlay zone indicates presence of overlay
            if lap_var > 140:
                # Find refined sub-box inside zone
                edges = cv2.Canny(roi_gray, 50, 150)
                sub_cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if sub_cnts:
                    sub_pts = np.vstack([c for c in sub_cnts if cv2.contourArea(c) > 20] or [sub_cnts[0]])
                    sx, sy, sw, sh = cv2.boundingRect(sub_pts)
                    if sw > 20 and sh > 10:
                        boxes.append(BoundingBox(
                            id=str(uuid.uuid4())[:8],
                            x=int(zx + sx),
                            y=int(zy + sy),
                            width=int(sw),
                            height=int(sh),
                            label=label,
                            confidence=0.92,
                            type=box_type
                        ))
        return boxes

    def _detect_transparent_watermarks(self, img: np.ndarray, gray: np.ndarray, w: int, h: int) -> List[BoundingBox]:
        boxes = []
        # Center watermark detection (common in stock photos and video proofs)
        cx1 = int(w * 0.25)
        cy1 = int(h * 0.25)
        cw = int(w * 0.50)
        ch = int(h * 0.50)

        center_roi = gray[cy1:cy1+ch, cx1:cx1+cw]
        if center_roi.size > 0:
            # Watermarks often show repeating high-pass texture
            hp = cv2.Sobel(center_roi, cv2.CV_32F, 1, 1, ksize=3)
            hp_var = np.var(hp)
            if hp_var > 350:
                # Semi-transparent watermark detected in central quadrant
                boxes.append(BoundingBox(
                    id=str(uuid.uuid4())[:8],
                    x=int(cx1 + cw * 0.15),
                    y=int(cy1 + ch * 0.3),
                    width=int(cw * 0.7),
                    height=int(ch * 0.4),
                    label="Center Watermark",
                    confidence=0.86,
                    type="logo"
                ))
        return boxes

    def _merge_overlapping_boxes(self, boxes: List[BoundingBox], max_w: int, max_h: int) -> List[BoundingBox]:
        if not boxes:
            return []

        # Convert to working format: [x1, y1, x2, y2, label, type, confidence]
        rects = [[b.x, b.y, b.x + b.width, b.y + b.height, b.label, b.type, b.confidence] for b in boxes]

        # Iteratively merge overlapping or adjacent boxes until convergence
        changed = True
        while changed:
            changed = False
            merged_list = []
            while rects:
                curr = rects.pop(0)
                x1, y1, x2, y2, label, b_type, conf = curr
                merged_with_any = False

                for i in range(len(merged_list)):
                    mx1, my1, mx2, my2, mlabel, m_type, mconf = merged_list[i]

                    # Check intersection
                    iw = max(0, min(x2, mx2) - max(x1, mx1))
                    ih = max(0, min(y2, my2) - max(y1, my1))
                    intersection_area = iw * ih

                    area_curr = (x2 - x1) * (y2 - y1)
                    area_m = (mx2 - mx1) * (my2 - my1)
                    min_area = max(1, min(area_curr, area_m))

                    # Check same-line text proximity (words in same phrase or handle)
                    vert_overlap = max(0, min(y2, my2) - max(y1, my1))
                    min_h = min(y2 - y1, my2 - my1)
                    is_same_line = (min_h > 0) and (vert_overlap / float(min_h) > 0.50)
                    horiz_gap = max(0, max(x1, mx1) - min(x2, mx2))

                    should_merge = False
                    if intersection_area > 0.08 * min_area:
                        should_merge = True
                    elif abs(x1 - mx1) < 25 and abs(y1 - my1) < 25:
                        should_merge = True
                    elif is_same_line and horiz_gap <= 50:
                        # Words in same line / username phrase
                        should_merge = True

                    if should_merge:
                        nx1 = min(x1, mx1)
                        ny1 = min(y1, my1)
                        nx2 = max(x2, mx2)
                        ny2 = max(y2, my2)
                        # Inherit more specific label
                        nlabel = mlabel if "Handle" in mlabel or "Logo" in mlabel else label
                        ntype = m_type if m_type in ("handle", "logo") else b_type
                        nconf = max(conf, mconf)
                        merged_list[i] = [nx1, ny1, nx2, ny2, nlabel, ntype, nconf]
                        merged_with_any = True
                        changed = True
                        break

                if not merged_with_any:
                    merged_list.append(curr)

            rects = merged_list

        result_boxes = []
        # Sort by area descending and pick top 10 most relevant
        rects.sort(key=lambda r: (r[2] - r[0]) * (r[3] - r[1]), reverse=True)
        for item in rects[:10]:
            rx1, ry1, rx2, ry2, rlabel, rtype, rconf = item
            rx1 = max(0, rx1)
            ry1 = max(0, ry1)
            rx2 = min(max_w, rx2)
            ry2 = min(max_h, ry2)
            rw = max(10, rx2 - rx1)
            rh = max(10, ry2 - ry1)
            result_boxes.append(BoundingBox(
                id=str(uuid.uuid4())[:8],
                x=int(rx1),
                y=int(ry1),
                width=int(rw),
                height=int(rh),
                label=rlabel,
                confidence=round(float(rconf), 2),
                type=rtype
            ))
        return result_boxes

detector = WatermarkDetector()
