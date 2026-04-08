"use client";
import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPlan {
  day_number: number;
  title: string;
  description: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  route_notes: string;
  end_location: string;
}

interface AccomOption {
  name: string;
  type: string;
  price_range: string;
  price_per_night_eur: number | null;
  description: string;
}

interface AccomStop {
  location: string;
  night_numbers: number[];
  notes: string;
  options: AccomOption[];
}

interface Adventure {
  title: string;
  description: string;
  region: string;
  activity_type: string;
  duration_days: number;
  days: DayPlan[];
}

interface DraftSlot {
  country: string;
  region: string;
  activity: string;
  duration: number;
  budget: string;
  level: string;
}

interface DraftMeta {
  coords?: [number, number];
  country?: string;
  tags?: string[];
  avgDistanceKm?: number | null;
  avgElevationM?: number | null;
}

interface Draft {
  id: string;
  slot: DraftSlot;
  adventure: Adventure;
  accommodation_stops: AccomStop[];
  meta: DraftMeta;
  qa_notes: string;
  status: "draft" | "approved" | "rejected";
  created_at: string;
  adventure_id: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVITY_EMOJI: Record<string, string> = {
  cycling: "🚴", gravel: "🚵", mtb: "🚵", hiking: "🥾",
  trail_running: "🏃", climbing: "🧗", kayaking: "🛶", skiing: "⛷️", other: "🗺️",
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#EF4444",
};
const BUDGET_LABEL: Record<string, string> = { budget: "$", mid: "$$", luxury: "$$$" };

function fmt(n: number | null | undefined, suffix: string) {
  return n != null ? `${n}${suffix}` : "—";
}

// ─── Generation panel ─────────────────────────────────────────────────────────

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [indices, setIndices]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  async function handleGenerate() {
    const slots = indices.trim()
      ? indices.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : Array.from({ length: 100 }, (_, i) => i);

    setLoading(true);
    setProgress([]);

    let ok = 0, failed = 0;
    for (const idx of slots) {
      setProgress(prev => [...prev, `Generating slot ${idx}…`]);
      try {
        const res = await fetch("/api/admin/adventures/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotIndices: [idx] }),
          credentials: "include",
        });
        const data = await res.json();
        if (data.generated) {
          ok++;
          setProgress(prev => [...prev.slice(0, -1), `✓ Slot ${idx}: ${data.results?.[0]?.title ?? "done"}`]);
        } else {
          failed++;
          setProgress(prev => [...prev.slice(0, -1), `✗ Slot ${idx}: ${data.results?.[0]?.error ?? "failed"}`]);
        }
      } catch (e) {
        failed++;
        setProgress(prev => [...prev.slice(0, -1), `✗ Slot ${idx}: ${String(e)}`]);
      }
      onGenerated();
    }

