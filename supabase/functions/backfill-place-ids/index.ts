import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_PLACES_COST_PER_CALL = 0.017;
// Loosened from 100m to 500m to capture mountain huts and restaurants where Google resolves to the
// registered address / trailhead, which can be 200-700m from the actual entry point.
const DISTANCE_THRESHOLD_M        = 500;
const DELAY_MS                    = 100;

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function placesTextSearch(
  query:  string,
  apiKey: string,
): Promise<{ place_id: string; lat: number; lng: number; formatted_address: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const res  = await fetch(url);
    const data = await res.json() as {
      results?: Array<{
        place_id?:          string;
        formatted_address?: string;
        geometry?:          { location?: { lat: number; lng: number } };
      }>;
    };
    const r = data.results?.[0];
    if (!r?.geometry?.location || !r.place_id) return null;
    return {
      place_id:          r.place_id,
      lat:               r.geometry.location.lat,
      lng:               r.geometry.location.lng,
      formatted_address: r.formatted_address ?? "",
    };
  } catch {
    return null;
  }
}

Deno.serve(async (_req: Request) => {
  const apiKey     = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not set" }), { status: 500 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  const { data: entries, error: fetchError } = await db
    .from("content_entries")
    .select("id, name, region, data")
    .is("place_id", null)
    .order("created_at");

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  let updated    = 0;
  let skipped    = 0;
  let mismatched = 0;
  let calls      = 0;
  const mismatches: Array<{ id: string; name: string; distance_m: number }> = [];

  for (const entry of (entries ?? [])) {
    const coords = entry.data?.coordinates as { lat?: number; lng?: number } | null;
    const lat    = coords?.lat;
    const lng    = coords?.lng;

    if (!lat || !lng || lat === 0) {
      skipped++;
      continue;
    }

    const query  = `${entry.name} ${entry.region ?? ""}`.trim();
    const result = await placesTextSearch(query, apiKey);
    calls++;

    if (!result) {
      skipped++;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    const distM = haversineMetres(lat, lng, result.lat, result.lng);
    if (distM > DISTANCE_THRESHOLD_M) {
      console.log(`MISMATCH: ${entry.id} "${entry.name}" — stored (${lat},${lng}) vs Google (${result.lat},${result.lng}), distance=${Math.round(distM)}m`);
      mismatches.push({ id: entry.id, name: entry.name, distance_m: Math.round(distM) });
      mismatched++;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    await db
      .from("content_entries")
      .update({ place_id: result.place_id })
      .eq("id", entry.id);

    updated++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  const cost_usd = calls * GOOGLE_PLACES_COST_PER_CALL;

  return new Response(
    JSON.stringify({ updated, skipped, mismatched, calls, cost_usd, mismatches }),
    { headers: { "Content-Type": "application/json" } },
  );
});
