"use client";
import { useEffect, useState } from "react";
import { Users, Map, FileText, Bot, TrendingUp, CheckCircle2, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

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

const TOOLTIP_STYLE = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor: { fill: "rgba(45,212,191,0.06)" },
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [regions, setRegions]   = useState<RegionRow[]>([]);
  const [loading, setLoading]   = useState(true);

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

  if (loading) {
    return (
      <div>
        <PageHeader title="Analytics" description="Platform usage and growth metrics." />
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      </div>
    );
  }
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
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Platform usage and growth metrics." />

      {/* KPI grid — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <KPICard label="Total users"     value={overview.totalUsers}     icon={Users}       accent="teal" />
        <KPICard label="New (30d)"       value={overview.recentSignups}  icon={TrendingUp}  accent="teal" />
        <KPICard label="Adventures"      value={overview.totalAdventures} icon={Map}        accent="blue" />
        <KPICard label="Content entries" value={overview.totalContent}   icon={FileText}    accent="blue" />
        <KPICard label="Agent runs"      value={overview.totalAgentRuns} icon={Bot}         accent="blend" />
        <KPICard label="Success rate"    value={`${overview.successRate}%`} icon={CheckCircle2} accent="green" />
      </div>

      {/* Signups chart */}
      <div className="border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-6">Daily signups — last 14 days</h2>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={signupChartData} barSize={22}>
              <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="signups" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Region + agent runs */}
      <div className="grid grid-cols-2 gap-6">
        {/* Region breakdown */}
        <div className="border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-4">Top regions — verified content</h2>
          {regions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Map className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-900 mb-1">No regions yet</p>
              <p className="text-sm text-slate-500">Verified content entries will populate this list.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {regions.slice(0, 10).map((r) => {
                const maxTotal = regions[0]?.total ?? 1;
                const pct = Math.round((r.total / maxTotal) * 100);
                return (
                  <div key={r.region}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-dark font-medium truncate max-w-[160px]">{r.region || "Unknown"}</span>
                      <div className="flex items-center gap-3 text-xs text-grey-500">
                        <span>{r.routes}r · {r.accommodations}a · {r.restaurants}f</span>
                        <span className="font-semibold text-dark w-6 text-right">{r.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent agent runs */}
        <div className="border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-4">Recent agent runs</h2>
          {recentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-900 mb-1">No agent runs yet</p>
              <p className="text-sm text-slate-500">Scout agent runs will appear here once triggered.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => {
                const durationMs = run.completed_at
                  ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
                  : null;
                const durationStr = durationMs != null
                  ? `${Math.round(durationMs / 1000)}s`
                  : "running";

                return (
                  <div key={run.id} className="flex items-center justify-between py-2 border-b border-grey-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge value={run.status} />
                      <span className="text-xs text-grey-500">{formatDate(run.started_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-grey-700">
                      {run.routes_found != null && <span>{run.routes_found}r</span>}
                      {run.accommodations_found != null && <span>{run.accommodations_found}a</span>}
                      {run.restaurants_found != null && <span>{run.restaurants_found}f</span>}
                      <span className="text-grey-400">{durationStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
