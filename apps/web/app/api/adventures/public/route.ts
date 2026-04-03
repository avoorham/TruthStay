import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/adventures/public
// No auth required — public endpoint for the Explore screen.
//
// Optional query params:
//   activity=cycling,hiking
//   region=France
//   budget=mid
//   level=advanced
//   rating=4.0
//   duration_min=3
//   duration_max=10

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const db = createAdminClient();

  const limit  = Math.min(parseInt(searchParams.get("limit")  ?? "50", 10) || 50, 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0",  10) || 0,  0);

  let query = db
    .from("adventures")
    .select(`
      id, title, description, region, "activityType", "durationDays",
      "startDate", "isSaved", "createdAt",
      level, budget, rating, "ratingCount", "coverImageUrl", meta,
      adventure_days (
        id, "dayNumber", title, description,
        "distanceKm", "elevationGainM", "routeNotes", "komootTourId", alternatives
      )
    `)
    .eq("isPublic", true)
    .order("rating", { ascending: false })
    .range(offset, offset + limit - 1);

  // Activity filter (comma-separated)
  const activity = searchParams.get("activity");
  if (activity) {
    const acts = activity.split(",").map(a => a.trim()).filter(Boolean);
    if (acts.length === 1) {
      query = query.eq("activityType", acts[0]);
    } else if (acts.length > 1) {
      query = query.in("activityType", acts);
    }
  }

  // Region filter (partial match)
  const region = searchParams.get("region");
  if (region) query = query.ilike("region", `%${region}%`);

  // Budget
  const budget = searchParams.get("budget");
  if (budget) query = query.eq("budget", budget);

  // Level
  const level = searchParams.get("level");
  if (level) query = query.eq("level", level);

  // Min rating
  const rating = parseFloat(searchParams.get("rating") ?? "");
  if (!isNaN(rating)) query = query.gte("rating", rating);

  // Duration range
  const dMin = parseInt(searchParams.get("duration_min") ?? "");
  const dMax = parseInt(searchParams.get("duration_max") ?? "");
  if (!isNaN(dMin)) query = query.gte("durationDays", dMin);
  if (!isNaN(dMax)) query = query.lte("durationDays", dMax);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalise adventure_days key casing for mobile client
  const normalised = (data ?? []).map(adv => ({
    ...adv,
    adventure_days: ((adv.adventure_days as unknown[]) ?? []).map((day: unknown) => { const d = day as Record<string, unknown>; return {
      id:             d.id,
      dayNumber:      d.dayNumber,
      title:          d.title,
      description:    d.description,
      distanceKm:     d.distanceKm,
      elevationGainM: d.elevationGainM,
      routeNotes:     d.routeNotes,
      komootTourId:   d.komootTourId,
      alternatives:   d.alternatives,
    }; }),
  }));

  return NextResponse.json(normalised);
}
