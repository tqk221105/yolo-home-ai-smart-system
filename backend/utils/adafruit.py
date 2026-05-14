import os
import requests
from dotenv import load_dotenv

load_dotenv()


def _strip_key(raw: str) -> str:
    s = (raw or "").strip()
    if s.lower().startswith("adafruit_api_key="):
        s = s.split("=", 1)[-1].strip()
    if s.lower().startswith("x-aio-key:"):
        s = s.split(":", 1)[-1].strip()
    return s


AIO_USERNAME = (os.getenv("ADAFRUIT_USERNAME", "") or "").strip()
AIO_KEY = _strip_key(os.getenv("ADAFRUIT_API_KEY", "") or "")
DASHBOARD_KEY = (os.getenv("ADAFRUIT_DASHBOARD_KEY", "") or "").strip()
BASE_URL = f"https://io.adafruit.com/api/v2/{AIO_USERNAME}"

HEADERS = {"X-AIO-Key": AIO_KEY}
HEADERS_JSON = {**HEADERS, "Content-Type": "application/json"}


def _http_error_detail(r) -> str:
    body = (r.text or "").strip()
    if len(body) > 1200:
        body = body[:1200] + "..."
    if not body:
        body = r.reason or ""
    return f"{r.status_code} {r.reason} for {r.url} — {body}"

FEED_KEYS = [
    "temperature", "gauge", "light", "signal", "fan-speed",
    "light-control",
    "remote", "logs", "led-switch", "relay-switch",
    "lock-status", "pin-fail-count",
]


def get_feeds_from_blocks(dashboard_key: str = DASHBOARD_KEY):
    """Fetch last_value for each feed directly — blocks API returns null for toggle feeds."""
    feeds = []
    for key in FEED_KEYS:
        try:
            r = requests.get(f"{BASE_URL}/feeds/{key}", headers=HEADERS, timeout=5)
            if r.status_code == 200:
                data = r.json()
                feeds.append({
                    "key": data.get("key"),
                    "name": data.get("name"),
                    "last_value": data.get("last_value"),
                })
            else:
                feeds.append({"key": key, "name": key, "last_value": None})
        except Exception:
            feeds.append({"key": key, "name": key, "last_value": None})
    return feeds


def send_feed_data(feed_key: str, value: str):
    r = requests.post(
        f"{BASE_URL}/feeds/{feed_key}/data",
        headers=HEADERS_JSON,
        json={"value": value},
        timeout=15,
    )
    if not r.ok:
        raise RuntimeError(_http_error_detail(r))
    return r.json()


def get_feed_history(feed_key: str, limit: int = 100):
    """Fetch historical data points for a feed from Adafruit IO."""
    r = requests.get(
        f"{BASE_URL}/feeds/{feed_key}/data",
        headers=HEADERS,
        params={"limit": min(limit, 1000)},
        timeout=10,
    )
    if not r.ok:
        raise RuntimeError(_http_error_detail(r))
    return r.json()


def get_dashboard_blocks(dashboard_key: str = DASHBOARD_KEY):
    r = requests.get(
        f"{BASE_URL}/dashboards/{dashboard_key}/blocks",
        headers=HEADERS,
        timeout=10,
    )
    if not r.ok:
        raise RuntimeError(_http_error_detail(r))
    return r.json()
