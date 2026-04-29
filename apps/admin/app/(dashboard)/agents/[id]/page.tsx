"use client";
import { use, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, Bot, CheckCircle2, PauseCircle, AlertCircle,
  Play, Pause, Settings, DollarSign, MapPin, Megaphone, TrendingUp,
  Clock, CheckCircle, XCircle, Edit2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

// ─── Agent registry ───────────────────────────────────────────────────────────

const AGENT_REGISTRY: Record<string, {
  name:        string;
  description: string;
  icon:        React.ElementType;
  status:      "active" | "paused" | "error";
  budget:      { monthly: number; monthlyUsed: number; weekly: number; weeklyUsed: number };
  metric:      { label: string; value: string };
  runFrequency: string;
}> = {
  cfo: {
    name: "CFO Agent",
    description: "Governs all agent spend, generates monthly plans, weekly scenarios, and manages spend authorisations against platform budget policy.",
    icon: DollarSign,
    status: "active",
    budget: { monthly: 120, monthlyUsed: 47.20, weekly: 25, weeklyUsed: 12.40 },
    metric: { label: "Spend decisions this month", value: "34" },
    runFrequency: "Continuous (event-driven)",
  },
  "location-scout": {
    name: "Location Scout",
    description: "Autonomously discovers and catalogues new destinations, accommodations, and restaurants by scraping and enriching public data sources.",
    icon: MapPin,
    status: "active",
    budget: { monthly: 80, monthlyUsed: 31.50, weekly: 20, weeklyUsed: 8.10 },
    metric: { label: "Entries created this month", value: "128" },
    runFrequency: "Every 4 hours",
  },
  marketing: {
    name: "Marketing Agent",
    description: "Manages email campaigns, push notifications, social media scheduling, and user re-engagement flows based on behavioural triggers.",
    icon: Megaphone,
    status: "active",
    budget: { monthly: 150, monthlyUsed: 88.60, weekly: 30, weeklyUsed: 19.80 },
    metric: { label: "Campaigns dispatched this month", value: "12" },
    runFrequency: "Every 2 hours",
  },
  pricing: {
    name: "Pricing Agent",
    description: "Optimises commission rates, monitors competitor pricing, and adjusts partner rates to maximise revenue without sacrificing conversion.",
    icon: TrendingUp,
    status: "paused",
    budget: { monthly: 60, monthlyUsed: 22.40, weekly: 15, weeklyUsed: 0 },
    metric: { label: "Rate adjustments this month", value: "0" },
    runFrequency: "Daily at 02:00 UTC",
  },
};

// ─── Mock messages ────────────────────────────────────────────────────────────

const MESSAGES_BY_AGENT: Record<string, { type: string; message: string; timestamp: string }[]> = {
  cfo: [
    { type: "DECISION", message: "Auto-approved Location Scout request: $0.85 accommodation scrape — within threshold", timestamp: "28 Apr, 09:14" },
    { type: "ALERT",    message: "Marketing monthly spend at 59% with 11 days remaining — monitoring", timestamp: "28 Apr, 08:30" },
    { type: "DECISION", message: "Denied Pricing Agent request: $4.50 competitor scrape — agent is paused", timestamp: "27 Apr, 18:20" },
    { type: "PLAN",     message: "Generated May 2026 monthly plan — total proposed: $465.00 — awaiting approval", timestamp: "27 Apr, 06:00" },
    { type: "SCENARIO", message: "Generated weekly scenarios for 28 Apr–4 May — Base scenario auto-applied ($87.40)", timestamp: "27 Apr, 00:00" },
  ],
  "location-scout": [
    { type: "CREATED",  message: "Added 12 accommodation listings in Algarve, Portugal — all images validated", timestamp: "28 Apr, 09:02" },
    { type: "CREATED",  message: "Catalogued 8 restaurants in Barcelona — TheFork IDs matched for 6", timestamp: "28 Apr, 08:15" },
    { type: "CREATED",  message: "Added 14 destination entries for Maldives — photos enriched via Unsplash API", timestamp: "27 Apr, 14:30" },
    { type: "WARNING",  message: "3 listings rejected: duplicate detection triggered — skipped and flagged", timestamp: "27 Apr, 12:00" },
    { type: "CREATED",  message: "Geocoded 85 destination coordinates via Mapbox — zero failures", timestamp: "26 Apr, 09:10" },
  ],
  marketing: [
    { type: "SENT",      message: "Welcome email sequence dispatched to 23 new signups from last 24 hours", timestamp: "28 Apr, 08:52" },
    { type: "SCHEDULED", message: "3 Instagram posts queued for 12:00, 18:30, 20:00 today", timestamp: "28 Apr, 07:45" },
    { type: "DRAFTED",   message: "Re-engagement campaign drafted for 312 inactive users — awaiting CFO approval", timestamp: "26 Apr, 16:00" },
    { type: "SENT",      message: "3-day post-trip review request dispatched to 62 users", timestamp: "27 Apr, 11:40" },
    { type: "PUBLISHED", message: "TikTok carousel published: 'Top 5 beach destinations for families'", timestamp: "26 Apr, 10:00" },
  ],
  pricing: [
    { type: "PAUSED",   message: "Agent paused pending commission model review — no actions taken", timestamp: "25 Apr, 14:00" },
    { type: "DECISION", message: "CFO denied competitor scrape request: $4.50 — paused agent cannot spend", timestamp: "27 Apr, 18:20" },
    { type: "INFO",     message: "Last active run completed: 4 commission rate adjustments across 2 partners", timestamp: "24 Apr, 02:00" },
  ],
};

// ─── Mock spend log ───────────────────────────────────────────────────────────

const SPEND_BY_AGENT: Record<string, { date: string; action: string; amount: number; status: string }[]> = {
  cfo: [
    { date: "28 Apr", action: "Weekly scenario generation (GPT-4o calls)", amount: 0.14, status: "approved" },
    { date: "27 Apr", action: "Monthly plan generation + analysis",         amount: 0.82, status: "approved" },
    { date: "26 Apr", action: "Daily financial health check",                amount: 0.08, status: "approved" },
  ],
  "location-scout": [
    { date: "28 Apr", action: "Scrape 50 accommodation listings — Algarve",  amount: 0.85, status: "approved" },
    { date: "28 Apr", action: "Validate 30 restaurants via TheFork API",      amount: 0.22, status: "approved" },
    { date: "26 Apr", action: "Geocode 85 destinations via Mapbox",           amount: 0.17, status: "approved" },
  ],
  marketing: [
    { date: "28 Apr", action: "Welcome email batch — 23 users",              amount: 0.42, status: "approved" },
    { date: "28 Apr", action: "Generate 3 Instagram posts",                   amount: 0.38, status: "approved" },
    { date: "26 Apr", action: "Re-engagement campaign generation — 312 users", amount: 1.24, status: "pending" },
  ],
  pricing: [
    { date: "24 Apr", action: "Commission rate analysis — 4 partners",        amount: 0.44, status: "approved" },
    { date: "24 Apr", action: "Competitor rate monitoring — 12 platforms",    amount: 4.50, status: "denied"   },
  ],
};

// ─── Trend chart data ──────────────────────────────────────────────────────────

const TREND_BY_AGENT: Record<string, { day: string; spend: number }[]> = {
  cfo:              [
    { day: "22 Apr", spend: 8.2 }, { day: "23 Apr", spend: 9.1 }, { day: "24 Apr", spend: 7.8 },
    { day: "25 Apr", spend: 11.0 }, { day: "26 Apr", spend: 8.4 }, { day: "27 Apr", spend: 9.6 }, { day: "28 Apr", spend: 5.2 },
  ],
  "location-scout": [
    { day: "22 Apr", spend: 12.4 }, { day: "23 Apr", spend: 8.6 }, { day: "24 Apr", spend: 14.2 },
    { day: "25 Apr", spend: 9.8  }, { day: "26 Apr", spend: 11.5 }, { day: "27 Apr", spend: 13.0 }, { day: "28 Apr", spend: 6.4 },
  ],
  marketing:        [
    { day: "22 Apr", spend: 22.1 }, { day: "23 Apr", spend: 18.4 }, { day: "24 Apr", spend: 25.3 },
    { day: "25 Apr", spend: 19.7 }, { day: "26 Apr", spend: 21.0 }, { day: "27 Apr", spend: 23.8 }, { day: "28 Apr", spend: 7.3 },
  ],
  pricing:          [
    { day: "22 Apr", spend: 5.2 }, { day: "23 Apr", spend: 4.8 }, { day: "24 Apr", spend: 5.6 },
    { day: "25 Apr", spend: 0 }, { day: "26 Apr", spend: 0 }, { day: "27 Apr", spend: 0 }, { day: "28 Apr", spend: 0 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MSG_TYPE_COLOR: Record<string, string> = {
  DECISION:  "bg-blue-light text-blue",
  ALERT:     "bg-warning-light text-warning",
  CREATED:   "bg-green-light text-green-dark",
  WARNING:   "bg-warning-light text-warning",
  SENT:      "bg-teal-light text-teal-dark",
  SCHEDULED: "bg-lavender text-charcoal",
  DRAFTED:   "bg-blue-light text-blue",
  PUBLISHED: "bg-green-light text-green-dark",
  PLAN:      "bg-blue-light text-blue",
  SCENARIO:  "bg-lavender text-charcoal",
  PAUSED:    "bg-grey-100 text-grey-700",
  INFO:      "bg-grey-100 text-grey-700",
};

function formatUsd(n: number): string { return `$${n.toFixed(2)}`; }

function budgetBar(pct: number): string {
  if (pct >= 0.8) return "bg-danger";
  if (pct >= 0.6) return "bg-warning";
  return "bg-teal";
}

const TOOLTIP_STYLE = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor:  { fill: "rgba(148,163,184,0.06)" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const agent = AGENT_REGISTRY[id];

  const [status, setStatus] = useState(agent?.status ?? "active");
  const [editBudget, setEditBudget] = useState(false);
  const [newBudget,  setNewBudget]  = useState(agent?.budget.monthly ?? 0);

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-grey-100 flex items-center justify-center mb-4">
          <Bot size={24} className="text-grey-400" />
        </div>
        <h2 className="text-lg font-semibold text-dark mb-2">Agent not found</h2>
        <p className="text-sm text-grey-500 mb-6">No agent with ID "{id}" exists in the registry.</p>
        <Link href="/agents" className="text-sm text-teal-dark hover:text-teal font-medium flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Agent Operations
        </Link>
      </div>
    );
  }

  const AgentIcon  = agent.icon;
  const messages   = MESSAGES_BY_AGENT[id] ?? [];
  const spendLog   = SPEND_BY_AGENT[id]    ?? [];
  const trendData  = TREND_BY_AGENT[id]    ?? [];

  const weeklyPct  = agent.budget.weeklyUsed  / agent.budget.weekly;
  const monthlyPct = agent.budget.monthlyUsed / agent.budget.monthly;

  const StatusIcon  = status === "active" ? CheckCircle2 : status === "paused" ? PauseCircle : AlertCircle;
  const statusColor = status === "active" ? "text-green-dark" : status === "paused" ? "text-grey-500" : "text-danger";

  return (
    <div>
      <PageHeader
        title={agent.name}
        description={agent.description}
        actions={
          <Link
            href="/agents"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={14} /> All agents
          </Link>
        }
      />

      {/* ── Profile header card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Icon + status */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-teal-light flex items-center justify-center">
              <AgentIcon size={24} className="text-teal-dark" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("flex items-center gap-1.5 text-sm font-semibold", statusColor)}>
                  <StatusIcon size={15} />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
              <p className="text-xs text-grey-400 mt-0.5">Runs: {agent.runFrequency}</p>
            </div>
          </div>

          {/* Budget bars */}
          <div className="flex-1 grid grid-cols-2 gap-6">
            {/* Weekly */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-grey-500">Weekly budget</span>
                <span className="text-xs font-mono text-dark">
                  {formatUsd(agent.budget.weeklyUsed)} <span className="text-grey-400">/ {formatUsd(agent.budget.weekly)}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-grey-100 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", budgetBar(weeklyPct))}
                  style={{ width: `${Math.min(weeklyPct * 100, 100)}%` }}
                />
              </div>
            </div>
            {/* Monthly */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-grey-500">Monthly budget</span>
                <span className="text-xs font-mono text-dark">
                  {formatUsd(agent.budget.monthlyUsed)} <span className="text-grey-400">/ {formatUsd(agent.budget.monthly)}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-grey-100 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", budgetBar(monthlyPct))}
                  style={{ width: `${Math.min(monthlyPct * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Metric */}
          <div className="shrink-0 text-right border-l border-grey-100 pl-6">
            <p className="text-xs text-grey-500">{agent.metric.label}</p>
            <p className="text-3xl font-bold font-mono text-dark mt-0.5">{agent.metric.value}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-5 pt-5 border-t border-grey-100">
          {status === "active" ? (
            <button
              onClick={() => setStatus("paused")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:border-warning hover:text-warning hover:bg-warning-light/30 transition-colors"
            >
              <Pause size={14} /> Pause agent
            </button>
          ) : (
            <button
              onClick={() => setStatus("active")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal-dark transition-colors shadow-sm"
            >
              <Play size={14} /> Resume agent
            </button>
          )}

          {!editBudget ? (
            <button
              onClick={() => setEditBudget(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={14} /> Adjust budget
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-grey-500">Monthly budget:</span>
              <span className="text-grey-400 text-sm">$</span>
              <input
                type="number"
                value={newBudget}
                onChange={e => setNewBudget(Number(e.target.value))}
                className="w-24 text-sm font-mono text-dark border border-teal rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <button
                onClick={() => setEditBudget(false)}
                className="px-3 py-1.5 rounded-lg bg-teal text-white text-xs font-semibold hover:bg-teal-dark transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setEditBudget(false); setNewBudget(agent.budget.monthly); }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {id === "cfo" && (
            <Link
              href="/agents/cfo"
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-navy text-white text-sm font-semibold hover:bg-navy-light transition-colors shadow-sm"
            >
              <DollarSign size={14} /> CFO Command Centre
            </Link>
          )}
        </div>
      </div>

      {/* ── Bottom two-column layout ── */}
      <div className="grid grid-cols-5 gap-6 mb-8">
        {/* Message history */}
        <div className="col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-grey-100">
            <Bot size={15} className="text-teal" />
            <h2 className="text-sm font-semibold text-dark">Message history</h2>
          </div>
          <div className="divide-y divide-grey-50">
            {messages.length === 0 ? (
              <div className="py-12 text-center text-sm text-grey-400">No messages recorded for this agent.</div>
            ) : messages.map((msg, i) => (
              <div key={i} className="flex gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 h-fit mt-0.5 whitespace-nowrap",
                  MSG_TYPE_COLOR[msg.type] ?? "bg-grey-100 text-grey-700"
                )}>
                  {msg.type}
                </span>
                <div>
                  <p className="text-xs text-dark leading-snug">{msg.message}</p>
                  <p className="text-[10px] text-grey-400 mt-1 flex items-center gap-1">
                    <Clock size={9} /> {msg.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spend authorisations */}
        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-grey-100">
            <DollarSign size={15} className="text-teal" />
            <h2 className="text-sm font-semibold text-dark">Spend authorisations</h2>
          </div>
          <div className="divide-y divide-grey-50">
            {spendLog.length === 0 ? (
              <div className="py-12 text-center text-sm text-grey-400">No spend recorded for this agent.</div>
            ) : spendLog.map((row, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-dark leading-snug">{row.action}</p>
                  <p className="text-[10px] text-grey-400 mt-1">{row.date}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="font-mono text-xs font-semibold text-dark">{formatUsd(row.amount)}</span>
                  <StatusBadge value={row.status} dot={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cost trend chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-6">Daily spend — last 7 days</p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2DD4BF" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatUsd(v)} />
              <Area
                type="monotone"
                dataKey="spend"
                name="Daily spend"
                stroke="#2DD4BF"
                strokeWidth={2.5}
                fill="url(#gSpend)"
                dot={{ r: 3, fill: "#2DD4BF", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
