import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CACHE_TTL_DAYS = 30;

/** Round to 3 dp (~110 m precision) to maximise cache hits. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Haversine distance in km between two lat/lon points. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Flight heuristic: only valid when haversine ≥ 200 km.
 * time = (distance / 800 km/h) + 1.5 hrs airport overhead.
 */
function flightHeuristicSeconds(distanceKm: number): number | null {
  if (distanceKm < 200) return null;
  return Math.round((distanceKm / 800 + 1.5) * 3600);
}

interface RequestBody {
  origin:      { lat: number; lon: number };
  destination: { lat: number; lon: number };
  mode:        "driving" | "flying";
}

type CacheRow = {
  travel_seconds: number;
  fetched_at: string;
};

// POST /api/discovery/travel-time
// Returns cached or freshly-computed travel time between two points.
// When GOOGLE_MAPS_API_KEY is unset, driving falls through to stub response.
// Flying always uses the haversine heuristic — no external API needed.
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { origin, destination, mode } = body;
  if (
    typeof origin?.lat !== "number" || typeof origin?.lon !== "number" ||
    typeof destination?.lat !== "number" || typeof destination?.lon !== "number" ||
    (mode !== "driving" && mode !== "flying")
  ) {
    return Response.json({ error: "origin {lat,lon}, destination {lat,lon}, mode required" }, { status: 400 });
  }

  // Round coordinates to 3 dp for cache key consistency
  const oLat = round3(origin.lat);
  const oLon = round3(origin.lon);
  const dLat = round3(destination.lat);
  const dLon = round3(destination.lon);

  const db = createAdminClient();

  // ── Cache read ──────────────────────────────────────────────────────────────
  const { data: cached } = await db
    .from("travel_time_cache")
    .select("travel_seconds, fetched_at")
    .eq("origin_lat", oLat)
    .eq("origin_lon", oLon)
    .eq("destination_lat", dLat)
    .eq("destination_lon", dLon)
    .eq("mode", mode)
    .maybeSingle();

  const row = cached as CacheRow | null;
  if (row) {
    const ageMs = Date.now() - new Date(row.fetched_at).getTime();
    const staleCutoffMs = CACHE_TTL_DAYS * 86_400_000;
    // Serve cache regardless of age (stale-while-revalidate).
    // Stale entries are refreshed on the NEXT miss — no async worker needed yet.
    if (ageMs < staleCutoffMs) {
      return Response.json({ travel_seconds: row.travel_seconds, source: "cache" });
    }
    // Stale — fall through to re-fetch but still serve stale immediately below
    // by re-checking after write. For simplicity, re-compute then overwrite.
  }

  // ── Compute ─────────────────────────────────────────────────────────────────
  let travelSeconds: number | null = null;
  let source: "api" | "heuristic" | "unavailable" = "unavailable";

  if (mode === "flying") {
    const distKm = haversineKm(oLat, oLon, dLat, dLon);
    const secs = flightHeuristicSeconds(distKm);
    if (secs !== null) {
      travelSeconds = secs;
      source = "heuristic";
    } else {
      // < 200 km — no commercial flight
      return Response.json({ travel_seconds: null, source: "heuristic", reason: "too_short_for_flight" });
    }
  } else {
    // mode === "driving"
    if (!GOOGLE_MAPS_API_KEY) {
      // Stub: graceful degradation — caller should show "—" rather than crash
      return Response.json({ travel_seconds: null, source: "unavailable", reason: "api_key_missing" });
    }

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", `${oLat},${oLon}`);
      url.searchParams.set("destinations", `${dLat},${dLon}`);
      url.searchParams.set("mode", "driving");
      url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

      const res = await fetch(url.toString());
      const json = await res.json() as {
        status: string;
        rows?: Array<{
          elements?: Array<{ status: string; duration?: { value: number } }>;
        }>;
      };

      const el = json.rows?.[0]?.elements?.[0];
      if (el?.status === "OK" && el.duration?.value) {
        travelSeconds = el.duration.value;
        source = "api";
      }
    } catch {
      // Network failure — return unavailable rather than crash
      return Response.json({ travel_seconds: null, source: "unavailable", reason: "api_error" });
    }

    if (travelSeconds === null) {
      return Response.json({ travel_seconds: null, source: "unavailable", reason: "no_route" });
    }
  }

  // ── Cache write ─────────────────────────────────────────────────────────────
  if (travelSeconds !== null) {
    await db.from("travel_time_cache").upsert({
      origin_lat:      oLat,
      origin_lon:      oLon,
      destination_lat: dLat,
      destination_lon: dLon,
      mode,
      travel_seconds:  travelSeconds,
      fetched_at:      new Date().toISOString(),
    }, { onConflict: "origin_lat,origin_lon,destination_lat,destination_lon,mode" });
  }

  return Response.json({ travel_seconds: travelSeconds, source });
}
