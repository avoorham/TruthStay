"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Bot, User, Calendar, Mail, Bell, Send,
  Users, MousePointer, TrendingDown, CheckCircle2, XCircle, Edit2, Zap,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number | null;
  open_rate: number | null;
  click_rate: number | null;
  created_at: string;
  channel?: "email" | "push" | "both";
  segment_label?: string | null;
  agent_rationale?: string | null;
  created_by?: "agent" | "manual";
  estimated_cost?: number | null;
  cfo_approved?: boolean | null;
};

// ─── Mock open-rate timeline (72h after send) ─────────────────────────────────

function buildOpenRateData(openRate: number) {
  const curve = [0, 12, 28, 40, 50, 56, 59, 61, 62, 63, 64, 64.5, 65, 65.2, 65.4, 65.5, 65.6, 65.7, 65.8, 65.9, 66, 66.1, 66.2, 66.3];
  return curve.map((pct, i) => ({
    hour: `${i * 3}h`,
    opened: parseFloat(((pct / 100) * openRate).toFixed(1)),
    clicked: parseFloat(((pct / 100) * openRate * 0.26).toFixed(1)),
  }));
}

// ─── Mock recipients ──────────────────────────────────────────────────────────

const MOCK_RECIPIENTS = [
  { email: "sophie.m@example.com",  status: "opened",  opened_at: "2026-04-15T10:22:00Z", clicked_at: "2026-04-15T10:23:00Z" },
  { email: "lucas.b@example.com",   status: "clicked", opened_at: "2026-04-15T10:31:00Z", clicked_at: "2026-04-15T10:31:45Z" },
  { email: "emma.r@example.com",    status: "opened",  opened_at: "2026-04-15T11:05:00Z", clicked_at: null },
  { email: "james.w@example.com",   status: "sent",    opened_at: null,                    clicked_at: null },
  { email: "chloe.d@example.com",   status: "opened",  opened_at: "2026-04-15T12:14:00Z", clicked_at: null },
  { email: "noah.p@example.com",    status: "clicked", opened_at: "2026-04-15T13:00:00Z", clicked_at: "2026-04-15T13:01:22Z" },
  { email: "alice.k@example.com",   status: "sent",    opened_at: null,                    clicked_at: null },
  { email: "oliver.t@example.com",  status: "bounced", opened_at: null,                    clicked_at: null },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function channelBg(ch?: string) {
  if (ch === "email") return "bg-blue-light text-blue";
  if (ch === "push")  return "bg-lavender text-charcoal";
  if (ch === "both")  return "bg-teal-light text-teal-dark";
  return "bg-grey-100 text-grey-700";
}
function channelLabel(ch?: string) {
  if (ch === "email") return "Email";
  if (ch === "push")  return "Push";
  if (ch === "both")  return "Email + Push";
  return ch ?? "—";
}

const CHART_TOOLTIP = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor: { stroke: "rgba(45,212,191,0.2)", strokeWidth: 1 },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-grey-500 font-medium">{label}</p>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", accent)}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-dark">{value}</p>
      {sub && <p className="text-xs text-grey-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/marketing/campaigns/${id}`)
      .then(r => r.json())
      .then(data => { setCampaign(data?.error ? null : data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function updateStatus(status: string) {
    await fetch(`/api/admin/marketing/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
    if (campaign) setCampaign({ ...campaign, status: status as Campaign["status"] });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-grey-400 text-sm">
        Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-sm text-grey-500">Campaign not found.</p>
        <Link href="/marketing/campaigns" className="text-teal text-sm hover:underline">← Back to Campaigns</Link>
      </div>
    );
  }

  const isSent = campaign.status === "sent";
  const isDraft = campaign.status === "draft";
  const openRateData = isSent && campaign.open_rate ? buildOpenRateData(campaign.open_rate) : [];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/marketing/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-grey-500 hover:text-dark transition">
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      {/* Header */}
      <div className="border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge value={campaign.status} />
              {campaign.channel && (
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", channelBg(campaign.channel))}>
                  {channelLabel(campaign.channel)}
                </span>
              )}
              {campaign.created_by === "agent" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-dark bg-teal-light px-2 py-0.5 rounded-full">
                  <Bot size={9} /> Agent-drafted
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold text-dark tracking-tight">{campaign.name}</h1>
            {campaign.subject && (
              <p className="text-sm text-grey-500 mt-1">Subject: {campaign.subject}</p>
            )}
            {campaign.segment_label && (
              <p className="text-xs text-grey-400 mt-0.5">Segment: {campaign.segment_label}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isDraft && (
              <>
                <button onClick={() => updateStatus("scheduled")}
                  className="inline-flex items-center gap-1.5 bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition">
                  <CheckCircle2 size={14} /> Approve &amp; Schedule
                </button>
                <button
                  className="inline-flex items-center gap-1.5 border border-slate-200 text-sm font-medium text-slate-700 px-3 py-2 rounded-md hover:bg-slate-50 transition">
                  <Edit2 size={13} /> Edit
                </button>
                <button onClick={() => updateStatus("cancelled")}
                  className="inline-flex items-center gap-1.5 border border-danger text-danger text-sm font-semibold px-3 py-2 rounded-xl hover:bg-danger-light transition">
                  <XCircle size={13} /> Reject
                </button>
              </>
            )}
            {campaign.status === "scheduled" && (
              <button onClick={() => updateStatus("cancelled")}
                className="inline-flex items-center gap-1.5 border border-slate-200 text-sm text-slate-500 px-3 py-2 rounded-md hover:border-danger hover:text-danger transition">
                Cancel Campaign
              </button>
            )}
          </div>
        </div>

        {/* Agent rationale */}
        {campaign.agent_rationale && (
          <div className="mt-4 flex gap-3 bg-teal-bg border border-teal-light rounded-xl p-4">
            <Bot size={16} className="text-teal shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-teal-dark mb-1 uppercase tracking-wide">Agent rationale</p>
              <p className="text-sm text-grey-700 leading-relaxed">{campaign.agent_rationale}</p>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="mt-4 flex items-center gap-5 text-xs text-grey-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            Created {formatDateTime(campaign.created_at)}
          </span>
          {campaign.scheduled_at && (
            <span className="flex items-center gap-1">
              <Send size={11} />
              Scheduled {formatDateTime(campaign.scheduled_at)}
            </span>
          )}
          {campaign.sent_at && (
            <span className="flex items-center gap-1 text-green-dark">
              <CheckCircle2 size={11} />
              Sent {formatDateTime(campaign.sent_at)}
            </span>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Recipients"   value={campaign.recipient_count?.toLocaleString() ?? "—"} icon={Users}         accent="bg-blue-light text-blue" />
        <KPI label="Opened"       value={isSent && campaign.open_rate  != null ? `${campaign.open_rate.toFixed(1)}%`  : "—"} icon={Mail}          accent="bg-teal-light text-teal-dark" />
        <KPI label="Clicked"      value={isSent && campaign.click_rate != null ? `${campaign.click_rate.toFixed(1)}%` : "—"} icon={MousePointer}  accent="bg-green-light text-green-dark" />
        <KPI label="Converted"    value={isSent ? "3.2%" : "—"} icon={TrendingDown}  accent="bg-lavender text-charcoal" sub={isSent ? "est." : undefined} />
        <KPI label="Unsubscribed" value={isSent ? "0.4%" : "—"} icon={XCircle}       accent="bg-danger-light text-danger" />
      </div>

      {/* Chart + preview */}
      {isSent && openRateData.length > 0 && (
        <div className="grid grid-cols-5 gap-6">
          {/* Open rate timeline */}
          <div className="col-span-3 border border-slate-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-5">
              Open &amp; click rate — 72 hours after send
            </h2>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={openRateData}>
                  <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip {...CHART_TOOLTIP} formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="opened" name="Opened" stroke="#2DD4BF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clicked" name="Clicked" stroke="#0A7AFF" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Email preview panel */}
          <div className="col-span-2 border border-slate-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Email preview</h2>
            <div className="bg-grey-50 rounded-xl border border-grey-200 p-4 text-xs text-grey-700 space-y-2">
              <p className="font-semibold text-dark text-sm">{campaign.subject || campaign.name}</p>
              <p className="text-grey-400 text-[11px]">From: team@truthstay.com</p>
              <div className="border-t border-grey-200 pt-3 mt-3 space-y-1.5 text-grey-500 leading-relaxed">
                <p>Hi {"{first_name}"},</p>
                <p>We noticed you haven't planned an adventure recently and wanted to reach out with some fresh ideas tailored to your interests.</p>
                <p>Your next unforgettable trip is just a tap away.</p>
                <div className="mt-3">
                  <span className="inline-block bg-teal-500 text-white text-[11px] font-medium px-3 py-1.5 rounded-md">
                    Explore destinations →
                  </span>
                </div>
              </div>
              <p className="text-grey-300 text-[10px] pt-2">Unsubscribe · View in browser</p>
            </div>
          </div>
        </div>
      )}

      {/* Non-sent state */}
      {!isSent && (
        <div className="border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Email preview</h2>
          <div className="bg-grey-50 rounded-xl border border-grey-200 p-4 text-xs text-grey-700 space-y-2">
            <p className="font-semibold text-dark text-sm">{campaign.subject || campaign.name}</p>
            <p className="text-grey-400 text-[11px]">From: team@truthstay.com</p>
            <div className="border-t border-grey-200 pt-3 mt-3 space-y-1.5 text-grey-500 leading-relaxed">
              <p>Hi {"{first_name}"},</p>
              <p>We have something exciting to share with you. Check out the latest adventures and destinations on TruthStay.</p>
              <div className="mt-3">
                <span className="inline-block bg-teal-500 text-white text-[11px] font-medium px-3 py-1.5 rounded-md">
                  Explore now →
                </span>
              </div>
            </div>
            <p className="text-grey-300 text-[10px] pt-2">Unsubscribe · View in browser</p>
          </div>
          {isDraft && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-warning">
              <Zap size={12} />
              <span>This campaign is awaiting approval before it can be scheduled.</span>
            </div>
          )}
        </div>
      )}

      {/* Recipient table */}
      {isSent && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-grey-100">
            <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Recipients (sample)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-grey-50 border-b border-grey-100">
              <tr>
                {["User", "Status", "Opened at", "Clicked at"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-grey-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-50">
              {MOCK_RECIPIENTS.map((r, i) => (
                <tr key={i} className="hover:bg-grey-50/60 transition">
                  <td className="px-5 py-3 font-medium text-dark">{r.email}</td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      r.status === "clicked" ? "bg-green-light text-green-dark" :
                      r.status === "opened"  ? "bg-teal-light text-teal-dark" :
                      r.status === "bounced" ? "bg-danger-light text-danger" :
                      "bg-grey-100 text-grey-500"
                    )}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-grey-500">{r.opened_at  ? formatDateTime(r.opened_at)  : "—"}</td>
                  <td className="px-5 py-3 text-xs text-grey-500">{r.clicked_at ? formatDateTime(r.clicked_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 border-t border-grey-100 text-xs text-grey-400">
            Showing 8 of {campaign.recipient_count?.toLocaleString() ?? "—"} recipients
          </div>
        </div>
      )}
    </div>
  );
}
