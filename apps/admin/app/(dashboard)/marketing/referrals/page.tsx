"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Users, ArrowRight, Link2, Trophy } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReferralCode = {
  id: string;
  code: string;
  referrer_id: string | null;
  created_at: string;
  referral_conversions?: { id: string; status: string }[];
};

// ─── Static data ──────────────────────────────────────────────────────────────

const ACQUISITION_DONUT = [
  { name: "Organic",         value: 38, color: "#2DD4BF" },
  { name: "Trip Invitation", value: 29, color: "#6366F1" },
  { name: "Referral code",   value: 12, color: "#0A7AFF" },
  { name: "Social",          value: 11, color: "#F59E0B" },
  { name: "Paid",            value: 10, color: "#94A3B8" },
];

const TRIP_INVITATIONS = [
  { trip: "Barcelona Long Weekend",  inviter: "maria_t",    invitees: 6, signups: 4, join_rate: "67%" },
  { trip: "Lisbon city break",       inviter: "joao_s",     invitees: 4, signups: 3, join_rate: "75%" },
  { trip: "Amalfi road trip",        inviter: "alessia_m",  invitees: 8, signups: 5, join_rate: "63%" },
  { trip: "Tokyo 2 weeks",           inviter: "kenji_r",    invitees: 3, signups: 3, join_rate: "100%" },
  { trip: "Santorini honeymoon",     inviter: "nina_k",     invitees: 2, signups: 1, join_rate: "50%" },
  { trip: "Norway fjords",           inviter: "lars_h",     invitees: 5, signups: 4, join_rate: "80%" },
  { trip: "New York winter break",   inviter: "sam_p",      invitees: 7, signups: 4, join_rate: "57%" },
];

const TOP_REFERRERS = [
  { name: "marco_g",   referrals: 24, conversions: 17, rate: "71%" },
  { name: "sarah_k",   referrals: 19, conversions: 12, rate: "63%" },
  { name: "thomas_v",  referrals: 16, conversions: 11, rate: "69%" },
  { name: "priya_m",   referrals: 14, conversions: 9,  rate: "64%" },
  { name: "alex_w",    referrals: 11, conversions: 7,  rate: "64%" },
];

const TOP_INVITERS = [
  { name: "alessia_m",  invites: 31, joined: 22, rate: "71%" },
  { name: "kenji_r",    invites: 26, joined: 19, rate: "73%" },
  { name: "lars_h",     invites: 24, joined: 18, rate: "75%" },
  { name: "maria_t",    invites: 22, joined: 15, rate: "68%" },
  { name: "joao_s",     invites: 18, joined: 13, rate: "72%" },
];

const TOOLTIP = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
};

