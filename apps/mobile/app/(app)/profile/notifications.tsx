import {
  ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../lib/supabase";

type Toggles = {
  tripUpdates: boolean;
  friendActivity: boolean;
  suggestions: boolean;
  appNews: boolean;
};

const DEFAULTS: Toggles = {
  tripUpdates:    true,
  friendActivity: true,
  suggestions:    true,
  appNews:        false,
};

const ROWS: { key: keyof Toggles; label: string; subtitle: string }[] = [
  { key: "tripUpdates",    label: "Trip updates",    subtitle: "When your trips are modified" },
  { key: "friendActivity", label: "Friend activity", subtitle: "When friends add or join trips" },
  { key: "suggestions",   label: "Suggestions",     subtitle: "Personalised adventure ideas" },
  { key: "appNews",        label: "App news",        subtitle: "New features and announcements" },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();

  const saved = session?.user?.user_metadata?.notificationPrefs as Partial<Toggles> | undefined;
  const [toggles, setToggles] = useState<Toggles>({ ...DEFAULTS, ...saved });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleToggle(key: keyof Toggles, value: boolean) {
    const next = { ...toggles, [key]: value };
    setToggles(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      supabase.auth.updateUser({ data: { notificationPrefs: next } }).catch(() => {/* non-fatal */});
    }, 600);
  }

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
        <Text style={styles.backTitle}>Notifications</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Toggles */}
      <View style={styles.section}>
        {ROWS.map((row, i) => (
          <View key={row.key}>
            <View style={styles.notifRow}>
              <View style={styles.notifText}>
                <Text style={styles.notifLabel}>{row.label}</Text>
                <Text style={styles.notifSub}>{row.subtitle}</Text>
              </View>
              <Switch
                value={toggles[row.key]}
                onValueChange={v => handleToggle(row.key, v)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
            {i < ROWS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
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
  notifRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md,
  },
  notifText: { flex: 1 },
  notifLabel: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  notifSub:   { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },
  divider:    { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
});
