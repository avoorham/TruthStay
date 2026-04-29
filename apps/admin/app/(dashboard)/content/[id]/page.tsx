"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Trash2, CheckCircle2, XCircle,
  ExternalLink, MapPin, Star, Route, Building2, UtensilsCrossed,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrustScoreBadge } from "@/components/shared/TrustScoreBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Source {
  url?: string;
  type?: string;
  author?: string;
  excerpt?: string;
  publishedDate?: string;
}

interface EntryData {
  sources?: Source[];
  highlights?: string[];
  coordinates?: { lat: number; lng: number };
  scoutScore?: number;
  scoutReason?: string;
  agentRunId?: string;
  // Route metadata
  distanceKm?: number;
  elevationGainM?: number;
  difficulty?: string;
  surfaceType?: string;
  bestSeason?: string;
  // Accommodation metadata
  accommodationType?: string;
  priceRange?: string;
  // Restaurant metadata
  cuisineType?: string;
  mustTry?: string | string[];
  // Catch-all for other metadata
  [key: string]: unknown;
}

type Entry = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  country: string | null;
  verified: boolean;
  trust_score: number | null;
  source_type: string | null;
  activity_type: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  data: EntryData | null;
  created_at: string;
  updated_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely convert any value to a renderable string, guarding against objects. */
function renderValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(v => renderValue(v)).join(", ");
  return JSON.stringify(value);
}

const SOURCE_TYPE_STYLE: Record<string, string> = {
  blog:      "bg-blue-light text-blue",
  instagram: "bg-lavender text-charcoal",
  strava:    "bg-warning-light text-warning",
};

function sourceTypeBadge(type: string | undefined) {
  const label = type ?? "link";
  return (
    <span className={cn(
      "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
      SOURCE_TYPE_STYLE[label] ?? "bg-grey-100 text-grey-700"
    )}>
      {label}
    </span>
  );
}

