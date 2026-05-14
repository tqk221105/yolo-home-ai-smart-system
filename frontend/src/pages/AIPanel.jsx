import { useState } from "react";
import { runFaceRecognition, runVoiceRecognition } from "../services/api";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ResultCard({ result }) {
  if (!result) return null;

  const ok = result.recognized ?? result.success;
  const action = result.door_action ?? result.action;

  return (
    <div className={`ai-result ${ok ? "success" : "fail"}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: ok ? "#16a34a" : "#dc2626" }}>
          {ok ? "Thanh cong" : "That bai"}
        </span>
        <span className={`badge ${ok ? "badge-green" : "badge-red"}`}>
          {action}
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>{result.message}</div>
      {result.command && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
          Lenh: <strong style={{ color: "#111827" }}>{result.command}</strong>
        </div>
      )}
      {(result.label || result.identity) && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
          Danh tinh: <strong style={{ color: "#111827" }}>{result.label ?? result.identity}</strong>
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
          <span>Do tin cay</span>
          <span>{((result.confidence ?? 0) * 100).toFixed(0)}%</span>
        </div>
        <div className="confidence-bar">
          <div
            className="confidence-fill"
            style={{
              width: `${(result.confidence ?? 0) * 100}%`,
              background: ok ? "#22c55e" : "#ef4444",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AIPanel() {
  const [faceResult, setFaceResult] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);
  const [loadingFace, setLoadingFace] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [faceImage, setFaceImage] = useState(null);
  const [error, setError] = useState(null);

  const handleFace = async () => {
    if (!faceImage) {
      setError("Chon mot anh khuon mat truoc khi nhan dien.");
      return;
    }

    setLoadingFace(true);
    setError(null);
    try {
      const image = await fileToDataUrl(faceImage);
      const res = await runFaceRecognition(image);
      setFaceResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || "Loi goi FaceAI. Kiem tra backend Flask.");
    } finally {
      setLoadingFace(false);
    }
  };

  const handleVoice = async () => {
    setLoadingVoice(true);
    setError(null);
    try {
      const res = await runVoiceRecognition();
      setVoiceResult(res.data);
    } catch {
      setError("Loi goi voice recognition. Kiem tra backend Flask.");
    } finally {
      setLoadingVoice(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Nhan dien AI</h2>
      </div>

      <div style={{ marginBottom: 16, fontSize: 12, color: "#9ca3af" }}>
        FaceAI dung backend that. Voice recognition hien van la module demo cua backend.
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

      <div className="grid-2">
        <div className="card">
          <h3>Khuon mat (UC06)</h3>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
            Chon anh de goi API FaceAI that va kiem tra mo khoa cua.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setFaceImage(e.target.files?.[0] ?? null);
              setFaceResult(null);
            }}
            style={{ marginBottom: 12, width: "100%" }}
          />
          <button className="btn btn-primary" onClick={handleFace} disabled={loadingFace}>
            {loadingFace ? "Dang nhan dien..." : "Nhan dien khuon mat"}
          </button>
          <ResultCard result={faceResult} />
        </div>

        <div className="card">
          <h3>Giong noi (UC07)</h3>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
            Module demo backend, chua co ghi am/nhan dang giong that tren web.
          </p>
          <button className="btn btn-primary" onClick={handleVoice} disabled={loadingVoice}>
            {loadingVoice ? "Dang nhan dien..." : "Nhan dien giong noi"}
          </button>
          <ResultCard result={voiceResult} />
        </div>
      </div>
    </div>
  );
}
