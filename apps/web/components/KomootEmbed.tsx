"use client";

import { useState } from "react";
import { ExternalLink, Link2, X, Check, Loader } from "lucide-react";

interface KomootEmbedProps {
  tourId: string | null;
  adventureId: string | null;  // null = adventure not yet saved (unsaveable plan)
  dayNumber: number;
  onLinked?: (tourId: string) => void;
  onUnlinked?: () => void;
  editable?: boolean;  // false in read-only My Trips view
}

export function KomootEmbed({
  tourId,
  adventureId,
  dayNumber,
  onLinked,
  onUnlinked,
  editable = true,
}: KomootEmbedProps) {
  const [linking, setLinking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!adventureId || !inputValue.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/adventures/${adventureId}/days`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_number: dayNumber, komoot_tour_id: inputValue.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to link route");

      setLinking(false);
      setInputValue("");
      onLinked?.(data.komoot_tour_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!adventureId) return;
    setSaving(true);
    try {
      await fetch(`/api/adventures/${adventureId}/days`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_number: dayNumber, komoot_tour_id: null }),
      });
      onUnlinked?.();
    } finally {
      setSaving(false);
    }
  };

  // ── Linked state — show embed ─────────────────────────────────────────────
  if (tourId) {
    return (
      <div className="mt-3">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" /* 16:9 */ }}>
          <iframe
            src={`https://www.komoot.com/tour/${tourId}/embed?profile=1`}
            className="absolute inset-0 w-full h-full border border-[#dadccb]"
            allowFullScreen
            title={`Komoot route — Day ${dayNumber}`}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <a
            href={`https://www.komoot.com/tour/${tourId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#212121] font-semibold hover:underline"
          >
            <ExternalLink size={12} />
            View &amp; navigate on Komoot
          </a>
          {editable && (
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-[#717182] hover:text-[#212121] disabled:opacity-40"
            >
              <X size={12} />
              Unlink
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Unlinked + editable — show link button / input ────────────────────────
  if (!editable || !adventureId) return null;

  if (!linking) {
    return (
      <button
        onClick={() => setLinking(true)}
        className="mt-3 flex items-center gap-2 text-xs text-[#717182] border border-dashed border-[#dadccb] px-3 py-2 w-full hover:border-[#212121] hover:text-[#212121] transition-colors"
      >
        <Link2 size={13} />
        Link your Komoot route for this day
      </button>
    );
  }

  return (
    <div className="mt-3 border border-[#dadccb] p-3 space-y-2">
      <p className="text-xs font-semibold text-[#212121]">Paste your Komoot tour URL</p>
      <p className="text-xs text-[#717182]">
        e.g. <span className="font-mono">https://www.komoot.com/tour/1234567890</span>
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Komoot URL or tour ID"
          autoFocus
          className="flex-1 text-xs border border-[#dadccb] px-2 py-2 outline-none focus:border-[#212121]"
        />
        <button
          onClick={handleSave}
          disabled={!inputValue.trim() || saving}
          className="bg-black text-white px-3 py-2 disabled:opacity-40 flex items-center"
        >
          {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button
          onClick={() => { setLinking(false); setInputValue(""); setError(null); }}
          className="border border-[#dadccb] px-2 py-2"
        >
          <X size={13} className="text-[#717182]" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
