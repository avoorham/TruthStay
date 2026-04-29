"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Bell, ToggleLeft, ToggleRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: string | null;
  target_segment: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const SEGMENTS = ["all", "active_7d", "inactive_21d", "no_trip", "subscribers", "trial"];

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", body: "", priority: "normal",
    target_segment: "all", starts_at: "", ends_at: "",
  });

  async function load() {
    setLoading(true);
    const data = await fetch("/api/admin/notifications/announcements").then(r => r.json());
    setAnnouncements(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(id: string, is_active: boolean) {
    await fetch(`/api/admin/notifications/announcements/${id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !is_active }),
    });
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !is_active } : a));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/notifications/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", body: "", priority: "normal", target_segment: "all", starts_at: "", ends_at: "" });
    setShowForm(false);
    load();
  }

  const columns: ColumnDef<Announcement, any>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-dark">{row.original.title}</p>
          <p className="text-xs text-grey-500 max-w-[220px] truncate mt-0.5">{row.original.body}</p>
        </div>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ getValue }) => <StatusBadge value={getValue<string | null>() || "normal"} />,
    },
    {
      accessorKey: "target_segment",
      header: "Audience",
      cell: ({ getValue }) => <span className="text-xs text-grey-700 capitalize">{(getValue<string | null>() || "all").replace("_", " ")}</span>,
    },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <button onClick={() => toggleActive(row.original.id, row.original.is_active)}>
          {row.original.is_active
            ? <ToggleRight size={22} className="text-green" />
            : <ToggleLeft size={22} className="text-grey-300" />}
        </button>
      ),
    },
    {
      accessorKey: "starts_at",
      header: "Starts",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{getValue<string | null>() ? formatDate(getValue<string>()) : "Immediately"}</span>,
    },
    {
      accessorKey: "ends_at",
      header: "Expires",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{getValue<string | null>() ? formatDate(getValue<string>()) : "Never"}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDate(getValue<string>())}</span>,
    },
  ];

  const active   = announcements.filter(a => a.is_active).length;
  const expiring = announcements.filter(a => {
    if (!a.ends_at) return false;
    const diff = new Date(a.ends_at).getTime() - Date.now();
    return diff > 0 && diff < 86400000 * 3;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="In-app banners and notifications broadcast to user segments."
        actions={
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">
            <Plus size={14} /> New announcement
          </button>
        }
      />

      {/* Summary chips */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-dark" />
          <span className="text-sm font-semibold text-dark">{active}</span>
          <span className="text-xs text-grey-500">active</span>
        </div>
        {expiring > 0 && (
          <div className="flex items-center gap-2 bg-white border border-warning/30 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-sm font-semibold text-dark">{expiring}</span>
            <span className="text-xs text-grey-500">expiring soon</span>
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-dark text-sm flex items-center gap-2">
            <Bell size={14} /> Create announcement
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-grey-700 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-grey-700 mb-1">Body *</label>
              <textarea required rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                {["low", "normal", "high", "urgent"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Target segment</label>
              <select value={form.target_segment} onChange={e => setForm(f => ({ ...f, target_segment: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                {SEGMENTS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Starts at</label>
              <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Expires at</label>
              <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">Publish</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-grey-700 px-4 py-2 hover:text-dark">Cancel</button>
          </div>
        </form>
      )}

      {loading
        ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
        : <DataTable data={announcements} columns={columns} searchKey="title" searchPlaceholder="Search announcements…" />}
    </div>
  );
}
