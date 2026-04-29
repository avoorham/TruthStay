import {
  ActivityIndicator, Dimensions, FlatList, Image, Modal,
  Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../../../lib/theme";
import {
  getHotspotFeed, getStoryCircles, getEditorialPosts, getActivityPosts,
  markStoryViewed, dismissStory, addContentEntryToTrip,
  type ContentEntry, type HotspotSection, type FeedState,
  type UpcomingTrip, type StoryCircle, type FeedStory, type EditorialPost,
  type ActivityPostRow,
} from "../../../lib/api";
import { supabase } from "../../../lib/supabase";
import CommentsSheet from "../../../components/CommentsSheet";

const { width: W, height: H } = Dimensions.get("window");
const TEAL = colors.sage; // #2ECDA7 — used as story ring teal

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  route: "🚴", accommodation: "🏨", restaurant: "🍽️",
  activity: "🏃", stay: "🏨", custom: "📍",
};

function contentIcon(type: string, activityType?: string | null) {
  if (type === "route" && activityType) {
    const map: Record<string, string> = {
      cycling: "🚴", hiking: "🥾", trail_running: "🏃",
      climbing: "🧗", skiing: "⛷️", kayaking: "🛶",
    };
    return map[activityType] ?? "🚴";
  }
  return TYPE_ICON[type] ?? "📍";
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return km < 10 ? `${km.toFixed(1)}km away` : `${Math.round(km)}km away`;
}

// ─── Empty state (State 1) ────────────────────────────────────────────────────

