"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Play, CheckCircle2, XCircle, Eye,
  ChevronDown, ChevronUp, Plus, X, Loader2, AlertTriangle,
  Route, Building2, UtensilsCrossed, Clock, ArrowRight,
  Globe, Instagram, RefreshCw, Trash2, Link as LinkIcon,
  AlertCircle, Pencil,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import type { ScoutJob, ContentSource } from "@/lib/queries/scout";

// ─── Constants ────────────────────────────────────────────────────────────────

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
    sources?: Array<{ url?: string; type?: string; author?: string; excerpt?: string }>;
    highlights?: string[];
  } | null;
  created_at: string;
}

interface BulkParseItem {
  url: string;
  type: "website" | "instagram";
  label: string;
}

type DraftSaveStatus = "idle" | "saving" | "saved";

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
  monthlyCosts?: { totalUsd: number; completedJobs: number };
}

interface FormState {
  region: string;
  customRegion: string;
  vacationType: string;
  activityFocus: string;
  contentTypes: string[];
  maxResults: number;
  focusKeywords: string;
  includeActiveSources: boolean;
  focusType: string;
  depth: "standard" | "exhaustive";
  selectedSourceIds: string[];
}

interface AddSourceForm {
  url: string;
  type: "website" | "instagram";
  label: string;
  region: string;
  seedUrlsRaw: string;
}

// Run state now just tracks the brief enqueue call
type RunPhase = "idle" | "queuing" | "queued" | "failed";

interface RunState {
  phase: RunPhase;
  jobId: string | null;
  error: string | null;
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

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
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

const TRACKING_PARAMS = ["igsh", "igshid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref", "ref_src"];
const GENERIC_HOSTS   = ["medium.com", "substack.com", "wordpress.com", "blogspot.com"];

function parseBulkUrls(raw: string): { parsed: BulkParseItem[]; skipped: { line: string; reason: string }[] } {
  const lines   = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed: BulkParseItem[] = [];
  const skipped: { line: string; reason: string }[] = [];
  const seen    = new Set<string>();

  for (const line of lines) {
    if (!line.startsWith("http://") && !line.startsWith("https://")) {
      skipped.push({ line, reason: "invalid format" });
      continue;
    }
    let url: URL;
    try { url = new URL(line); } catch {
      skipped.push({ line, reason: "invalid URL" });
      continue;
    }
    for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
    const dedupKey = (url.hostname + url.pathname).toLowerCase().replace(/\/$/, "");
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const isInstagram = url.hostname.includes("instagram.com");
    const type: "website" | "instagram" = isInstagram ? "instagram" : "website";

    let label: string;
    if (isInstagram) {
      const handle = url.pathname.replace(/^\//, "").split("/")[0];
      label = handle ? `@${handle}` : "Instagram";
    } else {
      const host = url.hostname.replace(/^www\./, "");
      const isGeneric = GENERIC_HOSTS.some(g => host === g || host.endsWith(`.${g}`));
      if (isGeneric) {
        const seg = url.pathname.split("/").filter(Boolean)[0] ?? host;
        label = seg.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      } else {
        const domainBase = host.replace(/\.[^.]+$/, "");
        label = domainBase.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }
    parsed.push({ url: url.toString(), type, label });
  }
  return { parsed, skipped };
}

function parseSeedUrls(raw: string): { urls: string[]; warnings: string[] } {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const urls: string[] = [];
  const warnings: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("http://") && !line.startsWith("https://")) {
      warnings.push(`Skipped (not a URL): ${line.slice(0, 60)}`);
      continue;
    }
    try {
      const u = new URL(line);
      for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
      urls.push(u.toString());
    } catch {
      warnings.push(`Skipped (invalid URL): ${line.slice(0, 60)}`);
    }
  }
  if (urls.length > 20) {
    warnings.push(`Capped at 20 URLs (${urls.length - 20} dropped)`);
    return { urls: urls.slice(0, 20), warnings };
  }
  return { urls, warnings };
}

// ─── Job status helpers ───────────────────────────────────────────────────────

type JobBadge = "queued" | "running" | "done" | "failed";

function getJobBadge(status: ScoutJob["status"]): { badge: JobBadge | null; label: string | null } {
  switch (status) {
    case "queued":    return { badge: "queued",  label: "Queued…" };
    case "running":   return { badge: "running", label: "Running" };
    case "done":      return { badge: "done",    label: "Done" };
    case "failed":    return { badge: "failed",  label: "Failed" };
    default:          return { badge: null, label: null };
  }
}

function JobStatusBadge({ job, onClick }: { job: ScoutJob; onClick?: () => void }) {
  const stage = job.progress?.stage;

  if (job.status === "queued") {
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-grey-500 hover:bg-slate-200 transition">
        <Clock size={9} />
        Queued…
      </button>
    );
  }

  if (job.status === "running") {
    const label = stage && stage !== "starting" ? `Scraping (${stage})` : "Scraping…";
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-dark animate-pulse hover:bg-teal-200 transition">
        <Loader2 size={9} className="animate-spin" />
        {label}
      </button>
    );
  }

  if (job.status === "done") {
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-light text-green-dark hover:bg-green-100 transition">
        <CheckCircle2 size={9} />
        Done — {job.entries_created ?? 0} entries
      </button>
    );
  }

  if (job.status === "failed") {
    return (
      <button onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-danger-light text-danger hover:bg-danger/20 transition">
        <AlertCircle size={9} />
        Failed{job.last_error_code ? ` (${job.last_error_code})` : ""}
      </button>
    );
  }

  return null;
}

// ─── Job Drawer ───────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ["extract", "resolve", "match", "score", "queue"];

