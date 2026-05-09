import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/discovery/chips?q=&limit=8
// Returns popularity-ranked destination chips matching a query prefix.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  const db = createAdminClient();

  let dbQuery = db
    .from("destination_chips")
    .select("id, name, type, parent_region, country, save_count, description")
    .order("save_count", { ascending: false })
    .limit(limit);

  if (query.length > 0) {
    // Match against name, parent_region, or country so e.g. "france" returns Provence
    dbQuery = dbQuery.or(
      `name.ilike.%${query}%,parent_region.ilike.%${query}%,country.ilike.%${query}%`
    );
  }

  const { data: chips, error } = await dbQuery;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ chips: chips ?? [] });
}
