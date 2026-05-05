import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentType = "route" | "accommodation" | "restaurant" | "activity";
type SourceType  = "blog" | "instagram_profile" | "instagram_post" | "web_search";

interface RawSource {
  url:            string;
  type:           SourceType;
  author:         string;
  excerpt:        string;
  publishedDate?: string;
}

interface DiscoveredLocation {
  name:             string;
  type:             ContentType;
  region:           string;
  description:      string;
  coordinates:      { lat: number; lng: number };
  sources:          RawSource[];
  highlights:       string[];
  metadata:         Record<string, unknown>;
  confidenceScore:  number;
  confidenceReason: string;
}

interface SourceUrl {
  source_url:        string;
  source_type:       SourceType;
  source_label?:     string;
  evidence_excerpt?: string;
  first_seen_at:     string;
}

interface ScoredEntry {
  loc:                    DiscoveredLocation;
  sourceUrls:             SourceUrl[];
  independentSourceCount: number;
  trustScore:             number;
  qualityScore:           number;
  features:               Record<string, unknown>;
  coordinates:            { lat: number; lng: number };
}

interface ScoutJob {
  id:              string;
  job_type:        "scrape_source" | "run_scout";
  source_id:       string | null;
  trigger_payload: Record<string, unknown>;
  attempt_count:   number;
  max_attempts:    number;
  progress:        Record<string, unknown>;
}

interface StageSummary {
  duration_ms: number;
  [key: string]: unknown;
}

interface ResultSummary {
  stages:              Record<string, StageSummary>;
  total_duration_ms:   number;
  claude_calls:        number;
  google_places_calls: number;
  warnings:            string[];
}

type DB = ReturnType<typeof createClient>;

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL               = "claude-sonnet-4-6";
const MIN_SCOUT_SCORE     = 0.5;
const JOB_BUDGET_MS       = 120_000;  // bail before Supabase edge fn hard cap (~150s)
const MAX_EXTRACTIONS_STD = 25;
const MAX_EXTRACTIONS_EXH = 100;
const MAX_SUBPAGES        = 5;
const MAX_HTML_KB         = 50;

const CREDIBILITY: Record<string, number> = {
  blog:               1.0,
  instagram_profile:  0.85,
  instagram_post:     0.85,
  web_search:         0.5,
};

const RETRYABLE_HTTP_CODES  = [408, 429, 502, 503, 504];
const RETRYABLE_ERROR_NAMES = ["TimeoutError", "NetworkError", "AbortError"];

// ── Module-level progress state (reset per invocation) ────────────────────────

let progressState: Record<string, unknown> = {};

// ── Client factories ──────────────────────────────────────────────────────────

function makeDb(): DB {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function makeAnthropic(): Anthropic {
  return new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
}

// ── Progress helpers ──────────────────────────────────────────────────────────

async function updateProgress(db: DB, jobId: string, patch: Record<string, unknown>): Promise<void> {
  progressState = { ...progressState, ...patch };
  const { error } = await db.from("scout_jobs").update({ progress: progressState }).eq("id", jobId);
  if (error) console.warn(`[worker] progress write error: ${error.message}`);
}

// ── Timing wrapper ────────────────────────────────────────────────────────────

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - t0 };
}

// ── Stage 0: Fetch rubric from DB ─────────────────────────────────────────────

async function fetchRubric(db: DB): Promise<string> {
  try {
    const { data } = await db.from("agent_rubric").select("base_rules, rubric_text").eq("id", 1).single();
    if (!data) return "";
    const parts = [data.base_rules ?? ""].filter(Boolean);
    if (data.rubric_text) parts.push("\nLEARNED RUBRIC (from admin review patterns):\n" + data.rubric_text);
    return parts.join("\n");
  } catch {
    return "";
  }
}

// ── Stage 1: Extract — build prompts ─────────────────────────────────────────

