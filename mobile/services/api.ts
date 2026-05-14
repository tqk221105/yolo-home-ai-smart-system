import { mockAlertHistory, mockActiveAlert } from '../constants/mockData';

const BASE_URL = 'http://192.168.1.7:5000/api';

export const FACE_RECOGNITION_THRESHOLD = 0.9;
export const FACE_RECOGNITION_THRESHOLD_PERCENT = 90;

export type Feed = {
  key: string;
  name?: string;
  last_value: string | number | null;
};

export type FaceResult = {
  success: boolean;
  recognized: boolean;
  label: string | null;
  confidence: number;
  identity?: string;
  action?: 'UNLOCK' | 'DENY' | 'ERROR';
  door_action: 'UNLOCK' | 'DENY' | 'ERROR';
  message: string;
};

export type FaceRegisterResult = {
  success: boolean;
  label: string;
  retrained?: boolean;
  message?: string;
};

export type FaceLabel = {
  label: string;
  samples: number;
  trained_samples: number;
  min_samples: number;
  ready: boolean;
  last_updated?: number | null;
};

export type FaceLabelsResult = {
  success: boolean;
  faces: FaceLabel[];
};

export type FaceDeleteResult = {
  success: boolean;
  label: string;
  deleted_samples: number;
  remaining_labels: string[];
  retrained: boolean;
  model_removed: boolean;
  message: string;
};

export type FaceRetrainResult = {
  success: boolean;
  message?: string;
  samples?: number;
};

export type FaceLogEntry = {
  time?: string;
  timestamp?: string;
  face?: string;
  label?: string;
  result?: string;
  action?: string;
  confidence?: number;
  note?: string;
  message?: string;
};

export type PinStatus = {
  locked: boolean;
  locked_remaining_sec: number;
  fail_count: number;
  max_fail: number;
  lock_status: 'LOCKED' | 'UNLOCKED';
  pin_length: number;
  last_changed?: string;
};

export type PinVerifyResult = {
  success: boolean;
  locked: boolean;
  fail_count?: number;
  remaining_sec?: number;
  message: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new Error('Không kết nối được backend. Kiểm tra backend đã chạy, IP LAN trong mobile/services/api.ts và điện thoại cùng WiFi.');
  }

  let raw = '';
  try {
    raw = await response.text();
  } catch {
    raw = '';
  }

  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const preview = raw.replace(/\s+/g, ' ').slice(0, 120);
    if (response.status === 413) {
      throw new Error('Ảnh gửi lên quá lớn. Hãy chụp lại hoặc chọn ảnh rõ mặt dung lượng nhỏ hơn.');
    }
    throw new Error(`Backend lỗi ${response.status} tại ${path}. Response không phải JSON${preview ? `: ${preview}` : '.'}`);
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data
      ? String((data as { message?: unknown }).message)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function getFeeds(): Promise<Feed[]> {
  return requestJson<Feed[]>('/feeds');
}

export async function sendFeedData(feedKey: string, value: string | number) {
  return requestJson(`/feeds/${encodeURIComponent(feedKey)}/data`, jsonPost({ value: String(value) }));
}

export async function setDoorLocked(locked: boolean) {
  return sendFeedData('lock-status', locked ? 'LOCKED' : 'UNLOCKED');
}

export async function setLivingRoomLight(on: boolean) {
  return sendFeedData('led-switch', on ? 'ON' : 'OFF');
}

export async function setBuzzer(on: boolean) {
  return sendFeedData('relay-switch', on ? 'ON' : 'OFF');
}

export async function getPinStatus(): Promise<PinStatus> {
  return requestJson<PinStatus>('/security/pin/status');
}

export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  return requestJson<PinVerifyResult>('/security/pin/verify', jsonPost({ pin }));
}

export async function registerFace(username: string, image: string): Promise<FaceRegisterResult> {
  return requestJson<FaceRegisterResult>('/ai/face-register', jsonPost({
    label: username,
    image,
    auto_retrain: true,
  }));
}

export async function recognizeFace(image: string): Promise<FaceResult> {
  return requestJson<FaceResult>('/ai/face-recognition', jsonPost({ image }));
}

export async function retrainFace(): Promise<FaceRetrainResult> {
  return requestJson<FaceRetrainResult>('/ai/face-retrain', jsonPost({}));
}

export async function getFaceLabels(): Promise<FaceLabelsResult> {
  return requestJson<FaceLabelsResult>('/ai/face-labels');
}

export async function deleteFaceLabel(label: string, adminPin: string): Promise<FaceDeleteResult> {
  return requestJson<FaceDeleteResult>(
    `/ai/face-labels/${encodeURIComponent(label)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_pin: adminPin, auto_retrain: true }),
    }
  );
}

export async function getFaceLogs(): Promise<FaceLogEntry[]> {
  try {
    return await requestJson<FaceLogEntry[]>('/security/face/log');
  } catch {
    return [];
  }
}

export async function getSecurityLogs() {
  const [face, pin] = await Promise.allSettled([
    requestJson<FaceLogEntry[]>('/security/face/log'),
    requestJson<unknown[]>('/security/pin/log'),
  ]);

  return {
    face: face.status === 'fulfilled' ? face.value : [],
    pin: pin.status === 'fulfilled' ? pin.value : [],
  };
}

export async function getAlerts() {
  // TODO: đổi sang endpoint cảnh báo thật khi backend có dữ liệu cảnh báo riêng.
  return {
    active: mockActiveAlert,
    history: mockAlertHistory,
  };
}
