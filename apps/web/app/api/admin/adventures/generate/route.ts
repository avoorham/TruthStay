import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePublicVacation, VACATION_SLOTS } from "@/lib/agent/public-adventure-team";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Admin generation is exempt from rate limiting

  let body: { slotIndices?: number[] } = {};
  try { body = await request.json(); } catch { /* no body = all slots */ }

  const indices = body.slotIndices?.length
    ? body.slotIndices
    : VACATION_SLOTS.map((_, i) => i);
  const results: { index: number; title?: string; error?: string }[] = [];

  for (const idx of indices) {
    const slot = VACATION_SLOTS[idx];
    if (!slot) { results.push({ index: idx, error: "Invalid slot index" }); continue; }

    try {
      const draft = await generatePublicVacation(slot);

      await db.from("public_adventure_drafts").insert({
        slot:                draft.slot,
        adventure:           draft.adventure,
        day_alternatives:    draft.dayAlternatives,
        accommodation_stops: draft.accommodationStops,
        meta:                draft.meta,
        qa_notes:            draft.qaNotes,
        status:              "draft",
      });

      results.push({ index: idx, title: draft.adventure.title });
    } catch (err) {
      results.push({ index: idx, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const ok    = results.filter(r => !r.error).length;
  const failed = results.filter(r =>  r.error).length;
  return NextResponse.json({ generated: ok, failed, results });
}
