"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrustScoreBadge } from "@/components/shared/TrustScoreBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/utils";

type Entry = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  country: string | null;
  verified: boolean;
  trust_score: number | null;
  source_type: string | null;
  activity_type: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState("");

  useEffect(() => {
    fetch(`/api/admin/content/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setEntry(d);
        setName(d.name ?? "");
        setRegion(d.region ?? "");
        setCountry(d.country ?? "");
        setDescription(d.description ?? "");
        setActivityType(d.activity_type ?? "");
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, region, country, description, activity_type: activityType }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleVerify(v: boolean) {
    await fetch(`/api/admin/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: v }),
    });
    setEntry((e) => e ? { ...e, verified: v } : e);
  }

  async function handleDelete() {
    await fetch(`/api/admin/content/${id}`, { method: "DELETE" });
    router.push("/content");
  }

  if (loading) return <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>;
  if (!entry) return <div className="text-center py-20 text-grey-500 text-sm">Entry not found.</div>;

  const sources = (entry.data as any)?.sources as string[] | undefined;
  const scoutScore = (entry.data as any)?.scoutScore as number | undefined;

  return (
    <div>
      <PageHeader
        title={entry.name}
        description={`Content entry · ${entry.type}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 border border-grey-300 text-sm font-medium px-3 py-2 rounded-lg hover:bg-grey-100 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => handleVerify(!entry.verified)}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition ${
                entry.verified
                  ? "bg-danger/10 text-danger hover:bg-danger/20"
                  : "bg-green/10 text-green hover:bg-green/20"
              }`}
            >
              {entry.verified ? <><XCircle size={14} /> Unverify</> : <><CheckCircle2 size={14} /> Verify</>}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition disabled:opacity-50"
            >
              <Save size={14} /> {saving ? "Saving…" : saved ? "Saved!" : "Save"}
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="p-2 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-5">
        {/* Main edit form */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
            <h2 className="font-display font-semibold text-dark text-sm">Details</h2>

            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Region</label>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Country</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Holiday Focus</label>
              <input
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                placeholder="e.g. beach holiday, city break"
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60 focus:ring-2 focus:ring-blue/10 resize-none"
              />
            </div>
          </div>

          {/* Sources */}
          {sources && sources.length > 0 && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-3">Sources ({sources.length})</h2>
              <ul className="space-y-2">
                {sources.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue hover:underline break-all"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw data preview */}
          {entry.data && (
            <div className="bg-white border border-grey-300 rounded-xl p-5">
              <h2 className="font-display font-semibold text-dark text-sm mb-3">Raw Agent Data</h2>
              <pre className="text-xs bg-grey-50 rounded-lg p-3 overflow-auto max-h-60 text-grey-700 font-mono">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-4">
          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Status</h2>
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-700">Verified</span>
              {entry.verified
                ? <StatusBadge value="verified" />
                : <StatusBadge value="false" label="Unverified" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-700">Type</span>
              <StatusBadge value={entry.type} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-700">Source</span>
              {entry.source_type ? <StatusBadge value={entry.source_type} /> : <span className="text-grey-400 text-xs">—</span>}
            </div>
          </div>

          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-semibold text-dark text-sm">Trust Score</h2>
            {entry.trust_score != null ? (
              <TrustScoreBadge score={entry.trust_score} />
            ) : (
              <span className="text-grey-400 text-xs">Not calculated</span>
            )}
            {scoutScore != null && (
              <div className="text-xs text-grey-700">
                Scout score: <span className="font-semibold text-dark">{Math.round(scoutScore * 100)}%</span>
              </div>
            )}
          </div>

          {(entry.lat != null && entry.lng != null) && (
            <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-2">
              <h2 className="font-display font-semibold text-dark text-sm">Location</h2>
              <p className="text-xs text-grey-700">
                {entry.lat?.toFixed(5)}, {entry.lng?.toFixed(5)}
              </p>
              <a
                href={`https://maps.google.com/?q=${entry.lat},${entry.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue hover:underline"
              >
                <ExternalLink size={11} /> Open in Maps
              </a>
            </div>
          )}

          <div className="bg-white border border-grey-300 rounded-xl p-5 space-y-2">
            <h2 className="font-display font-semibold text-dark text-sm">Timestamps</h2>
            <div className="text-xs text-grey-700 space-y-1">
              <div>Created: <span className="text-dark">{formatDateTime(entry.created_at)}</span></div>
              {entry.updated_at && (
                <div>Updated: <span className="text-dark">{formatDateTime(entry.updated_at)}</span></div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete content entry?"
        description={`"${entry.name}" will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