function EmptyFeed() {
  const router = useRouter();
  return (
    <View style={emptyS.wrap}>
      <View style={emptyS.card}>
        <View style={emptyS.imgWrap}>
          <Image
            source={require("../../../assets/feed-empty.png")}
            style={emptyS.img}
            resizeMode="cover"
          />
        </View>
        <View style={emptyS.text}>
          <Text style={emptyS.title}>Your feed is empty</Text>
          <Text style={emptyS.sub}>
            Follow friends to see their adventures, photos, and itineraries here.
          </Text>
          <TouchableOpacity
            style={emptyS.btn}
            onPress={() => router.push("/(app)/profile/friends" as never)}
            activeOpacity={0.85}
          >
            <Text style={emptyS.btnText}>Find friends</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Add-to-Trip modal ────────────────────────────────────────────────────────

function AddToTripModal({
  entry, trips, onClose,
}: {
  entry: ContentEntry;
  trips: UpcomingTrip[];
  onClose: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleAdd(tripId: string) {
    setSaving(tripId);
    try {
      await addContentEntryToTrip(entry.id, tripId);
      setDone(tripId);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalS.backdrop} onPress={onClose} />
      <View style={modalS.sheet}>
        <View style={modalS.handle} />
        <Text style={modalS.heading}>Add to which trip?</Text>
        {trips.length === 0 ? (
          <Text style={modalS.empty}>No upcoming trips planned yet.</Text>
        ) : (
          trips.map(trip => {
            const added = done === trip.id;
            return (
              <TouchableOpacity
                key={trip.id}
                style={[modalS.tripRow, added && modalS.tripRowAdded]}
                onPress={() => handleAdd(trip.id)}
                activeOpacity={0.8}
                disabled={saving !== null || added}
              >
                <View style={{ flex: 1 }}>
                  <Text style={modalS.tripTitle}>✈️  {trip.title}</Text>
                  <Text style={modalS.tripSub}>{trip.startDate} · {trip.region}</Text>
                </View>
                {saving === trip.id ? (
                  <ActivityIndicator size="small" color={TEAL} />
                ) : added ? (
                  <Feather name="check-circle" size={20} color={TEAL} />
                ) : (
                  <Feather name="plus-circle" size={20} color={colors.muted} />
                )}
              </TouchableOpacity>
            );
          })
        )}
        <TouchableOpacity style={modalS.cancel} onPress={onClose} activeOpacity={0.8}>
          <Text style={modalS.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Full-screen Story Viewer ─────────────────────────────────────────────────

function StoryViewer({
  circle, onClose,
}: {
  circle: StoryCircle;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const story: FeedStory = circle.stories[current] ?? circle.stories[0];
  const total = circle.stories.length;

  useEffect(() => {
    if (story) markStoryViewed(story.id).catch(() => {});
  }, [story?.id]);

  function next() {
    if (current < total - 1) setCurrent(c => c + 1);
    else onClose();
  }
  function prev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  if (!story) return null;

  const coords = story.metadata?.coordinates as { lat?: number; lng?: number } | undefined;
  const mapUrl = coords?.lat && coords.lng
    ? (process.env.EXPO_PUBLIC_MAPTILER_KEY ? `https://api.maptiler.com/maps/streets/static/${coords.lng},${coords.lat},12/480x320.png?key=${process.env.EXPO_PUBLIC_MAPTILER_KEY}` : null)
    : null;
  const heroUri = story.image_url ?? mapUrl;

  return (
    <Modal animationType="fade" statusBarTranslucent>
      <View style={storyS.container}>
        {/* Background */}
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[colors.midnight, colors.navy]}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.85)"]}
          style={StyleSheet.absoluteFillObject}
          locations={[0, 0.3, 1]}
        />

        {/* Progress bar */}
        <View style={storyS.progress}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[storyS.progressSeg, i < current && storyS.progressDone, i === current && storyS.progressActive]}
            />
          ))}
        </View>

        {/* Close */}
        <TouchableOpacity style={storyS.close} onPress={onClose} activeOpacity={0.8}>
          <Feather name="x" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Dismiss story */}
        <TouchableOpacity
          style={storyS.dismiss}
          onPress={() => { dismissStory(story.id).catch(() => {}); onClose(); }}
          activeOpacity={0.8}
        >
          <Feather name="eye-off" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Tap zones */}
        <Pressable style={storyS.tapLeft}  onPress={prev} />
        <Pressable style={storyS.tapRight} onPress={next} />

        {/* Content card at bottom */}
        <View style={storyS.card}>
          {story.context_tag ? (
            <View style={storyS.contextPill}>
              <Text style={storyS.contextText}>{story.context_tag}</Text>
            </View>
          ) : null}

          <Text style={storyS.title} numberOfLines={2}>{story.title}</Text>
          {story.subtitle ? (
            <Text style={storyS.subtitle} numberOfLines={1}>{story.subtitle}</Text>
          ) : null}
          {story.description ? (
            <Text style={storyS.desc} numberOfLines={3}>{story.description}</Text>
          ) : null}

          {/* Trust score if available */}
          {(story.metadata?.trust_score) ? (
            <Text style={storyS.score}>★ {(story.metadata.trust_score as number).toFixed(2)}</Text>
          ) : null}

          <View style={storyS.actions}>
            <TouchableOpacity style={storyS.actionBtn} activeOpacity={0.85} onPress={next}>
              <Feather name="heart" size={16} color={TEAL} />
              <Text style={storyS.actionBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[storyS.actionBtn, storyS.actionBtnPrimary]} activeOpacity={0.85} onPress={next}>
              <Text style={storyS.actionBtnTextPrimary}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Stories bar ──────────────────────────────────────────────────────────────

function StoriesBar({
  circles, onPress,
}: {
  circles: StoryCircle[];
  onPress: (circle: StoryCircle) => void;
}) {
  if (circles.length === 0) return null;

  return (
    <View style={storiesBarS.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={storiesBarS.row}
      >
        {circles.map(circle => {
          const ringColor = circle.has_unviewed ? TEAL : `${TEAL}55`;
          return (
            <TouchableOpacity
              key={circle.group_key}
              style={storiesBarS.item}
              onPress={() => onPress(circle)}
              activeOpacity={0.85}
            >
              <View style={[storiesBarS.ring, { borderColor: ringColor }]}>
                {circle.thumbnail_url ? (
                  <Image source={{ uri: circle.thumbnail_url }} style={storiesBarS.avatar} />
                ) : (
                  <View style={[storiesBarS.avatar, { backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontSize: 20 }}>
                      {circle.group_key.startsWith("trip:") ? "✈️"
                        : circle.group_key.startsWith("nearby:") ? "📍"
                        : circle.group_key.startsWith("scout:") ? "🆕"
                        : "⭐"}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={storiesBarS.label} numberOfLines={1}>
                {circle.label ?? "New"}
              </Text>
              {circle.has_unviewed && <View style={storiesBarS.dot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Hotspot card ─────────────────────────────────────────────────────────────

function HotspotCard({
  entry, contextTag, onAddToTrip,
}: {
  entry: ContentEntry;
  contextTag?: string;
  onAddToTrip: (entry: ContentEntry) => void;
}) {
  const icon = contentIcon(entry.type, entry.activity_type);
  const coords = entry.data?.coordinates as { lat?: number; lng?: number } | undefined;
  const distanceKm = entry.data?.distance_km as number | undefined;
  const heroUri = (entry.data?.coverImageUrl ?? entry.data?.imageUrl) as string | undefined;

  return (
    <View style={hotspotS.card}>
      {/* Hero */}
      <View style={hotspotS.heroWrap}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={hotspotS.hero} resizeMode="cover" />
        ) : coords?.lat && coords.lng ? (
          <View style={[hotspotS.hero, hotspotS.mapPlaceholder]}>
            <Text style={{ fontSize: 32 }}>🗺️</Text>
            <Text style={hotspotS.mapCoords}>
              {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
            </Text>
          </View>
        ) : (
          <LinearGradient
            colors={[colors.accentLight, colors.oceanLight]}
            style={hotspotS.hero}
          >
            <Text style={{ fontSize: 40 }}>{icon}</Text>
          </LinearGradient>
        )}
        {entry.trust_score != null && (
          <View style={hotspotS.scoreBadge}>
            <Text style={hotspotS.scoreText}>★ {entry.trust_score.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={hotspotS.body}>
        <Text style={hotspotS.meta}>
          {icon} {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} · {entry.region}
        </Text>
        <Text style={hotspotS.name} numberOfLines={2}>{entry.name}</Text>
        {entry.description ? (
          <Text style={hotspotS.desc} numberOfLines={2}>{entry.description}</Text>
        ) : null}

        {distanceKm != null && (
          <Text style={hotspotS.dist}>{formatDistance(distanceKm)}</Text>
        )}

        {contextTag ? (
          <View style={hotspotS.contextPill}>
            <Text style={hotspotS.contextText}>{contextTag}</Text>
          </View>
        ) : null}

        <View style={hotspotS.actions}>
          <TouchableOpacity
            style={hotspotS.addBtn}
            onPress={() => onAddToTrip(entry)}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={14} color={TEAL} />
            <Text style={hotspotS.addBtnText}>Add to Trip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Hotspot section (header + horizontal card carousel) ─────────────────────

function HotspotSectionView({
  section, contextTag, onAddToTrip,
}: {
  section: HotspotSection;
  contextTag?: string;
  onAddToTrip: (entry: ContentEntry) => void;
}) {
  if (section.entries.length === 0) return null;

  return (
    <View style={sectionS.wrap}>
      <View style={sectionS.header}>
        <View>
          <Text style={sectionS.title}>{section.title}</Text>
          {section.subtitle ? <Text style={sectionS.subtitle}>{section.subtitle}</Text> : null}
        </View>
      </View>
      <FlatList
        horizontal
        data={section.entries}
        keyExtractor={item => (item as ContentEntry).id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
        snapToInterval={240 + spacing.sm}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <HotspotCard
            entry={item as ContentEntry}
            contextTag={contextTag}
            onAddToTrip={onAddToTrip}
          />
        )}
      />
    </View>
  );
}

// ─── Editorial post card ──────────────────────────────────────────────────────

function EditorialCard({ post }: { post: EditorialPost }) {
  const [saved, setSaved] = useState(false);

  return (
    <View style={editorialS.card}>
      {/* Hero */}
      {post.hero_image_url ? (
        <Image source={{ uri: post.hero_image_url }} style={editorialS.hero} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[colors.midnight, colors.navyLight]} style={editorialS.hero}>
          <Text style={{ fontSize: 48 }}>📖</Text>
        </LinearGradient>
      )}

      {/* Save button */}
      <TouchableOpacity
        style={editorialS.saveBtn}
        onPress={() => setSaved(s => !s)}
        activeOpacity={0.85}
      >
        <Feather name="heart" size={20} color={saved ? "#FF4D6A" : "#FFFFFF"} />
      </TouchableOpacity>

      {/* Body */}
      <View style={editorialS.body}>
        {/* Byline */}
        <View style={editorialS.byline}>
          <View style={editorialS.bylineAvatar}>
            <Text style={{ fontSize: 12 }}>TS</Text>
          </View>
          <Text style={editorialS.bylineName}>truthstay</Text>
          {post.region ? <Text style={editorialS.bylineRegion}>· {post.region}</Text> : null}
        </View>

        <Text style={editorialS.title}>{post.title}</Text>
        {post.subtitle ? <Text style={editorialS.subtitle}>{post.subtitle}</Text> : null}
        {post.body ? (
          <Text style={editorialS.body_} numberOfLines={3}>{post.body}</Text>
        ) : null}

        <View style={editorialS.footer}>
          {post.save_count > 0 && (
            <Text style={editorialS.footerMeta}>❤️ {post.save_count} saves</Text>
          )}
          {post.published_at && (
            <Text style={editorialS.footerMeta}>{relTime(post.published_at)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Friend activity card ─────────────────────────────────────────────────────

const ACT_ICON: Record<string, string> = {
  route: "🏃", accommodation: "🏨", restaurant: "🍽️", custom: "📍", stay: "🏨", activity: "🏃",
};

function FriendActivityCard({ post }: { post: ActivityPostRow }) {
  const photos = Array.isArray(post.photos) ? post.photos as string[] : [];
  const icon = ACT_ICON[post.item_type] ?? "📍";
  const initial = (post.user_email ?? "?")[0].toUpperCase();
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  return (
    <View style={friendS.card}>
      {photos.length > 0 && (
        <Image source={{ uri: photos[0] }} style={friendS.photo} resizeMode="cover" />
      )}

      <View style={friendS.body}>
        <View style={friendS.authorRow}>
          <View style={friendS.avatar}>
            <Text style={friendS.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={friendS.author}>{post.user_email}</Text>
            <Text style={friendS.meta}>{icon} Day {post.day_number} · {relTime(post.created_date)}</Text>
          </View>
        </View>

        <Text style={friendS.name} numberOfLines={2}>{post.item_name}</Text>
        {post.location ? <Text style={friendS.loc}>📍 {post.location}</Text> : null}
        {post.rating ? (
          <Text style={friendS.rating}>
            {"★".repeat(post.rating)}{"☆".repeat(5 - post.rating)}
          </Text>
        ) : null}
        {post.notes ? <Text style={friendS.notes} numberOfLines={3}>{post.notes}</Text> : null}

        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.xs }}>
            {photos.slice(1).map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={{ width: 60, height: 60, borderRadius: radius.sm, marginRight: spacing.xs }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        <View style={friendS.actions}>
          <TouchableOpacity
            style={friendS.actionBtn}
            onPress={() => setShowComments(true)}
            activeOpacity={0.8}
          >
            <Feather name="message-circle" size={16} color={colors.muted} />
            {commentCount > 0 && <Text style={friendS.actionText}>{commentCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={friendS.actionBtn} activeOpacity={0.8}>
            <Feather name="heart" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>
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

// ─── Section divider ──────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />;
}

// ─── Main feed screen ─────────────────────────────────────────────────────────

export default function FeedScreen() {
  const insets  = useSafeAreaInsets();
  const [loading, setLoading]           = useState(true);
  const [hasNotifications]              = useState(false);
  const [feedState, setFeedState]       = useState<FeedState | null>(null);
  const [sections, setSections]         = useState<HotspotSection[]>([]);
  const [circles, setCircles]           = useState<StoryCircle[]>([]);
  const [editorial, setEditorial]       = useState<EditorialPost[]>([]);
  const [friendPosts, setFriendPosts]   = useState<ActivityPostRow[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTrip[]>([]);
  const [activeCircle, setActiveCircle] = useState<StoryCircle | null>(null);
  const [addTarget, setAddTarget]       = useState<ContentEntry | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    try {
      const [hotspots, stories, posts] = await Promise.all([
        getHotspotFeed(),
        getStoryCircles().catch(() => []),
        getEditorialPosts().catch(() => []),
      ]);

      setFeedState(hotspots.state);
      setSections(hotspots.feed);
      setUpcomingTrips(hotspots.upcomingTrips);
      // Filter out friend_activity from story circles — friend posts go in the feed, not stories
      setCircles(stories.filter(c => !c.group_key.startsWith("user:")));
      setEditorial(posts);

      // Load friend activity posts if user has friends
      if (hotspots.state.hasFriends) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const myEmail = session?.user?.email ?? "";
          const { data: followRows } = await supabase
            .from("follows")
            .select("following_email")
            .eq("follower_email", myEmail);
          const followedEmails = (followRows ?? []).map(
            (r: { following_email: string }) => r.following_email,
          );
          if (followedEmails.length > 0) {
            const activity = await getActivityPosts(followedEmails, myEmail);
            setFriendPosts(activity);
          }
        } catch { /* non-fatal */ }
      }
    } catch (e) {
      console.error("Feed load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Realtime: new stories appear instantly ─────────────────────────────────
  useEffect(() => {
    let email = "";
    supabase.auth.getSession().then(({ data: { session } }) => {
      email = session?.user?.email ?? "";
      const userId = session?.user?.id ?? "";
      if (!userId) return;

      realtimeRef.current = supabase
        .channel("feed-stories-rt")
        .on("postgres_changes", {
          event:  "INSERT",
          schema: "public",
          table:  "feed_stories",
          filter: `target_user_id=eq.${userId}`,
        }, (payload) => {
          const newStory = payload.new as FeedStory & { group_key: string; group_label: string };
          if (newStory.group_key.startsWith("user:")) return; // friend posts go in feed
          setCircles(prev => {
            const existing = prev.find(c => c.group_key === newStory.group_key);
            if (existing) {
              return prev.map(c =>
                c.group_key === newStory.group_key
                  ? { ...c, has_unviewed: true, stories: [newStory, ...c.stories] }
                  : c,
              );
            }
            return [{
              group_key:     newStory.group_key,
              label:         newStory.group_label ?? null,
              thumbnail_url: null,
              has_unviewed:  true,
              stories:       [newStory],
            }, ...prev];
          });
        })
        .subscribe();
    });

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  if (loading) {
    return (
      <View style={[screenS.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // State 1: no friends AND no trips → pirate illustration
  if (feedState && !feedState.hasTrips && !feedState.hasFriends) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <EmptyFeed />
      </View>
    );
  }

  const showStories    = feedState?.hasTrips === true && circles.length > 0;
  const tripSections   = sections.filter(s => s.section === "upcoming_trip");
  const nearbySections = sections.filter(s => s.section === "nearby");
  const forYouSections = sections.filter(s => s.section === "for_you");
  const recentSection  = sections.find(s => s.section === "recent");

  return (
    <View style={[screenS.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={screenS.header}>
        <TouchableOpacity style={screenS.headerBtn}>
          <Feather name="plus" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={screenS.headerTitle}>Feed</Text>
        <TouchableOpacity style={screenS.headerBtn}>
          <View>
            <Feather name="heart" size={22} color={colors.text} />
            {hasNotifications && <View style={screenS.notifDot} />}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stories bar — States 2 & 4 only */}
        {showStories && (
          <StoriesBar circles={circles} onPress={setActiveCircle} />
        )}

        {/* For upcoming trips sections */}
        {tripSections.map(section => (
          <HotspotSectionView
            key={section.tripId ?? section.title}
            section={section}
            contextTag={`✈️ ${section.title.replace("For your ", "For your ")}`}
            onAddToTrip={setAddTarget}
          />
        ))}

        {tripSections.length > 0 && editorial.length > 0 && <Divider />}

        {/* First editorial post */}
        {editorial.slice(0, 1).map(p => (
          <EditorialCard key={p.id} post={p} />
        ))}

        {/* Friend activity — States 3 & 4 */}
        {feedState?.hasFriends && friendPosts.length > 0 && (
          <>
            <View style={sectionS.header}>
              <Text style={sectionS.title}>Friends</Text>
            </View>
            {friendPosts.slice(0, 6).map(p => (
              <FriendActivityCard key={p.id} post={p} />
            ))}
          </>
        )}

        {/* Nearby section */}
        {nearbySections.map(section => (
          <HotspotSectionView
            key="nearby"
            section={section}
            contextTag="📍 Near you"
            onAddToTrip={setAddTarget}
          />
        ))}

        {/* Picked for you */}
        {forYouSections.map(section => (
          <HotspotSectionView
            key="for_you"
            section={section}
            contextTag={`⭐ ${section.subtitle ?? "Picked for you"}`}
            onAddToTrip={setAddTarget}
          />
        ))}

        {/* More editorial posts */}
        {editorial.slice(1).map(p => (
          <EditorialCard key={p.id} post={p} />
        ))}

        {/* Recently added */}
        {recentSection && recentSection.entries.length > 0 && (
          <HotspotSectionView
            section={recentSection}
            onAddToTrip={setAddTarget}
          />
        )}

        {/* Empty nudge when no sections have content */}
        {sections.every(s => s.entries.length === 0) && friendPosts.length === 0 && editorial.length === 0 && (
          <View style={screenS.center}>
            <Feather name="compass" size={40} color={colors.subtle} />
            <Text style={screenS.emptyMsg}>Hotspots are being discovered for you.</Text>
          </View>
        )}
      </ScrollView>

      {/* Story viewer */}
      {activeCircle && (
        <StoryViewer circle={activeCircle} onClose={() => setActiveCircle(null)} />
      )}

      {/* Add to trip modal */}
      {addTarget && (
        <AddToTripModal
          entry={addTarget}
          trips={upcomingTrips}
          onClose={() => setAddTarget(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const screenS = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.card,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
  },
  headerTitle: {
    fontFamily:    fonts.display,
    fontSize:      fontSize.xxl,
    color:         colors.text,
    letterSpacing: -0.5,
    flex:          1,
    textAlign:     "center",
  },
  headerBtn: {
    width:          36,
    alignItems:     "center",
    justifyContent: "center",
  },
  notifDot: {
    position:        "absolute",
    top:             -2,
    right:           -2,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.accent,
    borderWidth:     1.5,
    borderColor:     colors.card,
  },
  emptyMsg: {
    fontFamily: fonts.sans,
    fontSize:   fontSize.base,
    color:      colors.muted,
    marginTop:  spacing.sm,
    textAlign:  "center",
  },
});

const storiesBarS = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical:   spacing.sm,
  },
  row:    { paddingHorizontal: spacing.md, gap: spacing.md },
  item:   { alignItems: "center", width: 72 },
  ring: {
    width:        68,
    height:       68,
    borderRadius: 34,
    borderWidth:  2.5,
    padding:      3,
    marginBottom: 4,
  },
  avatar:  { width: "100%" as never, height: "100%" as never, borderRadius: 30, overflow: "hidden" },
  label: {
    fontFamily: fonts.sans,
    fontSize:   fontSize.xs,
    color:      colors.muted,
    textAlign:  "center",
    maxWidth:   68,
  },
  dot: {
    position:    "absolute",
    top:         0,
    right:       6,
    width:       10,
    height:      10,
    borderRadius: 5,
    backgroundColor: TEAL,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
});

const storyS = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  progress: {
    flexDirection:     "row",
    position:          "absolute",
    top:               52,
    left:              spacing.md,
    right:             spacing.md,
    gap:               4,
    zIndex:            10,
  },
  progressSeg: {
    flex:          1,
    height:        3,
    borderRadius:  2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressDone:   { backgroundColor: "#FFFFFF" },
  progressActive: { backgroundColor: "rgba(255,255,255,0.85)" },
  close: {
    position: "absolute",
    top:      52,
    right:    spacing.md,
    zIndex:   20,
    padding:  spacing.xs,
  },
  dismiss: {
    position: "absolute",
    top:      52,
    right:    spacing.md + 40,
    zIndex:   20,
    padding:  spacing.xs,
  },
  tapLeft:  { position: "absolute", left: 0,    top: 80, bottom: 200, width: W * 0.35, zIndex: 5 },
  tapRight: { position: "absolute", right: 0,   top: 80, bottom: 200, width: W * 0.35, zIndex: 5 },
  card: {
    position:         "absolute",
    bottom:           0,
    left:             0,
    right:            0,
    backgroundColor:  "rgba(30,30,40,0.92)",
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:          spacing.lg,
    paddingBottom:    spacing.xxl,
    gap:              spacing.sm,
  },
  contextPill: {
    alignSelf:        "flex-start",
    backgroundColor:  TEAL,
    borderRadius:     radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:  3,
  },
  contextText: { fontFamily: fonts.sansSemiBold, color: "#FFFFFF", fontSize: fontSize.xs },
  title:    { fontFamily: fonts.display, color: "#FFFFFF", fontSize: fontSize.xxl, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.sans, color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm },
  desc:     { fontFamily: fonts.sans, color: "rgba(255,255,255,0.85)", fontSize: fontSize.base, lineHeight: 22 },
  score:    { fontFamily: fonts.sansSemiBold, color: colors.gold, fontSize: fontSize.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    borderWidth:       1.5,
    borderColor:       "rgba(255,255,255,0.4)",
    borderRadius:      radius.full,
    paddingVertical:   12,
  },
  actionBtnText:        { fontFamily: fonts.sansSemiBold, color: "#FFFFFF", fontSize: fontSize.base },
  actionBtnPrimary:     { backgroundColor: TEAL, borderColor: TEAL },
  actionBtnTextPrimary: { fontFamily: fonts.sansBold, color: "#FFFFFF", fontSize: fontSize.base },
});

const sectionS = StyleSheet.create({
  wrap: { paddingVertical: spacing.md },
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: spacing.md,
    marginBottom:      spacing.sm,
  },
  title:    { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text },
  subtitle: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },
});

const hotspotS = StyleSheet.create({
  card: {
    width:            240,
    backgroundColor:  colors.card,
    borderRadius:     radius.lg,
    overflow:         "hidden",
    borderWidth:      1,
    borderColor:      colors.border,
    ...shadow.sm,
  },
  heroWrap: { position: "relative" },
  hero:     { width: "100%" as never, height: 130, alignItems: "center", justifyContent: "center" },
  mapPlaceholder: { backgroundColor: colors.accentLight, gap: 4 },
  mapCoords: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  scoreBadge: {
    position:         "absolute",
    top:              spacing.xs,
    right:            spacing.xs,
    backgroundColor:  "rgba(0,0,0,0.55)",
    borderRadius:     radius.full,
    paddingHorizontal: 8,
    paddingVertical:  3,
  },
  scoreText:   { fontFamily: fonts.sansSemiBold, color: "#FFFFFF", fontSize: fontSize.xs },
  body:        { padding: spacing.sm, gap: 4 },
  meta:        { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  name:        { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.text, letterSpacing: -0.3 },
  desc:        { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, lineHeight: 18 },
  dist:        { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs, color: TEAL },
  contextPill: {
    alignSelf:        "flex-start",
    backgroundColor:  colors.oceanLight,
    borderRadius:     radius.full,
    paddingHorizontal: 8,
    paddingVertical:  2,
    marginTop:        2,
  },
  contextText: { fontFamily: fonts.sansSemiBold, color: colors.oceanMid, fontSize: fontSize.xs },
  actions:     { flexDirection: "row", marginTop: spacing.xs },
  addBtn: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              4,
    borderWidth:      1,
    borderColor:      TEAL,
    borderRadius:     radius.full,
    paddingHorizontal: 10,
    paddingVertical:  5,
  },
  addBtnText: { fontFamily: fonts.sansSemiBold, color: TEAL, fontSize: fontSize.xs },
});

const editorialS = StyleSheet.create({
  card: {
    marginHorizontal:  spacing.md,
    marginVertical:    spacing.sm,
    backgroundColor:   colors.card,
    borderRadius:      radius.xl,
    overflow:          "hidden",
    borderWidth:       1,
    borderColor:       colors.border,
    ...shadow.md,
  },
  hero:    { width: "100%" as never, height: 200, alignItems: "center", justifyContent: "center" },
  saveBtn: {
    position:         "absolute",
    top:              spacing.sm,
    right:            spacing.sm,
    backgroundColor:  "rgba(0,0,0,0.45)",
    borderRadius:     radius.full,
    padding:          spacing.xs,
  },
  body:    { padding: spacing.md, gap: spacing.sm },
  byline:  { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  bylineAvatar: {
    width:            26,
    height:           26,
    borderRadius:     13,
    backgroundColor:  TEAL,
    alignItems:       "center",
    justifyContent:   "center",
  },
  bylineName:   { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.text },
  bylineRegion: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted },
  title:        { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.4 },
  subtitle:     { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },
  body_:        { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
  footer:       { flexDirection: "row", gap: spacing.md },
  footerMeta:   { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
});

const friendS = StyleSheet.create({
  card: {
    marginHorizontal:  spacing.md,
    marginVertical:    spacing.xs,
    backgroundColor:   colors.card,
    borderRadius:      radius.lg,
    overflow:          "hidden",
    borderWidth:       1,
    borderColor:       colors.border,
    ...shadow.sm,
  },
  photo:      { width: "100%" as never, height: 180 },
  body:       { padding: spacing.sm, gap: 4 },
  authorRow:  { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
  avatar: {
    width:            36,
    height:           36,
    borderRadius:     18,
    backgroundColor:  colors.accent,
    alignItems:       "center",
    justifyContent:   "center",
  },
  avatarText: { fontFamily: fonts.sansBold, color: "#FFFFFF", fontSize: fontSize.base },
  author:     { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.text },
  meta:       { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  name:       { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.text },
  loc:        { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  rating:     { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.gold },
  notes:      { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  actions:    { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  actionBtn:  { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
});

const emptyS = StyleSheet.create({
  wrap: {
    flex:              1,
    justifyContent:    "center",
    alignItems:        "center",
    paddingHorizontal: spacing.lg,
    backgroundColor:   colors.bg,
  },
  card: {
    width:            "100%" as never,
    backgroundColor:  colors.card,
    borderRadius:     radius.xl,
    overflow:         "hidden",
    borderWidth:      1.5,
    borderColor:      colors.border,
    ...shadow.md,
  },
  imgWrap: {
    margin:           8,
    borderRadius:     14,
    overflow:         "hidden",
    backgroundColor:  colors.border,
  },
  img:  { width: "100%" as never, height: 220 },
  text: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.4 },
  sub:   { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted, lineHeight: 22 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.full,
    paddingVertical: 14,
    marginTop:       spacing.xs,
    alignItems:      "center",
  },
  btnText: { fontFamily: fonts.sansBold, color: "#FFFFFF", fontSize: fontSize.base },
});

const modalS = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position:         "absolute",
    bottom:           0,
    left:             0,
    right:            0,
    backgroundColor:  colors.card,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:          spacing.lg,
    gap:              spacing.sm,
    paddingBottom:    spacing.xxl,
  },
  handle: {
    alignSelf:        "center",
    width:            40,
    height:           4,
    borderRadius:     2,
    backgroundColor:  colors.border,
    marginBottom:     spacing.sm,
  },
  heading: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.text, marginBottom: spacing.xs },
  empty:   { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
  tripRow: {
    flexDirection:    "row",
    alignItems:       "center",
    padding:          spacing.sm,
    borderRadius:     radius.md,
    borderWidth:      1,
    borderColor:      colors.border,
    gap:              spacing.sm,
  },
  tripRowAdded: { borderColor: TEAL, backgroundColor: colors.oceanLight },
  tripTitle: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.text },
  tripSub:   { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  cancel: {
    alignItems:       "center",
    paddingVertical:  spacing.sm,
    marginTop:        spacing.xs,
  },
  cancelText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.muted },
});
