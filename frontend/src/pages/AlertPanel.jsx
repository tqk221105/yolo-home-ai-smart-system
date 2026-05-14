import { useEffect, useState, useCallback } from "react";
import { getPinLog, getFaceLog, getVoiceLog, getPinStatus } from "../services/api";

// ── helpers ──────────────────────────────────────────────

function classifyPin(entry) {
	switch (entry.result) {
		case "locked":
			return {
				level: "danger",
				title: "Khóa tạm thời — nhập sai mật mã 3 lần",
				desc: entry.note || "Hệ thống khóa nhập mật mã, kích hoạt cảnh báo.",
				badge: "Nguy hiểm",
				badgeCls: "alert-badge-danger",
				source: "UC05",
				status: "Đã giải quyết",
				statusCls: "alert-badge-success",
				icon: "triangle",
			};
		case "wrong":
			return {
				level: "warning",
				title: "Nhập sai mật mã",
				desc: entry.note || "Nhập sai mật mã. Còn 1 lần trước khi hệ thống khóa tạm thời.",
				badge: "Cảnh báo",
				badgeCls: "alert-badge-warning",
				source: "UC05",
				status: "Chưa xử lý",
				statusCls: "alert-badge-warning",
				icon: "lock",
			};
		case "correct":
			return {
				level: "success",
				title: "Mở cửa bằng mật mã thành công",
				desc: "Mật mã đúng — cửa đã mở.",
				badge: "Thông tin",
				badgeCls: "alert-badge-info",
				source: "UC05",
				status: "Đã giải quyết",
				statusCls: "alert-badge-success",
				icon: "info",
			};
		case "changed":
			return {
				level: "info",
				title: "Đổi mật mã thành công",
				desc: entry.note || "Mật mã đã được thay đổi.",
				badge: "Thông tin",
				badgeCls: "alert-badge-info",
				source: "UC05",
				status: "Đã giải quyết",
				statusCls: "alert-badge-success",
				icon: "info",
			};
		case "reset":
			return {
				level: "info",
				title: "Mở khóa tạm thời",
				desc: entry.note || "Hệ thống đã được mở khóa.",
				badge: "Thông tin",
				badgeCls: "alert-badge-info",
				source: "UC05",
				status: "Đã giải quyết",
				statusCls: "alert-badge-success",
				icon: "info",
			};
		default:
			return null;
	}
}

function classifyFace(entry) {
	if (entry.result === "OPEN") {
		return {
			level: "success",
			title: `Nhận diện khuôn mặt thành công — ${entry.face || "Người dùng"}`,
			desc: `Độ tự tin: ${entry.confidence ?? "--"}%. ${entry.note || "Cửa đã mở."}`,
			badge: "Thông tin",
			badgeCls: "alert-badge-info",
			source: "UC08",
			status: "Đã giải quyết",
			statusCls: "alert-badge-success",
			icon: "face-ok",
		};
	}
	return {
		level: "warning",
		title: "Phát hiện người lạ tại cửa",
		desc: `${entry.face || "Người lạ"} — nhận diện khuôn mặt thất bại${entry.confidence ? ` (độ tự tin ${entry.confidence}% < 90%)` : ""}. ${entry.note || "Buzzer đã kích hoạt."}`,
		badge: "Cảnh báo",
		badgeCls: "alert-badge-warning",
		source: "UC08",
		status: "Chưa xử lý",
		statusCls: "alert-badge-warning",
		icon: "face-deny",
	};
}

function classifyVoice(entry) {
	if (entry.result === "EXECUTE") {
		return {
			level: "success",
			title: `Lệnh giọng nói thực thi: "${entry.command || "?"}"`,
			desc: `Độ tự tin: ${entry.confidence ?? "--"}%. ${entry.note || ""}`,
			badge: "Thông tin",
			badgeCls: "alert-badge-info",
			source: "UC09",
			status: "Đã giải quyết",
			statusCls: "alert-badge-success",
			icon: "info",
		};
	}
	return {
		level: "warning",
		title: `Lệnh giọng nói bị từ chối: "${entry.command || "?"}"`,
		desc: `${entry.note || "Không nhận dạng được hoặc không đủ quyền."} Độ tự tin: ${entry.confidence ?? "--"}%.`,
		badge: "Cảnh báo",
		badgeCls: "alert-badge-warning",
		source: "UC09",
		status: "Chưa xử lý",
		statusCls: "alert-badge-warning",
		icon: "mic",
	};
}

// ── SVG icons ─────────────────────────────────────────────

function IconTriangle() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	);
}
function IconLock() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="11" width="18" height="11" rx="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			<circle cx="12" cy="16" r="1" fill="currentColor" />
		</svg>
	);
}
function IconFaceDeny() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="8" r="4" />
			<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
			<line x1="18" y1="8" x2="22" y2="8" />
		</svg>
	);
}
function IconFaceOk() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="8" r="4" />
			<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
			<polyline points="16 11 18 13 22 9" />
		</svg>
	);
}
function IconInfo() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
	);
}
function IconMic() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
			<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
			<line x1="12" y1="19" x2="12" y2="23" />
			<line x1="8" y1="23" x2="16" y2="23" />
		</svg>
	);
}
function IconBell() {
	return (
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M18 8h1a4 4 0 0 1 0 8h-1" />
			<path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
			<line x1="6" y1="1" x2="6" y2="4" />
			<line x1="10" y1="1" x2="10" y2="4" />
			<line x1="14" y1="1" x2="14" y2="4" />
		</svg>
	);
}

