import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/discovery/chips?q=&limit=8
// Returns popularity-ranked destination chips matching a query prefix.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  const db = createAdminClient();

  const { data: chips, error } = await db
    .from("destination_chips")
    .select("id, name, type, parent_region, country, save_count, description")
    .ilike("name", query.length > 0 ? `%${query}%` : "%")
    .order("save_count", { ascending: false })
    .limit(limit);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ chips: chips ?? [] });
}
