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

export async function sendChatMessage(messages: ChatMessage[]) {
  const res = await fetch(`${BASE}/api/adventures/chat`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ messages }),
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

export async function saveAdventure(id: string) {
  const res = await fetch(`${BASE}/api/adventures/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ isSaved: true }),
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
  alternatives: Record<string, unknown> | null;
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
  createdAt: string;
  adventure_days: AdventureDayRow[];
}
