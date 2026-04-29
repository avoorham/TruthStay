"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, CheckCircle2, XCircle, RefreshCw, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrustScoreBadge } from "@/components/shared/TrustScoreBadge";
import { formatDate } from "@/lib/utils";

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
  created_at: string;
};

const TYPES = ["", "route", "accommodation", "restaurant", "poi"];
const SOURCE_TYPES = ["", "agent", "user", "admin"];

export default function ContentPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (sourceFilter) params.set("source_type", sourceFilter);
    if (verifiedFilter !== "") params.set("verified", verifiedFilter);
    const res = await fetch(`/api/admin/content?${params}`);
    const data = await res.json();
    setEntries(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [typeFilter, sourceFilter, verifiedFilter]);

  async function toggleVerify(id: string, current: boolean) {
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !current }),
    });
    startTransition(() => load());
  }

  const columns: ColumnDef<Entry, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/content/${row.original.id}`)}
          className="text-teal font-medium hover:underline text-left max-w-[220px] truncate block"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      accessorKey: "activity_type",
      header: "Focus",
      cell: ({ getValue }) => {
        const v = getValue<string | null>();
        return v ? <span className="text-xs text-grey-700 capitalize">{v}</span> : <span className="text-grey-400">—</span>;
      },
    },
    {
      accessorKey: "region",
      header: "Region",
      cell: ({ row }) => (
        <span className="text-xs text-grey-700">
          {[row.original.region, row.original.country].filter(Boolean).join(", ") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "source_type",
      header: "Source",
      cell: ({ getValue }) => {
        const v = getValue<string | null>();
        return v ? <StatusBadge value={v} /> : <span className="text-grey-400">—</span>;
      },
    },
    {
      accessorKey: "trust_score",
      header: "Trust",
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v != null ? <TrustScoreBadge score={v} /> : <span className="text-grey-400">—</span>;
      },
    },
    {
      accessorKey: "verified",
      header: "Verified",
      cell: ({ row }) => (
        <button
          onClick={() => toggleVerify(row.original.id, row.original.verified)}
          className="flex items-center gap-1 text-xs font-medium transition hover:opacity-70"
        >
          {row.original.verified ? (
            <><CheckCircle2 size={15} className="text-green" /><span className="text-green">Yes</span></>
          ) : (
            <><XCircle size={15} className="text-danger" /><span className="text-danger">No</span></>
          )}
        </button>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Added",
      cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/content/${row.original.id}`)}
          className="p-1.5 rounded-lg hover:bg-grey-100 text-grey-700 transition"
          title="View detail"
        >
          <ExternalLink size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Content Entries"
        description="All locations, routes, and places sourced by the scout agent or community."
        actions={
          <a
            href="/content/review-queue"
            className="inline-flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-teal-dark transition"
          >
            Review Queue
          </a>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal/60 focus:ring-1 focus:ring-teal/20"
        >
          {TYPES.map((t) => <option key={t} value={t}>{t ? t.charAt(0).toUpperCase() + t.slice(1) : "All types"}</option>)}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal/60 focus:ring-1 focus:ring-teal/20"
        >
          {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "All sources"}</option>)}
        </select>

        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal/60 focus:ring-1 focus:ring-teal/20"
        >
          <option value="">All verified states</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>

        <button onClick={load} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-grey-700">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-bg flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-teal" />
          </div>
          <h3 className="text-lg font-semibold text-dark mb-2">No content entries</h3>
          <p className="text-sm text-grey-500 max-w-sm mb-6">
            No entries match the selected filters. Try adjusting the filters or run the scout agent to generate content.
          </p>
          <a
            href="/content/review-queue"
            className="bg-teal text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-teal-dark transition"
          >
            Review Queue
          </a>
        </div>
      ) : (
        <DataTable data={entries} columns={columns} searchKey="name" searchPlaceholder="Search by name…" />
      )}
    </div>
  );
}