function buildSourceScrapingPrompt(
  sourceUrls:        string[],
  region:            string,
  restrictToSources: boolean,
  rubric:            string,
  maxResults:        number,
  maxSubpages:       number,
  depth:             "standard" | "exhaustive",
): string {
  const urlList        = sourceUrls.map((u, i) => `${i + 1}. ${u}`).join("\n");
  const restrictClause = restrictToSources
    ? `\nDO NOT perform general web searches. Use ONLY the sources listed above.\n`
    : "";
  const rubricSection  = rubric ? `\nQUALITY RUBRIC (reject mentions that fail these rules):\n${rubric}\n` : "";
  const depthLine      = depth === "exhaustive"
    ? "DEPTH: Exhaustive — visit the main URL and up to 10 linked sub-pages."
    : `DEPTH: Standard — visit the main URL and up to ${maxSubpages} linked sub-pages.`;

  return `You are a travel content extraction agent for TruthStay.

Visit and extract EVERY place, accommodation, restaurant, and route mentioned in these sources:
${urlList}
${restrictClause}${rubricSection}
${depthLine}
Content limit: read at most ${MAX_HTML_KB}KB of content per URL; ignore footers and sidebars.
Return at most ${maxResults} entries total.

For each entry extract:
- name, type (route|accommodation|restaurant|activity), region (default "${region}"), description (2–3 sentences)
- coordinates (real lat/lng, never 0,0), sources (url, type: blog|instagram_profile|instagram_post|web_search, author, excerpt)
- highlights (up to 3), metadata (price range, cuisine, difficulty, etc.)
- confidenceScore (0.0–1.0), confidenceReason

OUTPUT — ONLY a valid JSON array, no prose:
[
  {
    "name": "Place name", "type": "accommodation", "region": "${region}",
    "description": "...", "coordinates": { "lat": 0.0, "lng": 0.0 },
    "sources": [{ "url": "...", "type": "blog", "author": "...", "excerpt": "..." }],
    "highlights": [], "metadata": {}, "confidenceScore": 0.75, "confidenceReason": "..."
  }
]`;
}

