"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from "recharts";
import {
  Settings, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  Plus, Edit2, Trash2, ChevronDown, ChevronRight, ArrowRight,
  Info, DollarSign, Zap, Filter,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CFOTab = "plan" | "scenarios" | "infrastructure" | "forecasts" | "spend-log";

// ─── Design tokens ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor: { fill: "rgba(148,163,184,0.06)" },
};

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function budgetBar(pct: number): string {
  if (pct >= 0.8) return "bg-danger";
  if (pct >= 0.6) return "bg-warning";
  return "bg-teal";
}

// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// TAB 1 — MONTHLY PLAN
// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const INITIAL_PLAN_AGENTS = [
  {
    id: "cfo",
    name: "CFO Agent",
    lastBudget: 120.00,
    lastActual: 89.40,
    proposed:   120.00,
    priority:   "Critical",
    rationale:  "Core governance layer — maintains financial oversight of all agents",
    activities: ["Weekly scenario generation", "Monthly plan review", "Spend authorisation decisions"],
  },
  {
    id: "location-scout",
    name: "Location Scout",
    lastBudget: 80.00,
    lastActual: 74.20,
    proposed:   95.00,
    priority:   "High",
    rationale:  "Content pipeline increase to support Q2 destination growth target",
    activities: ["Daily destination scraping (EU focus)", "Photo validation & dedup", "Review aggregation & scoring"],
  },
  {
    id: "marketing",
    name: "Marketing Agent",
    lastBudget: 150.00,
    lastActual: 163.80,
    proposed:   160.00,
    priority:   "High",
    rationale:  "Exceeded budget by 9.2% but delivered 34% uplift in activation — revised ceiling applied",
    activities: ["Email campaigns (welcome, re-engagement)", "Push notifications", "Social content scheduling"],
  },
  {
    id: "pricing",
    name: "Pricing Agent",
    lastBudget: 60.00,
    lastActual: 22.40,
    proposed:   40.00,
    priority:   "Medium",
    rationale:  "Reduced allocation — paused pending commission model review completion",
    activities: ["Commission rate optimisation", "Partner rate monitoring"],
  },
];

const PERF_CHART_DATA = [
  { agent: "CFO",       budget: 120, actual: 89  },
  { agent: "Scout",     budget: 80,  actual: 74  },
  { agent: "Marketing", budget: 150, actual: 164 },
  { agent: "Pricing",   budget: 60,  actual: 22  },
];

