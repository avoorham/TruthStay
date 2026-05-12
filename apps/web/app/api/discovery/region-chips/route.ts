import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeToAdminRegion } from "@/lib/region-normalizer";

// GET /api/discovery/region-chips?region={admin_region}&category={category}
// Returns the active sub-chips for a region+category, ordered by sort_order.
// Used by the mobile Explore screen to render the sub-chip row beneath the
// main filter chips.  Only returns chips where region_chip_stats.is_active = true.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region   = searchParams.get("region");
  const category = searchParams.get("category");

  if (!region || !category) {
    return Response.json({ error: "region and category required" }, { status: 400 });
  }

  const validCategories = ["restaurant", "things_to_do", "activity"];
  if (!validCategories.includes(category)) {
    return Response.json(
      { error: `category must be one of: ${validCategories.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Normalise: mobile sends raw Mapbox place name; server resolves to canonical key
  const adminRegion = normalizeToAdminRegion(region);

  // Join stats → taxonomy; only active chips for this (region, category)
  const { data, error } = await db
    .from("region_chip_stats")
    .select("entry_count, chip:chip_taxonomy(id, slug, label, category, sort_order)")
    .eq("admin_region", adminRegion)
    .eq("is_active", true)
    .eq("chip_taxonomy.category", category)
    .order("chip_taxonomy.sort_order", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Flatten: filter out rows where the join yielded no chip (wrong category)
  type ChipRow = { id: string; slug: string; label: string; category: string; sort_order: number };
  const chips = (data ?? [])
    .map(row => row.chip as unknown as ChipRow | null)
    .filter((c): c is ChipRow => c !== null && c.category === category)
    .sort((a, b) => a.sort_order - b.sort_order);

  return Response.json({ chips });
}
