import hashlib
import os

from flask import Blueprint, jsonify, request
from ai.auto_control import process as auto_control_process
from ai.face_ai import (
    delete_registered_face,
    list_registered_faces,
    register_face,
    recognize_face_image,
    train_face_model,
)
from ai.face_logger import save_face_event
from ai.recognition import recognize_voice

ai_bp = Blueprint("ai", __name__)


def _admin_pin_ok(pin: str) -> bool:
    raw_pin = str(pin or "")
    pin_hash = os.getenv("FACE_ADMIN_PIN_SHA256", "").strip().lower()
    if pin_hash:
        return hashlib.sha256(raw_pin.encode("utf-8")).hexdigest() == pin_hash
    return raw_pin == os.getenv("FACE_ADMIN_PIN", "2468")


@ai_bp.route("/ai/auto-control", methods=["POST"])
def auto_control():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    sensor_data = body.get("sensor_data", {})
    device_states = body.get("device_states", {})
    result = auto_control_process(sensor_data, device_states)
    return jsonify(result)


@ai_bp.route("/ai/face-recognition", methods=["POST"])
def face_recognition():
    try:
        image_file = request.files.get("image") if request.files else None
        body = request.get_json(silent=True) if image_file is None else None
        if not isinstance(body, dict):
            body = {}
        image_data = body.get("image", None)
        result = recognize_face_image(image_data=image_data, image_file=image_file)
        status = 200 if result.get("success") else 400
        return jsonify(result), status
    except Exception as e:
        msg = f"Face recognition server error: {e}"
        save_face_event("face_recognition_error", action="DENY", message=msg)
        return jsonify({
            "success": False,
            "recognized": False,
            "label": None,
            "confidence": 0.0,
            "message": msg,
            "door_action": "ERROR",
            "identity": "unknown",
            "action": "DENY",
        }), 500


@ai_bp.route("/ai/face-register", methods=["POST"])
def face_register():
    image_file = request.files.get("image") if request.files else None
    body = request.get_json(silent=True) if image_file is None else None
    if not isinstance(body, dict):
        body = {}

    label = (
        request.form.get("label")
        if image_file is not None
        else body.get("label")
    )
    image_data = body.get("image", None)
    auto_retrain = str(
        request.form.get("auto_retrain", body.get("auto_retrain", "1"))
    ).strip().lower() not in ("0", "false", "no", "off")

    try:
        result = register_face(
            label=label,
            image_data=image_data,
            image_file=image_file,
            auto_retrain=auto_retrain,
        )
        return jsonify(result)
    except ValueError as e:
        msg = str(e)
        messages = {
            "missing_label": "Thiếu tên người dùng",
            "missing_image": "Thiếu ảnh khuôn mặt",
            "invalid_base64": "Ảnh base64 không hợp lệ",
            "unsupported_image": "Định dạng ảnh không được hỗ trợ",
            "image_too_large": "Ảnh vượt quá dung lượng cho phép",
            "invalid_image": "Ảnh lỗi hoặc không đọc được",
            "face_detector_unavailable": "Chưa cài bộ phát hiện khuôn mặt trên backend",
            "no_face_detected": "Không phát hiện khuôn mặt trong ảnh",
            "face_too_small": "Khuôn mặt quá nhỏ hoặc bị che khuất",
            "face_not_centered": "Khuôn mặt chưa nằm đủ trong khung",
        }
        return jsonify({
            "success": False,
            "message": messages.get(msg, "Dữ liệu đăng ký không hợp lệ"),
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e),
        }), 500


@ai_bp.route("/ai/face-retrain", methods=["POST"])
def face_retrain():
    try:
        return jsonify(train_face_model())
    except FileNotFoundError as e:
        return jsonify({"success": False, "message": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400


@ai_bp.route("/ai/face-labels", methods=["GET"])
def face_labels():
    return jsonify({
        "success": True,
        "faces": list_registered_faces(),
    })


@ai_bp.route("/ai/face-labels/<label>", methods=["DELETE"])
def face_label_delete(label):
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}

    pin = body.get("admin_pin", body.get("pin", ""))
    if not _admin_pin_ok(pin):
        save_face_event(
            "face_delete_denied",
            label=label,
            action="DENY",
            message="Invalid FaceAI admin PIN",
        )
        return jsonify({
            "success": False,
            "message": "PIN quản trị FaceAI không đúng",
        }), 403

    auto_retrain = str(body.get("auto_retrain", "1")).strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )

    try:
        return jsonify(delete_registered_face(label, auto_retrain=auto_retrain))
    except FileNotFoundError as e:
        return jsonify({"success": False, "message": str(e)}), 404
    except ValueError as e:
        msg = str(e)
        messages = {
            "missing_label": "Thiếu label khuôn mặt",
            "invalid_label": "Label khuôn mặt không hợp lệ",
        }
        return jsonify({"success": False, "message": messages.get(msg, msg)}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@ai_bp.route("/ai/voice-recognition", methods=["POST"])
def voice_recognition():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    audio_data = body.get("audio", None)
    result = recognize_voice(audio_data)
    return jsonify(result)
