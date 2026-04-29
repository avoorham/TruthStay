"use client";
import { Bot, DollarSign, Clock, Send, FileText, Share2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";

// ─── Static data ──────────────────────────────────────────────────────────────

const AGENT_STATUS = {
  status:            "active",
  budget_used:       34.20,
  budget_total:      100.00,
  last_run:          "09:14 today",
  next_run:          "14:00 today",
  campaigns_drafted: 3,
  campaigns_sent:    12,
};

const DECISION_LOG = [
  { ts: "09:14", type: "DRAFT",  action: "Drafted re-engagement campaign", detail: "Segment: 147 users inactive >21 days. Subject: 'Your next adventure is waiting…'. Est. cost: €0.42. Pending approval.", status: "pending_approval" },
  { ts: "08:52", type: "AUTO",   action: "Sent welcome email sequence",    detail: "23 new signups in the last 24h received the 3-email welcome sequence. Open rate target: 35%.", status: "sent" },
  { ts: "08:30", type: "SOCIAL", action: "Scheduled 3 Instagram posts",    detail: "Content: hidden gems Lisbon, community spotlight Barcelona, weekend inspo Amalfi. Scheduled for peak windows.", status: "scheduled" },
  { ts: "07:45", type: "CHURN",  action: "Churn risk push queued",         detail: "31 users flagged as churn risk (no app open in 21+ days, had planned a trip). Push message drafted: 'Pick up where you left off 🗺️'", status: "pending_approval" },
  { ts: "Yesterday 18:00", type: "DRAFT",  action: "Trip invitation reminder campaign drafted", detail: "Recipients: 480 users who created trips but haven't sent invitations. CFO budget check passed.", status: "approved" },
  { ts: "Yesterday 15:30", type: "AUTO",   action: "Review request emails sent",              detail: "62 users who completed trips 3 days ago received automated review request. Previous batch: 41% response rate.", status: "sent" },
  { ts: "Yesterday 12:00", type: "SOCIAL", action: "TikTok carousel published",               detail: "'Top 5 beach destinations' — 3,421 views, 218 comments, 891 shares in first 24h.", status: "published" },
  { ts: "2d ago 09:00",    type: "CHURN",  action: "Churn prevention campaign sent",           detail: "94 users targeted. 18 re-opened app within 48h (19% win-back rate). Above 15% target.", status: "sent" },
  { ts: "2d ago 08:15",    type: "AUTO",   action: "Post-trip survey sent",                   detail: "41 users who completed 7+ day trips. Survey completion target: 60%. Previous: 64%.", status: "sent" },
];

const MONTHLY_COMPARISON = [
  { month: "Feb", campaigns_drafted: 8,  campaigns_sent: 6,  emails_sent: 3420,  avg_open_rate: "28.1%", win_backs: 14, social_posts: 18 },
  { month: "Mar", campaigns_drafted: 11, campaigns_sent: 9,  emails_sent: 4180,  avg_open_rate: "30.4%", win_backs: 21, social_posts: 22 },
  { month: "Apr", campaigns_drafted: 14, campaigns_sent: 12, emails_sent: 5240,  avg_open_rate: "32.7%", win_backs: 31, social_posts: 28 },
];

const ACTION_STYLE: Record<string, { bg: string; text: string }> = {
  DRAFT:  { bg: "bg-blue-light",    text: "text-blue" },
  AUTO:   { bg: "bg-green-light",   text: "text-green-dark" },
  SOCIAL: { bg: "bg-lavender",      text: "text-charcoal" },
  CHURN:  { bg: "bg-danger-light",  text: "text-danger" },
  POST:   { bg: "bg-teal-light",    text: "text-teal-dark" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingAgentPage() {
  const budgetPct = (AGENT_STATUS.budget_used / AGENT_STATUS.budget_total) * 100;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Marketing Agent"
        description="Monitor the AI marketing agent — decisions, drafts, and performance over time."
      />

      {/* ── Agent status card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-bg flex items-center justify-center">
              <Bot size={18} className="text-teal" />
            </div>
            <div>
              <p className="font-semibold text-dark">Marketing Agent</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green-dark animate-pulse" />
                <span className="text-xs text-green-dark font-medium">Active</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-8">
            {/* Budget */}
            <div>
              <p className="text-xs text-grey-500 mb-1 flex items-center gap-1"><DollarSign size={10} /> Budget this month</p>
              <p className="text-lg font-bold text-dark font-mono">
                €{AGENT_STATUS.budget_used.toFixed(2)}
                <span className="text-xs font-normal text-grey-500"> / €{AGENT_STATUS.budget_total}</span>
              </p>
              <div className="mt-2 h-1.5 bg-grey-100 rounded-full overflow-hidden w-32">
                <div
                  className={`h-full rounded-full ${budgetPct > 80 ? "bg-danger" : budgetPct > 60 ? "bg-warning" : "bg-teal"}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-grey-500 mb-1 flex items-center gap-1"><Clock size={10} /> Last run</p>
              <p className="text-sm font-semibold text-dark">{AGENT_STATUS.last_run}</p>
            </div>
            <div>
              <p className="text-xs text-grey-500 mb-1 flex items-center gap-1"><Clock size={10} /> Next run</p>
              <p className="text-sm font-semibold text-dark">{AGENT_STATUS.next_run}</p>
            </div>
            <div>
              <p className="text-xs text-grey-500 mb-1 flex items-center gap-1"><FileText size={10} /> Drafted</p>
              <p className="text-sm font-semibold text-dark">{AGENT_STATUS.campaigns_drafted}</p>
            </div>
            <div>
              <p className="text-xs text-grey-500 mb-1 flex items-center gap-1"><Send size={10} /> Sent</p>
              <p className="text-sm font-semibold text-dark">{AGENT_STATUS.campaigns_sent}</p>
            </div>
          </div>
        </div>

        {budgetPct > 70 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-warning bg-warning-light rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            <span>Budget {budgetPct.toFixed(0)}% used — {(100 - budgetPct).toFixed(0)}% remaining for the rest of the month.</span>
          </div>
        )}
      </div>

      {/* ── Decision log ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Decision log</h2>
        </div>
        <div className="divide-y divide-grey-50">
          {DECISION_LOG.map((entry, i) => {
            const style = ACTION_STYLE[entry.type] ?? { bg: "bg-grey-100", text: "text-grey-700" };
            return (
              <div key={i} className="flex gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col items-center gap-1 shrink-0 w-20">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                    {entry.type}
                  </span>
                  <span className="text-[10px] text-grey-400 text-center leading-tight">{entry.ts}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark">{entry.action}</p>
                  <p className="text-xs text-grey-500 mt-0.5 leading-relaxed">{entry.detail}</p>
                </div>
                <div className="shrink-0">
                  <StatusBadge value={entry.status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Monthly performance comparison ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Monthly performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide">
              <th className="text-left px-6 py-3">Month</th>
              <th className="text-right px-6 py-3">Drafted</th>
              <th className="text-right px-6 py-3">Sent</th>
              <th className="text-right px-6 py-3">Emails sent</th>
              <th className="text-right px-6 py-3">Avg open rate</th>
              <th className="text-right px-6 py-3">Win-backs</th>
              <th className="text-right px-6 py-3">Social posts</th>
            </tr>
          </thead>
          <tbody>
            {MONTHLY_COMPARISON.map((row, i) => (
              <tr key={row.month} className={`border-b border-grey-50 hover:bg-slate-50 transition-colors ${i === MONTHLY_COMPARISON.length - 1 ? "font-semibold" : ""}`}>
                <td className="px-6 py-3 text-dark">{row.month} {i === MONTHLY_COMPARISON.length - 1 && <span className="ml-1 text-[10px] bg-teal-light text-teal-dark px-1.5 py-0.5 rounded-full font-normal">current</span>}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.campaigns_drafted}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.campaigns_sent}</td>
                <td className="px-6 py-3 text-right font-mono text-grey-700">{row.emails_sent.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.avg_open_rate}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.win_backs}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.social_posts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