type Tab = "overview" | "codes" | "invitations" | "leaderboard";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/marketing/referrals")
      .then(r => r.json())
      .then(d => { setCodes(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const codeColumns: ColumnDef<ReferralCode, any>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono font-semibold text-sm">{getValue<string>()}</span> },
    {
      id: "conversions", header: "Conversions",
      accessorFn: r => r.referral_conversions?.length ?? 0,
      cell: ({ getValue }) => <span className="text-sm font-semibold">{getValue<number>()}</span>,
    },
    {
      id: "pending", header: "Pending",
      accessorFn: r => r.referral_conversions?.filter(c => c.status === "pending").length ?? 0,
      cell: ({ getValue }) => <span className="text-sm text-grey-500">{getValue<number>()}</span>,
    },
    { accessorKey: "created_at", header: "Created", cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDate(getValue<string>())}</span> },
    {
      id: "actions", header: "",
      cell: () => (
        <div className="flex gap-1">
          <button className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition">Edit</button>
          <button className="text-xs px-2 py-1 rounded-md border border-danger/20 text-danger hover:bg-danger-light transition">Deactivate</button>
        </div>
      ),
    },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",     label: "Overview" },
    { key: "codes",        label: "Referral Codes" },
    { key: "invitations",  label: "Trip Invitations" },
    { key: "leaderboard",  label: "Leaderboard" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals & Invitations"
        description="Referral programme performance and viral trip invitation loop."
        actions={
          tab === "codes" && (
            <button className="inline-flex items-center gap-1.5 bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition">
              <Plus size={14} /> New code
            </button>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Two programme cards side by side */}
          <div className="grid grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Link2 size={16} className="text-blue" />
                <h3 className="text-sm font-semibold text-dark">Referral Programme</h3>
              </div>
              <p className="text-4xl font-bold tracking-tight text-dark">12%</p>
              <p className="text-xs text-grey-500 mt-1">conversion rate</p>
              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-grey-100">
                <div><p className="text-xs text-grey-500">Active codes</p><p className="text-lg font-bold text-dark">{codes.length}</p></div>
                <div><p className="text-xs text-grey-500">Conversions</p><p className="text-lg font-bold text-dark">{codes.reduce((a, c) => a + (c.referral_conversions?.length ?? 0), 0)}</p></div>
                <div><p className="text-xs text-grey-500">Avg per user</p><p className="text-lg font-bold text-dark">1.4</p></div>
                <div><p className="text-xs text-grey-500">Reward</p><p className="text-lg font-bold text-dark">€10 credit</p></div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Power loop</div>
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-teal" />
                <h3 className="text-sm font-semibold text-dark">Trip Invitations</h3>
              </div>
              <p className="text-4xl font-bold tracking-tight text-teal">29%</p>
              <p className="text-xs text-grey-500 mt-1">conversion rate</p>
              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-grey-100">
                <div><p className="text-xs text-grey-500">Invites sent</p><p className="text-lg font-bold text-dark">183</p></div>
                <div><p className="text-xs text-grey-500">Joined</p><p className="text-lg font-bold text-dark">53</p></div>
                <div><p className="text-xs text-grey-500">K-factor</p><p className="text-lg font-bold text-dark">0.31</p></div>
                <div><p className="text-xs text-grey-500">Viral chain</p><p className="text-lg font-bold text-dark">3.2 hops</p></div>
              </div>
            </div>
          </div>

          {/* Donut chart + K-factor */}
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-3 border border-slate-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Acquisition source breakdown</h3>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ACQUISITION_DONUT} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                      {ACQUISITION_DONUT.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP} formatter={(v: number) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-2 border border-slate-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Viral metrics</h3>
              <div className="space-y-4">
                {[
                  { label: "K-factor",           value: "0.31",    good: true },
                  { label: "Avg invites / user",  value: "4.2",     good: true },
                  { label: "Referral conversion", value: "12%",     good: false },
                  { label: "Invite conversion",   value: "29%",     good: true },
                  { label: "Time to first invite",value: "4.8 days",good: true },
                  { label: "Viral chain depth",   value: "3.2 hops",good: true },
                ].map(({ label, value, good }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-grey-50 last:border-0">
                    <span className="text-xs text-grey-500">{label}</span>
                    <span className={`text-sm font-bold ${good ? "text-dark" : "text-grey-700"}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Referral Codes ── */}
      {tab === "codes" && (
        loading
          ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
          : <DataTable data={codes} columns={codeColumns} searchKey="code" searchPlaceholder="Search codes…" />
      )}

      {/* ── Trip Invitations ── */}
      {tab === "invitations" && (
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Trip</th>
                  <th className="text-left px-6 py-3">Inviter</th>
                  <th className="text-right px-6 py-3">Invitees</th>
                  <th className="text-right px-6 py-3">Signups</th>
                  <th className="text-right px-6 py-3">Join rate</th>
                </tr>
              </thead>
              <tbody>
                {TRIP_INVITATIONS.map((row, i) => (
                  <tr key={i} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-dark">{row.trip}</td>
                    <td className="px-6 py-3 text-xs text-grey-700 font-mono">@{row.inviter}</td>
                    <td className="px-6 py-3 text-right">{row.invitees}</td>
                    <td className="px-6 py-3 text-right">{row.signups}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-semibold ${parseFloat(row.join_rate) >= 70 ? "text-teal-dark" : parseFloat(row.join_rate) >= 50 ? "text-dark" : "text-grey-500"}`}>
                        {row.join_rate}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Viral chain visualisation */}
          <div className="border border-slate-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Viral chain example</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {["User signs up", "Plans first trip", "Invites 4 friends", "2 join & plan trips", "Each invites 3 more"].map((step, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div className="bg-teal-50 border border-teal-200 rounded-md px-3 py-2 text-xs text-teal-700 font-medium text-center max-w-[120px]">
                    {step}
                  </div>
                  {i < 4 && <ArrowRight size={14} className="text-grey-300 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Leaderboard ── */}
      {tab === "leaderboard" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Top referrers */}
          <div className="border border-slate-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={14} className="text-warning" />
              <h3 className="text-sm font-semibold text-dark">Top referrers</h3>
            </div>
            <div className="space-y-3">
              {TOP_REFERRERS.map((r, i) => {
                const pct = (r.referrals / (TOP_REFERRERS[0]?.referrals ?? 1)) * 100;
                return (
                  <div key={r.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-grey-400 font-semibold text-right">{i + 1}</span>
                        <span className="font-mono text-dark font-medium">@{r.name}</span>
                      </div>
                      <div className="flex gap-3 text-grey-500">
                        <span>{r.referrals} sent</span>
                        <span className="font-semibold text-green-dark">{r.conversions} conv.</span>
                      </div>
                    </div>
                    <div className="ml-7 h-1.5 bg-grey-100 rounded-full">
                      <div className="h-full bg-blue rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top trip inviters */}
          <div className="border border-slate-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={14} className="text-teal" />
              <h3 className="text-sm font-semibold text-dark">Top trip inviters</h3>
            </div>
            <div className="space-y-3">
              {TOP_INVITERS.map((r, i) => {
                const pct = (r.invites / (TOP_INVITERS[0]?.invites ?? 1)) * 100;
                return (
                  <div key={r.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-grey-400 font-semibold text-right">{i + 1}</span>
                        <span className="font-mono text-dark font-medium">@{r.name}</span>
                      </div>
                      <div className="flex gap-3 text-grey-500">
                        <span>{r.invites} sent</span>
                        <span className="font-semibold text-teal-dark">{r.joined} joined</span>
                      </div>
                    </div>
                    <div className="ml-7 h-1.5 bg-grey-100 rounded-full">
                      <div className="h-full bg-teal rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
