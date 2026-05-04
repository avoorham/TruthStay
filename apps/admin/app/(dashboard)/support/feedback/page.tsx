"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";

type Feedback = {
  id: string;
  adventure_id: string;
  rating: number | null;
  comment: string | null;
  admin_status: string | null;
  admin_notes: string | null;
  created_at: string;
  adventures?: { title: string; region: string | null } | null;
};

const FEEDBACK_STATUSES = ["", "acknowledged", "resolved", "flagged"];
const RATING_OPTIONS = [0, 1, 2, 3, 4, 5];

function StarRating({ value }: { value: number | null }) {
  if (value == null) return <span className="text-grey-400 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} className={i <= value ? "text-warning fill-warning" : "text-grey-200"} />
      ))}
      <span className="ml-1 text-xs text-grey-700">{value}/5</span>
    </div>
  );
}

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading]   = useState(true);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/support/feedback")
      .then(r => r.json())
      .then(d => { setFeedback(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  async function updateStatus(id: string, admin_status: string) {
    await fetch(`/api/admin/support/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_status }),
    }).catch(() => {});
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, admin_status } : f));
  }

  const filtered = ratingFilter != null
    ? feedback.filter(f => f.rating === ratingFilter)
    : feedback;

  const avgRating = (() => {
    const rated = feedback.filter(f => f.rating != null);
    if (!rated.length) return "—";
    return (rated.reduce((a, f) => a + (f.rating ?? 0), 0) / rated.length).toFixed(1);
  })();

  const lowRating = feedback.filter(f => f.rating != null && f.rating <= 2).length;
  const unresolved = feedback.filter(f => !f.admin_status || f.admin_status === "new").length;

  const columns: ColumnDef<Feedback, any>[] = [
    {
      id: "adventure",
      header: "Adventure",
      accessorFn: r => r.adventures?.title ?? "",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-dark">{row.original.adventures?.title ?? "—"}</p>
          {row.original.adventures?.region && (
            <p className="text-xs text-grey-400">{row.original.adventures.region}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ getValue }) => <StarRating value={getValue<number | null>()} />,
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ getValue }) => (
        <span className="text-xs text-grey-700 max-w-[260px] line-clamp-2 block">
          {getValue<string | null>() || <span className="text-grey-400 italic">No comment</span>}
        </span>
      ),
    },
    {
      accessorKey: "admin_status",
      header: "Status",
      cell: ({ row }) => (
        <select
          value={row.original.admin_status ?? ""}
          onChange={e => updateStatus(row.original.id, e.target.value)}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
        >
          {FEEDBACK_STATUSES.map(s => (
            <option key={s} value={s}>{s || "pending"}</option>
          ))}
        </select>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDateTime(getValue<string>())}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Feedback" description="User ratings and comments on adventures." />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: "Avg rating",   value: avgRating,             sub: `${feedback.length} reviews` },
          { label: "Low ratings",  value: String(lowRating),     sub: "1–2 stars" },
          { label: "Needs review", value: String(unresolved),    sub: "unacknowledged" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="border border-slate-200 rounded-lg p-5">
            <p className="text-xs text-grey-500 mb-1">{label}</p>
            <p className="text-3xl font-bold text-dark tracking-tight">{value}</p>
            <p className="text-xs text-grey-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Rating filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-grey-500 font-medium">Filter by rating:</span>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setRatingFilter(null)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${ratingFilter == null ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"}`}>
            All
          </button>
          {[1, 2, 3, 4, 5].map(r => (
            <button key={r} onClick={() => setRatingFilter(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-0.5 transition ${ratingFilter === r ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"}`}>
              {r}<Star size={10} className="fill-current" />
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
        : <DataTable data={filtered} columns={columns} searchKey="adventure" searchPlaceholder="Search feedback…" />}
    </div>
  );
}
