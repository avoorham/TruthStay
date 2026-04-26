"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Shield, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/utils";

type UserDetail = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  created_date: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
};

const STATUS_OPTIONS = ["active", "banned", "onboarding"];
const ADMIN_ROLES = ["admin", "content_moderator", "analyst", "marketer"];

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBan, setShowBan] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/users/${id}`).then((r) => r.json()),
      fetch(`/api/admin/users/${id}/admin-role`).then((r) => r.json()),
    ]).then(([u, ar]) => {
      setUser(u);
      setAdminRole(ar?.role ?? null);
      setSelectedRole(ar?.role ?? "");
      setLoading(false);
    });
  }, [id]);

  async function handleStatusChange(status: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUser((u) => u ? { ...u, status } : u);
    setShowBan(false);
  }

  async function handleRoleSave() {
    setSavingRole(true);
    if (selectedRole) {
      await fetch(`/api/admin/users/${id}/admin-role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      setAdminRole(selectedRole);
    } else {
      await fetch(`/api/admin/users/${id}/admin-role`, { method: "DELETE" });
      setAdminRole(null);
    }
    setSavingRole(false);
  }

  if (loading) return <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>;
  if (!user) return <div className="text-center py-20 text-grey-500 text-sm">User not found.</div>;

  return (
    <div>
      <PageHeader
        title={user.full_name || user.email}
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 border border-grey-300 text-sm font-medium px-3 py-2 rounded-lg hover:bg-grey-100 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            {user.status !== "banned" ? (
              <button
                onClick={() => setShowBan(true)}
                className="inline-flex items-center gap-1.5 bg-danger/10 text-danger text-sm font-semibold px-4 py-2 rounded-lg hover:bg-danger/20 transition"
              >
                Ban user
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange("active")}
                className="inline-flex items-center gap-1.5 bg-green/10 text-green text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green/20 transition"
              >
                Unban user
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Profile info */}
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Profile</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-grey-700 block mb-0.5">Full name</span>
                <span>{user.full_name || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-grey-700 block mb-0.5">Email</span>
                <span className="break-all">{user.email}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-grey-700 block mb-0.5">Location</span>
                <span>{user.location || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-grey-700 block mb-0.5">Status</span>
                <StatusBadge value={user.status} />
              </div>
              {user.bio && (
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-grey-700 block mb-0.5">Bio</span>
                  <span className="text-grey-700">{user.bio}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status management */}
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Account Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => s === "banned" ? setShowBan(true) : handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                    user.status === s
                      ? "bg-blue text-white border-blue"
                      : "border-grey-300 text-grey-700 hover:bg-grey-100"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-2">
            <h2 className="font-display font-semibold text-dark text-sm">Timestamps</h2>
            <div className="text-xs text-grey-700 space-y-1">
              <div>Joined: <span className="text-dark">{formatDateTime(user.created_date)}</span></div>
            </div>
          </div>

          {/* Admin role */}
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm flex items-center gap-1.5">
              <Shield size={14} /> Admin Access
            </h2>
            {adminRole && (
              <div className="flex items-center gap-1.5">
                <StatusBadge value="admin" label={adminRole.replace(/_/g, " ")} />
              </div>
            )}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60"
            >
              <option value="">No admin access</option>
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</option>
              ))}
            </select>
            <button
              onClick={handleRoleSave}
              disabled={savingRole}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition disabled:opacity-50"
            >
              {adminRole && !selectedRole ? (
                <><ShieldOff size={14} /> Remove access</>
              ) : (
                <><Shield size={14} /> {savingRole ? "Saving…" : "Save role"}</>
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showBan}
        onOpenChange={setShowBan}
        title="Ban this user?"
        description={`${user.full_name || user.email} will lose access to TruthStay immediately.`}
        confirmLabel="Ban user"
        variant="danger"
        onConfirm={() => handleStatusChange("banned")}
      />
    </div>
  );
}
