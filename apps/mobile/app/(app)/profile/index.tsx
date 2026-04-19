import {
  Alert, Animated, Image, Keyboard, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../../lib/auth-context";
import { supabase } from "../../../lib/supabase";
import { pickImage, uploadAvatar } from "../../../lib/storage";
import { colors, fontSize, radius, spacing, shadow, ACTIVITY_EMOJI } from "../../../lib/theme";
import { getProfileStats, getBookmarkedAdventures, type BookmarkedAdventure } from "../../../lib/api";

const ACTIVITY_OPTIONS = [
  "cycling", "hiking", "trail_running", "climbing", "skiing", "kayaking", "other",
];

const ACTIVITY_LABELS: Record<string, string> = {
  cycling: "Cycling",
  hiking: "Hiking",
  trail_running: "Trail Running",
  climbing: "Climbing",
  skiing: "Skiing",
  kayaking: "Kayaking",
  other: "Other",
};

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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.user_metadata?.avatar_url ?? null,
  );
  const [avatarError, setAvatarError]   = useState(false);
  const [editVisible, setEditVisible]   = useState(false);
  const [stats, setStats]               = useState({ trips: 0, posts: 0, followers: 0, following: 0 });
  const [bookmarks, setBookmarks]       = useState<BookmarkedAdventure[]>([]);

  useEffect(() => {
    getProfileStats().then(setStats).catch(() => {/* non-fatal */});
    getBookmarkedAdventures().then(setBookmarks).catch(() => {/* non-fatal */});
  }, []);

  const [editName,       setEditName]       = useState(displayName);
  const [editLocation,   setEditLocation]   = useState<string>(user?.user_metadata?.location ?? "");
  const [editActivities, setEditActivities] = useState<string[]>(user?.user_metadata?.favorite_activities ?? []);
  const [uploading, setUploading] = useState(false);

  function toggleActivity(act: string) {
    setEditActivities(prev =>
      prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act],
    );
  }

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

  async function handleSaveProfile() {
    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: editName,
        location: editLocation,
        favorite_activities: editActivities,
      },
    });
    if (error) { Alert.alert("Update failed", error.message); return; }
    setEditVisible(false);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => supabase.auth.signOut(),
        },
      ],
    );
  }

  async function handleChangePhoto() {
    const uri = await pickImage([1, 1]);
    if (!uri || !user?.id) return;
    setUploading(true);
    const url = await uploadAvatar(user.id, uri);
    setUploading(false);
    if (!url) { Alert.alert("Upload failed", "Please try again."); return; }
    const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: url } });
    if (updateError) { Alert.alert("Profile update failed", updateError.message); return; }
    setAvatarUrl(url);
    setAvatarError(false);
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
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileLeft}>
          {!avatarError ? (
            <Image
              source={{ uri: avatarUrl ?? `https://picsum.photos/seed/${user?.id ?? "me"}/80/80` }}
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
          <TouchableOpacity onPress={() => setEditVisible(true)} activeOpacity={0.7}>
            <Text style={styles.displayName}>{displayName}</Text>
          </TouchableOpacity>
          {username ? <Text style={styles.usernameText}>@{username}</Text> : null}
          <Text style={styles.emailText} numberOfLines={1}>{user?.email}</Text>
          {user?.user_metadata?.location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color={colors.muted} />
              <Text style={styles.locationText}>{user.user_metadata.location}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)}>
          <Feather name="edit-2" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox label="Trips"     value={String(stats.trips)} />
        <StatBox label="Followers" value={String(stats.followers)} />
        <StatBox label="Following" value={String(stats.following)} />
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

      {/* Saved Adventures */}
      {bookmarks.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.savedTitle}>Saved Adventures</Text>
          {bookmarks.map(adv => (
            <TouchableOpacity
              key={adv.id}
              style={styles.savedCard}
              onPress={() => router.push(`/(app)/trips/${adv.id}` as never)}
              activeOpacity={0.75}
            >
              {adv.coverImageUrl ? (
                <Image source={{ uri: adv.coverImageUrl }} style={styles.savedThumb} />
              ) : (
                <View style={[styles.savedThumb, styles.savedThumbPlaceholder]}>
                  <Text style={{ fontSize: 22 }}>{ACTIVITY_EMOJI[adv.activityType] ?? "🏔️"}</Text>
                </View>
              )}
              <View style={styles.savedInfo}>
                <Text style={styles.savedName} numberOfLines={1}>{adv.title}</Text>
                <Text style={styles.savedMeta}>{adv.region} · {adv.durationDays}d</Text>
                {adv.level ? (
                  <Text style={styles.savedLevel}>{adv.level}</Text>
                ) : null}
              </View>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

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

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Avatar picker */}
              <TouchableOpacity style={styles.avatarPickerWrap} onPress={handleChangePhoto} activeOpacity={0.8} disabled={uploading}>
                {!avatarError ? (
                  <Image
                    source={{ uri: avatarUrl ?? `https://picsum.photos/seed/${user?.id ?? "me"}/80/80` }}
                    style={styles.editAvatar}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <View style={[styles.editAvatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                )}
                <View style={styles.cameraOverlay}>
                  <Feather name={uploading ? "loader" : "camera"} size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* Display Name — editable */}
              <Text style={styles.editLabel}>Display Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.subtle}
              />

              {/* Home location — editable */}
              <Text style={styles.editLabel}>Home Location</Text>
              <TextInput
                style={styles.editInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="e.g. Barcelona, Spain"
                placeholderTextColor={colors.subtle}
              />

              {/* Favorite activities */}
              <Text style={styles.editLabel}>Favorite Activities</Text>
              <View style={styles.editActivitiesRow}>
                {ACTIVITY_OPTIONS.map(act => {
                  const selected = editActivities.includes(act);
                  return (
                    <TouchableOpacity
                      key={act}
                      style={[styles.activityChip, selected && styles.activityChipSelected]}
                      onPress={() => toggleActivity(act)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.activityChipText, selected && styles.activityChipTextSelected]}>
                        {ACTIVITY_EMOJI[act] ?? "🏔️"} {ACTIVITY_LABELS[act] ?? act}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Username — locked */}
              <Text style={styles.editLabel}>Username</Text>
              <View style={[styles.editInput, styles.editInputLocked]}>
                <Text style={styles.editInputLockedText}>@{username}</Text>
                <Feather name="lock" size={14} color={colors.subtle} />
              </View>

              {/* Email — locked */}
              <Text style={styles.editLabel}>Email</Text>
              <View style={[styles.editInput, styles.editInputLocked]}>
                <Text style={styles.editInputLockedText} numberOfLines={1}>{user?.email}</Text>
                <Feather name="lock" size={14} color={colors.subtle} />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>

              {/* Delete account */}
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
                <Feather name="trash-2" size={14} color="#E03E3E" />
                <Text style={styles.deleteBtnText}>Delete Account</Text>
              </TouchableOpacity>
              </ScrollView>
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
    padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: "85%",
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

  // Avatar picker
  avatarPickerWrap: { alignSelf: "center", marginBottom: spacing.lg },
  editAvatar: { width: 80, height: 80, borderRadius: 40 },
  cameraOverlay: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.card,
  },

  // Location row in profile card
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  locationText: { fontSize: fontSize.xs, color: colors.muted },

  // Edit modal — activity selector
  editActivitiesRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  activityChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  activityChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentLight ?? "#E8F2EC" },
  activityChipText: { fontSize: fontSize.xs, color: colors.muted, fontWeight: "500" },
  activityChipTextSelected: { color: colors.accent, fontWeight: "700" },

  // Activity chips
  chipsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.xs,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.card, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },

  // Locked fields
  editInputLocked: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.bg, opacity: 0.6,
  },
  editInputLockedText: { fontSize: fontSize.base, color: colors.muted, flex: 1 },

  // Saved adventures section
  savedSection: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
  },
  savedTitle: {
    fontSize: fontSize.base, fontWeight: "700", color: colors.text,
    marginBottom: spacing.sm,
  },
  savedCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.sm, marginBottom: spacing.sm, ...shadow.sm,
  },
  savedThumb: { width: 52, height: 52, borderRadius: radius.md },
  savedThumbPlaceholder: {
    backgroundColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  savedInfo: { flex: 1 },
  savedName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  savedMeta: { fontSize: fontSize.xs, color: colors.muted, marginTop: 1 },
  savedLevel: { fontSize: fontSize.xs, color: colors.accent, marginTop: 1, fontWeight: "500" },

  // Delete account
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.xs, marginTop: spacing.md, paddingVertical: spacing.sm,
  },
  deleteBtnText: { fontSize: fontSize.sm, color: "#E03E3E", fontWeight: "600" },
});
