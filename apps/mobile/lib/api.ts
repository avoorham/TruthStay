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
    restaurants?: Array<{ name: string; cuisine?: string; price_range?: string; notes?: string; location_note?: string }>;
    accommodationStop?: { options?: Array<{ name: string; type?: string; price_per_night_eur?: number; description?: string }> } | null;
    [key: string]: unknown;
  } | null;
}

export interface AdventureRow {
  id: string;
  title: string;
  description: string;
  region: string;
  activityType: string;
  durationDays: number;
  startDate: string | null;
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

export type FeedItem =
  | { type: "adventure"; adventure: FeedAdventure; author: FeedAuthor; created_at: string }
  | { type: "post";      post: PostRow;            author: FeedAuthor; created_at: string };

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
