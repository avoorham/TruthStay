"use client";
import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, ExternalLink, RefreshCw, GitMerge,
  MapPin, X,
} from "lucide-react";
import { PageHeader }      from "@/components/shared/PageHeader";
import { TrustScoreBadge } from "@/components/shared/TrustScoreBadge";
import { InlineText }      from "@/components/inline-edit/InlineText";
import { InlineTextarea }  from "@/components/inline-edit/InlineTextarea";
import { InlineSelect }    from "@/components/inline-edit/InlineSelect";
import { InlineSourceUrls } from "@/components/inline-edit/InlineSourceUrls";
import { cn }              from "@/lib/utils";
import type { ContentEntry, SourceUrl } from "@/lib/queries/content";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "accommodation", label: "Accommodation" },
  { value: "restaurant",    label: "Restaurant" },
  { value: "activity",      label: "Activity" },
  { value: "route",         label: "Route" },
];

const SOURCE_TYPE_ICON: Record<string, string> = {
  blog:              "🌐",
  instagram_profile: "📸",
  instagram_post:    "📸",
  web_search:        "🔍",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  entry: initialEntry,
  onDecision,
  onEntryUpdated,
}: {
  entry:           ContentEntry;
  onDecision:      (id: string, decision: "approve" | "reject", extra?: { reason?: string }) => Promise<void>;
  onEntryUpdated:  (updated: ContentEntry) => void;
}) {
  const [entry,       setEntry]       = useState(initialEntry);
  const [actioning,   setActioning]   = useState(false);
  const [expanded,    setExpanded]    = useState(false);
  const [showReject,  setShowReject]  = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [lightbox,    setLightbox]    = useState(false);

  // Track which fields are currently in edit mode
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const anyEditing = editingFields.size > 0;

  // Keep local entry in sync when parent re-renders
  useEffect(() => { setEntry(initialEntry); }, [initialEntry]);

  function setFieldEditing(field: string, editing: boolean) {
    setEditingFields(prev => {
      const next = new Set(prev);
      if (editing) next.add(field); else next.delete(field);
      return next;
    });
  }

  // Generic field save: PATCH one field, update local state from response
  const saveField = useCallback(async (field: string, value: unknown) => {
    const res = await fetch(`/api/admin/content/${entry.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    if (data.entry) {
      setEntry(data.entry);
      onEntryUpdated(data.entry);
    }
  }, [entry.id, onEntryUpdated]);

  async function act(decision: "approve" | "reject", extra?: { reason?: string }) {
    setActioning(true);
    await onDecision(entry.id, decision, extra);
    setActioning(false);
  }

  const sourceUrls: SourceUrl[] = entry.source_urls ?? [];
  const trustScore       = entry.trust_score ?? 0;
  const sourceTrustScore = entry.source_trust_score ?? 0;
  const userTrustScore   = entry.user_trust_score ?? 0.5;
  const qualScore   = Number(entry.quality_score ?? 0);
  const qualExpl    = (entry.features as Record<string, unknown>)?.quality_explanation as string | undefined;
  const coords      = (entry.data as Record<string, unknown>)?.coordinates as { lat: number; lng: number } | undefined;
  const mapsUrl     = coords ? `https://maps.google.com/?q=${coords.lat},${coords.lng}` : null;
  const canonicalId = entry.canonical_id;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type — inline select */}
          <InlineSelect
            value={entry.type}
            options={TYPE_OPTIONS}
            onSave={v => saveField("type", v)}
            onEditingChange={e => setFieldEditing("type", e)}
            className="text-xs font-semibold text-grey-600"
          />
          {/* Region + Country — inline text */}
          <span className="flex items-center gap-0.5 text-[10px] text-grey-400">
            <MapPin size={9} />
            <InlineText
              value={entry.region?.split(",")[0] ?? ""}
              onSave={v => saveField("region", v)}
              onEditingChange={e => setFieldEditing("region", e)}
              minLen={2}
              maxLen={100}
              placeholder="Region"
              className="text-[10px] text-grey-400"
            />
            {(entry.country || true) && (
              <>
                <span className="text-grey-300">,</span>
                <InlineText
                  value={entry.country ?? ""}
                  onSave={v => saveField("country", v)}
                  onEditingChange={e => setFieldEditing("country", e)}
                  minLen={0}
                  maxLen={100}
                  placeholder="Country"
                  className="text-[10px] text-grey-400"
                />
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
               className="text-grey-400 hover:text-blue-600 transition" title="Open in Maps">
              <MapPin size={13} />
            </a>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-grey-400 hover:text-grey-700 transition text-[10px]"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Image + Name + Description */}
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
                onError={e => {
                  e.currentTarget.style.display = "none";
                  (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
                }}
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

        {/* Name + Description */}
        <div className="flex-1 min-w-0">
          <InlineText
            value={entry.name}
            onSave={v => saveField("name", v)}
            onEditingChange={e => setFieldEditing("name", e)}
            minLen={2}
            maxLen={200}
            className="text-sm font-semibold text-dark leading-snug"
          />
          <div className="mt-1">
            <InlineTextarea
              value={entry.description ?? ""}
              onSave={v => saveField("description", v)}
              onEditingChange={e => setFieldEditing("description", e)}
              minLen={10}
              maxLen={2000}
              placeholder="Click to add description…"
              className="text-xs text-grey-500 leading-relaxed"
            />
          </div>
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
            />
            <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-dark truncate">{entry.name}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a href={entry.image_url} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition">
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
          <div className="mt-1 grid grid-cols-2 gap-x-3">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-grey-400">Source</span>
                <span className="text-[9px] font-mono text-grey-500">{(sourceTrustScore * 100).toFixed(0)}%</span>
              </div>
              <ScoreBar value={sourceTrustScore} color="bg-teal-300" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-grey-400">User</span>
                <span className="text-[9px] font-mono text-grey-500">{(userTrustScore * 100).toFixed(0)}%</span>
              </div>
              <ScoreBar value={userTrustScore} color="bg-violet-400" />
            </div>
          </div>
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

      {/* Source URL inline editor */}
      <div className="px-4 pb-3">
        <p className="text-[10px] font-semibold text-grey-400 uppercase tracking-wide mb-1.5">Sources</p>
        <InlineSourceUrls
          sources={sourceUrls}
          onSave={v => saveField("source_urls", v)}
          onEditingChange={e => setFieldEditing("sources", e)}
        />
      </div>

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
              onClick={() => { setShowReject(false); act("reject", { reason: rejectReason || undefined }); }}
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
        <button
          onClick={() => act("approve", {})}
          disabled={actioning || anyEditing}
          title={anyEditing ? "Save your edits first" : undefined}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium rounded-md py-2 transition",
            anyEditing
              ? "text-grey-400 bg-slate-100 cursor-not-allowed"
              : "text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50",
          )}
        >
          <CheckCircle2 size={12} /> Approve
        </button>
        <button
          onClick={() => setShowReject(s => !s)}
          disabled={actioning || anyEditing}
          title={anyEditing ? "Save your edits first" : undefined}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium rounded-md py-2 transition",
            anyEditing
              ? "text-grey-400 bg-slate-100 cursor-not-allowed"
              : "text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50",
          )}
        >
          <XCircle size={12} /> Reject
        </button>
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
    const res  = await fetch("/api/admin/content/review-queue");
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDecision(
    id:        string,
    decision:  "approve" | "reject",
    extra?:    { reason?: string },
  ) {
    const status  = decision === "approve" ? "approved" : "rejected";
    await fetch(`/api/admin/content/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ decision, reason: extra?.reason, status }),
    });
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function handleEntryUpdated(updated: ContentEntry) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
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
              onEntryUpdated={handleEntryUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
