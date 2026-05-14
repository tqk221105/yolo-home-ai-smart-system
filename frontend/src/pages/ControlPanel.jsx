import { useState, useEffect, useRef } from "react";
import { getFeeds, sendFeedData } from "../services/api";
import { getDeviceMode, setDeviceMode } from "./ThresholdPanel";

// Remote IR buttons — mapped to feed "remote"
const IR_BUTTONS = [
  { label: "1", sub: "Đèn",      value: "BTN_1" },
  { label: "2", sub: "Quạt",     value: "BTN_2" },
  { label: "3", sub: "Relay",    value: "BTN_3" },
  { label: "5", sub: "Tắt cả bật", value: "BTN_5" },
  { label: "6", sub: "Tắt cả tắt", value: "BTN_6" },
  { label: "*", sub: "Mật mã",   value: "BTN_STAR" },
  { label: "#", sub: "Reset",    value: "BTN_HASH" },
];

function SendError({ error }) {
  if (!error) return null;
  const isPermission = error?.response?.data?.error === "permission_denied";
  return (
    <div style={{
      marginBottom: 14, padding: "8px 12px", borderRadius: 8,
      background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
      fontSize: 12, color: "#dc2626",
    }}>
      {isPermission
        ? "⚠️ Chưa có quyền ghi vào feed của Bong_Bong. Cần Bong_Bong share API key hoặc mở public feed."
        : `Lỗi: ${error?.response?.data?.message || error.message}`}
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      marginTop: 10, padding: "8px 14px", borderRadius: 8,
      background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
      fontSize: 12, color: "#16a34a", display: "flex", justifyContent: "space-between",
    }}>
      <span>✓ {msg}</span>
    </div>
  );
}

