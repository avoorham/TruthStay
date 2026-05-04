"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Play, CheckCircle2, XCircle, Eye,
  ChevronDown, ChevronUp, Plus, X, Loader2, AlertTriangle,
  Route, Building2, UtensilsCrossed, Clock, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOUT_URL = "/api/scout"; // proxied server-side to avoid CORS
const TARGET_ENTRIES = 1000;

const REGION_GROUPS = [
  {
    label: "Western Europe",
    regions: [
      "Dolomites, Italy", "Amalfi Coast, Italy", "Tuscany, Italy",
      "Provence, France", "French Alps, France",
      "Swiss Alps, Switzerland", "Austrian Alps, Austria",
      "Algarve, Portugal",
      "Basque Country, Spain", "Mallorca, Spain", "Costa Brava, Spain",
      "Scottish Highlands, UK", "Lake District, UK", "Black Forest, Germany",
    ],
  },
  {
    label: "Scandinavia",
    regions: ["Norwegian Fjords, Norway", "Lofoten Islands, Norway", "Swedish Lapland, Sweden"],
  },
  {
    label: "Eastern Europe",
    regions: ["Dalmatian Coast, Croatia", "Julian Alps, Slovenia", "Transylvania, Romania"],
  },
  {
    label: "Mediterranean",
    regions: ["Crete, Greece", "Peloponnese, Greece", "Sardinia, Italy", "Corsica, France"],
  },
  {
    label: "Other",
    regions: ["Canary Islands, Spain", "Madeira, Portugal", "Iceland South Coast, Iceland"],
  },
];

const VACATION_TYPES = [
  "Active Holiday", "Beach Holiday", "City Break", "Cultural Heritage",
  "Winter Sports", "Road Trip", "Nature & Wildlife", "Food & Wine",
  "Wellness Retreat", "Family Holiday", "Adventure Expedition",
];

const ACTIVITY_FOCUS_OPTIONS = [
  "Cycling (Road)", "Cycling (Gravel)", "Cycling (Mountain Bike)",
  "Hiking", "Trail Running", "Skiing", "Snowboarding", "Surfing",
  "Kayaking", "Climbing", "Swimming", "Sailing", "Walking",
  "None (general)",
];

const CONTENT_TYPE_OPTIONS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: "route",          label: "Routes",        icon: Route          },
  { id: "accommodation",  label: "Accommodation", icon: Building2      },
  { id: "restaurant",     label: "Restaurants",   icon: UtensilsCrossed},
];

