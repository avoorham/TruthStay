"use client";
import { useEffect, useState, useRef } from "react";
import { RefreshCw, Save, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rubric {
  id: number;
  base_rules: string;
  rubric_text: string | null;
  generated_from_decisions_count: number | null;
  generated_at: string | null;
  updated_at: string;
}

interface Decision {
  id: string;
  entry_id: string;
  reviewer_id: string;
  decision: "approve" | "reject" | "edit";
  reason: string | null;
  feature_snapshot: Record<string, unknown>;
  created_at: string;
}

// ── Decision row ──────────────────────────────────────────────────────────────

function DecisionRow({ d }: { d: Decision }) {
  const [open, setOpen] = useState(false);
  const snap = d.feature_snapshot ?? {};

  const badgeClass =
    d.decision === "approve" ? "bg-green-50 text-green-700 border-green-200" :
    d.decision === "reject"  ? "bg-red-50 text-red-700 border-red-200" :
                               "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition"
      >
        <span className={`inline-flex items-center text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
          {d.decision}
        </span>
        <span className="flex-1 text-xs text-slate-700 truncate">
          {d.reason ?? (snap.type as string ?? "—")}
        </span>
        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(d.created_at)}</span>
        {open ? <ChevronUp size={12} className="text-slate-400 shrink-0" /> : <ChevronDown size={12} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 bg-slate-50 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2">
            {Object.entries(snap).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">{k.replace(/_/g, " ")}</span>
                <span className="font-mono text-slate-700">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function RubricPage() {
  const [rubric, setRubric]         = useState<Rubric | null>(null);
  const [decisions, setDecisions]   = useState<Decision[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editText, setEditText]     = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [regen, setRegen]           = useState<"idle" | "running" | "done" | "error">("idle");
  const [regenMsg, setRegenMsg]     = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/scout/rubric");
    const data = await res.json();
    if (data.rubric) {
      setRubric(data.rubric);
      setEditText(data.rubric.rubric_text ?? "");
    }
    setDecisions(Array.isArray(data.decisions) ? data.decisions : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaveStatus("saving");
    const res = await fetch("/api/admin/scout/rubric", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rubric_text: editText }),
    });
    if (res.ok) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      setRubric(prev => prev ? { ...prev, rubric_text: editText } : prev);
    } else {
      setSaveStatus("error");
    }
  }

  async function handleRegenerate() {
    setRegen("running");
    setRegenMsg("");
    const res = await fetch("/api/admin/scout/rubric", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setRegen("done");
      setRegenMsg(`Generated from ${data.decisions_used} decisions.`);
      setEditText(data.rubric_text);
      setRubric(prev => prev ? {
        ...prev,
        rubric_text: data.rubric_text,
        generated_from_decisions_count: data.decisions_used,
        generated_at: new Date().toISOString(),
      } : prev);
      setTimeout(() => setRegen("idle"), 3000);
    } else {
      setRegen("error");
      setRegenMsg(data.message ?? data.error ?? "Regeneration failed.");
      setTimeout(() => setRegen("idle"), 4000);
    }
  }

  const isDirty = rubric ? editText !== (rubric.rubric_text ?? "") : false;

  return (
    <div>
      <PageHeader
        title="Scout Rubric"
        description="The rubric shapes how the Location Scout classifies and scores discoveries. Base rules are always applied; the learned rubric is generated from your review decisions."
        actions={
          <button
            onClick={load}
            className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 transition text-slate-500"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      {loading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Left column: base rules + learned rubric ── */}
          <div className="xl:col-span-2 space-y-6">

            {/* Base rules (read-only) */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Base Rules</p>
                  <p className="text-xs text-slate-500 mt-0.5">Always injected. Edit in DB directly if needed.</p>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">read-only</span>
              </div>
              <pre className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50">
                {rubric?.base_rules ?? "—"}
              </pre>
            </div>

            {/* Learned rubric (editable) */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Learned Rubric</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generated from your approve/reject patterns. Injected alongside base rules on each scout run.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {regenMsg && (
                    <span className={`text-xs ${regen === "error" ? "text-red-600" : "text-slate-500"}`}>
                      {regenMsg}
                    </span>
                  )}
                  <button
                    onClick={handleRegenerate}
                    disabled={regen === "running"}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-md px-3 py-1.5 transition"
                  >
                    <RefreshCw size={12} className={regen === "running" ? "animate-spin" : ""} />
                    {regen === "running" ? "Regenerating…" : regen === "done" ? "Done!" : "Regenerate"}
                  </button>
                </div>
              </div>

              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={14}
                placeholder="No learned rubric yet — click Regenerate to generate one from your decisions, or write one manually."
                className="w-full px-4 py-3 text-xs text-slate-700 font-mono leading-relaxed focus:outline-none resize-none"
              />

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[10px] text-slate-400">
                  {rubric?.generated_at
                    ? `Last generated ${formatDate(rubric.generated_at)} from ${rubric.generated_from_decisions_count ?? "?"} decisions`
                    : "Not yet generated"}
                </div>
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saveStatus === "saving"}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-md px-3 py-1.5 transition"
                >
                  {saveStatus === "saving" ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : saveStatus === "saved" ? (
                    <CheckCircle2 size={12} className="text-teal-400" />
                  ) : saveStatus === "error" ? (
                    <AlertCircle size={12} className="text-red-400" />
                  ) : (
                    <Save size={12} />
                  )}
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : "Save changes"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column: stats + recent decisions ── */}
          <div className="space-y-6">

            {/* Stats card */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stats</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Recent decisions loaded</span>
                  <span className="text-xs font-mono font-semibold text-slate-900">{decisions.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Approvals</span>
                  <span className="text-xs font-mono font-semibold text-green-700">
                    {decisions.filter(d => d.decision === "approve").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Rejections</span>
                  <span className="text-xs font-mono font-semibold text-red-700">
                    {decisions.filter(d => d.decision === "reject").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Edits</span>
                  <span className="text-xs font-mono font-semibold text-blue-700">
                    {decisions.filter(d => d.decision === "edit").length}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400">
                  Regenerate requires at least 10 decisions in the last 90 days.{" "}
                  {decisions.length >= 10
                    ? <span className="text-green-600 font-medium">Ready to regenerate.</span>
                    : <span className="text-amber-600 font-medium">Need {10 - decisions.length} more.</span>}
                </p>
              </div>
            </div>

            {/* Recent decisions */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">Recent Decisions</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Last {decisions.length} — click to see feature snapshot</p>
              </div>
              <div className="p-3 space-y-1.5 max-h-[480px] overflow-y-auto">
                {decisions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No decisions yet.</p>
                ) : (
                  decisions.map(d => <DecisionRow key={d.id} d={d} />)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