function MonthlyPlanTab() {
  const [agents, setAgents]         = useState(INITIAL_PLAN_AGENTS);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [adminNotes, setAdminNotes] = useState("");
  const [planStatus, setPlanStatus] = useState<"pending" | "approved" | "rejected">("pending");

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateProposed(id: string, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setAgents(prev => prev.map(a => a.id === id ? { ...a, proposed: num } : a));
    }
  }

  const totalProposed = agents.reduce((s, a) => s + a.proposed, 0);
  const reserve = 50.00;
  const grandTotal = totalProposed + reserve;

  return (
    <div className="space-y-8">
      {/* ── Plan status banner ── */}
      {planStatus === "pending" && (
        <div className="border-l-4 border-warning bg-warning-light rounded-r-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock size={17} className="text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-dark">May 2026 plan awaiting approval</p>
              <p className="text-xs text-grey-500 mt-0.5">Proposed by CFO Agent on 28 Apr · deadline 3 May</p>
            </div>
          </div>
          <StatusBadge value="pending" />
        </div>
      )}
      {planStatus === "approved" && (
        <div className="border-l-4 border-green-600 bg-green-light rounded-r-xl p-4 flex items-center gap-3">
          <CheckCircle2 size={17} className="text-green-dark shrink-0" />
          <p className="text-sm font-semibold text-dark">May 2026 plan approved</p>
        </div>
      )}

      {/* ── Budget table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Per-agent budget — May 2026</h2>
          <span className="text-xs text-grey-400">Click proposed budget to edit</span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
              <th className="text-left px-6 py-3 w-8" />
              <th className="text-left px-6 py-3">Agent</th>
              <th className="text-right px-6 py-3">Last month budget</th>
              <th className="text-right px-6 py-3">Last month actual</th>
              <th className="text-right px-6 py-3">Proposed budget</th>
              <th className="text-center px-6 py-3">Priority</th>
              <th className="text-left px-6 py-3">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => {
              const variance    = agent.lastActual - agent.lastBudget;
              const isExpanded  = expanded.has(agent.id);
              return (
                <React.Fragment key={agent.id}>
                  <tr
                    className="border-b border-grey-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(agent.id)}
                  >
                    <td className="px-4 py-3 text-grey-400">
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </td>
                    <td className="px-6 py-3 font-medium text-dark">{agent.name}</td>
                    <td className="px-6 py-3 text-right font-mono text-grey-700">{formatUsd(agent.lastBudget)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={cn("font-mono font-semibold", variance > 0 ? "text-danger" : "text-green-dark")}>
                        {formatUsd(agent.lastActual)}
                      </span>
                      {variance !== 0 && (
                        <span className={cn("text-[10px] ml-1", variance > 0 ? "text-danger" : "text-green-dark")}>
                          ({variance > 0 ? "+" : ""}{formatUsd(variance)})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-grey-400 text-xs">$</span>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          value={agent.proposed}
                          onChange={e => updateProposed(agent.id, e.target.value)}
                          className="w-20 text-right font-mono font-semibold text-dark bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        agent.priority === "Critical" ? "bg-danger-light text-danger" :
                        agent.priority === "High"     ? "bg-blue-light text-blue" :
                                                        "bg-grey-100 text-grey-700"
                      )}>
                        {agent.priority}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-grey-500 max-w-[240px]">{agent.rationale}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${agent.id}-exp`} className="border-b border-grey-50 bg-slate-50">
                      <td />
                      <td colSpan={6} className="px-6 py-3">
                        <p className="text-xs font-semibold text-grey-500 uppercase tracking-wide mb-2">Planned activities</p>
                        <ul className="space-y-1">
                          {agent.activities.map(act => (
                            <li key={act} className="flex items-center gap-2 text-xs text-grey-700">
                              <span className="w-1 h-1 rounded-full bg-teal inline-block shrink-0" />
                              {act}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {/* Reserve row */}
            <tr className="border-b border-grey-50 bg-slate-50">
              <td />
              <td className="px-6 py-3 font-medium text-grey-500 italic">Reserve</td>
              <td colSpan={2} />
              <td className="px-6 py-3 text-right font-mono font-semibold text-grey-700">{formatUsd(reserve)}</td>
              <td colSpan={2} />
            </tr>
            {/* Total row */}
            <tr className="bg-navy/3">
              <td />
              <td className="px-6 py-4 font-bold text-dark">Total</td>
              <td className="px-6 py-4 text-right font-mono font-bold text-dark">
                {formatUsd(agents.reduce((s, a) => s + a.lastBudget, 0))}
              </td>
              <td className="px-6 py-4 text-right font-mono font-bold text-dark">
                {formatUsd(agents.reduce((s, a) => s + a.lastActual, 0))}
              </td>
              <td className="px-6 py-4 text-right font-mono font-bold text-teal">{formatUsd(grandTotal)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Last month performance ── */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-5">Last month: budget vs actual</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={PERF_CHART_DATA} barGap={4}>
                <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="agent" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatUsd(v)} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="budget" name="Budget"  fill="#CBD5E1" radius={[4,4,0,0]} barSize={16} />
                <Bar dataKey="actual" name="Actual"  fill="#2DD4BF" radius={[4,4,0,0]} barSize={16} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Revenue forecast — May</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-grey-500">MRR (current)</p>
              <p className="text-xl font-bold font-mono text-dark mt-0.5">$0</p>
            </div>
            <div>
              <p className="text-xs text-grey-500">MRR (projected)</p>
              <p className="text-xl font-bold font-mono text-teal-dark mt-0.5">$240</p>
            </div>
            <div>
              <p className="text-xs text-grey-500">Commissions (proj.)</p>
              <p className="text-xl font-bold font-mono text-blue mt-0.5">$180</p>
            </div>
          </div>
          <div className="pt-2 border-t border-grey-100 space-y-2">
            <p className="text-xs font-semibold text-grey-500 uppercase tracking-wide">Highlights</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-grey-700">
                <CheckCircle2 size={12} className="text-green-dark shrink-0 mt-0.5" />
                Marketing exceeded budget by 9.2% but drove 34% activation increase
              </li>
              <li className="flex items-start gap-2 text-xs text-grey-700">
                <CheckCircle2 size={12} className="text-green-dark shrink-0 mt-0.5" />
                Location Scout delivered 128 entries — 28% above monthly target
              </li>
              <li className="flex items-start gap-2 text-xs text-grey-700">
                <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
                Pricing Agent utilised only 37% of allocation — pause under review
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Risks & recommendations ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">CFO Risks &amp; Recommendations</p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-danger mb-2 uppercase tracking-wide">Risks</p>
            <ul className="space-y-2">
              {[
                "Marketing overspend trend may compound without a hard ceiling in May",
                "Pricing Agent pause reduces commission revenue optimisation capability",
              ].map(r => (
                <li key={r} className="flex items-start gap-2 text-xs text-grey-700">
                  <AlertTriangle size={12} className="text-danger shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-teal-dark mb-2 uppercase tracking-wide">Recommendations</p>
            <ul className="space-y-2">
              {[
                "Approve revised plan with Marketing hard ceiling at $160",
                "Set Pricing Agent to auto-resume 1 May pending commission review sign-off",
              ].map(r => (
                <li key={r} className="flex items-start gap-2 text-xs text-grey-700">
                  <CheckCircle2 size={12} className="text-teal-dark shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Admin notes + action buttons ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-2">Admin notes</label>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Add notes or conditions for this plan approval…"
            rows={3}
            className="w-full text-sm text-dark bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal resize-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlanStatus("approved")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal-dark transition-colors shadow-sm"
          >
            <CheckCircle2 size={15} /> Approve Plan
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:border-slate-300 hover:bg-slate-50 transition-colors">
            <Edit2 size={14} /> Request Revision
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:border-slate-300 hover:bg-slate-50 transition-colors">
            <Edit2 size={14} /> Amend Current
          </button>
          <button
            onClick={() => setPlanStatus("rejected")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-danger/30 text-sm font-medium text-danger hover:bg-danger-light transition-colors"
          >
            <Trash2 size={14} /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// TAB 2 — WEEKLY SCENARIOS
// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const SCENARIOS = {
  optimistic: {
    key:      "optimistic",
    label:    "Optimistic",
    emoji:    "🟢",
    total:    118.50,
    risk:     "High",
    outcomes: ["Aggressive growth push", "45+ new users projected", "12 campaigns dispatched"],
    breakdown: [
      { agent: "CFO",            amount: 12.00 },
      { agent: "Location Scout", amount: 28.00 },
      { agent: "Marketing",      amount: 62.00 },
      { agent: "Pricing",        amount: 16.50 },
    ],
  },
  base: {
    key:      "base",
    label:    "Base",
    emoji:    "🟡",
    total:    87.40,
    risk:     "Medium",
    outcomes: ["Steady growth cadence", "28–35 new users projected", "8 campaigns dispatched"],
    breakdown: [
      { agent: "CFO",            amount: 10.00 },
      { agent: "Location Scout", amount: 20.00 },
      { agent: "Marketing",      amount: 47.40 },
      { agent: "Pricing",        amount: 10.00 },
    ],
  },
  conservative: {
    key:      "conservative",
    label:    "Conservative",
    emoji:    "🔴",
    total:    54.20,
    risk:     "Low",
    outcomes: ["Maintenance mode", "15–20 new users projected", "4 campaigns dispatched"],
    breakdown: [
      { agent: "CFO",            amount: 8.00 },
      { agent: "Location Scout", amount: 14.20 },
      { agent: "Marketing",      amount: 28.00 },
      { agent: "Pricing",        amount: 4.00 },
    ],
  },
};

const SCENARIO_HISTORY = [
  { week: "28 Apr – 4 May",  scenario: "base",         actual: 82.10, users: 31 },
  { week: "21–27 Apr",       scenario: "optimistic",   actual: 112.40, users: 44 },
  { week: "14–20 Apr",       scenario: "base",         actual: 79.80, users: 28 },
  { week: "7–13 Apr",        scenario: "conservative", actual: 51.20, users: 16 },
];

function WeeklyScenariosTab() {
  const [active, setActive] = useState<"optimistic" | "base" | "conservative">("base");
  const current = SCENARIOS[active];
  const currentSpend = 34.20;
  const spendPct = currentSpend / current.total;

  return (
    <div className="space-y-8">
      {/* ── Scenario cards ── */}
      <div className="grid grid-cols-3 gap-6">
        {(["optimistic", "base", "conservative"] as const).map(key => {
          const s      = SCENARIOS[key];
          const isActive = active === key;
          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border-2 shadow-sm p-6 flex flex-col gap-4 transition-all",
                isActive
                  ? "border-teal bg-teal-bg"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.emoji}</span>
                  <span className="font-semibold text-dark">{s.label}</span>
                </div>
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full",
                  s.risk === "High"   ? "bg-danger-light text-danger"   :
                  s.risk === "Medium" ? "bg-warning-light text-warning" :
                                        "bg-green-light text-green-dark"
                )}>
                  {s.risk} risk
                </span>
              </div>

              <div>
                <p className="text-xs text-grey-500">Total weekly spend</p>
                <p className="text-3xl font-bold font-mono text-dark mt-0.5">{formatUsd(s.total)}</p>
              </div>

              <div className="space-y-1.5">
                {s.breakdown.map(b => (
                  <div key={b.agent} className="flex items-center justify-between text-xs">
                    <span className="text-grey-500">{b.agent}</span>
                    <span className="font-mono text-dark">{formatUsd(b.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-grey-100 space-y-1">
                {s.outcomes.map(o => (
                  <p key={o} className="text-xs text-grey-600 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-grey-400 inline-block shrink-0" />
                    {o}
                  </p>
                ))}
              </div>

              <button
                onClick={() => setActive(key)}
                className={cn(
                  "mt-auto w-full py-2 rounded-xl text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-teal text-white cursor-default"
                    : "border border-slate-200 text-grey-700 hover:border-teal hover:text-teal bg-white"
                )}
              >
                {isActive ? "Active" : "Select"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Create custom ── */}
      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:border-teal hover:text-teal transition-colors">
          <Plus size={14} /> Create Custom Scenario
        </button>
      </div>

      {/* ── Current week status ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Current week — 28 Apr–4 May</p>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-dark">
              {SCENARIOS[active].emoji} {SCENARIOS[active].label} scenario active
            </span>
            <StatusBadge value="active" />
          </div>
          <span className="text-xs font-mono text-grey-500">
            {formatUsd(currentSpend)} <span className="text-grey-400">/ {formatUsd(current.total)}</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-grey-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", budgetBar(spendPct))}
            style={{ width: `${Math.min(spendPct * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-grey-400 mt-2">{Math.round(spendPct * 100)}% of weekly budget used · {3} days remaining</p>
      </div>

      {/* ── History ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Last 4 weeks</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
              <th className="text-left px-6 py-3">Week</th>
              <th className="text-left px-6 py-3">Scenario</th>
              <th className="text-right px-6 py-3">Budget</th>
              <th className="text-right px-6 py-3">Actual spend</th>
              <th className="text-right px-6 py-3">New users</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIO_HISTORY.map(row => {
              const s = SCENARIOS[row.scenario as keyof typeof SCENARIOS];
              return (
                <tr key={row.week} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-grey-700">{row.week}</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      {s.emoji} {s.label}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-grey-500">{formatUsd(s.total)}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{formatUsd(row.actual)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-dark">{row.users}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// TAB 3 — INFRASTRUCTURE
// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const INFRA_SUBS = [
  {
    id: "1", name: "Supabase Pro", category: "Database", monthlyCost: 25.00, billingDay: 15, status: "active",
    usage: { label: "DB storage", used: 2.4, total: 8, unit: "GB" },
  },
  {
    id: "2", name: "Vercel Pro", category: "Hosting", monthlyCost: 20.00, billingDay: 22, status: "active",
    usage: { label: "Bandwidth", used: 45, total: 100, unit: "GB" },
  },
  {
    id: "3", name: "Anthropic API", category: "AI", monthlyCost: 89.40, billingDay: 1, status: "active",
    usage: { label: "Tokens", used: 8_920_000, total: 10_000_000, unit: "tokens" },
  },
  {
    id: "4", name: "Resend", category: "Email", monthlyCost: 10.00, billingDay: 8, status: "active",
    usage: { label: "Emails sent", used: 1240, total: 3000, unit: "emails" },
  },
  {
    id: "5", name: "Expo EAS", category: "Mobile", monthlyCost: 29.00, billingDay: 3, status: "active",
    usage: { label: "Build credits", used: 12, total: 30, unit: "builds" },
  },
  {
    id: "6", name: "GitHub Team", category: "Dev", monthlyCost: 4.00, billingDay: 18, status: "active",
    usage: { label: "Actions minutes", used: 1_800, total: 3_000, unit: "min" },
  },
];

function formatUsage(used: number, total: number, unit: string): string {
  if (used >= 1_000_000) return `${(used / 1_000_000).toFixed(1)}M / ${(total / 1_000_000).toFixed(0)}M ${unit}`;
  if (used >= 1_000)     return `${(used / 1_000).toFixed(1)}k / ${(total / 1_000).toFixed(0)}k ${unit}`;
  return `${used} / ${total} ${unit}`;
}

function InfrastructureTab() {
  const totalBurn = INFRA_SUBS.reduce((s, i) => s + i.monthlyCost, 0);
  const today = 28;

  const upcoming = INFRA_SUBS
    .map(s => ({ ...s, daysUntil: s.billingDay >= today ? s.billingDay - today : 30 - today + s.billingDay }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* ── KPI bar ── */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-grey-500 mb-1">Monthly infrastructure burn</p>
          <p className="text-3xl font-bold font-mono text-dark">{formatUsd(totalBurn)}</p>
          <p className="text-xs text-grey-400 mt-1.5">{INFRA_SUBS.length} active subscriptions</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-grey-500 mb-1">Largest line item</p>
          <p className="text-3xl font-bold font-mono text-dark">$89.40</p>
          <p className="text-xs text-grey-400 mt-1.5">Anthropic API · 51% of total</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-sm text-grey-500 mb-1">Next renewal</p>
          <p className="text-3xl font-bold font-mono text-dark">3 May</p>
          <p className="text-xs text-grey-400 mt-1.5">Expo EAS · $29.00</p>
        </div>
      </div>

      {/* ── Subscriptions table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-100">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Active subscriptions</p>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-teal-dark hover:text-teal transition-colors">
            <Plus size={13} /> Add subscription
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
              <th className="text-left px-6 py-3">Service</th>
              <th className="text-left px-6 py-3">Category</th>
              <th className="text-left px-6 py-3">Usage</th>
              <th className="text-right px-6 py-3">Monthly cost</th>
              <th className="text-center px-6 py-3">Next billing</th>
              <th className="text-center px-6 py-3">Status</th>
              <th className="text-right px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {INFRA_SUBS.map(sub => {
              const pct = sub.usage.used / sub.usage.total;
              return (
                <tr key={sub.id} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-dark">{sub.name}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-grey-100 text-grey-700 px-2.5 py-1 rounded-full">{sub.category}</span>
                  </td>
                  <td className="px-6 py-4 min-w-[200px]">
                    <p className="text-xs text-grey-500 mb-1.5">{formatUsage(sub.usage.used, sub.usage.total, sub.usage.unit)}</p>
                    <div className="h-1.5 rounded-full bg-grey-100 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", budgetBar(pct))}
                        style={{ width: `${Math.min(pct * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-grey-400 mt-1">{Math.round(pct * 100)}%</p>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-dark">{formatUsd(sub.monthlyCost)}</td>
                  <td className="px-6 py-4 text-center text-xs text-grey-500">{sub.billingDay} of month</td>
                  <td className="px-6 py-4 text-center"><StatusBadge value="active" /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-grey-300 hover:text-blue transition-colors"><Edit2 size={13} /></button>
                      <button className="text-grey-300 hover:text-danger transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Renewal calendar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Upcoming renewals</p>
        <div className="space-y-3">
          {upcoming.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-grey-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                  s.daysUntil <= 3 ? "bg-danger-light text-danger" :
                  s.daysUntil <= 7 ? "bg-warning-light text-warning" :
                                     "bg-blue-light text-blue"
                )}>
                  {s.daysUntil}d
                </div>
                <div>
                  <p className="text-sm font-medium text-dark">{s.name}</p>
                  <p className="text-xs text-grey-500">Renews {s.billingDay} of each month</p>
                </div>
              </div>
              <p className="font-mono font-semibold text-dark text-sm">{formatUsd(s.monthlyCost)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// TAB 4 — FORECASTS
// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const FORECAST_DATA = [
  { month: "May",  revenue: 240,  costs: 465, net: -225 },
  { month: "Jun",  revenue: 480,  costs: 480, net: 0   },
  { month: "Jul",  revenue: 820,  costs: 490, net: 330 },
  { month: "Aug",  revenue: 1200, costs: 510, net: 690 },
  { month: "Sep",  revenue: 1680, costs: 530, net: 1150 },
  { month: "Oct",  revenue: 2200, costs: 550, net: 1650 },
];

function ForecastsTab() {
  const breakEvenIdx = FORECAST_DATA.findIndex(d => d.net >= 0);

  return (
    <div className="space-y-8">
      {/* ── KPI row ── */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "Month 1 net",           value: formatUsd(FORECAST_DATA[0]?.net ?? 0),  negative: (FORECAST_DATA[0]?.net ?? 0) < 0 },
          { label: "Break-even month",      value: breakEvenIdx >= 0 ? FORECAST_DATA[breakEvenIdx]?.month ?? "—" : "—", positive: breakEvenIdx >= 0 },
          { label: "3-month revenue (proj)", value: formatUsd(FORECAST_DATA.slice(0,3).reduce((s,d) => s+d.revenue, 0)), positive: true },
          { label: "6-month revenue (proj)", value: formatUsd(FORECAST_DATA.reduce((s,d) => s+d.revenue, 0)), positive: true },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-sm text-grey-500 mb-1">{s.label}</p>
            <p className={cn(
              "text-3xl font-bold font-mono tracking-tight",
              s.negative ? "text-danger" : s.positive ? "text-green-dark" : "text-dark"
            )}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Revenue vs cost chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">3-month revenue + cost projection</p>
          <span className="text-xs text-grey-400 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">Linear growth model</span>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={FORECAST_DATA} barGap={4}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <ReferenceLine y={0} stroke="#CBD5E1" />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatUsd(v)} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
              <Bar dataKey="revenue" name="Revenue (proj.)" fill="#22C55E" radius={[4,4,0,0]} barSize={18} fillOpacity={0.8} />
              <Bar dataKey="costs"   name="Costs (proj.)"   fill="#EF4444" radius={[4,4,0,0]} barSize={18} fillOpacity={0.6} />
              <Line dataKey="net" name="Net cash flow" stroke="#2DD4BF" strokeWidth={2.5} dot={{ r: 3, fill: "#2DD4BF" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Break-even callout ── */}
      {breakEvenIdx >= 0 && (
        <div className="border-l-4 border-teal bg-teal-bg rounded-r-xl p-5 flex items-start gap-3">
          <TrendingUp size={18} className="text-teal shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-dark">
              Break-even projected in {FORECAST_DATA[breakEvenIdx]?.month} (month {breakEvenIdx + 1})
            </p>
            <p className="text-xs text-grey-500 mt-1">
              At current trajectory revenue exceeds total costs in {FORECAST_DATA[breakEvenIdx]?.month} with a projected net of{" "}
              {formatUsd(FORECAST_DATA[breakEvenIdx]?.net ?? 0)}.
            </p>
          </div>
        </div>
      )}

      {/* ── Projection table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">6-month projection</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
              <th className="text-left px-6 py-3">Month</th>
              <th className="text-right px-6 py-3">Revenue</th>
              <th className="text-right px-6 py-3">Costs</th>
              <th className="text-right px-6 py-3">Net</th>
            </tr>
          </thead>
          <tbody>
            {FORECAST_DATA.map(row => (
              <tr key={row.month} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 font-medium text-dark">{row.month} 2026</td>
                <td className="px-6 py-3 text-right font-mono text-green-dark font-semibold">{formatUsd(row.revenue)}</td>
                <td className="px-6 py-3 text-right font-mono text-danger">{formatUsd(row.costs)}</td>
                <td className={cn(
                  "px-6 py-3 text-right font-mono font-bold",
                  row.net >= 0 ? "text-green-dark" : "text-danger"
                )}>
                  {formatUsd(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// TAB 5 — SPEND LOG
// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const SPEND_LOG = [
  { id: "a01", date: "28 Apr, 09:14", agent: "Marketing",      action: "Send re-engagement email batch (147 users)",          estimated: 0.42, approved: 0.42, status: "approved", reasoning: "Under $1.00 auto-approve threshold" },
  { id: "a02", date: "28 Apr, 08:52", agent: "Location Scout", action: "Scrape 50 accommodation listings — Algarve region",   estimated: 0.85, approved: 0.85, status: "approved", reasoning: "Under $1.00 auto-approve threshold" },
  { id: "a03", date: "28 Apr, 07:30", agent: "Marketing",      action: "Generate and schedule 3 Instagram posts",              estimated: 0.38, approved: 0.38, status: "approved", reasoning: "Auto-approved: creative content within budget" },
  { id: "a04", date: "27 Apr, 18:20", agent: "Pricing",        action: "Competitor rate scrape across 12 booking platforms",  estimated: 4.50, approved: 0,    status: "denied",   reasoning: "Denied: agent paused pending commission review" },
  { id: "a05", date: "27 Apr, 14:05", agent: "Location Scout", action: "Validate 30 restaurant listings via TheFork API",     estimated: 0.22, approved: 0.22, status: "approved", reasoning: "Auto-approved: data validation within threshold" },
  { id: "a06", date: "27 Apr, 11:40", agent: "Marketing",      action: "Send 3-day post-trip review request (62 users)",       estimated: 0.18, approved: 0.18, status: "approved", reasoning: "Auto-approved: transactional email within budget" },
  { id: "a07", date: "26 Apr, 16:00", agent: "Marketing",      action: "Generate re-engagement campaign for 312 inactive users", estimated: 1.24, approved: null, status: "pending",  reasoning: "Awaiting manual approval — exceeds auto-approve" },
  { id: "a08", date: "26 Apr, 09:10", agent: "Location Scout", action: "Geocode 85 new destination coordinates via Mapbox",   estimated: 0.17, approved: 0.17, status: "approved", reasoning: "Auto-approved: data enrichment within threshold" },
];

const SPEND_CHART_DATA = [
  { date: "22 Apr", cfo: 8.2,  scout: 12.4, marketing: 22.1, pricing: 0 },
  { date: "23 Apr", cfo: 9.1,  scout: 8.6,  marketing: 18.4, pricing: 0 },
  { date: "24 Apr", cfo: 7.8,  scout: 14.2, marketing: 25.3, pricing: 0 },
  { date: "25 Apr", cfo: 11.0, scout: 9.8,  marketing: 19.7, pricing: 0 },
  { date: "26 Apr", cfo: 8.4,  scout: 11.5, marketing: 21.0, pricing: 0 },
  { date: "27 Apr", cfo: 9.6,  scout: 13.0, marketing: 23.8, pricing: 0 },
  { date: "28 Apr", cfo: 5.2,  scout: 6.4,  marketing: 7.3,  pricing: 0 },
];

function SpendLogTab() {
  const [filterAgent,  setFilterAgent]  = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = SPEND_LOG.filter(row => {
    if (filterAgent  !== "all" && row.agent.toLowerCase().replace(" ", "-") !== filterAgent)  return false;
    if (filterStatus !== "all" && row.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* ── Stacked area chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-6">Total spend by agent — last 7 days</p>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SPEND_CHART_DATA}>
              <defs>
                {[
                  ["gCFO",       "#2DD4BF"],
                  ["gScout",     "#0A7AFF"],
                  ["gMarketing", "#6366F1"],
                  ["gPricing",   "#F59E0B"],
                ].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatUsd(v)} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
              <Area type="monotone" dataKey="cfo"       name="CFO"            stackId="1" stroke="#2DD4BF" fill="url(#gCFO)"       />
              <Area type="monotone" dataKey="scout"     name="Location Scout" stackId="1" stroke="#0A7AFF" fill="url(#gScout)"     />
              <Area type="monotone" dataKey="marketing" name="Marketing"      stackId="1" stroke="#6366F1" fill="url(#gMarketing)" />
              <Area type="monotone" dataKey="pricing"   name="Pricing"        stackId="1" stroke="#F59E0B" fill="url(#gPricing)"   />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-grey-500">
          <Filter size={13} /> Filters:
        </div>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 text-dark bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
        >
          <option value="all">All agents</option>
          <option value="cfo">CFO</option>
          <option value="location-scout">Location Scout</option>
          <option value="marketing">Marketing</option>
          <option value="pricing">Pricing</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 text-dark bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="pending">Pending</option>
        </select>
        <span className="text-xs text-grey-400 ml-auto">{filtered.length} records</span>
      </div>

      {/* ── Audit table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Spend authorisations</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-left px-6 py-3">Agent</th>
              <th className="text-left px-6 py-3">Action</th>
              <th className="text-right px-6 py-3">Estimated</th>
              <th className="text-right px-6 py-3">Approved</th>
              <th className="text-center px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">CFO reasoning</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 text-xs text-grey-500 whitespace-nowrap">{row.date}</td>
                <td className="px-6 py-3">
                  <span className="text-xs font-semibold text-grey-700">{row.agent}</span>
                </td>
                <td className="px-6 py-3 text-xs text-dark max-w-[240px]">{row.action}</td>
                <td className="px-6 py-3 text-right font-mono text-xs text-grey-700">{formatUsd(row.estimated)}</td>
                <td className="px-6 py-3 text-right font-mono text-xs font-semibold text-dark">
                  {row.approved != null ? formatUsd(row.approved) : "—"}
                </td>
                <td className="px-6 py-3 text-center"><StatusBadge value={row.status} /></td>
                <td className="px-6 py-3 text-xs text-grey-500 max-w-[200px]">{row.reasoning}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-grey-400">No records match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// PAGE
// ─── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const TABS: { key: CFOTab; label: string }[] = [
  { key: "plan",           label: "Monthly Plan" },
  { key: "scenarios",      label: "Weekly Scenarios" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "forecasts",      label: "Forecasts" },
  { key: "spend-log",      label: "Spend Log" },
];

export default function CFOCommandCentrePage() {
  const [tab, setTab] = useState<CFOTab>("plan");

  return (
    <div>
      <PageHeader
        title="CFO Command Centre"
        description="Financial governance — monthly plans, weekly scenarios, infrastructure costs, and spend authorisations."
        actions={
          <Link
            href="/agents/cfo/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Settings size={14} /> CFO Settings
          </Link>
        }
      />

      {/* ── Tab bar ── */}
      <div className="flex border-b border-slate-200 mb-8 bg-white sticky top-0 z-10 px-6 -mx-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-5 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              tab === key
                ? "border-teal text-teal"
                : "border-transparent text-grey-500 hover:text-dark hover:border-slate-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === "plan"           && <MonthlyPlanTab />}
      {tab === "scenarios"      && <WeeklyScenariosTab />}
      {tab === "infrastructure" && <InfrastructureTab />}
      {tab === "forecasts"      && <ForecastsTab />}
      {tab === "spend-log"      && <SpendLogTab />}
    </div>
  );
}
