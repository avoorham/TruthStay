import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/restaurants/public
// Returns restaurant stops extracted from all public adventure days.
// Optional: ?q=italian  (filters by name or cuisine, case-insensitive)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const db = createAdminClient();

  const { data, error } = await db
    .from("adventures")
    .select(`
      id, title, region, meta,
      adventure_days ( alternatives )
    `)
    .eq("isPublic", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const restaurants: {
    name: string;
    cuisine: string;
    priceRange: string;
    coords: [number, number];
    adventureId: string;
    adventureTitle: string;
    region: string;
  }[] = [];

  for (const adv of data ?? []) {
    const baseCoords: [number, number] =
      (adv.meta as { coords?: [number, number] } | null)?.coords ?? [0, 0];

    for (const day of (adv.adventure_days as { alternatives: unknown }[] | null) ?? []) {
      const alts = day.alternatives as {
        restaurants?: {
          name?: string;
          cuisine?: string;
          price_range?: string;
          coords?: [number, number];
        }[];
      } | null;

      for (const r of alts?.restaurants ?? []) {
        const name    = r.name    ?? "";
        const cuisine = r.cuisine ?? "";

        // Apply search filter if provided
        if (q && !name.toLowerCase().includes(q) && !cuisine.toLowerCase().includes(q)) continue;

        restaurants.push({
          name,
          cuisine,
          priceRange:     r.price_range ?? "",
          coords:         r.coords ?? baseCoords,
          adventureId:    adv.id,
          adventureTitle: adv.title,
          region:         adv.region,
        });
      }
    }
  }

  return NextResponse.json(restaurants);
}
