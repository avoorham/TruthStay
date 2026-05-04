"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Shield, Eye, Trash2, TrendingDown, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlagReason = "low_trust_score" | "stale_source" | "multiple_reports" | "ai_detected";

type FlaggedItem = {
  id: string;
  type: "adventure" | "post" | "review" | "user";
  title: string;
  region?: string;
  author?: string;
  flag_reason: FlagReason;
  flag_details: string;
  trust_score?: number;
  report_count?: number;
  last_updated?: string;
  status: "pending" | "reviewed" | "removed";
  created_at: string;
};

// ─── Static mock data ─────────────────────────────────────────────────────────

const MOCK_FLAGGED: FlaggedItem[] = [
  { id: "f1", type: "adventure", title: "Best hotels in Tenerife 2022", region: "Tenerife", author: "scout_agent", flag_reason: "stale_source",       flag_details: "Content references hotels that closed in 2023. Last updated 28 months ago.", trust_score: 52, report_count: 0, last_updated: "2022-10-14T09:00:00Z", status: "pending", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "f2", type: "review",   title: "Great place — 5 stars",        region: "Lisbon",   author: "user_abc123",  flag_reason: "low_trust_score",    flag_details: "Trust score 31/100. Account created 2 days ago, first review. Generic text with no specific details.", trust_score: 31, report_count: 2, last_updated: undefined, status: "pending", created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: "f3", type: "post",     title: "Check out this amazing resort!", region: undefined, author: "promo_user99", flag_reason: "multiple_reports",   flag_details: "Reported 4 times by different users as promotional spam. Contains affiliate link.", trust_score: 44, report_count: 4, last_updated: undefined, status: "pending", created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: "f4", type: "adventure", title: "Top 10 restaurants in Paris",  region: "Paris",   author: "scout_agent",  flag_reason: "stale_source",       flag_details: "3 of 10 listed restaurants have permanently closed. TripAdvisor data from 18 months ago.", trust_score: 61, report_count: 1, last_updated: "2023-02-01T00:00:00Z", status: "pending", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "f5", type: "user",     title: "User: spam_account_007",        region: undefined, author: undefined,      flag_reason: "multiple_reports",   flag_details: "5 separate spam reports in 24 hours. Posts identical content across multiple destinations.", trust_score: 18, report_count: 5, last_updated: undefined, status: "pending", created_at: new Date(Date.now() - 43200000).toISOString() },
  { id: "f6", type: "review",   title: "Terrible — do not go",          region: "Barcelona", author: "anon_user",  flag_reason: "ai_detected",        flag_details: "AI flagged as likely AI-generated. No specific details, contradicts recent positive community reviews.", trust_score: 39, report_count: 1, last_updated: undefined, status: "reviewed", created_at: new Date(Date.now() - 172800000).toISOString() },
];

const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  low_trust_score:  "Low trust score",
  stale_source:     "Stale source",
  multiple_reports: "Multiple reports",
  ai_detected:      "AI detected",
};

const FLAG_ICON: Record<FlagReason, React.ReactNode> = {
  low_trust_score:  <TrendingDown size={13} />,
  stale_source:     <AlertCircle  size={13} />,
  multiple_reports: <AlertTriangle size={13} />,
  ai_detected:      <Shield size={13} />,
};

const FLAG_COLOR: Record<FlagReason, string> = {
  low_trust_score:  "bg-danger-light text-danger",
  stale_source:     "bg-warning-light text-warning",
  multiple_reports: "bg-danger-light text-danger",
  ai_detected:      "bg-lavender text-charcoal",
};

const TYPE_COLOR: Record<string, string> = {
  adventure: "bg-teal-light text-teal-dark",
  post:      "bg-blue-light text-blue",
  review:    "bg-lavender text-charcoal",
  user:      "bg-danger-light text-danger",
};

type FilterReason = "all" | FlagReason;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlaggedContentPage() {
  const [items, setItems]       = useState<FlaggedItem[]>(MOCK_FLAGGED);
  const [filter, setFilter]     = useState<FilterReason>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "reviewed" | "removed">("pending");

  function handleAction(id: string, action: "reviewed" | "removed") {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
  }

  const filtered = items.filter(i => {
    const reasonOk = filter === "all" || i.flag_reason === filter;
    const statusOk = statusFilter === "all" || i.status === statusFilter;
    return reasonOk && statusOk;
  });

  const pendingCount = items.filter(i => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flagged Content"
        description={`${pendingCount} item${pendingCount !== 1 ? "s" : ""} need review — automated flags for quality and trust issues.`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pending review",  value: items.filter(i => i.status === "pending").length,  color: "text-danger" },
          { label: "Low trust score", value: items.filter(i => i.flag_reason === "low_trust_score").length, color: "text-dark" },
          { label: "Stale sources",   value: items.filter(i => i.flag_reason === "stale_source").length, color: "text-dark" },
          { label: "Spam / reports",  value: items.filter(i => i.flag_reason === "multiple_reports").length, color: "text-dark" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-grey-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "pending", "reviewed", "removed"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition ${
                statusFilter === s ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
              }`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "low_trust_score", "stale_source", "multiple_reports", "ai_detected"] as FilterReason[]).map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                filter === r ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
              }`}>
              {r === "all" ? "All reasons" : FLAG_REASON_LABEL[r as FlagReason]}
            </button>
          ))}
        </div>
      </div>

      {/* Flagged items */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield size={28} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">No flagged items</p>
          <p className="text-xs text-slate-500">All content looks good for these filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className={`rounded-lg border p-5 ${item.status === "pending" ? "border-slate-200" : "border-slate-100 opacity-70"}`}>
              <div className="flex items-start gap-4">
                <div className="shrink-0 space-y-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[item.type]}`}>
                    {item.type}
                  </span>
                  <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${FLAG_COLOR[item.flag_reason]}`}>
                    {FLAG_ICON[item.flag_reason]}
                    {FLAG_REASON_LABEL[item.flag_reason]}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-dark">{item.title}</p>
                      <p className="text-xs text-grey-400 mt-0.5">
                        {item.region && <>{item.region} · </>}
                        {item.author && <>@{item.author} · </>}
                        Flagged {formatDateTime(item.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.trust_score != null && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.trust_score < 40 ? "bg-danger-light text-danger" :
                          item.trust_score < 60 ? "bg-warning-light text-warning" :
                          "bg-green-light text-green-dark"
                        }`}>
                          Trust {item.trust_score}
                        </span>
                      )}
                      {item.report_count != null && item.report_count > 0 && (
                        <span className="text-xs text-danger bg-danger-light px-2 py-0.5 rounded-full font-semibold">
                          {item.report_count} report{item.report_count > 1 ? "s" : ""}
                        </span>
                      )}
                      <StatusBadge value={item.status} />
                    </div>
                  </div>

                  <div className="mt-3 bg-slate-50 rounded-md p-3">
                    <p className="text-xs text-grey-700 leading-relaxed">{item.flag_details}</p>
                    {item.last_updated && (
                      <p className="text-[10px] text-grey-400 mt-1">Last content update: {formatDateTime(item.last_updated)}</p>
                    )}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleAction(item.id, "reviewed")}
                        className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50 transition">
                        <Eye size={11} /> Mark reviewed
                      </button>
                      <button onClick={() => handleAction(item.id, "removed")}
                        className="flex items-center gap-1.5 text-xs font-medium border border-danger/30 text-danger bg-danger-light px-3 py-1.5 rounded-md hover:bg-danger-light transition">
                        <Trash2 size={11} /> Remove content
                      </button>
                    </div>
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
