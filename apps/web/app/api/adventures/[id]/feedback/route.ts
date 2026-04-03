import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: adventureId } = await params;

  let body: {
    dayNumber: number;
    routeRating?: number;
    accommodationRating?: number;
    restaurantRating?: number;
    notes?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.dayNumber || body.dayNumber < 1) {
    return NextResponse.json({ error: "dayNumber must be >= 1" }, { status: 400 });
  }

  const ratings = [body.routeRating, body.accommodationRating, body.restaurantRating];
  if (ratings.some(r => r !== undefined && (r < 1 || r > 5))) {
    return NextResponse.json({ error: "Ratings must be between 1 and 5" }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Upsert feedback row
  const { error: fbErr } = await db
    .from("adventure_feedback")
    .upsert({
      adventureId,
      userId:              user.id,
      dayNumber:           body.dayNumber,
      routeRating:         body.routeRating         ?? null,
      accommodationRating: body.accommodationRating ?? null,
      restaurantRating:    body.restaurantRating    ?? null,
      notes:               body.notes               ?? null,
    }, { onConflict: "adventureId,userId,dayNumber" });

  if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 });

  // 2. Recalculate adventure rating from all feedback (best-effort)
  try {
    const { data: allFb } = await db
      .from("adventure_feedback")
      .select("routeRating, accommodationRating, restaurantRating")
      .eq("adventureId", adventureId);

    if (allFb && allFb.length > 0) {
      const scores = allFb.flatMap(f => [
        f.routeRating, f.accommodationRating, f.restaurantRating,
      ]).filter((n): n is number => n != null);

      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        await db
          .from("adventures")
          .update({ rating: parseFloat(avg.toFixed(2)), ratingCount: allFb.length })
          .eq("id", adventureId);
      }
    }
  } catch { /* non-critical */ }

  // 3. Auto-upvote content entries linked to this adventure if any rating >= 4
  const highRating =
    (body.routeRating         ?? 0) >= 4 ||
    (body.accommodationRating ?? 0) >= 4 ||
    (body.restaurantRating    ?? 0) >= 4;

  if (highRating) {
    try {
      const { data: entries } = await db
        .from("content_entries")
        .select("id")
        .eq("source_adventure_id", adventureId);

      for (const entry of entries ?? []) {
        try { await db.rpc("add_content_upvote", { p_entry_id: entry.id, p_user_id: user.id }); } catch { /* non-critical */ }
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ ok: true });
}
