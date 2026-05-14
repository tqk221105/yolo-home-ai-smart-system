import csv
import os
import subprocess
import sys
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(__file__)
ACTION_COUNT_FILE = os.path.join(
    BASE_DIR,
    "..",
    "data",
    "action_count.txt"
)
LOG_FILE = os.path.join(
    BASE_DIR,
    "..",
    "data",
    "user_log.csv"
)

_log_lock = threading.Lock()
_retrain_lock = threading.Lock()
_retrain_running = False


def save_user_action(
    temperature,
    humidity,
    fan,
    light_level=None,
    light=None
):
    os.makedirs(
        os.path.dirname(LOG_FILE),
        exist_ok=True
    )

    with _log_lock:
        file_exists = (
            os.path.exists(LOG_FILE)
            and os.path.getsize(LOG_FILE) > 0
        )

        with open(
            LOG_FILE,
            "a",
            newline="",
            encoding="utf-8"
        ) as f:
            writer = csv.writer(f)

            if not file_exists:
                writer.writerow([
                    "timestamp",
                    "temperature",
                    "humidity",
                    "fan",
                    "light_level",
                    "light"
                ])

            writer.writerow([
                datetime.now(),
                temperature,
                humidity,
                fan,
                light_level,
                light
            ])

        count = increase_action_count()
        print(f"User actions: {count}")

    if count >= 50:
        _schedule_retrain()


def _schedule_retrain():
    global _retrain_running

    retrain_path = os.path.join(
        BASE_DIR,
        "..",
        "retrain.py"
    )

    if not os.path.isfile(retrain_path):
        print(f"Retrain script missing: {retrain_path}")
        return

    with _retrain_lock:
        if _retrain_running:
            return
        _retrain_running = True

    def worker():
        global _retrain_running
        try:
            print("Retraining model...")
            proc = subprocess.run(
                [sys.executable, retrain_path],
                cwd=os.path.dirname(retrain_path),
                capture_output=True,
                text=True,
                timeout=3600,
            )
            if proc.returncode == 0:
                with open(ACTION_COUNT_FILE, "w", encoding="utf-8") as f:
                    f.write("0")
                print("Retrain finished OK.")
            elif proc.returncode == 2:
                out = (proc.stdout or "").strip()
                if out:
                    print(f"Retrain skipped / no models saved — counter kept. {out[:500]}")
                else:
                    print(
                        "Retrain exit 2 (nothing saved); action counter not reset."
                    )
            else:
                err = (proc.stderr or proc.stdout or "").strip()
                print(
                    f"Retrain failed (exit {proc.returncode})"
                    + (f": {err}" if err else "")
                )
        except subprocess.TimeoutExpired:
            print("Retrain timed out.")
        except OSError as e:
            print(f"Retrain could not start: {e}")
        finally:
            with _retrain_lock:
                _retrain_running = False

    threading.Thread(target=worker, daemon=True).start()


def increase_action_count():
    count = 0

    if os.path.exists(ACTION_COUNT_FILE):
        try:
            with open(ACTION_COUNT_FILE, "r", encoding="utf-8") as f:
                text = f.read().strip()
                if text:
                    count = int(text)
        except (ValueError, OSError):
            count = 0

    count += 1

    with open(ACTION_COUNT_FILE, "w", encoding="utf-8") as f:
        f.write(str(count))

    return count
