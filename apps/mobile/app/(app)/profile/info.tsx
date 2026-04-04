import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

const CONTENT: Record<string, { title: string; body: string }> = {
  contact: {
    title: "Contact Us",
    body: "Questions or feedback? We'd love to hear from you.\n\nEmail us at hello@truth-stay.com\n\nWe aim to respond within 24 hours on weekdays.",
  },
  help: {
    title: "Get Help",
    body: "Common topics:\n\n• Setting up your profile\n• Creating your first trip\n• Inviting friends to a trip\n• Managing notifications\n• Changing your language\n\nFor further support, reach out to hello@truth-stay.com",
  },
  privacy: {
    title: "Privacy Policy",
    body: "Last updated: March 2026\n\nTruthStay is committed to protecting your privacy. We collect only the data necessary to provide the service — your account details, trip data, and usage patterns.\n\nWe do not sell your personal data to third parties. Data is stored securely and you can request deletion at any time by contacting us.",
  },
  terms: {
    title: "Terms & Conditions",
    body: "Last updated: March 2026\n\nBy using TruthStay you agree to:\n\n• Use the service for lawful purposes only\n• Respect other users and their content\n• Not attempt to reverse-engineer or misuse the platform\n\nWe reserve the right to suspend accounts that violate these terms. For questions, contact hello@truth-stay.com",
  },
};

export default function InfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const page = CONTENT[slug ?? ""] ?? CONTENT.help;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Back header */}
      <View style={styles.backHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.backTitle}>{page.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Content */}
      <View style={styles.card}>
        <Text style={styles.body}>{page.body}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 60 },

  backHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:   { width: 32 },
  backTitle: { flex: 1, textAlign: "center", fontSize: fontSize.lg, fontWeight: "700", color: colors.text },

  card: {
    margin: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm,
  },
  body: { fontSize: fontSize.base, color: colors.text, lineHeight: 24 },
});
