"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Save, CheckCircle2, XCircle,
  Globe, Users, Tag, ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditorialPost {
  id:              string;
  title:           string;
  subtitle:        string | null;
  body:            string | null;
  hero_image_url:  string | null;
  images:          string[];
  post_type:       string;
  content_entry_ids: string[];
  region:          string | null;
  activity_type:   string | null;
  vacation_type:   string | null;
  target_audience: Record<string, unknown>;
  status:          string;
  generated_by:    string;
  review_notes:    string | null;
  published_at:    string | null;
}

const POST_TYPES = [
  { value: "hotspot_spotlight", label: "Hotspot Spotlight" },
  { value: "route_collection",  label: "Route Collection" },
  { value: "seasonal_pick",     label: "Seasonal Pick" },
  { value: "destination_guide", label: "Destination Guide" },
  { value: "new_additions",     label: "New Additions" },
];

const AUDIENCE_TYPES = [
  { value: "all_users",       label: "All users" },
  { value: "activity",        label: "Activity lovers" },
  { value: "region_interest", label: "Region interest" },
  { value: "upcoming_trip",   label: "Upcoming trip" },
];

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

async function loadPost(id: string): Promise<EditorialPost | null> {
  const res = await fetch(`${WEB_BASE}/api/admin/editorial?status=all`);
  // Fall back: try fetching all statuses to find the post
  const statuses = ["draft", "pending_review", "approved", "rejected", "archived"];
  for (const status of statuses) {
    const r = await fetch(`${WEB_BASE}/api/admin/editorial?status=${status}`);
    const data = await r.json() as { posts: EditorialPost[] };
    const found = (data.posts ?? []).find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

async function savePost(id: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${WEB_BASE}/api/admin/editorial/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-dark">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-dark placeholder:text-grey-300 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal ${className ?? ""}`}
    />
  );
}

function Textarea({ value, onChange, rows = 4, placeholder }: {
  value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-dark placeholder:text-grey-300 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal resize-none"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-grey-200 rounded-lg text-sm text-dark focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-white"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditEditorialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew  = id === "new";

  const [post, setPost]         = useState<EditorialPost | null>(null);
  const [loading, setLoading]   = useState(!isNew);
  const [saving, setSaving]     = useState(false);
  const [actioning, setActioning] = useState(false);
  const [saved, setSaved]       = useState(false);

  // Editable fields
  const [title,        setTitle]        = useState("");
  const [subtitle,     setSubtitle]     = useState("");
  const [body,         setBody]         = useState("");
  const [heroUrl,      setHeroUrl]      = useState("");
  const [postType,     setPostType]     = useState("hotspot_spotlight");
  const [region,       setRegion]       = useState("");
  const [actType,      setActType]      = useState("");
  const [audienceType, setAudienceType] = useState("all_users");
  const [audienceVal,  setAudienceVal]  = useState("");
  const [reviewNotes,  setReviewNotes]  = useState("");

  useEffect(() => {
    if (isNew) return;
    loadPost(id).then(p => {
      if (!p) return;
      setPost(p);
      setTitle(p.title ?? "");
      setSubtitle(p.subtitle ?? "");
      setBody(p.body ?? "");
      setHeroUrl(p.hero_image_url ?? "");
      setPostType(p.post_type ?? "hotspot_spotlight");
      setRegion(p.region ?? "");
      setActType(p.activity_type ?? "");
      const aud = p.target_audience ?? {};
      setAudienceType((aud.type as string) ?? "all_users");
      setAudienceVal(((aud.region ?? aud.activity) as string) ?? "");
      setReviewNotes(p.review_notes ?? "");
    }).finally(() => setLoading(false));
  }, [id, isNew]);

  function buildPayload() {
    const audience: Record<string, unknown> = { type: audienceType };
    if (audienceType === "activity" || audienceType === "region_interest" || audienceType === "upcoming_trip") {
      if (audienceVal) audience[audienceType === "activity" ? "activity" : "region"] = audienceVal;
    }
    return {
      title,
      subtitle:        subtitle || null,
      body:            body || null,
      hero_image_url:  heroUrl || null,
      post_type:       postType,
      region:          region || null,
      activity_type:   actType || null,
      target_audience: audience,
      review_notes:    reviewNotes || null,
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch(`${WEB_BASE}/api/admin/editorial`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...buildPayload(), status: "draft" }),
        });
        const data = await res.json() as { post: { id: string } };
        router.replace(`/marketing/editorial/${data.post.id}`);
      } else {
        await savePost(id, buildPayload());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusAction(action: "approve" | "reject" | "archive") {
    setActioning(true);
    try {
      const statusMap = { approve: "approved", reject: "rejected", archive: "archived" };
      await savePost(id, { ...buildPayload(), status: statusMap[action] });
      router.push("/marketing/editorial");
    } catch (e) {
      alert("Action failed: " + (e as Error).message);
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  const isPending = post?.status === "pending_review" || post?.status === "draft";

  return (
    <div className="min-h-screen p-8 max-w-4xl">
      <PageHeader
        title={isNew ? "Create Editorial Post" : "Edit Editorial Post"}
        description={post ? `${post.status} · ${post.generated_by === "agent" ? "Agent-drafted" : "Admin-created"}` : "New admin-created post"}
        actions={
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-grey-500 border border-grey-200 rounded-lg hover:bg-grey-50 transition-colors"
              onClick={() => router.back()}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue rounded-lg hover:bg-blue-dark transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || actioning}
            >
              <Save size={14} />
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save draft"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-8">
        {/* Main column */}
        <div className="col-span-2 space-y-6">
          <div className="border border-slate-200 rounded-lg p-6 space-y-5">
            <h2 className="font-display font-bold text-dark text-base">Content</h2>

            <Field label="Title">
              <Input value={title} onChange={setTitle} placeholder="Hidden gem: Rifugio Scotoni" />
            </Field>

            <Field label="Subtitle">
              <Input value={subtitle} onChange={setSubtitle} placeholder="Short hook line" />
            </Field>

            <Field label="Body text">
              <Textarea
                value={body}
                onChange={setBody}
                rows={6}
                placeholder="Fire-cooked food in a family-owned mountain restaurant with stunning valley views…"
              />
            </Field>

            <Field label="Hero image URL">
              <Input value={heroUrl} onChange={setHeroUrl} placeholder="https://…" />
              {heroUrl && (
                <div className="mt-2 relative h-40 rounded-lg overflow-hidden border border-grey-200">
                  <Image src={heroUrl} alt="Hero preview" fill className="object-cover" />
                </div>
              )}
            </Field>
          </div>

          {/* Review notes */}
          <div className="border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display font-bold text-dark text-base">Review Notes</h2>
            <Textarea
              value={reviewNotes}
              onChange={setReviewNotes}
              rows={3}
              placeholder="Internal notes about this post (not shown to users)…"
            />
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          {/* Publish / approve controls */}
          {!isNew && isPending && (
            <div className="bg-teal-50 rounded-lg border border-teal-200 p-5 space-y-3">
              <h3 className="font-semibold text-dark text-sm">Approval</h3>
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-500 text-white rounded-md text-sm font-medium hover:bg-teal-600 transition-colors disabled:opacity-50"
                onClick={() => handleStatusAction("approve")}
                disabled={actioning}
              >
                <CheckCircle2 size={15} /> Approve & Publish
              </button>
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-danger/30 text-danger rounded-xl text-sm font-medium hover:bg-danger-light transition-colors disabled:opacity-50"
                onClick={() => handleStatusAction("reject")}
                disabled={actioning}
              >
                <XCircle size={15} /> Reject
              </button>
            </div>
          )}

          {/* Post type */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-dark text-sm flex items-center gap-2">
              <Tag size={14} /> Post Type
            </h3>
            <Select
              value={postType}
              onChange={setPostType}
              options={POST_TYPES}
            />
          </div>

          {/* Target audience */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-dark text-sm flex items-center gap-2">
              <Users size={14} /> Target Audience
            </h3>
            <Select
              value={audienceType}
              onChange={setAudienceType}
              options={AUDIENCE_TYPES}
            />
            {audienceType !== "all_users" && (
              <Input
                value={audienceVal}
                onChange={setAudienceVal}
                placeholder={audienceType === "activity" ? "cycling" : "Dolomites"}
              />
            )}
          </div>

          {/* Region / activity */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-dark text-sm flex items-center gap-2">
              <Globe size={14} /> Region & Activity
            </h3>
            <Field label="Region">
              <Input value={region} onChange={setRegion} placeholder="Dolomites, Italy" />
            </Field>
            <Field label="Activity type">
              <Input value={actType} onChange={setActType} placeholder="cycling" />
            </Field>
          </div>

          {/* Archive */}
          {!isNew && post?.status === "approved" && (
            <button
              className="w-full py-2 text-sm text-grey-500 border border-grey-200 rounded-xl hover:bg-grey-50 transition-colors"
              onClick={() => handleStatusAction("archive")}
              disabled={actioning}
            >
              Archive post
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
