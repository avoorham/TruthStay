import { NextRequest, NextResponse } from "next/server";
import { mergeIntoCanonical, writeReviewDecision, getContentEntry } from "@/lib/queries/content";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { canonicalId } = await req.json();
    if (!canonicalId) return NextResponse.json({ error: "canonicalId required" }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const entry = await getContentEntry(id);
      await writeReviewDecision({
        entryId:         id,
        reviewerId:      user.id,
        decision:        "reject",
        reason:          `Merged into ${canonicalId}`,
        featureSnapshot: { ...entry.features, type: entry.type, status: "merged" },
      });
    }

    await mergeIntoCanonical(id, canonicalId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
