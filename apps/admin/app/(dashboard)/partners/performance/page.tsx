"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";

type Partner = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  commission_rate: number;
  status: string;
  booking_commissions?: { commission_amount: number; status: string; booked_at: string }[];
};

type SortKey = "bookings" | "earned" | "pending" | "rate";

export default function PartnerPerformancePage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("bookings");

  useEffect(() => {
    fetch("/api/admin/partners")
      .then(r => r.json())
      .then(d => { setPartners(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const enriched = partners.map(p => {
    const bookings = p.booking_commissions?.length ?? 0;
    const earned   = p.booking_commissions?.filter(c => c.status === "paid").reduce((a, c) => a + (c.commission_amount ?? 0), 0) ?? 0;
    const pending  = p.booking_commissions?.filter(c => c.status === "pending").reduce((a, c) => a + (c.commission_amount ?? 0), 0) ?? 0;
    return { ...p, bookings, earned, pending };
  });

  const sorted = [...enriched].sort((a, b) => {
    if (sortBy === "bookings") return b.bookings - a.bookings;
    if (sortBy === "earned")   return b.earned - a.earned;
    if (sortBy === "pending")  return b.pending - a.pending;
    if (sortBy === "rate")     return b.commission_rate - a.commission_rate;
    return 0;
  });

  const maxBookings = sorted[0]?.bookings ?? 1;
  const totalCommission = sorted.reduce((a, p) => a + p.earned, 0);
  const totalBookings   = sorted.reduce((a, p) => a + p.bookings, 0);
  const activePartners  = sorted.filter(p => p.status === "active").length;

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "bookings", label: "Booking volume" },
    { key: "earned",   label: "Commission earned" },
    { key: "pending",  label: "Pending payout" },
    { key: "rate",     label: "Commission rate" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Partner Performance" description="Ranked overview of all booking partners by volume, commission, and status." />

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: "Active partners",      value: String(activePartners) },
          { label: "Total bookings",       value: totalBookings.toLocaleString() },
          { label: "Commission paid out",  value: formatCurrency(totalCommission), mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="border border-slate-200 rounded-lg p-6">
            <p className="text-xs text-grey-500 mb-1">{label}</p>
            <p className={`text-2xl font-normal text-slate-900 tracking-tight ${mono ? "font-mono" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sort + table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-100">
          <h2 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Ranked by</h2>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  sortBy === key ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-grey-500 text-sm">No partners found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide">
                <th className="text-left px-6 py-3 w-8">#</th>
                <th className="text-left px-6 py-3">Partner</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Region</th>
                <th className="text-right px-6 py-3">Bookings</th>
                <th className="text-right px-6 py-3">Earned</th>
                <th className="text-right px-6 py-3">Pending</th>
                <th className="text-right px-6 py-3">Rate</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const barPct = maxBookings > 0 ? (p.bookings / maxBookings) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-grey-400 font-semibold text-xs">{i + 1}</td>
                    <td className="px-6 py-3">
                      <button onClick={() => router.push(`/partners/${p.id}`)} className="font-medium text-blue hover:underline text-left">
                        {p.name}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-xs text-grey-700 capitalize">{p.type.replace(/_/g, " ")}</td>
                    <td className="px-6 py-3 text-xs text-grey-500">{p.region ?? "—"}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20 h-1.5 bg-grey-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="font-mono text-sm text-dark w-8 text-right">{p.bookings}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{formatCurrency(p.earned)}</td>
                    <td className="px-6 py-3 text-right font-mono text-grey-700">{formatCurrency(p.pending)}</td>
                    <td className="px-6 py-3 text-right font-semibold text-dark">{p.commission_rate}%</td>
                    <td className="px-6 py-3"><StatusBadge value={p.status} /></td>
                    <td className="px-6 py-3">
                      <button onClick={() => router.push(`/partners/${p.id}`)}
                        className="p-1 rounded-lg hover:bg-grey-100 text-grey-400 hover:text-dark transition">
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Onboarding pipeline stub */}
      <div className="border border-slate-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-teal" />
          <h3 className="text-sm font-semibold text-dark">Onboarding pipeline</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[
            { stage: "Contacted",   count: 12, color: "bg-slate-100 border-slate-200 text-slate-700" },
            { stage: "Demo booked", count: 7,  color: "bg-blue-light border-blue/20 text-blue" },
            { stage: "In review",   count: 4,  color: "bg-warning-light border-warning/20 text-warning" },
            { stage: "Agreement",   count: 2,  color: "bg-teal-light border-teal/20 text-teal-dark" },
            { stage: "Live",        count: activePartners, color: "bg-green-light border-green/20 text-green-dark" },
          ].map(({ stage, count, color }) => (
            <div key={stage} className={`shrink-0 border rounded-md px-4 py-3 min-w-[120px] ${color}`}>
              <p className="text-2xl font-bold tracking-tight">{count}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{stage}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
