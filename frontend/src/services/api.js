import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

export const getFeeds = () => api.get("/feeds");
export const getFeedData = (feedKey, limit = 10) => api.get(`/feeds/${feedKey}/data`, { params: { limit } });
export const sendFeedData = (feedKey, value) => api.post(`/feeds/${feedKey}/data`, { value });
export const getDashboardBlocks = () => api.get("/dashboard/blocks");

export const runAutoControl = (sensorData, deviceStates) =>
  api.post("/ai/auto-control", { sensor_data: sensorData, device_states: deviceStates });

export const runFaceRecognition = (image = null) =>
  api.post("/ai/face-recognition", { image });
export const getFaceLabels = () => api.get("/ai/face-labels");
export const deleteFaceLabel = (label, adminPin) =>
  api.delete(`/ai/face-labels/${encodeURIComponent(label)}`, {
    data: { admin_pin: adminPin, auto_retrain: true },
  });

export const runVoiceRecognition = (audio = null) =>
  api.post("/ai/voice-recognition", { audio });

// Security — PIN
export const getPinStatus  = ()          => api.get("/security/pin/status");
export const verifyPin     = (pin)       => api.post("/security/pin/verify",  { pin });
export const changePin     = (old_pin, new_pin) => api.post("/security/pin/change", { old_pin, new_pin });
export const resetPinLock  = ()          => api.post("/security/pin/reset");
export const getPinLog     = ()          => api.get("/security/pin/log");

// Security — Face / Voice log
export const getFaceLog    = ()          => api.get("/security/face/log");
export const postFaceLog   = (entry)     => api.post("/security/face/log",  entry);
export const getVoiceLog   = ()          => api.get("/security/voice/log");
export const postVoiceLog  = (entry)     => api.post("/security/voice/log", entry);
