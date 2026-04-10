import { NextRequest, NextResponse, after } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCuratorAgent } from "@/lib/agent/curator-agent";
import { getCuratorConfig } from "@/lib/agent/curator-configs";

// ─── GET /api/admin/curate?activityType=hiking&region=Europe ─────────────────
// Returns the current status for a given (activityType, region) combo.

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const activityType = searchParams.get("activityType");
  const region = searchParams.get("region");

  if (!activityType || !region) {
    return NextResponse.json({ error: "activityType and region are required" }, { status: 400 });
  }

  const { data } = await db
    .from("agent_runs")
    .select("status, routes_found, accommodations_found, started_at, completed_at, error_message")
    .eq("activity_type", activityType)
    .eq("region", region)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: "not_started" });
  }

  return NextResponse.json(data);
}

// ─── POST /api/admin/curate ───────────────────────────────────────────────────
// Triggers a curator agent for the given (activityType, region) combo.
// If already completed, returns the existing result.
// If currently running, returns running status.
// Otherwise, starts a new run in the background.

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { activityType?: string; region?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }

  const { activityType, region } = body;
  if (!activityType || !region) {
    return NextResponse.json({ error: "activityType and region are required" }, { status: 400 });
  }

  // Validate we have a config for this combo
  const config = getCuratorConfig(activityType, region);
  if (!config) {
    return NextResponse.json(
      { error: `No curator config found for ${activityType} in ${region}` },
      { status: 404 },
    );
  }

  // Check existing run
  const { data: existingRun } = await db
    .from("agent_runs")
    .select("status, routes_found, accommodations_found, started_at, completed_at")
    .eq("activity_type", activityType)
    .eq("region", region)
    .maybeSingle();

  if (existingRun?.status === "completed") {
    return NextResponse.json(existingRun);
  }
  if (existingRun?.status === "running") {
    return NextResponse.json(existingRun);
  }

  // Upsert the run row as "running"
  await db.from("agent_runs").upsert(
    {
      region,
      activity_type: activityType,
      status:        "running",
      routes_found:  0,
      accommodations_found: 0,
      started_at:    new Date().toISOString(),
      completed_at:  null,
      error_message: null,
    },
    { onConflict: "region,activity_type" },
  );

  // after() keeps the Vercel function alive until the background task settles.
  after(async () => {
    try {
      const result = await runCuratorAgent(config);
      await db.from("agent_runs").update({
        status:               "completed",
        routes_found:         result.routesFound,
        accommodations_found: result.accommodationsFound,
        completed_at:         new Date().toISOString(),
        error_message:        null,
      })
      .eq("activity_type", activityType)
      .eq("region", region);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.from("agent_runs").update({
        status:        "failed",
        error_message: msg,
        completed_at:  new Date().toISOString(),
      })
      .eq("activity_type", activityType)
      .eq("region", region);
    }
  });

  return NextResponse.json({ status: "running", activityType, region });
}
