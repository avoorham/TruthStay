"use client";
import { useEffect, useState, useCallback } from "react";
import { CURATOR_CONFIGS, CURATOR_REGIONS, CURATOR_ACTIVITY_TYPES } from "@/lib/agent/curator-configs";

// ─── Types ────────────────────────────────────────────────────────────────────

type RunStatus = "not_started" | "running" | "completed" | "failed";

interface AgentRun {
  status: RunStatus;
  routes_found?: number;
  accommodations_found?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

type RunMap = Record<string, AgentRun>; // key: `${activityType}:${region}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function runKey(activityType: string, region: string) {
  return `${activityType}:${region}`;
}

const ACTIVITY_LABELS: Record<string, string> = {
  hiking:        "Hiking",
  cycling:       "Cycling",
  trail_running: "Trail Running",
  skiing:        "Skiing",
  snowboarding:  "Snowboarding",
  kayaking:      "Kayaking",
  climbing:      "Climbing",
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ run }: { run: AgentRun | undefined }) {
  if (!run || run.status === "not_started") {
    return <span style={{ color: "#9ca3af", fontSize: 12 }}>Not started</span>;
  }
  if (run.status === "running") {
    return <span style={{ color: "#f59e0b", fontSize: 12 }}>⟳ Running…</span>;
  }
  if (run.status === "failed") {
    return (
      <span style={{ color: "#ef4444", fontSize: 12 }} title={run.error_message ?? ""}>
        ✗ Failed
      </span>
    );
  }
  return (
    <span style={{ color: "#22c55e", fontSize: 12 }}>
      ✓ {run.routes_found ?? 0}r / {run.accommodations_found ?? 0}a
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CuratePage() {
  const [runs, setRuns] = useState<RunMap>({});
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState<Set<string>>(new Set());
  const [runAllProgress, setRunAllProgress] = useState<{ done: number; total: number } | null>(null);

  // Fetch all statuses
  const fetchStatuses = useCallback(async () => {
    const promises = CURATOR_CONFIGS.map(async c => {
      const res = await fetch(
        `/api/admin/curate?activityType=${encodeURIComponent(c.activityType)}&region=${encodeURIComponent(c.region)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AgentRun;
      return { key: runKey(c.activityType, c.region), data };
    });

    const results = await Promise.all(promises);
    const map: RunMap = {};
    for (const r of results) {
      if (r) map[r.key] = r.data;
    }
    setRuns(map);
  }, []);

  useEffect(() => {
    fetchStatuses();
    // Poll every 10 seconds while any run is active
    const interval = setInterval(() => {
      const hasActive = Object.values(runs).some(r => r.status === "running");
      if (hasActive) fetchStatuses();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchStatuses, runs]);

  // Trigger a single run
  async function triggerRun(activityType: string, region: string) {
    const key = runKey(activityType, region);
    setTriggering(prev => new Set(prev).add(key));
    try {
      const res = await fetch("/api/admin/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType, region }),
      });
      const data = (await res.json()) as AgentRun;
      setRuns(prev => ({ ...prev, [key]: data }));
    } finally {
      setTriggering(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  // Trigger all not-started or failed runs sequentially
  async function runAll() {
    const pending = CURATOR_CONFIGS.filter(c => {
      const s = runs[runKey(c.activityType, c.region)]?.status;
      return !s || s === "not_started" || s === "failed";
    });

    setRunAllProgress({ done: 0, total: pending.length });
    setLoading(true);

    for (let i = 0; i < pending.length; i++) {
      const c = pending[i]!;
      await triggerRun(c.activityType, c.region);
      setRunAllProgress({ done: i + 1, total: pending.length });
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }

    setRunAllProgress(null);
    setLoading(false);
    await fetchStatuses();
  }

  // Summary counts
  const completed = Object.values(runs).filter(r => r.status === "completed").length;
  const running   = Object.values(runs).filter(r => r.status === "running").length;
  const failed    = Object.values(runs).filter(r => r.status === "failed").length;
  const totalRoutes = Object.values(runs).reduce((s, r) => s + (r.routes_found ?? 0), 0);
  const totalAccoms = Object.values(runs).reduce((s, r) => s + (r.accommodations_found ?? 0), 0);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Curator Agent Coverage</h1>
      <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
        Each cell represents one sport × region agent. Agents fetch 4.5+ rated routes from Komoot
        and 9.0+ rated accommodations from Booking.com, storing results in{" "}
        <code>content_entries</code> for the RAG system.
      </p>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, fontSize: 14 }}>
        <span>✓ <strong>{completed}</strong> / {CURATOR_CONFIGS.length} complete</span>
        {running > 0 && <span style={{ color: "#f59e0b" }}>⟳ {running} running</span>}
        {failed  > 0 && <span style={{ color: "#ef4444" }}>✗ {failed} failed</span>}
        <span>Routes: <strong>{totalRoutes}</strong></span>
        <span>Accommodations: <strong>{totalAccoms}</strong></span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <button
          onClick={runAll}
          disabled={loading}
          style={{
            padding: "8px 16px", background: "#111827", color: "#fff",
            border: "none", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14, opacity: loading ? 0.6 : 1,
          }}
        >
          {runAllProgress
            ? `Running… ${runAllProgress.done}/${runAllProgress.total}`
            : "Run all pending"}
        </button>
        <button
          onClick={fetchStatuses}
          style={{
            padding: "8px 16px", background: "transparent",
            border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 14,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Grid */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Sport</th>
              {CURATOR_REGIONS.map(r => (
                <th key={r} style={thStyle}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CURATOR_ACTIVITY_TYPES.map(activity => (
              <tr key={activity}>
                <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {ACTIVITY_LABELS[activity] ?? activity}
                </td>
                {CURATOR_REGIONS.map(region => {
                  const config = CURATOR_CONFIGS.find(
                    c => c.activityType === activity && c.region === region,
                  );
                  const key = runKey(activity, region);
                  const run = runs[key];
                  const isTriggering = triggering.has(key);

                  if (!config) {
                    return <td key={region} style={{ ...tdStyle, background: "#f9fafb", color: "#d1d5db" }}>—</td>;
                  }

                  const canRun = !run || run.status === "not_started" || run.status === "failed";

                  return (
                    <td key={region} style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <StatusBadge run={run} />
                        {canRun && (
                          <button
                            onClick={() => triggerRun(activity, region)}
                            disabled={isTriggering}
                            style={runBtnStyle(isTriggering)}
                          >
                            {isTriggering ? "…" : "Run"}
                          </button>
                        )}
                        {run?.status === "completed" && (
                          <button
                            onClick={() => triggerRun(activity, region)}
                            disabled={isTriggering}
                            style={{ ...runBtnStyle(isTriggering), color: "#6b7280" }}
                          >
                            Re-run
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af" }}>
        Legend: <strong>r</strong> = routes found, <strong>a</strong> = accommodations found.
        Results are stored in <code>content_entries</code> with <code>verified=true</code> and
        automatically included in the adventure planning RAG context.
      </p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  borderBottom: "2px solid #e5e7eb",
  background: "#f9fafb",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
  minWidth: 110,
};

function runBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "2px 8px",
    fontSize: 11,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    background: disabled ? "#f3f4f6" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    color: "#374151",
  };
}
