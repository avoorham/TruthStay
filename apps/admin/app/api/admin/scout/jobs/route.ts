import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/scout/jobs?source_id=...&limit=50
// Returns job history. source_id narrows to one source; omit for global view.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sourceId = searchParams.get("source_id");
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const db = createAdminClient();
  let q = db
    .from("scout_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
