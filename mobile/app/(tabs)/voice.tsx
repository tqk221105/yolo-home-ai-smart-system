import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

export default function VoiceScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <Text style={styles.title}>Giọng nói</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="mic-off-outline" size={40} color={Colors.mutedText} />
          </View>
          <Text style={styles.cardTitle}>Giọng nói</Text>
          <Text style={styles.cardText}>
            Tính năng giọng nói chỉ là mockup và sẽ được loại bỏ sau.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  appBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.cardBorder,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { padding: 20, paddingBottom: 32 },
  card: {
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 34,
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  cardText: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center' },
});
