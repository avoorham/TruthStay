import { createAdminClient } from "@/lib/supabase/admin";

export async function getAnalyticsOverview() {
  const db = createAdminClient();
  const [users, adventures, content, agentRuns] = await Promise.all([
    db.from("users").select("id, created_date", { count: "exact" }),
    db.from("adventures").select("id, createdAt", { count: "exact" }),
    db.from("content_entries").select("id, created_at, verified", { count: "exact" }),
    db.from("agent_runs").select("id, status, routes_found, accommodations_found, restaurants_found, started_at, completed_at"),
  ]);

  const totalUsers = users.count ?? 0;
  const totalAdventures = adventures.count ?? 0;
  const totalContent = content.count ?? 0;
  const totalAgentRuns = agentRuns.data?.length ?? 0;
  const successfulRuns = agentRuns.data?.filter(r => r.status === "completed").length ?? 0;

  // Last 30 days signups
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentSignups = users.data?.filter(u => u.created_date && u.created_date > thirtyDaysAgo).length ?? 0;

  // Signups by day (last 14 days)
  const signupsByDay: Record<string, number> = {};
  users.data?.forEach(u => {
    if (!u.created_date) return;
    const day = u.created_date.slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  });

  return {
    totalUsers,
    totalAdventures,
    totalContent,
    totalAgentRuns,
    successfulRuns,
    successRate: totalAgentRuns ? Math.round((successfulRuns / totalAgentRuns) * 100) : 0,
    recentSignups,
    signupsByDay,
    agentRuns: agentRuns.data ?? [],
  };
}

export async function getAgentRuns() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRegionBreakdown() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_entries")
    .select("region, type")
    .eq("verified", true);
  if (error) throw error;

  const regionMap: Record<string, { total: number; routes: number; accommodations: number; restaurants: number }> = {};
  (data ?? []).forEach(e => {
    const key = e.region ?? "Unknown";
    if (!regionMap[key]) regionMap[key] = { total: 0, routes: 0, accommodations: 0, restaurants: 0 };
    regionMap[key].total++;
    if (e.type === "route") regionMap[key].routes++;
    else if (e.type === "accommodation") regionMap[key].accommodations++;
    else if (e.type === "restaurant") regionMap[key].restaurants++;
  });

  return Object.entries(regionMap)
    .map(([region, counts]) => ({ region, ...counts }))
    .sort((a, b) => b.total - a.total);
}
