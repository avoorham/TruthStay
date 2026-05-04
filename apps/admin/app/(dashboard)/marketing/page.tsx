"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Link2, Mail, Bell, Share2, AlertCircle, Bot,
  ArrowRight, TrendingUp, CheckCircle2, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";

// ─── Static acquisition data (14 days) ───────────────────────────────────────

const ACQ_DATA = [
  { day: "14d", organic: 38, referral: 12, invitation: 21, social: 7 },
  { day: "13d", organic: 42, referral: 15, invitation: 24, social: 8 },
  { day: "12d", organic: 35, referral: 18, invitation: 19, social: 6 },
  { day: "11d", organic: 47, referral: 14, invitation: 28, social: 11 },
  { day: "10d", organic: 51, referral: 20, invitation: 33, social: 9 },
  { day: "9d",  organic: 44, referral: 17, invitation: 26, social: 10 },
  { day: "8d",  organic: 39, referral: 22, invitation: 30, social: 8 },
  { day: "7d",  organic: 56, referral: 19, invitation: 35, social: 13 },
  { day: "6d",  organic: 48, referral: 25, invitation: 29, social: 11 },
  { day: "5d",  organic: 53, referral: 21, invitation: 38, social: 14 },
  { day: "4d",  organic: 61, referral: 28, invitation: 42, social: 12 },
  { day: "3d",  organic: 57, referral: 24, invitation: 36, social: 15 },
  { day: "2d",  organic: 64, referral: 31, invitation: 44, social: 16 },
  { day: "Today", organic: 47, referral: 22, invitation: 31, social: 9 },
];

// ─── Static agent activity ───────────────────────────────────────────────────

const AGENT_LOGS = [
  { type: "DRAFT", time: "09:14", message: "Drafted re-engagement campaign for 147 inactive users", status: "pending_approval" },
  { type: "AUTO",  time: "08:52", message: "Sent welcome email sequence to 23 new signups", status: "sent" },
  { type: "SOCIAL",time: "08:30", message: "Scheduled 3 Instagram posts for peak engagement windows", status: "scheduled" },
  { type: "CHURN", time: "07:45", message: "Identified 31 users at churn risk — push notification queued", status: "pending_approval" },
  { type: "DRAFT", time: "Yesterday", message: "Created trip invitation reminder campaign (est. 480 recipients)", status: "approved" },
  { type: "AUTO",  time: "Yesterday", message: "Sent 3-day post-trip review request to 62 users", status: "sent" },
  { type: "SOCIAL",time: "2d ago", message: "Published TikTok carousel: 'Top 5 beach destinations'", status: "published" },
];

const ACTION_COLOR: Record<string, string> = {
  DRAFT:  "bg-blue-light text-blue",
  AUTO:   "bg-green-light text-green-dark",
  POST:   "bg-teal-light text-teal-dark",
  CHURN:  "bg-danger-light text-danger",
  SOCIAL: "bg-lavender text-charcoal",
};

// ─── Static channel performance ───────────────────────────────────────────────

const CHANNEL_STATS = [
  { channel: "Email",     sent: "1,240",  open_rate: "32.4%", click_rate: "8.1%",  conversions: 48 },
  { channel: "Push",      sent: "3,780",  open_rate: "18.7%", click_rate: "4.3%",  conversions: 112 },
  { channel: "In-App",    sent: "8,430",  open_rate: "41.2%", click_rate: "12.8%", conversions: 234 },
  { channel: "SMS",       sent: "290",    open_rate: "94.1%", click_rate: "22.3%", conversions: 31 },
  { channel: "Social",    sent: "4 posts", open_rate: "—",    click_rate: "3.8%",  conversions: 19 },
];

// ─── Tooltip style ────────────────────────────────────────────────────────────

const TOOLTIP = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor: { fill: "rgba(45,212,191,0.04)" },
};

