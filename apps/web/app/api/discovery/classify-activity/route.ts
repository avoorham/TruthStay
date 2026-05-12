import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyEntry, type ChipTaxonomyRow } from "@/lib/chip-classifier";

const CLASSIFY_SECRET = process.env.CLASSIFY_SECRET;

// POST /api/discovery/classify-activity
// Classify a single content_entry into chip_taxonomy chips and persist to
// content_entry_chips.  Protected by CLASSIFY_SECRET bearer token.
//
// Body:  { content_entry_id: string; force?: boolean }
// force=true re-classifies entries that already have chips (default: skip).
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!CLASSIFY_SECRET || auth !== `Bearer ${CLASSIFY_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { content_entry_id?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content_entry_id, force = false } = body;
  if (!content_entry_id) {
    return Response.json({ error: "content_entry_id required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Load entry
  const { data: entry, error: entryErr } = await db
    .from("content_entries")
    .select("id, name, description, type")
    .eq("id", content_entry_id)
    .maybeSingle();

  if (entryErr || !entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  // Skip if already classified and force is not set
  if (!force) {
    const { count } = await db
      .from("content_entry_chips")
      .select("id", { count: "exact", head: true })
      .eq("content_entry_id", content_entry_id);

    if ((count ?? 0) > 0) {
      return Response.json({ skipped: true, reason: "already_classified" });
    }
  } else {
    // force=true: delete existing classifications so the re-run is a clean
    // replacement, not an accumulation of stale + new chips.
    await db
      .from("content_entry_chips")
      .delete()
      .eq("content_entry_id", content_entry_id);
  }

  // Load full chip taxonomy
  const { data: chips, error: chipErr } = await db
    .from("chip_taxonomy")
    .select("id, slug, label, category");

  if (chipErr || !chips) {
    return Response.json({ error: "Failed to load chip taxonomy" }, { status: 500 });
  }

  // Classify
  const slugs = await classifyEntry(
    entry as { id: string; name: string; description?: string | null; type: string },
    chips as ChipTaxonomyRow[],
  );

  if (slugs.length === 0) {
    return Response.json({ slugs: [], classified: false });
  }

  // Resolve slugs → chip IDs
  const rows = slugs
    .map(slug => (chips as ChipTaxonomyRow[]).find(c => c.slug === slug))
    .filter((c): c is ChipTaxonomyRow => c !== undefined)
    .map(c => ({
      content_entry_id,
      chip_id: c.id,
      classified_at: new Date().toISOString(),
    }));

  const { error: upsertErr } = await db
    .from("content_entry_chips")
    .upsert(rows, { onConflict: "content_entry_id,chip_id" });

  if (upsertErr) {
    return Response.json({ error: upsertErr.message }, { status: 500 });
  }

  return Response.json({ slugs, classified: true });
}
