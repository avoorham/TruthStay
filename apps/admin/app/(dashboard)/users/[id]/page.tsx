"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, FileText, Map, MessageSquare, RotateCcw, Shield, ShieldOff } from "lucide-react";
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

type Contributions = {
  content: { id: string; name: string; type: string; verified: boolean; created_at: string }[];
  adventures: { id: string; title: string; created_at: string }[];
  posts: { id: string; created_at: string }[];
};

const STATUS_OPTIONS = ["active", "banned", "onboarding"];
const ADMIN_ROLES = ["admin", "content_moderator", "analyst", "marketer"];

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Contributions | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBan, setShowBan] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/users/${id}`).then((r) => r.json()),
      fetch(`/api/admin/users/${id}/admin-role`).then((r) => r.json()),
      fetch(`/api/admin/users/${id}/contributions`).then((r) => r.json()),
    ]).then(([u, ar, contrib]) => {
      setUser(u);
      setAdminRole(ar?.role ?? null);
      setSelectedRole(ar?.role ?? "");
      setContributions(contrib);
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

  async function handlePasswordReset() {
    setSendingReset(true);
    await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
    setSendingReset(false);
    setResetSent(true);
    setTimeout(() => setResetSent(false), 4000);
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
              className="inline-flex items-center gap-1.5 border border-slate-200 text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-50 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={handlePasswordReset}
              disabled={sendingReset || resetSent}
              className="inline-flex items-center gap-1.5 border border-slate-200 text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-50 transition disabled:opacity-60"
            >
              {resetSent ? (
                <><CheckCircle size={14} className="text-green" /> Reset sent</>
              ) : (
                <><RotateCcw size={14} /> {sendingReset ? "Sending…" : "Send password reset"}</>
              )}
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Account Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => s === "banned" ? setShowBan(true) : handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition border ${
                    user.status === s
                      ? "bg-slate-900 text-white border-slate-900"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
            <h2 className="font-display font-semibold text-dark text-sm">Timestamps</h2>
            <div className="text-xs text-grey-700 space-y-1">
              <div>Joined: <span className="text-dark">{formatDateTime(user.created_date)}</span></div>
            </div>
          </div>

          {/* Admin role */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
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
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none "
            >
              <option value="">No admin access</option>
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</option>
              ))}
            </select>
            <button
              onClick={handleRoleSave}
              disabled={savingRole}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-teal-600 transition disabled:opacity-50"
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

      {/* Contributions */}
      {contributions && (
        <div className="mt-5 space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{contributions.content.length}</p>
                <p className="text-xs text-grey-500">Places added</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue/10 flex items-center justify-center shrink-0">
                <Map size={16} className="text-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{contributions.adventures.length}</p>
                <p className="text-xs text-grey-500">Adventures created</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <MessageSquare size={16} className="text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{contributions.posts.length}</p>
                <p className="text-xs text-grey-500">Posts</p>
              </div>
            </div>
          </div>

          {/* Content entries detail */}
          {contributions.content.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-3">Submitted Places</h2>
              <div className="divide-y divide-slate-100">
                {contributions.content.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-grey-500 capitalize">{c.type}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.verified ? "bg-green/10 text-green" : "bg-slate-100 text-grey-500"}`}>
                        {c.verified ? "Verified" : "Pending"}
                      </span>
                      <span className="text-xs text-grey-400">{formatDateTime(c.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