function JobDrawer({ job, onClose }: { job: ScoutJob; onClose: () => void }) {
  const completed = job.progress?.stages_completed ?? [];
  const current   = job.progress?.stage;
  const p         = job.progress;

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-grey-100 shrink-0">
        <div>
          <p className="text-sm font-semibold text-dark">
            {job.job_type === "scrape_source" ? "Scrape job" : "Scout run"}
          </p>
          <p className="text-[11px] text-grey-400 font-mono mt-0.5">{job.id}</p>
        </div>
        <button onClick={onClose} className="text-grey-400 hover:text-grey-700 p-1.5 rounded-lg transition">
          <X size={15} />
        </button>
      </div>

      <div className="px-5 py-4 border-b border-grey-100">
        <p className="text-[10px] font-semibold text-grey-500 uppercase tracking-widest mb-3">Pipeline</p>
        <div className="flex items-start gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const isDone    = (completed as string[]).includes(stage);
            const isCurrent = current === stage;
            return (
              <div key={stage} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
                  isDone    ? "bg-teal-500 border-teal-500 text-white" :
                  isCurrent ? "bg-teal-100 border-teal text-teal-dark" :
                              "bg-grey-100 border-grey-200 text-grey-400"
                )}>
                  {isDone ? <CheckCircle2 size={12} /> : i + 1}
                </div>
                <span className={cn(
                  "text-[9px] uppercase tracking-wide font-medium text-center leading-tight",
                  isDone || isCurrent ? "text-teal-dark" : "text-grey-400"
                )}>{stage}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 border-b border-grey-100 space-y-2">
        <p className="text-[10px] font-semibold text-grey-500 uppercase tracking-widest mb-2">Timeline</p>
        {([
          { label: "Queued",   time: job.created_at },
          { label: "Started",  time: job.started_at },
          { label: "Finished", time: job.finished_at },
        ] as { label: string; time: string | null }[]).filter(({ time }) => time).map(({ label, time }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-grey-500">{label}</span>
            <span className="font-mono text-dark">{formatDate(time!)}</span>
          </div>
        ))}
        {job.started_at && job.finished_at && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-grey-500">Duration</span>
            <span className="font-mono text-dark">{formatDuration(job.started_at, job.finished_at)}</span>
          </div>
        )}
        {job.attempt_count > 1 && (
          <div className="text-xs text-amber-600 font-medium">
            Attempt {job.attempt_count} of {job.max_attempts}
          </div>
        )}
      </div>

      {(p?.extractions_found != null || p?.entries_queued != null) && (
        <div className="px-5 py-4 border-b border-grey-100">
          <p className="text-[10px] font-semibold text-grey-500 uppercase tracking-widest mb-3">Progress</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: "Extracted", value: p.extractions_found },
              { label: "Resolved",  value: p.extractions_resolved },
              { label: "New",       value: p.extractions_matched },
              { label: "Queued",    value: p.entries_queued },
            ] as { label: string; value: number | undefined }[]).filter(({ value }) => value != null).map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[9px] text-grey-400 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold font-mono text-dark">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!job.result_summary?.stages && (
        <div className="px-5 py-4 border-b border-grey-100">
          <p className="text-[10px] font-semibold text-grey-500 uppercase tracking-widest mb-2">Stage timing</p>
          <div className="space-y-1">
            {Object.entries(job.result_summary.stages as Record<string, { duration_ms: number }>).map(([stage, data]) => (
              <div key={stage} className="flex items-center justify-between text-xs">
                <span className="text-grey-500 capitalize">{stage}</span>
                <span className="font-mono text-dark">{data.duration_ms}ms</span>
              </div>
            ))}
          </div>
          {(job.result_summary.warnings as string[] | undefined)?.length ? (
            <div className="mt-2 space-y-1">
              {(job.result_summary.warnings as string[]).map((w, i) => (
                <p key={i} className="text-[10px] text-amber-600 font-mono">{w}</p>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {job.status === "done" && (
        <div className="px-5 py-4 border-b border-grey-100">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-green-dark" />
            <span className="font-semibold text-dark">{job.entries_created ?? 0} entries</span>
            <span className="text-grey-400">added to review queue</span>
          </div>
          <Link
            href="/content"
            className="mt-2 text-xs text-teal-dark hover:text-teal flex items-center gap-1 transition"
          >
            View in Review Queue <ArrowRight size={10} />
          </Link>
        </div>
      )}

      {job.last_error && (
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-grey-500 uppercase tracking-widest mb-2">Error</p>
          <div className="bg-danger-light/50 border border-danger/20 rounded-lg px-3 py-2.5">
            <p className="text-xs text-danger font-mono leading-relaxed">{job.last_error}</p>
            {job.last_error_code && (
              <p className="text-[10px] text-danger/60 mt-1">Code: {job.last_error_code}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Run Queued Banner ────────────────────────────────────────────────────────

function RunQueuedBanner({
  jobId,
  depth,
  onViewJob,
  onDismiss,
}: {
  jobId:    string;
  depth:    "standard" | "exhaustive";
  onViewJob: () => void;
  onDismiss: () => void;
}) {
  const estimate = depth === "exhaustive" ? "~8 minutes" : "~2 minutes";
  return (
    <div className="border border-green-200 bg-green-light/30 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={17} className="text-green-dark shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-dark">Scout run queued</p>
            <p className="text-xs text-grey-500 mt-1">
              Estimated time: {estimate}. Results will appear in the Review Queue when ready.
            </p>
            <p className="text-[10px] text-grey-400 font-mono mt-1">Job ID: {jobId}</p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-grey-400 hover:text-grey-600 shrink-0 transition">
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-green-200">
        <button
          onClick={onViewJob}
          className="text-xs font-medium text-teal-dark hover:text-teal flex items-center gap-1 transition"
        >
          View job status <ArrowRight size={10} />
        </button>
        <Link href="/content"
          className="text-xs font-medium text-grey-500 hover:text-dark flex items-center gap-1 transition">
          Review Queue <ArrowRight size={10} />
        </Link>
        <button onClick={onDismiss} className="text-xs text-grey-400 hover:text-grey-600 ml-auto transition">
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Content Stats Sidebar ────────────────────────────────────────────────────

function ContentStatsPanel({ stats }: { stats: ContentStats | null }) {
  const verified = stats?.verified ?? 0;
  const total    = stats?.total ?? 0;
  const pct      = Math.min((verified / TARGET_ENTRIES) * 100, 100);

  return (
    <div className="space-y-4">
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
          <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-grey-400">{Math.round(pct)}% of target • {total} total entries</p>
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

      <div className="border border-slate-200 rounded-lg p-5">
        <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest mb-3">Costs this month</p>
        {stats?.monthlyCosts != null ? (
          <div>
            <p className="text-2xl font-bold font-mono text-dark">
              ${stats.monthlyCosts.totalUsd.toFixed(2)}
            </p>
            <p className="text-[11px] text-grey-400 mt-1">
              across {stats.monthlyCosts.completedJobs} completed job{stats.monthlyCosts.completedJobs !== 1 ? "s" : ""} this month
            </p>
          </div>
        ) : (
          <p className="text-xs text-grey-400">No jobs completed this month</p>
        )}
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
  const score   = entry.data?.scoutScore ?? 0;
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
        <div className={cn(
          "shrink-0 min-w-[52px] text-center py-1.5 px-2 rounded-lg text-sm font-bold font-mono",
          scoreColor(score)
        )}>
          {score.toFixed(2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-dark leading-snug">{entry.name}</p>
              {entry.description && (
                <p className="text-xs text-grey-500 mt-1 leading-relaxed line-clamp-2">
                  {entry.description}
                </p>
              )}
              {(() => {
                const src = entry.data?.sources?.[0];
                if (!src?.url) return null;
                const isInsta     = src.type === "instagram" || src.type === "instagram_profile" || src.type === "instagram_post";
                const isWebSearch = src.type === "web_search";
                let icon: string; let label: string;
                if (isInsta) {
                  const handle = src.url.match(/instagram\.com\/([^/?]+)/)?.[1];
                  icon = "📸"; label = handle ? `@${handle}` : "Instagram";
                } else if (isWebSearch) {
                  icon = "🔍"; label = "web search";
                } else {
                  icon = "🌐";
                  try { label = new URL(src.url).hostname.replace(/^www\./, ""); } catch { label = src.url; }
                }
                return (
                  <a href={src.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-grey-400 hover:text-teal-dark transition-colors">
                    <span>{icon}</span>
                    <span className="font-mono">{label}</span>
                  </a>
                );
              })()}
            </div>
          </div>
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
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-teal-dark hover:underline mt-1 block truncate">
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
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg border border-slate-200 text-grey-400 hover:text-grey-700 hover:border-slate-300 transition-colors"
            title="View detail">
            {expanded ? <ChevronUp size={13} /> : <Eye size={13} />}
          </button>
          {!approved && !rejected && (
            <>
              <button onClick={() => onReject(entry.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-500 hover:border-danger hover:text-danger transition-colors">
                <X size={11} /> Reject
              </button>
              <button onClick={() => onApprove(entry.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition-colors">
                <CheckCircle2 size={11} /> Approve
              </button>
            </>
          )}
          {approved && <span className="flex items-center gap-1 text-xs font-semibold text-green-dark"><CheckCircle2 size={13} /> Approved</span>}
          {rejected && <span className="flex items-center gap-1 text-xs font-semibold text-danger"><XCircle size={13} /> Rejected</span>}
        </div>
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
            const found      = (run.routes_found ?? 0) + (run.accommodations_found ?? 0) + (run.restaurants_found ?? 0);
            const isExpanded = expandedId === run.id;
            return (
              <>
                <tr key={run.id} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-xs text-grey-500 whitespace-nowrap">{formatDate(run.created_at)}</td>
                  <td className="px-6 py-3 text-xs font-medium text-dark">{run.region}</td>
                  <td className="px-6 py-3 text-xs text-grey-600">{run.activity_type}</td>
                  <td className="px-6 py-3 text-center"><StatusBadge value={run.status} /></td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{found}</td>
                  <td className="px-6 py-3 text-right font-mono text-xs text-grey-500">~$3.00</td>
                  <td className="px-6 py-3 text-right font-mono text-xs text-grey-500">
                    {formatDuration(run.created_at, run.completed_at)}
                  </td>
                  <td className="px-4 py-3">
                    {run.status === "failed" && run.error_message && (
                      <button onClick={() => setExpandedId(isExpanded ? null : run.id)}
                        className="text-grey-400 hover:text-grey-700 transition-colors">
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

// ─── Data Sources Section ─────────────────────────────────────────────────────

function DataSourcesSection({
  sources,
  setSources,
  setStats,
  effectiveRegion,
  draftSaveStatus,
  activeJobs,
  onScrapeQueued,
  onJobDrawerOpen,
}: {
  sources: ContentSource[];
  setSources: React.Dispatch<React.SetStateAction<ContentSource[]>>;
  setStats: React.Dispatch<React.SetStateAction<ContentStats | null>>;
  effectiveRegion: string;
  draftSaveStatus: DraftSaveStatus;
  activeJobs: Record<string, ScoutJob>;
  onScrapeQueued: (sourceId: string, jobId: string) => void;
  onJobDrawerOpen: (job: ScoutJob) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddSourceForm>({ url: "", type: "website", label: "", region: "", seedUrlsRaw: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSeedWarnings, setAddSeedWarnings] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ContentSource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editTarget, setEditTarget] = useState<ContentSource | null>(null);
  const [editForm, setEditForm] = useState<{ label: string; region: string; seedUrlsRaw: string }>({ label: "", region: "", seedUrlsRaw: "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSeedWarnings, setEditSeedWarnings] = useState<string[]>([]);

  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const scrapeErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<"paste" | "review">("paste");
  const [bulkRaw, setBulkRaw] = useState("");
  const [bulkParsed, setBulkParsed] = useState<BulkParseItem[]>([]);
  const [bulkSkipped, setBulkSkipped] = useState<{ line: string; reason: string }[]>([]);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Test-fetch modal state
  const [testFetchTarget, setTestFetchTarget] = useState<ContentSource | null>(null);
  const [testFetching, setTestFetching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [testFetchResult, setTestFetchResult] = useState<Record<string, any> | null>(null);

  async function handleTestFetch(src: ContentSource) {
    setTestFetchTarget(src);
    setTestFetchResult(null);
    setTestFetching(true);
    try {
      const res = await fetch(`/api/admin/scout/sources/${src.id}/test-fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus_type: "accommodation" }),
      });
      const data = await res.json();
      setTestFetchResult(data);
    } catch (e: unknown) {
      setTestFetchResult({ error: (e as Error).message });
    } finally {
      setTestFetching(false);
    }
  }

  function openBulk() { setBulkOpen(true); setBulkStep("paste"); setBulkRaw(""); setBulkParsed([]); setBulkSkipped([]); setShowAddForm(false); }
  function closeBulk() { setBulkOpen(false); }

  function handleBulkParse() {
    const { parsed, skipped } = parseBulkUrls(bulkRaw);
    setBulkParsed(parsed);
    setBulkSkipped(skipped);
    setBulkStep("review");
  }

  async function handleBulkAdd() {
    if (bulkParsed.length === 0) return;
    setBulkAdding(true);
    const results = await Promise.allSettled(
      bulkParsed.map(item =>
        fetch("/api/admin/scout/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url, type: item.type, label: item.label }),
        }).then(r => r.json())
      )
    );
    const added = results
      .filter((r): r is PromiseFulfilledResult<ContentSource> => r.status === "fulfilled" && !r.value.error)
      .map(r => r.value);
    if (added.length > 0) setSources(s => [...added, ...s]);
    setBulkAdding(false);
    closeBulk();
  }

  async function handleAddSource() {
    if (!addForm.url || !addForm.label) return;
    setAdding(true);
    setAddError(null);
    setAddSeedWarnings([]);
    try {
      const url = addForm.url.trim().startsWith("http") ? addForm.url.trim() : `https://${addForm.url.trim()}`;
      const { urls: seedUrls, warnings } = parseSeedUrls(addForm.seedUrlsRaw);
      setAddSeedWarnings(warnings);
      const res = await fetch("/api/admin/scout/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: addForm.type, label: addForm.label, region: addForm.region || undefined, seed_urls: seedUrls }),
      });
      const data = await res.json();
      if (res.ok) {
        setSources(s => [data, ...s]);
        setShowAddForm(false);
        setAddForm({ url: "", type: "website", label: "", region: "", seedUrlsRaw: "" });
        setAddSeedWarnings([]);
      } else {
        setAddError(data.error ?? `Error ${res.status}`);
      }
    } catch (err: any) {
      setAddError(err.message ?? "Failed to save source");
    } finally {
      setAdding(false);
    }
  }

  function handleOpenEdit(src: ContentSource) {
    setEditTarget(src);
    setEditForm({
      label:       src.label,
      region:      src.region ?? "",
      seedUrlsRaw: (src.seed_urls ?? []).join("\n"),
    });
    setEditError(null);
    setEditSeedWarnings([]);
    setShowAddForm(false);
    setBulkOpen(false);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    setEditError(null);
    setEditSeedWarnings([]);
    try {
      const { urls: seedUrls, warnings } = parseSeedUrls(editForm.seedUrlsRaw);
      setEditSeedWarnings(warnings);
      const res = await fetch(`/api/admin/scout/sources/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editForm.label, region: editForm.region || null, seed_urls: seedUrls }),
      });
      const data = await res.json();
      if (res.ok) {
        setSources(s => s.map(src => src.id === editTarget.id ? data : src));
        setEditTarget(null);
      } else {
        setEditError(data.error ?? `Error ${res.status}`);
      }
    } catch (err: any) {
      setEditError(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function showScrapeError(message: string) {
    setScrapeError(message);
    if (scrapeErrorTimer.current) clearTimeout(scrapeErrorTimer.current);
    scrapeErrorTimer.current = setTimeout(() => setScrapeError(null), 5000);
  }

  async function handleScrape(id: string) {
    try {
      const res  = await fetch(`/api/admin/scout/sources/${id}/scrape`, { method: "POST" });
      const data = await res.json().catch(() => ({})) as { job_id?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          showScrapeError("Session expired. Please refresh the page and log in again.");
        } else {
          showScrapeError(data.error ?? `Could not start scrape (${res.status})`);
        }
        return;
      }
      if (data.job_id) {
        onScrapeQueued(id, data.job_id);
      }
    } catch {
      showScrapeError("Network error — could not reach the server.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/scout/sources/${deleteTarget.id}`, { method: "DELETE" });
    setSources(s => s.filter(src => src.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  const matchingCount = sources.filter(s =>
    s.status === "active" && (!s.region || effectiveRegion.toLowerCase().includes(s.region.toLowerCase()))
  ).length;

  return (
    <>
      {scrapeError && (
        <div className="mb-3 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{scrapeError}</span>
          <button onClick={() => setScrapeError(null)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      )}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <LinkIcon size={15} className="text-teal-dark" />
            </div>
            <h2 className="text-sm font-semibold text-dark">
              Data sources
              <span className="ml-1.5 text-xs font-normal text-grey-400">({sources.length})</span>
            </h2>
            <p className="text-xs text-grey-400 hidden sm:block">Add websites and Instagram pages for the scout to scrape</p>
          </div>
          <div className="flex items-center gap-2">
            {draftSaveStatus !== "idle" && (
              <span className="text-[11px] text-grey-400 select-none">
                {draftSaveStatus === "saving" ? "Saving…" : "Saved"}
              </span>
            )}
            {sources.length > 0 && (
              <button onClick={() => setClearConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-500 hover:border-danger/40 hover:text-danger hover:bg-danger/5 transition">
                <Trash2 size={12} /> Clear all
              </button>
            )}
            <button onClick={openBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-700 hover:bg-slate-50 transition">
              📋 Bulk paste
            </button>
            <button onClick={() => { setShowAddForm(s => !s); setBulkOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-700 hover:bg-slate-50 transition">
              <Plus size={12} /> Add source
            </button>
          </div>
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div className="px-6 py-4 border-b border-grey-100 bg-slate-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">URL <span className="text-danger">*</span></label>
                <input type="text" value={addForm.url}
                  onChange={e => { setAddForm(f => ({ ...f, url: e.target.value })); setAddError(null); }}
                  placeholder="https://myblog.com or instagram.com/handle"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400"
                  autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">Label <span className="text-danger">*</span></label>
                <input type="text" value={addForm.label}
                  onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. My Cycling Blog"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">Type</label>
                <div className="flex gap-2">
                  {(["website", "instagram"] as const).map(t => (
                    <button key={t} onClick={() => setAddForm(f => ({ ...f, type: t }))}
                      className={cn(
                        "flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all",
                        addForm.type === t ? "border-teal bg-teal-bg text-teal-dark" : "border-slate-200 text-grey-500 bg-white hover:border-slate-300"
                      )}>
                      {t === "instagram" ? <Instagram size={12} /> : <Globe size={12} />}
                      {t === "instagram" ? "Instagram" : "Website"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">Region hint <span className="text-grey-400 font-normal normal-case">(optional)</span></label>
                <input type="text" value={addForm.region}
                  onChange={e => setAddForm(f => ({ ...f, region: e.target.value }))}
                  placeholder="e.g. Italy, Alps…"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">
                Seed URLs <span className="text-grey-400 font-normal normal-case">(optional — one per line, cap 20)</span>
              </label>
              <textarea
                value={addForm.seedUrlsRaw}
                onChange={e => setAddForm(f => ({ ...f, seedUrlsRaw: e.target.value }))}
                rows={4}
                placeholder={"https://example.com/en/accommodation\nhttps://example.com/en/hotels"}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400 resize-none"
              />
              <p className="text-[11px] text-grey-400 mt-1">When provided, the scout uses these directly and skips homepage discovery. First 5 are fetched per run.</p>
            </div>
            {addSeedWarnings.length > 0 && (
              <div className="space-y-0.5">
                {addSeedWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-warning font-mono">{w}</p>
                ))}
              </div>
            )}
            {addError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
                <AlertTriangle size={12} className="text-danger shrink-0" />
                <p className="text-xs text-danger">{addError}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowAddForm(false); setAddError(null); setAddSeedWarnings([]); }} className="px-3 py-1.5 text-xs text-grey-500 hover:text-grey-700 transition">Cancel</button>
              <button onClick={handleAddSource} disabled={adding || !addForm.url.trim() || !addForm.label.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition disabled:opacity-50">
                {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {adding ? "Saving…" : "Save source"}
              </button>
            </div>
          </div>
        )}

        {/* Bulk paste */}
        {bulkOpen && bulkStep === "paste" && (
          <div className="px-6 py-4 border-b border-grey-100 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-dark">📋 Bulk paste sources</p>
              <button onClick={closeBulk} className="text-grey-400 hover:text-grey-700 transition"><X size={14} /></button>
            </div>
            <p className="text-xs text-grey-500">Paste URLs, one per line. We'll auto-detect type and suggest labels.</p>
            <textarea value={bulkRaw} onChange={e => setBulkRaw(e.target.value)} rows={6}
              placeholder={"https://www.instagram.com/visitalgarve\nhttps://thecyclingnomad.com/dolomites"}
              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400 resize-none"
              autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={closeBulk} className="px-3 py-1.5 text-xs text-grey-500 hover:text-grey-700 transition">Cancel</button>
              <button onClick={handleBulkParse} disabled={!bulkRaw.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition disabled:opacity-50">
                Parse {bulkRaw.trim().split("\n").filter(l => l.trim()).length} URLs →
              </button>
            </div>
          </div>
        )}

        {bulkOpen && bulkStep === "review" && (
          <div className="px-6 py-4 border-b border-grey-100 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-dark">Review {bulkParsed.length} {bulkParsed.length === 1 ? "source" : "sources"}</p>
              <button onClick={closeBulk} className="text-grey-400 hover:text-grey-700 transition"><X size={14} /></button>
            </div>
            {bulkParsed.length > 0 && (
              <div className="space-y-2">
                {bulkParsed.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <button
                      onClick={() => setBulkParsed(prev => prev.map((p, j) => j === i ? { ...p, type: p.type === "instagram" ? "website" : "instagram" } : p))}
                      className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 transition",
                        item.type === "instagram" ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      )}
                      title="Click to toggle type">
                      {item.type === "instagram" ? <Instagram size={10} /> : <Globe size={10} />}
                      {item.type === "instagram" ? "Instagram" : "Website"}
                    </button>
                    <input value={item.label}
                      onChange={e => setBulkParsed(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p))}
                      className="flex-1 min-w-0 text-xs font-medium text-dark bg-transparent border-b border-transparent focus:border-teal-400 focus:outline-none py-0.5" />
                    <span className="text-[10px] text-grey-400 font-mono truncate max-w-[180px] shrink-0">
                      {item.url.replace(/^https?:\/\//, "")}
                    </span>
                    <button onClick={() => setBulkParsed(prev => prev.filter((_, j) => j !== i))}
                      className="text-grey-300 hover:text-danger transition shrink-0"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            {bulkSkipped.length > 0 && (
              <div className="text-xs text-grey-400 space-y-0.5">
                <p className="font-semibold text-grey-500">Skipped:</p>
                {bulkSkipped.map((s, i) => (
                  <p key={i} className="font-mono">• &ldquo;{s.line.slice(0, 60)}{s.line.length > 60 ? "…" : ""}&rdquo; — {s.reason}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkStep("paste")} className="px-3 py-1.5 text-xs text-grey-500 hover:text-grey-700 transition">← Back</button>
              <button onClick={closeBulk} className="px-3 py-1.5 text-xs text-grey-500 hover:text-grey-700 transition">Cancel</button>
              <button onClick={handleBulkAdd} disabled={bulkAdding || bulkParsed.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition disabled:opacity-50">
                {bulkAdding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {bulkAdding ? "Adding…" : `Add ${bulkParsed.length} ${bulkParsed.length === 1 ? "source" : "sources"}`}
              </button>
            </div>
          </div>
        )}

        {/* Inline edit panel */}
        {editTarget && (
          <div className="px-6 py-4 border-b border-grey-100 bg-amber-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-dark">Edit: <span className="font-mono text-grey-500">{editTarget.url}</span></p>
              <button onClick={() => setEditTarget(null)} className="text-grey-400 hover:text-grey-700 transition"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">Label <span className="text-danger">*</span></label>
                <input type="text" value={editForm.label}
                  onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">Region hint <span className="text-grey-400 font-normal normal-case">(optional)</span></label>
                <input type="text" value={editForm.region}
                  onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}
                  placeholder="e.g. Portugal, Algarve…"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1">
                Seed URLs <span className="text-grey-400 font-normal normal-case">(optional — one per line, cap 20)</span>
              </label>
              <textarea
                value={editForm.seedUrlsRaw}
                onChange={e => setEditForm(f => ({ ...f, seedUrlsRaw: e.target.value }))}
                rows={5}
                placeholder={"https://example.com/en/accommodation\nhttps://example.com/en/hotels"}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-teal-400 resize-none"
              />
              <p className="text-[11px] text-grey-400 mt-1">When provided, the scout uses these directly and skips homepage discovery. First 5 are fetched per run.</p>
            </div>
            {editSeedWarnings.length > 0 && (
              <div className="space-y-0.5">
                {editSeedWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-warning font-mono">{w}</p>
                ))}
              </div>
            )}
            {editError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
                <AlertTriangle size={12} className="text-danger shrink-0" />
                <p className="text-xs text-danger">{editError}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditTarget(null)} className="px-3 py-1.5 text-xs text-grey-500 hover:text-grey-700 transition">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editForm.label.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition disabled:opacity-50">
                {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}

        {/* Sources table */}
        {sources.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <LinkIcon size={16} className="text-grey-400" />
            </div>
            <p className="text-sm font-medium text-grey-500">No data sources yet</p>
            <p className="text-xs text-grey-400 mt-1">Add websites and Instagram pages to scrape content from specific sources.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide bg-grey-50">
                <th className="text-left px-6 py-3">Label</th>
                <th className="text-left px-6 py-3">URL</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Region</th>
                <th className="text-left px-6 py-3">Last scraped</th>
                <th className="text-left px-6 py-3">Entries</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {sources.map(src => {
                const activeJob = activeJobs[src.id];
                const hasActiveJob = activeJob && (activeJob.status === "queued" || activeJob.status === "running");
                const isBroken  = src.health === "broken";
                return (
                  <tr key={src.id} className="border-b border-grey-50 hover:bg-grey-50/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-dark text-sm">
                      <div className="flex items-center gap-1.5">
                        {isBroken && (
                          <span title={src.last_error_message ?? "Source broken"}>
                            <AlertCircle size={12} className="text-danger shrink-0" />
                          </span>
                        )}
                        {src.label}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <a href={src.url} target="_blank" rel="noopener noreferrer"
                        className="text-teal-dark hover:underline text-xs font-mono truncate max-w-[200px] block">
                        {src.url.replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        src.type === "instagram" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {src.type === "instagram" ? <Instagram size={10} /> : <Globe size={10} />}
                        {src.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-grey-500">{src.region ?? "—"}</td>
                    <td className="px-6 py-3 text-xs text-grey-500">
                      {src.last_scraped_at ? formatDate(src.last_scraped_at) : "Never"}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-dark">{src.entry_count}</td>
                    <td className="px-6 py-3">
                      {activeJob && (activeJob.status === "queued" || activeJob.status === "running" || activeJob.status === "done" || activeJob.status === "failed") ? (
                        <JobStatusBadge job={activeJob} onClick={() => onJobDrawerOpen(activeJob)} />
                      ) : (
                        <StatusBadge value={src.status} />
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleOpenEdit(src)}
                          title="Edit source"
                          className="p-1.5 rounded-lg border border-transparent text-grey-400 hover:border-slate-200 hover:text-grey-700 hover:bg-slate-50 transition">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleTestFetch(src)}
                          title="Test fetch"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-700 hover:bg-slate-50 transition">
                          <Eye size={11} />
                          Test
                        </button>
                        <button
                          onClick={() => handleScrape(src.id)}
                          disabled={hasActiveJob}
                          title="Scrape now"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-grey-700 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                          <RefreshCw size={11} />
                          Scrape
                        </button>
                        <button onClick={() => setDeleteTarget(src)} title="Delete"
                          className="p-1.5 rounded-lg border border-transparent text-grey-400 hover:border-danger/20 hover:text-danger hover:bg-danger/5 transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Include-in-scout hint */}
        {sources.length > 0 && effectiveRegion && matchingCount > 0 && (
          <div className="px-6 py-3 border-t border-grey-100 bg-teal-bg/30">
            <p className="text-xs text-teal-dark">
              <strong>{matchingCount}</strong> active {matchingCount === 1 ? "source matches" : "sources match"} the selected region. Check &ldquo;Include active sources&rdquo; below to include {matchingCount === 1 ? "it" : "them"} in the next scout run.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title={`Delete "${deleteTarget?.label}"?`}
        description="This removes the source from your list. Content entries already scraped from it will not be deleted."
        confirmLabel="Delete source"
        variant="danger"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={open => { if (!open) setClearConfirmOpen(false); }}
        title={`Clear all ${sources.length} ${sources.length === 1 ? "source" : "sources"}?`}
        description="This can't be undone."
        confirmLabel="Clear all"
        variant="danger"
        onConfirm={() => { setSources([]); setClearConfirmOpen(false); }}
      />

      {/* Test Fetch Modal */}
      {testFetchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setTestFetchTarget(null); setTestFetchResult(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-dark">Test fetch — {testFetchTarget.label}</h3>
              <button onClick={() => { setTestFetchTarget(null); setTestFetchResult(null); }} className="text-grey-400 hover:text-grey-700">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-grey-500 mb-4 font-mono break-all">{testFetchTarget.url}</p>

            {testFetching && (
              <div className="flex items-center gap-2 text-xs text-grey-500">
                <Loader2 size={14} className="animate-spin" />
                Fetching…
              </div>
            )}

            {!testFetching && !testFetchResult && (
              <p className="text-xs text-grey-400">Loading result…</p>
            )}

            {testFetchResult && !testFetching && (
              <div className="space-y-3 text-xs">
                {testFetchResult.error ? (
                  <div className="flex items-start gap-2 text-danger">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{testFetchResult.error}</span>
                  </div>
                ) : testFetchResult.fetch_method === "instagram" ? (
                  <p className="text-grey-500">{testFetchResult.note}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {testFetchResult.spa_detected ? (
                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      )}
                      <span className={testFetchResult.spa_detected ? "text-amber-700 font-medium" : "text-emerald-700 font-medium"}>
                        {testFetchResult.spa_detected
                          ? `SPA detected — headless required (${testFetchResult.spa_reason})`
                          : "Static HTML viable"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-grey-600">
                      <span className="text-grey-400">Fetch method</span>
                      <span className="font-mono">{testFetchResult.fetch_method}</span>
                      <span className="text-grey-400">Visible text</span>
                      <span>{testFetchResult.visible_text_chars?.toLocaleString()} chars</span>
                      <span className="text-grey-400">Cost estimate</span>
                      <span>{testFetchResult.cost_estimate_usd === 0 ? "free" : `$${testFetchResult.cost_estimate_usd}/page`}</span>
                    </div>

                    {testFetchResult.note && (
                      <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{testFetchResult.note}</p>
                    )}

                    {testFetchResult.discover && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-3 text-grey-500">
                          <span>Locale: <span className="font-mono font-medium text-dark">{testFetchResult.discover.locale_used}</span></span>
                          <span>·</span>
                          <span>{testFetchResult.discover.candidate_links_total} same-domain links found</span>
                          <span>·</span>
                          <span>{testFetchResult.discover.sub_pages?.length ?? 0} sub-pages selected</span>
                        </div>

                        {testFetchResult.discover.top_candidates?.length > 0 ? (
                          <div>
                            <p className="text-grey-400 mb-1">Top scored candidates:</p>
                            <div className="space-y-1">
                              {testFetchResult.discover.top_candidates.map((c: { url: string; score: number; matched_keywords: string[] }, i: number) => (
                                <div key={i} className="flex items-start gap-2 bg-slate-50 rounded px-2 py-1.5">
                                  <span className="font-mono text-slate-400 w-5 shrink-0">[{c.score}]</span>
                                  <div className="min-w-0">
                                    <p className="font-mono text-slate-700 break-all truncate">{c.url}</p>
                                    <p className="text-slate-400 text-[10px]">{c.matched_keywords.join(", ")}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-amber-600">No keyword-scored candidates found. The worker will fall back to top same-domain links.</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LocationScoutPage() {
  const [form, setForm] = useState<FormState>({
    region:               "",
    customRegion:         "",
    vacationType:         "Active Holiday",
    activityFocus:        "None (general)",
    contentTypes:         ["route", "accommodation", "restaurant"],
    maxResults:           10,
    focusKeywords:        "",
    includeActiveSources: false,
    focusType:            "all",
    depth:                "standard",
    selectedSourceIds:    [],
  });

  const [run, setRun] = useState<RunState>({ phase: "idle", jobId: null, error: null });

  const [stats, setStats]     = useState<ContentStats | null>(null);
  const [history, setHistory] = useState<AgentRun[]>([]);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [presets, setPresets] = useState(PRESET_PRESETS);
  const [addPreset, setAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState<NewPreset>({ emoji: "📍", label: "" });

  const [restrictToSources, setRestrictToSources] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus]      = useState<DraftSaveStatus>("idle");
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);

  // Job tracking: source_id → latest job for that source
  const [activeJobs, setActiveJobs]       = useState<Record<string, ScoutJob>>({});
  const [jobDrawerJob, setJobDrawerJob]   = useState<ScoutJob | null>(null);

  // Load data on mount
  useEffect(() => {
    fetch("/api/admin/scout/stats").then(r => r.json()).then(setStats).catch(() => {});
    fetch("/api/admin/scout/runs").then(r => r.json()).then(data => setHistory(Array.isArray(data) ? data : [])).catch(() => {});
    fetch("/api/admin/scout/drafts")
      .then(r => r.ok ? r.json() : null)
      .then(draft => {
        if (draft?.sources?.length > 0) {
          setSources(draft.sources);
          setRestrictToSources(draft.restrict_to_sources ?? false);
        } else {
          fetch("/api/admin/scout/sources").then(r => r.json()).then(data => setSources(Array.isArray(data) ? data : [])).catch(() => {});
        }
      })
      .catch(() => {
        fetch("/api/admin/scout/sources").then(r => r.json()).then(data => setSources(Array.isArray(data) ? data : [])).catch(() => {});
      });
  }, []);

  // Debounced draft save
  useEffect(() => {
    if (isInitialMountRef.current) { isInitialMountRef.current = false; return; }
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    setDraftSaveStatus("saving");
    draftSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/admin/scout/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources, restrict_to_sources: restrictToSources }),
        });
        setDraftSaveStatus("saved");
      } catch { setDraftSaveStatus("idle"); }
    }, 500);
  }, [sources, restrictToSources]);

  // Poll active jobs every 3s
  useEffect(() => {
    const active = Object.entries(activeJobs).filter(
      ([, j]) => j.status === "queued" || j.status === "running"
    );
    if (active.length === 0) return;

    const interval = setInterval(async () => {
      for (const [sourceId, job] of active) {
        try {
          const res = await fetch(`/api/admin/scout/jobs/${job.id}`);
          if (!res.ok) continue;
          const updated: ScoutJob = await res.json();

          setActiveJobs(prev => ({ ...prev, [sourceId]: updated }));

          // Keep drawer in sync if it's showing this job
          setJobDrawerJob(prev => prev?.id === job.id ? updated : prev);

          if (updated.status === "done") {
            setSources(s => s.map(src =>
              src.id === sourceId
                ? {
                    ...src,
                    last_scraped_at: updated.finished_at ?? new Date().toISOString(),
                    entry_count:     src.entry_count + (updated.entries_created ?? 0),
                    status:          "active" as const,
                    health:          "ok" as const,
                  }
                : src
            ));
            fetch("/api/admin/scout/stats").then(r => r.json()).then(setStats).catch(() => {});
          } else if (updated.status === "failed") {
            setSources(s => s.map(src =>
              src.id === sourceId ? { ...src, status: "error" as const } : src
            ));
          }
        } catch { /* ignore fetch errors in poller */ }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobs]);

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

  function onScrapeQueued(sourceId: string, jobId: string) {
    const stub: ScoutJob = {
      id: jobId, job_type: "scrape_source", status: "queued",
      source_id: sourceId, trigger_payload: {}, attempt_count: 0, max_attempts: 3,
      last_error: null, last_error_code: null, retryable: true, progress: {},
      entries_created: null, entries_updated: null, result_summary: null,
      created_at: new Date().toISOString(), started_at: null, finished_at: null,
      next_attempt_at: null,
    };
    setActiveJobs(prev => ({ ...prev, [sourceId]: stub }));
  }

  const effectiveRegion = form.region === "custom" ? form.customRegion : form.region;

  async function handleRun() {
    if (!effectiveRegion) return;
    setRun({ phase: "queuing", jobId: null, error: null });

    const effectiveSourceList = form.selectedSourceIds.length > 0
      ? sources.filter(s => form.selectedSourceIds.includes(s.id))
      : sources;

    const contentTypes  = form.focusType !== "all"
      ? [form.focusType]
      : form.contentTypes.filter(t => ["route", "accommodation", "restaurant", "activity"].includes(t));

    const focusKeywords: string[] = [];
    if (form.activityFocus && form.activityFocus !== "None (general)") focusKeywords.push(form.activityFocus);
    if (form.focusKeywords.trim()) focusKeywords.push(...form.focusKeywords.split(",").map(k => k.trim()).filter(Boolean));

    const body: Record<string, unknown> = {
      region:               effectiveRegion,
      vacationType:         form.vacationType,
      contentTypes,
      maxResults:           form.maxResults,
      focusKeywords,
      includeActiveSources: form.includeActiveSources,
      depth:                form.depth,
    };
    if (form.focusType !== "all") body.focusType = form.focusType;
    if (effectiveSourceList.length > 0) {
      body.sourceUrls        = effectiveSourceList.map(s => s.url);
      body.restrictToSources = restrictToSources;
    }

    try {
      const res = await fetch("/api/admin/scout/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        const message = res.status === 401
          ? "Session expired. Please refresh the page and log in again."
          : (payload.error ?? `HTTP ${res.status}`);
        throw new Error(message);
      }
      setRun({ phase: "queued", jobId: payload.job_id, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRun({ phase: "failed", jobId: null, error: message });
    }
  }

  const runningJobCount = Object.values(activeJobs).filter(j => j.status === "queued" || j.status === "running").length;
  const canRun = !!effectiveRegion && run.phase !== "queuing"
    && !(restrictToSources && sources.length === 0);

  return (
    <div>
      {/* Close overlay for job drawer */}
      {jobDrawerJob && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setJobDrawerJob(null)}
        />
      )}
      {jobDrawerJob && (
        <JobDrawer job={jobDrawerJob} onClose={() => setJobDrawerJob(null)} />
      )}

      <PageHeader
        title="Location Scout"
        description="Trigger the AI scout to discover new destinations, accommodation, and restaurants from authentic travel sources."
        actions={
          <div className="flex items-center gap-2">
            {runningJobCount > 0 && (
              <button
                onClick={() => {
                  const first = Object.values(activeJobs).find(j => j.status === "queued" || j.status === "running");
                  if (first) setJobDrawerJob(first);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-100 text-teal-dark text-xs font-semibold border border-teal-200 hover:bg-teal-200 transition"
              >
                <Loader2 size={11} className="animate-spin" />
                {runningJobCount} job{runningJobCount !== 1 ? "s" : ""} running
              </button>
            )}
            <Link
              href="/agents"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={14} /> All agents
            </Link>
          </div>
        }
      />

      {/* Quick Presets */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-grey-400 font-medium mr-1">Quick start:</span>
        {presets.map((p, i) => (
          <button key={i} onClick={() => applyPreset(p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-sm hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 transition-colors text-grey-700 bg-white">
            <span>{p.emoji}</span>
            <span className="text-xs font-medium">{p.label}</span>
          </button>
        ))}
        {!addPreset ? (
          <button onClick={() => setAddPreset(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 text-xs text-grey-400 hover:border-teal hover:text-teal-dark transition-colors bg-white">
            <Plus size={11} /> Add preset
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input value={newPreset.emoji} onChange={e => setNewPreset(p => ({ ...p, emoji: e.target.value }))}
              className="w-8 text-center text-sm bg-transparent outline-none" maxLength={2} />
            <input value={newPreset.label} onChange={e => setNewPreset(p => ({ ...p, label: e.target.value }))}
              placeholder="Preset name…"
              className="text-xs bg-transparent outline-none text-dark placeholder:text-grey-300 w-28"
              onKeyDown={e => { if (e.key === "Enter") addNewPreset(); }} autoFocus />
            <button onClick={addNewPreset} className="text-teal hover:text-teal-dark transition-colors"><CheckCircle2 size={14} /></button>
            <button onClick={() => setAddPreset(false)} className="text-grey-400 hover:text-grey-700 transition-colors"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Scout Trigger Form */}
        <div className="col-span-2 border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-grey-100">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <MapPin size={15} className="text-teal-dark" />
            </div>
            <h2 className="text-sm font-semibold text-dark">Scout trigger</h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Sources */}
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Sources</label>
              {sources.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No sources added yet — add them below, or leave empty for general web search.</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map(s => {
                      const selected = form.selectedSourceIds.length === 0 || form.selectedSourceIds.includes(s.id);
                      return (
                        <button key={s.id} type="button"
                          onClick={() => {
                            setForm(prev => {
                              if (prev.selectedSourceIds.length === 0) {
                                return { ...prev, selectedSourceIds: sources.filter(x => x.id !== s.id).map(x => x.id) };
                              }
                              const next = prev.selectedSourceIds.includes(s.id)
                                ? prev.selectedSourceIds.filter(id => id !== s.id)
                                : [...prev.selectedSourceIds, s.id];
                              return { ...prev, selectedSourceIds: next.length === sources.length ? [] : next };
                            });
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all",
                            selected ? "bg-teal-50 border-teal-300 text-teal-700" : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                          )}>
                          <span>{s.type === "instagram" ? "📸" : "🌐"}</span>
                          <span className="font-mono truncate max-w-[140px]">{s.label || s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        </button>
                      );
                    })}
                  </div>
                  {form.selectedSourceIds.length > 0 && form.selectedSourceIds.length < sources.length && (
                    <button type="button" onClick={() => updateForm("selectedSourceIds", [])}
                      className="text-[10px] text-teal-600 hover:text-teal-800 underline">
                      Select all {sources.length}
                    </button>
                  )}
                </div>
              )}
            </div>

            {sources.length > 0 && (
              <label className="flex items-center gap-2.5 cursor-pointer -mt-1">
                <input type="checkbox" checked={restrictToSources} onChange={e => setRestrictToSources(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-teal-500" />
                <span className="text-xs text-grey-600">
                  Restrict to selected sources only <span className="text-grey-400">(skip general web search)</span>
                </span>
              </label>
            )}
            {restrictToSources && sources.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle size={11} /> Add at least one source or uncheck Restrict.
              </p>
            )}

            {/* Region */}
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Region <span className="text-danger">*</span></label>
              <select value={form.region} onChange={e => updateForm("region", e.target.value)}
                className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal">
                <option value="" disabled>Select a region…</option>
                {REGION_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                ))}
                <optgroup label="Custom"><option value="custom">Custom region…</option></optgroup>
              </select>
              {form.region === "custom" && (
                <input type="text" value={form.customRegion} onChange={e => updateForm("customRegion", e.target.value)}
                  placeholder="e.g. Azores, Portugal"
                  className="mt-2 w-full text-sm text-dark border border-slate-200 rounded-md px-3 py-2.5 bg-white focus:outline-none focus:border-teal-400"
                  autoFocus />
              )}
            </div>

            {/* Focus Type + Depth */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Focus type</label>
                <select value={form.focusType} onChange={e => updateForm("focusType", e.target.value)}
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal">
                  <option value="all">All types</option>
                  <option value="route">Routes only</option>
                  <option value="accommodation">Accommodation only</option>
                  <option value="restaurant">Restaurants only</option>
                  <option value="activity">Activities only</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Depth</label>
                <div className="flex gap-2">
                  {(["standard", "exhaustive"] as const).map(d => (
                    <button key={d} type="button" onClick={() => updateForm("depth", d)}
                      className={cn(
                        "flex-1 text-xs font-medium py-2.5 px-3 rounded-xl border-2 transition-all capitalize",
                        form.depth === d ? "border-teal bg-teal-bg text-teal-dark" : "border-slate-200 text-grey-500 hover:border-slate-300 bg-white"
                      )}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vacation Type + Max Results */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Vacation type</label>
                <select value={form.vacationType} onChange={e => updateForm("vacationType", e.target.value)}
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal">
                  {VACATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Max results</label>
                <select value={form.maxResults} onChange={e => updateForm("maxResults", Number(e.target.value))}
                  className="w-full text-sm text-dark border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal">
                  {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}{n === 10 ? " (default)" : ""}</option>)}
                </select>
              </div>
            </div>

            {sources.length > 0 && !restrictToSources && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.includeActiveSources} onChange={e => updateForm("includeActiveSources", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-teal-500" />
                <span className="text-xs text-grey-600">Also include active sources for this region in general search</span>
              </label>
            )}

            {/* Run button */}
            <div className="flex items-center justify-between pt-2 border-t border-grey-100">
              <div className="text-xs text-grey-500">
                <span>Estimated cost: <strong className="text-dark font-mono">~€0.50</strong></span>
                {form.depth === "exhaustive" && (
                  <span className="ml-2 text-amber-600 text-[10px]">exhaustive runs cost ~2×</span>
                )}
              </div>
              <button onClick={handleRun} disabled={!canRun}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  canRun ? "bg-teal-500 text-white hover:bg-teal-600" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}>
                {run.phase === "queuing" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {run.phase === "queuing" ? "Queuing…" : "Run Scout"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-1">
          <ContentStatsPanel stats={stats} />
        </div>
      </div>

      {/* Run queued banner */}
      {run.phase === "queued" && run.jobId && (
        <RunQueuedBanner
          jobId={run.jobId}
          depth={form.depth}
          onViewJob={() => {
            // Show a minimal job stub in the drawer (will update when polled)
            const stub: ScoutJob = {
              id: run.jobId!, job_type: "run_scout", status: "queued",
              source_id: null, trigger_payload: {}, attempt_count: 0, max_attempts: 3,
              last_error: null, last_error_code: null, retryable: true, progress: {},
              entries_created: null, entries_updated: null, result_summary: null,
              created_at: new Date().toISOString(), started_at: null, finished_at: null,
              next_attempt_at: null,
            };
            setJobDrawerJob(stub);
          }}
          onDismiss={() => setRun({ phase: "idle", jobId: null, error: null })}
        />
      )}

      {/* Run failed banner */}
      {run.phase === "failed" && (
        <div className="border-l-4 border-danger bg-danger-light rounded-r-xl p-5 mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={17} className="text-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-dark">Failed to queue scout run</p>
              <p className="text-xs text-grey-500 mt-1 font-mono">{run.error}</p>
            </div>
          </div>
          <button onClick={() => setRun({ phase: "idle", jobId: null, error: null })} className="text-grey-400 hover:text-grey-700 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Data Sources */}
      <div className="mb-6">
        <DataSourcesSection
          sources={sources}
          setSources={setSources}
          setStats={setStats}
          effectiveRegion={effectiveRegion}
          draftSaveStatus={draftSaveStatus}
          activeJobs={activeJobs}
          onScrapeQueued={onScrapeQueued}
          onJobDrawerOpen={setJobDrawerJob}
        />
      </div>

      {/* Run History */}
      <RunHistoryTable runs={history} />
    </div>
  );
}
