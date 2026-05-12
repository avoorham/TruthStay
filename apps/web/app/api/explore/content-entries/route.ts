import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/explore/content-entries?type=accommodation|route|restaurant|activity|things_to_do
// Optional bounds: &north=&south=&east=&west=
// Optional chip filter: &chip_slugs=hiking,cycling (comma-separated)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const north = parseFloat(searchParams.get("north") ?? "");
  const south = parseFloat(searchParams.get("south") ?? "");
  const east  = parseFloat(searchParams.get("east")  ?? "");
  const west  = parseFloat(searchParams.get("west")  ?? "");
  const hasBounds = !isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west);
  const chipSlugsRaw = searchParams.get("chip_slugs") ?? "";
  const chipSlugs = chipSlugsRaw ? chipSlugsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

  if (!["accommodation", "route", "restaurant", "activity", "things_to_do"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const db = createAdminClient();

  // If chip_slugs provided, resolve to content_entry IDs before main query
  let chipFilterIds: string[] | null = null;
  if (chipSlugs.length > 0) {
    const { data: chipRows } = await db
      .from("chip_taxonomy")
      .select("id")
      .in("slug", chipSlugs);
    const chipIds = (chipRows ?? []).map((r: { id: string }) => r.id);
    if (chipIds.length === 0) return NextResponse.json([]);

    const { data: ceRows } = await db
      .from("content_entry_chips")
      .select("content_entry_id")
      .in("chip_id", chipIds);
    chipFilterIds = [...new Set((ceRows ?? []).map((r: { content_entry_id: string }) => r.content_entry_id))];
    if (chipFilterIds.length === 0) return NextResponse.json([]);
  }

  let query = db
    .from("content_entries")
    .select("id, type, name, region, activity_type, description, data, trust_score")
    .eq("type", type)
    .eq("verified", true)
    .not("data->coordinates", "is", null)
    .order("trust_score", { ascending: false })
    .limit(200);

  if (chipFilterIds !== null) {
    query = query.in("id", chipFilterIds);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Coords = { lat?: string; latitude?: string; lng?: string; longitude?: string };
  type EntryRow = { id: string; type: string; name: string; region: string; activity_type: string | null; description: string | null; data: { coordinates?: Coords } | null; trust_score: number | null };
  const entries = (data ?? []).map((e: EntryRow) => {
    const coords: Coords = e.data?.coordinates ?? {};
    const lat = parseFloat(coords.lat ?? coords.latitude ?? "");
    const lng = parseFloat(coords.lng ?? coords.longitude ?? "");
    if (isNaN(lat) || isNaN(lng)) return null;
    if (hasBounds) {
      if (lat < south || lat > north || lng < west || lng > east) return null;
    }
    return {
      id:            e.id,
      type:          e.type,
      name:          e.name,
      region:        e.region,
      activity_type: e.activity_type,
      description:   e.description,
      data:          e.data,
      trust_score:   e.trust_score,
      coords:        [lng, lat] as [number, number],
    };
  }).filter(Boolean);

  return NextResponse.json(entries);
}
