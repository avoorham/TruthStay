"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";

type HistoryEntry = {
  id: string;
  channel: string;
  status: string;
  recipient_count: number | null;
  open_count: number | null;
  click_count: number | null;
  created_at: string;
  notification_templates?: { name: string } | null;
};

type ChannelFilter = "all" | "email" | "push" | "sms" | "in_app";
type StatusFilter  = "all" | "sent" | "scheduled" | "failed" | "cancelled";

export default function NotificationHistoryPage() {
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/admin/notifications/history")
      .then(r => r.json())
      .then(d => { setHistory(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const filtered = history.filter(h => {
    const channelOk = channelFilter === "all" || h.channel === channelFilter;
    const statusOk  = statusFilter  === "all" || h.status  === statusFilter;
    return channelOk && statusOk;
  });

  const totalSent   = history.filter(h => h.status === "sent").length;
  const totalRecip  = history.reduce((a, h) => a + (h.recipient_count ?? 0), 0);
  const avgOpenRate = (() => {
    const withOpen = history.filter(h => h.recipient_count && h.open_count != null);
    if (!withOpen.length) return "—";
    const rate = withOpen.reduce((a, h) => a + ((h.open_count ?? 0) / (h.recipient_count ?? 1)), 0) / withOpen.length;
    return `${(rate * 100).toFixed(1)}%`;
  })();

  const columns: ColumnDef<HistoryEntry, any>[] = [
    {
      id: "template",
      header: "Template",
      accessorFn: r => r.notification_templates?.name ?? "",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-dark">
          {row.original.notification_templates?.name ?? "Custom"}
        </span>
      ),
    },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      accessorKey: "recipient_count",
      header: "Recipients",
      cell: ({ getValue }) => <span className="text-sm font-mono">{getValue<number | null>()?.toLocaleString() ?? "—"}</span>,
    },
    {
      id: "open_rate",
      header: "Open rate",
      accessorFn: r => r.recipient_count && r.open_count != null ? r.open_count / r.recipient_count : null,
      cell: ({ row }) => {
        const rc = row.original.recipient_count;
        const oc = row.original.open_count;
        if (!rc || oc == null) return <span className="text-grey-400 text-xs">—</span>;
        return <span className="text-sm">{((oc / rc) * 100).toFixed(1)}%</span>;
      },
    },
    {
      id: "click_rate",
      header: "Click rate",
      accessorFn: r => r.recipient_count && r.click_count != null ? r.click_count / r.recipient_count : null,
      cell: ({ row }) => {
        const rc = row.original.recipient_count;
        const cc = row.original.click_count;
        if (!rc || cc == null) return <span className="text-grey-400 text-xs">—</span>;
        return <span className="text-sm">{((cc / rc) * 100).toFixed(1)}%</span>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Sent / Scheduled",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDateTime(getValue<string>())}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Send History" description="Full log of all notifications sent or scheduled." />

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: "Sends recorded",  value: String(totalSent) },
          { label: "Total recipients",value: totalRecip.toLocaleString() },
          { label: "Avg open rate",   value: avgOpenRate },
        ].map(({ label, value }) => (
          <div key={label} className="border border-slate-200 rounded-lg p-5">
            <p className="text-xs text-grey-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-dark tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "email", "push", "sms", "in_app"] as ChannelFilter[]).map(c => (
            <button key={c} onClick={() => setChannelFilter(c)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition ${
                channelFilter === c ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
              }`}>
              {c.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "sent", "scheduled", "failed"] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition ${
                statusFilter === s ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
        : <DataTable data={filtered} columns={columns} />}
    </div>
  );
}
