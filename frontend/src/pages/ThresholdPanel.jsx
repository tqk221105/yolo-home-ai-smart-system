import { useState, useEffect } from "react";
import { getFeeds, sendFeedData, runAutoControl } from "../services/api";

const DEFAULTS = { fan: { thresh: 30 }, light: { thresh: 200 } };

export const getDeviceMode  = (device) => localStorage.getItem(`mode_${device}`) ?? "auto";
export const setDeviceMode  = (device, mode) => localStorage.setItem(`mode_${device}`, mode);

const MODES = [
  { key: "auto",   label: "Tự động",  desc: "Đặt ngưỡng — hệ thống tự bật/tắt theo cảm biến" },
  { key: "manual", label: "Thủ công", desc: "Toggle tay trên trang Điều khiển" },
  { key: "ai",     label: "AI",       desc: "AI mock quyết định dựa trên if/else" },
];

function ModeSelector({ mode, onChange }) {
  return (
    <div style={{
      display: "flex", background: "#f3f4f6", borderRadius: 10,
      padding: 4, gap: 2,
    }}>
      {MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 7, border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: mode === m.key ? "#fff" : "transparent",
            color: mode === m.key ? "#111827" : "#9ca3af",
            boxShadow: mode === m.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s",
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function ThresholdCard({
  icon, iconClass, title, subtitle, ucBadge,
  mode, onChangeMode,
  thresh, onChangeThresh,
  sliderMin, sliderMax, sliderDefault,
  sliderLabel, sliderMinLabel, sliderMaxLabel, unit,
  currentValue, currentUnit,
  deviceOn,
  statusText, statusColor,
  logicRows,
}) {
  const sliderLocked = mode !== "auto";
  const modeDesc = MODES.find((m) => m.key === mode)?.desc ?? "";

  const modeBg = {
    auto:   "rgba(22,163,74,0.06)",
    manual: "rgba(217,119,6,0.06)",
    ai:     "rgba(37,99,235,0.06)",
  }[mode];
  const modeBorder = {
    auto:   "rgba(22,163,74,0.2)",
    manual: "rgba(217,119,6,0.2)",
    ai:     "rgba(37,99,235,0.2)",
  }[mode];
  const modeColor = {
    auto: "#16a34a", manual: "#d97706", ai: "#2563eb",
  }[mode];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={`device-icon ${iconClass}`} style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>● {statusText}</span>
          <span className="badge badge-blue" style={{ fontSize: 10 }}>{ucBadge}</span>
        </div>
      </div>

      {/* Mode selector row */}
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: modeBg, border: `1px solid ${modeBorder}`,
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: modeColor }}>
              Chế độ: {MODES.find((m) => m.key === mode)?.label}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{modeDesc}</div>
          </div>
        </div>
        <ModeSelector mode={mode} onChange={onChangeMode} />
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 20, opacity: sliderLocked ? 0.4 : 1, transition: "opacity 0.2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "#374151" }}>{sliderLabel}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
            {thresh}<span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 2 }}>{unit}</span>
          </span>
        </div>
        <input
          type="range"
          min={sliderMin} max={sliderMax}
          value={thresh}
          disabled={sliderLocked}
          onChange={(e) => onChangeThresh(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#2563eb", cursor: sliderLocked ? "not-allowed" : "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
          <span>{sliderMinLabel}</span>
          <span>{sliderDefault}{unit} (mặc định)</span>
          <span>{sliderMaxLabel}</span>
        </div>
      </div>

      {/* Current sensor info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "#9ca3af" }}>Giá trị hiện tại</span>
          <span style={{ fontWeight: 500, color: "#111827" }}>
            {currentValue != null ? `${currentValue} ${currentUnit}` : "--"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "#9ca3af" }}>Trạng thái thiết bị</span>
          <span style={{ fontWeight: 500, color: deviceOn ? "#16a34a" : "#6b7280" }}>
            {deviceOn ? "● Đang bật" : "Đang tắt"}
            {mode === "manual" && " (tay)"}
            {mode === "ai"     && " (AI)"}
            {mode === "auto"   && " (tự động)"}
          </span>
        </div>
      </div>

      {/* Logic block */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.07em", marginBottom: 10 }}>
          LOGIC ĐANG ÁP DỤNG
        </div>
        {logicRows.map((row) => (
          <div key={row.condition} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: "#374151" }} dangerouslySetInnerHTML={{ __html: row.condition }} />
            <span style={{ fontWeight: 600, color: row.color }}>{row.result}</span>
          </div>
        ))}
        {mode === "manual" && (
          <div style={{ fontSize: 11, color: "#d97706", marginTop: 4 }}>
            Thiết bị được điều khiển tay trên trang Điều khiển — ngưỡng không áp dụng
          </div>
        )}
        {mode === "ai" && (
          <div style={{ fontSize: 11, color: "#2563eb", marginTop: 4 }}>
            AI mock dùng ngưỡng mặc định trong auto_control.py — slider bị khoá
          </div>
        )}
      </div>
    </div>
  );
}

