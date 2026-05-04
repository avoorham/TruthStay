"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, ExternalLink, RefreshCw,
  MapPin, Link2, Utensils, Bed, Route, Tag,
} from "lucide-react";
import Image from "next/image";
import { PageHeader } from "@/components/shared/PageHeader";
import { TrustScoreBadge } from "@/components/shared/TrustScoreBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

type Entry = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  country: string | null;
  trust_score: number | null;
  source_type: string | null;
  activity_type: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPhotoUrl(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const d = data as any;
  if (Array.isArray(d.photos) && d.photos.length > 0 && typeof d.photos[0] === "string") return d.photos[0];
  if (typeof d.photo_url === "string") return d.photo_url;
  if (typeof d.imageUrl === "string") return d.imageUrl;
  if (typeof d.image === "string") return d.image;
  if (typeof d.thumbnail === "string") return d.thumbnail;
  return null;
}

function getExternalUrl(data: Record<string, unknown> | null, type: string): string | null {
  if (!data) return null;
  const d = data as any;
  if (typeof d.bookingUrl === "string") return d.bookingUrl;
  if (typeof d.komootUrl === "string") return d.komootUrl;
  if (typeof d.url === "string") return d.url;
  if (typeof d.website === "string") return d.website;
  return null;
}

const TYPE_GRADIENT: Record<string, string> = {
  restaurant:     "from-amber-400 to-orange-500",
  accommodation:  "from-blue-400 to-indigo-500",
  route:          "from-emerald-400 to-teal-500",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  restaurant:    <Utensils size={32} className="text-white/80" />,
  accommodation: <Bed      size={32} className="text-white/80" />,
  route:         <Route    size={32} className="text-white/80" />,
};

// ── Card ──────────────────────────────────────────────────────────────────────

function ReviewCard({
  entry,
  actioning,
  onApprove,
  onReject,
  onDetail,
}: {
  entry: Entry;
  actioning: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDetail: () => void;
}) {
  const d         = entry.data as any;
  const sources   = Array.isArray(d?.sources) ? (d.sources as any[]).filter(s => typeof s === "string") as string[] : [];
  const scoutScore = typeof d?.scoutScore === "number" ? d.scoutScore as number : null;
  const photoUrl  = getPhotoUrl(entry.data);
  const externalUrl = getExternalUrl(entry.data, entry.type);
  const gradient  = TYPE_GRADIENT[entry.type] ?? "from-grey-400 to-grey-600";
  const typeIcon  = TYPE_ICON[entry.type];
  const mapsUrl   = entry.lat != null && entry.lng != null
    ? `https://maps.google.com/?q=${entry.lat},${entry.lng}`
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">

      {/* ── Hero image / gradient ── */}
      <div className="relative h-44 shrink-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={entry.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            {typeIcon}
          </div>
        )}

        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className="text-xs font-semibold text-white bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 capitalize">
            {entry.type}
          </span>
        </div>

        {/* External link (top-right) */}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition"
            title="View on source"
          >
            <ExternalLink size={13} />
          </a>
        )}

        {/* Name + location over image bottom */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display font-bold text-white text-sm leading-snug line-clamp-2 drop-shadow-sm">
            {entry.name}
          </h3>
          {(entry.region || entry.country) && (
            <p className="flex items-center gap-1 text-white/80 text-xs mt-0.5">
              <MapPin size={10} />
              {[entry.region, entry.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col gap-3 p-4 flex-1">

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.source_type && <StatusBadge value={entry.source_type} />}
          {entry.activity_type && (
            <span className="text-xs text-grey-700 bg-grey-100 rounded-full px-2 py-0.5 capitalize">
              {entry.activity_type}
            </span>
          )}
        </div>

        {/* Description */}
        {entry.description && (
          <p className="text-xs text-grey-700 line-clamp-3 leading-relaxed">{entry.description}</p>
        )}

        {/* Scores */}
        <div className="space-y-1.5">
          {entry.trust_score != null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-500">Trust score</span>
              <TrustScoreBadge score={entry.trust_score} />
            </div>
          )}
          {scoutScore != null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-500">Scout confidence</span>
              <span className={`text-xs font-semibold ${scoutScore >= 0.7 ? "text-green" : scoutScore >= 0.5 ? "text-amber-600" : "text-danger"}`}>
                {Math.round(scoutScore * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-grey-500 uppercase tracking-wide">
              Sources ({sources.length})
            </p>
            <ul className="space-y-1">
              {sources.slice(0, 3).map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue hover:underline break-all line-clamp-1"
                  >
                    <Link2 size={10} className="shrink-0" />
                    {url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </li>
              ))}
              {sources.length > 3 && (
                <p className="text-xs text-grey-500">+{sources.length - 3} more</p>
              )}
            </ul>
          </div>
        )}

        {/* Footer: date + maps link */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-grey-400">Added {formatDate(entry.created_at)}</span>
          <div className="flex items-center gap-2">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-grey-700 hover:text-blue transition"
                title="Open in Google Maps"
              >
                <MapPin size={11} /> Maps
              </a>
            )}
            <button
              onClick={onDetail}
              className="inline-flex items-center gap-1 text-xs text-grey-700 hover:text-blue transition"
              title="View full detail"
            >
              <ExternalLink size={11} /> Detail
            </button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 border-t border-grey-100 pt-3">
          <button
            onClick={onApprove}
            disabled={actioning}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-50 text-green-700 text-sm font-medium px-3 py-2 rounded-md hover:bg-green-100 transition disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> Approve
          </button>
          <button
            onClick={onReject}
            disabled={actioning}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-50 text-red-600 text-sm font-medium px-3 py-2 rounded-md hover:bg-red-100 transition disabled:opacity-50"
          >
            <XCircle size={14} /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/content/review-queue");
    const data = await res.json();
    setEntries(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAction(id: string, verified: boolean) {
    setActioning(id);
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified }),
    });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setActioning(null);
  }

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description={`${entries.length} unverified entr${entries.length !== 1 ? "ies" : "y"} awaiting review — sorted by scout confidence.`}
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
          <p className="text-sm text-slate-500">All entries have been reviewed — great work!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {entries.map((entry) => (
            <ReviewCard
              key={entry.id}
              entry={entry}
              actioning={actioning === entry.id}
              onApprove={() => handleAction(entry.id, true)}
              onReject={() => handleAction(entry.id, false)}
              onDetail={() => router.push(`/content/${entry.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
