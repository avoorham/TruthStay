"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, MapPin } from "lucide-react";
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
  data: Record<string, unknown> | null;
  created_at: string;
};

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

  const unverifiedCount = entries.length;

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description={`${unverifiedCount} unverified entr${unverifiedCount !== 1 ? "ies" : "y"} awaiting review — sorted by scout confidence.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg border border-grey-300 hover:bg-grey-100 transition text-grey-700"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <a
              href="/content"
              className="inline-flex items-center gap-1.5 border border-grey-300 text-sm font-medium px-3 py-2 rounded-lg hover:bg-grey-100 transition"
            >
              All Content
            </a>
          </div>
        }
      />

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 size={40} className="text-green mx-auto mb-3" />
          <p className="text-grey-700 font-medium">Queue is empty — all entries reviewed!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entries.map((entry) => {
            const scoutScore = (entry.data as any)?.scoutScore as number | undefined;
            const sources = (entry.data as any)?.sources as string[] | undefined;
            const isActioning = actioning === entry.id;

            return (
              <div
                key={entry.id}
                className="bg-white border border-grey-300 rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-dark text-sm leading-snug line-clamp-2">
                      {entry.name}
                    </h3>
                    {(entry.region || entry.country) && (
                      <p className="flex items-center gap-1 text-xs text-grey-700 mt-0.5">
                        <MapPin size={10} />
                        {[entry.region, entry.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/content/${entry.id}`)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-grey-100 text-grey-700 transition"
                    title="View detail"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge value={entry.type} />
                  {entry.source_type && <StatusBadge value={entry.source_type} />}
                  {entry.activity_type && (
                    <span className="text-xs text-grey-700 bg-grey-100 rounded-md px-2 py-0.5 capitalize">
                      {entry.activity_type}
                    </span>
                  )}
                </div>

                {/* Description */}
                {entry.description && (
                  <p className="text-xs text-grey-700 line-clamp-3 leading-relaxed">{entry.description}</p>
                )}

                {/* Trust + scout score */}
                <div className="space-y-1.5">
                  {entry.trust_score != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-grey-700">Trust score</span>
                      <TrustScoreBadge score={entry.trust_score} />
                    </div>
                  )}
                  {scoutScore != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-grey-700">Scout confidence</span>
                      <span className="text-xs font-semibold text-dark">{Math.round(scoutScore * 100)}%</span>
                    </div>
                  )}
                  {sources && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-grey-700">Sources</span>
                      <span className="text-xs font-semibold text-dark">{sources.length}</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-grey-500 mt-auto">Added {formatDate(entry.created_at)}</div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-grey-100">
                  <button
                    onClick={() => handleAction(entry.id, true)}
                    disabled={isActioning}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green/10 text-green text-sm font-semibold px-3 py-2 rounded-lg hover:bg-green/20 transition disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(entry.id, false)}
                    disabled={isActioning}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-danger/10 text-danger text-sm font-semibold px-3 py-2 rounded-lg hover:bg-danger/20 transition disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
