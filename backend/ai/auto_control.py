"""
Fan: DecisionTree ML (nhiệt độ, độ ẩm).

Light: DecisionTree ML trên lux («Light») và tùy chọn «Hour» (giờ trong ngày từ CSV khi train).
Khi infer có Hour: dùng giờ hiện tại máy chủ (hoặc UTC nếu LIGHT_INFER_UTC=1).

Nhãn: LIGHT_USE_ORIGINAL_OCCUPANCY_LABELS / LIGHT_NEED_ON_MAX_LUX.
"""
import os
from datetime import datetime, timezone
from typing import Optional

import joblib
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(
    os.path.dirname(__file__)
)

MODEL_PATH = os.path.join(BASE_DIR, "models", "fan_model.pkl")
FEATURE_PATH = os.path.join(BASE_DIR, "models", "features.pkl")
LIGHT_MODEL_PATH = os.path.join(BASE_DIR, "models", "light_model.pkl")
LIGHT_FEATURE_PATH = os.path.join(BASE_DIR, "models", "light_features.pkl")

_MODEL_FILES = (
    MODEL_PATH,
    FEATURE_PATH,
    LIGHT_MODEL_PATH,
    LIGHT_FEATURE_PATH,
)


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def _inference_now() -> datetime:
    if _truthy_env("LIGHT_INFER_UTC"):
        return datetime.now(timezone.utc)
    return datetime.now()


def _inference_hour_fraction(now: Optional[datetime] = None) -> float:
    t = now if now is not None else _inference_now()
    return (
        float(t.hour)
        + t.minute / 60.0
        + t.second / 3600.0
        + t.microsecond / (3600.0 * 1e6)
    )


def _bundle_mtime_signature():
    if not all(os.path.isfile(p) for p in _MODEL_FILES):
        return None
    return tuple(os.path.getmtime(p) for p in _MODEL_FILES)


_model = None
_features = None
_light_model = None
_light_features = None
_bundle_signature = None


def _ensure_models_loaded():
    global _model, _features, _light_model, _light_features, _bundle_signature

    sig = _bundle_mtime_signature()
    if sig is None:
        missing = [p for p in _MODEL_FILES if not os.path.isfile(p)]
        raise FileNotFoundError(
            "Missing model file(s): "
            + ", ".join(missing)
            + ". Run train.py first."
        )

    if _model is not None and sig == _bundle_signature:
        return

    _model = joblib.load(MODEL_PATH)
    _features = joblib.load(FEATURE_PATH)
    _light_model = joblib.load(LIGHT_MODEL_PATH)
    _light_features = joblib.load(LIGHT_FEATURE_PATH)
    _bundle_signature = sig


def decide_fan(
    temperature: float,
    humidity: float,
    current_fan_state: bool
) -> dict:
    _ensure_models_loaded()

    x = pd.DataFrame(
        [[temperature, humidity]],
        columns=_features,
    )
    pred = _model.predict(x)[0]
    action = bool(pred)

    return {
        "action": "ON" if action else "OFF",
        "changed": action != current_fan_state,
        "reason": (
            f"ML prediction (temp={temperature}°C, humidity={humidity}%)"
        ),
    }


def decide_light(
    temperature: float,
    humidity: float,
    light_level: float,
    current_light_state: bool,
) -> dict:
    _ensure_models_loaded()

    row = [light_level]
    infer_now = None
    if _light_features and "Hour" in _light_features:
        infer_now = _inference_now()
        row.append(_inference_hour_fraction(infer_now))

    x = pd.DataFrame(
        [row],
        columns=_light_features,
    )
    pred = _light_model.predict(x)[0]
    action = bool(pred)

    inverted = _truthy_env("LIGHT_INVERT_OUTPUT")
    if inverted:
        action = not action

    suffix = " (output inverted)" if inverted else ""
    h_note = ""
    if infer_now is not None:
        tz_lbl = "UTC" if _truthy_env("LIGHT_INFER_UTC") else "local"
        h_note = (
            f" clock={infer_now.strftime('%H:%M:%S')} ({tz_lbl}), "
            f"hour_model={row[1]:.4f}h"
        )

    return {
        "action": "ON" if action else "OFF",
        "changed": action != current_light_state,
        "reason": (
            f"ML need-light={bool(pred)} -> "
            f"{'ON' if action else 'OFF'}"
            f"{suffix}; "
            f"lux={light_level}{h_note} "
            f"(ctx temp={temperature}°C humidity={humidity}%)"
        ),
    }


def process(sensor_data: dict, device_states: dict) -> dict:
    try:
        _ensure_models_loaded()
    except FileNotFoundError as e:
        return {
            "error": str(e),
            "fan": {
                "action": "OFF",
                "changed": False,
                "reason": "Models not available",
            },
            "light": {
                "action": "OFF",
                "changed": False,
                "reason": "Models not available",
            },
        }

    temperature = float(sensor_data.get("temperature", 25.0))
    humidity = float(sensor_data.get("humidity", 50.0))
    light_level = float(sensor_data.get("light", 400))

    fan_state = device_states.get("fan", False)
    light_state = device_states.get("light", False)

    return {
        "fan": decide_fan(temperature, humidity, fan_state),
        "light": decide_light(
            temperature,
            humidity,
            light_level,
            light_state,
        ),
    }
