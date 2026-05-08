import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/activities/public
// Returns individual route alternatives extracted from all public adventure days.
// Optional: ?type=hiking|cycling|trail_running|climbing|kayaking|skiing|snowboarding

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "").trim().toLowerCase();

  const db = createAdminClient();

  let query = db
    .from("adventures")
    .select(`
      id, title, region, meta, "activityType",
      adventure_days ( alternatives )
    `)
    .eq("isPublic", true);

  if (type) {
    query = query.eq("activityType", type);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activities: {
    title: string;
    activityType: string;
    difficulty: string;
    distanceKm: number | null;
    elevationM: number | null;
    coords: [number, number];
    adventureId: string;
    adventureTitle: string;
    region: string;
  }[] = [];

  for (const adv of data ?? []) {
    const baseCoords: [number, number] =
      (adv.meta as { coords?: [number, number] } | null)?.coords ?? [0, 0];

    for (const day of (adv.adventure_days as { alternatives: unknown }[] | null) ?? []) {
      const alts = day.alternatives as {
        routes?: {
          title?: string;
          difficulty?: string;
          distance_km?: number | null;
          elevation_gain_m?: number | null;
        }[];
      } | null;

      for (const route of alts?.routes ?? []) {
        const title = route.title ?? "";
        if (!title) continue;

        activities.push({
          title,
          activityType: (adv as { activityType?: string }).activityType ?? "",
          difficulty:   route.difficulty ?? "moderate",
          distanceKm:   route.distance_km ?? null,
          elevationM:   route.elevation_gain_m ?? null,
          coords:       baseCoords,
          adventureId:  adv.id,
          adventureTitle: adv.title,
          region:       adv.region,
        });
      }
    }
  }

  return NextResponse.json(activities);
}
