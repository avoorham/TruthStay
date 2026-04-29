import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/adventures/[id]/fork
// Creates a private copy of a public (or owned) adventure for the authenticated user.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  // Resolve the public user record
  const { data: publicUser } = await db
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();

  if (!publicUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch source adventure — must be public OR owned by the requester
  const { data: source, error: srcErr } = await db
    .from("adventures")
    .select(`
      id, title, description, region, "activityType", "durationDays",
      "isPublic", "userId",
      adventure_days (
        "dayNumber", title, description,
        "distanceKm", "elevationGainM", "routeNotes", "komootTourId", alternatives
      )
    `)
    .eq("id", sourceId)
    .single();

  if (srcErr || !source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adv = source as Record<string, unknown>;
  const isOwner = adv.userId === publicUser.id;
  if (!adv.isPublic && !isOwner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create the forked adventure
  const { data: forked, error: forkErr } = await db
    .from("adventures")
    .insert({
      userId:        publicUser.id,
      title:         adv.title,
      region:        adv.region,
      activityType:  adv.activityType,
      durationDays:  adv.durationDays,
      description:   adv.description ?? null,
      requestPrompt: `Forked from adventure ${sourceId}`,
      isSaved:       true,
      isPublic:      false,
    })
    .select("id")
    .single();

  if (forkErr || !forked) {
    return NextResponse.json({ error: forkErr?.message ?? "Failed to create adventure" }, { status: 500 });
  }

  // Copy all days, preserving alternatives (restaurants, accommodations, etc.)
  const sourceDays = (adv.adventure_days as Array<Record<string, unknown>>) ?? [];
  if (sourceDays.length > 0) {
    await db.from("adventure_days").insert(
      sourceDays.map(d => ({
        adventureId:    forked.id,
        dayNumber:      d.dayNumber,
        title:          d.title || `Day ${d.dayNumber}`,
        description:    d.description ?? null,
        distanceKm:     d.distanceKm ?? null,
        elevationGainM: d.elevationGainM ?? null,
        routeNotes:     d.routeNotes ?? null,
        alternatives:   d.alternatives ?? null,
      })),
    );
  }

  return NextResponse.json({ id: forked.id });
}
