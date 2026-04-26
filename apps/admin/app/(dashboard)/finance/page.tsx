"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DollarSign, CreditCard, TrendingUp, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KPICard } from "@/components/shared/KPICard";
import { formatDate, formatCurrency } from "@/lib/utils";

type Subscription = {
  id: string;
  status: string;
  created_at: string;
  users?: { email: string; full_name: string | null } | null;
  subscription_plans?: { name: string; price_monthly: number } | null;
};

type Commission = {
  id: string;
  commission_amount: number;
  status: string;
  booked_at: string;
  booking_partners?: { name: string } | null;
};

type ApiCost = {
  id: string;
  provider: string;
  model: string | null;
  tokens_used: number | null;
  cost_usd: number;
  created_at: string;
};

type Tab = "subscriptions" | "commissions" | "costs";

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("subscriptions");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [costs, setCosts] = useState<ApiCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/finance/subscriptions").then((r) => r.json()),
      fetch("/api/admin/finance/commissions").then((r) => r.json()),
      fetch("/api/admin/finance/costs").then((r) => r.json()),
    ]).then(([s, c, a]) => {
      setSubscriptions(s);
      setCommissions(c);
      setCosts(a);
      setLoading(false);
    });
  }, []);

  const activeSubCount = subscriptions.filter((s) => s.status === "active").length;
  const totalCommissions = commissions.reduce((acc, c) => acc + (c.commission_amount ?? 0), 0);
  const totalApiCost = costs.reduce((acc, c) => acc + (c.cost_usd ?? 0), 0);

  const subColumns: ColumnDef<Subscription, any>[] = [
    {
      id: "user",
      header: "User",
      accessorFn: (r) => r.users?.email ?? "",
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium text-dark">{row.original.users?.full_name || "—"}</div>
          <div className="text-xs text-grey-700">{row.original.users?.email}</div>
        </div>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      accessorFn: (r) => r.subscription_plans?.name ?? "",
      cell: ({ row }) => <span className="text-sm">{row.original.subscription_plans?.name ?? "—"}</span>,
    },
    {
      id: "price",
      header: "Monthly",
      accessorFn: (r) => r.subscription_plans?.price_monthly ?? 0,
      cell: ({ row }) => {
        const p = row.original.subscription_plans?.price_monthly;
        return <span className="text-sm">{p != null ? formatCurrency(p) : "—"}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      accessorKey: "created_at",
      header: "Started",
      cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span>,
    },
  ];

  const commissionColumns: ColumnDef<Commission, any>[] = [
    {
      id: "partner",
      header: "Partner",
      accessorFn: (r) => r.booking_partners?.name ?? "",
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.booking_partners?.name ?? "—"}</span>,
    },
    {
      accessorKey: "commission_amount",
      header: "Amount",
      cell: ({ getValue }) => <span className="text-sm font-semibold text-dark">{formatCurrency(getValue<number>())}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      accessorKey: "booked_at",
      header: "Booked",
      cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span>,
    },
  ];

  const costColumns: ColumnDef<ApiCost, any>[] = [
    { accessorKey: "provider", header: "Provider", cell: ({ getValue }) => <span className="text-sm capitalize">{getValue<string>()}</span> },
    { accessorKey: "model", header: "Model", cell: ({ getValue }) => <span className="text-xs text-grey-700">{getValue<string | null>() || "—"}</span> },
    {
      accessorKey: "tokens_used",
      header: "Tokens",
      cell: ({ getValue }) => <span className="text-sm">{getValue<number | null>()?.toLocaleString() ?? "—"}</span>,
    },
    {
      accessorKey: "cost_usd",
      header: "Cost",
      cell: ({ getValue }) => <span className="text-sm font-semibold">{formatCurrency(getValue<number>())}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span>,
    },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: "subscriptions", label: "Subscriptions" },
    { key: "commissions", label: "Commissions" },
    { key: "costs", label: "API Costs" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Finance" description="Revenue, commissions, and API cost tracking." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Active subscriptions" value={activeSubCount} icon={CreditCard} />
        <KPICard label="Total subscriptions" value={subscriptions.length} icon={TrendingUp} />
        <KPICard label="Commission earned" value={formatCurrency(totalCommissions)} icon={DollarSign} />
        <KPICard label="API costs (all time)" value={formatCurrency(totalApiCost)} icon={Zap} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-grey-300">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === key ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : (
        <>
          {tab === "subscriptions" && <DataTable data={subscriptions} columns={subColumns} searchKey="user" searchPlaceholder="Search by email…" />}
          {tab === "commissions" && <DataTable data={commissions} columns={commissionColumns} searchKey="partner" searchPlaceholder="Search by partner…" />}
          {tab === "costs" && <DataTable data={costs} columns={costColumns} searchKey="provider" searchPlaceholder="Search by provider…" />}
        </>
      )}
    </div>
  );
}
