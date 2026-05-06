import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invokeScoutWorkerAsync } from "@/lib/scout/invoke-worker";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });

  const db = createAdminClient();

  const { data: job, error } = await db
    .from("scout_jobs")
    .insert({
      job_type:        "run_scout",
      source_id:       null,
      trigger_payload: body,
      created_by:      user.id,
    })
    .select("id")
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }

  invokeScoutWorkerAsync();

  return NextResponse.json({ job_id: job.id }, { status: 202 });
}
