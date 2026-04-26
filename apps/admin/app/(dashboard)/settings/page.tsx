"use client";
import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Shield, ShieldOff, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate } from "@/lib/utils";

type AdminUser = {
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
};

const ROLES = ["super_admin", "admin", "content_moderator", "analyst", "marketer"];

export default function SettingsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);

  async function load() {
    setLoading(true);
    const [adminList, userList] = await Promise.all([
      fetch("/api/admin/users/admins").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);
    const userMap = new Map(userList.map((u: any) => [u.id, u.email]));
    setAdmins(adminList.map((a: any) => ({ ...a, email: userMap.get(a.user_id) ?? a.user_id })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    const users = await fetch("/api/admin/users").then((r) => r.json());
    const match = users.find((u: any) => u.email === newEmail);
    if (!match) { alert("No user found with that email."); return; }
    await fetch(`/api/admin/users/${match.id}/admin-role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setNewEmail("");
    setNewRole("admin");
    setShowAdd(false);
    load();
  }

  async function handleRemove(userId: string) {
    await fetch(`/api/admin/users/${userId}/admin-role`, { method: "DELETE" });
    setRemoveTarget(null);
    load();
  }

  const columns: ColumnDef<AdminUser, any>[] = [
    { accessorKey: "email", header: "User", cell: ({ getValue }) => <span className="text-sm font-medium break-all">{getValue<string>()}</span> },
    { accessorKey: "role", header: "Role", cell: ({ getValue }) => <StatusBadge value="admin" label={getValue<string>().replace(/_/g, " ")} /> },
    { accessorKey: "created_at", header: "Granted", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span> },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setRemoveTarget(row.original)}
          className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
        >
          <ShieldOff size={12} /> Remove
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin Team"
        description="Manage who has access to the admin dashboard and their permissions."
        actions={
          <button onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">
            <UserPlus size={14} /> Add admin
          </button>
        }
      />

      {showAdd && (
        <form onSubmit={handleAddAdmin} className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-dark text-sm flex items-center gap-2"><Shield size={14} /> Grant admin access</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">User email *</label>
              <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com"
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Role *</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">Grant access</button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-grey-700 px-4 py-2 hover:text-dark">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3 mb-2">
        <h3 className="font-display font-semibold text-dark text-sm">Role permissions</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-grey-700">
          {[
            ["super_admin", "Full access to all modules"],
            ["admin", "All modules except super admin actions"],
            ["content_moderator", "Content management and review queue only"],
            ["analyst", "Analytics and Finance (read-only)"],
            ["marketer", "Marketing and Notifications modules"],
          ].map(([role, desc]) => (
            <div key={role} className="flex items-start gap-2 p-2 bg-grey-50 rounded-lg">
              <StatusBadge value="admin" label={(role ?? "").replace(/_/g, " ")} />
              <span className="leading-tight">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div> :
        <DataTable data={admins} columns={columns} searchKey="email" searchPlaceholder="Search admins…" />}

      {removeTarget && (
        <ConfirmDialog
          open={!!removeTarget}
          onOpenChange={(open) => !open && setRemoveTarget(null)}
          title="Remove admin access?"
          description={`${removeTarget.email} will lose all admin dashboard access immediately.`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => handleRemove(removeTarget.user_id)}
        />
      )}
    </div>
  );
}
