import { supabase } from "./supabase";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

// ─── Adventures list ─────────────────────────────────────────────────────────

export async function getMyAdventures() {
  const res = await fetch(`${BASE}/api/adventures`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<AdventureRow[]>;
}

export async function getAdventureById(id: string): Promise<AdventureRow> {
  const res = await fetch(`${BASE}/api/adventures/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<AdventureRow>;
}

export async function shareAdventurePublic(id: string) {
  const res = await fetch(`${BASE}/api/adventures/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ isSaved: true, isPublic: true }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateAdventure(
  id: string,
  fields: { title?: string; startDate?: string | null; description?: string },
) {
  const res = await fetch(`${BASE}/api/adventures/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface CreateAdventureInput {
  title:       string;
  region:      string;
  activityType: string;
  durationDays: number;
  startDate?:  string | null;
  description?: string;
  isPublic?:   boolean;
  days?: Array<{
    dayNumber:      number;
    title:          string;
    description?:   string;
    distanceKm?:    number | null;
    elevationGainM?: number | null;
  }>;
}

export async function createAdventure(input: CreateAdventureInput): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/adventures`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function forkAdventure(sourceId: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/adventures/${sourceId}/fork`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteAdventure(id: string) {
  const res = await fetch(`${BASE}/api/adventures/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function moveActivity(
  adventureId: string,
  fromDay: number,
  toDay: number,
  activityType: "restaurant" | "accommodation",
  activityIndex: number,
) {
  const res = await fetch(`${BASE}/api/adventures/${adventureId}/move-activity`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ fromDay, toDay, activityType, activityIndex }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function updateTileOrder(
  adventureId: string,
  dayNumber: number,
  tileOrder: string[],
): Promise<void> {
  try {
    await fetch(`${BASE}/api/adventures/${adventureId}/reorder-tiles`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ dayNumber, tileOrder }),
    });
  } catch { /* non-fatal */ }
}

// ─── Public adventures ────────────────────────────────────────────────────────

export interface PublicAdventureFilters {
  activity?:     string;   // comma-separated e.g. "cycling,hiking"
  region?:       string;
  budget?:       "budget" | "mid" | "luxury";
  level?:        "beginner" | "intermediate" | "advanced";
  rating?:       number;
  duration_min?: number;
  duration_max?: number;
}

export async function getPublicAdventures(filters?: PublicAdventureFilters): Promise<PublicAdventureRow[]> {
  const params = new URLSearchParams();
  if (filters?.activity)     params.set("activity",     filters.activity);
  if (filters?.region)       params.set("region",       filters.region);
  if (filters?.budget)       params.set("budget",       filters.budget);
  if (filters?.level)        params.set("level",        filters.level);
  if (filters?.rating != null) params.set("rating",     String(filters.rating));
  if (filters?.duration_min != null) params.set("duration_min", String(filters.duration_min));
  if (filters?.duration_max != null) params.set("duration_max", String(filters.duration_max));

  const qs  = params.toString();
  const res = await fetch(`${BASE}/api/adventures/public${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PublicAdventureRow[]>;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface DayFeedbackInput {
  dayNumber:            number;
  routeRating?:         number; // 1-5
  accommodationRating?: number; // 1-5
  restaurantRating?:    number; // 1-5
  notes?:               string;
}

export async function submitDayFeedback(adventureId: string, feedback: DayFeedbackInput): Promise<void> {
  try {
    await fetch(`${BASE}/api/adventures/${adventureId}/feedback`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(feedback),
    });
  } catch { /* non-fatal */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdventureDayRow {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  routeNotes: string | null;
  komootTourId: string | null;
  alternatives: {
    restaurants?: Array<{ name: string; cuisine?: string; price_range?: string; notes?: string; location_note?: string; website_url?: string; thefork_url?: string; google_maps_url?: string }>;
    accommodationStop?: { options?: Array<{ name: string; type?: string; price_per_night_eur?: number; description?: string; booking_url?: string }> } | null;
    tileOrder?: string[];
    customItems?: CustomItem[];
    [key: string]: unknown;
  } | null;
}

export interface CustomItem {
  id: string;
  name: string;
  type: "stay" | "restaurant" | "activity";
  location?: string | null;
  photos?: string[];
  notes?: string | null;
  rating?: number | null;
  sourceUrl?: string | null;
}

export interface AdventureRow {
  id: string;
  title: string;
  description: string;
  region: string;
  activityType: string;
  durationDays: number;
  startDate: string | null;
  endDate?: string | null;
  isSaved: boolean;
  isPublic?: boolean; // only present for the owner
  createdAt: string;
  coverImageUrl?: string | null;
  meta?: { coords?: [number, number]; country?: string; [key: string]: unknown } | null;
  adventure_days: AdventureDayRow[];
  destinations?: { name: string; hero_photo_url: string | null }[];
}

export interface PublicAdventureMeta {
  [key: string]: unknown;
  coords?:       [number, number];
  country?:      string;
  tags?:         string[];
  avgDistanceKm?: number | null;
  avgElevationM?: number | null;
}

export interface PublicAdventureRow extends AdventureRow {
  level:         "beginner" | "intermediate" | "advanced" | null;
  budget:        "budget" | "mid" | "luxury" | null;
  rating:        number;
  ratingCount:   number;
  coverImageUrl: string | null;
  meta:          PublicAdventureMeta | null;
}

// ─── Feed types ───────────────────────────────────────────────────────────────

export interface FeedAuthor {
  id:           string;
  username:     string;
  display_name: string;
  avatar_url:   string | null;
}

export interface FeedAdventure {
  id:            string;
  title:         string;
  description:   string;
  region:        string;
  activityType:  string;
  durationDays:  number;
  level:         string | null;
  coverImageUrl: string | null;
  createdAt:     string;
  userId:        string;
  adventure_days: { id: string; dayNumber: number; title: string }[];
}

export interface PostRow {
  id:          string;
  userId:      string;
  body:        string;
  mediaUrls:   string[];
  adventureId: string | null;
  dayNumber:   number | null;
  createdAt:   string;
}

export interface FeedSocial {
  likeCount:    number;
  commentCount: number;
  isLiked:      boolean;
  isBookmarked: boolean;
}

export type FeedItem =
  | ({ type: "adventure"; adventure: FeedAdventure; author: FeedAuthor; created_at: string } & FeedSocial)
  | ({ type: "post";      post: PostRow;            author: FeedAuthor; created_at: string } & FeedSocial);

// ─── Feed API ─────────────────────────────────────────────────────────────────

export async function getFeed(cursor?: string): Promise<{ items: FeedItem[]; empty: boolean }> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await fetch(`${BASE}/api/feed${qs}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createPost(data: {
  adventure_id?: string;
  day_number?:   number;
  caption:       string;
  media_urls:    string[];
}): Promise<PostRow> {
  const res = await fetch(`${BASE}/api/posts`, {
    method:  "POST",
    headers: await authHeaders(),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getFollows(): Promise<FeedAuthor[]> {
  const res = await fetch(`${BASE}/api/follows`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { following: FeedAuthor[] };
  return data.following;
}

export async function followUser(userId: string): Promise<void> {
  await fetch(`${BASE}/api/follows/${userId}`, { method: "POST", headers: await authHeaders() });
}

export async function unfollowUser(userId: string): Promise<void> {
  await fetch(`${BASE}/api/follows/${userId}`, { method: "DELETE", headers: await authHeaders() });
}

export async function getProfileStats(): Promise<{ trips: number; posts: number; followers: number; following: number }> {
  const res = await fetch(`${BASE}/api/profile/stats`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchUsers(q: string): Promise<FeedAuthor[]> {
  const qs = q.length >= 2 ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${BASE}/api/users/search${qs}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { users: FeedAuthor[] };
  return data.users;
}

// ─── Social: likes ────────────────────────────────────────────────────────────

export async function likeFeedItem(type: "adventure" | "post", id: string): Promise<void> {
  await fetch(`${BASE}/api/feed/like`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ type, id }),
  });
}

export async function unlikeFeedItem(type: "adventure" | "post", id: string): Promise<void> {
  await fetch(`${BASE}/api/feed/like`, {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ type, id }),
  });
}

// ─── Social: bookmarks ────────────────────────────────────────────────────────

export async function bookmarkAdventure(adventureId: string): Promise<void> {
  await fetch(`${BASE}/api/feed/bookmark`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ adventureId }),
  });
}

export async function unbookmarkAdventure(adventureId: string): Promise<void> {
  await fetch(`${BASE}/api/feed/bookmark`, {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ adventureId }),
  });
}

export interface BookmarkedAdventure {
  id:            string;
  title:         string;
  region:        string;
  activityType:  string;
  durationDays:  number;
  coverImageUrl: string | null;
  level:         string | null;
  rating:        number;
}

export async function getBookmarkedAdventures(): Promise<BookmarkedAdventure[]> {
  const res = await fetch(`${BASE}/api/feed/bookmark`, { headers: await authHeaders() });
  if (!res.ok) return [];
  const data = await res.json() as { bookmarks: BookmarkedAdventure[] };
  return data.bookmarks;
}

// ─── Social: comments ─────────────────────────────────────────────────────────

export interface FeedComment {
  id:        string;
  body:      string;
  createdAt: string;
  author: {
    username:    string;
    displayName: string;
    avatarUrl:   string | null;
  };
}

export async function getAdventureComments(adventureId: string): Promise<FeedComment[]> {
  const res = await fetch(
    `${BASE}/api/adventures/comments?adventureId=${encodeURIComponent(adventureId)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { comments: FeedComment[] };
  return data.comments;
}

export async function createAdventureComment(adventureId: string, body: string): Promise<FeedComment> {
  const res = await fetch(`${BASE}/api/adventures/comments`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ adventureId, body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<FeedComment>;
}

export async function getPostComments(postId: string): Promise<FeedComment[]> {
  const res = await fetch(`${BASE}/api/posts/${encodeURIComponent(postId)}/comments`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { comments: FeedComment[] };
  return data.comments;
}

export async function createPostComment(postId: string, body: string): Promise<FeedComment> {
  const res = await fetch(`${BASE}/api/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<FeedComment>;
}

// ─── Collaborators ────────────────────────────────────────────────────────────

export interface Collaborator {
  id:         string;
  permission: "editor" | "viewer";
  createdAt:  string;
  user: {
    id:          string;
    username:    string;
    displayName: string;
    avatarUrl:   string | null;
  };
}

export async function getCollaborators(adventureId: string): Promise<Collaborator[]> {
  const res = await fetch(`${BASE}/api/adventures/${adventureId}/collaborators`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { collaborators: Collaborator[] };
  return data.collaborators;
}

export async function inviteCollaborator(adventureId: string, email: string, permission: "editor" | "viewer" = "viewer"): Promise<void> {
  const res = await fetch(`${BASE}/api/adventures/${adventureId}/collaborators`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ email, permission }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export async function updateCollaboratorPermission(adventureId: string, userId: string, permission: "editor" | "viewer"): Promise<void> {
  const res = await fetch(`${BASE}/api/adventures/${adventureId}/collaborators`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ userId, permission }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function removeCollaborator(adventureId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/adventures/${adventureId}/collaborators`, {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── Interaction tracking ─────────────────────────────────────────────────────

export interface InteractionPayload {
  interaction_type:      "viewed" | "selected" | "saved" | "replaced" | "skipped" | "rated_up" | "rated_down" | "shared";
  adventure_id?:         string | null;
  content_entry_id?:     string | null;
  session_id?:           string | null;
  session_query?:        string | null;
  session_region?:       string | null;
  session_activity_type?: string | null;
  session_vacation_type?: string | null;
  day_number?:           number | null;
  alternative_index?:    number | null;
  replaced_by_entry_id?: string | null;
  dwell_time_seconds?:   number | null;
}

export async function logInteraction(
  payload: InteractionPayload | InteractionPayload[],
): Promise<void> {
  try {
    await fetch(`${BASE}/api/interactions`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
  } catch { /* interaction logging must never throw */ }
}

// ─── Custom day items ─────────────────────────────────────────────────────────

export async function updateDayCustomItems(adventureId: string, dayNumber: number, customItems: CustomItem[]): Promise<void> {
  // Get current alternatives for this day
  const { data, error: fetchErr } = await supabase
    .from("adventure_days")
    .select("id, alternatives")
    .eq("adventureId", adventureId)
    .eq("dayNumber", dayNumber)
    .single();
  if (fetchErr || !data) throw new Error(fetchErr?.message ?? "Day not found");

  const current = (data.alternatives as Record<string, unknown>) ?? {};
  const { error } = await supabase
    .from("adventure_days")
    .update({ alternatives: { ...current, customItems } })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
}

// ─── Activity posts (vacation feed) ──────────────────────────────────────────

export interface ActivityPostInput {
  adventure_id: string;
  user_email: string;
  item_name: string;
  item_type: "route" | "accommodation" | "restaurant" | "custom";
  day_number: number;
  photos: string[];
  notes?: string | null;
  rating?: number | null;
  location?: string | null;
}

export interface ActivityPostRow {
  id: string;
  created_date: string;
  trip_id: string;
  user_email: string;
  item_name: string;
  item_type: string;
  day_number: number;
  photos: string[];
  notes: string | null;
  rating: number | null;
  location: string | null;
}

export async function createActivityPost(input: ActivityPostInput): Promise<void> {
  const { error } = await supabase.from("activity_posts").insert({
    trip_id: input.adventure_id,
    user_email: input.user_email,
    item_name: input.item_name,
    item_type: input.item_type,
    day_number: input.day_number,
    photos: input.photos,
    notes: input.notes ?? null,
    rating: input.rating ?? null,
    location: input.location ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getActivityPosts(followedEmails: string[], myEmail: string): Promise<ActivityPostRow[]> {
  const { data, error } = await supabase
    .from("activity_posts")
    .select("*")
    .in("user_email", [...followedEmails, myEmail])
    .order("created_date", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityPostRow[];
}

export async function updateAdventureEndDate(adventureId: string, endDate: string | null): Promise<void> {
  const { error } = await supabase
    .from("adventures")
    .update({ endDate })
    .eq("id", adventureId);
  if (error) throw new Error(error.message);
}

// ─── Public restaurants ───────────────────────────────────────────────────────

export interface PublicRestaurant {
  name:           string;
  cuisine:        string;
  priceRange:     string;
  coords:         [number, number];
  adventureId:    string;
  adventureTitle: string;
  region:         string;
}

export async function getPublicRestaurants(query?: string): Promise<PublicRestaurant[]> {
  const qs  = query ? `?q=${encodeURIComponent(query)}` : "";
  const res = await fetch(`${BASE}/api/restaurants/public${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PublicRestaurant[]>;
}

export interface PublicActivity {
  title:          string;
  activityType:   string;
  difficulty:     string;
  distanceKm:     number | null;
  elevationM:     number | null;
  coords:         [number, number];
  adventureId:    string;
  adventureTitle: string;
  region:         string;
}

export async function getPublicActivities(type?: string): Promise<PublicActivity[]> {
  const qs  = type ? `?type=${encodeURIComponent(type)}` : "";
  const res = await fetch(`${BASE}/api/activities/public${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PublicActivity[]>;
}

// ─── Explore content entries ──────────────────────────────────────────────────

export interface ExploreContentEntry {
  id:            string;
  type:          string;
  name:          string;
  region:        string;
  activity_type: string | null;
  description:   string | null;
  data:          Record<string, unknown>;
  trust_score:   number | null;
  coords:        [number, number];
}

export async function getExploreContentEntries(opts: {
  type: "accommodation" | "route" | "restaurant" | "activity" | "things_to_do";
  bounds?: { north: number; south: number; east: number; west: number };
  chipSlugs?: string[];
}): Promise<ExploreContentEntry[]> {
  const params = new URLSearchParams({ type: opts.type });
  if (opts.bounds) {
    params.set("north", String(opts.bounds.north));
    params.set("south", String(opts.bounds.south));
    params.set("east",  String(opts.bounds.east));
    params.set("west",  String(opts.bounds.west));
  }
  if (opts.chipSlugs?.length) {
    params.set("chip_slugs", opts.chipSlugs.join(","));
  }
  const res = await fetch(`${BASE}/api/explore/content-entries?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ExploreContentEntry[]>;
}

export interface RegionChip {
  id:         string;
  slug:       string;
  label:      string;
  category:   string;
  sort_order: number;
}

export async function getRegionChips(opts: {
  region: string;
  category: "restaurant" | "things_to_do" | "activity";
}): Promise<RegionChip[]> {
  const params = new URLSearchParams({ region: opts.region, category: opts.category });
  const res = await fetch(`${BASE}/api/discovery/region-chips?${params}`);
  if (!res.ok) return [];
  const data = await res.json() as { chips?: RegionChip[] };
  return data.chips ?? [];
}

// ─── Hotspot feed ─────────────────────────────────────────────────────────────

export interface ContentEntry {
  id:            string;
  type:          string;          // "route" | "accommodation" | "restaurant" | "activity"
  name:          string;
  region:        string;
  activity_type: string | null;
  description:   string | null;
  data:          Record<string, unknown>;
  trust_score:   number | null;
  created_at:    string;
}

export interface HotspotSection {
  section:  string;             // "upcoming_trip" | "nearby" | "for_you" | "recent"
  title:    string;
  subtitle?: string;
  tripId?:  string;
  entries:  ContentEntry[];
}

export interface FeedState {
  hasTrips:   boolean;
  hasFriends: boolean;
}

export interface UpcomingTrip {
  id:        string;
  title:     string;
  region:    string;
  startDate: string;
}

export interface HotspotFeedResponse {
  feed:          HotspotSection[];
  state:         FeedState;
  upcomingTrips: UpcomingTrip[];
}

export async function getHotspotFeed(opts?: { lat?: number; lng?: number }): Promise<HotspotFeedResponse> {
  const params = new URLSearchParams();
  if (opts?.lat != null) params.set("lat", String(opts.lat));
  if (opts?.lng != null) params.set("lng", String(opts.lng));
  const qs  = params.toString();
  const res = await fetch(`${BASE}/api/feed/hotspots${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<HotspotFeedResponse>;
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export interface FeedStory {
  id:               string;
  story_type:       string;
  content_entry_id: string | null;
  activity_post_id: string | null;
  adventure_id:     string | null;
  group_key:        string;
  title:            string | null;
  subtitle:         string | null;
  description:      string | null;
  image_url:        string | null;
  metadata:         Record<string, unknown>;
  context_tag:      string | null;
  context_trip_id:  string | null;
  is_viewed:        boolean;
  is_saved:         boolean;
  expires_at:       string | null;
  created_at:       string;
}

export interface StoryCircle {
  group_key:     string;
  label:         string | null;
  thumbnail_url: string | null;
  has_unviewed:  boolean;
  stories:       FeedStory[];
}

export async function getStoryCircles(): Promise<StoryCircle[]> {
  const res = await fetch(`${BASE}/api/feed/stories`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { circles: StoryCircle[] };
  return data.circles;
}

export async function markStoryViewed(storyId: string): Promise<void> {
  await fetch(`${BASE}/api/feed/stories`, {
    method:  "PATCH",
    headers: await authHeaders(),
    body:    JSON.stringify({ storyId }),
  });
}

export async function dismissStory(storyId: string): Promise<void> {
  await fetch(`${BASE}/api/feed/stories`, {
    method:  "DELETE",
    headers: await authHeaders(),
    body:    JSON.stringify({ storyId }),
  });
}

// ─── Editorial posts ──────────────────────────────────────────────────────────

export interface EditorialPost {
  id:             string;
  title:          string;
  subtitle:       string | null;
  body:           string | null;
  hero_image_url: string | null;
  images:         string[];
  post_type:      string;
  region:         string | null;
  activity_type:  string | null;
  target_audience: Record<string, unknown>;
  published_at:   string | null;
  view_count:     number;
  save_count:     number;
  created_at:     string;
}

export async function getEditorialPosts(): Promise<EditorialPost[]> {
  const res = await fetch(`${BASE}/api/feed/editorial`, { headers: await authHeaders() });
  if (!res.ok) return [];
  const data = await res.json() as { posts: EditorialPost[] };
  return data.posts;
}

// ─── Add to trip ──────────────────────────────────────────────────────────────

export async function addContentEntryToTrip(
  contentEntryId: string,
  adventureId: string,
): Promise<void> {
  const { error } = await supabase.from("adventure_content_links").insert({
    content_entry_id: contentEntryId,
    adventure_id:     adventureId,
  });
  if (error) throw new Error(error.message);
}
