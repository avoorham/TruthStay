import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../lib/supabase";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const user = session?.user;

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Adventurer";
  const username = user?.user_metadata?.username ?? user?.email?.split("@")[0] ?? "";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          onPress={() => supabase.auth.signOut()}
          style={styles.signOutBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar + info */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {username && <Text style={styles.username}>@{username}</Text>}
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox label="Trips" value="0" />
        <StatBox label="km covered" value="0" />
        <StatBox label="Countries" value="0" />
      </View>

      {/* Placeholder sections */}
      <SectionHeader title="Activity" />
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Your completed adventures will appear here.</Text>
      </View>

      <SectionHeader title="Preferences" />
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Sport preferences learned from your selections in Discover.</Text>
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text },
  signOutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  signOutText: { fontSize: fontSize.sm, color: colors.muted },
  profileCard: {
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.xs,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: fontSize.xxl, color: colors.inverse, fontWeight: "700" },
  displayName: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  username: { fontSize: fontSize.base, color: colors.muted },
  email: { fontSize: fontSize.sm, color: colors.subtle },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  emptyBox: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 20 },
});
