"use client";
import { useEffect, useRef, useState } from "react";

// ─── GPX parser (browser DOMParser, no deps) ──────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Waypoint { lat: number; lng: number; name?: string; elevation?: number }
interface TrackPoint { lat: number; lng: number; elevation?: number; time?: string }

export interface GpxParsed {
  name: string;
  distance_km: number;
  duration_minutes: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: number;
  min_elevation_m: number;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  waypoints: Waypoint[];
  track_points: TrackPoint[];
  activity_type: string;
}

function parseGpx(gpxContent: string): GpxParsed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Invalid GPX file");

  const name =
    doc.querySelector("trk > name")?.textContent?.trim() ||
    doc.querySelector("name")?.textContent?.trim() ||
    "Untitled Route";

  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  const track_points: TrackPoint[] = trkpts.map(pt => ({
    lat:       parseFloat(pt.getAttribute("lat") ?? "0"),
    lng:       parseFloat(pt.getAttribute("lon") ?? "0"),
    elevation: parseFloat(pt.getElementsByTagName("ele")[0]?.textContent ?? "0") || undefined,
    time:      pt.getElementsByTagName("time")[0]?.textContent ?? undefined,
  }));

  const wpts = Array.from(doc.getElementsByTagName("wpt"));
  const waypoints: Waypoint[] = wpts.map(pt => ({
    lat:       parseFloat(pt.getAttribute("lat") ?? "0"),
    lng:       parseFloat(pt.getAttribute("lon") ?? "0"),
    name:      pt.getElementsByTagName("name")[0]?.textContent?.trim() ?? undefined,
    elevation: parseFloat(pt.getElementsByTagName("ele")[0]?.textContent ?? "0") || undefined,
  }));

  let distance_km = 0, elevation_gain_m = 0, elevation_loss_m = 0;
  let max_elevation_m = -Infinity, min_elevation_m = Infinity;

  for (let i = 1; i < track_points.length; i++) {
    const prev = track_points[i - 1];
    const curr = track_points[i];
    if (!prev || !curr) continue;
    distance_km += haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    const prevEl = prev.elevation ?? 0;
    const currEl = curr.elevation ?? 0;
    const diff = currEl - prevEl;
    if (diff > 0) elevation_gain_m += diff;
    else elevation_loss_m += Math.abs(diff);
    if (currEl > max_elevation_m) max_elevation_m = currEl;
    if (currEl < min_elevation_m) min_elevation_m = currEl;
  }

  let duration_minutes = 0;
  const firstTime = track_points[0]?.time;
  const lastTime  = track_points[track_points.length - 1]?.time;
  if (firstTime && lastTime) {
    duration_minutes = Math.round((new Date(lastTime).getTime() - new Date(firstTime).getTime()) / 60000);
  }

  const start = track_points[0] ?? waypoints[0];
  const end   = track_points[track_points.length - 1] ?? waypoints[waypoints.length - 1];

  const typeTag   = doc.querySelector("type")?.textContent?.toLowerCase() ?? "";
  const nameLower = name.toLowerCase();
  let activity_type = "hiking";
  if (typeTag.includes("cycl") || typeTag.includes("bik") || nameLower.includes("bike") || nameLower.includes("cycl")) activity_type = "cycling";
  else if (typeTag.includes("run") || typeTag.includes("trail") || nameLower.includes("run")) activity_type = "trail_running";
  else if (typeTag.includes("ski") || nameLower.includes("ski")) activity_type = "skiing";
  else if (typeTag.includes("kayak") || nameLower.includes("kayak")) activity_type = "kayaking";
  else if (typeTag.includes("climb") || nameLower.includes("climb")) activity_type = "climbing";

  return {
    name,
    distance_km:      Math.round(distance_km * 10) / 10,
    duration_minutes,
    elevation_gain_m: Math.round(elevation_gain_m),
    elevation_loss_m: Math.round(elevation_loss_m),
    max_elevation_m:  max_elevation_m === -Infinity ? 0 : Math.round(max_elevation_m),
    min_elevation_m:  min_elevation_m === Infinity  ? 0 : Math.round(min_elevation_m),
    start_lat: start?.lat ?? null,
    start_lng: start?.lng ?? null,
    end_lat:   end?.lat ?? null,
    end_lng:   end?.lng ?? null,
    waypoints,
    track_points,
    activity_type,
  };
}

