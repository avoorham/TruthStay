"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, RefreshCw, Shield } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  created_date: string;
  user_subscriptions?: { status: string; subscription_plans?: { name: string } | null }[];
};

type AdminUser = { user_id: string; role: string };

const STATUS_OPTIONS = ["", "active", "banned", "onboarding"];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    const [ur, ar] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/users/admins").then((r) => r.json()),
    ]);
    setUsers(ur);
    setAdmins(ar);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const adminIds = new Set(admins.map((a) => a.user_id));
  const filtered = statusFilter ? users.filter((u) => u.status === statusFilter) : users;

  const columns: ColumnDef<User, any>[] = [
    {
      accessorKey: "full_name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/users/${row.original.id}`)}
            className="text-blue font-medium hover:underline text-left max-w-[180px] truncate block"
          >
            {row.original.full_name || "—"}
          </button>
          {adminIds.has(row.original.id) && (
            <Shield size={12} className="text-purple-600 shrink-0" aria-label="Admin" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ getValue }) => <span className="text-sm text-grey-700 truncate max-w-[200px] block">{getValue<string>()}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      id: "subscription",
      header: "Plan",
      cell: ({ row }) => {
        const sub = row.original.user_subscriptions?.[0];
        if (!sub) return <span className="text-grey-400 text-xs">Free</span>;
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge value={sub.status} />
            {sub.subscription_plans?.name && (
              <span className="text-xs text-grey-700">{sub.subscription_plans.name}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "created_date",
      header: "Joined",
      cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/users/${row.original.id}`)}
          className="p-1.5 rounded-lg hover:bg-grey-100 text-grey-700 transition"
        >
          <ExternalLink size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="All registered TruthStay users."
      />

      <div className="flex items-center gap-3 mb-5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "All statuses"}</option>
          ))}
        </select>
        <button onClick={load} className="p-2 rounded-lg border border-grey-300 hover:bg-grey-100 transition text-grey-700">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <span className="text-sm text-grey-700 ml-auto">{filtered.length} users</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : (
        <DataTable data={filtered} columns={columns} searchKey="email" searchPlaceholder="Search by email or name…" />
      )}
    </div>
  );
}
