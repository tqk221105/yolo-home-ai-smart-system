from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import csv
import hashlib
import os
from utils.adafruit import send_feed_data
from ai.face_logger import LOG_FILE as FACE_CSV_LOG_FILE


def _push_lock_state(locked: bool, fail_count: int):
    try:
        send_feed_data("lock-status",    "LOCKED" if locked else "UNLOCKED")
        send_feed_data("pin-fail-count", str(fail_count))
    except Exception:
        pass

security_bp = Blueprint("security", __name__)

# --- In-memory state (reset on server restart) ---
_PIN = "1234"           # default PIN
_fail_count = 0
_locked_until = None    # datetime or None
_pin_log = []           # list of dicts
_face_log = []
_voice_log = []

MAX_FAIL = 3
LOCK_MINUTES = 5


def _now_str():
    return datetime.now().strftime("%H:%M:%S")


def _is_locked():
    global _locked_until
    if _locked_until and datetime.now() < _locked_until:
        return True
    if _locked_until and datetime.now() >= _locked_until:
        _locked_until = None  # auto-unlock
    return False


# ──────────────── PIN ────────────────

@security_bp.route("/security/pin/status", methods=["GET"])
def pin_status():
    global _fail_count, _locked_until
    locked = _is_locked()
    remaining = 0
    if locked and _locked_until:
        remaining = max(0, int((_locked_until - datetime.now()).total_seconds()))
    return jsonify({
        "locked": locked,
        "locked_remaining_sec": remaining,
        "fail_count": _fail_count,
        "max_fail": MAX_FAIL,
        "lock_status": "LOCKED" if locked else "UNLOCKED",
        "pin_length": len(_PIN),
        "last_changed": "07/04/2026",   # static for demo
    })


@security_bp.route("/security/pin/verify", methods=["POST"])
def pin_verify():
    global _fail_count, _locked_until

    if _is_locked():
        remaining = max(0, int((_locked_until - datetime.now()).total_seconds()))
        return jsonify({"success": False, "locked": True, "remaining_sec": remaining,
                        "message": f"Khóa tạm thời — còn {remaining}s"}), 403

    body = request.get_json(silent=True) or {}
    entered = str(body.get("pin", ""))

    if entered == _PIN:
        _fail_count = 0
        entry = {"time": _now_str(), "result": "correct", "note": "Mở cửa thành công"}
        _pin_log.insert(0, entry)
        if len(_pin_log) > 50:
            _pin_log.pop()
        _push_lock_state(False, 0)
        return jsonify({"success": True, "locked": False, "fail_count": 0,
                        "message": "Mật mã đúng — cửa đã mở"})
    else:
        _fail_count += 1
        if _fail_count >= MAX_FAIL:
            _locked_until = datetime.now() + timedelta(minutes=LOCK_MINUTES)
            note = f"Sai {MAX_FAIL} lần — khóa {LOCK_MINUTES} phút"
            entry = {"time": _now_str(), "result": "locked", "note": note}
        else:
            note = f"Lần {_fail_count}"
            if _fail_count == MAX_FAIL - 1:
                note += " — cảnh báo"
            entry = {"time": _now_str(), "result": "wrong", "note": note}
        _pin_log.insert(0, entry)
        if len(_pin_log) > 50:
            _pin_log.pop()
        _push_lock_state(_fail_count >= MAX_FAIL, _fail_count)
        return jsonify({
            "success": False,
            "locked": _fail_count >= MAX_FAIL,
            "fail_count": _fail_count,
            "message": entry["note"],
        }), 401


@security_bp.route("/security/pin/change", methods=["POST"])
def pin_change():
    global _PIN, _fail_count

    if _is_locked():
        return jsonify({"success": False, "message": "Đang khóa — không thể đổi mật mã"}), 403

    body = request.get_json(silent=True) or {}
    old_pin = str(body.get("old_pin", ""))
    new_pin = str(body.get("new_pin", ""))

    if old_pin != _PIN:
        return jsonify({"success": False, "message": "Mật mã cũ không đúng"}), 401

    if not (4 <= len(new_pin) <= 8) or not new_pin.isdigit():
        return jsonify({"success": False, "message": "Mật mã mới phải từ 4–8 chữ số"}), 400

    _PIN = new_pin
    _fail_count = 0
    entry = {"time": _now_str(), "result": "changed", "note": "Đổi mật mã thành công"}
    _pin_log.insert(0, entry)
    return jsonify({"success": True, "message": "Đã đổi mật mã"})


@security_bp.route("/security/pin/reset", methods=["POST"])
def pin_reset():
    global _fail_count, _locked_until
    _fail_count = 0
    _locked_until = None
    entry = {"time": _now_str(), "result": "reset", "note": "Mở khóa tạm thời"}
    _pin_log.insert(0, entry)
    return jsonify({"success": True, "message": "Đã mở khóa"})


@security_bp.route("/security/pin/log", methods=["GET"])
def pin_log():
    return jsonify(_pin_log[:20])


# ──────────────── FACE LOG ────────────────

@security_bp.route("/security/face/log", methods=["GET"])
def face_log_get():
    rows = []
    if os.path.isfile(FACE_CSV_LOG_FILE):
        try:
            with open(FACE_CSV_LOG_FILE, newline="", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    ts = row.get("timestamp", "")
                    try:
                        time_text = datetime.fromisoformat(ts).strftime("%H:%M:%S")
                    except ValueError:
                        time_text = ts[-8:] if len(ts) >= 8 else _now_str()

                    action = row.get("action", "")
                    confidence = row.get("confidence", "")
                    try:
                        confidence = round(float(confidence) * 100)
                    except (TypeError, ValueError):
                        confidence = 0

                    rows.append({
                        "time": time_text,
                        "face": row.get("label") or "unknown",
                        "result": "OPEN" if action == "UNLOCK" else "DENIED",
                        "confidence": confidence,
                        "note": row.get("message", ""),
                    })
        except OSError:
            rows = []

    return jsonify((rows[::-1] + _face_log)[:20])


@security_bp.route("/security/face/log", methods=["POST"])
def face_log_post():
    """Mobile app posts recognition result here."""
    body = request.get_json(silent=True) or {}
    entry = {
        "time": _now_str(),
        "face": body.get("face", "Người lạ"),
        "result": body.get("result", "DENIED"),   # OPEN | DENIED
        "confidence": body.get("confidence", 0),
        "note": body.get("note", ""),
    }
    _face_log.insert(0, entry)
    if len(_face_log) > 50:
        _face_log.pop()
    return jsonify({"success": True})


# ──────────────── VOICE LOG ────────────────

@security_bp.route("/security/voice/log", methods=["GET"])
def voice_log_get():
    return jsonify(_voice_log[:20])


@security_bp.route("/security/voice/log", methods=["POST"])
def voice_log_post():
    """Mobile app posts voice command result here."""
    body = request.get_json(silent=True) or {}
    entry = {
        "time": _now_str(),
        "command": body.get("command", ""),
        "result": body.get("result", "DENIED"),   # EXECUTE | DENIED
        "confidence": body.get("confidence", 0),
        "note": body.get("note", ""),
    }
    _voice_log.insert(0, entry)
    if len(_voice_log) > 50:
        _voice_log.pop()
    return jsonify({"success": True})
