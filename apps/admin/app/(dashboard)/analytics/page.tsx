"use client";
import { useEffect, useState } from "react";
import { Users, Map, FileText, Bot, TrendingUp, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/utils";

type Overview = {
  totalUsers: number;
  totalAdventures: number;
  totalContent: number;
  totalAgentRuns: number;
  successfulRuns: number;
  successRate: number;
  recentSignups: number;
  signupsByDay: Record<string, number>;
  agentRuns: AgentRun[];
};

type AgentRun = {
  id: string;
  status: string;
  routes_found: number | null;
  accommodations_found: number | null;
  restaurants_found: number | null;
  started_at: string;
  completed_at: string | null;
};

type RegionRow = {
  region: string;
  total: number;
  routes: number;
  accommodations: number;
  restaurants: number;
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/analytics/overview").then((r) => r.json()),
      fetch("/api/admin/analytics/regions").then((r) => r.json()),
    ]).then(([ov, reg]) => {
      setOverview(ov);
      setRegions(reg);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>;
  if (!overview) return null;

  // Build chart data: last 14 days
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const signupChartData = chartDays.map((day) => ({
    day: day.slice(5),
    signups: overview.signupsByDay[day] ?? 0,
  }));

  const recentRuns = overview.agentRuns.slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Platform usage and growth metrics." />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total users" value={overview.totalUsers} icon={Users} />
        <KPICard label="New (30d)" value={overview.recentSignups} icon={TrendingUp} />
        <KPICard label="Adventures" value={overview.totalAdventures} icon={Map} />
        <KPICard label="Content entries" value={overview.totalContent} icon={FileText} />
        <KPICard label="Agent runs" value={overview.totalAgentRuns} icon={Bot} />
        <KPICard label="Success rate" value={`${overview.successRate}%`} icon={CheckCircle2} />
      </div>

      {/* Signups chart */}
      <div className="bg-white border border-grey-300 rounded-xl p-5">
        <h2 className="font-display font-semibold text-dark text-sm mb-4">Daily signups (last 14 days)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={signupChartData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DADCE0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DADCE0" }}
              cursor={{ fill: "#F3F4F6" }}
            />
            <Bar dataKey="signups" fill="#0A7AFF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Region breakdown */}
        <div className="bg-white border border-grey-300 rounded-xl p-5">
          <h2 className="font-display font-semibold text-dark text-sm mb-3">Top regions (verified content)</h2>
          {regions.length === 0 ? (
            <p className="text-grey-500 text-sm">No verified content yet.</p>
          ) : (
            <div className="space-y-2">
              {regions.slice(0, 10).map((r) => (
                <div key={r.region} className="flex items-center justify-between text-sm">
                  <span className="text-dark font-medium truncate max-w-[140px]">{r.region || "Unknown"}</span>
                  <div className="flex items-center gap-2 text-xs text-grey-700">
                    <span>{r.routes}r</span>
                    <span>{r.accommodations}a</span>
                    <span>{r.restaurants}f</span>
                    <span className="font-semibold text-dark w-8 text-right">{r.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent agent runs */}
        <div className="bg-white border border-grey-300 rounded-xl p-5">
          <h2 className="font-display font-semibold text-dark text-sm mb-3">Recent agent runs</h2>
          {recentRuns.length === 0 ? (
            <p className="text-grey-500 text-sm">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={run.status} />
                    <span className="text-xs text-grey-700">{formatDate(run.started_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-grey-700">
                    {run.routes_found != null && <span>{run.routes_found}r</span>}
                    {run.accommodations_found != null && <span>{run.accommodations_found}a</span>}
                    {run.restaurants_found != null && <span>{run.restaurants_found}f</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
