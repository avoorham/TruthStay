import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/adventures/[id] — fetch a single adventure with days
// Returns if isPublic=true OR authenticated user owns it
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createAdminClient();

  const { data, error } = await db
    .from("adventures")
    .select(`
      id, title, description, region, "activityType", "durationDays",
      "startDate", "isSaved", "createdAt", "coverImageUrl", meta,
      "isPublic", "userId",
      adventure_days (
        id, "dayNumber", title, description,
        "distanceKm", "elevationGainM", "routeNotes", "komootTourId", alternatives
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adv = data as Record<string, unknown>;

  if (!adv.isPublic) {
    const user = await getAuthUser(request);
    if (!user || adv.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const adventure_days = ((adv.adventure_days as unknown[]) ?? []).map((day: unknown) => {
    const d = day as Record<string, unknown>;
    return {
      id:             d.id,
      dayNumber:      d.dayNumber,
      title:          d.title,
      description:    d.description,
      distanceKm:     d.distanceKm,
      elevationGainM: d.elevationGainM,
      routeNotes:     d.routeNotes,
      komootTourId:   d.komootTourId,
      alternatives:   d.alternatives,
    };
  });

  // Strip internal fields before returning
  const { isPublic: _ip, userId: _uid, ...rest } = adv;
  return NextResponse.json({ ...rest, adventure_days });
}

// PATCH /api/adventures/[id] — toggle isSaved
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adventureId } = await params;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { isSaved: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  const { error } = await adminDb
    .from("adventures")
    .update({ isSaved: body.isSaved })
    .eq("id", adventureId)
    .eq("userId", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
