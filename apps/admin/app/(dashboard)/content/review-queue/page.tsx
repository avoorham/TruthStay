"use client";
import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, ExternalLink, RefreshCw, GitMerge,
  MapPin, Link2, Utensils, Bed, Route, Activity,
  ChevronDown, ChevronUp, Edit2, Save, X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TrustScoreBadge } from "@/components/shared/TrustScoreBadge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { ContentEntry, SourceUrl } from "@/lib/queries/content";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  restaurant:    <Utensils size={14} />,
  accommodation: <Bed      size={14} />,
  route:         <Route    size={14} />,
  activity:      <Activity size={14} />,
};

const SOURCE_TYPE_ICON: Record<string, string> = {
  blog:              "🌐",
  instagram_profile: "📸",
  instagram_post:    "📸",
  web_search:        "🔍",
};

function sourceLabel(s: SourceUrl): string {
  if (s.source_label) return s.source_label;
  try {
    const url = new URL(s.source_url);
    if (url.hostname.includes("instagram.com")) {
      const handle = url.pathname.replace(/^\//, "").split("/")[0];
      return handle ? `@${handle}` : "Instagram";
    }
    return url.hostname.replace(/^www\./, "");
  } catch { return s.source_url; }
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-grey-600 w-8 text-right">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({
  entry,
  onDecision,
}: {
  entry: ContentEntry;
  onDecision: (id: string, decision: "approve" | "reject" | "edit", extra?: { reason?: string; updates?: Record<string, unknown> }) => Promise<void>;
}) {
  const [actioning, setActioning]       = useState(false);
  const [expanded, setExpanded]         = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [editName, setEditName]         = useState(entry.name);
  const [editDesc, setEditDesc]         = useState(entry.description ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject]     = useState(false);
  const [lightbox, setLightbox]         = useState(false);

  const sourceUrls: SourceUrl[] = entry.source_urls ?? [];
  const trustScore  = entry.trust_score ?? 0;
  const qualScore   = Number(entry.quality_score ?? 0);
  const qualExpl    = (entry.features as any)?.quality_explanation as string | undefined;
  const coords      = (entry.data as any)?.coordinates as { lat: number; lng: number } | undefined;
  const mapsUrl     = coords ? `https://maps.google.com/?q=${coords.lat},${coords.lng}` : null;
  const canonicalId = entry.canonical_id;

  async function act(decision: "approve" | "reject" | "edit", extra?: Parameters<typeof onDecision>[2]) {
    setActioning(true);
    await onDecision(entry.id, decision, extra);
    setActioning(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-grey-500">{TYPE_ICON[entry.type]}</span>
          <span className="text-xs font-semibold text-grey-500 capitalize">{entry.type}</span>
          {entry.region && (
            <span className="flex items-center gap-0.5 text-[10px] text-grey-400">
              <MapPin size={9} />{entry.region.split(",")[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
               className="text-grey-400 hover:text-blue-600 transition" title="Open in Maps">
              <MapPin size={13} />
            </a>
          )}
          <button onClick={() => setExpanded(e => !e)} className="text-grey-400 hover:text-grey-700 transition">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Name + description */}
      <div className="px-4 pt-3 pb-2 flex items-start gap-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {entry.image_url ? (
            <button onClick={() => setLightbox(true)} className="block focus:outline-none" title="Click to enlarge">
              <img
                src={entry.image_url}
                alt={entry.name}
                loading="lazy"
                className="w-20 h-16 object-cover rounded border border-slate-100 hover:opacity-90 transition"
                onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove("hidden"); }}
              />
              <div className="hidden w-20 h-16 bg-slate-100 rounded border border-slate-100 flex items-center justify-center text-[10px] text-grey-400">
                No image
              </div>
            </button>
          ) : (
            <div className="w-20 h-16 bg-slate-100 rounded border border-slate-100 flex items-center justify-center text-[10px] text-grey-400">
              No image
            </div>
          )}
        </div>

        {/* Name + description content */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full text-sm font-semibold text-dark border-b border-teal-400 focus:outline-none mb-1"
            />
          ) : (
            <p className="text-sm font-semibold text-dark leading-snug">{entry.name}</p>
          )}
          {editMode ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={3}
              className="w-full text-xs text-grey-600 mt-1 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-teal-400 resize-none"
            />
          ) : (
            entry.description && (
              <p className="text-xs text-grey-500 mt-1 line-clamp-2 leading-relaxed">{entry.description}</p>
            )
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && entry.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img
              src={entry.image_url}
              alt={entry.name}
              className="w-full object-contain max-h-96"
              onError={e => { (e.currentTarget as HTMLImageElement).src = ""; }}
            />
            <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-dark truncate">{entry.name}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={entry.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition"
                >
                  <ExternalLink size={11} /> Open image
                </a>
                <button onClick={() => setLightbox(false)} className="text-xs text-grey-400 hover:text-grey-700 transition">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scores */}
      <div className="px-4 pb-3 space-y-2">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold text-grey-400 uppercase tracking-wide">
              Trust · {entry.independent_source_count} independent {entry.independent_source_count === 1 ? "source" : "sources"}
            </span>
            <TrustScoreBadge score={trustScore} />
          </div>
          <ScoreBar value={trustScore} color="bg-teal-400" />
        </div>
        {qualScore > 0 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold text-grey-400 uppercase tracking-wide">Quality</span>
              <span className="text-[10px] font-mono text-grey-600">{(qualScore * 100).toFixed(0)}%</span>
            </div>
            <ScoreBar value={qualScore} color={qualScore >= 0.7 ? "bg-green-400" : qualScore >= 0.4 ? "bg-amber-400" : "bg-red-400"} />
            {qualExpl && <p className="text-[10px] text-grey-400 mt-0.5 italic">{qualExpl}</p>}
          </div>
        )}
      </div>

      {/* Source URL badges */}
      {sourceUrls.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {sourceUrls.map((s, i) => (
            <a
              key={i}
              href={s.evidence_url ?? s.source_url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.evidence_excerpt ?? ""}
              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-grey-600 rounded-full px-2 py-0.5 transition"
            >
              <span>{SOURCE_TYPE_ICON[s.source_type] ?? "🌐"}</span>
              <span className="font-mono truncate max-w-[120px]">{sourceLabel(s)}</span>
            </a>
          ))}
        </div>
      )}

      {/* Expanded: features panel */}
      {expanded && Object.keys(entry.features ?? {}).length > 0 && (
        <div className="mx-4 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[10px] font-semibold text-grey-400 uppercase tracking-wide mb-2">Features</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(entry.features).filter(([k]) => k !== "quality_explanation").map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[10px]">
                <span className="text-grey-500">{k.replace(/_/g, " ")}</span>
                <span className="font-mono text-dark">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Possible duplicate banner */}
      {canonicalId && (
        <div className="mx-4 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2">
          <p className="text-[10px] text-amber-700 font-medium">Possible duplicate — review before approving</p>
          <button
            onClick={() => act("reject", { reason: `Merged into ${canonicalId}` }).then(
              () => fetch(`/api/admin/content/${entry.id}/merge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canonicalId }),
              })
            )}
            disabled={actioning}
            className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 transition whitespace-nowrap"
          >
            <GitMerge size={11} /> Merge into original
          </button>
        </div>
      )}

      {/* Reject reason input */}
      {showReject && (
        <div className="px-4 pb-3 space-y-2">
          <input
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowReject(false)} className="text-xs text-grey-500 hover:text-grey-700 transition">Cancel</button>
            <button
              onClick={() => { setShowReject(false); act("reject", { reason: rejectReason || undefined, updates: { status: "rejected" } }); }}
              disabled={actioning}
              className="flex items-center gap-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1.5 transition disabled:opacity-50"
            >
              <XCircle size={11} /> Confirm reject
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-4 pb-4 border-t border-slate-100 pt-3 mt-auto">
        {editMode ? (
          <>
            <button
              onClick={() => setEditMode(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs text-grey-600 border border-slate-200 rounded-md py-2 hover:bg-slate-50 transition"
            >
              <X size={12} /> Cancel
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                act("edit", { updates: { name: editName, description: editDesc } });
              }}
              disabled={actioning}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-teal-500 hover:bg-teal-600 rounded-md py-2 transition disabled:opacity-50"
            >
              <Save size={12} /> Save edit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => act("approve", { updates: { status: "approved" } })}
              disabled={actioning}
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md py-2 transition disabled:opacity-50"
            >
              <CheckCircle2 size={12} /> Approve
            </button>
            <button
              onClick={() => setEditMode(true)}
              disabled={actioning}
              className="inline-flex items-center justify-center gap-1 text-xs font-medium text-grey-600 border border-slate-200 hover:bg-slate-50 rounded-md px-3 py-2 transition disabled:opacity-50"
              title="Edit before approving"
            >
              <Edit2 size={12} /> Edit
            </button>
            <button
              onClick={() => setShowReject(s => !s)}
              disabled={actioning}
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md py-2 transition disabled:opacity-50"
            >
              <XCircle size={12} /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/content/review-queue");
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDecision(
    id: string,
    decision: "approve" | "reject" | "edit",
    extra?: { reason?: string; updates?: Record<string, unknown> }
  ) {
    const updates = extra?.updates ?? (
      decision === "approve" ? { status: "approved" } :
      decision === "reject"  ? { status: "rejected" } : {}
    );
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason: extra?.reason, ...updates }),
    });
    // Remove from queue immediately on approve/reject; keep on edit (status stays pending_review)
    if (decision !== "edit") setEntries(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description={`${entries.length} entr${entries.length !== 1 ? "ies" : "y"} pending review — sorted by trust score`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 transition text-slate-500"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <a
              href="/content"
              className="inline-flex items-center gap-1.5 border border-slate-200 text-sm font-medium px-4 py-2 rounded-md text-slate-700 hover:bg-slate-50 transition"
            >
              All Content
            </a>
          </div>
        }
      />

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">Queue is empty</p>
          <p className="text-sm text-slate-500">All entries have been reviewed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {entries.map(entry => (
            <ReviewCard
              key={entry.id}
              entry={entry}
              onDecision={handleDecision}
            />
          ))}
        </div>
      )}
    </div>
  );
}
