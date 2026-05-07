import { NextRequest, NextResponse } from "next/server";
import { getContentEntry, updateContentEntry, deleteContentEntry, writeReviewDecision } from "@/lib/queries/content";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SourceUrl } from "@/lib/queries/content";

// ── Field validation ───────────────────────────────────────────────────────────

const EDITABLE_FIELDS = ["name", "description", "region", "country", "type", "source_urls"] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

const VALID_TYPES = ["accommodation", "restaurant", "activity", "route"] as const;

const CREDIBILITY: Record<string, number> = {
  blog:              0.7,
  instagram_profile: 0.6,
  instagram_post:    0.5,
  web_search:        0.4,
};

function validateField(field: EditableField, value: unknown): string | null {
  switch (field) {
    case "name": {
      if (typeof value !== "string") return "name must be a string";
      const t = value.trim();
      if (t.length < 2)   return "name must be at least 2 characters";
      if (t.length > 200) return "name must be at most 200 characters";
      return null;
    }
    case "description": {
      if (typeof value !== "string") return "description must be a string";
      const t = value.trim();
      if (t.length < 10)   return "description must be at least 10 characters";
      if (t.length > 2000) return "description must be at most 2000 characters";
      return null;
    }
    case "region": {
      if (typeof value !== "string") return "region must be a string";
      const t = value.trim();
      if (t.length < 2)   return "region must be at least 2 characters";
      if (t.length > 100) return "region must be at most 100 characters";
      return null;
    }
    case "country": {
      if (typeof value !== "string") return "country must be a string";
      if (value.trim().length > 100) return "country must be at most 100 characters";
      return null; // empty string is valid (clears the field)
    }
    case "type": {
      if (!VALID_TYPES.includes(value as typeof VALID_TYPES[number]))
        return `type must be one of: ${VALID_TYPES.join(", ")}`;
      return null;
    }
    case "source_urls": {
      if (!Array.isArray(value)) return "source_urls must be an array";
      if (value.length > 20)    return "source_urls must have at most 20 items";
      for (const s of value) {
        if (typeof s.source_url !== "string") return "each source must have a source_url string";
        if (!/^https?:\/\//i.test(s.source_url)) return `invalid URL: ${s.source_url}`;
      }
      return null;
    }
  }
}

// ── Trust score recomputation ──────────────────────────────────────────────────

function recomputeTrustScore(sources: SourceUrl[]): { source_trust_score: number; independent_source_count: number } {
  if (sources.length === 0) return { source_trust_score: 0, independent_source_count: 0 };
  const domains = new Set(sources.map(s => {
    try { return new URL(s.source_url).hostname.replace(/^www\./, ""); } catch { return s.source_url; }
  }));
  const independent_source_count = domains.size;
  const avgCredibility = sources.reduce((sum, s) => sum + (CREDIBILITY[s.source_type] ?? 0.5), 0) / sources.length;
  const source_trust_score = Math.min(1.0, independent_source_count / 5) * avgCredibility;
  return { source_trust_score, independent_source_count };
}

// ── Diff builder for review_decisions reason ──────────────────────────────────

function buildDiffReason(field: string, oldVal: unknown, newVal: unknown): string {
  if (field === "source_urls") {
    const oldUrls = (oldVal as SourceUrl[] | null ?? []).map(s => s.source_url).join(", ");
    const newUrls = (newVal as SourceUrl[] | null ?? []).map(s => s.source_url).join(", ");
    return `source_urls changed from [${oldUrls}] to [${newUrls}]`.slice(0, 500);
  }
  const from = String(oldVal ?? "").slice(0, 100);
  const to   = String(newVal ?? "").slice(0, 100);
  return `${field} changed from "${from}" to "${to}"`.slice(0, 500);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getContentEntry(id);
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const body     = await req.json();
    const decision = body.decision as string | undefined;

    // Detect which editable fields are in the body
    const editableKeys = EDITABLE_FIELDS.filter(f => f in body);
    const hasDecision  = !!decision;

    // Validate any editable fields present
    for (const field of editableKeys) {
      const err = validateField(field, body[field]);
      if (err) return NextResponse.json({ error: err }, { status: 422 });
    }

    // Resolve reviewer for decision logging
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const entry = await getContentEntry(id);

    // Build the DB update payload
    const updates: Record<string, unknown> = {};

    for (const field of editableKeys) {
      if (field === "name" || field === "description" || field === "region") {
        updates[field] = (body[field] as string).trim();
      } else if (field === "country") {
        const trimmed = (body[field] as string).trim();
        updates[field] = trimmed.length > 0 ? trimmed : null;
      } else if (field === "type") {
        updates[field] = body[field];
      } else if (field === "source_urls") {
        updates.source_urls = body.source_urls;
        // Recompute source trust score when sources change; recalc combined
        const { source_trust_score, independent_source_count } = recomputeTrustScore(body.source_urls as SourceUrl[]);
        const userTrust = (entry.user_trust_score ?? 0.5);
        updates.source_trust_score       = source_trust_score;
        updates.trust_score              = 0.4 * source_trust_score + 0.6 * userTrust;
        updates.independent_source_count = independent_source_count;
      }
    }

    // Apply status changes from decision
    if (hasDecision) {
      if (decision === "approve") updates.status = "approved";
      if (decision === "reject")  updates.status = "rejected";
    }

    // Write review_decisions row
    if (user) {
      const featureSnapshot = {
        ...(entry.features ?? {}),
        source_trust_score:       entry.source_trust_score,
        user_trust_score:         entry.user_trust_score,
        trust_score:              entry.trust_score,
        quality_score:            entry.quality_score,
        independent_source_count: entry.independent_source_count,
        type:                     entry.type,
        source_types: (entry.source_urls ?? []).map((s: SourceUrl) => s.source_type),
      };

      let reason = body.reason as string | undefined;

      // For inline field edits without explicit reason, auto-generate diff
      if (!reason && editableKeys.length === 1 && !hasDecision) {
        const field = editableKeys[0]!;
        reason = buildDiffReason(field, entry[field as keyof typeof entry], body[field as string]);
      }

      await writeReviewDecision({
        entryId:         id,
        reviewerId:      user.id,
        decision:        (hasDecision ? decision : "edit") as "approve" | "reject" | "edit",
        reason,
        featureSnapshot,
      });
    }

    if (Object.keys(updates).length > 0) await updateContentEntry(id, updates);

    // Return the fresh entry for optimistic UI update
    const updated = await getContentEntry(id);
    return NextResponse.json({ entry: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteContentEntry(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
