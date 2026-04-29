"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Mail, Percent, Edit2, Save, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Partner = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  contact_email: string | null;
  commission_rate: number;
  status: string;
  notes: string | null;
  created_at: string;
  booking_commissions?: { id: string; commission_amount: number; status: string; booked_at: string }[];
};

// ─── Revenue chart helper ─────────────────────────────────────────────────────

function last6Months(): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

const TOOLTIP_STYLE = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor: { fill: "rgba(45,212,191,0.06)" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ commission_rate: "", notes: "", status: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/partners/${id}`)
      .then(r => r.json())
      .then(d => {
        setPartner(d);
        setEditForm({ commission_rate: String(d.commission_rate), notes: d.notes ?? "", status: d.status });
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commission_rate: Number(editForm.commission_rate),
        notes: editForm.notes,
        status: editForm.status,
      }),
    });
    setPartner(p => p ? {
      ...p,
      commission_rate: Number(editForm.commission_rate),
      notes: editForm.notes,
      status: editForm.status,
    } : p);
    setSaving(false);
    setEditing(false);
  }

  if (loading) return <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>;
  if (!partner) return <div className="text-center py-20 text-grey-500 text-sm">Partner not found.</div>;

  // Revenue chart
  const months = last6Months();
  const commByMonth: Record<string, number> = {};
  for (const c of partner.booking_commissions ?? []) {
    const key = c.booked_at?.slice(0, 7);
    if (key) commByMonth[key] = (commByMonth[key] ?? 0) + (c.commission_amount ?? 0);
  }
  const chartData = months.map(m => ({ month: monthLabel(m), commission: commByMonth[m] ?? 0 }));

  const totalEarned = (partner.booking_commissions ?? [])
    .filter(c => c.status === "paid")
    .reduce((acc, c) => acc + (c.commission_amount ?? 0), 0);
  const pendingComm = (partner.booking_commissions ?? [])
    .filter(c => c.status === "pending")
    .reduce((acc, c) => acc + (c.commission_amount ?? 0), 0);
  const totalBookings = partner.booking_commissions?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={partner.name}
        description={`${partner.type.replace(/_/g, " ")} · ${partner.region ?? "No region"}`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 border border-grey-300 text-grey-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-grey-100 transition">
              <ArrowLeft size={14} /> Back
            </button>
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-teal-dark transition disabled:opacity-60">
                  <Save size={14} /> {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 border border-grey-300 text-grey-700 text-sm px-3 py-2 rounded-lg hover:bg-grey-100 transition">
                  <X size={14} /> Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-dark transition">
                <Edit2 size={14} /> Edit
              </button>
            )}
          </div>
        }
      />

      {/* ── Profile + KPIs ── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-light flex items-center justify-center text-blue font-bold text-lg shrink-0">
              {partner.name[0]}
            </div>
            <div>
              <p className="font-semibold text-dark">{partner.name}</p>
              <p className="text-xs text-grey-500 capitalize">{partner.type.replace(/_/g, " ")}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {partner.region && (
              <div className="flex items-center gap-2 text-grey-700">
                <MapPin size={13} className="text-grey-400 shrink-0" />
                <span>{partner.region}</span>
              </div>
            )}
            {partner.contact_email && (
              <div className="flex items-center gap-2 text-grey-700">
                <Mail size={13} className="text-grey-400 shrink-0" />
                <span className="text-xs">{partner.contact_email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-grey-700">
              <Percent size={13} className="text-grey-400 shrink-0" />
              {editing ? (
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={editForm.commission_rate}
                  onChange={e => setEditForm(f => ({ ...f, commission_rate: e.target.value }))}
                  className="w-20 border border-grey-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue/60"
                />
              ) : (
                <span>{partner.commission_rate}% commission</span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-grey-100">
            {editing ? (
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-grey-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue/60"
                >
                  {["active", "inactive", "suspended", "pending"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-grey-500">Status</span>
                <StatusBadge value={partner.status} />
              </div>
            )}
          </div>

          <div className="text-xs text-grey-400">Added {formatDate(partner.created_at)}</div>
        </div>

        {/* KPI cards */}
        <div className="col-span-2 grid grid-cols-3 gap-4 content-start">
          {[
            { label: "Total bookings",    value: String(totalBookings),       sub: "all time" },
            { label: "Commission earned", value: formatCurrency(totalEarned), sub: "paid", mono: true },
            { label: "Pending payout",    value: formatCurrency(pendingComm), sub: "to be paid", mono: true },
          ].map(({ label, value, sub, mono }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs text-grey-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold text-dark tracking-tight ${mono ? "font-mono" : ""}`}>{value}</p>
              <p className="text-xs text-grey-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Revenue chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-6">Commission revenue — last 6 months</h3>
        <div className="h-[220px]">
          {totalBookings === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-sm text-grey-500">No booking history yet.</p>
              <p className="text-xs text-grey-400 mt-1">Revenue will appear once bookings are recorded.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="commission" name="Commission" fill="#0A7AFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Booking history ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-100">
          <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest">Booking history</h3>
        </div>
        {(partner.booking_commissions?.length ?? 0) === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-grey-500">No bookings recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-100 text-xs text-grey-500 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-right px-6 py-3">Commission</th>
                <th className="text-left px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {partner.booking_commissions?.slice(0, 20).map(c => (
                <tr key={c.id} className="border-b border-grey-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-grey-700 text-xs">{formatDate(c.booked_at)}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-dark">{formatCurrency(c.commission_amount)}</td>
                  <td className="px-6 py-3"><StatusBadge value={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-3">Notes</h3>
        {editing ? (
          <textarea
            value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
            rows={4}
            placeholder="Add internal notes about this partner…"
            className="w-full border border-grey-300 rounded-xl px-3 py-2 text-sm text-grey-700 focus:outline-none focus:border-blue/60 resize-none"
          />
        ) : (
          partner.notes
            ? <p className="text-sm text-grey-700 leading-relaxed">{partner.notes}</p>
            : <p className="text-sm text-grey-400 italic">No notes yet. Click Edit to add internal notes.</p>
        )}
      </div>
    </div>
  );
}