export default function ThresholdPanel() {
  const [fanMode,   setFanMode]   = useState(() => getDeviceMode("fan"));
  const [lightMode, setLightMode] = useState(() => getDeviceMode("light"));

  const [fanThresh,   setFanThresh]   = useState(DEFAULTS.fan.thresh);
  const [lightThresh, setLightThresh] = useState(DEFAULTS.light.thresh);

  const [dirty,  setDirty]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const [currentTemp,   setCurrentTemp]   = useState(null);
  const [currentHumidity, setCurrentHumidity] = useState(null);
  const [currentLight,  setCurrentLight]  = useState(null);
  const [fanDeviceOn,   setFanDeviceOn]   = useState(false);
  const [lightDeviceOn, setLightDeviceOn] = useState(false);

  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        const r = await getFeeds();
        const list = Array.isArray(r.data) ? r.data : r.data?.value ?? [];
        const get = (key) => list.find((f) => f.key === key);
        setCurrentTemp(parseFloat(get("temperature")?.last_value) || null);
        setCurrentHumidity(parseFloat(get("gauge")?.last_value) || null);
        setCurrentLight(parseFloat(get("signal")?.last_value) || null);
        setFanDeviceOn(parseFloat(get("fan-speed")?.last_value) > 0);
        setLightDeviceOn(get("led-switch")?.last_value === "ON");
      } catch { /* backend down */ }
    };
    fetchFeeds();
    const iv = setInterval(fetchFeeds, 5000);
    return () => clearInterval(iv);
  }, []);

  // Sync mode khi user quay lại trang này từ /control
  useEffect(() => {
    const onFocus = () => {
      setFanMode(getDeviceMode("fan"));
      setLightMode(getDeviceMode("light"));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const markDirty = (fn) => { fn(); setDirty(true); setSaved(false); };

  const handleModeChange = (device, newMode) => {
    setDeviceMode(device, newMode);
    if (device === "fan")   setFanMode(newMode);
    if (device === "light") setLightMode(newMode);
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Tự động: áp dụng ngưỡng user đặt ngay với giá trị sensor hiện tại
      if (fanMode === "auto") {
        const shouldOn = currentTemp != null && currentTemp > fanThresh;
        await sendFeedData("fan-speed", shouldOn ? "50" : "0");
      }
      if (lightMode === "auto") {
        const shouldOn = currentLight != null && currentLight < lightThresh;
        await sendFeedData("led-switch", shouldOn ? "ON" : "OFF");
      }
      // AI: gọi backend mock để quyết định
      if (fanMode === "ai" || lightMode === "ai") {
        const result = await runAutoControl(
          {
            temperature: currentTemp ?? 25,
            humidity: currentHumidity ?? 50,
            light: currentLight ?? 400,
          },
          { fan: fanDeviceOn, light: lightDeviceOn }
        );
        if (fanMode === "ai" && result?.data?.fan?.changed) {
          await sendFeedData("fan-speed", result.data.fan.action === "ON" ? "50" : "0");
        }
        if (lightMode === "ai" && result?.data?.light?.changed) {
          await sendFeedData("led-switch", result.data.light.action);
        }
      }
      // Thủ công: không làm gì — user tự toggle trên trang Điều khiển
    } catch { /* ignore */ }
    setSaving(false);
    setDirty(false);
    setSaved(true);
  };

  const effectiveFanThresh   = fanMode   === "auto" ? fanThresh   : DEFAULTS.fan.thresh;
  const effectiveLightThresh = lightMode === "auto" ? lightThresh : DEFAULTS.light.thresh;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Ngưỡng tự động</h2>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            Chọn chế độ điều khiển cho từng thiết bị — áp dụng sau khi nhấn Lưu
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && !dirty && (
            <span style={{ fontSize: 12, color: "#16a34a" }}>✓ Đã lưu</span>
          )}
          {dirty && (
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: "rgba(251,191,36,0.15)", color: "#d97706", fontWeight: 500, border: "1px solid rgba(251,191,36,0.3)" }}>
              Chưa lưu thay đổi
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Đang lưu..." : "Lưu ngưỡng"}
          </button>
        </div>
      </div>

      <ThresholdCard
        icon="⚡" iconClass="device-icon-green"
        title="Quạt mini — ngưỡng nhiệt độ"
        subtitle="UC04 · Cảm biến DHT20"
        ucBadge="UC04"
        mode={fanMode}
        onChangeMode={(m) => handleModeChange("fan", m)}
        thresh={fanThresh}
        onChangeThresh={(v) => markDirty(() => setFanThresh(v))}
        sliderMin={20} sliderMax={40} sliderDefault={30}
        sliderLabel="Bật quạt khi nhiệt độ vượt"
        sliderMinLabel="20°C (mát)" sliderMaxLabel="40°C (nóng)"
        unit="°C"
        currentValue={currentTemp} currentUnit="°C"
        deviceOn={fanDeviceOn}
        statusText={fanDeviceOn ? `Đang bật — ${currentTemp ?? "--"}°C` : `Đang tắt — ${currentTemp ?? "--"}°C`}
        statusColor={fanDeviceOn ? "#16a34a" : "#f59e0b"}
        logicRows={[
          { condition: `Nhiệt độ &gt; <strong>${effectiveFanThresh}°C</strong>`, result: "Bật quạt", color: "#16a34a" },
          { condition: `Nhiệt độ ≤ <strong>${effectiveFanThresh}°C</strong>`,   result: "Tắt quạt", color: "#6b7280" },
        ]}
      />

      <ThresholdCard
        icon="☀" iconClass="device-icon-blue"
        title="Đèn LED trắng — ngưỡng ánh sáng"
        subtitle="UC03 · Cảm biến quang"
        ucBadge="UC03"
        mode={lightMode}
        onChangeMode={(m) => handleModeChange("light", m)}
        thresh={lightThresh}
        onChangeThresh={(v) => markDirty(() => setLightThresh(v))}
        sliderMin={50} sliderMax={500} sliderDefault={200}
        sliderLabel="Bật đèn khi ánh sáng xuống dưới"
        sliderMinLabel="50 lux (tối)" sliderMaxLabel="500 lux (sáng)"
        unit=" lux"
        currentValue={currentLight} currentUnit="lux"
        deviceOn={lightDeviceOn}
        statusText={lightDeviceOn ? `Đang bật — ${currentLight ?? "--"} lux` : `Đang tắt — ${currentLight ?? "--"} lux`}
        statusColor={lightDeviceOn ? "#16a34a" : "#60a5fa"}
        logicRows={[
          { condition: `Ánh sáng &lt; <strong>${effectiveLightThresh} lux</strong>`, result: "Bật đèn", color: "#16a34a" },
          { condition: `Ánh sáng ≥ <strong>${effectiveLightThresh} lux</strong>`,   result: "Tắt đèn", color: "#6b7280" },
        ]}
      />
    </div>
  );
}
