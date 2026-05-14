import { useEffect, useState, useCallback } from "react";
import {
	LineChart, Line, XAxis, YAxis, CartesianGrid,
	Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getFeedData, getFaceLog, getPinLog, getVoiceLog } from "../services/api";

// ── helpers ──────────────────────────────────────────────

/** Parse Adafruit ISO timestamp → "HH:MM" local */
function fmtTime(ts) {
	if (!ts) return "--";
	const d = new Date(ts);
	return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** Derive a numeric value safely */
const toNum = (v) => {
	const n = parseFloat(v);
	return isNaN(n) ? null : n;
};

/** Average of array, rounded to 1 decimal */
const avg = (arr) => {
	const valid = arr.filter((v) => v != null);
	if (!valid.length) return null;
	return (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1);
};

/** Filter Adafruit data points to the selected range */
function filterByRange(points, range) {
	const now = Date.now();
	const msMap = { today: 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };
	const cutoff = now - (msMap[range] ?? msMap.today);
	return points.filter((p) => {
		if (!p.created_at) return true;
		return new Date(p.created_at).getTime() >= cutoff;
	});
}

/** Build merged chart data from two parallel Adafruit arrays */
function buildChartData(tempPts, humPts) {
	// Use temp timestamps as base; add humidity by nearest index
	const merged = [];
	const len = Math.max(tempPts.length, humPts.length);
	for (let i = 0; i < len; i++) {
		const tp = tempPts[i];
		const hp = humPts[i];
		const ts = tp?.created_at || hp?.created_at;
		merged.push({
			time: fmtTime(ts),
			temp: tp ? toNum(tp.value) : null,
			hum: hp ? toNum(hp.value) : null,
		});
	}
	// Reverse so oldest → newest left-to-right
	return merged.reverse();
}

// ── Tooltip ───────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
	if (!active || !payload?.length) return null;
	return (
		<div style={{
			background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
			padding: "8px 12px", fontSize: 12,
		}}>
			<div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>{label}</div>
			{payload.map((p) => (
				<div key={p.dataKey} style={{ color: p.color }}>
					{p.name}: <strong>{p.value ?? "--"}</strong>
				</div>
			))}
		</div>
	);
}

// ── Bar chart (mini, no recharts) ─────────────────────────
function SimpleBarChart({ data }) {
	const max = Math.max(...data.map((d) => d.count), 1);
	return (
		<div className="hist-bar-wrap">
			{data.map((d) => (
				<div key={d.label} className="hist-bar-group">
					<div className="hist-bar-track">
						<div
							className="hist-bar-fill"
							style={{
								height: `${Math.round((d.count / max) * 90)}%`,
								background: d.color,
							}}
						/>
					</div>
					<div className="hist-bar-lbl">{d.label}</div>
					<div className="hist-bar-num" style={{ color: d.numColor ?? "#111827" }}>
						{d.count}
					</div>
				</div>
			))}
		</div>
	);
}

// ── Badge ─────────────────────────────────────────────────
const BADGE = {
	face: { bg: "rgba(22,163,74,0.1)", color: "#16a34a", label: "Khuôn mặt" },
	pin: { bg: "rgba(37,99,235,0.1)", color: "#2563eb", label: "Mật mã" },
	voice: { bg: "rgba(217,119,6,0.1)", color: "#d97706", label: "Giọng nói" },
	success: { bg: "rgba(22,163,74,0.1)", color: "#16a34a", label: "Thành công" },
	fail: { bg: "rgba(239,68,68,0.1)", color: "#dc2626", label: "Thất bại" },
	warning: { bg: "rgba(217,119,6,0.1)", color: "#d97706", label: "Cảnh báo" },
	danger: { bg: "rgba(239,68,68,0.1)", color: "#dc2626", label: "Nguy hiểm" },
	info: { bg: "rgba(37,99,235,0.1)", color: "#2563eb", label: "Thông tin" },
};
function Badge({ type, children }) {
	const s = BADGE[type] || BADGE.info;
	return (
		<span style={{
			display: "inline-flex", alignItems: "center", gap: 4,
			fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
			background: s.bg, color: s.color,
		}}>
			{children ?? s.label}
		</span>
	);
}

