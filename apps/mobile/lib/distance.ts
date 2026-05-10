// TODO(design-sweep): distance label colours — review after blue sweep

/** Hours of travel per trip day before the running-total banner goes amber. */
export const TRAVEL_HOURS_PER_DAY_WARNING = 1.5;

/**
 * Returns the warning threshold in seconds for a given trip duration.
 * e.g. 7 days → 37 800 s (10.5 hrs)
 */
export function warningThresholdSeconds(durationDays: number): number {
  return Math.round(durationDays * TRAVEL_HOURS_PER_DAY_WARNING * 3600);
}

/** Format seconds as "Xhr Ymin", e.g. 8100 → "2hr 15min". */
export function formatTravelTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}min`;
}

export interface TravelTimeResult {
  travel_seconds: number | null;
  source: "cache" | "api" | "heuristic" | "unavailable";
  reason?: string;
}

/**
 * Fetch travel time from the discovery API.
 * Returns null travel_seconds if the key is missing or route unavailable —
 * callers should show "—" rather than crash.
 */
export async function fetchTravelTime(
  baseUrl: string,
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  mode: "driving" | "flying",
  authHeaders: Record<string, string>,
): Promise<TravelTimeResult> {
  try {
    const res = await fetch(`${baseUrl}/api/discovery/travel-time`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ origin, destination, mode }),
    });
    if (!res.ok) return { travel_seconds: null, source: "unavailable", reason: "http_error" };
    return (await res.json()) as TravelTimeResult;
  } catch {
    return { travel_seconds: null, source: "unavailable", reason: "network_error" };
  }
}
