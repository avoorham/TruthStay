import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/gpx
// Body: { parsed: GpxParsed; region?: string; activityType?: string }
// Creates a public single-day adventure from GPX data

interface GpxParsed {
  name: string;
  distance_km: number;
  duration_minutes: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: number;
  min_elevation_m: number;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  waypoints: Array<{ lat: number; lng: number; name?: string; elevation?: number }>;
  track_points: Array<{ lat: number; lng: number; elevation?: number; time?: string }>;
  activity_type: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: publicUser } = await db.from("users").select("id").eq("authId", user.id).maybeSingle();
  if (!publicUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json() as {
    parsed: GpxParsed;
    region?: string;
    activityType?: string;
  };

  const { parsed, region = "Unknown", activityType } = body;
  if (!parsed?.name) return NextResponse.json({ error: "parsed GPX data required" }, { status: 400 });

  const resolvedActivity = activityType ?? parsed.activity_type ?? "hiking";
  const coords: [number, number] | null =
    parsed.start_lat != null && parsed.start_lng != null
      ? [parsed.start_lng, parsed.start_lat]
      : null;

  // Create adventure
  const adventureId = crypto.randomUUID();
  const { error: advErr } = await db.from("adventures").insert({
    id:           adventureId,
    userId:       publicUser.id,
    title:        parsed.name,
    description:  `GPX import: ${parsed.name}. ${parsed.distance_km} km, ${parsed.elevation_gain_m} m elevation gain.`,
    region,
    activityType: resolvedActivity,
    durationDays: 1,
    isSaved:      true,
    isPublic:     true,
    meta:         coords ? { coords, gpx_import: true } : { gpx_import: true },
  });
  if (advErr) return NextResponse.json({ error: advErr.message }, { status: 500 });

  // Create day
  const dayId = crypto.randomUUID();
  const { error: dayErr } = await db.from("adventure_days").insert({
    id:             dayId,
    adventureId,
    dayNumber:      1,
    title:          parsed.name,
    description:    `Distance: ${parsed.distance_km} km · Elevation: +${parsed.elevation_gain_m} m / -${parsed.elevation_loss_m} m`,
    distanceKm:     parsed.distance_km,
    elevationGainM: parsed.elevation_gain_m,
    routeNotes:     parsed.duration_minutes > 0
      ? `Est. duration: ${Math.floor(parsed.duration_minutes / 60)}h ${parsed.duration_minutes % 60}m`
      : null,
    alternatives: {
      gpx: {
        waypoints:        parsed.waypoints,
        track_points:     parsed.track_points.slice(0, 500), // cap to avoid huge rows
        max_elevation_m:  parsed.max_elevation_m,
        min_elevation_m:  parsed.min_elevation_m,
        start_lat:        parsed.start_lat,
        start_lng:        parsed.start_lng,
        end_lat:          parsed.end_lat,
        end_lng:          parsed.end_lng,
      },
    },
  });
  if (dayErr) {
    await db.from("adventures").delete().eq("id", adventureId);
    return NextResponse.json({ error: dayErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, adventureId });
}

// GET /api/admin/gpx — return DB counts
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ count: adventures }, { count: days }] = await Promise.all([
    db.from("adventures").select("*", { count: "exact", head: true }),
    db.from("adventure_days").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({ adventures: adventures ?? 0, adventure_days: days ?? 0 });
}