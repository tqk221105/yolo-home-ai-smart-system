import { Colors } from './Colors';

export type StatusKind = 'normal' | 'warning' | 'danger' | 'success' | 'neutral';

export const mockActiveAlert = {
  title: '1 cảnh báo đang hoạt động · Người lạ',
  type: 'danger' as StatusKind,
};

export const mockSensorData = [
  { label: 'DHT20 NHIỆT', value: '32', unit: '°C', status: 'normal' as StatusKind },
  { label: 'DHT20 ẨM', value: '65', unit: '%', status: 'normal' as StatusKind },
  { label: 'PIR CỬA', value: 'Phát hiện', unit: '', status: 'warning' as StatusKind },
];

export const mockDeviceStatus = [
  { icon: 'lock-closed-outline', name: 'Khóa cửa', state: 'Đã khóa', status: 'success' as StatusKind },
  { icon: 'bulb-outline', name: 'Đèn phòng khách', state: 'Tắt', status: 'success' as StatusKind },
  { icon: 'volume-high-outline', name: 'Buzzer', state: 'Đang kêu', status: 'danger' as StatusKind },
];

export const mockRecentLogs = [
  { time: '14:10', desc: 'Người lạ tại cửa — 34% tin cậy', status: 'warning' as StatusKind },
  { time: '13:55', desc: 'Thiên Nguyễn mở cửa — giọng nói', status: 'success' as StatusKind },
  { time: '13:40', desc: 'An Nguyễn mở cửa — khuôn mặt 93%', status: 'success' as StatusKind },
];

export const mockAlertHistory = [
  { time: '14:10', desc: 'Người lạ tại cửa — nhận diện thất bại 34%', badge: 'Cảnh báo', status: 'warning' as StatusKind },
  { time: '13:40', desc: 'Người lạ tại cửa — nhận diện thất bại 41%', badge: 'Cảnh báo', status: 'warning' as StatusKind },
  { time: '09:00', desc: 'PIR báo động giả — không phát hiện khuôn mặt', badge: 'Auto reset', status: 'neutral' as StatusKind },
];

export function statusColors(status: StatusKind) {
  if (status === 'danger') {
    return { text: Colors.dangerRed, bg: Colors.softRed, border: Colors.borderDanger };
  }
  if (status === 'warning') {
    return { text: Colors.warningOrange, bg: Colors.softYellow, border: Colors.borderWarning };
  }
  if (status === 'success' || status === 'normal') {
    return { text: Colors.successGreen, bg: Colors.softGreen, border: Colors.borderSuccess };
  }
  return { text: Colors.mutedText, bg: Colors.bgTertiary, border: Colors.cardBorder };
}
