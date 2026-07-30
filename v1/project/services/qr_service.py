"""
services/qr_service.py
========================
Generates QR codes for machines (so a physical/printed code can be scanned
by a real AGV camera later) and decodes QR codes from images or a live
webcam feed using OpenCV + pyzbar.

Falls back gracefully with clear error messages if optional dependencies
(qrcode, pyzbar, opencv) aren't installed, since these are heavier deps
that may not always be available on every machine.
"""

from __future__ import annotations
import os
from typing import Optional

ASSET_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "qr_codes")


class QRService:
    def __init__(self, output_dir: str = ASSET_DIR):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    # ------------------------------------------------------------------ #
    # Generation
    # ------------------------------------------------------------------ #
    def generate_qr(self, machine_id: str) -> Optional[str]:
        """Generates a QR code image encoding the machine_id and saves it
        to assets/qr_codes/<machine_id>.png. Returns the file path."""
        try:
            import qrcode
        except ImportError:
            print("[QRService] 'qrcode' package not installed - run: pip install qrcode[pil]")
            return None

        img = qrcode.make(machine_id)
        path = os.path.join(self.output_dir, f"{machine_id}.png")
        img.save(path)
        return path

    # ------------------------------------------------------------------ #
    # Decoding (from an image file)
    # ------------------------------------------------------------------ #
    def decode_qr_from_file(self, image_path: str) -> Optional[str]:
        try:
            import cv2
            from pyzbar import pyzbar
        except ImportError:
            print("[QRService] opencv-python / pyzbar not installed.")
            return None

        image = cv2.imread(image_path)
        if image is None:
            return None
        decoded = pyzbar.decode(image)
        if decoded:
            return decoded[0].data.decode("utf-8")
        return None

    # ------------------------------------------------------------------ #
    # Decoding (single frame from a webcam) - used by the optional
    # "live scan" mode in the AGV panel. Most of the demo uses the
    # simpler dropdown + "Scan QR" button simulation instead, since a
    # real AGV camera is not available in this environment.
    # ------------------------------------------------------------------ #
    def decode_qr_from_webcam(self, camera_index: int = 0, timeout_frames: int = 60) -> Optional[str]:
        try:
            import cv2
            from pyzbar import pyzbar
        except ImportError:
            print("[QRService] opencv-python / pyzbar not installed.")
            return None

        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            return None

        result = None
        for _ in range(timeout_frames):
            ret, frame = cap.read()
            if not ret:
                break
            decoded = pyzbar.decode(frame)
            if decoded:
                result = decoded[0].data.decode("utf-8")
                break
        cap.release()
        return result
