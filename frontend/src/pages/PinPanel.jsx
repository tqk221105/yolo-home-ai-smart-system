import { useState, useEffect, useCallback } from "react";
import { getPinStatus, verifyPin, changePin, resetPinLock, getPinLog } from "../services/api";

// ── Numpad ──────────────────────────────────────────────
function Numpad({ value, maxLen, onChange, onSubmit, submitLabel = "Tiếp →", submitDisabled }) {
  const press = (d) => { if (value.length < maxLen) onChange(value + d); };
  const del   = ()  => onChange(value.slice(0, -1));
  return (
    <div>
      {/* Dot display */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} style={{
            width: 48, height: 48, borderRadius: 10,
            border: "1.5px solid",
            borderColor: i < value.length ? "#2563eb" : "#d1d5db",
            background: i < value.length ? "rgba(37,99,235,0.08)" : "#f9fafb",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {i < value.length && (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
            )}
          </div>
        ))}
      </div>

      {/* Grid 3×4 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} className="btn btn-ghost"
            style={{ padding: "14px 0", borderRadius: 10, fontSize: 17, fontWeight: 600, color: "#111827" }}
            onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="btn btn-ghost"
          style={{ padding: "14px 0", borderRadius: 10, fontSize: 13, color: "#6b7280" }}
          onClick={del}>
          Xóa
        </button>
        <button className="btn btn-ghost"
          style={{ padding: "14px 0", borderRadius: 10, fontSize: 17, fontWeight: 600, color: "#111827" }}
          onClick={() => press("0")}>
          0
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: "14px 0", borderRadius: 10, fontSize: 13 }}
          disabled={submitDisabled || value.length === 0}
          onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── Warning banner ───────────────────────────────────────
function WarnBanner({ failCount, maxFail, locked, remainingSec }) {
  if (!locked && failCount === 0) return null;
  if (locked) {
    const m = Math.floor(remainingSec / 60), s = remainingSec % 60;
    return (
      <div style={{
        marginBottom: 16, padding: "12px 16px", borderRadius: 10,
        background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
              Khóa tạm thời {m}:{String(s).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>
              Nhập sai {maxFail} lần → khóa {Math.round(300 / 60)} phút + kích hoạt cảnh báo
            </div>
          </div>
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#dc2626" }}>
          {failCount}/{maxFail}
        </span>
      </div>
    );
  }
  return (
    <div style={{
      marginBottom: 16, padding: "12px 16px", borderRadius: 10,
      background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
            Cảnh báo: còn {maxFail - failCount} lần nhập sai
          </div>
          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>
            Nhập sai thêm {maxFail - failCount} lần → khóa tạm thời 5 phút + kích hoạt cảnh báo
          </div>
        </div>
      </div>
      <span style={{ fontSize: 20, fontWeight: 700, color: "#dc2626" }}>
        {failCount}/{maxFail}
      </span>
    </div>
  );
}

// ── Status panel ─────────────────────────────────────────
function StatusPanel({ status, log, onReset }) {
  const rows = [
    { label: "Trạng thái khóa",        value: status.lock_status === "UNLOCKED" ? "● Mở khóa" : "● Đang khóa",
      color: status.lock_status === "UNLOCKED" ? "#16a34a" : "#dc2626" },
    { label: "Số lần sai hôm nay",      value: `${status.fail_count} / ${status.max_fail}`,
      color: status.fail_count > 0 ? "#d97706" : "#111827" },
    { label: "Lần đổi mật mã gần nhất", value: status.last_changed, color: "#111827" },
    { label: "Độ dài mật mã hiện tại",  value: `${status.pin_length} chữ số`, color: "#111827" },
    { label: "Khóa tạm thời khi sai",   value: `${status.max_fail} lần → 5 phút`, color: "#111827" },
  ];

  const logColors = { correct: "#16a34a", wrong: "#dc2626", locked: "#dc2626", changed: "#2563eb", reset: "#d97706" };
  const logLabels = { correct: "Đúng", wrong: "Sai", locked: "Khóa", changed: "Đổi", reset: "Mở khóa" };

  return (
    <div className="card" style={{ height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Trạng thái bảo mật</h3>
        {status.locked && (
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onReset}>
            Mở khóa
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#9ca3af" }}>{r.label}</span>
            <span style={{ fontWeight: 600, color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.07em", marginBottom: 10 }}>
        LỊCH SỬ NHẬP MẬT MÃ HÔM NAY
      </div>
      {log.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9ca3af" }}>Chưa có lịch sử</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {log.slice(0, 6).map((entry, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "70px 60px 1fr",
              fontSize: 12, alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "#9ca3af", fontFamily: "monospace" }}>{entry.time}</span>
              <span style={{ fontWeight: 600, color: logColors[entry.result] ?? "#111827" }}>
                {logLabels[entry.result] ?? entry.result}
              </span>
              <span style={{ color: "#374151" }}>{entry.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Change-PIN 3-step form ───────────────────────────────
function ChangePinForm({ pinLen }) {
  const [step, setStep]     = useState(0); // 0=old 1=new 2=confirm
  const [old, setOld]       = useState("");
  const [newP, setNewP]     = useState("");
  const [conf, setConf]     = useState("");
  const [busy, setBusy]     = useState(false);
  const [err,  setErr]      = useState("");
  const [ok,   setOk]       = useState(false);

  const tabLabels = ["1. Mật mã cũ", "2. Mật mã mới", "3. Xác nhận"];
  const current   = [old, newP, conf][step];
  const setCurrent = [setOld, setNewP, setConf][step];
  const maxLen = step === 0 ? pinLen : 8;

  const next = async () => {
    setErr("");
    if (step === 0) { setStep(1); return; }
    if (step === 1) {
      if (newP.length < 4) { setErr("Mật mã mới phải từ 4–8 chữ số"); return; }
      setStep(2); return;
    }
    // step 2 — submit
    if (conf !== newP) { setErr("Mật mã xác nhận không khớp"); return; }
    setBusy(true);
    try {
      await changePin(old, newP);
      setOk(true);
      setTimeout(() => { setOk(false); setStep(0); setOld(""); setNewP(""); setConf(""); }, 2500);
    } catch (e) {
      setErr(e?.response?.data?.message ?? "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      {ok && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
          fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
          ✓ Đã đổi mật mã thành công
        </div>
      )}

      {/* Tab header */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
        {tabLabels.map((t, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", paddingBottom: 10, fontSize: 12, fontWeight: 600,
            color: i === step ? "#2563eb" : i < step ? "#16a34a" : "#9ca3af",
            borderBottom: i === step ? "2px solid #2563eb" : "2px solid transparent",
          }}>{t}</div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textAlign: "center" }}>
          Nhập mật mã cũ ({pinLen} chữ số)
        </div>
      )}
      {step === 1 && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textAlign: "center" }}>
          Nhập mật mã mới (4–8 chữ số)
        </div>
      )}
      {step === 2 && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textAlign: "center" }}>
          Nhập lại mật mã mới để xác nhận
        </div>
      )}

      {err && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8,
          background: "rgba(239,68,68,0.07)", fontSize: 12, color: "#dc2626" }}>
          {err}
        </div>
      )}

      <Numpad
        value={current} maxLen={maxLen}
        onChange={(v) => { setCurrent(v); setErr(""); }}
        onSubmit={next}
        submitLabel={step < 2 ? "Tiếp →" : busy ? "Đang lưu..." : "Xác nhận"}
        submitDisabled={busy}
      />

      {step > 0 && (
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10, fontSize: 12 }}
          onClick={() => { setStep(step - 1); setErr(""); }}>
          ← Quay lại
        </button>
      )}

      <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8,
        background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
        fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
        Sau khi lưu, mật mã mới áp dụng ngay lập tức trên phần cứng Yolo:Bit.<br />
        Đảm bảo ghi nhớ trước khi xác nhận.
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function PinPanel() {
  const [mode, setMode]         = useState("verify"); // "verify" | "change"
  const [pin,  setPin]          = useState("");
  const [status, setStatus]     = useState({ locked: false, fail_count: 0, max_fail: 3, lock_status: "UNLOCKED", pin_length: 4, last_changed: "--" });
  const [log,  setLog]          = useState([]);
  const [toast, setToast]       = useState(null);   // { msg, ok }
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy]         = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await getPinStatus();
      setStatus(r.data);
      if (r.data.locked) setCountdown(r.data.locked_remaining_sec);
    } catch { /* backend down */ }
  }, []);

  const fetchLog = useCallback(async () => {
    try { const r = await getPinLog(); setLog(r.data); } catch { }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchLog();
    const iv = setInterval(() => { fetchStatus(); fetchLog(); }, 5000);
    return () => clearInterval(iv);
  }, [fetchStatus, fetchLog]);

  // Countdown timer
  useEffect(() => {
    if (!status.locked) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [status.locked]);

  const handleVerify = async () => {
    if (status.locked) return;
    setBusy(true);
    try {
      const r = await verifyPin(pin);
      if (r.data.success) {
        setToast({ msg: "Mật mã đúng — cửa đã mở", ok: true });
      } else {
        setToast({ msg: r.data.message, ok: false });
      }
    } catch (e) {
      const msg = e?.response?.data?.message ?? "Lỗi xác thực";
      setToast({ msg, ok: false });
    } finally {
      setPin("");
      setBusy(false);
      await fetchStatus();
      await fetchLog();
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleReset = async () => {
    await resetPinLock();
    await fetchStatus();
    await fetchLog();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Quản lý mật mã</h2>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            Mật mã nhập qua remote IR — UC05 · Tối đa {status.max_fail} lần sai trước khi khóa tạm thời (NFR4)
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {status.fail_count > 0 && (
            <span style={{ fontSize: 12, color: "#d97706", fontWeight: 500 }}>
              ● Nhập sai {status.fail_count}/{status.max_fail} lần
            </span>
          )}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 3, gap: 2 }}>
            {["verify", "change"].map((m) => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? "#111827" : "#9ca3af",
                  boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}>
                {m === "verify" ? "Xác minh" : "Đổi mật mã"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <WarnBanner
        failCount={status.fail_count}
        maxFail={status.max_fail}
        locked={status.locked}
        remainingSec={countdown}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left — numpad or change form */}
        {mode === "verify" ? (
          <div className="card">
            <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.07em", marginBottom: 14 }}>
              ĐỔI MẬT MÃ
            </div>
            <div style={{ textAlign: "center", fontSize: 13, color: "#374151", marginBottom: 16 }}>
              {status.locked ? "Hệ thống đang khóa — chờ thời gian hoàn tất" : "Nhập mật mã để mở cửa"}
            </div>

            {toast && (
              <div style={{
                marginBottom: 14, padding: "10px 14px", borderRadius: 8,
                background: toast.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.07)",
                border: `1px solid ${toast.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                fontSize: 13, fontWeight: 600,
                color: toast.ok ? "#16a34a" : "#dc2626",
              }}>
                {toast.ok ? "✓" : "✕"} {toast.msg}
              </div>
            )}

            <Numpad
              value={pin}
              maxLen={status.pin_length || 4}
              onChange={setPin}
              onSubmit={handleVerify}
              submitLabel={busy ? "Đang xác thực..." : "Xác nhận →"}
              submitDisabled={busy || status.locked}
            />
          </div>
        ) : (
          <ChangePinForm pinLen={status.pin_length || 4} />
        )}

        {/* Right — status + log */}
        <StatusPanel status={status} log={log} onReset={handleReset} />
      </div>
    </div>
  );
}
