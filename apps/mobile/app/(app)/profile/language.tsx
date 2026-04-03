import {
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back header */}
      <View style={styles.backHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Language</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <Feather name="globe" size={32} color={colors.accent} style={styles.icon} />
        <Text style={styles.current}>English</Text>
        <Text style={styles.note}>More languages coming soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  backHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:   { width: 32 },
  backTitle: { flex: 1, textAlign: "center", fontSize: fontSize.lg, fontWeight: "700", color: colors.text },

  card: {
    margin: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: "center", gap: spacing.sm,
    ...shadow.sm,
  },
  icon:    { marginBottom: spacing.xs },
  current: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  note:    { fontSize: fontSize.sm, color: colors.muted },
});
