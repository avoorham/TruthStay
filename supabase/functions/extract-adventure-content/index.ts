import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient>;

interface AdventureDay {
  id: string;
  dayNumber: number;
  title: string;
  description: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  routeNotes: string | null;
  alternatives: {
    restaurants?: Array<{
      name: string;
      cuisine?: string;
      price_range?: string;
      notes?: string;
    }>;
    accommodationStop?: {
      options?: Array<{
        name: string;
        type?: string;
        price_per_night_eur?: number;
        description?: string;
      }>;
    } | null;
  } | null;
}

interface Adventure {
  id: string;
  region: string;
  activityType: string;
  isSaved: boolean;
  adventure_days: AdventureDay[];
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  adventureId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isDuplicate(
  db: SupabaseClient,
  name: string,
  region: string,
  type: string,
): Promise<string | null> {
  const { data } = await db
    .from("content_entries")
    .select("id")
    .ilike("name", name)
    .ilike("region", `%${region}%`)
    .eq("type", type)
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function upsertContentEntry(
  db: SupabaseClient,
  entry: {
    type: string;
    name: string;
    region: string;
    activity_type: string | null;
    description: string | null;
    data: Record<string, unknown>;
    source_adventure_id: string;
  },
): Promise<void> {
  const existingId = await isDuplicate(db, entry.name, entry.region, entry.type);

  if (existingId) {
    // Entry already exists — increment upvotes as a popularity signal
    await db.rpc("increment_upvotes", { entry_id: existingId }).catch(() => {
      // Fallback: manual increment if the RPC doesn't exist
      db.from("content_entries")
        .select("upvotes")
        .eq("id", existingId)
        .single()
        .then(({ data }) => {
          db.from("content_entries")
            .update({ upvotes: (data?.upvotes ?? 0) + 1 })
            .eq("id", existingId);
        });
    });
    return;
  }

  await db.from("content_entries").insert({
    type:                entry.type,
    name:                entry.name.trim().slice(0, 255),
    region:              entry.region,
    activity_type:       entry.activity_type,
    description:         entry.description,
    data:                entry.data,
    source_type:         "user",
    verified:            true,
    trust_score:         0.3, // base trust for user-sourced content
    upvotes:             1,
    source_adventure_id: entry.source_adventure_id,
  });
}

// ---------------------------------------------------------------------------
// Main extraction logic
// ---------------------------------------------------------------------------

async function extractContentFromAdventure(
  db: SupabaseClient,
  adventureId: string,
): Promise<{ routes: number; accommodations: number; restaurants: number }> {
  const { data: adventureRow, error } = await db
    .from("adventures")
    .select(`
      id, region, "activityType", "isSaved",
      adventure_days(
        id, "dayNumber", title, description, "distanceKm", "elevationGainM", "routeNotes", alternatives
      )
    `)
    .eq("id", adventureId)
    .single();

  if (error || !adventureRow) {
    throw new Error(`Adventure not found: ${adventureId}`);
  }

  const adv = adventureRow as unknown as Adventure;

  if (!adv.isSaved) {
    return { routes: 0, accommodations: 0, restaurants: 0 };
  }

  const counts = { routes: 0, accommodations: 0, restaurants: 0 };

  for (const day of adv.adventure_days ?? []) {
    // ── Extract route from the day ──────────────────────────────────────────
    if (day.title && (day.distanceKm || day.elevationGainM || day.routeNotes)) {
      await upsertContentEntry(db, {
        type:                "route",
        name:                day.title,
        region:              adv.region,
        activity_type:       adv.activityType,
        description:         day.description ?? day.routeNotes,
        data: {
          distanceKm:        day.distanceKm,
          elevationGainM:    day.elevationGainM,
          routeNotes:        day.routeNotes,
          sourceAdventureId: adv.id,
          dayNumber:         day.dayNumber,
        },
        source_adventure_id: adv.id,
      });
      counts.routes++;
    }

    const alts = day.alternatives;
    if (!alts) continue;

    // ── Extract accommodation options ──────────────────────────────────────
    const accOptions = alts.accommodationStop?.options ?? [];
    for (const acc of accOptions) {
      if (!acc.name?.trim()) continue;
      await upsertContentEntry(db, {
        type:                "accommodation",
        name:                acc.name,
        region:              adv.region,
        activity_type:       adv.activityType,
        description:         acc.description ?? null,
        data: {
          accommodation_type:  acc.type,
          price_per_night_eur: acc.price_per_night_eur,
          sourceAdventureId:   adv.id,
          dayNumber:           day.dayNumber,
        },
        source_adventure_id: adv.id,
      });
      counts.accommodations++;
    }

    // ── Extract restaurants ────────────────────────────────────────────────
    for (const rest of alts.restaurants ?? []) {
      if (!rest.name?.trim()) continue;
      await upsertContentEntry(db, {
        type:                "restaurant",
        name:                rest.name,
        region:              adv.region,
        activity_type:       null,
        description:         rest.notes ?? null,
        data: {
          cuisine:           rest.cuisine,
          price_range:       rest.price_range,
          sourceAdventureId: adv.id,
          dayNumber:         day.dayNumber,
        },
        source_adventure_id: adv.id,
      });
      counts.restaurants++;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const { adventureId } = parsed.data;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const counts = await extractContentFromAdventure(db, adventureId);
    return new Response(
      JSON.stringify({ adventureId, status: "ok", ...counts }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ adventureId, error: message }), { status: 500 });
  }
});
