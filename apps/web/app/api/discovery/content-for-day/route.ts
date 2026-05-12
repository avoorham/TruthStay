import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/discovery/content-for-day?adventure_day_id={id}&type={type}
// Returns content_entries for the day's destination, filtered by type.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adventureDayId = searchParams.get("adventure_day_id");
  const type = searchParams.get("type");

  if (!adventureDayId || !type) {
    return Response.json({ error: "adventure_day_id and type required" }, { status: 400 });
  }

  const validTypes = ["accommodation", "restaurant", "activity", "things_to_do"];
  if (!validTypes.includes(type)) {
    return Response.json({ error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const db = createAdminClient();

  // Resolve the adventure_day to get its destination and parent adventure
  type DayRow = { adventureId: string; alternatives: { destination?: string } | null };
  const { data: day, error: dayErr } = await db
    .from("adventure_days")
    .select(`"adventureId", alternatives`)
    .eq("id", adventureDayId)
    .maybeSingle();

  if (dayErr || !day) {
    return Response.json({ error: "Adventure day not found" }, { status: 404 });
  }

  const dayRow = day as DayRow;
  const destination = dayRow.alternatives?.destination ?? null;

  // Fetch the adventure's broad region — content_entries are indexed by region, not by day-level town
  const { data: adventureRow } = await db
    .from("adventures")
    .select("region")
    .eq("id", dayRow.adventureId)
    .maybeSingle();

  const adventureRegion = (adventureRow as { region?: string } | null)?.region ?? null;

  // Use adventure region as primary search term; fall back to day destination if region is missing
  const searchRegion = adventureRegion ?? destination;
  if (!searchRegion) {
    return Response.json({ entries: [] });
  }

  // Query content_entries matching the adventure's region + type
  type EntryRow = {
    id: string;
    name: string;
    type: string;
    region: string;
    country: string | null;
    description: string | null;
    trust_score: number;
    google_rating: number | null;
    google_review_count: number | null;
    user_review_score: number | null;
    user_review_count: number | null;
    save_count: number;
    image_url: string | null;
    website_url: string | null;
    menu_url: string | null;
    booking_url: string | null;
    data: unknown;
  };

  const { data: entries, error: entriesErr } = await db
    .from("content_entries")
    .select("id, name, type, region, country, description, trust_score, google_rating, google_review_count, user_review_score, user_review_count, save_count, image_url, website_url, menu_url, booking_url, data")
    .eq("type", type)
    .eq("verified", true)
    .eq("status", "approved")
    .ilike("region", `%${searchRegion}%`)
    .order("trust_score", { ascending: false })
    .order("save_count", { ascending: false })
    .limit(10);

  if (entriesErr) {
    return Response.json({ error: entriesErr.message }, { status: 500 });
  }

  return Response.json({ entries: (entries ?? []) as EntryRow[], destination });
}
