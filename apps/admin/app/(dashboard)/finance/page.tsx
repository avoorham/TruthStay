"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { CreditCard, TrendingUp, DollarSign, BarChart3, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Subscription = {
  id: string; status: string; created_at: string;
  users?: { email: string; full_name: string | null } | null;
  subscription_plans?: { name: string; price_monthly: number } | null;
};
type Commission = {
  id: string; commission_amount: number; status: string; booked_at: string;
  booking_partners?: { name: string } | null;
};
type ApiCost = {
  id: string; provider: string; model: string | null;
  tokens_used: number | null; cost_usd: number; created_at: string;
};

type Tab = "revenue" | "costs" | "cashflow" | "forecast";
type TimeRange = "7D" | "1M" | "3M" | "6M" | "1Y";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function last12Months(): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    return d.toISOString().slice(0, 7);
  });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

function groupByMonth(items: { date: string; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { date, value } of items) {
    const key = date?.slice(0, 7);
    if (key) out[key] = (out[key] ?? 0) + value;
  }
  return out;
}

function linearForecast(monthlyValues: number[], steps: number): number[] {
  const n = monthlyValues.length;
  if (n < 2) return Array(steps).fill(monthlyValues[0] ?? 0);
  const xs = monthlyValues.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = monthlyValues.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((acc, x, i) => acc + (x - xMean) * ((monthlyValues[i] ?? 0) - yMean), 0);
  const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  return Array.from({ length: steps }, (_, i) => Math.max(0, yMean + slope * (n + i - xMean)));
}

function nextNMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i + 1);
    return d.toISOString().slice(0, 7);
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const CHART = {
  revenue:   "#22C55E",
  cost:      "#EF4444",
  net:       "#2DD4BF",
  projected: "#94A3B8",
  grid:      "#E2E8F0",
};

