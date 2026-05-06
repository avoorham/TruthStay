import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invokeScoutWorkerAsync } from "@/lib/scout/invoke-worker";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });

  const db = createAdminClient();

  const { data: source, error: sourceErr } = await db
    .from("content_sources")
    .select("id")
    .eq("id", id)
    .single();

  if (sourceErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const { data: job, error: jobErr } = await db
    .from("scout_jobs")
    .insert({
      job_type:        "scrape_source",
      source_id:       id,
      trigger_payload: { mode: "standard" },
      created_by:      user.id,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }

  invokeScoutWorkerAsync();

  return NextResponse.json({ job_id: job.id }, { status: 202 });
}
