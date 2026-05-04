import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/feed/hotspots?lat=&lng=&page=1
// Returns personalised hotspot feed sections for the mobile feed tab.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(request.url);
  const lat  = parseFloat(searchParams.get("lat")  ?? "0");
  const lng  = parseFloat(searchParams.get("lng")  ?? "0");
  const hasLocation = lat !== 0 && lng !== 0;

  // ── User context ────────────────────────────────────────────────────────────
  const [{ data: prefs }, { data: upcomingTrips }] = await Promise.all([
    db
      .from("user_adventure_preferences")
      .select('*')
      .eq("userId", user.id)
      .maybeSingle(),
    db
      .from("adventures")
      .select('id, title, region, "startDate", "endDate"')
      .eq("userId", user.id)
      .eq("isSaved", true)
      .gt("startDate", new Date().toISOString().slice(0, 10))
      .order("startDate", { ascending: true })
      .limit(5),
  ]);

  const activityTypes: string[] = Array.isArray(
    (prefs as { preferredActivityTypes?: string[] } | null)?.preferredActivityTypes,
  )
    ? ((prefs as { preferredActivityTypes: string[] }).preferredActivityTypes)
    : [];

  const feed: Array<{
    section: string;
    title: string;
    subtitle?: string;
    tripId?: string;
    entries: unknown[];
  }> = [];

  // ── Section: For upcoming trips ─────────────────────────────────────────────
  for (const trip of upcomingTrips ?? []) {
    const t = trip as { id: string; title: string; region: string; startDate: string };
    const firstPart = (t.region.split(",")[0] ?? t.region).trim();
    const { data: entries } = await db
      .from("content_entries")
      .select("id, type, name, region, activity_type, description, data, trust_score, created_at")
      .eq("verified", true)
      .ilike("region", `%${firstPart}%`)
      .order("trust_score", { ascending: false })
      .limit(8);

    if (entries?.length) {
      feed.push({
        section: "upcoming_trip",
        title:   `For your ${t.title}`,
        subtitle: `${t.startDate} · ${t.region}`,
        tripId:  t.id,
        entries: entries,
      });
    }
  }

  // ── Section: Nearby (Haversine via RPC) ─────────────────────────────────────
  if (hasLocation) {
    const { data: nearbyEntries } = await db
      .rpc("get_nearby_content", {
        user_lat:  lat,
        user_lng:  lng,
        radius_km: 150,
      })
      .limit(10);

    if ((nearbyEntries as unknown[])?.length) {
      feed.push({
        section: "nearby",
        title:   "Trending Near You",
        entries: nearbyEntries as unknown[],
      });
    }
  }

  // ── Section: Picked for you ─────────────────────────────────────────────────
  if (activityTypes.length > 0) {
    const { data: personalised } = await db
      .from("content_entries")
      .select("id, type, name, region, activity_type, description, data, trust_score, created_at")
      .eq("verified", true)
      .in("activity_type", activityTypes)
      .order("trust_score", { ascending: false })
      .limit(10);

    if (personalised?.length) {
      feed.push({
        section:  "for_you",
        title:    "Picked For You",
        subtitle: `Because you love ${activityTypes[0]}`,
        entries:  personalised,
      });
    }
  }

  // ── Section: Recently added ─────────────────────────────────────────────────
  const { data: recent } = await db
    .from("content_entries")
    .select("id, type, name, region, activity_type, description, data, trust_score, created_at")
    .eq("verified", true)
    .order("created_at", { ascending: false })
    .limit(10);

  feed.push({
    section: "recent",
    title:   "Recently Added",
    entries: recent ?? [],
  });

  // ── Feed state signals ───────────────────────────────────────────────────────
  const hasTrips = (upcomingTrips?.length ?? 0) > 0;

  // Check follower count using email-based follows table
  const { count: followingCount } = await db
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_email", user.email ?? "");

  const hasFriends = (followingCount ?? 0) > 0;

  return NextResponse.json({
    feed,
    state: {
      hasTrips,
      hasFriends,
    },
    upcomingTrips: (upcomingTrips ?? []).map(t => {
      const r = t as { id: string; title: string; region: string; startDate: string; endDate?: string };
      return { id: r.id, title: r.title, region: r.region, startDate: r.startDate };
    }),
  });
}
