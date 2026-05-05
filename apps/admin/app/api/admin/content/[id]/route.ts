import { NextRequest, NextResponse } from "next/server";
import { getContentEntry, updateContentEntry, deleteContentEntry, writeReviewDecision } from "@/lib/queries/content";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getContentEntry(id);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // If a decision is included (approve/reject/edit), write to review_decisions first
    if (body.decision) {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Build feature snapshot from the entry + any decision metadata
        const entry = await getContentEntry(id);
        const featureSnapshot = {
          ...(entry.features ?? {}),
          trust_score:              entry.trust_score,
          quality_score:            entry.quality_score,
          independent_source_count: entry.independent_source_count,
          type:                     entry.type,
          source_types: (entry.source_urls ?? []).map((s: any) => s.source_type),
        };

        await writeReviewDecision({
          entryId:         id,
          reviewerId:      user.id,
          decision:        body.decision,
          reason:          body.reason,
          featureSnapshot,
        });
      }

      // Remove decision fields from the update payload
      const { decision: _d, reason: _r, ...updates } = body;
      if (Object.keys(updates).length > 0) await updateContentEntry(id, updates);
    } else {
      await updateContentEntry(id, body);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteContentEntry(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
