import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { generateEmbedding, entryToText, type ContentEntryInput } from "@/lib/embeddings";

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
  const authUser = await getAuthUser(request);
  const isOwner = !!authUser && adv.userId === authUser.id;

  if (!adv.isPublic && !isOwner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const response: Record<string, unknown> = { ...adv, adventure_days };
  if (!isOwner) delete response.isPublic; // only expose isPublic to the owner
  delete response.userId;
  return NextResponse.json(response);
}

// PATCH /api/adventures/[id] — toggle isSaved or publish isPublic
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adventureId } = await params;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { isSaved?: boolean; isPublic?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  const updateFields: Record<string, unknown> = {};
  if (body.isSaved !== undefined) updateFields.isSaved = body.isSaved;
  if (body.isPublic !== undefined) updateFields.isPublic = body.isPublic;

  const { error } = await adminDb
    .from("adventures")
    .update(updateFields)
    .eq("id", adventureId)
    .eq("userId", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // When making an adventure public, auto-index content to RAG (best-effort)
  if (body.isPublic) {
    try {
      const { data: adv } = await adminDb
        .from("adventures")
        .select(`region, "activityType", adventure_days (title, description, "distanceKm", "elevationGainM", "routeNotes", alternatives)`)
        .eq("id", adventureId)
        .single();

      if (adv) {
        const region = adv.region as string;
        const activityType = adv.activityType as string;
        const days = (adv.adventure_days ?? []) as Array<Record<string, unknown>>;

        const toSubmit: (ContentEntryInput & { source_adventure_id: string })[] = [];

        for (const day of days) {
          if (day.routeNotes) {
            toSubmit.push({
              type: "route", name: String(day.title), region, activity_type: activityType,
              description: `${day.description ?? ""} ${day.routeNotes}`,
              data: {
                ...(day.distanceKm      ? { distance_km: day.distanceKm }           : {}),
                ...(day.elevationGainM  ? { elevation_gain_m: day.elevationGainM }  : {}),
              },
              source_adventure_id: adventureId,
            });
          }
          // Accommodation from day alternatives
          const alts = day.alternatives as Record<string, unknown> | null;
          const accomStop = alts?.accommodationStop as Record<string, unknown> | null;
          if (accomStop?.options) {
            for (const opt of accomStop.options as Array<Record<string, unknown>>) {
              toSubmit.push({
                type: "accommodation", name: String(opt.name ?? "Accommodation"), region,
                activity_type: activityType, description: String(opt.description ?? ""),
                data: { accommodation_type: opt.type, price_per_night_eur: opt.price_per_night_eur },
                source_adventure_id: adventureId,
              });
            }
          }
          // Restaurants from day alternatives
          const restaurants = alts?.restaurants as Array<Record<string, unknown>> | undefined;
          if (restaurants) {
            for (const r of restaurants) {
              toSubmit.push({
                type: "restaurant", name: String(r.name ?? "Restaurant"), region,
                activity_type: null, description: String(r.notes ?? r.location_note ?? ""),
                data: { cuisine: r.cuisine, price_range: r.price_range, notes: r.notes },
                source_adventure_id: adventureId,
              });
            }
          }
        }

        for (const entry of toSubmit) {
          try {
            const embedding = await generateEmbedding(entryToText(entry));
            const { data: inserted } = await adminDb
              .from("content_entries")
              .insert({
                type: entry.type, name: entry.name, region: entry.region,
                activity_type: entry.activity_type ?? null,
                description: entry.description ?? null,
                data: entry.data ?? {},
                submitted_by: user.id,
                source_adventure_id: entry.source_adventure_id,
                upvotes: 1,
                embedding: `[${embedding.join(",")}]`,
              })
              .select("id").single();
            if (inserted?.id) {
              await adminDb.from("content_upvotes").insert({ entry_id: inserted.id, user_id: user.id });
            }
          } catch { /* skip non-critical */ }
        }
      }
    } catch { /* RAG indexing failure must not block the response */ }
  }

  return NextResponse.json({ ok: true });
}