    setProgress(prev => [...prev, `Done — ${ok} generated, ${failed} failed`]);
    setLoading(false);
  }

  return (
    <div style={S.genPanel}>
      <h3 style={S.genTitle}>Generate public adventures</h3>
      <p style={S.genHint}>
        Leave blank to generate all 100, or specify comma-separated indices (e.g. 0,1,2). Generates one at a time to avoid timeouts.
      </p>
      <div style={S.genRow}>
        <input
          style={S.genInput}
          placeholder="Slot indices (blank = all 100)"
          value={indices}
          onChange={e => setIndices(e.target.value)}
        />
        <button style={S.genBtn} onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>
      {progress.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#555", maxHeight: 120, overflowY: "auto" }}>
          {progress.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Draft list item ──────────────────────────────────────────────────────────

function DraftListItem({ draft, active, onClick }: { draft: Draft; active: boolean; onClick: () => void }) {
  const emoji = ACTIVITY_EMOJI[draft.slot.activity] ?? "🗺️";
  const date  = new Date(draft.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <button
      style={{ ...S.listItem, ...(active ? S.listItemActive : {}) }}
      onClick={onClick}
    >
      <span style={S.listEmoji}>{emoji}</span>
      <span style={S.listBody}>
        <span style={S.listTitle}>{draft.adventure.title}</span>
        <span style={S.listMeta}>{draft.slot.country} · {draft.slot.activity} · {draft.slot.duration}d · {date}</span>
      </span>
      {draft.meta.tags?.[0] && (
        <span style={{ ...S.tag, backgroundColor: LEVEL_COLOR[draft.slot.level] + "33", color: LEVEL_COLOR[draft.slot.level] }}>
          {draft.slot.level}
        </span>
      )}
    </button>
  );
}

// ─── Draft detail ─────────────────────────────────────────────────────────────

function DraftDetail({ draft, onApprove, onReject }: {
  draft: Draft;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/adventures/drafts/${draft.id}/approve`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) onApprove(draft.id);
      else {
        const d = await res.json();
        alert(`Approve failed: ${d.error}`);
      }
    } finally { setBusy(false); }
  }

  async function reject() {
    if (!confirm("Reject this draft?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/adventures/drafts/${draft.id}/reject`, {
        method: "POST", credentials: "include",
      });
      onReject(draft.id);
    } finally { setBusy(false); }
  }

  const adv   = draft.adventure;
  const meta  = draft.meta;
  const emoji = ACTIVITY_EMOJI[draft.slot.activity] ?? "🗺️";

  return (
    <div style={S.detail}>
      {/* Header */}
      <div style={S.detailHeader}>
        <div style={S.detailTitle}>
          <span style={{ fontSize: 22 }}>{emoji}</span>
          <div>
            <h2 style={S.detailName}>{adv.title}</h2>
            <p style={S.detailSub}>
              {adv.region} · {adv.activity_type} · {adv.duration_days} days ·{" "}
              <span style={{ color: LEVEL_COLOR[draft.slot.level] }}>{draft.slot.level}</span> ·{" "}
              {BUDGET_LABEL[draft.slot.budget] ?? draft.slot.budget}
            </p>
          </div>
        </div>
        <div style={S.detailActions}>
          <button style={S.rejectBtn} onClick={reject}  disabled={busy}>Reject</button>
          <button style={S.approveBtn} onClick={approve} disabled={busy}>{busy ? "Saving…" : "Approve & Publish"}</button>
        </div>
      </div>

      {/* Description */}
      <p style={S.desc}>{adv.description}</p>

      {/* Meta tags */}
      {meta.tags && meta.tags.length > 0 && (
        <div style={S.tagRow}>
          {meta.tags.map(t => <span key={t} style={S.tagPill}>{t}</span>)}
          {meta.avgDistanceKm != null && <span style={S.tagPill}>{meta.avgDistanceKm} km/day avg</span>}
          {meta.avgElevationM != null  && <span style={S.tagPill}>{meta.avgElevationM} m/day avg</span>}
          {meta.coords && <span style={S.tagPill}>📍 [{meta.coords[0].toFixed(2)}, {meta.coords[1].toFixed(2)}]</span>}
        </div>
      )}

      {/* QA notes */}
      {draft.qa_notes && (
        <div style={S.qaBanner}>
          <strong>QA:</strong> {draft.qa_notes}
        </div>
      )}

      {/* Day-by-day */}
      <h3 style={S.sectionTitle}>Itinerary</h3>
      <div style={S.dayList}>
        {adv.days.map(day => (
          <div key={day.day_number} style={S.dayCard}>
            <div style={S.dayHeader}>
              <span style={S.dayBadge}>Day {day.day_number}</span>
              <span style={S.dayTitle}>{day.title}</span>
              <span style={S.dayStat}>{fmt(day.distance_km, "km")} · {fmt(day.elevation_gain_m, "m↑")}</span>
            </div>
            <p style={S.dayDesc}>{day.description}</p>
            {day.route_notes && <p style={S.routeNotes}>{day.route_notes}</p>}
            <p style={S.endLoc}>Ends: {day.end_location}</p>
          </div>
        ))}
      </div>

      {/* Accommodation */}
      {draft.accommodation_stops.length > 0 && (
        <>
          <h3 style={S.sectionTitle}>Accommodation</h3>
          <div style={S.accomList}>
            {draft.accommodation_stops.map((stop, i) => (
              <div key={i} style={S.accomCard}>
                <div style={S.accomHeader}>
                  <strong>{stop.location}</strong>
                  <span style={S.accomNights}>Nights {stop.night_numbers.join(", ")}</span>
                </div>
                {stop.notes && <p style={S.accomNotes}>{stop.notes}</p>}
                <div style={S.accomOptions}>
                  {stop.options?.map((opt, j) => (
                    <div key={j} style={S.accomOpt}>
                      <span style={S.accomName}>{opt.name}</span>
                      <span style={S.accomType}>{opt.type} · {BUDGET_LABEL[opt.price_range] ?? opt.price_range}</span>
                      {opt.price_per_night_eur != null && (
                        <span style={S.accomPrice}>€{opt.price_per_night_eur}/night</span>
                      )}
                      <p style={S.accomDesc}>{opt.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAdventuresPage() {
  const [drafts,   setDrafts]   = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [tab,      setTab]      = useState<"draft" | "approved" | "rejected">("draft");
  const [loading,  setLoading]  = useState(false);

  const loadDrafts = useCallback(async (status: "draft" | "approved" | "rejected") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/adventures/drafts?status=${status}`, { credentials: "include" });
      if (res.status === 403) { alert("Access denied — you must be marked as admin."); return; }
      setDrafts(await res.json());
      setSelected(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDrafts(tab); }, [tab, loadDrafts]);

  function handleApprove(id: string) {
    setDrafts(prev => prev.filter(d => d.id !== id));
    setSelected(null);
  }
  function handleReject(id: string) {
    setDrafts(prev => prev.filter(d => d.id !== id));
    setSelected(null);
  }

  return (
    <div style={S.page}>
      <div style={S.sidebar}>
        <h1 style={S.sidebarTitle}>Adventure Admin</h1>

        <GeneratePanel onGenerated={() => loadDrafts(tab)} />

        {/* Tab strip */}
        <div style={S.tabs}>
          {(["draft", "approved", "rejected"] as const).map(t => (
            <button
              key={t}
              style={{ ...S.tabBtn, ...(tab === t ? S.tabBtnActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading && <p style={S.loadingText}>Loading…</p>}

        <div style={S.listScroll}>
          {drafts.length === 0 && !loading && (
            <p style={S.emptyText}>No {tab} adventures.</p>
          )}
          {drafts.map(d => (
            <DraftListItem
              key={d.id}
              draft={d}
              active={selected?.id === d.id}
              onClick={() => setSelected(d)}
            />
          ))}
        </div>
      </div>

      <div style={S.main}>
        {selected ? (
          <DraftDetail
            draft={selected}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ) : (
          <div style={S.placeholder}>
            <p style={S.placeholderText}>Select a draft to review</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles (inline — no Tailwind / CSS modules needed for admin) ─────────────

const S: Record<string, React.CSSProperties> = {
  page:        { display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", fontSize: 14, background: "#F9F9F9" },
  sidebar:     { width: 340, minWidth: 300, background: "#FFF", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", overflow: "hidden" },
  sidebarTitle:{ fontSize: 18, fontWeight: 700, padding: "16px 20px 8px", margin: 0, color: "#111" },
  main:        { flex: 1, overflow: "auto" },

  // Generate panel
  genPanel:  { padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F8F6F2" },
  genTitle:  { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#111" },
  genHint:   { margin: "0 0 8px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 },
  genRow:    { display: "flex", gap: 8 },
  genInput:  { flex: 1, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, outline: "none" },
  genBtn:    { padding: "6px 14px", background: "#1A1A1A", color: "#FFF", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 },
  genResult: { margin: "6px 0 0", fontSize: 12, color: "#6B7280" },

  // Tabs
  tabs:       { display: "flex", gap: 4, padding: "8px 12px 0", borderBottom: "1px solid #E5E7EB" },
  tabBtn:     { flex: 1, padding: "6px 0", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#6B7280", borderBottom: "2px solid transparent" },
  tabBtnActive:{ color: "#111", borderBottomColor: "#1A1A1A" },
  loadingText:{ padding: "8px 20px", fontSize: 13, color: "#6B7280" },

  // List
  listScroll:   { flex: 1, overflowY: "auto" },
  listItem:     { display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid #F3F4F6", textAlign: "left", cursor: "pointer" },
  listItemActive:{ background: "#F0F0EE" },
  listEmoji:    { fontSize: 20, marginTop: 1, flexShrink: 0 },
  listBody:     { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  listTitle:    { fontSize: 13, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  listMeta:     { fontSize: 11, color: "#9CA3AF" },
  tag:          { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0, textTransform: "capitalize" },
  emptyText:    { padding: "24px 20px", fontSize: 13, color: "#9CA3AF", textAlign: "center" },

  // Detail
  detail:       { padding: 32, maxWidth: 860 },
  detailHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 },
  detailTitle:  { display: "flex", gap: 12, alignItems: "flex-start" },
  detailName:   { margin: 0, fontSize: 22, fontWeight: 700, color: "#111", lineHeight: 1.3 },
  detailSub:    { margin: "4px 0 0", fontSize: 13, color: "#6B7280" },
  detailActions:{ display: "flex", gap: 8, flexShrink: 0 },
  approveBtn:   { padding: "8px 20px", background: "#22C55E", color: "#FFF", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  rejectBtn:    { padding: "8px 16px", background: "none", color: "#EF4444", border: "1px solid #EF4444", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },

  desc:     { margin: "0 0 12px", color: "#374151", lineHeight: 1.6, fontSize: 14 },
  tagRow:   { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  tagPill:  { fontSize: 12, padding: "3px 10px", background: "#F3F4F6", borderRadius: 999, color: "#374151" },
  qaBanner: { background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#92400E", lineHeight: 1.5 },

  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#111", margin: "20px 0 10px" },
  dayList:  { display: "flex", flexDirection: "column", gap: 10 },
  dayCard:  { background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 10, padding: 16 },
  dayHeader:{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  dayBadge: { fontSize: 11, fontWeight: 700, background: "#1A1A1A", color: "#FFF", padding: "2px 8px", borderRadius: 999 },
  dayTitle: { flex: 1, fontSize: 14, fontWeight: 600, color: "#111" },
  dayStat:  { fontSize: 12, color: "#6B7280" },
  dayDesc:  { margin: "0 0 6px", fontSize: 13, color: "#374151", lineHeight: 1.5 },
  routeNotes:{ margin: "0 0 4px", fontSize: 12, color: "#6B7280", lineHeight: 1.5, fontStyle: "italic" },
  endLoc:   { margin: 0, fontSize: 12, color: "#9CA3AF" },

  accomList:    { display: "flex", flexDirection: "column", gap: 10 },
  accomCard:    { background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 10, padding: 16 },
  accomHeader:  { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  accomNights:  { fontSize: 12, color: "#9CA3AF" },
  accomNotes:   { margin: "0 0 8px", fontSize: 12, color: "#6B7280", fontStyle: "italic" },
  accomOptions: { display: "flex", gap: 10 },
  accomOpt:     { flex: 1, background: "#F9FAFB", borderRadius: 8, padding: 12 },
  accomName:    { display: "block", fontWeight: 600, fontSize: 13, color: "#111", marginBottom: 2 },
  accomType:    { display: "block", fontSize: 12, color: "#6B7280", textTransform: "capitalize" },
  accomPrice:   { display: "block", fontSize: 13, fontWeight: 700, color: "#111", margin: "4px 0" },
  accomDesc:    { margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.4 },

  placeholder:     { display: "flex", height: "100%", alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#9CA3AF", fontSize: 15 },
};
