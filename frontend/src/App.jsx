import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ControlPanel from "./pages/ControlPanel";
import AIPanel from "./pages/AIPanel";
import ThresholdPanel from "./pages/ThresholdPanel";
import PinPanel from "./pages/PinPanel";
import FacePanel from "./pages/FacePanel";
import VoicePanel from "./pages/VoicePanel";
import AlertPanel from "./pages/AlertPanel";
import HistoryPanel from "./pages/HistoryPanel";
import "./App.css";

const NAV = [
  {
    section: "CHÍNH",
    items: [
      { to: "/", icon: "⊞", label: "Dashboard", end: true },
    ],
  },
  {
    section: "THIẾT BỊ",
    items: [
      { to: "/control", icon: "✳", label: "Điều khiển" },
      { to: "/thresholds", icon: "⚙", label: "Ngưỡng tự động" },
    ],
  },
  {
    section: "BẢO MẬT",
    items: [
      { to: "/pin", icon: "🔒", label: "Mật mã" },
      { to: "/face", icon: "👤", label: "Khuôn mặt" },
      { to: "/voice", icon: "🎤", label: "Giọng nói" },
    ],
  },
  {
    section: "HỆ THỐNG",
    items: [
      { to: "/alerts", icon: "🔔", label: "Cảnh báo" },
      { to: "/history", icon: "📈", label: "Lịch sử" },
      { to: "/settings", icon: "⚙", label: "Cài đặt", disabled: true },
    ],
  },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">🏠</div>
            <span className="logo-text">Yolo:Home</span>
          </div>
          <nav className="sidebar-nav">
            {NAV.map((group) => (
              <div key={group.section}>
                <div className="nav-section">{group.section}</div>
                {group.items.map((item) =>
                  item.disabled ? (
                    <span key={item.label} className="nav-item" style={{ opacity: 0.4, cursor: "default" }}>
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </span>
                  ) : (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </NavLink>
                  )
                )}
              </div>
            ))}
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/control" element={<ControlPanel />} />
            <Route path="/ai" element={<AIPanel />} />
            <Route path="/thresholds" element={<ThresholdPanel />} />
            <Route path="/pin" element={<PinPanel />} />
            <Route path="/face" element={<FacePanel />} />
            <Route path="/voice" element={<VoicePanel />} />
            <Route path="/alerts" element={<AlertPanel />} />
            <Route path="/history" element={<HistoryPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
