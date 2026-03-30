import {
  Alert, Animated, Image, Keyboard, Modal, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../lib/supabase";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  subtitle,
  onPress,
  danger,
  isLast,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
}) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
          <Feather name={icon} size={17} color={danger ? "#E03E3E" : colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Settings section ─────────────────────────────────────────────────────────

function SettingsSection({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

// ─── Stat box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Adventurer";
  const username    = user?.user_metadata?.username ?? user?.email?.split("@")[0] ?? "";
  const initial     = displayName[0]?.toUpperCase() ?? "A";

  const [avatarError, setAvatarError] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [editUsername, setEditUsername] = useState(username);

  // Keyboard animation for edit modal
  const kbOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      e => Animated.timing(kbOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === "ios" ? (e.duration ?? 250) : 200,
        useNativeDriver: false,
      }).start(),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => Animated.timing(kbOffset, { toValue: 0, duration: 200, useNativeDriver: false }).start(),
    );
    return () => { show.remove(); hide.remove(); };
  }, [kbOffset]);
  useEffect(() => { if (!editVisible) kbOffset.setValue(0); }, [editVisible, kbOffset]);

  function openMenu() {
    Alert.alert("", "", [
      { text: "Edit Profile", onPress: () => setEditVisible(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleSaveProfile() {
    await supabase.auth.updateUser({
      data: { display_name: editName, username: editUsername },
    });
    setEditVisible(false);
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="more-horizontal" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileLeft}>
          {!avatarError ? (
            <Image
              source={{ uri: `https://picsum.photos/seed/${user?.id ?? "me"}/80/80` }}
              style={styles.avatar}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{displayName}</Text>
          {username ? <Text style={styles.usernameText}>@{username}</Text> : null}
          <Text style={styles.emailText} numberOfLines={1}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)}>
          <Feather name="edit-2" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox label="Trips" value="0" />
        <StatBox label="km covered" value="0" />
        <StatBox label="Countries" value="0" />
      </View>

      {/* Section 1 */}
      <SettingsSection>
        <SettingsRow icon="users"   label="Friends"       subtitle="Manage your friends"
          onPress={() => router.push("/(app)/profile/friends")} />
        <SettingsRow icon="globe"   label="Language"      subtitle="English"
          onPress={() => router.push("/(app)/profile/language")} />
        <SettingsRow icon="bell"    label="Notifications"
          onPress={() => router.push("/(app)/profile/notifications")} isLast />
      </SettingsSection>

      {/* Section 2 */}
      <SettingsSection>
        <SettingsRow icon="phone"       label="Contact Us"
          onPress={() => router.push({ pathname: "/(app)/profile/info", params: { slug: "contact" } })} />
        <SettingsRow icon="help-circle" label="Get Help"
          onPress={() => router.push({ pathname: "/(app)/profile/info", params: { slug: "help" } })} />
        <SettingsRow icon="shield"      label="Privacy Policy"
          onPress={() => router.push({ pathname: "/(app)/profile/info", params: { slug: "privacy" } })} />
        <SettingsRow icon="file-text"   label="Terms & Conditions"
          onPress={() => router.push({ pathname: "/(app)/profile/info", params: { slug: "terms" } })} />
        <SettingsRow icon="log-out"     label="Log out"    danger isLast
          onPress={() => supabase.auth.signOut()} />
      </SettingsSection>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <Animated.View style={{ marginBottom: kbOffset }}>
            <View style={styles.editSheet}>
              <View style={styles.editHandle} />
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)}>
                  <Feather name="x" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.editLabel}>Display Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.subtle}
              />
              <Text style={styles.editLabel}>Username</Text>
              <TextInput
                style={styles.editInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="username"
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 100 },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.text },

  // Profile card
  profileCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    ...shadow.sm,
  },
  profileLeft:   { marginRight: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: fontSize.xl, color: colors.inverse, fontWeight: "700" },
  profileInfo:   { flex: 1 },
  displayName:   { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  usernameText:  { fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  emailText:     { fontSize: fontSize.xs, color: colors.subtle, marginTop: 1 },
  editBtn: { padding: 6 },

  // Stats
  statsRow: {
    flexDirection: "row", marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.card, ...shadow.sm,
  },
  statBox: {
    flex: 1, alignItems: "center", paddingVertical: spacing.md,
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },

  // Settings section
  section: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg, overflow: "hidden", ...shadow.sm,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.md,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentLight ?? "#E8F2EC",
    alignItems: "center", justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "#FEECEC" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  rowLabelDanger: { color: "#E03E3E" },
  rowSub: { fontSize: fontSize.xs, color: colors.muted, marginTop: 1 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 52 + spacing.md },

  // Edit modal
  editSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  editHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md,
  },
  editHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.lg,
  },
  editTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  editLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted, marginBottom: spacing.xs },
  editInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSize.base, color: colors.text,
    marginBottom: spacing.md, backgroundColor: colors.bg,
  },
  saveBtn: {
    backgroundColor: colors.text, borderRadius: radius.full,
    paddingVertical: 14, alignItems: "center", marginTop: spacing.sm,
  },
  saveBtnText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
});
