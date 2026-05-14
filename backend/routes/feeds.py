from flask import Blueprint, jsonify, request

from ai.user_logger import save_user_action
from utils.adafruit import (
    AIO_USERNAME,
    get_dashboard_blocks,
    get_feed_history,
    get_feeds_from_blocks,
    send_feed_data,
)

feeds_bp = Blueprint("feeds", __name__)

# POST tới các feed này = thao tác user có thể ghi user_log (sau khi ghi IO thành công).
USER_ACTION_FEED_KEYS = frozenset(
    {"fan-speed", "light-control", "led-switch"}
)


def _float_or_none(raw):
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _light_on_from_value(raw) -> int:
    """0/1 từ last_value feed (ON/OFF hoặc số)."""
    if raw is None:
        return 0
    s = str(raw).strip().upper()
    if s == "ON":
        return 1
    if s in ("OFF", ""):
        return 0
    v = _float_or_none(raw)
    if v is None:
        return 0
    return 1 if v > 0 else 0


def _build_user_log_row(feed_key: str, value: str):
    """
    Đọc snapshot Adafruit (khớp frontend: lux từ signal, đèn từ led-switch / light-control).
    Áp dụng giá trị vừa POST cho feed_key. Trả tuple cho save_user_action hoặc None.
    """
    if feed_key not in USER_ACTION_FEED_KEYS:
        return None

    feeds = get_feeds_from_blocks()

    temperature = 25.0
    humidity = 50.0
    lux_light = None
    lux_signal = None
    fan = 0
    light = 0

    for feed in feeds:
        key = feed.get("key")
        lv = feed.get("last_value")

        if key == "temperature" and lv is not None:
            v = _float_or_none(lv)
            if v is not None:
                temperature = v

        if key == "gauge" and lv is not None:
            v = _float_or_none(lv)
            if v is not None:
                humidity = v

        if key == "light" and lv is not None:
            v = _float_or_none(lv)
            if v is not None:
                lux_light = v

        if key == "signal" and lv is not None:
            v = _float_or_none(lv)
            if v is not None:
                lux_signal = v

        if key == "fan-speed" and lv is not None:
            v = _float_or_none(lv)
            if v is not None:
                fan = 1 if v > 0 else 0

        if key in ("light-control", "led-switch") and lv is not None:
            light = _light_on_from_value(lv)

    # Lux: kit / frontend dùng signal; fallback feed light.
    if lux_signal is not None:
        light_level = lux_signal
    elif lux_light is not None:
        light_level = lux_light
    else:
        light_level = 400.0

    if feed_key == "fan-speed":
        v = _float_or_none(value)
        fan = 1 if (v is not None and v > 0) else 0

    if feed_key in ("light-control", "led-switch"):
        light = _light_on_from_value(value)

    return temperature, humidity, fan, light_level, light


@feeds_bp.route("/feeds", methods=["GET"])
def list_feeds():
    """Returns all feeds with last_value, extracted from dashboard blocks."""
    data = get_feeds_from_blocks()
    return jsonify(data)


@feeds_bp.route("/feeds/<feed_key>/data", methods=["GET"])
def feed_data(feed_key):
    """Returns historical data points for a feed from Adafruit IO."""
    limit = request.args.get("limit", 100, type=int)
    try:
        data = get_feed_history(feed_key, limit)
        # Adafruit returns a list of {id, value, created_at, ...}
        return jsonify(data if isinstance(data, list) else [])
    except Exception as e:
        msg = str(e)
        if "404" in msg:
            return jsonify(
                {
                    "error": "not_found",
                    "message": f"Feed '{feed_key}' not found",
                }
            ), 404
        if "401" in msg or "403" in msg:
            return jsonify(
                {
                    "error": "permission_denied",
                    "message": "No access to this feed history",
                }
            ), 403
        return jsonify({"error": "adafruit_error", "message": msg}), 502


@feeds_bp.route("/feeds/<feed_key>/data", methods=["POST"])
def send_data(feed_key):
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    value = str(body.get("value", ""))

    user_log_row = None
    if feed_key in USER_ACTION_FEED_KEYS:
        user_log_row = _build_user_log_row(feed_key, value)

    try:
        result = send_feed_data(feed_key, value)
    except Exception as e:
        msg = str(e)

        if "404" in msg:
            return jsonify({
                "error": "permission_denied",
                "message": (
                    f"Không có quyền ghi vào "
                    f"feed '{feed_key}' của {AIO_USERNAME or 'Adafruit'}. "
                    f"Cần API key của account đó."
                )
            }), 403

        return jsonify({
            "error": "adafruit_error",
            "message": msg
        }), 502

    if user_log_row is not None:
        save_user_action(*user_log_row)

    return jsonify(result)


@feeds_bp.route("/dashboard/blocks", methods=["GET"])
def dashboard_blocks():
    data = get_dashboard_blocks()
    if not isinstance(data, list):
        data = [data]
    return jsonify(data)
