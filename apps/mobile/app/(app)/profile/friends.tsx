import {
  FlatList, Image, SectionList, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { MOCK_USERS, type MockUser } from "../../../lib/mock-users";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

const INITIAL_FRIENDS = new Set(["u1", "u2", "u3", "u4", "u5"]);

function FriendRow({
  user,
  isFriend,
  onToggle,
}: {
  user: MockUser;
  isFriend: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.friendRow}>
      <Image
        source={{ uri: `https://picsum.photos/seed/${user.id}/40/40` }}
        style={styles.friendAvatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{user.name}</Text>
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

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [friends, setFriends] = useState<Set<string>>(new Set(INITIAL_FRIENDS));
  const [query, setQuery] = useState("");

  function toggle(id: string) {
    setFriends(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return MOCK_USERS;
    return MOCK_USERS.filter(
      u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().startsWith(q),
    );
  }, [query]);

  const friendUsers    = filtered.filter(u => friends.has(u.id));
  const suggestedUsers = filtered.filter(u => !friends.has(u.id));

  const sections = [
    ...(friendUsers.length > 0    ? [{ title: `Friends (${friendUsers.length})`,       data: friendUsers }]    : []),
    ...(suggestedUsers.length > 0  ? [{ title: "Suggested",                              data: suggestedUsers }] : []),
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
          placeholder="Search friends…"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* List */}
      <SectionList
        sections={sections}
        keyExtractor={u => u.id}
        renderItem={({ item }) => (
          <FriendRow user={item} isFriend={friends.has(item.id)} onToggle={() => toggle(item.id)} />
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
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />
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

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    margin: spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  sectionTitle: {
    fontSize: fontSize.sm, fontWeight: "700", color: colors.muted,
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
  friendName:   { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  friendUsername: { fontSize: fontSize.xs, color: colors.muted },
  friendBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5,
  },
  friendBtnAdd:    { backgroundColor: colors.accent, borderColor: colors.accent },
  friendBtnRemove: { backgroundColor: "transparent", borderColor: colors.border },
  friendBtnText: { fontSize: fontSize.xs, fontWeight: "700" },
  friendBtnTextAdd:    { color: colors.inverse },
  friendBtnTextRemove: { color: colors.muted },

  empty: { alignItems: "center", paddingVertical: 60, gap: spacing.sm },
  emptyText: { fontSize: fontSize.base, color: colors.muted },
});
