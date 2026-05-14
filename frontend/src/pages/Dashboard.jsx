import { useEffect, useState } from "react";
import { getFeeds } from "../services/api";

function SensorCard({ label, value, unit, meta, barColor, barPercent }) {
  return (
    <div className="sensor-card">
      <div className="sensor-label">{label}</div>
      <div className="sensor-value-row">
        <span className="value-big">{value ?? "--"}</span>
        <span className="value-unit">{unit}</span>
      </div>
      <div className="sensor-bar-track">
        <div
          className="sensor-bar-fill"
          style={{ width: `${barPercent ?? 0}%`, background: barColor ?? "#60a5fa" }}
        />
      </div>
      <div className="sensor-meta">{meta}</div>
    </div>
  );
}

function DeviceCard({ icon, iconClass, name, sub, on, onToggle, disabled }) {
  return (
    <div className="device-card">
      <div className="device-info">
        <div className={`device-icon ${iconClass}`}>{icon}</div>
        <div>
          <div className="device-name">{name}</div>
          <div className="device-sub">{sub}</div>
        </div>
      </div>
      <button
        className={`toggle ${on ? "toggle-on" : "toggle-off"}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={on ? "Tắt" : "Bật"}
      />
    </div>
  );
}

export default function Dashboard() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const normalizeFeedList = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.value)) return raw.value;
      return [];
    };

    const fetchAll = async () => {
      try {
        const res = await getFeeds();
        setFeeds(normalizeFeedList(res.data));

        setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
        setError(null);
      } catch {
        setError("Không thể kết nối backend. Đảm bảo Flask đang chạy ở port 5000.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const getFeed = (key) => feeds.find((f) => f.key === key);

  const temp      = parseFloat(getFeed("temperature")?.last_value) || null;
  const humidity  = parseFloat(getFeed("gauge")?.last_value) || null;
  const light     = parseFloat(getFeed("signal")?.last_value) || null;
  const fanSpeed  = getFeed("fan-speed");

  const fanOn  = parseFloat(fanSpeed?.last_value) > 0;
  const ledOn  = getFeed("led-switch")?.last_value === "ON";
  const relayOn = getFeed("relay-switch")?.last_value === "ON";

  // Progress bar percentages (capped 0-100)
  const tempPct  = temp     != null ? Math.min(100, Math.max(0, ((temp - 15) / 25) * 100)) : 0;
  const humPct   = humidity != null ? Math.min(100, humidity) : 0;
  const lightPct = light    != null ? Math.min(100, (light / 1000) * 100) : 0;

  // LCD line simulation
  const lcdLine1 = `Temp:${temp != null ? ` ${temp}C` : " --"}  Hum:${humidity != null ? `${humidity}%` : "--"}`;
  const lcdLine2 = `Light:${light != null ? `${light}lx` : "--"}  Fan:${fanOn ? "ON" : "OFF"}`;

  if (loading) return <p className="loading" style={{ marginTop: 40 }}>Đang tải dữ liệu...</p>;
  if (error)   return <p className="error"   style={{ marginTop: 40 }}>{error}</p>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h2>Dashboard tổng quan</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="system-status">
            <span className="status-dot" />
            <span>Hệ thống đang hoạt động</span>
            {lastUpdated && <span>— cập nhật lúc {lastUpdated}</span>}
          </div>
        </div>
      </div>

      {/* Sensor row */}
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <SensorCard
          label="Nhiệt độ"
          value={temp}
          unit="°C"
          meta="Cảm biến DHT20"
          barColor="#f59e0b"
          barPercent={tempPct}
        />
        <SensorCard
          label="Độ ẩm"
          value={humidity}
          unit="%"
          meta="Cảm biến DHT20"
          barColor="#22c55e"
          barPercent={humPct}
        />
        <SensorCard
          label="Ánh sáng"
          value={light}
          unit="lux"
          meta="Cảm biến quang"
          barColor="#60a5fa"
          barPercent={lightPct}
        />
      </div>

      {/* LCD display */}
      <div className="lcd-panel">
        <div className="lcd-label">LCD 16×2 — hiển thị hiện tại</div>
        <div className="lcd-screen">
          <div>{lcdLine1}</div>
          <div>{lcdLine2}</div>
        </div>
      </div>

      {/* Device status */}
      <div style={{ marginBottom: 8 }}>
        <div className="devices-section-label">TRẠNG THÁI THIẾT BỊ</div>
        <div className="grid-2">
          <DeviceCard
            icon="⚡"
            iconClass="device-icon-green"
            name="Quạt mini"
            sub={fanOn ? `Tự động — nhiệt độ > 30°C` : "Tự động — đang tắt"}
            on={fanOn}
          />
          <DeviceCard
            icon="☀"
            iconClass="device-icon-blue"
            name="Đèn LED trắng"
            sub={ledOn ? "Đang bật" : `Tắt — ánh sáng đủ (${light ?? "--"} lux)`}
            on={ledOn}
          />
          <DeviceCard
            icon="⚡"
            iconClass="device-icon-amber"
            name="Relay"
            sub={relayOn ? "Đang bật" : "Đang tắt"}
            on={relayOn}
          />
          <DeviceCard
            icon="⚡"
            iconClass="device-icon-amber"
            name="Fan Speed"
            sub={`Tốc độ: ${getFeed("fan-speed")?.last_value ?? "--"}%`}
            on={fanOn}
          />
        </div>
      </div>

    </div>
  );
}
