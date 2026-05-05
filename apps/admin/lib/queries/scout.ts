import { createAdminClient } from "@/lib/supabase/admin";

export interface ScoutEntry {
  id: string;
  name: string;
  type: string;
  region: string | null;
  description: string | null;
  verified: boolean;
  trust_score: number | null;
  source_type: string | null;
  data: {
    scoutScore?: number;
    scoutReason?: string;
    sources?: Array<{ url: string; author?: string; excerpt?: string; type?: string }>;
    coordinates?: { lat: number; lng: number };
    highlights?: string[];
    agentRunId?: string;
  } | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  region: string;
  activity_type: string;
  status: "running" | "completed" | "failed";
  routes_found: number | null;
  accommodations_found: number | null;
  restaurants_found: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ContentStats {
  total: number;
  verified: number;
  byType: { route: number; accommodation: number; restaurant: number };
  topRegions: Array<{ region: string; count: number }>;
}

export async function getRunResults(runId: string): Promise<ScoutEntry[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_entries")
    .select("*")
    .contains("data", { agentRunId: runId })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScoutEntry[];
}

export async function getAgentRuns(limit = 50): Promise<AgentRun[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentRun[];
}

// ── Content Sources ──────────────────────────────────────────────────────────

export interface ContentSource {
  id: string;
  url: string;
  type: "website" | "instagram";
  label: string;
  region: string | null;
  last_scraped_at: string | null;
  entry_count: number;
  status: "active" | "paused" | "error";
  health: "ok" | "broken";
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
}

// ── Scout Jobs ────────────────────────────────────────────────────────────────

export interface ScoutJobProgress {
  stage?: string;
  stage_started_at?: string;
  stages_completed?: string[];
  extractions_found?: number;
  extractions_resolved?: number;
  extractions_matched?: number;
  entries_queued?: number;
}

export interface ScoutJob {
  id: string;
  job_type: "scrape_source" | "run_scout";
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  source_id: string | null;
  trigger_payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  last_error_code: string | null;
  retryable: boolean;
  progress: ScoutJobProgress;
  entries_created: number | null;
  entries_updated: number | null;
  result_summary: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  next_attempt_at: string | null;
  // Joined from content_sources when fetched via the [id] endpoint
  source?: { id: string; label: string; url: string; type: string } | null;
}

export async function getContentSources(): Promise<ContentSource[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_sources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentSource[];
}

export async function addContentSource(input: {
  url: string;
  type: "website" | "instagram";
  label: string;
  region?: string;
}): Promise<ContentSource> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_sources")
    .insert({ ...input, region: input.region || null })
    .select()
    .single();
  if (error) throw error;
  return data as ContentSource;
}

export async function deleteContentSource(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("content_sources").delete().eq("id", id);
  if (error) throw error;
}

export async function getScoutJob(id: string): Promise<ScoutJob | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scout_jobs")
    .select("*, source:content_sources(id, label, url, type)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as ScoutJob;
}

export async function getScoutJobs(sourceId?: string, limit = 50): Promise<ScoutJob[]> {
  const db = createAdminClient();
  let q = db
    .from("scout_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (sourceId) q = q.eq("source_id", sourceId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as ScoutJob[];
}

export async function cancelScoutJob(id: string): Promise<boolean> {
  const db = createAdminClient();
  const { error } = await db
    .from("scout_jobs")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["queued", "running"]);
  return !error;
}

export async function updateContentSourceAfterScrape(id: string, count: number): Promise<void> {
  const db = createAdminClient();
  const { data: src } = await db.from("content_sources").select("entry_count").eq("id", id).single();
  const { error } = await db
    .from("content_sources")
    .update({
      last_scraped_at: new Date().toISOString(),
      entry_count: (src?.entry_count ?? 0) + count,
      status: "active",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function getContentStats(): Promise<ContentStats> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_entries")
    .select("type, region, verified");
  if (error) throw error;
  const entries = data ?? [];
  const byType = { route: 0, accommodation: 0, restaurant: 0 };
  const regionCounts: Record<string, number> = {};
  let verified = 0;
  for (const e of entries) {
    if (e.verified) verified++;
    if (e.type === "route") byType.route++;
    else if (e.type === "accommodation") byType.accommodation++;
    else if (e.type === "restaurant") byType.restaurant++;
    if (e.region) regionCounts[e.region] = (regionCounts[e.region] ?? 0) + 1;
  }
  const topRegions = Object.entries(regionCounts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return { total: entries.length, verified, byType, topRegions };
}
