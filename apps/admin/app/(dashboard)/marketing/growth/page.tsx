"use client";
import { PageHeader } from "@/components/shared/PageHeader";

// ─── Static data ──────────────────────────────────────────────────────────────

const FUNNEL = [
  { label: "Visited app",      value: 12400, pct: 100 },
  { label: "Signed up",        value: 3720,  pct: 30.0 },
  { label: "First trip planned",value: 2194,  pct: 17.7 },
  { label: "Invited a friend", value: 874,   pct: 7.1  },
  { label: "Made a booking",   value: 548,   pct: 4.4  },
  { label: "Subscribed",       value: 183,   pct: 1.5  },
];

// 6-month cohort retention (row = cohort month, col = month since join)
const COHORT_MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
const COHORT_DATA = [
  { cohort: "Nov", m0: 100, m1: 62, m2: 44, m3: 38, m4: 31, m5: 28 },
  { cohort: "Dec", m0: 100, m1: 58, m2: 41, m3: 35, m4: 29, m5: null },
  { cohort: "Jan", m0: 100, m1: 65, m2: 47, m3: 42, m4: null, m5: null },
  { cohort: "Feb", m0: 100, m1: 71, m2: 52, m3: null, m4: null, m5: null },
  { cohort: "Mar", m0: 100, m1: 68, m2: null, m3: null, m4: null, m5: null },
  { cohort: "Apr", m0: 100, m1: null, m2: null, m3: null, m4: null, m5: null },
];

const VIRAL_METRICS = [
  { metric: "K-factor (overall)",       value: "0.31",    trend: "+0.04" },
  { metric: "K-factor (invitations)",   value: "0.29",    trend: "+0.06" },
  { metric: "Avg invites per user",     value: "4.2",     trend: "+0.8" },
  { metric: "Referral conversion rate", value: "12%",     trend: "+1.2%" },
  { metric: "Invitation conversion rate",value: "29%",    trend: "+3.1%" },
  { metric: "Time to first invite",     value: "4.8 days",trend: "-0.7d" },
  { metric: "Viral chain depth (avg)",  value: "3.2 hops",trend: "+0.4" },
];

const CHANNEL_ATTRIBUTION = [
  { source: "Trip Invitation", signups: 531,  first_trip: "81%", invite_rate: "78%", paid_conv: "14%", ltv_est: "€47" },
  { source: "Organic search",  signups: 1204, first_trip: "54%", invite_rate: "31%", paid_conv: "8%",  ltv_est: "€28" },
  { source: "Referral code",   signups: 312,  first_trip: "67%", invite_rate: "52%", paid_conv: "11%", ltv_est: "€34" },
  { source: "Social — TikTok", signups: 418,  first_trip: "43%", invite_rate: "28%", paid_conv: "6%",  ltv_est: "€21" },
  { source: "Social — IG",     signups: 287,  first_trip: "49%", invite_rate: "33%", paid_conv: "9%",  ltv_est: "€26" },
  { source: "Email campaign",  signups: 193,  first_trip: "72%", invite_rate: "44%", paid_conv: "13%", ltv_est: "€41" },
  { source: "Direct / other",  signups: 774,  first_trip: "38%", invite_rate: "21%", paid_conv: "5%",  ltv_est: "€18" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cohortColor(val: number | null): string {
  if (val === null) return "bg-grey-50 text-grey-300";
  if (val >= 40) return "bg-green-light text-green-dark";
  if (val >= 20) return "bg-warning-light text-warning";
  return "bg-danger-light text-danger";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Growth Analytics" description="Acquisition funnel, cohort retention, viral metrics, and channel attribution." />

      {/* ── Acquisition funnel ── */}
      <div className="border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-6">Acquisition funnel</h2>
        <div className="space-y-3">
          {FUNNEL.map((step, i) => (
            <div key={step.label}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-teal-bg text-teal text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-medium text-dark">{step.label}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-semibold text-dark">{step.value.toLocaleString()}</span>
                  <span className="text-grey-500 w-10 text-right">{step.pct}%</span>
                </div>
              </div>
              <div className="ml-8 h-2.5 bg-grey-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${i === 0 ? "bg-teal" : i < 3 ? "bg-blue" : "bg-blend"}`}
                  style={{ width: `${step.pct}%` }}
                />
              </div>
              {i < FUNNEL.length - 1 && (
                <div className="ml-8 mt-1 text-[10px] text-grey-400">
                  Drop-off: {(100 - ((FUNNEL[i + 1]?.value ?? 0) / step.value * 100)).toFixed(1)}% lost here
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Cohort retention ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Cohort retention — % still active</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-100">
                <th className="text-left px-6 py-3 text-xs text-grey-500 font-semibold uppercase tracking-wide">Cohort</th>
                {["Month 0", "Month 1", "Month 2", "Month 3", "Month 4", "Month 5"].map(m => (
                  <th key={m} className="text-center px-3 py-3 text-xs text-grey-500 font-semibold uppercase tracking-wide">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COHORT_DATA.map(row => (
                <tr key={row.cohort} className="border-b border-grey-50">
                  <td className="px-6 py-2.5 font-semibold text-dark text-sm">{row.cohort}</td>
                  {([row.m0, row.m1, row.m2, row.m3, row.m4, row.m5] as (number | null)[]).map((val, ci) => (
                    <td key={ci} className="px-3 py-2.5">
                      <div className={`mx-auto w-14 h-9 rounded-lg flex items-center justify-center text-xs font-semibold ${cohortColor(val)}`}>
                        {val != null ? `${val}%` : "—"}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 flex items-center gap-4 border-t border-grey-100">
          {[
            { label: ">40% retained", color: "bg-green-light" },
            { label: "20–40%",         color: "bg-warning-light" },
            { label: "<20%",           color: "bg-danger-light" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${color}`} />
              <span className="text-xs text-grey-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Viral metrics ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Viral metrics</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide">
              <th className="text-left px-6 py-3">Metric</th>
              <th className="text-right px-6 py-3">Value</th>
              <th className="text-right px-6 py-3">vs last month</th>
            </tr>
          </thead>
          <tbody>
            {VIRAL_METRICS.map(row => {
              const positive = !row.trend.startsWith("-");
              return (
                <tr key={row.metric} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-dark">{row.metric}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{row.value}</td>
                  <td className={`px-6 py-3 text-right text-xs font-semibold ${positive ? "text-green-dark" : "text-danger"}`}>
                    {row.trend}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Channel attribution ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Channel attribution</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide">
              <th className="text-left px-6 py-3">Source</th>
              <th className="text-right px-6 py-3">Signups</th>
              <th className="text-right px-6 py-3">First trip rate</th>
              <th className="text-right px-6 py-3">Invite rate</th>
              <th className="text-right px-6 py-3">Paid conv.</th>
              <th className="text-right px-6 py-3">LTV est.</th>
            </tr>
          </thead>
          <tbody>
            {CHANNEL_ATTRIBUTION.map(row => (
              <tr key={row.source} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 font-medium text-dark">{row.source}</td>
                <td className="px-6 py-3 text-right font-mono text-grey-700">{row.signups.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.first_trip}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.invite_rate}</td>
                <td className="px-6 py-3 text-right text-grey-700">{row.paid_conv}</td>
                <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{row.ltv_est}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
