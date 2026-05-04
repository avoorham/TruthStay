"use client";
import { useEffect, useState } from "react";
import { Flag, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
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

const STATUSES = ["new", "acknowledged", "investigating", "resolved", "dismissed"];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>("new");
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/admin/support/reports")
      .then(r => r.json())
      .then(d => { setReports(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  async function updateStatus(id: string, status: string, resolution_notes?: string) {
    await fetch(`/api/admin/support/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution_notes }),
    }).catch(() => {});
    setReports(prev => prev.map(r => r.id === id ? { ...r, status, resolution_notes: resolution_notes ?? r.resolution_notes } : r));
    setResolving(null);
    setNotes("");
  }

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);
  const newCount = reports.filter(r => r.status === "new").length;

  const TYPE_ICON: Record<string, string> = {
    spam:            "🚫",
    inappropriate:   "⚠️",
    false_info:      "ℹ️",
    harassment:      "🚨",
    duplicate:       "📋",
    other:           "❓",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Reports"
        description={newCount > 0 ? `${newCount} new report${newCount > 1 ? "s" : ""} need attention.` : "User-submitted content reports."}
      />

      {/* Status filter */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
              filter === s ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
            }`}>
            {s}
            {s === "new" && newCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold">{newCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 size={28} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">All clear!</p>
          <p className="text-xs text-slate-500">No reports with this status.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => (
            <div key={report.id} className="border border-slate-200 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-danger-light flex items-center justify-center text-lg shrink-0">
                  {TYPE_ICON[report.report_type] ?? "❓"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-dark capitalize">{report.report_type.replace(/_/g, " ")}</span>
                        <StatusBadge value={report.status} />
                      </div>
                      <p className="text-xs text-grey-500 mt-0.5">
                        Reporter: <code className="font-mono text-grey-700">{report.reporter_id.slice(0, 8)}…</code>
                        {report.reported_id && (
                          <> · Reported: <code className="font-mono text-grey-700">{report.reported_id.slice(0, 8)}…</code></>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-grey-400 shrink-0">{formatDateTime(report.created_at)}</span>
                  </div>

                  <div className="mt-3 bg-slate-50 rounded-md p-3">
                    <p className="text-xs font-semibold text-grey-500 uppercase tracking-wide mb-1">Reason</p>
                    <p className="text-sm text-grey-700 leading-relaxed">{report.reason}</p>
                  </div>

                  {report.resolution_notes && (
                    <div className="mt-2 text-xs text-grey-500">
                      <span className="font-semibold">Resolution: </span>{report.resolution_notes}
                    </div>
                  )}

                  {resolving === report.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Resolution notes (optional)…"
                        rows={2}
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs resize-none focus:outline-none "
                      />
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(report.id, "resolved", notes)}
                          className="flex items-center gap-1 bg-teal-500 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-teal-600 transition">
                          <CheckCircle2 size={11} /> Resolve
                        </button>
                        <button onClick={() => updateStatus(report.id, "dismissed", notes)}
                          className="flex items-center gap-1 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-md hover:bg-slate-50 transition">
                          <XCircle size={11} /> Dismiss
                        </button>
                        <button onClick={() => { setResolving(null); setNotes(""); }}
                          className="text-xs text-grey-500 hover:text-dark px-2">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    report.status !== "resolved" && report.status !== "dismissed" && (
                      <div className="mt-3 flex gap-2">
                        {report.status === "new" && (
                          <button onClick={() => updateStatus(report.id, "acknowledged")}
                            className="flex items-center gap-1 text-xs font-medium border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50 transition">
                            <Flag size={11} /> Acknowledge
                          </button>
                        )}
                        {report.status !== "investigating" && (
                          <button onClick={() => updateStatus(report.id, "investigating")}
                            className="flex items-center gap-1 text-xs font-medium border border-warning/30 text-warning bg-warning-light px-3 py-1.5 rounded-md hover:bg-warning-light transition">
                            Investigate
                          </button>
                        )}
                        <button onClick={() => setResolving(report.id)}
                          className="flex items-center gap-1 text-xs font-medium text-teal-600 border border-teal-200 bg-teal-50 px-3 py-1.5 rounded-md hover:bg-teal-100 transition">
                          <CheckCircle2 size={11} /> Resolve / Dismiss
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