function EventIcon({ icon, level }) {
	const cls = {
		danger: "alert-ei alert-ei-d",
		warning: "alert-ei alert-ei-a",
		info: "alert-ei alert-ei-i",
		success: "alert-ei alert-ei-g",
	}[level] || "alert-ei alert-ei-i";

	const svg = {
		triangle: <IconTriangle />,
		lock: <IconLock />,
		"face-deny": <IconFaceDeny />,
		"face-ok": <IconFaceOk />,
		mic: <IconMic />,
		info: <IconInfo />,
	}[icon] || <IconInfo />;

	return <div className={cls}>{svg}</div>;
}

// ── Main component ────────────────────────────────────────

export default function AlertPanel() {
	const [events, setEvents] = useState([]);
	const [pinStatus, setPinStatus] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [lastUpdated, setLastUpdated] = useState(null);

	const fetchAll = useCallback(async () => {
		try {
			const [pinRes, faceRes, voiceRes, statusRes] = await Promise.all([
				getPinLog(),
				getFaceLog(),
				getVoiceLog(),
				getPinStatus(),
			]);

			const pinEvents = (pinRes.data || []).map((e) => {
				const meta = classifyPin(e);
				return meta ? { ...meta, time: e.time, _sort: e.time, source_type: "pin" } : null;
			}).filter(Boolean);

			const faceEvents = (faceRes.data || []).map((e) => {
				const meta = classifyFace(e);
				return meta ? { ...meta, time: e.time, _sort: e.time, source_type: "face" } : null;
			}).filter(Boolean);

			const voiceEvents = (voiceRes.data || []).map((e) => {
				const meta = classifyVoice(e);
				return meta ? { ...meta, time: e.time, _sort: e.time, source_type: "voice" } : null;
			}).filter(Boolean);

			const merged = [...pinEvents, ...faceEvents, ...voiceEvents]
				.sort((a, b) => (b._sort > a._sort ? 1 : -1));

			setEvents(merged);
			setPinStatus(statusRes.data);
			setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
			setError(null);
		} catch {
			setError("Không thể kết nối backend. Đảm bảo Flask đang chạy ở port 5000.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAll();
		const id = setInterval(fetchAll, 5000);
		return () => clearInterval(id);
	}, [fetchAll]);

	// ── derived stats ─────────────────────────────────────
	const activeCount = pinStatus?.locked ? 1 : 0;
	const todayCount = events.length;
	const strangerCount = events.filter(
		(e) => e.source_type === "face" && e.level === "warning"
	).length;

	const hasActiveAlert = pinStatus?.locked;

	// ── render ────────────────────────────────────────────
	return (
		<div className="panel">
			{/* Header */}
			<div className="topbar" style={{ marginBottom: 4 }}>
				<div className="page-title">Cảnh báo &amp; thông báo</div>
				{hasActiveAlert ? (
					<span className="alert-badge alert-badge-danger" style={{ fontSize: 11 }}>
						<span className="alert-dot" /> {activeCount} cảnh báo đang hoạt động
					</span>
				) : (
					<span className="alert-badge alert-badge-success" style={{ fontSize: 11 }}>
						<span className="alert-dot" /> Không có cảnh báo
					</span>
				)}
			</div>
			<div className="page-sub">
				Sự kiện được ghi nhận tự động theo thời gian thực
				{lastUpdated && (
					<span style={{ marginLeft: 10, color: "var(--c-text-muted)" }}>
						· Cập nhật {lastUpdated}
					</span>
				)}
			</div>

			{error && (
				<div className="alert-error-banner">{error}</div>
			)}

			{/* Active alert banner */}
			{hasActiveAlert && (
				<div className="alert-active-bar">
					<IconBell />
					<span className="alert-active-bar-text">
						Hệ thống đang bị khóa tạm thời — nhập sai mật mã {pinStatus?.max_fail} lần liên tiếp
					</span>
				</div>
			)}

			{/* Summary cards */}
			<div className="alert-summary-grid">
				<div className="alert-scard">
					<div className="alert-scard-num" style={{ color: activeCount > 0 ? "var(--c-danger)" : undefined }}>
						{activeCount}
					</div>
					<div className="alert-scard-lbl">Đang hoạt động</div>
				</div>
				<div className="alert-scard">
					<div className="alert-scard-num">{todayCount}</div>
					<div className="alert-scard-lbl">Hôm nay</div>
				</div>
				<div className="alert-scard">
					<div className="alert-scard-num" style={{ color: strangerCount > 0 ? "var(--c-warning)" : undefined }}>
						{strangerCount}
					</div>
					<div className="alert-scard-lbl">Xâm nhập / người lạ</div>
				</div>
			</div>

			{/* Event feed */}
			<div className="alert-section-label">Feed sự kiện</div>

			{loading ? (
				<div style={{ padding: "32px 0", textAlign: "center", color: "var(--c-text-muted)", fontSize: 13 }}>
					Đang tải…
				</div>
			) : events.length === 0 ? (
				<div style={{ padding: "32px 0", textAlign: "center", color: "var(--c-text-muted)", fontSize: 13 }}>
					Không có sự kiện nào
				</div>
			) : (
				<div className="alert-feed-card">
					<div className="alert-feed">
						{events.map((ev, i) => (
							<div key={i} className="alert-event">
								<EventIcon icon={ev.icon} level={ev.level} />
								<div className="alert-event-body">
									<div className="alert-event-title">{ev.title}</div>
									<div className="alert-event-desc">{ev.desc}</div>
									<div className="alert-event-meta">
										<span className="alert-event-time">{ev.time}</span>
										<span className={`alert-badge ${ev.statusCls}`}>
											<span className="alert-dot" />{ev.status}
										</span>
										<span className="alert-badge alert-badge-neutral">{ev.source}</span>
									</div>
								</div>
								<div className="alert-event-right">
									<span className={`alert-badge ${ev.badgeCls}`}>{ev.badge}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