// Mockup device info card (Đèn LED / Relay hardcode — feed chưa có)
function DeviceInfoCard({ icon, iconClass, title, toggleOn, onToggle, disabled, mode, modeColor, rows }) {
  return (
    <div style={{
      background: toggleOn ? "rgba(251,191,36,0.06)" : "#fff",
      border: `1px solid ${toggleOn ? "rgba(251,191,36,0.3)" : "#e8eaed"}`,
      borderRadius: 12, padding: "16px 18px",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={`device-icon ${iconClass}`} style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
              {toggleOn ? "Bật thủ công — ghi đè tự động" : "Đang tắt"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <button
            className={`toggle ${toggleOn ? "toggle-on" : "toggle-off"}`}
            onClick={onToggle}
            disabled={disabled}
          />
          {toggleOn && <span style={{ fontSize: 10, color: "#d97706", fontWeight: 600 }}>Ghi đè</span>}
        </div>
      </div>

      {/* Detail rows */}
      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#9ca3af" }}>Chế độ</span>
          <span style={{ fontWeight: 600, color: modeColor ?? "#2563eb" }}>{mode}</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#9ca3af" }}>{r.label}</span>
            <span style={{ fontWeight: 500, color: "#111827" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ControlPanel() {
  const [fanOn, setFanOn]     = useState(false);
  const [ledOn, setLedOn]     = useState(false);
  const [relayOn, setRelayOn] = useState(false);
  const [currentTemp,  setCurrentTemp]  = useState(null);
  const [currentLight, setCurrentLight] = useState(null);
  const [fanMode,   setFanModeState]   = useState(() => getDeviceMode("fan"));
  const [lightMode, setLightModeState] = useState(() => getDeviceMode("light"));
  const [sending, setSending] = useState({});
  const [sendError, setSendError] = useState(null);
  const [lastCmd, setLastCmd] = useState(null);
  const [lcdLines, setLcdLines] = useState(["LED:OFF FAN:OFF", "RLY:OFF"]);

  // Tracks which feed keys are currently being written — polling skips these
  const pendingKeys = useRef(new Set());

  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        const r = await getFeeds();
        const feeds = r.data;
        const get = (key) => feeds.find((f) => f.key === key);
        const fanSpeed = parseFloat(get("fan-speed")?.last_value) || 0;
        const led      = get("led-switch")?.last_value === "ON";
        const relay    = get("relay-switch")?.last_value === "ON";
        const temp     = parseFloat(get("temperature")?.last_value) || null;
        const light    = parseFloat(get("signal")?.last_value) || null;
        if (!pendingKeys.current.has("fan"))   { setFanOn(fanSpeed > 0); }
        if (!pendingKeys.current.has("led"))   { setLedOn(led); }
        if (!pendingKeys.current.has("relay")) { setRelayOn(relay); }
        setCurrentTemp(temp);
        setCurrentLight(light);
        if (!pendingKeys.current.has("fan") && !pendingKeys.current.has("led") && !pendingKeys.current.has("relay")) {
          setLcdLines([
            `LED:${led ? "ON" : "OFF"}  FAN:${fanSpeed > 0 ? "ON" : "OFF"}`,
            `RLY:${relay ? "ON" : "OFF"}`,
          ]);
        }
      } catch { /* backend down */ }
    };
    fetchFeeds();
    const iv = setInterval(fetchFeeds, 5000);
    return () => clearInterval(iv);
  }, []);

  const send = async (feedKey, value, key) => {
    pendingKeys.current.add(key);
    setSending((s) => ({ ...s, [key]: true }));
    setSendError(null);
    try {
      await sendFeedData(feedKey, String(value));
    } catch (e) {
      setSendError(e);
    } finally {
      setSending((s) => ({ ...s, [key]: false }));
      // Giữ lock thêm 10s sau khi ghi xong — Adafruit cần ~5-8s để sync last_value
      setTimeout(() => pendingKeys.current.delete(key), 10000);
    }
  };

  const applyMode = (device, mode) => {
    setDeviceMode(device, mode);
    if (device === "fan")   setFanModeState(mode);
    if (device === "light") setLightModeState(mode);
  };

  const handleFan = async () => {
    const next = !fanOn;
    applyMode("fan", "manual");
    setFanOn(next);
    updateLcd({ fan: next, led: ledOn, relay: relayOn });
    await send("fan-speed", next ? "50" : "0", "fan");
  };

  const handleLed = async () => {
    const next = !ledOn;
    applyMode("light", "manual");
    setLedOn(next);
    updateLcd({ fan: fanOn, led: next, relay: relayOn });
    await send("led-switch", next ? "ON" : "OFF", "led");
  };

  const handleRelay = async () => {
    const next = !relayOn;
    setRelayOn(next);
    updateLcd({ fan: fanOn, led: ledOn, relay: next });
    await send("relay-switch", next ? "ON" : "OFF", "relay");
  };

  const updateLcd = ({ fan, led, relay }) => {
    setLcdLines([
      `LED:${led ? "ON" : "OFF"}  FAN:${fan ? "ON" : "OFF"}`,
      `RLY:${relay ? "ON" : "OFF"}`,
    ]);
  };

  const handleIR = async (btn) => {
    const t0 = Date.now();
    await send("remote", btn.value, btn.value);
    const ms = Date.now() - t0;
    setLastCmd({ btn: btn.label, label: btn.sub, ms });

    // Apply local state based on button
    if (btn.value === "BTN_1") { applyMode("light","manual"); setLedOn(true);   updateLcd({ fan: fanOn,  led: true,  relay: relayOn }); await send("led-switch",   "ON",  "led"); }
    if (btn.value === "BTN_2") { applyMode("fan","manual"); setFanOn(true);   updateLcd({ fan: true,   led: ledOn, relay: relayOn }); await send("fan-speed",    "50",  "fan"); }
    if (btn.value === "BTN_3") { setRelayOn(true); updateLcd({ fan: fanOn,  led: ledOn, relay: true   }); await send("relay-switch", "ON",  "relay"); }
    if (btn.value === "BTN_5") {
      applyMode("fan", "manual"); applyMode("light", "manual");
      setLedOn(true); setFanOn(true); setRelayOn(true);
      updateLcd({ fan: true, led: true, relay: true });
      await Promise.all([send("led-switch","ON","led"), send("fan-speed","50","fan"), send("relay-switch","ON","relay")]);
    }
    if (btn.value === "BTN_6") {
      applyMode("fan", "manual"); applyMode("light", "manual");
      setLedOn(false); setFanOn(false); setRelayOn(false);
      updateLcd({ fan: false, led: false, relay: false });
      await Promise.all([send("led-switch","OFF","led"), send("fan-speed","0","fan"), send("relay-switch","OFF","relay")]);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Điều khiển thủ công</h2>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            Ghi đè chế độ tự động — lệnh thực thi trong vòng 2 giây (NFR1)
          </div>
        </div>
        <span className="badge badge-blue">UC09 — Remote IR</span>
      </div>

      <SendError error={sendError} />

      {/* Device cards */}
      <div style={{ marginBottom: 8 }}>
        <div className="devices-section-label">THIẾT BỊ</div>
        <div className="grid-3" style={{ marginBottom: 14 }}>
          <DeviceInfoCard
            icon="☀"
            iconClass="device-icon-blue"
            title="Đèn LED trắng"
            toggleOn={ledOn}
            onToggle={handleLed}
            disabled={sending.led}
            mode={{ auto: "Tự động", manual: "Thủ công", ai: "AI" }[lightMode]}
            modeColor={{ auto: "#16a34a", manual: "#d97706", ai: "#2563eb" }[lightMode]}
            rows={[
              { label: "Ánh sáng hiện tại", value: currentLight != null ? `${currentLight} lux` : "-- lux" },
              { label: "Ngưỡng tự động",    value: "200 lux" },
              { label: "Phím remote",        value: "BTN_1" },
            ]}
          />
          <DeviceInfoCard
            icon="⚡"
            iconClass="device-icon-green"
            title="Quạt mini"
            toggleOn={fanOn}
            onToggle={handleFan}
            disabled={sending.fan}
            mode={{ auto: "Tự động", manual: "Thủ công", ai: "AI" }[fanMode]}
            modeColor={{ auto: "#16a34a", manual: "#d97706", ai: "#2563eb" }[fanMode]}
            rows={[
              { label: "Nhiệt độ hiện tại", value: currentTemp != null ? `${currentTemp} °C` : "-- °C" },
              { label: "Ngưỡng tự động",    value: "30°C" },
              { label: "Phím remote",        value: "BTN_2" },
            ]}
          />
          <DeviceInfoCard
            icon="⚡"
            iconClass="device-icon-amber"
            title="Relay"
            toggleOn={relayOn}
            onToggle={handleRelay}
            disabled={sending.relay}
            mode="Thủ công"
            modeColor="#d97706"
            rows={[
              { label: "Trạng thái",  value: "Đóng mạch" },
              { label: "Phím remote", value: "BTN_3" },
            ]}
          />
        </div>
      </div>

      {/* Bottom: Remote + LCD side by side */}
      <div className="grid-2">
        {/* Remote IR */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <h3>Mô phỏng Remote IR</h3>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
            Nhấn phím để gửi lệnh IR — mắt thu nhận tín hiệu &lt; 2s
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {IR_BUTTONS.map((btn) => (
              <button
                key={btn.value}
                className="btn btn-ghost"
                style={{ padding: "12px 0", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                onClick={() => handleIR(btn)}
                disabled={sending[btn.value]}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{btn.label}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{btn.sub}</span>
              </button>
            ))}
          </div>

          <Toast msg={lastCmd ? `BTN_${lastCmd.btn} nhận — ${lastCmd.label} bật thành công` : null} />
        </div>

        {/* LCD status */}
        <div className="card">
          <h3>LCD 16×2 — Trạng thái hiện tại</h3>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
            Màn hình LCD cập nhật sau mỗi lệnh (UC09)
          </div>

          <div className="lcd-screen" style={{ marginBottom: 16 }}>
            {lcdLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Lệnh cuối",        value: lastCmd ? `BTN_${lastCmd.btn} — ${lastCmd.label}` : "--" },
              { label: "Thời gian phản hồi", value: lastCmd ? `${lastCmd.ms}ms / 2s giới hạn` : "--" },
              { label: "Tín hiệu IR",       value: "Tốt", color: "#16a34a" },
              { label: "Mắt thu IR",        value: "Online", color: "#16a34a" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#9ca3af" }}>{row.label}</span>
                <span style={{ fontWeight: 500, color: row.color ?? "#111827" }}>
                  {row.color ? `● ${row.value}` : row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
