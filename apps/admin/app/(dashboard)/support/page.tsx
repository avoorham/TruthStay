"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MessageSquare, Flag, Mail, Star } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string | null;
  report_type: string;
  reason: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
};

type SupportContact = {
  id: string;
  name: string | null;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
};

type Feedback = {
  id: string;
  adventure_id: string;
  rating: number | null;
  comment: string | null;
  admin_status: string | null;
  created_at: string;
  adventures?: { title: string; region: string | null } | null;
};

type Tab = "reports" | "contacts" | "feedback";

const REPORT_STATUSES = ["new", "acknowledged", "investigating", "resolved", "dismissed"];
const CONTACT_STATUSES = ["new", "in_progress", "waiting_on_user", "resolved", "closed"];

export default function SupportPage() {
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [r, c, f] = await Promise.all([
      fetch("/api/admin/support/reports").then((x) => x.json()),
      fetch("/api/admin/support/contacts").then((x) => x.json()),
      fetch("/api/admin/support/feedback").then((x) => x.json()),
    ]);
    setReports(r);
    setContacts(c);
    setFeedback(f);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateReportStatus(id: string, status: string) {
    await fetch(`/api/admin/support/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  async function updateContactStatus(id: string, status: string) {
    await fetch(`/api/admin/support/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "reports", label: "Reports", icon: <Flag size={13} />, count: reports.filter((r) => r.status === "new").length },
    { key: "contacts", label: "Contacts", icon: <Mail size={13} />, count: contacts.filter((c) => c.status === "new").length },
    { key: "feedback", label: "Feedback", icon: <Star size={13} /> },
  ];

  const reportColumns: ColumnDef<Report, any>[] = [
    { accessorKey: "report_type", header: "Type", cell: ({ getValue }) => <span className="text-sm capitalize">{getValue<string>().replace(/_/g, " ")}</span> },
    { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="text-xs text-grey-700 max-w-[200px] truncate block">{getValue<string>()}</span> },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={(e) => updateReportStatus(row.original.id, e.target.value)}
          className="text-xs border border-grey-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue/60"
        >
          {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      ),
    },
    { accessorKey: "created_at", header: "Reported", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDateTime(getValue<string>())}</span> },
  ];

  const contactColumns: ColumnDef<SupportContact, any>[] = [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="text-sm font-medium">{getValue<string | null>() || "—"}</span> },
    { accessorKey: "email", header: "Email", cell: ({ getValue }) => <span className="text-xs text-grey-700">{getValue<string>()}</span> },
    { accessorKey: "subject", header: "Subject", cell: ({ getValue }) => <span className="text-xs text-grey-700 max-w-[180px] truncate block">{getValue<string | null>() || "—"}</span> },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={(e) => updateContactStatus(row.original.id, e.target.value)}
          className="text-xs border border-grey-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue/60"
        >
          {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      ),
    },
    { accessorKey: "created_at", header: "Received", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDateTime(getValue<string>())}</span> },
  ];

  const feedbackColumns: ColumnDef<Feedback, any>[] = [
    { id: "adventure", header: "Adventure", accessorFn: (r) => r.adventures?.title ?? "", cell: ({ row }) => <span className="text-sm font-medium">{row.original.adventures?.title ?? "—"}</span> },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ getValue }) => {
        const r = getValue<number | null>();
        return r != null ? <span className="flex items-center gap-1 text-sm"><Star size={12} className="text-warning" />{r}/5</span> : <span className="text-grey-400">—</span>;
      },
    },
    { accessorKey: "comment", header: "Comment", cell: ({ getValue }) => <span className="text-xs text-grey-700 max-w-[240px] truncate block">{getValue<string | null>() || "—"}</span> },
    { accessorKey: "admin_status", header: "Admin status", cell: ({ getValue }) => getValue<string | null>() ? <StatusBadge value={getValue<string>()} /> : <span className="text-grey-400 text-xs">—</span> },
    { accessorKey: "created_at", header: "Date", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDateTime(getValue<string>())}</span> },
  ];

  const newReports = reports.filter((r) => r.status === "new").length;
  const newContacts = contacts.filter((c) => c.status === "new").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Support"
        description={`${newReports + newContacts} items need attention.`}
      />

      <div className="flex gap-1 border-b border-grey-300">
        {TABS.map(({ key, label, icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${tab === key ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"}`}>
            {icon}{label}
            {count != null && count > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-danger text-white text-[10px] font-bold">{count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div> : (
        <>
          {tab === "reports" && <DataTable data={reports} columns={reportColumns} searchKey="reason" searchPlaceholder="Search reports…" />}
          {tab === "contacts" && <DataTable data={contacts} columns={contactColumns} searchKey="email" searchPlaceholder="Search contacts…" />}
          {tab === "feedback" && <DataTable data={feedback} columns={feedbackColumns} searchKey="adventure" searchPlaceholder="Search feedback…" />}
        </>
      )}
    </div>
  );
}
