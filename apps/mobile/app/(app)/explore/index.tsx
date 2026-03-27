import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontSize, spacing } from "../../../lib/theme";

// Mapbox requires a development build (expo-dev-client + @rnmapbox/maps).
// This screen shows a placeholder until the dev build is configured.
// Run: pnpm add @rnmapbox/maps && npx expo install expo-dev-client
// Then rebuild: npx expo run:ios

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>Adventure Map</Text>
        <Text style={styles.body}>
          The explore map shows public adventures from the community — cycling routes, hiking trails, climbing crags — as clustered pins you can tap to preview.
        </Text>
        <View style={styles.featureList}>
          {[
            "Activity pins (cycling, hiking, climbing…)",
            "Clusters that expand as you zoom in",
            "Tap a pin → photo carousel + trip summary",
            "Copy any adventure to Discover",
          ].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Requires a development build with Mapbox. Run{" "}
            <Text style={styles.noticeCode}>pnpm add @rnmapbox/maps</Text> then rebuild.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text },
  placeholder: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 64 },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  body: {
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  featureList: { gap: spacing.sm, alignSelf: "stretch" },
  featureRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  featureIcon: { color: colors.accent, fontWeight: "700", fontSize: fontSize.base },
  featureText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  notice: {
    backgroundColor: colors.accentLight,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noticeText: { fontSize: fontSize.sm, color: colors.accent, lineHeight: 20 },
  noticeCode: { fontWeight: "700", fontStyle: "italic" },
});
