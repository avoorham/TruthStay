import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding, entryToText, type ContentEntryInput } from "@/lib/embeddings";
import type { GeneratedAdventure, DayAlternativesMap, AccommodationStop } from "@/lib/agent/adventure-agent";
import type { DraftMeta } from "@/lib/agent/public-adventure-team";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 1. Load draft
  const { data: draft, error: draftErr } = await db
    .from("public_adventure_drafts")
    .select("*")
    .eq("id", id)
    .eq("status", "draft")
    .single();

  if (draftErr || !draft) {
    return NextResponse.json({ error: "Draft not found or already processed" }, { status: 404 });
  }

  const adventure    = draft.adventure    as GeneratedAdventure;
  const dayAlt       = draft.day_alternatives as DayAlternativesMap;
  const accomStops   = draft.accommodation_stops as AccommodationStop[];
  const meta         = draft.meta        as DraftMeta;
  const slot         = draft.slot        as { activity: string; budget: string; level: string };

  // Map activity types not in the DB enum to valid values
  const ACTIVITY_MAP: Record<string, string> = { mtb: "cycling", gravel: "cycling" };
  const activityType = ACTIVITY_MAP[adventure.activity_type] ?? adventure.activity_type;

  // 2. Resolve a valid userId — admin accounts may not have a public.users row
  // Use the admin's own ID if it exists in public.users, otherwise use the first available user
  const { data: userRow } = await db.from("users").select("id").eq("id", user.id).single();
  const adventureUserId = userRow?.id ?? (await db.from("users").select("id").limit(1).single()).data?.id;
  if (!adventureUserId) return NextResponse.json({ error: "No valid user found to assign adventure" }, { status: 500 });

  // 3. Insert into adventures as public
  const { data: advRow, error: advErr } = await db
    .from("adventures")
    .insert({
      userId:       adventureUserId,
      title:        adventure.title,
      description:  adventure.description,
      region:       adventure.region,
      activityType: activityType,
      durationDays: adventure.duration_days,
      startDate:    null,
      requestPrompt: `public:${slot.activity}:${adventure.region}`,
      isSaved:      true,
      isPublic:     true,
      level:        slot.level,
      budget:       slot.budget,
      rating:       0,
      ratingCount:  0,
      meta,
    })
    .select("id")
    .single();

  if (advErr || !advRow) {
    console.error("[admin/approve] Insert adventure error:", advErr?.message);
    return NextResponse.json({ error: "Failed to create adventure" }, { status: 500 });
  }

  const adventureId = advRow.id as string;

  // 3. Insert adventure_days with alternatives
  for (const day of adventure.days) {
    const alternatives = dayAlt[String(day.day_number)] ?? {};
    const accomStop = accomStops.find(s => s.night_numbers.includes(day.day_number));

    await db.from("adventure_days").insert({
      adventureId,
      dayNumber:      day.day_number,
      title:          day.title,
      description:    day.description,
      distanceKm:     day.distance_km,
      elevationGainM: day.elevation_gain_m,
      routeNotes:     day.route_notes,
      alternatives: {
        ...alternatives,
        accommodationStop: accomStop ?? null,
      },
    });
  }

  // 4. Auto-submit content entries to RAG (best-effort)
  try {
    const region       = adventure.region;
    const activityType = adventure.activity_type;

    const toSubmit: (ContentEntryInput & { source_adventure_id: string })[] = [];

    // Routes: one entry per day
    for (const day of adventure.days) {
      if (day.route_notes) {
        toSubmit.push({
          type: "route", name: day.title, region, activity_type: activityType,
          description: `${day.description} ${day.route_notes}`,
          data: {
            ...(day.distance_km      ? { distance_km: day.distance_km }           : {}),
            ...(day.elevation_gain_m ? { elevation_gain_m: day.elevation_gain_m } : {}),
          },
          source_adventure_id: adventureId,
        });
      }
    }

    // Accommodation options
    for (const stop of accomStops) {
      for (const opt of stop.options ?? []) {
        toSubmit.push({
          type: "accommodation", name: opt.name, region, activity_type: activityType,
          description: opt.description,
          data: {
            accommodation_type:    opt.type,
            price_per_night_eur:   opt.price_per_night_eur,
            sport_friendly_notes:  opt.description,
          },
          source_adventure_id: adventureId,
        });
      }
    }

    // Restaurants from day_alternatives
    for (const [, altData] of Object.entries(dayAlt)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rests = (altData as any).restaurants as Array<Record<string, unknown>> | undefined;
      if (!rests) continue;
      for (const r of rests) {
        toSubmit.push({
          type: "restaurant", name: String(r.name ?? "Restaurant"), region,
          activity_type: null, description: String(r.notes ?? r.location_note ?? ""),
          data: {
            cuisine:     r.cuisine,
            price_range: r.price_range,
            notes:       r.notes,
          },
          source_adventure_id: adventureId,
        });
      }
    }

    for (const entry of toSubmit) {
      try {
        const embedding = await generateEmbedding(entryToText(entry));
        const { data: inserted } = await db
          .from("content_entries")
          .insert({
            type:                entry.type,
            name:                entry.name,
            region:              entry.region,
            activity_type:       entry.activity_type ?? null,
            description:         entry.description ?? null,
            data:                entry.data ?? {},
            submitted_by:        adventureUserId,
            source_adventure_id: entry.source_adventure_id,
            upvotes:             1,
            embedding:           `[${embedding.join(",")}]`,
          })
          .select("id").single();

        if (inserted?.id) {
          await db.from("content_upvotes").insert({ entry_id: inserted.id, user_id: adventureUserId });
        }
      } catch { /* skip non-critical */ }
    }
  } catch { /* content submission failure must not block approval */ }

  // 5. Mark draft as approved
  await db
    .from("public_adventure_drafts")
    .update({ status: "approved", approved_at: new Date().toISOString(), adventure_id: adventureId })
    .eq("id", id);

  return NextResponse.json({ adventure_id: adventureId, title: adventure.title });
}
