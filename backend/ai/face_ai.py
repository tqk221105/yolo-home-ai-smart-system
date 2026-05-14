import base64
import binascii
import os
import re
import shutil
import time
from io import BytesIO
from typing import Optional

import joblib
import numpy as np
from dotenv import load_dotenv

from ai.face_logger import save_face_event
from utils.adafruit import send_feed_data


load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DEFAULT_FACE_DATA_DIR = os.path.join(BASE_DIR, "data", "faces")
DEFAULT_FACE_MODEL_PATH = os.path.join(BASE_DIR, "models", "face_model.pkl")

IMAGE_EXT_BY_MAGIC = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG\r\n\x1a\n": ".png",
    b"RIFF": ".webp",
}

_model_cache = None
_model_signature = None
FEATURE_MODE = "face_crop_gray_32_v2"


def _env_path(name: str, default: str) -> str:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    if os.path.isabs(raw):
        return os.path.normpath(raw)
    return os.path.normpath(os.path.join(BASE_DIR, raw))


def face_data_dir() -> str:
    return _env_path("FACE_DATA_DIR", DEFAULT_FACE_DATA_DIR)


def face_model_path() -> str:
    return _env_path("FACE_MODEL_PATH", DEFAULT_FACE_MODEL_PATH)


def confidence_threshold() -> float:
    raw = os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.90").strip()
    try:
        return float(raw)
    except ValueError:
        return 0.90


def min_samples_per_label() -> int:
    raw = os.getenv("FACE_MIN_SAMPLES_PER_LABEL", "3").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 3


def face_distance_margin() -> float:
    raw = os.getenv("FACE_DISTANCE_MARGIN", "0.18").strip()
    try:
        return max(0.01, float(raw))
    except ValueError:
        return 0.18


def face_sample_distance_threshold() -> float:
    raw = os.getenv("FACE_SAMPLE_DISTANCE_THRESHOLD", "0.50").strip()
    try:
        return max(0.05, float(raw))
    except ValueError:
        return 0.50


