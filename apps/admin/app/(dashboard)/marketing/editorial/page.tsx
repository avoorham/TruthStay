"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CheckCircle2, XCircle, Pencil, RefreshCw,
  FileText, Eye, Archive, Inbox, Plus,
  Globe, Tag, Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "draft" | "pending_review" | "approved" | "rejected" | "archived";

interface EditorialPost {
  id:              string;
  title:           string;
  subtitle:        string | null;
  body:            string | null;
  hero_image_url:  string | null;
  post_type:       string;
  region:          string | null;
  activity_type:   string | null;
  target_audience: Record<string, unknown>;
  content_entry_ids: string[];
  status:          Status;
  generated_by:    string;
  review_notes:    string | null;
  published_at:    string | null;
  view_count:      number;
  save_count:      number;
  click_count:     number;
  created_at:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POST_TYPE_LABEL: Record<string, string> = {
  hotspot_spotlight: "Hotspot Spotlight",
  route_collection:  "Route Collection",
  seasonal_pick:     "Seasonal Pick",
  destination_guide: "Destination Guide",
  new_additions:     "New Additions",
};

const STATUS_TABS: { key: Status; label: string; icon: React.ElementType }[] = [
  { key: "pending_review", label: "Pending Review", icon: Inbox },
  { key: "draft",          label: "Drafts",         icon: FileText },
  { key: "approved",       label: "Published",      icon: Globe },
  { key: "rejected",       label: "Rejected",       icon: XCircle },
  { key: "archived",       label: "Archived",       icon: Archive },
];

function audienceLabel(target: Record<string, unknown>): string {
  const t = target?.type as string;
  if (t === "all_users")      return "All users";
  if (t === "activity")       return `${target.activity} lovers`;
  if (t === "region_interest") return `Interested in ${target.region}`;
  if (t === "upcoming_trip")  return `Upcoming trip to ${target.region}`;
  return t ?? "All users";
}

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

async function apiPatch(id: string, body: Record<string, unknown>) {
  const res = await fetch(`${WEB_BASE}/api/admin/editorial/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post, onAction, actioning,
}: {
  post: EditorialPost;
  onAction: (action: "approve" | "reject" | "archive") => void;
  actioning: boolean;
}) {
  const router = useRouter();
  const isPending = post.status === "pending_review";
  const isDraft   = post.status === "draft";

  return (
    <div className="bg-white rounded-2xl border border-grey-200 shadow-sm overflow-hidden">
      {/* Hero */}
      <div className="relative h-40 bg-gradient-to-br from-teal-light to-blue-light flex items-center justify-center">
        {post.hero_image_url ? (
          <Image
            src={post.hero_image_url}
            alt={post.title}
            fill
            className="object-cover"
          />
        ) : (
          <FileText size={40} className="text-grey-300" />
        )}
        <div className="absolute top-3 right-3 flex gap-2">
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium",
            post.generated_by === "agent"
              ? "bg-blue-light text-blue"
              : "bg-grey-100 text-grey-700",
          )}>
            {post.generated_by === "agent" ? "Agent-drafted" : "Admin-created"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-dark text-base leading-tight">{post.title}</h3>
            {post.subtitle && (
              <p className="text-sm text-grey-500 mt-0.5 line-clamp-1">{post.subtitle}</p>
            )}
          </div>
          <StatusBadge value={post.status} />
        </div>

        {post.body && (
          <p className="text-sm text-grey-700 line-clamp-2">{post.body}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-2 text-xs text-grey-500">
          {post.region && (
            <span className="flex items-center gap-1">
              <Globe size={12} /> {post.region}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Tag size={12} /> {POST_TYPE_LABEL[post.post_type] ?? post.post_type}
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} /> {audienceLabel(post.target_audience)}
          </span>
          {post.content_entry_ids.length > 0 && (
            <span className="flex items-center gap-1">
              <FileText size={12} /> {post.content_entry_ids.length} linked entries
            </span>
          )}
        </div>

        {/* Engagement (published) */}
        {post.status === "approved" && (
          <div className="flex gap-4 text-xs text-grey-500 border-t border-grey-100 pt-3">
            <span>👁️ {post.view_count} views</span>
            <span>❤️ {post.save_count} saves</span>
            <span>🖱️ {post.click_count} clicks</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-grey-700 border border-grey-200 rounded-lg hover:bg-grey-50 transition-colors"
            onClick={() => router.push(`/marketing/editorial/${post.id}`)}
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-grey-700 border border-grey-200 rounded-lg hover:bg-grey-50 transition-colors"
            onClick={() => window.open(post.hero_image_url ?? "#", "_blank")}
          >
            <Eye size={14} /> Preview
          </button>
          {(isPending || isDraft) && (
            <>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-teal rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
                onClick={() => onAction("approve")}
                disabled={actioning}
              >
                <CheckCircle2 size={14} /> Approve & Publish
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger-light transition-colors disabled:opacity-50"
                onClick={() => onAction("reject")}
                disabled={actioning}
              >
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
          {post.status === "approved" && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-grey-500 border border-grey-200 rounded-lg hover:bg-grey-50 transition-colors disabled:opacity-50"
              onClick={() => onAction("archive")}
              disabled={actioning}
            >
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditorialPage() {
  const router = useRouter();
  const [activeTab, setActiveTab]   = useState<Status>("pending_review");
  const [posts, setPosts]           = useState<EditorialPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [actioning, setActioning]   = useState<string | null>(null);

  const loadPosts = useCallback(async (status: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`${WEB_BASE}/api/admin/editorial?status=${status}`);
      const data = await res.json() as { posts: EditorialPost[] };
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(activeTab);
  }, [activeTab, loadPosts]);

  async function handleAction(post: EditorialPost, action: "approve" | "reject" | "archive") {
    setActioning(post.id);
    try {
      const statusMap = { approve: "approved", reject: "rejected", archive: "archived" } as const;
      await apiPatch(post.id, { status: statusMap[action] });
      await loadPosts(activeTab);
    } catch (e) {
      alert("Action failed: " + (e as Error).message);
    } finally {
      setActioning(null);
    }
  }

  const tabCount = posts.length;

  return (
    <div className="min-h-screen p-8">
      <PageHeader
        title="Editorial Posts"
        description="Agent-drafted and admin-created posts that appear in users' feeds."
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-xl text-sm font-semibold hover:bg-teal-dark transition-colors"
            onClick={() => router.push("/marketing/editorial/new")}
          >
            <Plus size={16} /> Create post
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-grey-100 rounded-xl p-1 w-fit mb-8">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-white text-dark shadow-sm"
                  : "text-grey-500 hover:text-dark",
              )}
            >
              <Icon size={14} />
              {tab.label}
              {active && tabCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-teal text-white text-xs rounded-full">
                  {tabCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="animate-spin text-grey-300" size={28} />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-grey-300 gap-3">
          <Inbox size={48} />
          <p className="text-grey-500 text-sm">No {STATUS_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} posts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              actioning={actioning === post.id}
              onAction={action => handleAction(post, action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
