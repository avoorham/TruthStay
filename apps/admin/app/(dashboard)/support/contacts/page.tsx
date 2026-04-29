"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";

type SupportContact = {
  id: string;
  name: string | null;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
};

const STATUSES   = ["new", "in_progress", "waiting_on_user", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState("new");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/support/contacts")
      .then(r => r.json())
      .then(d => { setContacts(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  async function updateContact(id: string, updates: Partial<Pick<SupportContact, "status" | "priority" | "assigned_to">>) {
    await fetch(`/api/admin/support/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(() => {});
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  const filtered = statusFilter === "all" ? contacts : contacts.filter(c => c.status === statusFilter);

  const newCount      = contacts.filter(c => c.status === "new").length;
  const openCount     = contacts.filter(c => c.status === "in_progress").length;
  const resolvedCount = contacts.filter(c => c.status === "resolved" || c.status === "closed").length;

  const columns: ColumnDef<SupportContact, any>[] = [
    {
      id: "contact",
      header: "Contact",
      accessorFn: r => r.email,
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-dark">{row.original.name || "—"}</p>
          <p className="text-xs text-grey-500">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <button
          onClick={() => setExpanded(expanded === row.original.id ? null : row.original.id)}
          className="text-xs text-grey-700 max-w-[200px] truncate block text-left hover:text-dark"
        >
          {row.original.subject || "—"}
        </button>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <select
          value={row.original.priority ?? "normal"}
          onChange={e => updateContact(row.original.id, { priority: e.target.value })}
          className="text-xs border border-grey-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue/60"
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={e => updateContact(row.original.id, { status: e.target.value })}
          className="text-xs border border-grey-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue/60"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      ),
    },
    {
      accessorKey: "assigned_to",
      header: "Assigned to",
      cell: ({ row }) => (
        <input
          type="text"
          defaultValue={row.original.assigned_to ?? ""}
          placeholder="—"
          onBlur={e => {
            const val = e.target.value.trim();
            if (val !== (row.original.assigned_to ?? "")) {
              updateContact(row.original.id, { assigned_to: val || null });
            }
          }}
          className="text-xs border border-grey-300 rounded-lg px-2 py-1 w-24 focus:outline-none focus:border-blue/60"
        />
      ),
    },
    {
      accessorKey: "created_at",
      header: "Received",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDateTime(getValue<string>())}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Log"
        description="Support ticket queue — assign, prioritise, and resolve."
      />

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: "New tickets",   value: newCount,     color: newCount > 0 ? "text-danger" : "text-dark",       icon: MessageSquare },
          { label: "In progress",   value: openCount,    color: openCount > 0 ? "text-warning" : "text-dark",     icon: Mail },
          { label: "Resolved",      value: resolvedCount,color: "text-green-dark",                                icon: CheckCircle2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-grey-50 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-grey-500" />
            </div>
            <div>
              <p className="text-xs text-grey-500">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-0 border-b border-grey-300">
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px capitalize ${
              statusFilter === s ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"
            }`}>
            {s.replace(/_/g, " ")}
            {s === "new" && newCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold">{newCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : (
        <>
          <DataTable data={filtered} columns={columns} searchKey="email" searchPlaceholder="Search by email…" />

          {/* Expanded message view */}
          {expanded && (() => {
            const c = contacts.find(x => x.id === expanded);
            if (!c) return null;
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 -mt-2">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-dark">{c.name || c.email}</p>
                    <p className="text-xs text-grey-500">{c.subject || "No subject"} · {formatDateTime(c.created_at)}</p>
                  </div>
                  <button onClick={() => setExpanded(null)} className="text-grey-400 hover:text-dark text-xl leading-none">×</button>
                </div>
                <div className="bg-grey-50 rounded-xl p-4">
                  <p className="text-sm text-grey-700 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <a href={`mailto:${c.email}`}
                    className="flex items-center gap-1.5 text-sm font-medium bg-blue text-white px-4 py-2 rounded-xl hover:bg-blue-dark transition">
                    <Mail size={13} /> Reply by email
                  </a>
                  <button onClick={() => updateContact(c.id, { status: "resolved" })}
                    className="flex items-center gap-1.5 text-sm font-medium border border-teal/30 text-teal-dark bg-teal-light px-4 py-2 rounded-xl hover:bg-teal-light transition">
                    <CheckCircle2 size={13} /> Mark resolved
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
