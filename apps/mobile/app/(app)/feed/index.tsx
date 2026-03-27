import {
  Dimensions, FlatList, Image, StyleSheet, Text,
  TouchableOpacity, View, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontSize, radius, spacing, ACTIVITY_EMOJI } from "../../../lib/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Mock feed data (replaced with real data when social layer is built) ──────

const MOCK_POSTS = [
  {
    id: "1",
    username: "sarah.peaks",
    displayName: "Sarah Collins",
    isFollowing: false,
    activityType: "hiking",
    region: "Dolomites, Italy",
    caption: "3 days on the Alta Via 1 — absolutely brutal on day 2 but the sunrise from Rifugio Lagazuoi made it all worth it.",
    likes: 2400,
    comments: 87,
    shares: 34,
    photos: [
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
      "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
      "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80",
    ],
  },
  {
    id: "2",
    username: "james.veloce",
    displayName: "James Rider",
    isFollowing: true,
    activityType: "cycling",
    region: "Mallorca, Spain",
    caption: "Sa Calobra twice in one day. The second descent was better than the first. Can recommend 10/10.",
    likes: 1800,
    comments: 124,
    shares: 56,
    photos: [
      "https://images.unsplash.com/photo-1476994230281-b2cce1977cf6?w=800&q=80",
      "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80",
    ],
  },
  {
    id: "3",
    username: "elena.vertical",
    displayName: "Elena Marsh",
    isFollowing: false,
    activityType: "climbing",
    region: "Kalymnos, Greece",
    caption: "Two weeks on limestone. Fingers wrecked. Soul replenished.",
    likes: 3200,
    comments: 210,
    shares: 88,
    photos: [
      "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&q=80",
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    ],
  },
  {
    id: "4",
    username: "tom.trails",
    displayName: "Tom Okafor",
    isFollowing: true,
    activityType: "trail_running",
    region: "Chamonix, France",
    caption: "UTMB course recon done. 170km, 10,000m. Body is asking serious questions.",
    likes: 5100,
    comments: 342,
    shares: 190,
    photos: [
      "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80",
      "https://images.unsplash.com/photo-1489659831163-682b5af42225?w=800&q=80",
    ],
  },
];

// ─── Photo carousel inside a full-screen post ────────────────────────────────

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [current, setCurrent] = useState(0);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <FlatList
        data={photos}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setCurrent(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
        }}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={styles.photo} resizeMode="cover" />
        )}
      />
      {/* Dot indicators */}
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Single full-screen post ──────────────────────────────────────────────────

function FullScreenPost({ post }: { post: typeof MOCK_POSTS[0] }) {
  const [following, setFollowing] = useState(post.isFollowing);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const emoji = ACTIVITY_EMOJI[post.activityType] ?? "🏔️";

  return (
    <View style={styles.post}>
      <PhotoCarousel photos={post.photos} />

      {/* Dark gradient at bottom */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Right action rail */}
      <View style={styles.rail}>
        <ActionBtn
          icon={liked ? "❤️" : "🤍"}
          count={post.likes + (liked ? 1 : 0)}
          onPress={() => setLiked(l => !l)}
        />
        <ActionBtn icon="💬" count={post.comments} onPress={() => {}} />
        <ActionBtn icon="↗️" count={post.shares} onPress={() => {}} />
        <ActionBtn icon={saved ? "🔖" : "🏷️"} count={null} onPress={() => setSaved(s => !s)} />
        <ActionBtn icon="•••" count={null} onPress={() => {}} />
      </View>

      {/* Bottom info */}
      <View style={styles.info}>
        {/* User row */}
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{post.displayName[0]}</Text>
          </View>
          <View>
            <Text style={styles.username}>@{post.username}</Text>
            <Text style={styles.region}>{emoji} {post.region}</Text>
          </View>
          {!following && (
            <TouchableOpacity
              style={styles.followBtn}
              onPress={() => setFollowing(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.followText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Caption */}
        <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
      </View>
    </View>
  );
}

function ActionBtn({ icon, count, onPress }: { icon: string; count: number | null; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.actionIcon}>{icon}</Text>
      {count !== null && <Text style={styles.actionCount}>{count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}</Text>}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Top tabs: For You / Following / Explore */}
      <View style={[styles.topTabs, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={[styles.topTab, styles.topTabActive]}>For You</Text>
        <Text style={styles.topTab}>Following</Text>
        <Text style={styles.topTab}>Explore</Text>
      </View>

      <FlatList
        data={MOCK_POSTS}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        renderItem={({ item }) => <FullScreenPost post={item} />}
        getItemLayout={(_, index) => ({ length: SCREEN_H, offset: SCREEN_H * index, index })}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.feedBg },
  topTabs: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    paddingBottom: spacing.sm,
  },
  topTab: {
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  topTabActive: {
    color: colors.inverse,
    fontWeight: "700",
    borderBottomWidth: 2,
    borderBottomColor: colors.inverse,
    paddingBottom: 2,
  },
  post: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: colors.feedBg,
  },
  photo: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
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
  dotActive: {
    backgroundColor: colors.inverse,
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.55,
  },
  rail: {
    position: "absolute",
    right: spacing.md,
    bottom: 100,
    alignItems: "center",
    gap: spacing.lg,
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionIcon: { fontSize: 26 },
  actionCount: { fontSize: fontSize.sm, color: colors.inverse, fontWeight: "600" },
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
    borderColor: colors.inverse,
  },
  avatarText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
  username: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
  region: { color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm },
  followBtn: {
    borderWidth: 1.5,
    borderColor: colors.inverse,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  followText: { color: colors.inverse, fontWeight: "600", fontSize: fontSize.sm },
  caption: {
    color: colors.inverse,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
});