// ─── Activity options ─────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  { value: "hiking",        label: "Hiking" },
  { value: "cycling",       label: "Cycling" },
  { value: "trail_running", label: "Trail Running" },
  { value: "skiing",        label: "Skiing" },
  { value: "kayaking",      label: "Kayaking" },
  { value: "climbing",      label: "Climbing" },
  { value: "other",         label: "Other" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGpxPage() {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [parsed,   setParsed]   = useState<GpxParsed | null>(null);
  const [region,   setRegion]   = useState("");
  const [activity, setActivity] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");
  const [counts,   setCounts]   = useState<{ adventures: number; adventure_days: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/gpx")
      .then(r => r.json())
      .then(d => setCounts(d))
      .catch(() => null);
  }, [saved]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setParsed(null);
    setSaved(false);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const result = parseGpx(ev.target?.result as string);
        setParsed(result);
        setActivity(result.activity_type);
      } catch (err: unknown) {
        setError((err as Error).message ?? "Failed to parse GPX");
      } finally {
        setLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    if (!parsed) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/gpx", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ parsed, region: region || "Unknown", activityType: activity }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSaved(true);
      setParsed(null);
      setRegion("");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function fmtDur(min: number) {
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "20px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <a href="/admin/curate" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
            ← Admin
          </a>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 4px", color: "#111827" }}>
            GPX Route Import
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Upload .gpx files to create public adventures in the database.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 24px 80px" }}>

        {/* DB counts */}
        {counts && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Adventures", value: counts.adventures },
              { label: "Adventure Days", value: counts.adventure_days },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
                padding: "16px 20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>{value}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
          padding: 24, marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "#111827" }}>
            Upload GPX File
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
            Distance, elevation, and activity type are extracted automatically.
          </p>

          <label style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            border: "2px dashed #d1d5db", borderRadius: 12, padding: "20px 16px",
            cursor: loading ? "not-allowed" : "pointer", background: loading ? "#f9fafb" : "#fff",
            transition: "border-color 0.15s",
          }}>
            <svg width={18} height={18} fill="none" stroke={loading ? "#9ca3af" : "#374151"} strokeWidth={2} viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 500, color: loading ? "#9ca3af" : "#374151" }}>
              {loading ? "Parsing GPX…" : "Choose .gpx file"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".gpx,application/gpx+xml,text/xml"
              style={{ display: "none" }}
              onChange={handleFile}
              disabled={loading}
            />
          </label>

          {error && (
            <div style={{
              marginTop: 12, padding: "10px 14px", background: "#fef2f2",
              border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#dc2626",
            }}>
              {error}
            </div>
          )}

          {saved && (
            <div style={{
              marginTop: 12, padding: "10px 14px", background: "#f0fdf4",
              border: "1px solid #bbf7d0", borderRadius: 10, fontSize: 13, color: "#16a34a",
            }}>
              ✓ Adventure saved to database successfully.
            </div>
          )}
        </div>

        {/* Preview + metadata */}
        {parsed && (
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
            padding: 24,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px", color: "#111827" }}>
              {parsed.name}
            </h2>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {[
                { label: "Distance",    value: `${parsed.distance_km} km` },
                { label: "Elev. gain",  value: `+${parsed.elevation_gain_m} m` },
                { label: "Elev. loss",  value: `-${parsed.elevation_loss_m} m` },
                { label: "Max alt.",    value: `${parsed.max_elevation_m} m` },
                { label: "Track pts",   value: String(parsed.track_points.length) },
                ...(parsed.duration_minutes > 0
                  ? [{ label: "Duration", value: fmtDur(parsed.duration_minutes) }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Waypoints preview */}
            {parsed.waypoints.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Waypoints ({parsed.waypoints.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {parsed.waypoints.slice(0, 8).map((wp, i) => (
                    <span key={i} style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 20,
                      background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151",
                    }}>
                      {wp.name ?? `WP ${i + 1}`}
                    </span>
                  ))}
                  {parsed.waypoints.length > 8 && (
                    <span style={{ fontSize: 12, color: "#9ca3af", padding: "3px 6px" }}>
                      +{parsed.waypoints.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Region + activity overrides */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Region
                </label>
                <input
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  placeholder="e.g. Alps, Pyrenees…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    border: "1px solid #d1d5db", borderRadius: 10,
                    padding: "9px 12px", fontSize: 14, color: "#111827",
                    background: "#f9fafb", outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Activity Type
                </label>
                <select
                  value={activity}
                  onChange={e => setActivity(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    border: "1px solid #d1d5db", borderRadius: 10,
                    padding: "9px 12px", fontSize: 14, color: "#111827",
                    background: "#f9fafb", outline: "none",
                  }}
                >
                  {ACTIVITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
                background: saving ? "#9ca3af" : "#111827", color: "#fff",
                fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save to Database"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}