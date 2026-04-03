import {
  Dimensions, FlatList, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontSize, radius, spacing, ACTIVITY_EMOJI } from "../../../lib/theme";
import { getFeed, followUser, type FeedItem, type FeedAdventure, type PostRow, type FeedAuthor } from "../../../lib/api";

const { width: W, height: H } = Dimensions.get("window");

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function ActionBtn({
  name, count, active = false, activeColor = "#FFFFFF", onPress,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  count?: number;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={sharedStyles.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <Feather name={name} size={28} color={active ? activeColor : "#FFFFFF"} />
      {count != null && (
        <Text style={sharedStyles.actionCount}>{formatCount(count)}</Text>
      )}
    </TouchableOpacity>
  );
}

function UserRow({
  author,
  extra,
  isFollowing,
  onFollow,
}: {
  author: FeedAuthor;
  extra?: string;
  isFollowing: boolean;
  onFollow: () => void;
}) {
  const initial = (author.display_name || author.username || "?")[0].toUpperCase();
  return (
    <View style={sharedStyles.userRow}>
      {author.avatar_url ? (
        <Image source={{ uri: author.avatar_url }} style={sharedStyles.avatar} />
      ) : (
        <View style={sharedStyles.avatar}>
          <Text style={sharedStyles.avatarText}>{initial}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={sharedStyles.username}>@{author.username}</Text>
        {extra ? <Text style={sharedStyles.subtext}>{extra}</Text> : null}
      </View>
      {!isFollowing && (
        <TouchableOpacity style={sharedStyles.followBtn} onPress={onFollow} activeOpacity={0.8}>
          <Text style={sharedStyles.followText}>Follow</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Itinerary card ───────────────────────────────────────────────────────────

function ItineraryCard({
  item,
}: {
  item: Extract<FeedItem, { type: "adventure" }>;
}) {
  const router = useRouter();
  const { adventure, author } = item;
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);
  const emoji = ACTIVITY_EMOJI[adventure.activityType] ?? "🏔️";
  const coverUri = adventure.coverImageUrl
    ?? `https://picsum.photos/seed/${adventure.id}/800/1200`;

  function handleFollow() {
    setFollowing(true);
    followUser(author.id).catch(() => setFollowing(false));
  }

  function handlePlanSimilar() {
    router.push({
      pathname: "/(app)/discover",
      params: {
        template_title:    adventure.title,
        template_region:   adventure.region,
        template_activity: adventure.activityType,
        template_days:     String(adventure.durationDays),
      },
    } as never);
  }

  const days = [...(adventure.adventure_days ?? [])]
    .sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <View style={{ width: W, height: H }}>
      {/* Background cover */}
      <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)"]}
        style={[StyleSheet.absoluteFillObject, { top: H * 0.3 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Right action rail */}
      <View style={sharedStyles.rail}>
        <ActionBtn
          name="bookmark"
          active={saved}
          activeColor="#FFFFFF"
          onPress={() => setSaved(s => !s)}
        />
        <ActionBtn name="send" onPress={() => {}} />
      </View>

      {/* Bottom content */}
      <View style={itinStyles.bottom}>
        <UserRow
          author={author}
          extra={`📍 ${adventure.region}`}
          isFollowing={following}
          onFollow={handleFollow}
        />

        {/* Chips row */}
        <View style={itinStyles.chips}>
          <View style={itinStyles.chip}>
            <Text style={itinStyles.chipText}>{emoji} {adventure.activityType.toUpperCase()}</Text>
          </View>
          <View style={itinStyles.chip}>
            <Text style={itinStyles.chipText}>{adventure.durationDays} days</Text>
          </View>
          {adventure.level && (
            <View style={itinStyles.chip}>
              <Text style={itinStyles.chipText}>{adventure.level}</Text>
            </View>
          )}
        </View>

        {/* Title + description */}
        <Text style={itinStyles.title} numberOfLines={2}>{adventure.title}</Text>
        {adventure.description ? (
          <Text style={itinStyles.description} numberOfLines={2}>{adventure.description}</Text>
        ) : null}

        {/* Day preview */}
        {days.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={itinStyles.dayScroll}
            contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.md }}
          >
            {days.map(d => (
              <View key={d.id} style={itinStyles.dayChip}>
                <Text style={itinStyles.dayChipText} numberOfLines={1}>
                  Day {d.dayNumber}{d.title ? ` · ${d.title}` : ""}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Action buttons */}
        <View style={itinStyles.btns}>
          <TouchableOpacity
            style={itinStyles.exploreBtn}
            onPress={() => router.push(`/(app)/trips/${adventure.id}` as never)}
            activeOpacity={0.85}
          >
            <Text style={itinStyles.exploreBtnText}>Explore itinerary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={itinStyles.planBtn}
            onPress={handlePlanSimilar}
            activeOpacity={0.85}
          >
            <Text style={itinStyles.planBtnText}>✨ Plan similar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Photo card ───────────────────────────────────────────────────────────────

function PhotoCard({
  item,
}: {
  item: Extract<FeedItem, { type: "post" }>;
}) {
  const router = useRouter();
  const { post, author } = item;
  const [following, setFollowing] = useState(false);
  const [liked, setLiked]         = useState(false);
  const [saved, setSaved]         = useState(false);
  const [current, setCurrent]     = useState(0);

  const photos = post.mediaUrls ?? [];
  const hasPhotos = photos.length > 0;

  function handleFollow() {
    setFollowing(true);
    followUser(author.id).catch(() => setFollowing(false));
  }

  return (
    <View style={{ width: W, height: H }}>
      {hasPhotos ? (
        <>
          <FlatList
            data={photos}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e =>
              setCurrent(Math.round(e.nativeEvent.contentOffset.x / W))
            }
            renderItem={({ item: uri }) => (
              <Image source={{ uri }} style={{ width: W, height: H }} resizeMode="cover" />
            )}
          />
          {photos.length > 1 && (
            <View style={sharedStyles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[sharedStyles.dot, i === current && sharedStyles.dotActive]} />
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.feedBg }} />
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={[StyleSheet.absoluteFillObject, { top: H * 0.4 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Right action rail */}
      <View style={sharedStyles.rail}>
        <ActionBtn
          name="heart"
          count={liked ? 1 : 0}
          active={liked}
          activeColor="#FF4D6A"
          onPress={() => setLiked(l => !l)}
        />
        <ActionBtn name="message-circle" onPress={() => {}} />
        <ActionBtn name="send" onPress={() => {}} />
        <ActionBtn
          name="bookmark"
          active={saved}
          activeColor="#FFFFFF"
          onPress={() => setSaved(s => !s)}
        />
      </View>

      {/* Bottom info */}
      <View style={sharedStyles.info}>
        <UserRow author={author} isFollowing={following} onFollow={handleFollow} />
        {post.body ? (
          <Text style={sharedStyles.caption} numberOfLines={3}>{post.body}</Text>
        ) : null}
        {post.adventureId && (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/trips/${post.adventureId}` as never)}
            activeOpacity={0.8}
          >
            <Text style={photoStyles.adventureLink}>View full itinerary →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[emptyStyles.container, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={emptyStyles.emoji}>🏔️</Text>
      <Text style={emptyStyles.title}>Your feed is empty</Text>
      <Text style={emptyStyles.sub}>
        Follow friends to see their adventures, photos, and itineraries here.
      </Text>
      <TouchableOpacity
        style={emptyStyles.btn}
        onPress={() => router.push("/(app)/profile/friends")}
        activeOpacity={0.85}
      >
        <Text style={emptyStyles.btnText}>Find friends</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const [items, setItems]     = useState<FeedItem[]>([]);
  const [empty, setEmpty]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cursor, setCursor]   = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (cur?: string) => {
    if (!cur) setLoadError(false);
    try {
      const result = await getFeed(cur);
      if (cur) {
        setItems(prev => [...prev, ...result.items]);
      } else {
        setItems(result.items);
        setEmpty(result.empty);
      }
      if (result.items.length > 0) {
        setCursor(result.items[result.items.length - 1].created_at);
      }
    } catch {
      if (!cur) setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleEndReached() {
    if (loadingMore || empty || !cursor) return;
    setLoadingMore(true);
    load(cursor);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.feedBg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.feedBg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Feather name="alert-circle" size={40} color="rgba(255,255,255,0.4)" />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Couldn't load feed.</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (empty || items.length === 0) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }}><EmptyState /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.feedBg }}>
      <FlatList
        data={items}
        keyExtractor={item => (item.type === "adventure" ? `adv-${item.adventure.id}` : `post-${item.post.id}`)}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={H}
        decelerationRate="fast"
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
        renderItem={({ item }) =>
          item.type === "adventure"
            ? <ItineraryCard item={item} />
            : <PhotoCard item={item} />
        }
        ListFooterComponent={loadingMore ? (
          <View style={{ height: H, backgroundColor: colors.feedBg, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  rail: {
    position: "absolute",
    right: spacing.md,
    bottom: 100,
    alignItems: "center",
    gap: spacing.lg,
  },
  actionBtn:   { alignItems: "center", gap: 6 },
  actionCount: { fontSize: fontSize.sm, color: "#FFFFFF", fontWeight: "600" },
  dots: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.md,
    flexDirection: "column",
    gap: spacing.xs,
  },
  dot: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { backgroundColor: "#FFFFFF" },
  info: {
    position: "absolute",
    bottom: 80,
    left: spacing.md,
    right: 80,
    gap: spacing.sm,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  avatarText:  { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.base },
  username:    { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.base },
  subtext:     { color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm },
  followBtn: {
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  followText:  { color: "#FFFFFF", fontWeight: "600", fontSize: fontSize.sm },
  caption:     { color: "#FFFFFF", fontSize: fontSize.base, lineHeight: 22 },
});

const itinStyles = StyleSheet.create({
  bottom: {
    position: "absolute",
    bottom: 80,
    left: spacing.md,
    right: 80,
    gap: spacing.sm,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText:    { color: "#FFFFFF", fontSize: fontSize.xs, fontWeight: "600" },
  title:       { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 32 },
  description: { color: "rgba(255,255,255,0.8)", fontSize: fontSize.sm, lineHeight: 20 },
  dayScroll:   { marginVertical: spacing.xs },
  dayChip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: 200,
  },
  dayChipText: { color: "#FFFFFF", fontSize: fontSize.xs },
  btns:        { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  exploreBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  exploreBtnText: { color: colors.feedBg, fontWeight: "700", fontSize: fontSize.base },
  planBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  planBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.base },
});

const photoStyles = StyleSheet.create({
  adventureLink: {
    color: "rgba(255,255,255,0.7)",
    fontSize: fontSize.sm,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});

const emptyStyles = StyleSheet.create({
  container:  { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  emoji:      { fontSize: 48 },
  title:      { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" },
  sub:        { fontSize: fontSize.base, color: colors.muted, textAlign: "center", lineHeight: 22 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  btnText:    { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.base },
});
