import csv
import os
import threading
from datetime import datetime


BASE_DIR = os.path.dirname(__file__)
LOG_FILE = os.path.join(BASE_DIR, "..", "data", "face_log.csv")

_log_lock = threading.Lock()


def save_face_event(
    event: str,
    label: str = "",
    confidence=None,
    action: str = "",
    message: str = "",
):
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

    with _log_lock:
        file_exists = (
            os.path.exists(LOG_FILE)
            and os.path.getsize(LOG_FILE) > 0
        )

        with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)

            if not file_exists:
                writer.writerow([
                    "timestamp",
                    "event",
                    "label",
                    "confidence",
                    "action",
                    "message",
                ])

            writer.writerow([
                datetime.now(),
                event,
                label or "",
                "" if confidence is None else confidence,
                action or "",
                message or "",
            ])
