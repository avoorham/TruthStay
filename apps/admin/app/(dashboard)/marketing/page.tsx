"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  applies_to: string | null;
  max_redemptions: number | null;
  times_used: number;
  is_active: boolean;
  valid_until: string | null;
  created_at: string;
};

type ReferralCode = {
  id: string;
  code: string;
  referrer_id: string | null;
  created_at: string;
  referral_conversions?: { id: string; status: string }[];
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
};

type Tab = "promos" | "referrals" | "campaigns";

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("promos");
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [referrals, setReferrals] = useState<ReferralCode[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: "", discount_type: "percentage", discount_value: "", description: "" });

  async function load() {
    setLoading(true);
    const [p, r, c] = await Promise.all([
      fetch("/api/admin/marketing/promos").then((x) => x.json()),
      fetch("/api/admin/marketing/referrals").then((x) => x.json()),
      fetch("/api/admin/marketing/campaigns").then((x) => x.json()),
    ]);
    setPromos(p);
    setReferrals(r);
    setCampaigns(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function togglePromo(id: string, is_active: boolean) {
    await fetch(`/api/admin/marketing/promos/${id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !is_active }),
    });
    setPromos((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !is_active } : p));
  }

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/marketing/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newPromo, discount_value: Number(newPromo.discount_value) }),
    });
    setNewPromo({ code: "", discount_type: "percentage", discount_value: "", description: "" });
    setShowPromoForm(false);
    load();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "promos", label: "Promo Codes" },
    { key: "referrals", label: "Referrals" },
    { key: "campaigns", label: "Email Campaigns" },
  ];

  const promoColumns: ColumnDef<PromoCode, any>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono font-semibold text-sm">{getValue<string>()}</span> },
    { accessorKey: "description", header: "Description", cell: ({ getValue }) => <span className="text-xs text-grey-700 max-w-[160px] truncate block">{getValue<string | null>() || "—"}</span> },
    {
      id: "discount",
      header: "Discount",
      accessorFn: (r) => r.discount_value,
      cell: ({ row }) => (
        <span className="text-sm font-semibold">
          {row.original.discount_type === "percentage" ? `${row.original.discount_value}%` : `€${row.original.discount_value}`}
        </span>
      ),
    },
    { accessorKey: "times_used", header: "Used", cell: ({ getValue }) => <span className="text-sm">{getValue<number>()}</span> },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <button onClick={() => togglePromo(row.original.id, row.original.is_active)} className="text-grey-700 hover:text-blue transition">
          {row.original.is_active ? <ToggleRight size={20} className="text-green" /> : <ToggleLeft size={20} />}
        </button>
      ),
    },
    { accessorKey: "valid_until", header: "Expires", cell: ({ getValue }) => <span className="text-xs text-grey-700">{getValue<string | null>() ? formatDate(getValue<string>()) : "Never"}</span> },
  ];

  const referralColumns: ColumnDef<ReferralCode, any>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono font-semibold text-sm">{getValue<string>()}</span> },
    {
      id: "conversions",
      header: "Conversions",
      accessorFn: (r) => r.referral_conversions?.length ?? 0,
      cell: ({ getValue }) => <span className="text-sm">{getValue<number>()}</span>,
    },
    { accessorKey: "created_at", header: "Created", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span> },
  ];

  const campaignColumns: ColumnDef<Campaign, any>[] = [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="text-sm font-medium">{getValue<string>()}</span> },
    { accessorKey: "subject", header: "Subject", cell: ({ getValue }) => <span className="text-xs text-grey-700 max-w-[200px] truncate block">{getValue<string>()}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge value={getValue<string>()} /> },
    { accessorKey: "scheduled_at", header: "Scheduled", cell: ({ getValue }) => <span className="text-xs text-grey-700">{getValue<string | null>() ? formatDate(getValue<string>()) : "—"}</span> },
    { accessorKey: "created_at", header: "Created", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing"
        description="Promo codes, referral links, and email campaigns."
        actions={
          tab === "promos" && (
            <button
              onClick={() => setShowPromoForm(!showPromoForm)}
              className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition"
            >
              <Plus size={14} /> New promo
            </button>
          )
        }
      />

      {/* Promo form */}
      {showPromoForm && (
        <form onSubmit={createPromo} className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-dark text-sm">Create promo code</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Code *</label>
              <input required value={newPromo.code} onChange={(e) => setNewPromo((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Description</label>
              <input value={newPromo.description} onChange={(e) => setNewPromo((p) => ({ ...p, description: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Discount type *</label>
              <select value={newPromo.discount_type} onChange={(e) => setNewPromo((p) => ({ ...p, discount_type: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Value *</label>
              <input required type="number" min="0" value={newPromo.discount_value} onChange={(e) => setNewPromo((p) => ({ ...p, discount_value: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">Create</button>
            <button type="button" onClick={() => setShowPromoForm(false)} className="text-sm text-grey-700 px-4 py-2 hover:text-dark">Cancel</button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-grey-300">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${tab === key ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div> : (
        <>
          {tab === "promos" && <DataTable data={promos} columns={promoColumns} searchKey="code" searchPlaceholder="Search codes…" />}
          {tab === "referrals" && <DataTable data={referrals} columns={referralColumns} searchKey="code" searchPlaceholder="Search codes…" />}
          {tab === "campaigns" && <DataTable data={campaigns} columns={campaignColumns} searchKey="name" searchPlaceholder="Search campaigns…" />}
        </>
      )}
    </div>
  );
}
