import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/scout/jobs/[id]/cancel
// Sets status='cancelled' if the job is queued or running.
// The worker checks for cancellation between stages and bails gracefully.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data, error } = await db
    .from("scout_jobs")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["queued", "running"])
    .select("id, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found or already finished" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: data.id, status: data.status });
}