const TOOLTIP = {
  contentStyle: {
    fontSize: 12, borderRadius: 10, border: "none",
    background: "#0F172A", color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  itemStyle: { color: "#94A3B8" },
  cursor: { fill: "rgba(148,163,184,0.06)" },
};

// ─── Shared: KPI row for each tab ─────────────────────────────────────────────

function FinanceKPIRow({ stats }: {
  stats: { label: string; value: string; positive?: boolean; negative?: boolean }[]
}) {
  return (
    <div className={`grid gap-6 mb-8`} style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
      {stats.map((s) => (
        <div key={s.label} className="border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
          <p className={`text-2xl font-normal font-mono ${
            s.negative ? "text-red-600" : s.positive ? "text-green-600" : "text-slate-900"
          }`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Shared: Empty state ──────────────────────────────────────────────────────

function EmptyState({ icon: Icon, heading, body }: {
  icon: React.ElementType; heading: string; body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-900 mb-1">{heading}</p>
      <p className="text-sm text-slate-500">{body}</p>
    </div>
  );
}

// ─── Shared: Chart wrapper ────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg p-6 mb-8">
      <p className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-6">{title}</p>
      <div className="h-[400px]">
        {children}
      </div>
    </div>
  );
}

// ─── Tab: Revenue ─────────────────────────────────────────────────────────────

function RevenueTab({ subscriptions, commissions }: { subscriptions: Subscription[]; commissions: Commission[] }) {
  const months = last12Months();

  const subByMonth = groupByMonth(
    subscriptions.filter(s => s.status === "active")
      .map(s => ({ date: s.created_at, value: s.subscription_plans?.price_monthly ?? 0 }))
  );
  const commByMonth = groupByMonth(
    commissions.map(c => ({ date: c.booked_at, value: c.commission_amount ?? 0 }))
  );

  const chartData = months.map(m => ({
    month: monthLabel(m),
    subscriptions: subByMonth[m] ?? 0,
    commissions: commByMonth[m] ?? 0,
    total: (subByMonth[m] ?? 0) + (commByMonth[m] ?? 0),
  }));

  const activeSubs = subscriptions.filter(s => s.status === "active");
  const mrr        = activeSubs.reduce((acc, s) => acc + (s.subscription_plans?.price_monthly ?? 0), 0);
  const totalComm  = commissions.reduce((acc, c) => acc + (c.commission_amount ?? 0), 0);

  const subColumns: ColumnDef<Subscription, any>[] = [
    {
      id: "user", header: "User", accessorFn: r => r.users?.email ?? "",
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium text-dark">{row.original.users?.full_name || "—"}</div>
          <div className="text-xs text-grey-500">{row.original.users?.email}</div>
        </div>
      ),
    },
    {
      id: "plan", header: "Plan", accessorFn: r => r.subscription_plans?.name ?? "",
      cell: ({ row }) => <span className="text-sm">{row.original.subscription_plans?.name ?? "—"}</span>,
    },
    {
      id: "price", header: "Monthly", accessorFn: r => r.subscription_plans?.price_monthly ?? 0,
      cell: ({ row }) => {
        const p = row.original.subscription_plans?.price_monthly;
        return <span className="text-sm font-semibold font-mono">{p != null ? formatCurrency(p) : "—"}</span>;
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge value={getValue<string>()} /> },
    {
      accessorKey: "created_at", header: "Started",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDate(getValue<string>())}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <FinanceKPIRow stats={[
        { label: "MRR",                value: formatCurrency(mrr),      positive: mrr > 0 },
        { label: "ARR (projected)",    value: formatCurrency(mrr * 12), positive: mrr > 0 },
        { label: "Active subscriptions", value: String(activeSubs.length) },
        { label: "Commission income",  value: formatCurrency(totalComm), positive: totalComm > 0 },
      ]} />

      <ChartCard title="Revenue — last 12 months">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="0" stroke={CHART.grid} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
            <Bar dataKey="subscriptions" name="Subscriptions" fill={CHART.revenue} radius={[4, 4, 0, 0]} barSize={18} fillOpacity={0.85} />
            <Bar dataKey="commissions"   name="Commissions"   fill="#6366F1"       radius={[4, 4, 0, 0]} barSize={18} />
            <Line dataKey="total" name="Total" stroke={CHART.net} strokeWidth={2.5} dot={{ r: 3, fill: CHART.net }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div>
        <h3 className="text-sm font-medium text-slate-900 mb-4">Subscriptions</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {subscriptions.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              heading="No subscriptions yet"
              body="Subscriptions will appear here once users sign up for paid plans."
            />
          ) : (
            <div className="p-4">
              <DataTable data={subscriptions} columns={subColumns} searchKey="user" searchPlaceholder="Search by email…" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Costs ───────────────────────────────────────────────────────────────

function CostsTab({ costs, commissions }: { costs: ApiCost[]; commissions: Commission[] }) {
  const months = last12Months();

  const apiByMonth  = groupByMonth(costs.map(c => ({ date: c.created_at, value: c.cost_usd ?? 0 })));
  const commByMonth = groupByMonth(commissions.map(c => ({ date: c.booked_at, value: c.commission_amount ?? 0 })));

  const chartData = months.map(m => ({
    month: monthLabel(m),
    api:         apiByMonth[m]  ?? 0,
    commissions: commByMonth[m] ?? 0,
    total: (apiByMonth[m] ?? 0) + (commByMonth[m] ?? 0),
  }));

  const totalApi  = costs.reduce((acc, c) => acc + (c.cost_usd ?? 0), 0);
  const totalComm = commissions.reduce((acc, c) => acc + (c.commission_amount ?? 0), 0);

  const costColumns: ColumnDef<ApiCost, any>[] = [
    { accessorKey: "provider",    header: "Provider", cell: ({ getValue }) => <span className="text-sm capitalize">{getValue<string>()}</span> },
    { accessorKey: "model",       header: "Model",    cell: ({ getValue }) => <span className="text-xs text-grey-500">{getValue<string | null>() || "—"}</span> },
    { accessorKey: "tokens_used", header: "Tokens",   cell: ({ getValue }) => <span className="text-sm font-mono">{getValue<number | null>()?.toLocaleString() ?? "—"}</span> },
    { accessorKey: "cost_usd",    header: "Cost",     cell: ({ getValue }) => <span className="text-sm font-semibold font-mono text-danger">{formatCurrency(getValue<number>())}</span> },
    { accessorKey: "created_at",  header: "Date",     cell: ({ getValue }) => <span className="text-xs text-grey-500">{formatDate(getValue<string>())}</span> },
  ];

  return (
    <div className="space-y-8">
      <FinanceKPIRow stats={[
        { label: "Total API costs",        value: formatCurrency(totalApi),              negative: totalApi > 0 },
        { label: "Total commissions paid", value: formatCurrency(totalComm),             negative: totalComm > 0 },
        { label: "Total costs",            value: formatCurrency(totalApi + totalComm),  negative: (totalApi + totalComm) > 0 },
        { label: "API calls logged",       value: String(costs.length) },
      ]} />

      <ChartCard title="Costs — last 12 months">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} barGap={4}>
            <CartesianGrid stroke={CHART.grid} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
            <Bar dataKey="api"         name="API costs"   fill={CHART.cost}  radius={[4, 4, 0, 0]} barSize={18} fillOpacity={0.8} />
            <Bar dataKey="commissions" name="Commissions" fill="#F59E0B"     radius={[4, 4, 0, 0]} barSize={18} />
            <Line dataKey="total" name="Total" stroke="#6B7280" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div>
        <h3 className="text-sm font-medium text-slate-900 mb-4">API Cost Log</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {costs.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              heading="No API costs recorded"
              body="API cost entries will appear here as the platform makes AI and infrastructure calls."
            />
          ) : (
            <div className="p-4">
              <DataTable data={costs} columns={costColumns} searchKey="provider" searchPlaceholder="Search by provider…" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Cash Flow ───────────────────────────────────────────────────────────

function CashFlowTab({ subscriptions, commissions, costs }: {
  subscriptions: Subscription[]; commissions: Commission[]; costs: ApiCost[];
}) {
  const months = last12Months();

  const revByMonth = groupByMonth([
    ...subscriptions.filter(s => s.status === "active").map(s => ({ date: s.created_at, value: s.subscription_plans?.price_monthly ?? 0 })),
    ...commissions.map(c => ({ date: c.booked_at, value: c.commission_amount ?? 0 })),
  ]);
  const costByMonth = groupByMonth(costs.map(c => ({ date: c.created_at, value: c.cost_usd ?? 0 })));

  const chartData = months.map(m => {
    const rev  = revByMonth[m]  ?? 0;
    const cost = costByMonth[m] ?? 0;
    return { month: monthLabel(m), revenue: rev, costs: cost, net: rev - cost };
  });

  const totalRev  = chartData.reduce((a, d) => a + d.revenue, 0);
  const totalCost = chartData.reduce((a, d) => a + d.costs, 0);
  const netFlow   = totalRev - totalCost;
  const avgMonthly = netFlow / 12;

  const tableData = months.map(m => ({
    month: m,
    revenue: revByMonth[m]  ?? 0,
    costs:   costByMonth[m] ?? 0,
    net:    (revByMonth[m]  ?? 0) - (costByMonth[m] ?? 0),
  })).reverse();

  return (
    <div className="space-y-8">
      <FinanceKPIRow stats={[
        { label: "Total income (12mo)", value: formatCurrency(totalRev),  positive: totalRev > 0 },
        { label: "Total costs (12mo)",  value: formatCurrency(totalCost), negative: totalCost > 0 },
        { label: "Net cash flow",       value: formatCurrency(netFlow),   positive: netFlow > 0, negative: netFlow < 0 },
        { label: "Avg / month",         value: formatCurrency(avgMonthly), positive: avgMonthly > 0, negative: avgMonthly < 0 },
      ]} />

      <ChartCard title="Cash flow — last 12 months">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} barGap={4}>
            <CartesianGrid stroke={CHART.grid} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <ReferenceLine y={0} stroke="#CBD5E1" strokeWidth={1} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
            <Bar dataKey="revenue" name="Revenue"  fill={CHART.revenue} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.85} />
            <Bar dataKey="costs"   name="Expenses" fill={CHART.cost}    radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.7} />
            <Line dataKey="net" name="Net cash flow" stroke={CHART.net} strokeWidth={2.5} dot={{ r: 3, fill: CHART.net }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div>
        <h3 className="text-sm font-medium text-slate-900 mb-4">Monthly breakdown</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Month</th>
                <th className="text-right px-6 py-3">Revenue</th>
                <th className="text-right px-6 py-3">Expenses</th>
                <th className="text-right px-6 py-3">Net cash flow</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon={Wallet} heading="No transactions yet" body="Monthly cash flow will appear here once revenue and costs are recorded." />
                  </td>
                </tr>
              ) : tableData.map((row) => (
                <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-0">
                  <td className="px-6 py-3 font-medium text-dark">{monthLabel(row.month)}</td>
                  <td className="px-6 py-3 text-right font-mono text-green-600 font-semibold">{formatCurrency(row.revenue)}</td>
                  <td className="px-6 py-3 text-right font-mono text-danger">{formatCurrency(row.costs)}</td>
                  <td className={`px-6 py-3 text-right font-mono font-bold ${row.net >= 0 ? "text-green-600" : "text-danger"}`}>
                    {formatCurrency(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Forecast ────────────────────────────────────────────────────────────

function ForecastTab({ subscriptions, commissions, costs }: {
  subscriptions: Subscription[]; commissions: Commission[]; costs: ApiCost[];
}) {
  const histMonths = last12Months();
  const fwdMonths  = nextNMonths(6);

  const revByMonth  = groupByMonth([
    ...subscriptions.filter(s => s.status === "active").map(s => ({ date: s.created_at, value: s.subscription_plans?.price_monthly ?? 0 })),
    ...commissions.map(c => ({ date: c.booked_at, value: c.commission_amount ?? 0 })),
  ]);
  const costByMonth = groupByMonth(costs.map(c => ({ date: c.created_at, value: c.cost_usd ?? 0 })));

  const histRevValues  = histMonths.map(m => revByMonth[m]  ?? 0);
  const histCostValues = histMonths.map(m => costByMonth[m] ?? 0);

  const projRev  = linearForecast(histRevValues,  6);
  const projCost = linearForecast(histCostValues, 6);

  const histData = histMonths.map((m, i) => ({
    month: monthLabel(m), revenue: histRevValues[i] ?? 0, costs: histCostValues[i] ?? 0,
    net: (histRevValues[i] ?? 0) - (histCostValues[i] ?? 0),
    type: "actual" as const,
  }));

  const fwdData = fwdMonths.map((m, i) => ({
    month: monthLabel(m),
    projRevenue: Math.round(projRev[i] ?? 0),
    projCosts:   Math.round(projCost[i] ?? 0),
    projNet:     Math.round((projRev[i] ?? 0) - (projCost[i] ?? 0)),
    type: "projected" as const,
  }));

  const chartData = [
    ...histData,
    { ...fwdData[0], revenue: histRevValues[histRevValues.length - 1], costs: histCostValues[histCostValues.length - 1] },
    ...fwdData.slice(1),
  ];

  const nextMonthRev  = projRev[0]  ?? 0;
  const nextMonthCost = projCost[0] ?? 0;
  const nextMonthNet  = nextMonthRev - nextMonthCost;
  const sixMonthRev   = projRev.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <FinanceKPIRow stats={[
        { label: "Projected next month revenue", value: formatCurrency(nextMonthRev),  positive: nextMonthRev > 0 },
        { label: "Projected next month costs",   value: formatCurrency(nextMonthCost), negative: nextMonthCost > 0 },
        { label: "Projected next month net",     value: formatCurrency(nextMonthNet),  positive: nextMonthNet > 0, negative: nextMonthNet < 0 },
        { label: "6-month revenue forecast",     value: formatCurrency(sixMonthRev),   positive: sixMonthRev > 0 },
      ]} />

      <div className="border border-slate-200 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Revenue &amp; cost forecast — next 6 months</p>
          <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-1">Linear trend projection</span>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barGap={4}>
              <CartesianGrid stroke={CHART.grid} vertical={false} strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
              <ReferenceLine y={0} stroke="#CBD5E1" />
              <Tooltip {...TOOLTIP} formatter={(v: number) => (v != null ? formatCurrency(v) : "—")} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
              <Bar dataKey="revenue"     name="Revenue (actual)"   fill={CHART.revenue} radius={[4, 4, 0, 0]} barSize={14} fillOpacity={0.8} />
              <Bar dataKey="costs"       name="Costs (actual)"     fill={CHART.cost}    radius={[4, 4, 0, 0]} barSize={14} fillOpacity={0.6} />
              <Line dataKey="net"        name="Net (actual)"       stroke={CHART.net}   strokeWidth={2} dot={{ r: 2 }} />
              <Bar dataKey="projRevenue" name="Revenue (forecast)" fill={CHART.revenue} radius={[4, 4, 0, 0]} barSize={14} fillOpacity={0.25} />
              <Bar dataKey="projCosts"   name="Costs (forecast)"   fill={CHART.cost}    radius={[4, 4, 0, 0]} barSize={14} fillOpacity={0.2} />
              <Line dataKey="projNet"    name="Net (forecast)"     stroke={CHART.net}   strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-grey-400 mt-4">Forecast uses linear regression on the last 12 months. Actual results may vary.</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-900 mb-4">6-month projection</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Month</th>
                <th className="text-right px-6 py-3">Revenue</th>
                <th className="text-right px-6 py-3">Costs</th>
                <th className="text-right px-6 py-3">Net</th>
              </tr>
            </thead>
            <tbody>
              {fwdMonths.map((m, i) => {
                const rev  = projRev[i]  ?? 0;
                const cost = projCost[i] ?? 0;
                const net  = rev - cost;
                return (
                  <tr key={m} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-0">
                    <td className="px-6 py-3 font-medium text-dark">{monthLabel(m)}</td>
                    <td className="px-6 py-3 text-right font-mono text-green-600 font-semibold">{formatCurrency(rev)}</td>
                    <td className="px-6 py-3 text-right font-mono text-danger">{formatCurrency(cost)}</td>
                    <td className={`px-6 py-3 text-right font-mono font-bold ${net >= 0 ? "text-green-600" : "text-danger"}`}>{formatCurrency(net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "revenue",  label: "Revenue" },
  { key: "costs",    label: "Costs" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "forecast", label: "Forecasted Performance" },
];

const TIME_RANGES: TimeRange[] = ["7D", "1M", "3M", "6M", "1Y"];

export default function FinancePage() {
  const [tab, setTab]               = useState<Tab>("revenue");
  const [timeRange, setTimeRange]   = useState<TimeRange>("1Y");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [commissions,   setCommissions]   = useState<Commission[]>([]);
  const [costs,         setCosts]         = useState<ApiCost[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/finance/subscriptions").then(r => r.json()),
      fetch("/api/admin/finance/commissions").then(r => r.json()),
      fetch("/api/admin/finance/costs").then(r => r.json()),
    ]).then(([s, c, a]) => {
      setSubscriptions(s);
      setCommissions(c);
      setCosts(a);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Revenue, costs, cash flow, and performance forecasting."
      />

      {/* ── Tab bar + time range ── */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-8 bg-white sticky top-0 z-10 px-8 -mx-8">
        {/* Tabs */}
        <div className="flex">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time range toggles */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {TIME_RANGES.map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                timeRange === range
                  ? "bg-white text-slate-900 border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div>
        {loading ? (
          <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
        ) : (
          <>
            {tab === "revenue"  && <RevenueTab   subscriptions={subscriptions} commissions={commissions} />}
            {tab === "costs"    && <CostsTab     costs={costs} commissions={commissions} />}
            {tab === "cashflow" && <CashFlowTab  subscriptions={subscriptions} commissions={commissions} costs={costs} />}
            {tab === "forecast" && <ForecastTab  subscriptions={subscriptions} commissions={commissions} costs={costs} />}
          </>
        )}
      </div>
    </div>
  );
}