// ─── Campaign type ────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingOverviewPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/marketing/campaigns")
      .then(r => r.json())
      .then(c => { setCampaigns(Array.isArray(c) ? c : []); setLoading(false); });
  }, []);

  const pendingCampaigns = campaigns.filter(c => c.status === "draft");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Marketing"
        description="Daily command centre — acquisition, agent activity, and channel performance."
      />

      {/* ── Action banner ── */}
      {!loading && pendingCampaigns.length > 0 && (
        <div className="border-l-4 border-teal bg-teal-bg rounded-r-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-dark">
                {pendingCampaigns.length} campaign{pendingCampaigns.length > 1 ? "s" : ""} waiting for your approval
              </p>
              <p className="text-xs text-grey-500 mt-0.5">
                {pendingCampaigns.slice(0, 2).map(c => c.name).join(", ")}
                {pendingCampaigns.length > 2 ? ` +${pendingCampaigns.length - 2} more` : ""}
              </p>
            </div>
          </div>
          <Link
            href="/marketing/campaigns"
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-teal-dark hover:text-teal transition"
          >
            Review <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <KPICard label="New Users Today"   value="47"    change={12.3}  icon={Users}    accent="teal" />
        <KPICard label="Trip Invites Sent" value="183"   change={8.7}   icon={Link2}    accent="teal" />
        <KPICard label="Referral Signups"  value="22"    change={-2.1}  icon={TrendingUp} accent="blue" />
        <KPICard label="Emails Sent"       value="1,240" sub="today"    icon={Mail}     accent="blue" />
        <KPICard label="Push Sent"         value="3,780" sub="today"    icon={Bell}     accent="blend" />
        <KPICard label="Social Posts"      value="4"     sub="scheduled" icon={Share2}  accent="green" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-5 gap-6">
        {/* Acquisition sources stacked area — 60% */}
        <div className="col-span-3 border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-6">
            Acquisition sources — last 14 days
          </h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACQ_DATA} stackOffset="expand">
                <defs>
                  <linearGradient id="gOrganic"    x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2DD4BF" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gReferral"   x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0A7AFF" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#0A7AFF" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gInvitation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gSocial"     x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v * 100)}%`} />
                <Tooltip {...TOOLTIP} formatter={(v: number) => `${Math.round(v * 100)}%`} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
                <Area type="monotone" dataKey="organic"    name="Organic"         stackId="1" stroke="#2DD4BF" fill="url(#gOrganic)" />
                <Area type="monotone" dataKey="referral"   name="Referral code"   stackId="1" stroke="#0A7AFF" fill="url(#gReferral)" />
                <Area type="monotone" dataKey="invitation" name="Trip invitation"  stackId="1" stroke="#6366F1" fill="url(#gInvitation)" />
                <Area type="monotone" dataKey="social"     name="Social"          stackId="1" stroke="#F59E0B" fill="url(#gSocial)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent activity feed — 40% */}
        <div className="col-span-2 border border-slate-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bot size={15} className="text-teal" />
            <h2 className="text-sm font-semibold text-dark">Marketing Agent Activity</h2>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-green-dark bg-green-light px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-dark inline-block" />
              Live
            </span>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[260px]">
            {AGENT_LOGS.map((log, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ACTION_COLOR[log.type] ?? "bg-grey-100 text-grey-700"}`}>
                    {log.type}
                  </span>
                  {i < AGENT_LOGS.length - 1 && <div className="w-px flex-1 bg-grey-100" />}
                </div>
                <div className="pb-3">
                  <p className="text-xs text-dark leading-snug">{log.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-grey-400">{log.time}</span>
                    <StatusBadge value={log.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Channel performance table ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Channel performance — today</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs text-slate-500 uppercase tracking-wider">
              <th className="text-left px-6 py-3">Channel</th>
              <th className="text-right px-6 py-3">Sent</th>
              <th className="text-right px-6 py-3">Open rate</th>
              <th className="text-right px-6 py-3">Click rate</th>
              <th className="text-right px-6 py-3">Conversions</th>
            </tr>
          </thead>
          <tbody>
            {CHANNEL_STATS.map(row => (
              <tr key={row.channel} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-0">
                <td className="px-6 py-3 font-medium text-dark">{row.channel}</td>
                <td className="px-6 py-3 text-right font-mono text-grey-700">{row.sent}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.open_rate}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.click_rate}</td>
                <td className="px-6 py-3 text-right">
                  <span className="font-semibold text-dark">{row.conversions}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
