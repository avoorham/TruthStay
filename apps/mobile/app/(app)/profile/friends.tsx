import {
  ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, SectionList, Share, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../../../lib/theme";
import { getFollows, followUser, unfollowUser, searchUsers, type FeedAuthor } from "../../../lib/api";

function FriendRow({
  user,
  isFriend,
  onToggle,
}: {
  user: FeedAuthor;
  isFriend: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.friendRow}>
      <Image
        source={{ uri: user.avatar_url ?? `https://picsum.photos/seed/${user.id}/40/40` }}
        style={styles.friendAvatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{user.display_name}</Text>
        <Text style={styles.friendUsername}>@{user.username}</Text>
      </View>
      <TouchableOpacity
        style={[styles.friendBtn, isFriend ? styles.friendBtnRemove : styles.friendBtnAdd]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.friendBtnText, isFriend ? styles.friendBtnTextRemove : styles.friendBtnTextAdd]}>
          {isFriend ? "Remove" : "Add"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={[styles.friendRow, { opacity: 0.4 }]}>
      <View style={[styles.friendAvatar, { backgroundColor: colors.border }]} />
      <View style={styles.friendInfo}>
        <View style={{ height: 12, width: 100, backgroundColor: colors.border, borderRadius: 6, marginBottom: 6 }} />
        <View style={{ height: 10, width: 70, backgroundColor: colors.border, borderRadius: 6 }} />
      </View>
    </View>
  );
}

function InviteModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");

  function handleClose() {
    setInviteEmail("");
    onClose();
  }

  async function handleShareLink() {
    try {
      await Share.share({
        message:
          "Join me on TruthStay — holiday planning based on real recommendations from friends and fellow travellers. Download the app: https://truthstay.com",
      });
    } catch { /* user cancelled */ }
  }

  async function handleEmailInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    const subject = encodeURIComponent("Join me on TruthStay");
    const body = encodeURIComponent(
      "Hey! I've been using TruthStay to plan holidays based on real recommendations from friends and travellers. Come join me: https://truthstay.com",
    );
    try {
      await Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
      handleClose();
    } catch {
      Alert.alert("Could not open mail app", "Please check that a mail app is configured on your device.");
    }
  }

  const emailValid = inviteEmail.trim().includes("@");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.sheetBackdrop} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetKAV}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>Invite a Friend</Text>
          <Text style={styles.sheetSubtitle}>Grow your circle of trusted travellers</Text>

          {/* Share link */}
          <TouchableOpacity style={styles.optionRow} onPress={handleShareLink} activeOpacity={0.75}>
            <View style={styles.optionIconWrap}>
              <Feather name="share-2" size={18} color={colors.accent} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionLabel}>Share referral link</Text>
              <Text style={styles.optionSub}>Send via WhatsApp, iMessage, or any app</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Email invite */}
          <View style={styles.optionRow}>
            <View style={styles.optionIconWrap}>
              <Feather name="mail" size={18} color={colors.accent} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionLabel}>Invite by email</Text>
              <View style={styles.emailRow}>
                <TextInput
                  style={styles.emailInput}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="friend@example.com"
                  placeholderTextColor={colors.subtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleEmailInvite}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !emailValid && styles.sendBtnDisabled]}
                  onPress={handleEmailInvite}
                  disabled={!emailValid}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function InviteFooter({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <View style={[styles.inviteFooter, { top }]}>
      <View style={styles.inviteFooterDivider} />
      <Text style={styles.inviteHeading}>Know someone who travels?</Text>
      <Text style={styles.inviteSubtext}>
        Invite friends to TruthStay and see where they go.
      </Text>
      <TouchableOpacity style={styles.inviteCta} onPress={onPress} activeOpacity={0.85}>
        <Feather name="user-plus" size={15} color={colors.inverse} style={{ marginRight: 6 }} />
        <Text style={styles.inviteCtaText}>Invite a friend</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [friendUsers, setFriendUsers] = useState<FeedAuthor[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<FeedAuthor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      getFollows(),
      searchUsers(""),
    ]).then(([following, suggested]) => {
      const ids = new Set(following.map(f => f.id));
      setFriends(ids);
      setFriendUsers(following);
      setSuggestedUsers(suggested.filter(u => !ids.has(u.id)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(query);
        setSuggestedUsers(results.filter(u => !friends.has(u.id)));
      } catch { /* non-fatal */ }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function toggle(user: FeedAuthor) {
    const next = new Set(friends);
    if (next.has(user.id)) {
      next.delete(user.id);
      setFriendUsers(prev => prev.filter(f => f.id !== user.id));
      setSuggestedUsers(prev => [user, ...prev]);
      unfollowUser(user.id).catch(() => {});
    } else {
      next.add(user.id);
      setFriendUsers(prev => [...prev, user]);
      setSuggestedUsers(prev => prev.filter(u => u.id !== user.id));
      followUser(user.id).catch(() => {});
    }
    setFriends(next);
  }

  const filteredFriends = query.length >= 2
    ? friendUsers.filter(u =>
        u.display_name.toLowerCase().includes(query.toLowerCase()) ||
        u.username.toLowerCase().includes(query.toLowerCase()),
      )
    : friendUsers;

  const sections = [
    ...(filteredFriends.length > 0 ? [{ title: `Friends (${filteredFriends.length})`, data: filteredFriends }] : []),
    ...(suggestedUsers.length > 0  ? [{ title: "Suggested",                           data: suggestedUsers }]  : []),
  ];

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
        <Text style={styles.backTitle}>Friends</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search users…"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.listContent}>
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
          </View>
        ) : (
          <SectionList
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={u => u.id}
            renderItem={({ item }) => (
              <FriendRow user={item} isFriend={friends.has(item.id)} onToggle={() => toggle(item)} />
            )}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="users" size={40} color={colors.border} />
                <Text style={styles.emptyText}>
                  {query.length >= 2 ? "No users found" : "No suggestions yet"}
                </Text>
              </View>
            }
          />
        )}
      </View>

      <InviteFooter
        onPress={() => setShowInvite(true)}
        top={Dimensions.get("window").height / 2 + 38}
      />

      <InviteModal visible={showInvite} onClose={() => setShowInvite(false)} />
    </View>
  );
}

