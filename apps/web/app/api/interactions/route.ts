import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

const VALID_INTERACTION_TYPES = new Set([
  "viewed", "selected", "saved", "replaced",
  "skipped", "rated_up", "rated_down", "shared",
]);

const INTERACTION_WEIGHTS: Record<string, number> = {
  viewed:     0.1,
  selected:   0.5,
  replaced:  -0.3,
  saved:      0.8,
  skipped:   -0.5,
  rated_up:   0.9,
  rated_down: -0.7,
  shared:     1.0,
};

interface InteractionPayload {
  interaction_type:      string;
  adventure_id?:         string | null;
  content_entry_id?:     string | null;
  session_id?:           string | null;
  session_query?:        string | null;
  session_region?:       string | null;
  session_activity_type?: string | null;
  session_vacation_type?: string | null;
  day_number?:           number | null;
  alternative_index?:    number | null;
  replaced_by_entry_id?: string | null;
  dwell_time_seconds?:   number | null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: InteractionPayload | InteractionPayload[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payloads = Array.isArray(body) ? body : [body];

  // Validate interaction types
  for (const p of payloads) {
    if (!VALID_INTERACTION_TYPES.has(p.interaction_type)) {
      return NextResponse.json(
        { error: `Invalid interaction_type: ${p.interaction_type}` },
        { status: 400 },
      );
    }
  }

  const db = createAdminClient();

  // Resolve public user id
  const { data: publicUser } = await db
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();

  const userId = publicUser?.id ?? user.id;

  const rows = payloads.map(p => ({
    user_id:               userId,
    interaction_type:      p.interaction_type,
    interaction_weight:    INTERACTION_WEIGHTS[p.interaction_type] ?? 0,
    adventure_id:          p.adventure_id          ?? null,
    content_entry_id:      p.content_entry_id      ?? null,
    session_id:            p.session_id            ?? null,
    session_query:         p.session_query?.slice(0, 500) ?? null,
    session_region:        p.session_region        ?? null,
    session_activity_type: p.session_activity_type ?? null,
    session_vacation_type: p.session_vacation_type ?? null,
    day_number:            p.day_number            ?? null,
    alternative_index:     p.alternative_index     ?? null,
    replaced_by_entry_id:  p.replaced_by_entry_id  ?? null,
    dwell_time_seconds:    p.dwell_time_seconds     ?? null,
  }));

  const { error } = await db.from("user_interactions").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
