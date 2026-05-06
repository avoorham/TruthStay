import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SourceUrl {
  source_url: string;
  source_type: "blog" | "instagram_profile" | "instagram_post" | "web_search";
  source_label?: string;
  evidence_url?: string;
  evidence_excerpt?: string;
  first_seen_at?: string;
  secondary_evidence?: Array<{ evidence_url: string; evidence_excerpt: string; first_seen_at: string }>;
}

export interface ContentEntry {
  id: string;
  type: string;
  name: string;
  region: string | null;
  activity_type: string | null;
  description: string | null;
  data: Record<string, unknown> | null;
  submitted_by: string | null;
  upvotes: number;
  verified: boolean;           // deprecated — mirror of status
  trust_score: number | null;
  source_type: string | null;
  source_urls: SourceUrl[];
  independent_source_count: number;
  quality_score: number;
  status: "pending_review" | "approved" | "rejected" | "merged";
  canonical_id: string | null;
  last_seen_at: string;
  features: Record<string, unknown>;
  image_url: string | null;
  created_at: string;
}

export interface ReviewDecision {
  id: string;
  entry_id: string;
  reviewer_id: string;
  decision: "approve" | "reject" | "edit";
  reason: string | null;
  feature_snapshot: Record<string, unknown>;
  created_at: string;
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getContentEntries(filters?: {
  type?: string; verified?: boolean; sourceType?: string; status?: string;
}) {
  const db = createAdminClient();
  let q = db.from("content_entries").select("*").order("created_at", { ascending: false });
  if (filters?.type)                  q = q.eq("type", filters.type);
  if (filters?.verified !== undefined) q = q.eq("verified", filters.verified);
  if (filters?.sourceType)            q = q.eq("source_type", filters.sourceType);
  if (filters?.status)                q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContentEntry[];
}

export async function getContentEntry(id: string): Promise<ContentEntry> {
  const db = createAdminClient();
  const { data, error } = await db.from("content_entries").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ContentEntry;
}

export async function getReviewQueue(): Promise<ContentEntry[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_entries")
    .select("*")
    .eq("status", "pending_review")
    .order("trust_score", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentEntry[];
}

export async function updateContentEntry(id: string, updates: Record<string, unknown>) {
  const db = createAdminClient();
  // Mirror status ↔ verified for backward compat
  if (updates.status === "approved")       updates.verified = true;
  else if (updates.status === "rejected" || updates.status === "merged")
                                            updates.verified = false;
  if (updates.verified === true)           updates.status = "approved";
  else if (updates.verified === false && !updates.status)
                                            updates.status = "pending_review";
  const { error } = await db.from("content_entries").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteContentEntry(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("content_entries").delete().eq("id", id);
  if (error) throw error;
}

// ── Review decisions ──────────────────────────────────────────────────────────

export async function writeReviewDecision(params: {
  entryId: string;
  reviewerId: string;
  decision: "approve" | "reject" | "edit";
  reason?: string;
  featureSnapshot: Record<string, unknown>;
}) {
  const db = createAdminClient();
  const { error } = await db.from("review_decisions").insert({
    entry_id:         params.entryId,
    reviewer_id:      params.reviewerId,
    decision:         params.decision,
    reason:           params.reason ?? null,
    feature_snapshot: params.featureSnapshot,
  });
  if (error) throw error;
}

export async function getRecentDecisions(limit = 20): Promise<ReviewDecision[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("review_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReviewDecision[];
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export async function mergeIntoCanonical(entryId: string, canonicalId: string) {
  const db = createAdminClient();

  // Fetch both entries
  const [{ data: entry }, { data: canonical }] = await Promise.all([
    db.from("content_entries").select("source_urls, independent_source_count").eq("id", entryId).single(),
    db.from("content_entries").select("source_urls, independent_source_count").eq("id", canonicalId).single(),
  ]);

  // Merge source_urls: add any sources from the duplicate that aren't already in canonical
  const existingUrls = new Set(
    ((canonical?.source_urls ?? []) as SourceUrl[]).map(s => s.source_url)
  );
  const newSources = ((entry?.source_urls ?? []) as SourceUrl[]).filter(
    s => !existingUrls.has(s.source_url)
  );
  const mergedSources = [...(canonical?.source_urls ?? []), ...newSources];
  const newCount = (canonical?.independent_source_count ?? 0) + newSources.length;

  // Update canonical entry with merged sources
  const { error: updateError } = await db
    .from("content_entries")
    .update({
      source_urls:             mergedSources,
      independent_source_count: newCount,
      last_seen_at:            new Date().toISOString(),
    })
    .eq("id", canonicalId);
  if (updateError) throw updateError;

  // Mark the duplicate as merged
  const { error: mergeError } = await db
    .from("content_entries")
    .update({ status: "merged", canonical_id: canonicalId, verified: false })
    .eq("id", entryId);
  if (mergeError) throw mergeError;
}

// ── Rubric ────────────────────────────────────────────────────────────────────

export async function getRubric() {
  const db = createAdminClient();
  const { data, error } = await db.from("agent_rubric").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateRubricText(rubricText: string, decisionCount: number) {
  const db = createAdminClient();
  const { error } = await db.from("agent_rubric").update({
    rubric_text:                    rubricText,
    generated_from_decisions_count: decisionCount,
    generated_at:                   new Date().toISOString(),
  }).eq("id", 1);
  if (error) throw error;
}

// Kept for backward compat (location-scout page still reads verified flag)
export async function verifyEntry(id: string, verified: boolean) {
  return updateContentEntry(id, { verified });
}
