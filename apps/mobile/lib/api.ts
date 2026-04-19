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

// ─── Adventures chat ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TripSummary {
  title: string;
  activity_type: string;
  region: string;
  duration_days: number;
  start_date: string | null;
  days: { day_number: number; title: string; distance_km: number | null; elevation_gain_m: number | null }[];
}

export async function sendChatMessage(
  messages: ChatMessage[],
  options?: { mode?: "update"; adventure_id?: string; trip_summary?: TripSummary },
) {
  const res = await fetch(`${BASE}/api/adventures/chat`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ messages, ...options }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
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

export async function saveAdventure(id: string) {
  const res = await fetch(`${BASE}/api/adventures/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ isSaved: true }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

export async function reorderActivity(
  adventureId: string,
  dayNumber: number,
  activityType: "restaurant",
  fromIndex: number,
  toIndex: number,
) {
  const res = await fetch(`${BASE}/api/adventures/${adventureId}/reorder-activity`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ dayNumber, activityType, fromIndex, toIndex }),
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

export async function recordSelection(
  adventureId: string,
  dayNumber: number,
  category: "route" | "accommodation",
  selectedIndex: number,
  optionType?: string
) {
  try {
    await fetch(`${BASE}/api/adventures/${adventureId}/select`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ day_number: dayNumber, category, selected_index: selectedIndex, option_type: optionType }),
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
