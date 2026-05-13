import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyEntry,
  normalizeToAdminRegion,
  THRESHOLD_TIERS,
  ACTIVE_TIER,
  type ChipTaxonomyRow,
} from "@/lib/chip-classifier";
import { CANONICAL_REGIONS } from "@/lib/region-normalizer";

const CRON_SECRET = process.env.CRON_SECRET;

// POST /api/admin/chips/recompute
// 1. Classifies all unclassified content_entries (skips already-classified rows).
// 2. Recomputes region_chip_stats from scratch across all classifications.
// 3. Applies ACTIVE_TIER threshold to set is_active on each (region, chip) pair.
// Called weekly by Vercel Cron and manually by admins.
// Protected by CRON_SECRET bearer token.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // ── Load chip taxonomy once ───────────────────────────────────────────────
  const { data: chips, error: chipErr } = await db
    .from("chip_taxonomy")
    .select("id, slug, label, category");

  if (chipErr || !chips?.length) {
    return Response.json({ error: "Failed to load chip taxonomy" }, { status: 500 });
  }

  const typedChips = chips as ChipTaxonomyRow[];

  // ── Load entries that need classification ─────────────────────────────────
  const { data: entries, error: entriesErr } = await db
    .from("content_entries")
    .select("id, name, description, type, region")
    .eq("verified", true)
    .eq("status", "approved");

  if (entriesErr) {
    return Response.json({ error: entriesErr.message }, { status: 500 });
  }

  const allEntries = (entries ?? []) as Array<{
    id: string; name: string; description?: string | null; type: string; region: string;
  }>;

  // IDs already in content_entry_chips — skip these
  const { data: existing } = await db
    .from("content_entry_chips")
    .select("content_entry_id");

  const classifiedIds = new Set(
    (existing ?? []).map((r: { content_entry_id: string }) => r.content_entry_id),
  );

  const toClassify = allEntries.filter(e => !classifiedIds.has(e.id));

  // ── Classify unclassified entries ─────────────────────────────────────────
  // TODO(scale): batch Haiku calls 5-at-a-time with Promise.all when
  // toClassify.length exceeds ~200.
  let classifiedCount = 0;
  const unmappedRegions = new Set<string>();

  for (const entry of toClassify) {
    const normalized = normalizeToAdminRegion(entry.region ?? "");
    // Genuinely unmapped = normalised result is not a known canonical.
    // Avoids false positives where raw == canonical (e.g. "Porto" → "Porto").
    if (entry.region && !CANONICAL_REGIONS.has(normalized)) {
      unmappedRegions.add(entry.region);
    }

    const slugs = await classifyEntry(entry, typedChips);
    if (slugs.length === 0) continue;

    const rows = slugs
      .map(slug => typedChips.find(c => c.slug === slug))
      .filter((c): c is ChipTaxonomyRow => c !== undefined)
      .map(c => ({
        content_entry_id: entry.id,
        chip_id: c.id,
        classified_at: new Date().toISOString(),
      }));

    await db
      .from("content_entry_chips")
      .upsert(rows, { onConflict: "content_entry_id,chip_id" });

    classifiedCount++;
  }

  // ── Recompute region_chip_stats ───────────────────────────────────────────
  // Fetch every classification with its entry's region and type
  const { data: allChips, error: allChipsErr } = await db
    .from("content_entry_chips")
    .select("chip_id, content_entry:content_entries(id, type, region)");

  if (allChipsErr) {
    return Response.json({ error: allChipsErr.message }, { status: 500 });
  }

  // Count entries per (admin_region, chip_id) and per (admin_region, category)
  const chipCounts  = new Map<string, number>(); // "region::chip_id"
  const catCounts   = new Map<string, number>(); // "region::category"
  const chipIdToRow = new Map<string, ChipTaxonomyRow>(typedChips.map(c => [c.id, c]));

  for (const row of (allChips ?? [])) {
    type EntryRef = { id: string; type: string; region: string } | null;
    const entry = row.content_entry as unknown as EntryRef;
    if (!entry?.region) continue;

    const region = normalizeToAdminRegion(entry.region);
    const chip   = chipIdToRow.get(row.chip_id as string);
    if (!chip) continue;

    const ck = `${region}::${row.chip_id}`;
    chipCounts.set(ck, (chipCounts.get(ck) ?? 0) + 1);

    const catKey = `${region}::${chip.category}`;
    catCounts.set(catKey, (catCounts.get(catKey) ?? 0) + 1);
  }

  // Apply threshold and upsert region_chip_stats
  const tier = THRESHOLD_TIERS[ACTIVE_TIER];
  const statsRows = [];

  for (const [key, count] of chipCounts) {
    const sepIdx = key.indexOf("::");
    const region = key.slice(0, sepIdx);
    const chipId = key.slice(sepIdx + 2);
    const chip   = chipIdToRow.get(chipId);
    if (!chip) continue;

    const total    = catCounts.get(`${region}::${chip.category}`) ?? 0;
    const fraction = total > 0 ? count / total : 0;
    const isActive = count >= tier.min_entries && fraction >= tier.min_fraction;

    statsRows.push({
      admin_region: region,
      chip_id:      chipId,
      entry_count:  count,
      is_active:    isActive,
      computed_at:  new Date().toISOString(),
    });
  }

  const { error: statsErr } = await db
    .from("region_chip_stats")
    .upsert(statsRows, { onConflict: "admin_region,chip_id" });

  if (statsErr) {
    return Response.json({ error: statsErr.message }, { status: 500 });
  }

  // Log unmapped regions so we can extend REGION_MAP
  if (unmappedRegions.size > 0) {
    console.warn("[chips/recompute] unmapped regions (extend REGION_MAP):", [...unmappedRegions]);
  }

  const NEW_UNMAPPED_WARNING_THRESHOLD = 10;
  if (unmappedRegions.size > NEW_UNMAPPED_WARNING_THRESHOLD) {
    console.warn(
      `[chip-recompute] WARNING: ${unmappedRegions.size} unmapped ` +
      `regions found in this run. If this number stays elevated across ` +
      `multiple weekly runs, consider evaluating Stage 2 region storage. ` +
      `See region-normalizer.ts for migration options.`
    );
  }

  return Response.json({
    classified:       classifiedCount,
    skipped:          toClassify.length - classifiedCount,
    already_had_chips: classifiedIds.size,
    stats_updated:    statsRows.length,
    unmapped_regions: [...unmappedRegions],
  });
}