// ── Main component ────────────────────────────────────────
export default function HistoryPanel() {
	const [range, setRange] = useState("today");
	const [tempRaw, setTempRaw] = useState([]);
	const [humRaw, setHumRaw] = useState([]);
	const [faceLog, setFaceLog] = useState([]);
	const [pinLog, setPinLog] = useState([]);
	const [voiceLog, setVoiceLog] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [lastUpdated, setLastUpdated] = useState(null);

	const fetchAll = useCallback(async () => {
		// Tách log bảo mật (backend) và lịch sử feed (Adafruit): 403 Adafruit không được báo như “Flask tắt”.
		try {
			const [faceRes, pinRes, voiceRes] = await Promise.all([
				getFaceLog(),
				getPinLog(),
				getVoiceLog(),
			]);
			setFaceLog(Array.isArray(faceRes.data) ? faceRes.data : []);
			setPinLog(Array.isArray(pinRes.data) ? pinRes.data : []);
			setVoiceLog(Array.isArray(voiceRes.data) ? voiceRes.data : []);
		} catch {
			setTempRaw([]);
			setHumRaw([]);
			setError("Không thể kết nối backend. Đảm bảo Flask đang chạy ở port 5000.");
			setLoading(false);
			return;
		}

		const adaParts = [];
		try {
			const tempRes = await getFeedData("temperature", 200);
			setTempRaw(Array.isArray(tempRes.data) ? tempRes.data : []);
		} catch (e) {
			setTempRaw([]);
			const st = e?.response?.status;
			if (st === 401 || st === 403) {
				adaParts.push("nhiệt độ (401/403 — kiểm tra ADAFRUIT_API_KEY và feed temperature)");
			} else {
				adaParts.push("nhiệt độ (mạng hoặc lỗi server)");
			}
		}

		try {
			const humRes = await getFeedData("gauge", 200);
			setHumRaw(Array.isArray(humRes.data) ? humRes.data : []);
		} catch (e) {
			setHumRaw([]);
			const st = e?.response?.status;
			if (st === 401 || st === 403) {
				adaParts.push("độ ẩm (401/403 — kiểm tra API key và feed gauge)");
			} else {
				adaParts.push("độ ẩm (mạng hoặc lỗi server)");
			}
		}

		setError(
			adaParts.length
				? `Không đọc được lịch sử Adafruit: ${adaParts.join("; ")}. Log mặt / PIN / giọng vẫn hiển thị.`
				: null
		);
		setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchAll();
		const id = setInterval(fetchAll, 10000);
		return () => clearInterval(id);
	}, [fetchAll]);

	// ── derived data ──────────────────────────────────────

	const tempFiltered = filterByRange(tempRaw, range);
	const humFiltered = filterByRange(humRaw, range);

	const tempVals = tempFiltered.map((p) => toNum(p.value));
	const humVals = humFiltered.map((p) => toNum(p.value));

	const avgTemp = avg(tempVals);
	const avgHum = avg(humVals);

	// Chart data — use up to 60 points for readability
	const MAX_CHART = 60;
	const chartData = buildChartData(
		tempFiltered.slice(0, MAX_CHART),
		humFiltered.slice(0, MAX_CHART),
	);

	// Door events from security logs
	const faceOpen = faceLog.filter((e) => e.result === "OPEN").length;
	const faceDenied = faceLog.filter((e) => e.result !== "OPEN").length;
	const pinOpen = pinLog.filter((e) => e.result === "correct").length;
	const pinFailed = pinLog.filter((e) => ["wrong", "locked"].includes(e.result)).length;
	const voiceOpen = voiceLog.filter((e) => e.result === "EXECUTE").length;
	const totalOpen = faceOpen + pinOpen + voiceOpen;

	// Alert events (from pin + face logs)
	const alertEvents = [
		...faceLog
			.filter((e) => e.result !== "OPEN")
			.map((e) => ({
				time: e.time,
				event: `Nhận diện khuôn mặt thất bại — ${e.face || "Người lạ"}`,
				level: "warning",
			})),
		...pinLog
			.filter((e) => e.result === "locked")
			.map((e) => ({
				time: e.time,
				event: "Khóa tạm thời — sai mật mã 3 lần",
				level: "danger",
			})),
		...pinLog
			.filter((e) => e.result === "wrong")
			.map((e) => ({
				time: e.time,
				event: `Nhập sai mật mã — ${e.note || ""}`,
				level: "warning",
			})),
	].sort((a, b) => (b.time > a.time ? 1 : -1)).slice(0, 10);

	const totalAlerts = alertEvents.length;

	// Full access log
	const accessLog = [
		...faceLog.map((e) => ({
			time: e.time, method: "face",
			result: e.result === "OPEN" ? "success" : "fail",
			who: e.result === "OPEN" ? (e.face || "—") : `${e.face || "Người lạ"} — ${e.confidence ?? "?"}%`,
			confidence: e.result === "OPEN" ? `${e.confidence ?? "?"}%` : `${e.confidence ?? "?"}%`,
		})),
		...pinLog.map((e) => ({
			time: e.time, method: "pin",
			result: ["correct", "changed", "reset"].includes(e.result) ? "success" : "fail",
			who: e.note || "—",
			confidence: "—",
		})),
		...voiceLog.map((e) => ({
			time: e.time, method: "voice",
			result: e.result === "EXECUTE" ? "success" : "fail",
			who: `"${e.command || "?"}"`,
			confidence: e.confidence != null ? `${e.confidence}%` : "—",
		})),
	].sort((a, b) => (b.time > a.time ? 1 : -1)).slice(0, 20);

	// Bar chart data
	const barData = [
		{ label: "Khuôn mặt", count: faceOpen, color: "#16a34a" },
		{ label: "Mật mã", count: pinOpen, color: "#2563eb" },
		{ label: "Giọng nói", count: voiceOpen, color: "#d97706" },
		{ label: "Thất bại", count: faceDenied + pinFailed, color: "#dc2626", numColor: "#dc2626" },
	];

	// ── render ────────────────────────────────────────────
	return (
		<div className="panel">
			{/* Header */}
			<div className="topbar" style={{ marginBottom: 4 }}>
				<div className="page-title">Lịch sử &amp; thống kê</div>
				<span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
					{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
					{lastUpdated && ` · Cập nhật ${lastUpdated}`}
				</span>
			</div>
			<div className="page-sub">Dữ liệu sensor, sự kiện cửa, cảnh báo — tự động cập nhật</div>

			{error && <div className="alert-error-banner">{error}</div>}

			{/* Summary cards */}
			<div className="hist-summary-grid">
				<div className="hist-scard">
					<div className="hist-scard-num" style={{ color: "#d97706" }}>
						{loading ? "…" : avgTemp != null ? `${avgTemp}°C` : "--"}
					</div>
					<div className="hist-scard-lbl">Nhiệt độ tb</div>
				</div>
				<div className="hist-scard">
					<div className="hist-scard-num" style={{ color: "#2563eb" }}>
						{loading ? "…" : avgHum != null ? `${avgHum}%` : "--"}
					</div>
					<div className="hist-scard-lbl">Độ ẩm tb</div>
				</div>
				<div className="hist-scard">
					<div className="hist-scard-num">{loading ? "…" : totalOpen}</div>
					<div className="hist-scard-lbl">Lần mở cửa</div>
				</div>
				<div className="hist-scard">
					<div className="hist-scard-num" style={{ color: totalAlerts > 0 ? "#dc2626" : undefined }}>
						{loading ? "…" : totalAlerts}
					</div>
					<div className="hist-scard-lbl">Sự kiện cảnh báo</div>
				</div>
			</div>

			{/* Range pills */}
			<div className="hist-range-pills">
				{[{ key: "today", label: "Hôm nay" }, { key: "7d", label: "7 ngày" }, { key: "30d", label: "30 ngày" }].map((r) => (
					<button
						key={r.key}
						className={`hist-rpill${range === r.key ? " hist-rpill-active" : ""}`}
						onClick={() => setRange(r.key)}
					>
						{r.label}
					</button>
				))}
			</div>

			{/* Line chart — temp & humidity */}
			<div className="hist-chart-wrap">
				<div className="hist-chart-header">
					<span className="hist-chart-title">Nhiệt độ &amp; Độ ẩm theo thời gian</span>
					<div style={{ display: "flex", gap: 16 }}>
						<span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
							<span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef9f27", display: "inline-block" }} />
							Nhiệt độ (°C)
						</span>
						<span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
							<span style={{ width: 8, height: 8, borderRadius: "50%", background: "#378add", display: "inline-block" }} />
							Độ ẩm (%)
						</span>
					</div>
				</div>

				{loading ? (
					<div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
						Đang tải…
					</div>
				) : chartData.length === 0 ? (
					<div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
						Chưa có dữ liệu
					</div>
				) : (
					<ResponsiveContainer width="100%" height={160}>
						<LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
							<XAxis
								dataKey="time"
								tick={{ fontSize: 10, fill: "#9ca3af" }}
								interval="preserveStartEnd"
								tickLine={false}
								axisLine={false}
							/>
							<YAxis
								tick={{ fontSize: 10, fill: "#9ca3af" }}
								tickLine={false}
								axisLine={false}
							/>
							<Tooltip content={<CustomTooltip />} />
							<Line
								type="monotone"
								dataKey="temp"
								name="Nhiệt độ"
								stroke="#ef9f27"
								strokeWidth={2}
								dot={false}
								connectNulls
							/>
							<Line
								type="monotone"
								dataKey="hum"
								name="Độ ẩm"
								stroke="#378add"
								strokeWidth={2}
								dot={false}
								connectNulls
							/>
						</LineChart>
					</ResponsiveContainer>
				)}
			</div>

			{/* Two-column: bar chart + alert events */}
			<div className="hist-cols2">
				<div>
					<div className="alert-section-label">Lần mở cửa theo phương thức</div>
					<div className="hist-chart-wrap" style={{ paddingBottom: 12 }}>
						{loading ? (
							<div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>Đang tải…</div>
						) : (
							<SimpleBarChart data={barData} />
						)}
					</div>
				</div>

				<div>
					<div className="alert-section-label">Sự kiện cảnh báo</div>
					<div className="hist-table-card">
						{alertEvents.length === 0 ? (
							<div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
								{loading ? "Đang tải…" : "Không có cảnh báo"}
							</div>
						) : (
							<table className="hist-log-table">
								<thead>
									<tr>
										<th style={{ width: 70 }}>Giờ</th>
										<th>Sự kiện</th>
										<th style={{ width: 80 }}>Mức độ</th>
									</tr>
								</thead>
								<tbody>
									{alertEvents.map((ev, i) => (
										<tr key={i}>
											<td className="hist-td-mono">{ev.time}</td>
											<td style={{ fontSize: 12 }}>{ev.event}</td>
											<td><Badge type={ev.level} /></td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>

			{/* Full access log */}
			<div className="alert-section-label" style={{ marginTop: 8 }}>Toàn bộ lịch sử mở cửa</div>
			<div className="hist-table-card">
				{accessLog.length === 0 ? (
					<div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
						{loading ? "Đang tải…" : "Chưa có dữ liệu"}
					</div>
				) : (
					<table className="hist-log-table">
						<thead>
							<tr>
								<th style={{ width: 80 }}>Thời gian</th>
								<th style={{ width: 120 }}>Phương thức</th>
								<th style={{ width: 100 }}>Kết quả</th>
								<th>Người / Lệnh</th>
								<th style={{ width: 80 }}>Độ tin cậy</th>
							</tr>
						</thead>
						<tbody>
							{accessLog.map((row, i) => (
								<tr key={i}>
									<td className="hist-td-mono">{row.time}</td>
									<td><Badge type={row.method} /></td>
									<td><Badge type={row.result} /></td>
									<td style={{ fontSize: 12, color: "#6b7280" }}>{row.who}</td>
									<td style={{
										fontSize: 12,
										color: row.result === "success" ? "#16a34a"
											: row.result === "fail" ? "#dc2626" : "#9ca3af",
									}}>
										{row.confidence}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
