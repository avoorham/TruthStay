"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Bot, CheckCircle2, PauseCircle, AlertCircle, ArrowRight,
  Clock, Zap, Settings, TrendingUp, MapPin, Megaphone, DollarSign,
  Check, X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "paused" | "error";

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  weeklyBudget:  { used: number; total: number };
  monthlyBudget: { used: number; total: number };
  lastRun:       string;
  lastRunStatus: string;
  metric:        { label: string; value: string };
  href:          string;
  icon:          React.ElementType;
}

interface SpendRequest {
  id:          string;
  agent:       string;
  action:      string;
  estimated:   number;
  requestedAt: string;
}

interface AgentMessage {
  id:        string;
  agent:     string;
  type:      string;
  message:   string;
  timestamp: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const AGENTS: AgentConfig[] = [
  {
    id: "cfo",
    name: "CFO Agent",
    description: "Financial governance, spend authorisation, and monthly budget allocation",
    status: "active",
    weeklyBudget:  { used: 12.40, total: 25.00 },
    monthlyBudget: { used: 47.20, total: 120.00 },
    lastRun: "2 minutes ago",
    lastRunStatus: "completed",
    metric: { label: "Decisions this month", value: "34" },
    href: "/agents/cfo",
    icon: DollarSign,
  },
  {
    id: "location-scout",
    name: "Location Scout",
    description: "Discovers and catalogues new destinations, accommodations, and restaurants",
    status: "active",
    weeklyBudget:  { used: 8.10, total: 20.00 },
    monthlyBudget: { used: 31.50, total: 80.00 },
    lastRun: "18 minutes ago",
    lastRunStatus: "completed",
    metric: { label: "Entries created this month", value: "128" },
    href: "/agents/location-scout",
    icon: MapPin,
  },
  {
    id: "marketing",
    name: "Marketing Agent",
    description: "Campaigns, social posts, and user re-engagement automation",
    status: "active",
    weeklyBudget:  { used: 19.80, total: 30.00 },
    monthlyBudget: { used: 88.60, total: 150.00 },
    lastRun: "1 hour ago",
    lastRunStatus: "completed",
    metric: { label: "Campaigns sent this month", value: "12" },
    href: "/agents/marketing",
    icon: Megaphone,
  },
  {
    id: "pricing",
    name: "Pricing Agent",
    description: "Dynamic pricing, commission optimisation, and partner rate management",
    status: "paused",
    weeklyBudget:  { used: 0.00, total: 15.00 },
    monthlyBudget: { used: 22.40, total: 60.00 },
    lastRun: "3 days ago",
    lastRunStatus: "paused",
    metric: { label: "Adjustments made this month", value: "0" },
    href: "/agents/pricing",
    icon: TrendingUp,
  },
];

const PENDING_REQUESTS: SpendRequest[] = [
  {
    id: "req_001",
    agent: "Location Scout",
    action: "Scrape 50 new accommodation listings via Booking.com API",
    estimated: 0.85,
    requestedAt: "10 minutes ago",
  },
  {
    id: "req_002",
    agent: "Marketing",
    action: "Generate re-engagement email batch for 312 inactive users",
    estimated: 1.24,
    requestedAt: "34 minutes ago",
  },
  {
    id: "req_003",
    agent: "Marketing",
    action: "Schedule and publish 4 Instagram posts for this week",
    estimated: 0.38,
    requestedAt: "1 hour ago",
  },
];

const RECENT_MESSAGES: AgentMessage[] = [
  {
    id: "m1", agent: "CFO",
    type: "DECISION",
    message: "Approved Location Scout weekly budget of $20.00 — within auto-approve threshold",
    timestamp: "09:14",
  },
  {
    id: "m2", agent: "Location Scout",
    type: "CREATED",
    message: "Added 12 new accommodation listings in Algarve, Portugal — all images validated",
    timestamp: "09:02",
  },
  {
    id: "m3", agent: "Marketing",
    type: "SENT",
    message: "Welcome email sequence dispatched to 23 new signups from last 24 hours",
    timestamp: "08:52",
  },
  {
    id: "m4", agent: "CFO",
    type: "ALERT",
    message: "Marketing monthly spend at 59% with 11 days remaining — within normal range",
    timestamp: "08:30",
  },
  {
    id: "m5", agent: "Location Scout",
    type: "CREATED",
    message: "Catalogued 8 restaurants in Barcelona — TheFork IDs matched for 6",
    timestamp: "08:15",
  },
  {
    id: "m6", agent: "Marketing",
    type: "SCHEDULED",
    message: "3 Instagram posts queued for peak engagement windows: 12:00, 18:30, 20:00",
    timestamp: "07:45",
  },
  {
    id: "m7", agent: "CFO",
    type: "DECISION",
    message: "Denied Pricing Agent request for $4.50 competitor scrape — above threshold, paused state",
    timestamp: "Yesterday",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function budgetColor(pct: number): string {
  if (pct >= 0.8) return "bg-danger";
  if (pct >= 0.6) return "bg-warning";
  return "bg-teal";
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

const MSG_TYPE_COLOR: Record<string, string> = {
  DECISION:  "bg-blue-light text-blue",
  CREATED:   "bg-green-light text-green-dark",
  SENT:      "bg-teal-light text-teal-dark",
  ALERT:     "bg-warning-light text-warning",
  SCHEDULED: "bg-lavender text-charcoal",
};

const STATUS_ICON: Record<AgentStatus, React.ElementType> = {
  active: CheckCircle2,
  paused: PauseCircle,
  error:  AlertCircle,
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  active: "text-green-dark",
  paused: "text-grey-500",
  error:  "text-danger",
};

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentConfig }) {
  const weeklyPct  = agent.weeklyBudget.used  / agent.weeklyBudget.total;
  const monthlyPct = agent.monthlyBudget.used / agent.monthlyBudget.total;
  const StatusIcon = STATUS_ICON[agent.status];
  const AgentIcon  = agent.icon;

  return (
    <div className="border border-slate-200 rounded-lg p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
            <AgentIcon size={16} className="text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dark">{agent.name}</h3>
            <p className="text-xs text-grey-500 mt-0.5 leading-snug max-w-[240px]">{agent.description}</p>
          </div>
        </div>
        {agent.id === "cfo" && (
          <Link href="/agents/cfo/settings" className="text-grey-300 hover:text-grey-500 transition-colors shrink-0">
            <Settings size={14} />
          </Link>
        )}
      </div>

      {/* Status + last run */}
      <div className="flex items-center justify-between text-xs">
        <span className={cn("flex items-center gap-1.5 font-medium", STATUS_COLOR[agent.status])}>
          <StatusIcon size={13} />
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </span>
        <span className="flex items-center gap-1 text-grey-400">
          <Clock size={11} />
          {agent.lastRun}
          <StatusBadge value={agent.lastRunStatus} dot={false} />
        </span>
      </div>

      {/* Budget bars */}
      <div className="space-y-3">
        {/* Weekly */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-grey-500">Weekly budget</span>
            <span className="text-xs font-mono text-dark">
              {formatUsd(agent.weeklyBudget.used)} <span className="text-grey-400">/ {formatUsd(agent.weeklyBudget.total)}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-grey-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", budgetColor(weeklyPct))}
              style={{ width: `${Math.min(weeklyPct * 100, 100)}%` }}
            />
          </div>
        </div>
        {/* Monthly */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-grey-500">Monthly budget</span>
            <span className="text-xs font-mono text-dark">
              {formatUsd(agent.monthlyBudget.used)} <span className="text-grey-400">/ {formatUsd(agent.monthlyBudget.total)}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-grey-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", budgetColor(monthlyPct))}
              style={{ width: `${Math.min(monthlyPct * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Agent-specific metric */}
      <div className="flex items-center justify-between pt-3 border-t border-grey-100">
        <div>
          <p className="text-xs text-grey-500">{agent.metric.label}</p>
          <p className="text-xl font-bold font-mono text-dark mt-0.5">{agent.metric.value}</p>
        </div>
        <Link
          href={agent.href}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal-dark hover:text-teal transition-colors"
        >
          View detail <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsOverviewPage() {
  const [pendingRequests, setPendingRequests] = useState<SpendRequest[]>(PENDING_REQUESTS);

  function handleApprove(id: string) {
    setPendingRequests(r => r.filter(x => x.id !== id));
  }

  function handleDeny(id: string) {
    setPendingRequests(r => r.filter(x => x.id !== id));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agent Operations"
        description="Governance overview for all autonomous agents — budgets, status, and recent activity."
        actions={
          <Link
            href="/agents/cfo"
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
          >
            <DollarSign size={14} />
            CFO Command Centre
          </Link>
        }
      />

      {/* ── Agent cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {AGENTS.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* ── Bottom two-column layout ── */}
      <div className="grid grid-cols-5 gap-6">

        {/* Pending spend requests — 60% */}
        <div className="col-span-3 border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-warning" />
              <h2 className="text-sm font-semibold text-dark">Active Spend Requests</h2>
              {pendingRequests.length > 0 && (
                <span className="bg-warning-light text-warning text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <Link
              href="/agents/cfo"
              className="text-xs font-semibold text-teal-dark hover:text-teal transition-colors flex items-center gap-1"
            >
              Full log <ArrowRight size={11} />
            </Link>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <CheckCircle2 size={40} className="text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-900 mb-1">All caught up</p>
              <p className="text-sm text-slate-500">No pending spend requests require your attention.</p>
            </div>
          ) : (
            <div className="divide-y divide-grey-50">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-grey-500 uppercase tracking-wide">{req.agent}</span>
                      <span className="text-xs text-grey-400">{req.requestedAt}</span>
                    </div>
                    <p className="text-sm text-dark leading-snug">{req.action}</p>
                    <p className="text-xs font-semibold font-mono text-dark mt-1.5">
                      Est. {formatUsd(req.estimated)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeny(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-500 hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      <X size={12} /> Deny
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition-colors"
                    >
                      <Check size={12} /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent agent messages — 40% */}
        <div className="col-span-2 border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200">
            <Bot size={15} className="text-teal" />
            <h2 className="text-sm font-semibold text-dark">Agent Messages</h2>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-dark bg-green-light px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-dark inline-block" />
              Live
            </span>
          </div>

          <div className="overflow-y-auto max-h-[360px]">
            {RECENT_MESSAGES.map((msg, i) => (
              <div key={msg.id} className="flex gap-3 px-5 py-3 hover:bg-slate-50 transition-colors border-b border-grey-50 last:border-0">
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                    MSG_TYPE_COLOR[msg.type] ?? "bg-grey-100 text-grey-700"
                  )}>
                    {msg.type}
                  </span>
                  {i < RECENT_MESSAGES.length - 1 && (
                    <div className="w-px flex-1 min-h-[12px] bg-grey-100" />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-xs text-dark leading-snug">{msg.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-grey-400">{msg.agent}</span>
                    <span className="text-grey-200">·</span>
                    <span className="text-[10px] text-grey-400">{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
