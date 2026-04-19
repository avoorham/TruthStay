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
import {
  getFeed, followUser, getActivityPosts,
  likeFeedItem, unlikeFeedItem,
  bookmarkAdventure, unbookmarkAdventure,
  type FeedItem, type FeedAdventure, type PostRow, type FeedAuthor, type ActivityPostRow,
} from "../../../lib/api";
import { supabase } from "../../../lib/supabase";
import CommentsSheet from "../../../components/CommentsSheet";

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
  const [following,   setFollowing]   = useState(false);
  const [bookmarked,  setBookmarked]  = useState(item.isBookmarked);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const emoji = ACTIVITY_EMOJI[adventure.activityType] ?? "🏔️";
  const coverUri = adventure.coverImageUrl
    ?? `https://picsum.photos/seed/${adventure.id}/800/1200`;

  function handleFollow() {
    setFollowing(true);
    followUser(author.id).catch(() => setFollowing(false));
  }

  function handleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    const fn = next ? bookmarkAdventure : unbookmarkAdventure;
    fn(adventure.id).catch(() => setBookmarked(!next));
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
      <Image source={{ uri: coverUri }} style={{ ...StyleSheet.absoluteFillObject }} resizeMode="cover" />

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)"]}
        style={[{ ...StyleSheet.absoluteFillObject }, { top: H * 0.3 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Right action rail */}
      <View style={sharedStyles.rail}>
        <ActionBtn
          name="bookmark"
          active={bookmarked}
          activeColor="#FFFFFF"
          onPress={handleBookmark}
        />
        <ActionBtn
          name="message-circle"
          count={commentCount}
          onPress={() => setShowComments(true)}
        />
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

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        type="adventure"
        id={adventure.id}
        onCountChange={setCommentCount}
      />
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
  const [following,    setFollowing]    = useState(false);
  const [liked,        setLiked]        = useState(item.isLiked);
  const [likeCount,    setLikeCount]    = useState(item.likeCount);
  const [current,      setCurrent]      = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(item.commentCount);

  const photos = post.mediaUrls ?? [];
  const hasPhotos = photos.length > 0;

  function handleFollow() {
    setFollowing(true);
    followUser(author.id).catch(() => setFollowing(false));
  }

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    const fn = next ? likeFeedItem : unlikeFeedItem;
    fn("post", post.id).catch(() => {
      setLiked(!next);
      setLikeCount(c => c + (next ? -1 : 1));
    });
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
        style={[{ ...StyleSheet.absoluteFillObject }, { top: H * 0.4 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Right action rail */}
      <View style={sharedStyles.rail}>
        <ActionBtn
          name="heart"
          count={likeCount}
          active={liked}
          activeColor="#FF4D6A"
          onPress={handleLike}
        />
        <ActionBtn
          name="message-circle"
          count={commentCount}
          onPress={() => setShowComments(true)}
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

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        type="post"
        id={post.id}
        onCountChange={setCommentCount}
      />
    </View>
  );
}

// ─── Activity post card ───────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = { route: "🏃", accommodation: "🏨", restaurant: "🍽️", custom: "📍", stay: "🏨", activity: "🏃" };
const TYPE_LABEL: Record<string, string> = { route: "Activity", accommodation: "Stay", restaurant: "Food", custom: "Spot", stay: "Stay", activity: "Activity" };

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ActivityPostCard({ post }: { post: ActivityPostRow }) {
  const photos = Array.isArray(post.photos) ? post.photos : [];
  const icon = TYPE_ICON[post.item_type] ?? "📍";
  const label = TYPE_LABEL[post.item_type] ?? post.item_type;
  const authorInitial = (post.user_email ?? "?")[0].toUpperCase();

  return (
    <View style={{ width: W, height: H, backgroundColor: colors.feedBg }}>
      {photos.length > 0 ? (
        <Image source={{ uri: photos[0] }} style={{ ...StyleSheet.absoluteFillObject }} resizeMode="cover" />
      ) : (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#1A1F2E" }} />
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.90)"]}
        style={[{ ...StyleSheet.absoluteFillObject }, { top: H * 0.35 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Bottom content */}
      <View style={[sharedStyles.info, { gap: spacing.sm }]}>
        {/* Author row */}
        <View style={sharedStyles.userRow}>
          <View style={sharedStyles.avatar}>
            <Text style={sharedStyles.avatarText}>{authorInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sharedStyles.username}>{post.user_email}</Text>
            <Text style={sharedStyles.subtext}>{label} · Day {post.day_number} · {relativeTime(post.created_date)}</Text>
          </View>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
        </View>

        <Text style={{ color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "800" }} numberOfLines={2}>
          {post.item_name}
        </Text>

        {post.location ? (
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: fontSize.sm }}>📍 {post.location}</Text>
        ) : null}

        {post.rating ? (
          <Text style={{ color: "#F59E0B", fontSize: fontSize.sm }}>{"★".repeat(post.rating)}{"☆".repeat(5 - post.rating)}</Text>
        ) : null}

        {post.notes ? (
          <Text style={sharedStyles.caption} numberOfLines={3}>{post.notes}</Text>
        ) : null}

        {/* Extra photos strip */}
        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.xs }}>
            {photos.slice(1).map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={{ width: 64, height: 64, borderRadius: 10, marginRight: spacing.xs }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
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

type ActivityFeedItem = { type: "activity_post"; created_at: string; post: ActivityPostRow };
type CombinedFeedItem = FeedItem | ActivityFeedItem;

export default function FeedScreen() {
  const [items, setItems]     = useState<CombinedFeedItem[]>([]);
  const [empty, setEmpty]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cursor, setCursor]   = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (cur?: string) => {
    if (!cur) setLoadError(false);
    try {
      const result = await getFeed(cur);

      // Also load activity posts from followed users (only on first load, not pagination)
      let activityItems: ActivityFeedItem[] = [];
      if (!cur) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const myEmail = session?.user?.email ?? "";
          // Query follows table directly — it stores emails, not UUIDs
          const { data: followRows } = await supabase
            .from("follows")
            .select("following_email")
            .eq("follower_email", myEmail);
          const followedEmails = (followRows ?? []).map((r: { following_email: string }) => r.following_email);
          const posts = await getActivityPosts(followedEmails, myEmail);
          activityItems = posts.map(p => ({
            type: "activity_post" as const,
            created_at: p.created_date,
            post: p,
          }));
        } catch { /* non-fatal — proceed without activity posts */ }
      }

      if (cur) {
        setItems(prev => [...prev, ...result.items]);
      } else {
        const merged: CombinedFeedItem[] = [
          ...result.items,
          ...activityItems,
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(merged);
        setEmpty(result.empty && activityItems.length === 0);
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
        keyExtractor={item =>
          item.type === "adventure" ? `adv-${item.adventure.id}`
          : item.type === "activity_post" ? `act-${item.post.id}`
          : `post-${item.post.id}`
        }
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={H}
        decelerationRate="fast"
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
        renderItem={({ item }) =>
          item.type === "adventure" ? <ItineraryCard item={item} />
          : item.type === "activity_post" ? <ActivityPostCard post={item.post} />
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