function buildGeneralSearchPrompt(
  region:           string,
  vacationType:     string,
  contentTypes:     string[],
  focusKeywords:    string[],
  maxResults:       number,
  rubric:           string,
  demandSignals:    string,
  appendedUrls:     string[],
  depth:            "standard" | "exhaustive",
): string {
  const keywordsLine   = focusKeywords.length > 0 ? `\nFocus keywords: ${focusKeywords.join(", ")}` : "";
  const signalsSection = demandSignals ? `\n\n${demandSignals}` : "";
  const rubricSection  = rubric ? `\n\nQUALITY RUBRIC (apply at extraction time):\n${rubric}` : "";
  const curatedSection = appendedUrls.length > 0
    ? `\n\nCURATED SOURCE LIST\nAlso visit these specific sources:\n${appendedUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
    : "";
  const depthLine = depth === "exhaustive"
    ? "DEPTH: Exhaustive — run at least 10 targeted searches, cover all content types thoroughly."
    : "DEPTH: Standard — run 5–7 targeted searches.";

  return `You are a travel research agent for TruthStay — a community-driven holiday planning platform.

RESEARCH TARGET
- Region: ${region}
- Holiday type: ${vacationType}
- Content to find: ${contentTypes.join(", ")} (up to ${maxResults} total)${keywordsLine}
- ${depthLine}${signalsSection}${rubricSection}

RULES
- Only extract from authentic sources: personal travel blogs, Instagram posts, specialist travel publications.
- NEVER use TripAdvisor, Google Reviews, Booking.com, Expedia, or sponsored/commercial platforms.
- Prioritise hidden gems, locally-loved spots, and honest traveller finds.
- Each result MUST have at least one real source URL you actually visited.
- Coordinates must be real and specific (not 0,0 and not a country centroid).
- Content limit: read at most ${MAX_HTML_KB}KB per URL; ignore footers and sidebars.${curatedSection}

OUTPUT — ONLY a valid JSON array, no prose:
[
  {
    "name": "Exact place name",
    "type": "route | accommodation | restaurant | activity",
    "region": "${region}",
    "description": "2–3 sentences based on what travellers actually say",
    "coordinates": { "lat": 0.0, "lng": 0.0 },
    "sources": [{ "url": "https://...", "type": "blog", "author": "Name", "excerpt": "What they said..." }],
    "highlights": ["feature 1", "feature 2"],
    "metadata": {},
    "confidenceScore": 0.0,
    "confidenceReason": "e.g. Mentioned by 3 independent bloggers"
  }
]`;
}

// ── Stage 1: Extract — call Claude ────────────────────────────────────────────

async function discoverWithPrompt(
  anthropic: Anthropic,
  prompt:    string,
): Promise<{ locations: DiscoveredLocation[]; inputTokens: number; outputTokens: number }> {
  const response = await (anthropic.messages.create as Function)(
    {
      model:      MODEL,
      max_tokens: 8192,
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      messages:   [{ role: "user", content: prompt }],
    },
    { headers: { "anthropic-beta": "web-search-2025-03-05" } },
  );

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter(b => b.type === "text").map(b => b.text ?? "").join("\n");

  const match = text.match(/\[[\s\S]*\]/);
  let locations: DiscoveredLocation[] = [];
  if (match) {
    try { locations = JSON.parse(match[0]); } catch { locations = []; }
  }

  return {
    locations:    Array.isArray(locations) ? locations : [],
    inputTokens:  response.usage?.input_tokens  ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

// ── Stage 2: Resolve — Google Places geocoding ────────────────────────────────

async function resolveCoordinates(
  name:   string,
  region: string,
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return null;

  try {
    const query = encodeURIComponent(`${name} ${region}`);
    const url   = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
    const res   = await fetch(url);
    const data  = await res.json() as { results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };
    const loc   = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

function isValidCoords(c: { lat: number; lng: number } | undefined): boolean {
  return !!c && !(c.lat === 0 && c.lng === 0);
}

// ── Stage 3: Match — pg_trgm dedup ───────────────────────────────────────────

async function findExistingMatch(db: DB, type: string, name: string, region: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("match_content_entry", {
      p_type:   type,
      p_name:   name,
      p_region: region,
    }) as { data: Array<{ id: string; status: string }> | null; error: unknown };
    if (error || !data?.length) return false;
    return data.some(r => r.status !== "rejected");
  } catch {
    const { data } = await db
      .from("content_entries")
      .select("id")
      .ilike("name", name)
      .ilike("region", region)
      .eq("type", type)
      .limit(1);
    return (data?.length ?? 0) > 0;
  }
}

// ── Stage 4: Score — heuristic (no Claude call; see update-7 clarification) ───

function buildSourceUrls(rawSources: RawSource[]): SourceUrl[] {
  const seen   = new Set<string>();
  const result: SourceUrl[] = [];
  for (const s of (rawSources ?? [])) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    result.push({
      source_url:       s.url,
      source_type:      s.type ?? "web_search",
      source_label:     s.author  || undefined,
      evidence_excerpt: s.excerpt || undefined,
      first_seen_at:    new Date().toISOString(),
    });
  }
  return result;
}

function countIndependentSources(sourceUrls: SourceUrl[]): number {
  const domains = new Set(sourceUrls.map(s => {
    try { return new URL(s.source_url).hostname.replace(/^www\./, ""); } catch { return s.source_url; }
  }));
  return domains.size;
}

function computeTrustScore(sourceUrls: SourceUrl[], independentSourceCount: number): number {
  if (sourceUrls.length === 0) return 0;
  const avgCredibility = sourceUrls.reduce(
    (sum, s) => sum + (CREDIBILITY[s.source_type] ?? 0.5), 0
  ) / sourceUrls.length;
  return Math.min(1.0, independentSourceCount / 5) * avgCredibility;
}

function computeFeatures(loc: DiscoveredLocation, coords: { lat: number; lng: number } | undefined): Record<string, unknown> {
  const meta     = loc.metadata ?? {};
  const hasPrice = !!(
    meta.priceRange || meta.price_range || meta.pricePerNight ||
    String(loc.description ?? "").match(/\$|€|£|price|per night|from \d/i)
  );
  const hasAddress = !!(
    meta.address || String(loc.description ?? "").match(/\d+\s+\w+\s+(street|road|avenue|blvd|lane|st\.|rd\.|ave\.)/i)
  );
  const descLength = (loc.description ?? "").length;
  const qualExplanation = [
    descLength  < 80  && "short description",
    !hasPrice         && "no price info",
    !coords           && "no coordinates",
  ].filter(Boolean).join("; ") || "meets quality criteria";

  return {
    description_length:  descLength,
    has_price:           hasPrice,
    has_photos:          false,
    has_coordinates:     isValidCoords(coords),
    has_address:         hasAddress,
    highlights_count:    (loc.highlights ?? []).length,
    quality_explanation: qualExplanation,
  };
}

function computeQualityScore(features: Record<string, unknown>): number {
  let score = 0;
  if ((features.description_length as number) >= 120)  score += 0.30;
  else if ((features.description_length as number) >= 60) score += 0.15;
  if (features.has_price)       score += 0.20;
  if (features.has_coordinates) score += 0.25;
  if (features.has_address)     score += 0.15;
  if ((features.highlights_count as number) >= 2) score += 0.10;
  return Math.min(1.0, score);
}

function scoreEntry(loc: DiscoveredLocation, coords: { lat: number; lng: number } | undefined): ScoredEntry {
  const sourceUrls             = buildSourceUrls(loc.sources ?? []);
  const independentSourceCount = countIndependentSources(sourceUrls);
  const trustScore             = computeTrustScore(sourceUrls, independentSourceCount);
  const features               = computeFeatures(loc, coords);
  const qualityScore           = computeQualityScore(features);
  const finalCoords            = coords ?? (isValidCoords(loc.coordinates) ? loc.coordinates : { lat: 0, lng: 0 });
  return { loc, sourceUrls, independentSourceCount, trustScore, qualityScore, features, coordinates: finalCoords };
}

// ── Stage 5: Queue — insert with pending_review ───────────────────────────────

async function queueEntry(db: DB, entry: ScoredEntry, runId: string, vacationType: string): Promise<boolean> {
  const { loc, sourceUrls, independentSourceCount, trustScore, qualityScore, features, coordinates } = entry;
  const { error } = await db.from("content_entries").insert({
    type:                     loc.type,
    name:                     loc.name.trim(),
    region:                   loc.region,
    activity_type:            vacationType,
    description:              loc.description,
    data: {
      coordinates,
      highlights:  loc.highlights ?? [],
      ...loc.metadata,
      agentRunId:  runId,
      scoutScore:  loc.confidenceScore,
      scoutReason: loc.confidenceReason,
    },
    source_urls:              sourceUrls,
    independent_source_count: independentSourceCount,
    trust_score:              trustScore,
    quality_score:            qualityScore,
    features,
    status:                   "pending_review",
    verified:                 false,
    source_type:              "agent",
    last_seen_at:             new Date().toISOString(),
  });
  if (error) {
    console.warn(`[worker] insert failed for "${loc.name}": ${error.message}`);
    return false;
  }
  return true;
}

// ── Demand signals (for run_scout jobs) ───────────────────────────────────────

async function getDemandSignals(db: DB, region: string): Promise<string> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await db
      .from("user_interactions")
      .select("session_activity_type, session_vacation_type, interaction_weight, content_entry_id")
      .ilike("session_region", `%${region}%`)
      .gte("created_at", since) as { data: Array<Record<string, unknown>> | null };

    if (!rows?.length) return "";

    const activityTally: Record<string, number> = {};
    const gapCounts:     Record<string, number> = {};

    for (const r of rows) {
      const at = String(r.session_activity_type ?? "unknown");
      activityTally[at] = (activityTally[at] ?? 0) + 1;
      if (!r.content_entry_id && r.session_activity_type) {
        const key = `${r.session_activity_type} in ${region}`;
        gapCounts[key] = (gapCounts[key] ?? 0) + 1;
      }
    }

    const topActivities = Object.entries(activityTally)
      .sort(([, a], [, b]) => b - a).slice(0, 5).map(([t, c]) => `${t} (${c})`);
    const gapList = Object.entries(gapCounts)
      .sort(([, a], [, b]) => b - a).slice(0, 5).map(([k]) => k);

    const lines = ["USER DEMAND SIGNALS (past 30 days):"];
    if (topActivities.length) lines.push(`- Most searched activity types: ${topActivities.join(", ")}`);
    if (gapList.length)       lines.push(`- Content gaps: ${gapList.join(", ")}`);
    lines.push("", "PRIORITISE content that fills the gaps.");
    return lines.join("\n");
  } catch {
    return "";
  }
}

// ── Stages 2–5 shared pipeline ────────────────────────────────────────────────

async function runResolveMatchScoreQueue(
  db:            DB,
  discovered:    DiscoveredLocation[],
  defaultRegion: string,
  vacationType:  string,
  runId:         string,
  jobId:         string,
  summary:       ResultSummary,
  jobStart:      number,
): Promise<number> {
  const stagesCompleted: string[] = (progressState.stages_completed as string[] ?? []).slice();

  // ── Stage 2: RESOLVE ─────────────────────────────────────────────────────────
  // Budget check: bail with requeue if < 10s left
  if (Date.now() - jobStart > JOB_BUDGET_MS - 10_000) {
    console.warn("[worker] approaching timeout budget before Stage 2 — requeuing");
    return -1;  // signal timeout to caller
  }

  await updateProgress(db, jobId, { stage: "resolve", stage_started_at: new Date().toISOString(), stages_completed: stagesCompleted });

  const resolveStart = Date.now();
  const toStage3: Array<{ loc: DiscoveredLocation; coords: { lat: number; lng: number } }> = [];
  let googleCalls  = 0;
  let resolvedCnt  = 0;
  let skippedCnt   = 0;

  for (const loc of discovered) {
    if (!loc.name?.trim()) continue;
    if ((loc.confidenceScore ?? 0) < MIN_SCOUT_SCORE) { skippedCnt++; continue; }

    let coords: { lat: number; lng: number } | null = isValidCoords(loc.coordinates) ? loc.coordinates : null;

    if (!coords) {
      coords = await resolveCoordinates(loc.name, loc.region ?? defaultRegion);
      googleCalls++;
      if (!coords) {
        // Per Step 5c cap: skip if Google Places returns 0 results
        summary.warnings.push(`Stage 2: no coordinates for "${loc.name}" — skipped`);
        continue;
      }
      resolvedCnt++;
    }

    toStage3.push({ loc: { ...loc, region: loc.region ?? defaultRegion }, coords });
  }

  summary.stages.resolve = {
    duration_ms: Date.now() - resolveStart,
    resolved:    resolvedCnt,
    skipped:     skippedCnt,
  };
  summary.google_places_calls += googleCalls;

  stagesCompleted.push("resolve");
  await updateProgress(db, jobId, {
    stages_completed:       stagesCompleted,
    extractions_resolved:   toStage3.length,
  });

  // ── Stage 3: MATCH ───────────────────────────────────────────────────────────
  await updateProgress(db, jobId, { stage: "match", stage_started_at: new Date().toISOString() });

  const matchStart = Date.now();
  const toScore:   Array<{ loc: DiscoveredLocation; coords: { lat: number; lng: number } }> = [];
  let duplicateCnt = 0;

  for (const { loc, coords } of toStage3) {
    const isDuplicate = await findExistingMatch(db, loc.type ?? "activity", loc.name, loc.region);
    if (isDuplicate) { duplicateCnt++; continue; }
    toScore.push({ loc, coords });
  }

  summary.stages.match = {
    duration_ms: Date.now() - matchStart,
    new:         toScore.length,
    duplicates:  duplicateCnt,
  };

  stagesCompleted.push("match");
  await updateProgress(db, jobId, {
    stages_completed:       stagesCompleted,
    extractions_matched:    toScore.length,
  });

  // ── Stage 4: SCORE ───────────────────────────────────────────────────────────
  await updateProgress(db, jobId, { stage: "score", stage_started_at: new Date().toISOString() });

  const scoreStart = Date.now();
  const scored     = toScore.map(({ loc, coords }) => scoreEntry(loc, coords));

  summary.stages.score = { duration_ms: Date.now() - scoreStart, scored: scored.length };

  stagesCompleted.push("score");
  await updateProgress(db, jobId, { stages_completed: stagesCompleted });

  // ── Stage 5: QUEUE ───────────────────────────────────────────────────────────
  await updateProgress(db, jobId, { stage: "queue", stage_started_at: new Date().toISOString() });

  const queueStart = Date.now();
  let queued = 0;
  for (const entry of scored) {
    const inserted = await queueEntry(db, entry, runId, vacationType);
    if (inserted) queued++;
  }

  summary.stages.queue = { duration_ms: Date.now() - queueStart, queued };

  stagesCompleted.push("queue");
  await updateProgress(db, jobId, {
    stage:             "done",
    stages_completed:  stagesCompleted,
    entries_queued:    queued,
  });

  return queued;
}

// ── Pipeline: scrape_source ───────────────────────────────────────────────────

async function runScrapePipeline(
  db:       DB,
  anthropic: Anthropic,
  job:      ScoutJob,
  summary:  ResultSummary,
  jobStart: number,
): Promise<number> {
  const { data: source } = await db
    .from("content_sources")
    .select("id, url, type, label, region")
    .eq("id", job.source_id!)
    .single() as { data: { id: string; url: string; type: string; label: string; region: string | null } | null };

  if (!source) throw new Error(`Source ${job.source_id} not found`);

  const depth      = (job.trigger_payload.mode === "exhaustive") ? "exhaustive" : "standard";
  const maxResults = depth === "exhaustive" ? MAX_EXTRACTIONS_EXH : MAX_EXTRACTIONS_STD;
  const region     = source.region ?? "Europe";
  const rubric     = await fetchRubric(db);

  // Stage 1: Extract — with checkpoint re-entrancy
  let discovered: DiscoveredLocation[];

  const cached = job.progress?.extractions;
  if (Array.isArray(cached) && cached.length > 0) {
    // Re-entry after timeout: skip Stage 1, use checkpointed extractions
    discovered = cached as DiscoveredLocation[];
    console.log(`[worker] Stage 1 skipped (re-entry) — using ${discovered.length} cached extractions`);
    summary.stages.extract = { duration_ms: 0, extractions: discovered.length, cached: true };
    summary.claude_calls   = 0;
  } else {
    await updateProgress(db, job.id, { stage: "extract", stage_started_at: new Date().toISOString() });

    const { result, durationMs } = await timed(() =>
      discoverWithPrompt(anthropic, buildSourceScrapingPrompt(
        [source.url], region, false, rubric, maxResults, MAX_SUBPAGES, depth,
      ))
    );

    let locations = result.locations;
    const capped  = locations.length > maxResults;
    if (capped) {
      summary.warnings.push(`Stage 1: capped at ${maxResults} (found ${locations.length})`);
      locations = locations.slice(0, maxResults);
    }

    discovered             = locations;
    summary.stages.extract = { duration_ms: durationMs, extractions: discovered.length, capped };
    summary.claude_calls   = 1;

    // Checkpoint after Stage 1 so a timeout resumption can skip straight to Stage 2
    const stagesCompleted = ["extract"];
    await updateProgress(db, job.id, {
      stages_completed:  stagesCompleted,
      extractions_found: discovered.length,
      extractions:       discovered,   // checkpoint data
    });
  }

  const runId    = crypto.randomUUID();
  const queued   = await runResolveMatchScoreQueue(
    db, discovered, region, `source_scrape:${job.source_id}`, runId, job.id, summary, jobStart,
  );

  if (queued === -1) {
    // Timeout signal: caller handles requeue
    throw Object.assign(new Error("Soft timeout at stage boundary"), { name: "TimeoutError" });
  }

  return queued;
}

// ── Pipeline: run_scout ───────────────────────────────────────────────────────

async function runScoutPipeline(
  db:       DB,
  anthropic: Anthropic,
  job:      ScoutJob,
  summary:  ResultSummary,
  jobStart: number,
): Promise<number> {
  const p = job.trigger_payload;

  const region           = String(p.region ?? "Europe");
  const vacationType     = String(p.vacationType ?? "Active Holiday");
  const contentTypes     = (p.contentTypes as string[] | undefined) ?? ["route", "accommodation", "restaurant"];
  const maxResults       = Math.min(Number(p.maxResults ?? 15), MAX_EXTRACTIONS_STD);
  const focusKeywords    = (p.focusKeywords as string[] | undefined) ?? [];
  const includeActiveSrcs = Boolean(p.includeActiveSources);
  const depth            = (p.depth === "exhaustive") ? "exhaustive" : "standard";
  const sourceUrls       = (p.sourceUrls as string[] | undefined) ?? [];
  const restrictToSrcs   = Boolean(p.restrictToSources);
  const isSourceMode     = sourceUrls.length > 0;

  const rubric     = await fetchRubric(db);
  let demandSignals = "";
  let appendedUrls: string[] = [];

  if (!isSourceMode) {
    demandSignals = await getDemandSignals(db, region);
    if (includeActiveSrcs) {
      try {
        const { data: activeSources } = await db
          .from("content_sources")
          .select("url")
          .eq("status", "active")
          .or(`region.ilike.%${region}%,region.is.null`);
        appendedUrls = (activeSources ?? []).map((r: { url: string }) => r.url);
      } catch { /* non-fatal */ }
    }
  }

  // Stage 1: Extract — with checkpoint
  let discovered: DiscoveredLocation[];

  const cached = job.progress?.extractions;
  if (Array.isArray(cached) && cached.length > 0) {
    discovered             = cached as DiscoveredLocation[];
    summary.stages.extract = { duration_ms: 0, extractions: discovered.length, cached: true };
    summary.claude_calls   = 0;
    console.log(`[worker] Stage 1 skipped (re-entry) — ${discovered.length} cached extractions`);
  } else {
    await updateProgress(db, job.id, { stage: "extract", stage_started_at: new Date().toISOString() });

    const prompt = isSourceMode
      ? buildSourceScrapingPrompt(sourceUrls, region, restrictToSrcs, rubric, maxResults, MAX_SUBPAGES, depth)
      : buildGeneralSearchPrompt(region, vacationType, contentTypes, focusKeywords, maxResults, rubric, demandSignals, appendedUrls, depth);

    const { result, durationMs } = await timed(() => discoverWithPrompt(anthropic, prompt));

    let locations = result.locations;
    const cap     = depth === "exhaustive" ? MAX_EXTRACTIONS_EXH : MAX_EXTRACTIONS_STD;
    const capped  = locations.length > cap;
    if (capped) {
      summary.warnings.push(`Stage 1: capped at ${cap} (found ${locations.length})`);
      locations = locations.slice(0, cap);
    }

    discovered             = locations;
    summary.stages.extract = { duration_ms: durationMs, extractions: discovered.length, capped };
    summary.claude_calls   = 1;

    const stagesCompleted = ["extract"];
    await updateProgress(db, job.id, {
      stages_completed:  stagesCompleted,
      extractions_found: discovered.length,
      extractions:       discovered,
    });
  }

  const runId  = crypto.randomUUID();
  const queued = await runResolveMatchScoreQueue(
    db, discovered, region, vacationType, runId, job.id, summary, jobStart,
  );

  if (queued === -1) {
    throw Object.assign(new Error("Soft timeout at stage boundary"), { name: "TimeoutError" });
  }

  return queued;
}

// ── Retry / failure logic ─────────────────────────────────────────────────────

function isRetryable(err: unknown): { retry: boolean; code: string } {
  const e = err as Record<string, unknown>;
  if (e?.status && RETRYABLE_HTTP_CODES.includes(e.status as number)) {
    return { retry: true, code: `HTTP_${e.status}` };
  }
  if (e?.name && RETRYABLE_ERROR_NAMES.includes(e.name as string)) {
    return { retry: true, code: e.name as string };
  }
  if ((e?.message as string)?.match(/timeout|ECONNRESET|ENOTFOUND/i)) {
    return { retry: true, code: "NETWORK" };
  }
  return { retry: false, code: "PERMANENT" };
}

async function handleFailure(
  db:       DB,
  job:      ScoutJob,
  err:      unknown,
  summary:  ResultSummary,
  jobStart: number,
): Promise<void> {
  const e       = err as Record<string, unknown>;
  const message = (e?.message as string | undefined)?.slice(0, 500) ?? String(err).slice(0, 500);
  const { retry, code } = isRetryable(err);

  summary.total_duration_ms = Date.now() - jobStart;

  if (retry && job.attempt_count < job.max_attempts) {
    const backoffSecs = [30, 120, 600][job.attempt_count - 1] ?? 600;
    await db.from("scout_jobs").update({
      status:          "queued",
      next_attempt_at: new Date(Date.now() + backoffSecs * 1000).toISOString(),
      last_error:      message,
      last_error_code: code,
      progress:        progressState,
    }).eq("id", job.id);
    console.log(`[worker] job ${job.id} retry in ${backoffSecs}s (${code})`);
  } else {
    await db.from("scout_jobs").update({
      status:          "failed",
      finished_at:     new Date().toISOString(),
      last_error:      message,
      last_error_code: code,
      result_summary:  summary,
      progress:        progressState,
    }).eq("id", job.id);

    // Permanent failure: update source error tracking
    if (job.source_id) {
      await updateSourceOnFailure(db, job.source_id, message);
    }

    console.error(`[worker] job ${job.id} failed permanently (${code}): ${message}`);
  }
}

async function updateSourceOnFailure(db: DB, sourceId: string, errorMessage: string): Promise<void> {
  await db.from("content_sources").update({
    last_error_at:      new Date().toISOString(),
    last_error_message: errorMessage,
  }).eq("id", sourceId);

  // If 3 most-recent scrape_source jobs are all failed → mark broken
  const { data: recent } = await db
    .from("scout_jobs")
    .select("status")
    .eq("source_id", sourceId)
    .eq("job_type", "scrape_source")
    .order("created_at", { ascending: false })
    .limit(3);

  if (recent && recent.length >= 3 && recent.every((j: { status: string }) => j.status === "failed")) {
    await db.from("content_sources").update({ health: "broken" }).eq("id", sourceId);
    console.warn(`[worker] source ${sourceId} marked broken after 3 consecutive failures`);
  }
}

async function updateSourceAfterSuccess(db: DB, sourceId: string, entriesCreated: number): Promise<void> {
  const { data: src } = await db
    .from("content_sources").select("entry_count").eq("id", sourceId).single();
  await db.from("content_sources").update({
    last_scraped_at:    new Date().toISOString(),
    entry_count:        (src?.entry_count ?? 0) + entriesCreated,
    status:             "active",
    health:             "ok",   // reset health on success
    last_error_at:      null,
    last_error_message: null,
  }).eq("id", sourceId);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  // Reset per-invocation state
  progressState = {};

  const db        = makeDb();
  const anthropic = makeAnthropic();
  const jobStart  = Date.now();

  // Claim one job atomically
  const { data: claimed, error: claimError } = await db.rpc("claim_next_scout_job");
  if (claimError) {
    console.error(`[worker] claim error: ${claimError.message}`);
    return new Response("claim error", { status: 500 });
  }

  // Handle both null and empty-array return forms from the Supabase client
  const job: ScoutJob | null = Array.isArray(claimed)
    ? (claimed[0] ?? null)
    : (claimed ?? null);

  if (!job) {
    return new Response("no jobs", { status: 200 });
  }

  // Inherit any prior progress for re-entry checkpoint
  progressState = { ...(job.progress ?? {}) };

  const summary: ResultSummary = {
    stages:              {},
    total_duration_ms:   0,
    claude_calls:        0,
    google_places_calls: 0,
    warnings:            [],
  };

  console.log(`[worker] claiming job ${job.id} (type=${job.job_type}, attempt=${job.attempt_count})`);
  await updateProgress(db, job.id, {
    stage:             "starting",
    stage_started_at:  new Date().toISOString(),
    stages_completed:  progressState.stages_completed ?? [],
  });

  try {
    let entriesCreated = 0;

    if (job.job_type === "scrape_source") {
      entriesCreated = await runScrapePipeline(db, anthropic, job, summary, jobStart);
    } else if (job.job_type === "run_scout") {
      entriesCreated = await runScoutPipeline(db, anthropic, job, summary, jobStart);
    }

    summary.total_duration_ms = Date.now() - jobStart;

    await db.from("scout_jobs").update({
      status:          "done",
      finished_at:     new Date().toISOString(),
      entries_created: entriesCreated,
      result_summary:  summary,
      progress:        progressState,
    }).eq("id", job.id);

    // Update source stats on successful scrape
    if (job.job_type === "scrape_source" && job.source_id) {
      await updateSourceAfterSuccess(db, job.source_id, entriesCreated);
    }

    console.log(`[worker] job ${job.id} done — ${entriesCreated} entries queued (${summary.total_duration_ms}ms)`);
    return new Response("ok", { status: 200 });

  } catch (err) {
    await handleFailure(db, job, err, summary, jobStart);
    // Always return 200 to the cron caller — job-level errors are tracked in the DB
    return new Response("ok", { status: 200 });
  }
});