// Known metadata keys rendered in dedicated UI — skip in the "other" section
const KNOWN_META_KEYS = new Set([
  "sources", "highlights", "coordinates", "scoutScore", "scoutReason", "agentRunId",
  "distanceKm", "elevationGainM", "difficulty", "surfaceType", "bestSeason",
  "accommodationType", "priceRange", "cuisineType", "mustTry",
]);

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-dark">
          {source.author ?? `Source ${index + 1}`}
        </span>
        {sourceTypeBadge(source.type)}
      </div>

      {source.excerpt && (
        <p className="text-xs text-grey-600 leading-relaxed line-clamp-2 italic">
          "{source.excerpt}"
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        {source.publishedDate && (
          <span className="text-[11px] text-grey-400">{source.publishedDate}</span>
        )}
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue hover:underline ml-auto shrink-0"
          >
            View source <ExternalLink size={11} />
          </a>
        ) : (
          <span className="text-[11px] text-grey-400 ml-auto">No URL</span>
        )}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 text-xs py-2 border-b border-grey-50 last:border-0">
      <span className="text-grey-500 shrink-0">{label}</span>
      <span className="font-medium text-dark text-right">{renderValue(value)}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [entry,      setEntry]      = useState<Entry | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saved,      setSaved]      = useState(false);

  // Editable fields
  const [name,         setName]         = useState("");
  const [region,       setRegion]       = useState("");
  const [country,      setCountry]      = useState("");
  const [description,  setDescription]  = useState("");
  const [activityType, setActivityType] = useState("");

  useEffect(() => {
    fetch(`/api/admin/content/${id}`)
      .then(r => r.json())
      .then(d => {
        setEntry(d);
        setName(d.name ?? "");
        setRegion(d.region ?? "");
        setCountry(d.country ?? "");
        setDescription(d.description ?? "");
        setActivityType(d.activity_type ?? "");
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, region, country, description, activity_type: activityType }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleVerify(v: boolean) {
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: v }),
    });
    setEntry(e => e ? { ...e, verified: v } : e);
  }

  async function handleDelete() {
    await fetch(`/api/admin/content/${id}`, { method: "DELETE" });
    router.push("/content");
  }

  if (loading) return <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>;
  if (!entry)  return <div className="text-center py-20 text-grey-500 text-sm">Entry not found.</div>;

  const data         = entry.data ?? {};
  const sources      = Array.isArray(data.sources) ? data.sources : [];
  const highlights   = Array.isArray(data.highlights) ? data.highlights : [];
  const coordinates  = data.coordinates ?? (entry.lat != null && entry.lng != null ? { lat: entry.lat, lng: entry.lng } : null);
  const scoutScore   = typeof data.scoutScore === "number" ? data.scoutScore : null;
  const scoutReason  = typeof data.scoutReason === "string" ? data.scoutReason : null;

  // Type-specific metadata
  const isRoute         = entry.type === "route";
  const isAccommodation = entry.type === "accommodation";
  const isRestaurant    = entry.type === "restaurant";

  // Any extra keys not handled above
  const extraMeta = Object.entries(data).filter(([k]) => !KNOWN_META_KEYS.has(k));

  const TypeIcon = isRoute ? Route : isAccommodation ? Building2 : UtensilsCrossed;

  return (
    <div>
      <PageHeader
        title={entry.name}
        description={`Content entry · ${entry.type}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 border border-grey-300 text-sm font-medium px-3 py-2 rounded-lg hover:bg-grey-100 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => handleVerify(!entry.verified)}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition",
                entry.verified
                  ? "bg-danger/10 text-danger hover:bg-danger/20"
                  : "bg-green/10 text-green hover:bg-green/20"
              )}
            >
              {entry.verified
                ? <><XCircle size={14} /> Unverify</>
                : <><CheckCircle2 size={14} /> Verify</>}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition disabled:opacity-50"
            >
              <Save size={14} /> {saving ? "Saving…" : saved ? "Saved!" : "Save"}
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="p-2 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-5">

        {/* ── Main column ── */}
        <div className="col-span-2 space-y-4">

          {/* Editable details */}
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TypeIcon size={15} className="text-teal-dark" />
              <h2 className="font-display font-semibold text-dark text-sm">Details</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Region</label>
                <input
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Country</label>
                <input
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Holiday Focus</label>
              <input
                value={activityType}
                onChange={e => setActivityType(e.target.value)}
                placeholder="e.g. beach holiday, city break"
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10 resize-none"
              />
            </div>
          </div>

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} className="text-warning" />
                <h2 className="font-display font-semibold text-dark text-sm">Highlights</h2>
              </div>
              <ul className="space-y-1.5">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-grey-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    {typeof h === "string" ? h : renderValue(h)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Type-specific metadata */}
          {(isRoute || isAccommodation || isRestaurant) && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-3">
                {isRoute ? "Route details" : isAccommodation ? "Accommodation details" : "Restaurant details"}
              </h2>
              <div>
                {isRoute && (
                  <>
                    <MetaRow label="Distance"       value={data.distanceKm     != null ? `${renderValue(data.distanceKm)} km` : null} />
                    <MetaRow label="Elevation gain" value={data.elevationGainM != null ? `${renderValue(data.elevationGainM)} m` : null} />
                    <MetaRow label="Difficulty"     value={data.difficulty} />
                    <MetaRow label="Surface type"   value={data.surfaceType} />
                    <MetaRow label="Best season"    value={data.bestSeason} />
                  </>
                )}
                {isAccommodation && (
                  <>
                    <MetaRow label="Type"        value={data.accommodationType} />
                    <MetaRow label="Price range" value={data.priceRange} />
                  </>
                )}
                {isRestaurant && (
                  <>
                    <MetaRow label="Cuisine"     value={data.cuisineType} />
                    <MetaRow label="Price range" value={data.priceRange} />
                    <MetaRow label="Must try"    value={data.mustTry} />
                  </>
                )}
                {/* Extra unknown metadata keys */}
                {extraMeta.map(([k, v]) => (
                  <MetaRow key={k} label={k} value={v} />
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-3">
                Sources <span className="text-grey-400 font-normal">({sources.length})</span>
              </h2>
              <div className="space-y-3">
                {sources.map((source, i) => {
                  // Guard: if source is not an object (e.g. a plain string URL from legacy data),
                  // wrap it so SourceCard always receives a proper Source object.
                  const normalized: Source =
                    typeof source === "string"
                      ? { url: source }
                      : (source as Source);
                  return <SourceCard key={i} source={normalized} index={i} />;
                })}
              </div>
            </div>
          )}

          {/* Scout reasoning */}
          {scoutReason && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-2">Scout reasoning</h2>
              <p className="text-xs text-grey-600 leading-relaxed italic">"{scoutReason}"</p>
            </div>
          )}

          {/* Raw data dump */}
          {entry.data && (
            <details className="bg-white border border-grey-300 rounded-xl overflow-hidden">
              <summary className="px-5 py-4 text-sm font-semibold text-grey-700 cursor-pointer select-none hover:bg-slate-50 transition-colors">
                Raw agent data
              </summary>
              <pre className="text-xs bg-grey-50 p-4 overflow-auto max-h-64 text-grey-700 font-mono border-t border-grey-200">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Status</h2>
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-700">Verified</span>
              {entry.verified
                ? <StatusBadge value="verified" />
                : <StatusBadge value="false" label="Unverified" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-700">Type</span>
              <StatusBadge value={entry.type} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-700">Source</span>
              {entry.source_type
                ? <StatusBadge value={entry.source_type} />
                : <span className="text-grey-400 text-xs">—</span>}
            </div>
          </div>

          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Trust score</h2>
            {entry.trust_score != null
              ? <TrustScoreBadge score={entry.trust_score} />
              : <span className="text-grey-400 text-xs">Not calculated</span>}
            {scoutScore != null && (
              <div className="text-xs text-grey-700">
                Scout score:{" "}
                <span className={cn(
                  "font-bold",
                  scoutScore >= 0.8 ? "text-green-dark" :
                  scoutScore >= 0.5 ? "text-warning"    : "text-danger"
                )}>
                  {Math.round(scoutScore * 100)}%
                </span>
              </div>
            )}
          </div>

          {coordinates && (
            <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-teal-dark" />
                <h2 className="font-display font-semibold text-dark text-sm">Location</h2>
              </div>
              <p className="text-xs text-grey-700 font-mono">
                {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
              </p>
              <a
                href={`https://maps.google.com/?q=${coordinates.lat},${coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue hover:underline"
              >
                <ExternalLink size={11} /> Open in Maps
              </a>
            </div>
          )}

          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-2">
            <h2 className="font-display font-semibold text-dark text-sm">Timestamps</h2>
            <div className="text-xs text-grey-700 space-y-1">
              <div>Created: <span className="text-dark">{formatDateTime(entry.created_at)}</span></div>
              {entry.updated_at && (
                <div>Updated: <span className="text-dark">{formatDateTime(entry.updated_at)}</span></div>
              )}
            </div>
          </div>

          {data.agentRunId && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-2">Scout run</h2>
              <p className="text-[11px] text-grey-500 font-mono break-all">{String(data.agentRunId)}</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete content entry?"
        description={`"${entry.name}" will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