def require_detected_face() -> bool:
    return os.getenv("FACE_REQUIRE_DETECTED_FACE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def min_face_area_ratio() -> float:
    raw = os.getenv("FACE_MIN_AREA_RATIO", "0.08").strip()
    try:
        return max(0.01, float(raw))
    except ValueError:
        return 0.08


def face_center_tolerance() -> float:
    raw = os.getenv("FACE_CENTER_TOLERANCE", "0.28").strip()
    try:
        return max(0.05, float(raw))
    except ValueError:
        return 0.28


def door_feed_key() -> str:
    return os.getenv("ADAFRUIT_DOOR_FEED", "lock-status").strip() or "lock-status"


def door_open_value() -> str:
    return os.getenv("ADAFRUIT_DOOR_OPEN_VALUE", "UNLOCKED").strip() or "UNLOCKED"


def _safe_label(label: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", (label or "").strip())
    return cleaned.strip("._-")


def _clear_model_cache():
    global _model_cache, _model_signature
    _model_cache = None
    _model_signature = None


def _decode_image(image_data=None, image_file=None) -> bytes:
    if image_file is not None:
        data = image_file.read()
    else:
        if not image_data:
            raise ValueError("missing_image")
        if not isinstance(image_data, str):
            raise ValueError("invalid_image")
        text = image_data.strip()
        if "," in text and text.lower().startswith("data:"):
            text = text.split(",", 1)[1]
        try:
            data = base64.b64decode(text, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("invalid_base64")

    if not data:
        raise ValueError("missing_image")
    if len(data) > int(os.getenv("FACE_MAX_IMAGE_BYTES", "5242880")):
        raise ValueError("image_too_large")
    if _image_ext(data) is None:
        raise ValueError("unsupported_image")
    return data


def _image_ext(data: bytes) -> Optional[str]:
    for magic, ext in IMAGE_EXT_BY_MAGIC.items():
        if data.startswith(magic):
            if ext == ".webp" and data[8:12] != b"WEBP":
                continue
            return ext
    return None


def _largest_face_box(data: bytes):
    try:
        import cv2
    except ImportError:
        return None

    raw = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if bgr is None:
        return None

    height, width = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = os.path.join(
        cv2.data.haarcascades,
        "haarcascade_frontalface_default.xml",
    )
    detector = cv2.CascadeClassifier(cascade_path)
    if detector.empty():
        return None

    min_side = max(40, int(min(width, height) * 0.16))
    faces = detector.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(min_side, min_side),
    )
    if len(faces) == 0:
        return None

    return max(faces, key=lambda box: box[2] * box[3])


def _extract_features_with_cv2_face_crop(data: bytes):
    try:
        import cv2
    except ImportError:
        return None

    raw = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if bgr is None:
        return None

    box = _largest_face_box(data)
    if box is None:
        return None

    height, width = bgr.shape[:2]
    x, y, w, h = [int(v) for v in box]
    pad_x = int(w * 0.22)
    pad_y = int(h * 0.28)
    x0 = max(0, x - pad_x)
    y0 = max(0, y - pad_y)
    x1 = min(width, x + w + pad_x)
    y1 = min(height, y + h + pad_y)

    gray = cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    arr = resized.astype(np.float32).reshape(-1) / 255.0
    mean = np.array([arr.mean(), arr.std()], dtype=np.float32)
    return np.concatenate([arr, mean])


def _extract_features_with_pillow(data: bytes):
    try:
        from PIL import Image
    except ImportError:
        return None

    try:
        with Image.open(BytesIO(data)) as img:
            img.verify()
        with Image.open(BytesIO(data)) as img:
            img = img.convert("L").resize((32, 32))
            arr = np.asarray(img, dtype=np.float32).reshape(-1) / 255.0
    except Exception as exc:
        raise ValueError("invalid_image") from exc

    mean = np.array([arr.mean(), arr.std()], dtype=np.float32)
    return np.concatenate([arr, mean])


def extract_features(data: bytes) -> np.ndarray:
    features = _extract_features_with_cv2_face_crop(data)
    if features is None:
        features = _extract_features_with_pillow(data)
    if features is None:
        hist = np.bincount(
            np.frombuffer(data, dtype=np.uint8),
            minlength=256,
        ).astype(np.float32)
        hist = hist.reshape(64, 4).sum(axis=1)
        hist /= max(float(hist.sum()), 1.0)
        size_hint = np.array([
            min(len(data) / 5_000_000.0, 1.0),
            float(data[0]) / 255.0,
            float(data[-1]) / 255.0,
        ], dtype=np.float32)
        features = np.concatenate([hist, size_hint])

    norm = float(np.linalg.norm(features))
    if norm > 0:
        features = features / norm
    return features.astype(np.float32)


def validate_face_quality(data: bytes):
    if not require_detected_face():
        return

    try:
        import cv2
    except ImportError as exc:
        raise ValueError("face_detector_unavailable") from exc

    raw = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("invalid_image")

    cascade_path = os.path.join(
        cv2.data.haarcascades,
        "haarcascade_frontalface_default.xml",
    )
    detector = cv2.CascadeClassifier(cascade_path)
    if detector.empty():
        raise ValueError("face_detector_unavailable")

    height, width = bgr.shape[:2]
    box = _largest_face_box(data)
    if box is None:
        raise ValueError("no_face_detected")

    x, y, w, h = box
    area_ratio = (w * h) / float(width * height)
    if area_ratio < min_face_area_ratio():
        raise ValueError("face_too_small")

    cx = (x + w / 2.0) / width
    cy = (y + h / 2.0) / height
    tol = face_center_tolerance()
    if abs(cx - 0.5) > tol or abs(cy - 0.5) > tol:
        raise ValueError("face_not_centered")


def _file_signature(path: str):
    if not os.path.isfile(path):
        return None
    return os.path.getmtime(path)


def _load_model():
    global _model_cache, _model_signature

    path = face_model_path()
    sig = _file_signature(path)
    if sig is None:
        raise FileNotFoundError(
            f"Face model not found: {path}. Register faces and run /api/ai/face-retrain first."
        )
    if _model_cache is not None and sig == _model_signature:
        return _model_cache

    model = joblib.load(path)
    if not isinstance(model, dict) or "centroids" not in model:
        raise ValueError("Unsupported FaceAI model format")
    if model.get("feature_mode") != FEATURE_MODE or "sample_vectors" not in model:
        train_face_model()
        sig = _file_signature(path)
        model = joblib.load(path)
    _model_cache = model
    _model_signature = sig
    return model


def train_face_model() -> dict:
    data_dir = face_data_dir()
    model_path = face_model_path()

    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"Face data directory not found: {data_dir}")

    grouped = {}
    for label in sorted(os.listdir(data_dir)):
        label_dir = os.path.join(data_dir, label)
        if not os.path.isdir(label_dir):
            continue

        vectors = []
        for name in sorted(os.listdir(label_dir)):
            path = os.path.join(label_dir, name)
            if not os.path.isfile(path):
                continue
            with open(path, "rb") as f:
                vectors.append(extract_features(f.read()))

        if vectors:
            grouped[label] = vectors

    if not grouped:
        raise ValueError("No registered face samples found")

    centroids = {
        label: np.mean(np.vstack(vectors), axis=0)
        for label, vectors in grouped.items()
    }
    sample_counts = {
        label: len(vectors)
        for label, vectors in grouped.items()
    }
    radii = {}
    for label, vectors in grouped.items():
        centroid = centroids[label]
        distances = [
            float(np.linalg.norm(vector - centroid))
            for vector in vectors
        ]
        radii[label] = max(distances) if distances else 0.0

    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump({
        "version": 1,
        "feature_mode": FEATURE_MODE,
        "created_at": time.time(),
        "centroids": centroids,
        "sample_vectors": grouped,
        "sample_counts": sample_counts,
        "radii": radii,
    }, model_path)

    _clear_model_cache()

    save_face_event(
        "face_retrain",
        label=",".join(sorted(grouped.keys())),
        action="TRAIN",
        message=f"Trained FaceAI with {sum(sample_counts.values())} sample(s)",
    )

    return {
        "success": True,
        "labels": sorted(grouped.keys()),
        "sample_counts": sample_counts,
        "model_path": model_path,
    }


def list_registered_faces() -> list:
    data_dir = face_data_dir()
    model = None
    try:
        model = _load_model()
    except Exception:
        model = None

    faces = []
    if not os.path.isdir(data_dir):
        return faces

    model_counts = model.get("sample_counts", {}) if model else {}
    for label in sorted(os.listdir(data_dir)):
        label_dir = os.path.join(data_dir, label)
        if not os.path.isdir(label_dir):
            continue

        samples = [
            name for name in os.listdir(label_dir)
            if os.path.isfile(os.path.join(label_dir, name))
        ]
        mtimes = [
            os.path.getmtime(os.path.join(label_dir, name))
            for name in samples
        ]
        sample_count = len(samples)
        trained_count = int(model_counts.get(label, 0))
        ready = trained_count >= min_samples_per_label()
        faces.append({
            "label": label,
            "samples": sample_count,
            "trained_samples": trained_count,
            "min_samples": min_samples_per_label(),
            "ready": ready,
            "last_updated": max(mtimes) if mtimes else None,
        })

    return faces


def delete_registered_face(label: str, auto_retrain=True) -> dict:
    safe_label = _safe_label(label)
    if not safe_label:
        raise ValueError("missing_label")

    label_dir = os.path.join(face_data_dir(), safe_label)
    data_root = os.path.abspath(face_data_dir())
    target = os.path.abspath(label_dir)
    if not target.startswith(data_root + os.sep):
        raise ValueError("invalid_label")
    if not os.path.isdir(target):
        raise FileNotFoundError(f"Face label not found: {safe_label}")

    deleted_samples = len([
        name for name in os.listdir(target)
        if os.path.isfile(os.path.join(target, name))
    ])
    shutil.rmtree(target)
    _clear_model_cache()

    retrain_result = None
    remaining_faces = list_registered_faces()
    model_path = face_model_path()
    if auto_retrain and remaining_faces:
        retrain_result = train_face_model()
    elif not remaining_faces and os.path.isfile(model_path):
        os.remove(model_path)
        _clear_model_cache()

    save_face_event(
        "face_delete",
        label=safe_label,
        action="DELETE",
        message=(
            f"Deleted {deleted_samples} sample(s)"
            + (" and retrained FaceAI" if retrain_result else "")
            + ("; removed empty model" if not remaining_faces else "")
        ),
    )

    return {
        "success": True,
        "label": safe_label,
        "deleted_samples": deleted_samples,
        "remaining_labels": [face["label"] for face in remaining_faces],
        "retrained": retrain_result is not None,
        "retrain": retrain_result,
        "model_removed": not remaining_faces,
        "message": (
            f"Deleted {safe_label}"
            + (" and retrained FaceAI" if retrain_result else "")
        ),
    }


def register_face(label: str, image_data=None, image_file=None, auto_retrain=True) -> dict:
    safe_label = _safe_label(label)
    if not safe_label:
        raise ValueError("missing_label")

    data = _decode_image(image_data=image_data, image_file=image_file)
    validate_face_quality(data)
    ext = _image_ext(data) or ".jpg"

    label_dir = os.path.join(face_data_dir(), safe_label)
    os.makedirs(label_dir, exist_ok=True)

    filename = f"{int(time.time() * 1000)}{ext}"
    path = os.path.join(label_dir, filename)
    with open(path, "wb") as f:
        f.write(data)

    save_face_event(
        "face_register",
        label=safe_label,
        action="REGISTER",
        message=f"Saved sample {filename}",
    )

    retrain_result = None
    if auto_retrain:
        retrain_result = train_face_model()

    return {
        "success": True,
        "label": safe_label,
        "sample_path": path,
        "retrained": retrain_result is not None,
        "retrain": retrain_result,
    }


def recognize_face_image(image_data=None, image_file=None) -> dict:
    try:
        data = _decode_image(image_data=image_data, image_file=image_file)
        validate_face_quality(data)
    except ValueError as exc:
        code = str(exc)
        messages = {
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
        msg = messages.get(code, "Ảnh không hợp lệ")
        save_face_event("face_recognition_failed", action="DENY", message=msg)
        return _face_response(False, False, None, 0.0, msg, "DENY")

    try:
        model = _load_model()
    except FileNotFoundError as exc:
        msg = str(exc)
        save_face_event("face_model_missing", action="DENY", message=msg)
        return _face_response(False, False, None, 0.0, msg, "DENY")
    except Exception as exc:
        msg = f"Face model error: {exc}"
        save_face_event("face_model_error", action="DENY", message=msg)
        return _face_response(False, False, None, 0.0, msg, "DENY")

    try:
        vector = extract_features(data)
    except ValueError:
        msg = "Ảnh lỗi hoặc không đọc được"
        save_face_event("face_recognition_failed", action="DENY", message=msg)
        return _face_response(False, False, None, 0.0, msg, "DENY")

    best_label = None
    best_distance = None
    for label, centroid in model["centroids"].items():
        centroid = np.asarray(centroid, dtype=np.float32)
        distance = float(np.linalg.norm(vector - centroid))
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_label = label

    if best_label is None or best_distance is None:
        msg = "Không nhận ra khuôn mặt"
        save_face_event("face_stranger", label="unknown", action="DENY", message=msg)
        return _face_response(True, False, "unknown", 0.0, msg, "DENY")

    sample_counts = model.get("sample_counts", {})
    sample_count = int(sample_counts.get(best_label, 0))
    min_samples = min_samples_per_label()
    if sample_count < min_samples:
        msg = (
            f"Chưa đủ mẫu cho {best_label}: "
            f"{sample_count}/{min_samples}, không mở cửa"
        )
        save_face_event(
            "face_insufficient_samples",
            label=best_label,
            confidence=0.0,
            action="DENY",
            message=msg,
        )
        return _face_response(True, False, best_label, 0.0, msg, "DENY")

    radii = model.get("radii", {})
    class_radius = float(radii.get(best_label, 0.0))
    max_distance = max(class_radius + face_distance_margin(), 0.05)
    sample_vectors = model.get("sample_vectors", {}).get(best_label, [])
    nearest_sample_distance = None
    if sample_vectors:
        nearest_sample_distance = min(
            float(np.linalg.norm(vector - np.asarray(sample, dtype=np.float32)))
            for sample in sample_vectors
        )
    max_sample_distance = face_sample_distance_threshold()
    threshold = confidence_threshold()
    distance_ratio = best_distance / max_distance
    if distance_ratio <= 1.0:
        confidence = threshold + ((1.0 - threshold) * (1.0 - distance_ratio))
    else:
        confidence = threshold * max(0.0, 1.0 - (distance_ratio - 1.0))
    confidence = max(0.0, min(1.0, confidence))
    recognized = (
        confidence >= threshold
        and (
            nearest_sample_distance is None
            or nearest_sample_distance <= max_sample_distance
        )
    )

    if not recognized:
        msg = (
            "Độ tin cậy thấp, không mở cửa"
        )
        save_face_event(
            "face_low_confidence",
            label=best_label,
            confidence=round(confidence, 4),
            action="DENY",
            message=(
                f"{msg}; distance={best_distance:.4f}; max={max_distance:.4f}; "
                f"sample_distance={nearest_sample_distance if nearest_sample_distance is not None else -1:.4f}; "
                f"sample_max={max_sample_distance:.4f}"
            ),
        )
        return _face_response(
            True,
            False,
            best_label,
            confidence,
            msg,
            "DENY",
        )

    door_action = "UNLOCK"
    msg = f"Nhận diện {best_label} thành công"
    try:
        send_feed_data(door_feed_key(), door_open_value())
        save_face_event(
            "face_door_open",
            label=best_label,
            confidence=round(confidence, 4),
            action=door_action,
            message=f"{msg}; opened {door_feed_key()}",
        )
    except Exception as exc:
        door_action = "ERROR"
        msg = f"{msg}, nhưng gửi lệnh mở cửa thất bại: {exc}"
        save_face_event(
            "face_door_open_failed",
            label=best_label,
            confidence=round(confidence, 4),
            action=door_action,
            message=msg,
        )

    return _face_response(
        True,
        True,
        best_label,
        confidence,
        msg,
        door_action,
    )


def _face_response(
    success: bool,
    recognized: bool,
    label: Optional[str],
    confidence: float,
    message: str,
    door_action: str,
) -> dict:
    action = "UNLOCK" if door_action == "UNLOCK" else "DENY"
    identity = label if recognized and label else "unknown"

    return {
        "success": success,
        "recognized": recognized,
        "label": label,
        "confidence": round(float(confidence), 4),
        "message": message,
        "door_action": door_action,
        "identity": identity,
        "action": action,
    }
