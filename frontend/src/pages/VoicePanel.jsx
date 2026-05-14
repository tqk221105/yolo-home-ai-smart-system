import { useState, useEffect, useCallback } from "react";
import { getVoiceLog } from "../services/api";

const LOG_COLORS  = { EXECUTE: "#16a34a", DENIED: "#dc2626" };
const LOG_LABELS  = { EXECUTE: "Thực thi", DENIED: "Từ chối" };

const COMMANDS = [
  { id: 1, label: '"Mở cửa"',  sub: "Kích hoạt động cơ RC mở cửa",  result: "OPEN",  accuracy: 91, color: "#16a34a" },
  { id: 2, label: '"Đóng cửa"', sub: "Kích hoạt động cơ RC đóng cửa", result: "CLOSE", accuracy: 89, color: "#dc2626" },
];

const CONFIG_ROWS = [
  { label: "Chế độ lắng nghe",       value: "● Luôn bật",          color: "#16a34a" },
  { label: "Kích hoạt khi mất kết nối", value: "Không khả dụng",   color: "#dc2626" },
  { label: "Phản hồi qua LCD",        value: "● Bật",              color: "#16a34a" },
  { label: "Xác nhận bằng buzzer",    value: "● Bật",              color: "#16a34a" },
];

export default function VoicePanel() {
  const [log, setLog] = useState([]);

  const fetchLog = useCallback(async () => {
    try { const r = await getVoiceLog(); setLog(r.data); } catch { }
  }, []);

  useEffect(() => {
    fetchLog();
    const iv = setInterval(fetchLog, 5000);
    return () => clearInterval(iv);
  }, [fetchLog]);

  const displayLog = log.length > 0 ? log : [
    { time: "13:55:10", command: '"Mở cửa"',  result: "EXECUTE", confidence: 91 },
    { time: "11:10:05", command: '"Đóng cửa"', result: "EXECUTE", confidence: 89 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Cài đặt giọng nói</h2>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            UC07 — Cấu hình nhận diện giọng nói · Ra lệnh trực tiếp thực hiện trên ứng dụng điện thoại
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>● Micro online</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>·</span>
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>Điện thoại kết nối</span>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* Left col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Connection status */}
          <div>
            <div className="devices-section-label">TRẠNG THÁI KẾT NỐI</div>
            <div className="card">
              {[
                { label: "Kết nối điện thoại",  value: "● Online",       color: "#16a34a" },
                { label: "Chất lượng micro",     value: "Tốt (−18 dB)",   color: "#111827" },
                { label: "Ngôn ngữ",             value: "Tiếng Việt",     color: "#111827" },
                { label: "Ngưỡng chấp nhận",     value: "≥ 85%",          color: "#111827" },
                { label: "Timeout mỗi lần nghe", value: "5 giây",         color: "#111827" },
              ].map((r) => (
                <div key={r.label} style={{
                  display: "flex", justifyContent: "space-between", fontSize: 13,
                  padding: "9px 0", borderBottom: "1px solid #f3f4f6",
                }}>
                  <span style={{ color: "#9ca3af" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}

              {/* Mobile instruction */}
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 8,
                background: "#f9fafb", border: "1px solid #e5e7eb",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{ fontSize: 22 }}>📱</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                    Ra lệnh giọng nói trên điện thoại
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
                    Mở <span style={{ fontFamily: "monospace", color: "#2563eb" }}>dieu_khien_giong_noi.mobile</span>{" "}
                    để nói "Mở cửa" hoặc "Đóng cửa"
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Config */}
          <div>
            <div className="devices-section-label">CẤU HÌNH</div>
            <div className="card">
              {CONFIG_ROWS.map((r) => (
                <div key={r.label} style={{
                  display: "flex", justifyContent: "space-between", fontSize: 13,
                  padding: "9px 0", borderBottom: "1px solid #f3f4f6",
                }}>
                  <span style={{ color: "#9ca3af" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Commands supported */}
          <div>
            <div className="devices-section-label">DANH SÁCH LỆNH HỖ TRỢ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {COMMANDS.map((cmd) => (
                <div key={cmd.id} className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: cmd.result === "OPEN" ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16,
                      }}>
                        {cmd.result === "OPEN" ? "🔓" : "🔒"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{cmd.label}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{cmd.sub}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {cmd.accuracy}% tb
                    </span>
                  </div>
                </div>
              ))}

              {/* Fallback warning */}
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
                fontSize: 12, color: "#92400e", lineHeight: 1.6,
              }}>
                ⚠ Chức năng giọng nói không khả dụng khi mất kết nối điện thoại — hệ thống tự chuyển sang mật mã
              </div>
            </div>
          </div>

          {/* Log */}
          <div>
            <div className="devices-section-label">LOG NHẬN DIỆN HÔM NAY</div>
            <div className="card">
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 80px 70px", gap: 8, marginBottom: 10 }}>
                {["GIỜ", "LỆNH NGHE ĐƯỢC", "KẾT QUẢ", "ĐỘ KHỚP"].map((h) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em" }}>
                    {h}
                  </div>
                ))}
              </div>
              {displayLog.map((entry, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "70px 1fr 80px 70px",
                  gap: 8, alignItems: "center", padding: "8px 0",
                  borderTop: "1px solid #f3f4f6", fontSize: 13,
                }}>
                  <span style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{entry.time}</span>
                  <span style={{ fontWeight: 500, color: "#111827" }}>{entry.command}</span>
                  <span style={{ fontWeight: 600, color: LOG_COLORS[entry.result] ?? "#6b7280" }}>
                    {LOG_LABELS[entry.result] ?? entry.result}
                  </span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{entry.confidence}%</span>
                </div>
              ))}
              {log.length === 0 && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                  (Dữ liệu mẫu — log thật từ app mobile khi có feed voice-result)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
