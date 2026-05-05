import { NextRequest, NextResponse } from "next/server";
import { getRubric, updateRubricText, getRecentDecisions } from "@/lib/queries/content";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  try {
    const [rubric, decisions] = await Promise.all([getRubric(), getRecentDecisions(20)]);
    return NextResponse.json({ rubric, decisions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { rubric_text } = await req.json();
    const db = createAdminClient();
    const { error } = await db.from("agent_rubric").update({ rubric_text }).eq("id", 1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const db = createAdminClient();

    // Fetch recent decisions (last 90 days, max 500)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: decisions, error } = await db
      .from("review_decisions")
      .select("decision, reason, feature_snapshot")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    if (!decisions || decisions.length < 10) {
      return NextResponse.json({ ok: false, message: "Need at least 10 decisions to regenerate rubric." });
    }

    const approved = decisions.filter(d => d.decision === "approve");
    const rejected = decisions.filter(d => d.decision === "reject");

    // Compute feature statistics
    type DecisionRow = (typeof decisions)[number];
    function medianFeature(rows: DecisionRow[], key: string): number {
      const vals = rows.map(r => (r.feature_snapshot as any)?.[key]).filter((v): v is number => typeof v === "number");
      if (!vals.length) return 0;
      vals.sort((a, b) => a - b);
      return vals[Math.floor(vals.length / 2)] ?? 0;
    }
    function pctTrue(rows: DecisionRow[], key: string): number {
      const vals = rows.map(r => (r.feature_snapshot as any)?.[key]);
      if (!vals.length) return 0;
      return Math.round((vals.filter(v => v === true).length / vals.length) * 100);
    }

    const rejectReasons = rejected.slice(0, 20).map(d => d.reason).filter(Boolean).join("; ");

    const prompt = `The admin has reviewed ${decisions.length} scout-discovered entries.
Here are the patterns in approved vs rejected entries:

APPROVED (n=${approved.length}):
  Median description length: ${medianFeature(approved, "description_length")} chars
  % with prices: ${pctTrue(approved, "has_price")}%
  % with photos: ${pctTrue(approved, "has_photos")}%
  % with coordinates: ${pctTrue(approved, "has_coordinates")}%
  % with address: ${pctTrue(approved, "has_address")}%

REJECTED (n=${rejected.length}):
  Median description length: ${medianFeature(rejected, "description_length")} chars
  % with prices: ${pctTrue(rejected, "has_price")}%
  % with photos: ${pctTrue(rejected, "has_photos")}%
  Reasons given: ${rejectReasons || "none recorded"}

Write a concise rubric (max 12 bullet points) capturing what distinguishes approved entries from rejected ones.
Focus on patterns the scout can apply at extraction time to filter out low-quality mentions.
Avoid restating the BASE_RULES. Output plain text bullets only — no headers, no preamble.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const msg = await anthropic.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    });

    const rubricText = (msg.content[0] as any).text as string;
    await updateRubricText(rubricText, decisions.length);

    return NextResponse.json({ ok: true, rubric_text: rubricText, decisions_used: decisions.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
