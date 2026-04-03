import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY      = "@truthstay/discover_sessions";
const MAX_KEEP = 20;

export interface StoredSession {
  id:        string;
  createdAt: string;
  title:     string;
  mode:      "new" | "update" | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages:  any[];
  history:   { role: "user" | "assistant"; content: string }[];
}

export async function loadSessions(): Promise<StoredSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession[]) : [];
  } catch {
    return [];
  }
}

export async function upsertSession(session: StoredSession): Promise<void> {
  try {
    const all = await loadSessions();
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      all[idx] = session;
    } else {
      all.unshift(session);
      if (all.length > MAX_KEEP) all.length = MAX_KEEP;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* non-critical */ }
}

export async function removeSession(id: string): Promise<void> {
  try {
    const all = await loadSessions();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(s => s.id !== id)));
  } catch { /* non-critical */ }
}
