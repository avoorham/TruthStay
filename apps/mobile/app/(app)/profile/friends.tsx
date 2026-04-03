import {
  ActivityIndicator, Image, SectionList, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";
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

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [friendUsers, setFriendUsers] = useState<FeedAuthor[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<FeedAuthor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load real follows + suggestions on mount
  useEffect(() => {
    Promise.all([
      getFollows(),
      searchUsers(""), // top suggested users
    ]).then(([following, suggested]) => {
      const ids = new Set(following.map(f => f.id));
      setFriends(ids);
      setFriendUsers(following);
      setSuggestedUsers(suggested.filter(u => !ids.has(u.id)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(query);
        if (query.length === 0) {
          setSuggestedUsers(results.filter(u => !friends.has(u.id)));
        } else {
          setSuggestedUsers(results.filter(u => !friends.has(u.id)));
        }
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
    ...(filteredFriends.length > 0  ? [{ title: `Friends (${filteredFriends.length})`, data: filteredFriends }] : []),
    ...(suggestedUsers.length > 0   ? [{ title: "Suggested",                           data: suggestedUsers }]  : []),
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
      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <SectionList
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
