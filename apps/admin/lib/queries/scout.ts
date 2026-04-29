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