const PRESET_PRESETS = [
  {
    emoji: "🏔", label: "Dolomites Cycling",
    region: "Dolomites, Italy", vacationType: "Active Holiday",
    activityFocus: "Cycling (Mountain Bike)",
    contentTypes: ["route", "accommodation", "restaurant"],
    maxResults: 10,
  },
  {
    emoji: "🏖", label: "Algarve Surf",
    region: "Algarve, Portugal", vacationType: "Beach Holiday",
    activityFocus: "Surfing",
    contentTypes: ["accommodation", "restaurant"],
    maxResults: 10,
  },
  {
    emoji: "🥾", label: "Swiss Hiking",
    region: "Swiss Alps, Switzerland", vacationType: "Active Holiday",
    activityFocus: "Hiking",
    contentTypes: ["route", "accommodation", "restaurant"],
    maxResults: 10,
  },
  {
    emoji: "🚴", label: "Mallorca Road",
    region: "Mallorca, Spain", vacationType: "Active Holiday",
    activityFocus: "Cycling (Road)",
    contentTypes: ["route", "accommodation", "restaurant"],
    maxResults: 10,
  },
  {
    emoji: "❄️", label: "Austrian Ski",
    region: "Austrian Alps, Austria", vacationType: "Winter Sports",
    activityFocus: "Skiing",
    contentTypes: ["accommodation", "restaurant"],
    maxResults: 10,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoutEntry {
  id: string;
  name: string;
  type: string;
  region: string | null;
  description: string | null;
  verified: boolean;
  trust_score: number | null;
  data: {
    scoutScore?: number;
    scoutReason?: string;
    sources?: Array<{ url?: string; author?: string; excerpt?: string }>;
    highlights?: string[];
  } | null;
  created_at: string;
}

interface AgentRun {
  id: string;
  region: string;
  activity_type: string;
  status: string;
  routes_found: number | null;
  accommodations_found: number | null;
  restaurants_found: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ContentStats {
  total: number;
  verified: number;
  byType: { route: number; accommodation: number; restaurant: number };
  topRegions: Array<{ region: string; count: number }>;
}

interface FormState {
  region: string;
  customRegion: string;
  vacationType: string;
  activityFocus: string;
  contentTypes: string[];
  maxResults: number;
  focusKeywords: string;
}

type RunPhase = "idle" | "running" | "fetching" | "done" | "failed";

interface RunState {
  phase: RunPhase;
  runId: string | null;
  discovered: number;
  inserted: number;
  error: string | null;
  entries: ScoutEntry[];
  elapsed: number;
}

interface NewPreset {
  emoji: string;
  label: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.8) return "bg-green-light text-green-dark";
  if (score >= 0.5) return "bg-warning-light text-warning";
  return "bg-danger-light text-danger";
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const secs = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const TYPE_LABEL: Record<string, string> = {
  route: "Routes", accommodation: "Accommodation", restaurant: "Restaurants",
};

const TYPE_ICON: Record<string, React.ElementType> = {
  route: Route, accommodation: Building2, restaurant: UtensilsCrossed,
};

const TYPE_COLOR: Record<string, string> = {
  route: "text-blue bg-blue-light",
  accommodation: "text-teal-dark bg-teal-light",
  restaurant: "text-green-dark bg-green-light",
};

// ─── Content Stats Sidebar ────────────────────────────────────────────────────

function ContentStatsPanel({ stats }: { stats: ContentStats | null }) {
  const verified = stats?.verified ?? 0;
  const total    = stats?.total ?? 0;
  const pct      = Math.min((verified / TARGET_ENTRIES) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Progress toward target */}
      <div className="border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <MapPin size={14} className="text-teal-dark" />
          </div>
          <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest">Content library</p>
        </div>

        <div className="flex items-end justify-between mb-1.5">
          <span className="text-2xl font-bold font-mono text-dark">{verified.toLocaleString()}</span>
          <span className="text-xs text-grey-400 mb-1">/ {TARGET_ENTRIES.toLocaleString()} target</span>
        </div>
        <div className="h-2 rounded-full bg-grey-100 overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full bg-teal transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-grey-400">{Math.round(pct)}% of target • {total} total entries</p>

        {/* By type */}
        <div className="mt-4 space-y-2 pt-3 border-t border-grey-100">
          {(["route", "accommodation", "restaurant"] as const).map(t => {
            const count = stats?.byType[t] ?? 0;
            const Icon  = TYPE_ICON[t] as React.ElementType;
            return (
              <div key={t} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-5 h-5 rounded flex items-center justify-center", TYPE_COLOR[t])}>
                    <Icon size={11} />
                  </span>
                  <span className="text-grey-600">{TYPE_LABEL[t]}</span>
                </div>
                <span className="font-mono font-semibold text-dark">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top regions */}
      {(stats?.topRegions.length ?? 0) > 0 && (
        <div className="border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest mb-3">Top regions</p>
          <div className="space-y-2">
            {(stats?.topRegions ?? []).slice(0, 7).map(r => (
              <div key={r.region} className="flex items-center justify-between text-xs">
                <span className="text-grey-600 truncate max-w-[140px]">{r.region}</span>
                <span className="font-mono font-semibold text-dark shrink-0 ml-2">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget card */}
      <div className="border border-slate-200 rounded-lg p-5">
        <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest mb-3">Scout budget</p>
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-grey-500">Monthly</span>
              <span className="font-mono text-dark">$31.50 <span className="text-grey-400">/ $80.00</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-grey-100 overflow-hidden">
              <div className="h-full rounded-full bg-teal" style={{ width: "39%" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-grey-500">Weekly</span>
              <span className="font-mono text-dark">$8.10 <span className="text-grey-400">/ $20.00</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-grey-100 overflow-hidden">
              <div className="h-full rounded-full bg-teal" style={{ width: "41%" }} />
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-grey-100 flex items-center justify-between text-xs">
          <span className="text-grey-500">Est. cost per run</span>
          <span className="font-mono font-semibold text-dark">~€0.50</span>
        </div>
      </div>
    </div>
  );
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onApprove,
  onReject,
  approvedIds,
  rejectedIds,
}: {
  entry: ScoutEntry;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  approvedIds: Set<string>;
  rejectedIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const score  = entry.data?.scoutScore ?? 0;
  const sources = entry.data?.sources ?? [];
  const approved = approvedIds.has(entry.id);
  const rejected = rejectedIds.has(entry.id);

  return (
    <div className={cn(
      "border border-slate-200 rounded-lg transition-all",
      approved ? "border-green-600/30 bg-green-light/20" :
      rejected ? "border-danger/20 bg-danger-light/20" :
                 "border-slate-200"
    )}>
      <div className="flex items-start gap-4 p-4">
        {/* Score badge */}
        <div className={cn(
          "shrink-0 min-w-[52px] text-center py-1.5 px-2 rounded-lg text-sm font-bold font-mono",
          scoreColor(score)
        )}>
          {score.toFixed(2)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-dark leading-snug">{entry.name}</p>
              {entry.description && (
                <p className="text-xs text-grey-500 mt-1 leading-relaxed line-clamp-2">
                  {entry.description}
                </p>
              )}
            </div>
          </div>

          {/* Sources summary */}
          {sources.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold text-grey-400 uppercase tracking-wide">
                {sources.length} source{sources.length !== 1 ? "s" : ""}:
              </span>
              {sources.slice(0, 3).map((s, i) => (
                <span key={i} className="text-[10px] text-grey-500 bg-grey-100 px-1.5 py-0.5 rounded-full">
                  {s.author ?? new URL(s.url ?? "https://unknown").hostname}
                </span>
              ))}
            </div>
          )}

          {/* Expanded: scout reason + sources */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-grey-100 space-y-3">
              {entry.data?.scoutReason && (
                <p className="text-xs text-grey-600 italic">"{entry.data.scoutReason}"</p>
              )}
              {sources.length > 0 && (
                <div className="space-y-2">
                  {sources.map((s, i) => (
                    <div key={i} className="text-xs text-grey-600 bg-slate-50 rounded-lg p-2.5">
                      <p className="font-medium text-dark mb-0.5">{s.author ?? "Unknown author"}</p>
                      {s.excerpt && <p className="text-grey-500 line-clamp-2 italic">"{s.excerpt}"</p>}
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-dark hover:underline mt-1 block truncate"
                        >
                          {s.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg border border-slate-200 text-grey-400 hover:text-grey-700 hover:border-slate-300 transition-colors"
            title="View detail"
          >
            {expanded ? <ChevronUp size={13} /> : <Eye size={13} />}
          </button>

          {!approved && !rejected && (
            <>
              <button
                onClick={() => onReject(entry.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-500 hover:border-danger hover:text-danger transition-colors"
              >
                <X size={11} /> Reject
              </button>
              <button
                onClick={() => onApprove(entry.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition-colors"
              >
                <CheckCircle2 size={11} /> Approve
              </button>
            </>
          )}
          {approved && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-dark">
              <CheckCircle2 size={13} /> Approved
            </span>
          )}
          {rejected && (
            <span className="flex items-center gap-1 text-xs font-semibold text-danger">
              <XCircle size={13} /> Rejected
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Run Results Section ──────────────────────────────────────────────────────

function RunResultsSection({
  run,
  onClose,
}: {
  run: RunState;
  onClose: () => void;
}) {
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const grouped = {
    route:         run.entries.filter(e => e.type === "route"),
    accommodation: run.entries.filter(e => e.type === "accommodation"),
    restaurant:    run.entries.filter(e => e.type === "restaurant"),
  };

  const highScoreIds = run.entries
    .filter(e => (e.data?.scoutScore ?? 0) >= 0.8 && !approvedIds.has(e.id) && !rejectedIds.has(e.id))
    .map(e => e.id);

  async function handleApprove(id: string) {
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: true }),
    });
    setApprovedIds(s => new Set([...s, id]));
  }

  async function handleReject(id: string) {
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: false }),
    });
    setRejectedIds(s => new Set([...s, id]));
  }

  async function handleBulkApprove() {
    setBulkWorking(true);
    await Promise.all(highScoreIds.map(id => handleApprove(id)));
    setBulkWorking(false);
  }

  if (run.entries.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-grey-100 flex items-center justify-center mx-auto mb-3">
          <MapPin size={20} className="text-grey-400" />
        </div>
        <p className="text-sm font-semibold text-dark">No entries in results</p>
        <p className="text-xs text-grey-500 mt-1">
          The scout ran successfully but no new entries passed the quality threshold.
        </p>
        <button onClick={onClose} className="mt-4 text-xs text-teal-dark hover:text-teal font-medium">
          Run again with different parameters
        </button>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-grey-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={15} className="text-green-dark" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-dark">
              Latest run results
              <span className="ml-2 text-xs font-normal text-grey-400">
                ({run.inserted} entries catalogued)
              </span>
            </h2>
            <p className="text-xs text-grey-400 mt-0.5">Run ID: <span className="font-mono">{run.runId}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highScoreIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/10 text-green-dark text-xs font-semibold hover:bg-green-600/20 transition-colors disabled:opacity-60"
            >
              {bulkWorking
                ? <Loader2 size={12} className="animate-spin" />
                : <CheckCircle2 size={12} />}
              Approve all (score ≥ 0.80) · {highScoreIds.length}
            </button>
          )}
          <Link
            href="/content"
            className="flex items-center gap-1 text-xs font-semibold text-teal-dark hover:text-teal transition-colors"
          >
            View in Content Manager <ArrowRight size={11} />
          </Link>
          <button onClick={onClose} className="text-grey-400 hover:text-grey-700 transition-colors ml-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="p-6 space-y-8">
        {(["route", "accommodation", "restaurant"] as const).map(type => {
          const items = grouped[type];
          if (items.length === 0) return null;
          const Icon  = TYPE_ICON[type] as React.ElementType;
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("w-6 h-6 rounded flex items-center justify-center", TYPE_COLOR[type])}>
                  <Icon size={13} />
                </span>
                <h3 className="text-xs font-semibold text-grey-500 uppercase tracking-widest">
                  {TYPE_LABEL[type]} · {items.length}
                </h3>
              </div>
              <div className="space-y-3">
                {items.map(entry => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    approvedIds={approvedIds}
                    rejectedIds={rejectedIds}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Run History ──────────────────────────────────────────────────────────────

function RunHistoryTable({ runs }: { runs: AgentRun[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Clock size={18} className="text-teal-dark" />
        </div>
        <p className="text-sm font-semibold text-dark">No runs yet</p>
        <p className="text-xs text-grey-500 mt-1">Run the scout above to start building your content library.</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-grey-100">
        <p className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Run history</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
            <th className="text-left px-6 py-3">Date</th>
            <th className="text-left px-6 py-3">Region</th>
            <th className="text-left px-6 py-3">Vacation type</th>
            <th className="text-center px-6 py-3">Status</th>
            <th className="text-right px-6 py-3">Found</th>
            <th className="text-right px-6 py-3">Est. cost</th>
            <th className="text-right px-6 py-3">Duration</th>
            <th className="px-4 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {runs.map(run => {
            const found = (run.routes_found ?? 0) + (run.accommodations_found ?? 0) + (run.restaurants_found ?? 0);
            const isExpanded = expandedId === run.id;
            return (
              <>
                <tr
                  key={run.id}
                  className="border-b border-grey-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-3 text-xs text-grey-500 whitespace-nowrap">
                    {formatDate(run.created_at)}
                  </td>
                  <td className="px-6 py-3 text-xs font-medium text-dark">{run.region}</td>
                  <td className="px-6 py-3 text-xs text-grey-600">{run.activity_type}</td>
                  <td className="px-6 py-3 text-center">
                    <StatusBadge value={run.status} />
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{found}</td>
                  <td className="px-6 py-3 text-right font-mono text-xs text-grey-500">~$3.00</td>
                  <td className="px-6 py-3 text-right font-mono text-xs text-grey-500">
                    {formatDuration(run.created_at, run.completed_at)}
                  </td>
                  <td className="px-4 py-3">
                    {run.status === "failed" && run.error_message && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : run.id)}
                        className="text-grey-400 hover:text-grey-700 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && run.error_message && (
                  <tr key={`${run.id}-err`} className="border-b border-grey-50 bg-danger-light/30">
                    <td colSpan={8} className="px-6 py-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className="text-danger shrink-0 mt-0.5" />
                        <p className="text-xs text-danger font-mono">{run.error_message}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LocationScoutPage() {
  // Form state
  const [form, setForm] = useState<FormState>({
    region:        "",
    customRegion:  "",
    vacationType:  "Active Holiday",
    activityFocus: "None (general)",
    contentTypes:  ["route", "accommodation", "restaurant"],
    maxResults:    10,
    focusKeywords: "",
  });

  // Run state
  const [run, setRun] = useState<RunState>({
    phase:      "idle",
    runId:      null,
    discovered: 0,
    inserted:   0,
    error:      null,
    entries:    [],
    elapsed:    0,
  });

  // Data
  const [stats, setStats]   = useState<ContentStats | null>(null);
  const [history, setHistory] = useState<AgentRun[]>([]);
  const [presets, setPresets] = useState(PRESET_PRESETS);
  const [addPreset, setAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState<NewPreset>({ emoji: "📍", label: "" });

  // Timer ref for elapsed time
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load stats and history on mount
  useEffect(() => {
    fetch("/api/admin/scout/stats").then(r => r.json()).then(setStats).catch(() => {});
    fetch("/api/admin/scout/runs").then(r => r.json()).then(data => setHistory(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // Elapsed timer during run
  useEffect(() => {
    if (run.phase === "running") {
      timerRef.current = setInterval(() => {
        setRun(r => ({ ...r, elapsed: r.elapsed + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [run.phase]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleContentType(id: string) {
    setForm(prev => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(id)
        ? prev.contentTypes.filter(t => t !== id)
        : [...prev.contentTypes, id],
    }));
  }

  function applyPreset(preset: typeof PRESET_PRESETS[number]) {
    setForm(prev => ({
      ...prev,
      region:        preset.region,
      customRegion:  "",
      vacationType:  preset.vacationType,
      activityFocus: preset.activityFocus,
      contentTypes:  preset.contentTypes,
      maxResults:    preset.maxResults,
    }));
  }

  function addNewPreset() {
    if (!newPreset.label.trim() || !form.region) return;
    setPresets(prev => [...prev, {
      emoji:        newPreset.emoji,
      label:        newPreset.label.trim(),
      region:       form.region === "custom" ? form.customRegion : form.region,
      vacationType: form.vacationType,
      activityFocus: form.activityFocus,
      contentTypes: form.contentTypes,
      maxResults:   form.maxResults,
    }]);
    setAddPreset(false);
    setNewPreset({ emoji: "📍", label: "" });
  }

  const effectiveRegion = form.region === "custom" ? form.customRegion : form.region;

  async function handleRun() {
    if (!effectiveRegion) return;

    setRun({ phase: "running", runId: null, discovered: 0, inserted: 0, error: null, entries: [], elapsed: 0 });

    const contentTypes = form.contentTypes.filter(t => ["route", "accommodation", "restaurant"].includes(t));
    const focusKeywords: string[] = [];
    if (form.activityFocus && form.activityFocus !== "None (general)") {
      focusKeywords.push(form.activityFocus);
    }
    if (form.focusKeywords.trim()) {
      focusKeywords.push(...form.focusKeywords.split(",").map(k => k.trim()).filter(Boolean));
    }

    try {
      const res = await fetch(SCOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region:       effectiveRegion,
          vacationType: form.vacationType,
          contentTypes,
          maxResults:   form.maxResults,
          focusKeywords,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      const { runId, discovered, inserted } = payload;

      // Fetch the actual entries from DB
      setRun(r => ({ ...r, phase: "fetching", runId, discovered, inserted }));

      const entriesRes = await fetch(`/api/admin/scout/run-results?runId=${runId}`);
      const entries: ScoutEntry[] = entriesRes.ok ? await entriesRes.json() : [];

      setRun(r => ({ ...r, phase: "done", entries }));

      // Refresh history and stats
      fetch("/api/admin/scout/runs").then(r => r.json()).then(data => setHistory(Array.isArray(data) ? data : [])).catch(() => {});
      fetch("/api/admin/scout/stats").then(r => r.json()).then(setStats).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRun(r => ({ ...r, phase: "failed", error: message }));
    }
  }

  const canRun = !!effectiveRegion && run.phase !== "running" && run.phase !== "fetching";

  return (
    <div>
      <PageHeader
        title="Location Scout"
        description="Trigger the AI scout to discover new destinations, accommodation, and restaurants from authentic travel sources."
        actions={
          <Link
            href="/agents"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={14} /> All agents
          </Link>
        }
      />

      {/* ── Quick Presets ── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-grey-400 font-medium mr-1">Quick start:</span>
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => applyPreset(p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-sm hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 transition-colors text-grey-700 bg-white"
          >
            <span>{p.emoji}</span>
            <span className="text-xs font-medium">{p.label}</span>
          </button>
        ))}
        {!addPreset ? (
          <button
            onClick={() => setAddPreset(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 text-xs text-grey-400 hover:border-teal hover:text-teal-dark transition-colors bg-white"
          >
            <Plus size={11} /> Add preset
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input
              value={newPreset.emoji}
              onChange={e => setNewPreset(p => ({ ...p, emoji: e.target.value }))}
              className="w-8 text-center text-sm bg-transparent outline-none"
              maxLength={2}
            />
            <input
              value={newPreset.label}
              onChange={e => setNewPreset(p => ({ ...p, label: e.target.value }))}
              placeholder="Preset name…"
              className="text-xs bg-transparent outline-none text-dark placeholder:text-grey-300 w-28"
              onKeyDown={e => { if (e.key === "Enter") addNewPreset(); }}
              autoFocus
            />
            <button onClick={addNewPreset} className="text-teal hover:text-teal-dark transition-colors">
              <CheckCircle2 size={14} />
            </button>
            <button onClick={() => setAddPreset(false)} className="text-grey-400 hover:text-grey-700 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Main grid: Form + Sidebar ── */}
      <div className="grid grid-cols-3 gap-6 mb-6">

        {/* ─ Scout Trigger Form ─ */}
        <div className="col-span-2 border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-grey-100">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <MapPin size={15} className="text-teal-dark" />
            </div>
            <h2 className="text-sm font-semibold text-dark">Scout trigger</h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Region */}
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">
                Region <span className="text-danger">*</span>
              </label>
              <select
                value={form.region}
                onChange={e => updateForm("region", e.target.value)}
                className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              >
                <option value="" disabled>Select a region…</option>
                {REGION_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Custom">
                  <option value="custom">Custom region…</option>
                </optgroup>
              </select>
              {form.region === "custom" && (
                <input
                  type="text"
                  value={form.customRegion}
                  onChange={e => updateForm("customRegion", e.target.value)}
                  placeholder="e.g. Azores, Portugal"
                  className="mt-2 w-full text-sm text-dark border border-slate-200 rounded-md px-3 py-2.5 bg-white focus:outline-none focus:border-teal-400"
                  autoFocus
                />
              )}
            </div>

            {/* Vacation Type + Activity Focus */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">
                  Vacation type
                </label>
                <select
                  value={form.vacationType}
                  onChange={e => updateForm("vacationType", e.target.value)}
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                >
                  {VACATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">
                  Activity focus
                </label>
                <select
                  value={form.activityFocus}
                  onChange={e => updateForm("activityFocus", e.target.value)}
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                >
                  {ACTIVITY_FOCUS_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Content Types */}
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-2">
                Content types
              </label>
              <div className="flex gap-4">
                {CONTENT_TYPE_OPTIONS.map(opt => {
                  const checked = form.contentTypes.includes(opt.id);
                  const Icon = opt.icon;
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex items-center gap-2.5 flex-1 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all",
                        checked
                          ? "border-teal bg-teal-bg text-teal-dark"
                          : "border-slate-200 text-grey-500 hover:border-slate-300 bg-white"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContentType(opt.id)}
                        className="sr-only"
                      />
                      <Icon size={14} className="shrink-0" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Max Results + Focus Keywords */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">
                  Max results
                </label>
                <select
                  value={form.maxResults}
                  onChange={e => updateForm("maxResults", Number(e.target.value))}
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                >
                  {[5, 10, 15, 20, 30].map(n => (
                    <option key={n} value={n}>{n}{n === 10 ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">
                  Focus keywords <span className="text-grey-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.focusKeywords}
                  onChange={e => updateForm("focusKeywords", e.target.value)}
                  placeholder="hidden gems, local, authentic…"
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal placeholder:text-grey-300"
                />
              </div>
            </div>

            {/* Cost estimate + Run button */}
            <div className="flex items-center justify-between pt-2 border-t border-grey-100">
              <div className="flex items-center gap-4 text-xs text-grey-500">
                <span>Estimated cost: <strong className="text-dark font-mono">~€0.50</strong></span>
                <span className="text-grey-300">·</span>
                <span>Budget remaining: <strong className="text-dark font-mono">$48.50</strong></span>
              </div>
              <button
                onClick={handleRun}
                disabled={!canRun}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  canRun
                    ? "bg-teal-500 text-white hover:bg-teal-600"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <Play size={14} />
                Run Scout
              </button>
            </div>
          </div>
        </div>

        {/* ─ Content Library Stats ─ */}
        <div className="col-span-1">
          <ContentStatsPanel stats={stats} />
        </div>
      </div>

      {/* ── Loading state ── */}
      {(run.phase === "running" || run.phase === "fetching") && (
        <div className="border border-slate-200 rounded-lg p-10 mb-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <MapPin size={24} className="text-teal-dark" />
              </div>
              <Loader2
                size={64}
                className="animate-spin text-teal/30 absolute inset-0"
                strokeWidth={1}
              />
            </div>
            <div>
              <p className="text-base font-semibold text-dark">
                {run.phase === "fetching" ? "Loading results…" : "Scout is searching…"}
              </p>
              <p className="text-sm text-grey-500 mt-1">
                {run.phase === "fetching"
                  ? "Fetching entries from the content library"
                  : "This may take 60–90 seconds while the AI researches authentic sources"}
              </p>
            </div>
            {run.phase === "running" && (
              <div className="flex items-center gap-2 text-xs text-grey-400 font-mono bg-slate-50 px-4 py-2 rounded-full">
                <Clock size={12} />
                {run.elapsed}s elapsed
              </div>
            )}
            {run.phase === "running" && (
              <div className="w-64 h-1.5 rounded-full bg-grey-100 overflow-hidden">
                <div
                  className="h-full bg-teal rounded-full transition-all"
                  style={{ width: `${Math.min((run.elapsed / 90) * 100, 95)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {run.phase === "failed" && (
        <div className="border-l-4 border-danger bg-danger-light rounded-r-xl p-5 mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={17} className="text-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-dark">Scout run failed</p>
              <p className="text-xs text-grey-500 mt-1 font-mono">{run.error}</p>
            </div>
          </div>
          <button
            onClick={() => setRun(r => ({ ...r, phase: "idle", error: null }))}
            className="text-grey-400 hover:text-grey-700 shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {run.phase === "done" && (
        <div className="mb-6">
          <RunResultsSection
            run={run}
            onClose={() => setRun(r => ({ ...r, phase: "idle" }))}
          />
        </div>
      )}

      {/* ── Run History ── */}
      <RunHistoryTable runs={history} />
    </div>
  );
}
