import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

const LANGUAGES = ["English", "Français", "Español", "Deutsch", "Italiano", "Nederlands"];

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState("English");

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
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
        <Text style={styles.backTitle}>Language</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Language list */}
      <View style={styles.section}>
        {LANGUAGES.map((lang, i) => {
          const active = lang === selected;
          return (
            <View key={lang}>
              <TouchableOpacity
                style={styles.langRow}
                onPress={() => setSelected(lang)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, active && styles.langTextActive]}>
                  {lang}
                </Text>
                {active && <Feather name="check" size={18} color={colors.accent} />}
              </TouchableOpacity>
              {i < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
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

  section: {
    margin: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg, overflow: "hidden", ...shadow.sm,
  },
  langRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md + 2,
  },
  langText:       { fontSize: fontSize.base, color: colors.muted },
  langTextActive: { fontWeight: "700", color: colors.text },
  divider:        { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
});
