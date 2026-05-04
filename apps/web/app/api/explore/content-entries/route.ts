import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/explore/content-entries?type=accommodation|route|restaurant
// Optional bounds: &north=&south=&east=&west=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const north = parseFloat(searchParams.get("north") ?? "");
  const south = parseFloat(searchParams.get("south") ?? "");
  const east  = parseFloat(searchParams.get("east")  ?? "");
  const west  = parseFloat(searchParams.get("west")  ?? "");
  const hasBounds = !isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west);

  if (!["accommodation", "route", "restaurant"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data, error } = await db
    .from("content_entries")
    .select("id, type, name, region, activity_type, description, data, trust_score")
    .eq("type", type)
    .eq("verified", true)
    .not("data->coordinates", "is", null)
    .order("trust_score", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (data ?? []).map((e: any) => {
    const coords = e.data?.coordinates ?? {};
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
