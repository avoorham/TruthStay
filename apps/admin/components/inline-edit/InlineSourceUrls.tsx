"use client";
import { useState } from "react";
import { Trash2, Plus, ExternalLink, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceUrl } from "@/lib/queries/content";

const SOURCE_TYPE_OPTIONS = [
  { value: "blog",              label: "Website / Blog" },
  { value: "web_search",        label: "Web search" },
  { value: "instagram_profile", label: "Instagram profile" },
  { value: "instagram_post",    label: "Instagram post" },
] as const;

function detectSourceType(url: string): SourceUrl["source_type"] {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("instagram.com")) {
      return url.includes("/p/") ? "instagram_post" : "instagram_profile";
    }
  } catch { /* fall through */ }
  return "blog";
}

function sourceLabel(s: SourceUrl): string {
  if (s.source_label) return s.source_label;
  try {
    const url = new URL(s.source_url);
    if (url.hostname.includes("instagram.com")) {
      const handle = url.pathname.replace(/^\//, "").split("/")[0];
      return handle ? `@${handle}` : "Instagram";
    }
    return url.hostname.replace(/^www\./, "");
  } catch { return s.source_url; }
}

const SOURCE_ICON: Record<string, string> = {
  blog:              "🌐",
  instagram_profile: "📸",
  instagram_post:    "📸",
  web_search:        "🔍",
};

interface Props {
  sources:          SourceUrl[];
  onSave:           (sources: SourceUrl[]) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}

export function InlineSourceUrls({ sources, onSave, onEditingChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editUrl,    setEditUrl]    = useState("");
  const [addingNew,  setAddingNew]  = useState(false);
  const [newUrl,     setNewUrl]     = useState("");
  const [newType,    setNewType]    = useState<SourceUrl["source_type"]>("blog");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const isEditing = editingIdx !== null || addingNew;

  function notifyEditing(v: boolean) { onEditingChange?.(v); }

  function startRowEdit(i: number) {
    setEditingIdx(i);
    setEditUrl(sources[i]?.source_url ?? "");
    setError(null);
    notifyEditing(true);
  }

  function cancelRowEdit() {
    setEditingIdx(null);
    setEditUrl("");
    setError(null);
    notifyEditing(false);
  }

  async function saveRowEdit(i: number) {
    const trimmed = editUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }
    setSaving(true);
    const updated = sources.map((s, idx) =>
      idx === i ? { ...s, source_url: trimmed, source_type: detectSourceType(trimmed) } : s
    );
    try {
      await onSave(updated);
      setEditingIdx(null);
      setEditUrl("");
      setError(null);
      notifyEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(i: number) {
    setSaving(true);
    try {
      await onSave(sources.filter((_, idx) => idx !== i));
      setConfirmDel(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setSaving(false);
    }
  }

  async function addRow() {
    const trimmed = newUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }
    setSaving(true);
    const newSource: SourceUrl = {
      source_url:  trimmed,
      source_type: newType,
      first_seen_at: new Date().toISOString(),
    };
    try {
      await onSave([...sources, newSource]);
      setAddingNew(false);
      setNewUrl("");
      setNewType("blog");
      setError(null);
      notifyEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      {sources.map((s, i) => (
        <div key={i}>
          {editingIdx === i ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter")  { e.preventDefault(); saveRowEdit(i); }
                    if (e.key === "Escape") { e.preventDefault(); cancelRowEdit(); }
                  }}
                  className="flex-1 text-[10px] border border-teal-400 rounded px-2 py-1 focus:outline-none"
                />
                <button
                  onClick={() => saveRowEdit(i)}
                  disabled={saving}
                  className="text-[10px] font-medium text-white bg-teal-500 hover:bg-teal-600 rounded px-2 py-1 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}
                </button>
                <button onClick={cancelRowEdit} className="text-grey-400 hover:text-grey-700 transition">
                  <X size={12} />
                </button>
              </div>
              {error && <p className="text-[10px] text-red-500">{error}</p>}
            </div>
          ) : confirmDel === i ? (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-red-600 font-medium">Remove this source?</span>
              <button
                onClick={() => removeRow(i)}
                disabled={saving}
                className="text-white bg-red-500 rounded px-2 py-0.5 hover:bg-red-600 transition disabled:opacity-50"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : "Remove"}
              </button>
              <button onClick={() => setConfirmDel(null)} className="text-grey-500 hover:text-grey-700 transition">
                Cancel
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-1.5">
              <span className="text-[10px]">{SOURCE_ICON[s.source_type] ?? "🌐"}</span>
              <span className="text-[10px] font-mono text-grey-600 flex-1 truncate">{sourceLabel(s)}</span>
              <a
                href={s.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-50 text-grey-400 hover:text-blue-500 transition"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={10} />
              </a>
              <button
                onClick={() => startRowEdit(i)}
                className="opacity-0 group-hover:opacity-50 text-grey-400 hover:text-teal-600 transition text-[10px]"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDel(i)}
                className="opacity-0 group-hover:opacity-50 text-grey-400 hover:text-red-500 transition"
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add new source */}
      {addingNew ? (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center gap-1">
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as SourceUrl["source_type"])}
              className="text-[10px] border border-slate-200 rounded px-1 py-1 focus:outline-none focus:border-teal-400"
            >
              {SOURCE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              autoFocus
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://..."
              onKeyDown={e => {
                if (e.key === "Enter")  { e.preventDefault(); addRow(); }
                if (e.key === "Escape") { e.preventDefault(); setAddingNew(false); setNewUrl(""); setError(null); notifyEditing(false); }
              }}
              className="flex-1 text-[10px] border border-teal-400 rounded px-2 py-1 focus:outline-none"
            />
            <button
              onClick={addRow}
              disabled={saving}
              className="text-[10px] font-medium text-white bg-teal-500 hover:bg-teal-600 rounded px-2 py-1 transition disabled:opacity-50"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : "Add"}
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewUrl(""); setError(null); notifyEditing(false); }}
              className="text-grey-400 hover:text-grey-700 transition"
            >
              <X size={12} />
            </button>
          </div>
          {error && <p className="text-[10px] text-red-500">{error}</p>}
        </div>
      ) : (
        sources.length < 20 && (
          <button
            onClick={() => { setAddingNew(true); notifyEditing(true); }}
            className="flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-800 transition mt-0.5"
          >
            <Plus size={10} /> Add source
          </button>
        )
      )}
    </div>
  );
}
