import { useState, useEffect, useCallback } from "react";
import { deleteFaceLabel, getFaceLabels, getFaceLog } from "../services/api";

const LOG_COLORS = { OPEN: "#16a34a", DENIED: "#dc2626" };
const LOG_LABELS = { OPEN: "Mo cua", DENIED: "Tu choi" };

function FaceCard({ face, onDelete, deleting }) {
  const ready = face.ready;
  const need = Math.max(0, (face.min_samples ?? 3) - (face.samples ?? 0));
  const updated = face.last_updated
    ? new Date(face.last_updated * 1000).toLocaleDateString("vi-VN")
    : "--";

  return (
    <div style={{
      border: `1.5px solid ${ready ? "rgba(22,163,74,0.3)" : "rgba(217,119,6,0.3)"}`,
      borderRadius: 12,
      padding: "20px 18px",
      position: "relative",
      background: ready ? "rgba(22,163,74,0.03)" : "rgba(251,191,36,0.05)",
    }}>
      <span style={{
        position: "absolute", top: 12, right: 12,
        fontSize: 10, padding: "2px 8px", borderRadius: 99,
        background: ready ? "rgba(22,163,74,0.1)" : "rgba(217,119,6,0.1)",
        color: ready ? "#16a34a" : "#d97706", fontWeight: 600,
      }}>
        {ready ? "San sang" : `Can ${need} mau`}
      </span>

      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "rgba(37,99,235,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 700, color: "#2563eb", margin: "0 auto 12px",
      }}>
        {String(face.label || "?").slice(0, 2).toUpperCase()}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{face.label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
          {face.samples ?? 0} mau anh · cap nhat {updated}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, marginTop: 6,
          color: ready ? "#16a34a" : "#d97706",
        }}>
          {ready ? "Du dieu kien mo cua" : `Can toi thieu ${face.min_samples ?? 3} mau`}
        </div>
        <button
          onClick={() => onDelete(face.label)}
          disabled={deleting}
          style={{
            marginTop: 12,
            width: "100%",
            border: "1px solid rgba(220,38,38,0.25)",
            borderRadius: 10,
            padding: "8px 10px",
            background: "rgba(220,38,38,0.06)",
            color: "#dc2626",
            fontSize: 12,
            fontWeight: 700,
            cursor: deleting ? "not-allowed" : "pointer",
            opacity: deleting ? 0.6 : 1,
          }}
        >
          {deleting ? "Dang xoa..." : "Xoa khuon mat"}
        </button>
      </div>
    </div>
  );
}

export default function FacePanel() {
  const [faces, setFaces] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const [adminPin, setAdminPin] = useState("");
  const [deletingLabel, setDeletingLabel] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [labelsRes, logRes] = await Promise.all([
        getFaceLabels(),
        getFaceLog(),
      ]);
      setFaces(Array.isArray(labelsRes.data?.faces) ? labelsRes.data.faces : []);
      setLog(Array.isArray(logRes.data) ? logRes.data : []);
      setError(null);
    } catch {
      setError("Khong the ket noi backend FaceAI.");
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 5000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  async function handleDelete(label) {
    if (!adminPin.trim()) {
      setError("Nhap PIN quan tri FaceAI truoc khi xoa.");
      return;
    }

    setDeletingLabel(label);
    try {
      await deleteFaceLabel(label, adminPin.trim());
      setAdminPin("");
      setError(null);
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Khong xoa duoc khuon mat.");
    } finally {
      setDeletingLabel(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Quan ly khuon mat</h2>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            Du lieu lay tu backend FaceAI: data/faces, face_model.pkl va face_log.csv.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>FaceAI backend</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>·</span>
          <span style={{ fontSize: 12, color: "#374151" }}>{faces.length} label</span>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 14, padding: "8px 12px", borderRadius: 8,
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 12, color: "#dc2626",
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div className="devices-section-label">KHUON MAT DA DANG KY</div>
        {faces.length === 0 ? (
          <div className="card" style={{ color: "#9ca3af", fontSize: 13 }}>
            Chua co khuon mat dang ky. Hay dang ky tren mobile tab FaceAI.
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                Nhap PIN quan tri FaceAI de xoa khuon mat. Mac dinh demo: 2468, nen doi trong .env bang FACE_ADMIN_PIN.
              </div>
              <input
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                type="password"
                placeholder="PIN quan tri FaceAI"
                style={{
                  width: "100%",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              {faces.map((f) => (
                <FaceCard
                  key={f.label}
                  face={f}
                  deleting={deletingLabel === f.label}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <div className="devices-section-label">DANG KY KHUON MAT MOI</div>
          <div className="card">
            <div style={{ padding: "24px 0", textAlign: "center", color: "#6b7280", fontSize: 13, lineHeight: 1.7 }}>
              Dang ky va chup mau thuc hien tren ung dung mobile de dung camera that.
              Moi label can toi thieu 3 mau ro mat trong khung.
            </div>
          </div>

          <div className="devices-section-label" style={{ marginTop: 16 }}>CAU HINH NHAN DIEN</div>
          <div className="card">
            {[
              { label: "Nguong chap nhan", value: ">= 90%" },
              { label: "So mau toi thieu", value: "3 mau / label" },
              { label: "Kiem tra anh", value: "Co mat, du lon, nam trong khung" },
              { label: "Mo cua", value: "Publish Adafruit door feed" },
            ].map((r) => (
              <div key={r.label} style={{
                display: "flex", justifyContent: "space-between", fontSize: 13,
                padding: "8px 0", borderBottom: "1px solid #f3f4f6",
              }}>
                <span style={{ color: "#9ca3af" }}>{r.label}</span>
                <span style={{ fontWeight: 500, color: "#111827" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="devices-section-label">LOG NHAN DIEN HOM NAY</div>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 70px 80px", gap: 8, marginBottom: 10 }}>
              {["GIO", "KHUON MAT", "KET QUA", "DO TIN CAY"].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em" }}>
                  {h}
                </div>
              ))}
            </div>
            {log.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0" }}>Chua co log FaceAI</div>
            ) : log.map((entry, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "70px 1fr 70px 80px",
                gap: 8, alignItems: "center", padding: "8px 0",
                borderTop: "1px solid #f3f4f6", fontSize: 13,
              }}>
                <span style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{entry.time}</span>
                <span style={{ fontWeight: 500, color: "#111827" }}>{entry.face}</span>
                <span style={{ fontWeight: 600, color: LOG_COLORS[entry.result] ?? "#6b7280" }}>
                  {LOG_LABELS[entry.result] ?? entry.result}
                </span>
                <span style={{ fontWeight: 600, color: entry.result === "DENIED" ? "#dc2626" : "#111827" }}>
                  {entry.confidence}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
