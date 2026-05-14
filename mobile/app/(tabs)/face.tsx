import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors } from '../../constants/Colors';
import {
  FACE_RECOGNITION_THRESHOLD,
  deleteFaceLabel,
  getFaceLabels,
  getFaceLogs,
  recognizeFace,
  registerFace,
  retrainFace,
  type FaceLabel,
  type FaceLogEntry,
  type FaceResult,
} from '../../services/api';

type Mode = 'recognize' | 'register';

function dataUrl(base64: string) {
  return base64.startsWith('data:') ? base64 : `data:image/jpg;base64,${base64}`;
}

async function normalizeImageForFaceAI(uri: string) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 900 } }],
    {
      base64: true,
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.base64 ?? null;
}

function formatPercent(value?: number) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function isNoFace(result: FaceResult) {
  const message = result.message?.toLowerCase() ?? '';
  return message.includes('không phát hiện') || message.includes('no face');
}

function logTime(entry: FaceLogEntry) {
  if (entry.time) return entry.time;
  const raw = entry.timestamp;
  if (!raw) return '--:--';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(11, 16) || '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function FaceScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('recognize');
  const [username, setUsername] = useState('owner');
  const [loading, setLoading] = useState(false);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FaceResult | null>(null);
  const [logs, setLogs] = useState<FaceLogEntry[]>([]);
  const [faces, setFaces] = useState<FaceLabel[]>([]);
  const [adminPin, setAdminPin] = useState('');
  const [deletingLabel, setDeletingLabel] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    const items = await getFaceLogs();
    setLogs(items.slice(0, 10));
  }, []);

  const loadFaces = useCallback(async () => {
    try {
      const result = await getFaceLabels();
      setFaces(Array.isArray(result.faces) ? result.faces : []);
    } catch {
      setFaces([]);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadFaces();
  }, [loadFaces, loadLogs]);

  async function ensureCameraPermission() {
    if (permission?.granted) return true;
    const result = await requestPermission();
    return result.granted;
  }

  async function capture() {
    setMessage(null);
    setLastResult(null);
    const ok = await ensureCameraPermission();
    if (!ok) {
      setMessage('Ứng dụng cần quyền camera để chụp khuôn mặt.');
      return;
    }

    const photo = await cameraRef.current?.takePictureAsync({
      base64: true,
      quality: 0.72,
      skipProcessing: true,
    });

    if (!photo?.uri) {
      setMessage('Không chụp được ảnh. Thử lại sau vài giây.');
      return;
    }

    if (photo.base64) {
      setImageBase64(photo.base64);
      return;
    }

    const normalized = await normalizeImageForFaceAI(photo.uri);
    if (!normalized) {
      setMessage('Không xử lý được ảnh vừa chụp. Thử lại sau vài giây.');
      return;
    }
    setImageBase64(normalized);
  }

  async function pickImage() {
    setMessage(null);
    setLastResult(null);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setMessage('Ứng dụng cần quyền thư viện ảnh để chọn ảnh khuôn mặt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.72,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      if (result.assets[0].base64) {
        setImageBase64(result.assets[0].base64);
        return;
      }

      if (!result.assets[0].uri) return;
      const normalized = await normalizeImageForFaceAI(result.assets[0].uri);
      if (!normalized) {
        setMessage('Không xử lý được ảnh đã chọn. Hãy thử ảnh JPEG rõ mặt hơn.');
        return;
      }
      setImageBase64(normalized);
    }
  }

  async function handleRecognize() {
    if (!imageBase64) {
      setMessage('Hãy chụp hoặc chọn ảnh trước khi nhận diện.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await recognizeFace(dataUrl(imageBase64));
      setLastResult(result);
      if (isNoFace(result)) {
        setMessage('Không phát hiện khuôn mặt.');
      } else if (!result.recognized || result.confidence < FACE_RECOGNITION_THRESHOLD) {
        setMessage(`Người lạ · chưa đủ điều kiện mở cửa · độ tin cậy ${formatPercent(result.confidence)}.`);
      }
      await loadFaces();
      await loadLogs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không gọi được API nhận diện.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const cleanName = username.trim();
    if (!cleanName) {
      setMessage('Nhập tên user trước khi đăng ký.');
      return;
    }
    if (!imageBase64) {
      setMessage('Hãy chụp hoặc chọn ảnh mẫu trước khi đăng ký.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await registerFace(cleanName, dataUrl(imageBase64));
      setMessage(result.retrained
        ? `Đã đăng ký ${result.label} và retrain FaceAI.`
        : `Đã lưu mẫu ${result.label}. Có thể bấm Retrain nếu cần.`
      );
      await loadFaces();
      await loadLogs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không đăng ký được khuôn mặt.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetrain() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await retrainFace();
      setMessage(result.message ?? 'Đã retrain FaceAI.');
      await loadLogs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không retrain được FaceAI.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshLogs() {
    setRefreshingLogs(true);
    await loadLogs();
    await loadFaces();
    setRefreshingLogs(false);
  }

  async function handleDeleteFace(label: string) {
    if (!adminPin.trim()) {
      setMessage('Nhập PIN quản trị FaceAI trước khi xóa khuôn mặt.');
      return;
    }

    setDeletingLabel(label);
    setMessage(null);
    try {
      const result = await deleteFaceLabel(label, adminPin.trim());
      setMessage(
        result.model_removed
          ? `Đã xóa ${label}. Không còn khuôn mặt nào, model FaceAI đã được gỡ.`
          : `Đã xóa ${label} và retrain FaceAI.`
      );
      setAdminPin('');
      await loadFaces();
      await loadLogs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không xóa được khuôn mặt.');
    } finally {
      setDeletingLabel(null);
    }
  }

  const recognized = Boolean(lastResult?.recognized && lastResult.confidence >= FACE_RECOGNITION_THRESHOLD);
  const resultTitle = !lastResult
    ? null
    : isNoFace(lastResult)
      ? 'Không phát hiện khuôn mặt'
      : recognized
        ? lastResult.label ?? 'Người quen'
        : 'Người lạ';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <Text style={styles.title}>FaceAI</Text>
        <View style={[styles.cameraBadge, permission?.granted ? styles.cameraOk : styles.cameraWarn]}>
          <View style={[styles.dot, { backgroundColor: permission?.granted ? Colors.successGreen : Colors.warningOrange }]} />
          <Text style={[styles.cameraBadgeText, { color: permission?.granted ? Colors.successGreen : Colors.warningOrange }]}>
            {permission?.granted ? 'Camera OK' : 'Cần quyền camera'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshingLogs} onRefresh={refreshLogs} />}
      >
        {message ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={17} color={Colors.primaryBlue} />
            <Text style={styles.noticeText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.cameraBox}>
          {imageBase64 ? (
            <Image source={{ uri: dataUrl(imageBase64) }} style={styles.preview} />
          ) : permission?.granted ? (
            <CameraView ref={cameraRef} style={styles.preview} facing="front" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={44} color={Colors.mutedText} />
              <Text style={styles.placeholderText}>Cấp quyền camera rồi chụp ảnh khuôn mặt</Text>
            </View>
          )}
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => setImageBase64(null)}>
            <Ionicons name="refresh-outline" size={18} color={Colors.primaryBlue} />
            <Text style={styles.secondaryText}>Chụp lại</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={pickImage}>
            <Ionicons name="image-outline" size={18} color={Colors.primaryBlue} />
            <Text style={styles.secondaryText}>Chọn ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8} onPress={capture}>
            <Ionicons name="camera" size={18} color={Colors.white} />
            <Text style={styles.primaryText}>Chụp ảnh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentItem, mode === 'recognize' && styles.segmentActive]}
            onPress={() => setMode('recognize')}
          >
            <Text style={[styles.segmentText, mode === 'recognize' && styles.segmentTextActive]}>Nhận diện</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, mode === 'register' && styles.segmentActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Đăng ký</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' ? (
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Tên user</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="owner"
              style={styles.input}
            />
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.disabled]}
          activeOpacity={0.8}
          onPress={mode === 'recognize' ? handleRecognize : handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name={mode === 'recognize' ? 'scan' : 'person-add'} size={18} color={Colors.white} />
              <Text style={styles.submitText}>{mode === 'recognize' ? 'Nhận diện thử' : 'Lưu mẫu khuôn mặt'}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.retrainBtn, loading && styles.disabled]}
          activeOpacity={0.8}
          onPress={handleRetrain}
          disabled={loading}
        >
          <Ionicons name="sync-outline" size={18} color={Colors.primaryBlue} />
          <Text style={styles.retrainText}>Retrain FaceAI</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Khuôn mặt đã đăng ký</Text>
        <View style={styles.faceListCard}>
          {faces.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có khuôn mặt đã đăng ký.</Text>
          ) : (
            <>
              <TextInput
                value={adminPin}
                onChangeText={text => setAdminPin(text.replace(/\D/g, '').slice(0, 12))}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="PIN quản trị FaceAI"
                style={styles.adminPinInput}
              />
              {faces.map((face, index) => {
                const ready = face.ready;
                const need = Math.max(0, (face.min_samples ?? 3) - (face.samples ?? 0));
                return (
                  <View key={`${face.label}-${index}`} style={[styles.faceRow, index > 0 && styles.topBorder]}>
                    <View style={styles.faceAvatar}>
                      <Text style={styles.faceAvatarText}>{face.label.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.faceInfo}>
                      <Text style={styles.faceName}>{face.label}</Text>
                      <Text style={styles.faceMeta}>
                        {face.samples} mẫu · {ready ? 'Sẵn sàng' : `Cần thêm ${need} mẫu`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteFaceBtn, deletingLabel === face.label && styles.disabled]}
                      activeOpacity={0.8}
                      disabled={deletingLabel === face.label}
                      onPress={() => handleDeleteFace(face.label)}
                    >
                      {deletingLabel === face.label ? (
                        <ActivityIndicator size="small" color={Colors.dangerRed} />
                      ) : (
                        <Ionicons name="trash-outline" size={17} color={Colors.dangerRed} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {lastResult ? (
          <View style={[styles.resultCard, recognized ? styles.resultOk : styles.resultBad]}>
            <Ionicons
              name={recognized ? 'lock-open' : 'lock-closed'}
              size={24}
              color={recognized ? Colors.successGreen : Colors.dangerRed}
            />
            <View style={styles.resultBody}>
              <Text style={[styles.resultTitle, { color: recognized ? Colors.successGreen : Colors.dangerRed }]}>
                {recognized ? 'Đã nhận diện và mở cửa' : 'Không mở cửa'}
              </Text>
              <Text style={styles.resultSub}>
                {resultTitle} · {formatPercent(lastResult.confidence)} · {lastResult.message}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Log FaceAI gần đây</Text>
        <View style={styles.logWrap}>
          {logs.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có log FaceAI từ backend.</Text>
          ) : logs.map((entry, index) => {
            const open = entry.result === 'OPEN' || entry.action === 'UNLOCK';
            const name = entry.face ?? entry.label ?? 'unknown';
            const note = entry.note ?? entry.message ?? entry.action ?? entry.result ?? '';
            return (
              <View key={`${logTime(entry)}-${entry.face ?? entry.label ?? 'unknown'}-${entry.note ?? entry.message ?? ''}-${index}`} style={[styles.logRow, index > 0 && styles.topBorder]}>
                <Text style={styles.logTime}>{logTime(entry)}</Text>
                <View style={styles.logBody}>
                  <Text style={styles.logName}>{name}</Text>
                  <Text style={styles.logNote}>{note}</Text>
                </View>
                <Text style={[styles.logConfidence, { color: open ? Colors.successGreen : Colors.warningOrange }]}>
                  {formatPercent((entry.confidence ?? 0) / ((entry.confidence ?? 0) > 1 ? 100 : 1))}
                </Text>
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
  cameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cameraOk: { backgroundColor: Colors.softGreen, borderColor: Colors.borderSuccess },
  cameraWarn: { backgroundColor: Colors.softYellow, borderColor: Colors.borderWarning },
  cameraBadgeText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  content: { padding: 20, paddingBottom: 36 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.softBlue,
    borderColor: Colors.borderInfo,
    borderWidth: 0.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { flex: 1, color: Colors.primaryBlue, fontSize: 13, lineHeight: 19 },
  cameraBox: {
    aspectRatio: 3 / 4,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111827',
    marginBottom: 14,
    position: 'relative',
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholderText: { color: Colors.mutedText, fontSize: 13, marginTop: 10, textAlign: 'center' },
  scanFrame: {
    position: 'absolute',
    width: 190,
    height: 240,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: '#64c8ff',
    top: '50%',
    left: '50%',
    marginLeft: -95,
    marginTop: -130,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.primaryBlue,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  primaryText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    borderColor: Colors.borderInfo,
    borderWidth: 0.5,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryText: { color: Colors.primaryBlue, fontSize: 13, fontWeight: '800' },
  segment: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderRadius: 14, padding: 4, marginBottom: 14 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.bgPrimary, borderWidth: 0.5, borderColor: Colors.cardBorder },
  segmentText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  segmentTextActive: { color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: Colors.textPrimary,
  },
  submitBtn: {
    backgroundColor: Colors.primaryBlue,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  submitText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  retrainBtn: {
    borderWidth: 0.5,
    borderColor: Colors.borderInfo,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  retrainText: { color: Colors.primaryBlue, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  resultCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  resultOk: { backgroundColor: Colors.softGreen, borderColor: Colors.borderSuccess },
  resultBad: { backgroundColor: Colors.softRed, borderColor: Colors.borderDanger },
  resultBody: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '800' },
  resultSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  logWrap: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
  },
  faceListCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    marginBottom: 20,
  },
  adminPinInput: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  faceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.softBlue,
  },
  faceAvatarText: { color: Colors.primaryBlue, fontSize: 13, fontWeight: '800' },
  faceInfo: { flex: 1 },
  faceName: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  faceMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  deleteFaceBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.softRed,
    borderWidth: 0.5,
    borderColor: Colors.borderDanger,
  },
  emptyText: { paddingVertical: 14, color: Colors.mutedText, fontSize: 13, textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  topBorder: { borderTopWidth: 0.5, borderTopColor: Colors.cardBorder },
  logTime: { width: 42, fontSize: 12, color: Colors.mutedText, fontVariant: ['tabular-nums'] },
  logBody: { flex: 1 },
  logName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  logNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  logConfidence: { width: 44, textAlign: 'right', fontSize: 12, fontWeight: '800' },
});
