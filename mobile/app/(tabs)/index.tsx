import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  mockActiveAlert,
  mockDeviceStatus,
  mockRecentLogs,
  mockSensorData,
  statusColors,
  type StatusKind,
} from '../../constants/mockData';
import { getFeeds, getSecurityLogs, setDoorLocked, type Feed, type FaceLogEntry } from '../../services/api';

type IconName = keyof typeof Ionicons.glyphMap;
type SensorItem = typeof mockSensorData[number];
type DeviceItem = typeof mockDeviceStatus[number];
type RecentLog = typeof mockRecentLogs[number];

function feedValue(feeds: Feed[], key: string) {
  return feeds.find(feed => feed.key === key)?.last_value ?? null;
}

function isOn(value: unknown) {
  const text = String(value ?? '').trim().toUpperCase();
  if (text === 'ON' || text === 'UNLOCKED' || text === '1') return true;
  if (text === 'OFF' || text === 'LOCKED' || text === '0' || text === '') return false;
  const number = Number(text);
  return Number.isFinite(number) && number > 0;
}

function timeShort(raw?: string) {
  if (!raw) return '--:--';
  return raw.slice(0, 5);
}

function faceLogToRecent(entry: FaceLogEntry): RecentLog {
  const confidence = Math.round(Number(entry.confidence ?? 0));
  const opened = entry.result === 'OPEN' || entry.action === 'UNLOCK';
  const face = entry.face ?? entry.label ?? 'unknown';
  return {
    time: timeShort(entry.time ?? entry.timestamp),
    desc: opened
      ? `${face} mở cửa — khuôn mặt ${confidence}%`
      : `${face === 'unknown' ? 'Người lạ' : face} tại cửa — ${confidence}% tin cậy`,
    status: opened ? 'success' : 'warning',
  };
}

