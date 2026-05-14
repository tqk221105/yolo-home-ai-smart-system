import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { getPinStatus, verifyPin, type PinStatus } from '../services/api';

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export default function PinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getPinStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không đọc được trạng thái PIN.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function submitPin() {
    if (pin.trim().length < 4) {
      setMessage('Nhập mã PIN từ 4 chữ số trở lên.');
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);
    try {
      const result = await verifyPin(pin.trim());
      setSuccess(result.success);
      setMessage(result.message);
      setPin('');
      await loadStatus();
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : 'Mã PIN không đúng hoặc backend không phản hồi.');
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  const locked = Boolean(status?.locked);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mở cửa bằng PIN</Text>
        <View style={styles.appBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroIcon}>
          <Ionicons name={locked ? 'lock-closed-outline' : 'keypad-outline'} size={42} color={locked ? Colors.dangerRed : Colors.primaryBlue} />
        </View>

        <Text style={styles.heading}>Nhập mã PIN để mở cửa</Text>
        <Text style={styles.subText}>
          FaceAI vẫn là luồng nhận diện khuôn mặt riêng. Màn này dùng endpoint PIN thật của backend để mở khóa.
        </Text>

        {status ? (
          <View style={[styles.statusCard, locked ? styles.statusDanger : styles.statusNormal]}>
            <Ionicons
              name={locked ? 'timer-outline' : 'shield-checkmark-outline'}
              size={18}
              color={locked ? Colors.dangerRed : Colors.successGreen}
            />
            <Text style={[styles.statusText, { color: locked ? Colors.dangerRed : Colors.successGreen }]}>
              {locked
                ? `Đang khóa tạm thời · còn ${formatRemaining(status.locked_remaining_sec)}`
                : `Sẵn sàng · sai ${status.fail_count}/${status.max_fail} lần`}
            </Text>
          </View>
        ) : null}

        {message ? (
          <View style={[styles.notice, success ? styles.noticeOk : styles.noticeBad]}>
            <Ionicons
              name={success ? 'checkmark-circle-outline' : 'information-circle-outline'}
              size={17}
              color={success ? Colors.successGreen : Colors.warningOrange}
            />
            <Text style={[styles.noticeText, { color: success ? Colors.successGreen : Colors.warningOrange }]}>
              {message}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Mã PIN</Text>
          <TextInput
            value={pin}
            onChangeText={text => setPin(text.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="••••"
            editable={!loading && !locked}
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (loading || locked) && styles.disabled]}
          onPress={submitPin}
          activeOpacity={0.85}
          disabled={loading || locked}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="lock-open-outline" size={18} color={Colors.white} />
              <Text style={styles.submitText}>Xác thực và mở cửa</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.faceButton} onPress={() => router.replace('/face')} activeOpacity={0.85}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.primaryBlue} />
          <Text style={styles.faceText}>Dùng FaceAI thay thế</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  appBarSpacer: { width: 44 },
  content: { padding: 20, paddingBottom: 34 },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.softBlue,
    marginTop: 8,
    marginBottom: 18,
  },
  heading: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subText: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  statusNormal: { backgroundColor: Colors.softGreen, borderColor: Colors.borderSuccess },
  statusDanger: { backgroundColor: Colors.softRed, borderColor: Colors.borderDanger },
  statusText: { flex: 1, fontSize: 13, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 0.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  noticeOk: { backgroundColor: Colors.softGreen, borderColor: Colors.borderSuccess },
  noticeBad: { backgroundColor: Colors.softYellow, borderColor: Colors.borderWarning },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  inputCard: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  inputLabel: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 4,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.primaryBlue,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  submitText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  faceButton: {
    borderWidth: 0.5,
    borderColor: Colors.borderInfo,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  faceText: { color: Colors.primaryBlue, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