const TEAL = colors.accent;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  backHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:   { width: 32 },
  backTitle: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.text, letterSpacing: -0.5 },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    margin: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.text },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted,
    marginTop: spacing.md, marginBottom: spacing.xs, textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  friendRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    marginBottom: spacing.xs, ...shadow.sm,
  },
  friendAvatar: { width: 42, height: 42, borderRadius: 21 },
  friendInfo:   { flex: 1 },
  friendName:   { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text },
  friendUsername: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  friendBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5,
  },
  friendBtnAdd:    { backgroundColor: colors.accent, borderColor: colors.accent },
  friendBtnRemove: { backgroundColor: "transparent", borderColor: colors.border },
  friendBtnText: { fontFamily: fonts.sansBold, fontSize: fontSize.xs },
  friendBtnTextAdd:    { color: colors.inverse },
  friendBtnTextRemove: { color: colors.muted },

  empty: { alignItems: "center", paddingVertical: 60, gap: spacing.sm },
  emptyText: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted },

  // ─── Invite footer ─────────────────────────────────────────────────────────
  inviteFooter: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  inviteFooterDivider: {
    alignSelf: "stretch",
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  inviteHeading: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  inviteSubtext: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  inviteCta: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  inviteCtaText: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.sm,
    color: colors.inverse,
  },

  // ─── Invite modal sheet ────────────────────────────────────────────────────
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetKAV: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginBottom: spacing.xs,
  },

  // ─── Option rows ───────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionBody: { flex: 1 },
  optionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.text,
    marginBottom: 2,
  },
  optionSub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
  },

  // ─── Email row ─────────────────────────────────────────────────────────────
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  emailInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    backgroundColor: TEAL,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
  sendBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.sm,
    color: colors.inverse,
  },
});