function SensorCard({ label, value, unit, status }: SensorItem) {
  const colors = statusColors(status);
  return (
    <View style={[styles.sensorCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.sensorLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.sensorValue, { color: colors.text }]}>
        {value}
        {unit ? <Text style={styles.sensorUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function QuickAction({ icon, label, color, loading, onPress }: {
  icon: IconName;
  label: string;
  color: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickButton} onPress={onPress} activeOpacity={0.8} disabled={loading}>
      <View style={[styles.quickIcon, { backgroundColor: `${color}18` }]}>
        {loading ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={22} color={color} />}
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [sensors, setSensors] = useState<SensorItem[]>(mockSensorData);
  const [devices, setDevices] = useState<DeviceItem[]>(mockDeviceStatus);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>(mockRecentLogs);
  const [online, setOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [doorBusy, setDoorBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFeeds = useCallback((feeds: Feed[]) => {
    const temperature = feedValue(feeds, 'temperature');
    const humidity = feedValue(feeds, 'gauge');
    const pirSignal = feedValue(feeds, 'signal');
    const locked = String(feedValue(feeds, 'lock-status') ?? 'LOCKED').toUpperCase() !== 'UNLOCKED';
    const lightOn = isOn(feedValue(feeds, 'led-switch') ?? feedValue(feeds, 'light-control'));
    const buzzerOn = isOn(feedValue(feeds, 'relay-switch'));
    const pirDetected = isOn(pirSignal);

    setSensors([
      { label: 'DHT20 NHIỆT', value: temperature == null ? '32' : String(Math.round(Number(temperature))), unit: '°C', status: 'normal' },
      { label: 'DHT20 ẨM', value: humidity == null ? '65' : String(Math.round(Number(humidity))), unit: '%', status: 'normal' },
      { label: 'PIR CỬA', value: pirDetected ? 'Phát hiện' : 'Bình thường', unit: '', status: pirDetected ? 'warning' : 'normal' },
    ]);

    setDevices([
      { icon: 'lock-closed-outline', name: 'Khóa cửa', state: locked ? 'Đã khóa' : 'Đã mở', status: locked ? 'success' : 'warning' },
      { icon: 'bulb-outline', name: 'Đèn phòng khách', state: lightOn ? 'Bật' : 'Tắt', status: lightOn ? 'warning' : 'success' },
      { icon: 'volume-high-outline', name: 'Buzzer', state: buzzerOn ? 'Đang kêu' : 'Tắt', status: buzzerOn ? 'danger' : 'success' },
    ]);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [feeds, logs] = await Promise.all([getFeeds(), getSecurityLogs()]);
      applyFeeds(feeds);
      const faceLogs = logs.face.slice(0, 3).map(faceLogToRecent);
      setRecentLogs(faceLogs.length ? faceLogs : mockRecentLogs);
      setOnline(true);
      setError(null);
    } catch (err) {
      setOnline(false);
      setError(err instanceof Error ? err.message : 'Không đọc được dữ liệu backend.');
    }
  }, [applyFeeds]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  async function refresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  async function changeDoor(locked: boolean) {
    setDoorBusy(true);
    setError(null);
    setDevices(prev => prev.map(device => (
      device.name === 'Khóa cửa'
        ? { ...device, state: locked ? 'Đã khóa' : 'Đã mở', status: locked ? 'success' : 'warning' }
        : device
    )));

    try {
      await setDoorLocked(locked);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được lệnh cửa.');
    } finally {
      setDoorBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <View>
          <Text style={styles.appTitle}>YoloHome</Text>
          <Text style={styles.appSub}>Xin chào, Thiên Nguyễn</Text>
        </View>
        <View style={[styles.onlineBadge, online ? styles.onlineOk : styles.onlineWarn]}>
          <View style={[styles.onlineDot, { backgroundColor: online ? Colors.successGreen : Colors.warningOrange }]} />
          <Text style={[styles.onlineText, { color: online ? Colors.successGreen : Colors.warningOrange }]}>
            {online ? 'Online' : 'Demo'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.warningOrange} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.alertBanner} activeOpacity={0.8} onPress={() => router.push('/alerts')}>
            <Ionicons name="warning" size={16} color={Colors.dangerRed} />
            <Text style={styles.alertText}>{mockActiveAlert.title}</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.dangerRed} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>Cảm biến</Text>
        <View style={styles.sensorGrid}>
          {sensors.map(item => (
            <SensorCard key={item.label} {...item} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Thiết bị</Text>
        <View style={styles.deviceCard}>
          {devices.map((device, index) => {
            const colors = statusColors(device.status);
            return (
              <View key={device.name} style={[styles.deviceRow, index > 0 && styles.topBorder]}>
                <View style={styles.deviceIcon}>
                  <Ionicons name={device.icon as IconName} size={18} color={Colors.textSecondary} />
                </View>
                <Text style={styles.deviceName}>{device.name}</Text>
                <View style={[styles.stateBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <View style={[styles.stateDot, { backgroundColor: colors.text }]} />
                  <Text style={[styles.stateText, { color: colors.text }]}>{device.state}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Thao tác nhanh</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon="keypad-outline" label="Mở cửa" color={Colors.successGreen} onPress={() => router.push('/pin')} />
          <QuickAction icon="lock-closed-outline" label="Đóng cửa" color={Colors.dangerRed} loading={doorBusy} onPress={() => changeDoor(true)} />
          <QuickAction icon="mic-outline" label="Giọng nói" color={Colors.primaryBlue} onPress={() => router.push('/voice')} />
          <QuickAction icon="person-circle-outline" label="Khuôn mặt" color={Colors.warningOrange} onPress={() => router.push('/face')} />
        </View>

        <Text style={styles.sectionLabel}>Nhật ký gần đây</Text>
        <View style={styles.logWrap}>
          {recentLogs.map((log, index) => {
            const colors = statusColors(log.status);
            return (
              <View key={`${log.time}-${log.desc}`} style={[styles.logRow, index > 0 && styles.topBorder]}>
                <View style={[styles.logDot, { backgroundColor: colors.text }]} />
                <Text style={styles.logTime}>{log.time}</Text>
                <Text style={styles.logDesc}>{log.desc}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.cardBorder,
  },
  appTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  appSub: { fontSize: 13, color: Colors.mutedText, marginTop: 2 },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  onlineOk: { backgroundColor: Colors.softGreen, borderColor: Colors.borderSuccess },
  onlineWarn: { backgroundColor: Colors.softYellow, borderColor: Colors.borderWarning },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 32 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.softRed,
    borderWidth: 0.5,
    borderColor: Colors.borderDanger,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.dangerRed },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.softYellow,
    borderWidth: 0.5,
    borderColor: Colors.borderWarning,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: { flex: 1, color: Colors.warningOrange, fontSize: 12, lineHeight: 18 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  sensorCard: { width: '47.5%', borderRadius: 16, padding: 14, borderWidth: 0.5 },
  sensorLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  sensorValue: { fontSize: 23, fontWeight: '800' },
  sensorUnit: { fontSize: 13, fontWeight: '500' },
  deviceCard: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginBottom: 20,
  },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  topBorder: { borderTopWidth: 0.5, borderTopColor: Colors.cardBorder },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontSize: 11, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickButton: { flex: 1, alignItems: 'center', gap: 7 },
  quickIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  logWrap: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logTime: { width: 42, fontSize: 12, color: Colors.mutedText, fontVariant: ['tabular-nums'] },
  logDesc: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
});
