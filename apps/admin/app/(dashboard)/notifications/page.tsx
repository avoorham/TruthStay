"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ToggleLeft, ToggleRight, Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: string | null;
  is_active: boolean;
  ends_at: string | null;
  created_at: string;
};

type Template = {
  id: string;
  name: string;
  title: string;
  body: string;
  channel: string;
  created_at: string;
};

type HistoryEntry = {
  id: string;
  channel: string;
  status: string;
  recipient_count: number | null;
  created_at: string;
  notification_templates?: { name: string } | null;
};

type Tab = "announcements" | "templates" | "history";

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", priority: "normal", ends_at: "" });

  async function load() {
    setLoading(true);
    const [a, t, h] = await Promise.all([
      fetch("/api/admin/notifications/announcements").then((r) => r.json()),
      fetch("/api/admin/notifications/templates").then((r) => r.json()),
      fetch("/api/admin/notifications/history").then((r) => r.json()),
    ]);
    setAnnouncements(a);
    setTemplates(t);
    setHistory(h);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleAnnouncement(id: string, is_active: boolean) {
    await fetch(`/api/admin/notifications/announcements/${id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !is_active }),
    });
    setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !is_active } : a));
  }

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/notifications/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", body: "", priority: "normal", ends_at: "" });
    setShowForm(false);
    load();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "announcements", label: "Announcements" },
    { key: "templates", label: "Templates" },
    { key: "history", label: "Send History" },
  ];

  const announcementColumns: ColumnDef<Announcement, any>[] = [
    { accessorKey: "title", header: "Title", cell: ({ getValue }) => <span className="text-sm font-medium">{getValue<string>()}</span> },
    { accessorKey: "priority", header: "Priority", cell: ({ getValue }) => <StatusBadge value={getValue<string | null>() || "normal"} /> },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <button onClick={() => toggleAnnouncement(row.original.id, row.original.is_active)} className="text-grey-700 hover:text-blue transition">
          {row.original.is_active ? <ToggleRight size={20} className="text-green" /> : <ToggleLeft size={20} />}
        </button>
      ),
    },
    { accessorKey: "ends_at", header: "Expires", cell: ({ getValue }) => <span className="text-xs text-grey-700">{getValue<string | null>() ? formatDate(getValue<string>()) : "Never"}</span> },
    { accessorKey: "created_at", header: "Created", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span> },
  ];

  const templateColumns: ColumnDef<Template, any>[] = [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="text-sm font-medium">{getValue<string>()}</span> },
    { accessorKey: "title", header: "Title", cell: ({ getValue }) => <span className="text-xs text-grey-700 max-w-[200px] truncate block">{getValue<string>()}</span> },
    { accessorKey: "channel", header: "Channel", cell: ({ getValue }) => <StatusBadge value={getValue<string>()} /> },
    { accessorKey: "created_at", header: "Created", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span> },
  ];

  const historyColumns: ColumnDef<HistoryEntry, any>[] = [
    { id: "template", header: "Template", accessorFn: (r) => r.notification_templates?.name ?? "", cell: ({ row }) => <span className="text-sm font-medium">{row.original.notification_templates?.name ?? "—"}</span> },
    { accessorKey: "channel", header: "Channel", cell: ({ getValue }) => <StatusBadge value={getValue<string>()} /> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge value={getValue<string>()} /> },
    { accessorKey: "recipient_count", header: "Recipients", cell: ({ getValue }) => <span className="text-sm">{getValue<number | null>()?.toLocaleString() ?? "—"}</span> },
    { accessorKey: "created_at", header: "Sent", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDateTime(getValue<string>())}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="In-app announcements, push templates, and send history."
        actions={
          tab === "announcements" && (
            <button onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">
              <Plus size={14} /> New announcement
            </button>
          )
        }
      />

      {showForm && (
        <form onSubmit={createAnnouncement} className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-dark text-sm flex items-center gap-2"><Bell size={14} /> Create announcement</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-grey-700 mb-1">Title *</label>
              <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-grey-700 mb-1">Body *</label>
              <textarea required rows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Expires at</label>
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">Publish</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-grey-700 px-4 py-2 hover:text-dark">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-1 border-b border-grey-300">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${tab === key ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div> : (
        <>
          {tab === "announcements" && <DataTable data={announcements} columns={announcementColumns} searchKey="title" searchPlaceholder="Search announcements…" />}
          {tab === "templates" && <DataTable data={templates} columns={templateColumns} searchKey="name" searchPlaceholder="Search templates…" />}
          {tab === "history" && <DataTable data={history} columns={historyColumns} />}
        </>
      )}
    </div>
  );
}
