import { useEffect, useRef } from 'react';
import { Animated, ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { mockAlertHistory, mockSensorData, statusColors } from '../../constants/mockData';

function BlinkDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.blinkDot, { opacity }]} />;
}

export default function AlertsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <Text style={styles.title}>Cảnh báo</Text>
        <BlinkDot />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Trạng thái cảm biến</Text>
        <View style={styles.sensorGrid}>
          {mockSensorData.map(sensor => {
            const colors = statusColors(sensor.status);
            return (
              <View key={sensor.label} style={[styles.sensorCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Text style={[styles.sensorLabel, { color: colors.text }]}>{sensor.label}</Text>
                <Text style={[styles.sensorValue, { color: colors.text }]}>
                  {sensor.value}
                  {sensor.unit ? <Text style={styles.sensorUnit}> {sensor.unit}</Text> : null}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Cảnh báo người lạ</Text>
        <View style={styles.strangerCard}>
          <View style={styles.strangerIcon}>
            <Ionicons name="person-remove-outline" size={20} color={Colors.warningOrange} />
          </View>
          <View style={styles.strangerBody}>
            <Text style={styles.strangerTitle}>Phát hiện người lạ tại cửa</Text>
            <Text style={styles.strangerDesc}>Nhận diện khuôn mặt thất bại · 34% — dưới ngưỡng 90%</Text>
            <Text style={styles.strangerMeta}>14:10:33 · Buzzer + LED đỏ kích hoạt</Text>
          </View>
          <View style={styles.cameraIcon}>
            <Ionicons name="camera-outline" size={18} color={Colors.mutedText} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Lịch sử cảnh báo hôm nay</Text>
        <View style={styles.logWrap}>
          {mockAlertHistory.map((log, index) => {
            const colors = statusColors(log.status);
            return (
              <View key={`${log.time}-${log.desc}`} style={[styles.logRow, index > 0 && styles.topBorder]}>
                <View style={[styles.logDot, { backgroundColor: colors.text }]} />
                <Text style={styles.logTime}>{log.time}</Text>
                <Text style={styles.logDesc}>{log.desc}</Text>
                <View style={[styles.logBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.logBadgeText, { color: colors.text }]}>{log.badge}</Text>
                </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.cardBorder,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  blinkDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.dangerRed },
  content: { padding: 20, paddingBottom: 32 },
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
  sensorValue: { fontSize: 22, fontWeight: '800' },
  sensorUnit: { fontSize: 13, fontWeight: '500' },
  strangerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.softYellow,
    borderWidth: 0.5,
    borderColor: Colors.borderWarning,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  strangerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(217,119,6,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strangerBody: { flex: 1 },
  strangerTitle: { fontSize: 14, fontWeight: '800', color: Colors.warningOrange },
  strangerDesc: { fontSize: 12, color: Colors.warningOrange, lineHeight: 18, marginTop: 4 },
  strangerMeta: { fontSize: 11, color: Colors.warningOrange, opacity: 0.75, marginTop: 4 },
  cameraIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: Colors.borderWarning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logWrap: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  topBorder: { borderTopWidth: 0.5, borderTopColor: Colors.cardBorder },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logTime: { width: 42, fontSize: 12, color: Colors.mutedText, fontVariant: ['tabular-nums'] },
  logDesc: { flex: 1, fontSize: 12, color: Colors.textPrimary, lineHeight: 18 },
  logBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  logBadgeText: { fontSize: 10, fontWeight: '800' },
});
