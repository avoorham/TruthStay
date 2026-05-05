import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentType = "route" | "accommodation" | "restaurant" | "activity";
type SourceType  = "blog" | "instagram_profile" | "instagram_post" | "web_search";
type SupabaseClient = ReturnType<typeof createClient>;

interface RawSource {
  url:           string;
  type:          SourceType;
  author:        string;
  excerpt:       string;
  publishedDate?: string;
}

interface DiscoveredLocation {
  name:            string;
  type:            ContentType;
  region:          string;
  description:     string;
  coordinates:     { lat: number; lng: number };
  sources:         RawSource[];
  highlights:      string[];
  metadata:        Record<string, unknown>;
  confidenceScore: number;
  confidenceReason: string;
}

interface SourceUrl {
  source_url:       string;
  source_type:      SourceType;
  source_label?:    string;
  evidence_url?:    string;
  evidence_excerpt?: string;
  first_seen_at:    string;
}

interface ScoredEntry {
  loc:                     DiscoveredLocation;
  sourceUrls:              SourceUrl[];
  independentSourceCount:  number;
  trustScore:              number;
  qualityScore:            number;
  features:                Record<string, unknown>;
  coordinates:             { lat: number; lng: number };
}

interface InsertCounts {
  routes:         number;
  accommodations: number;
  restaurants:    number;
  activities:     number;
  total:          number;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  region:               z.string().min(1),
  vacationType:         z.string().min(1),
  contentTypes:         z.array(z.enum(["route", "accommodation", "restaurant", "activity"])).default(["route", "accommodation", "restaurant"]),
  maxResults:           z.number().min(1).max(50).default(15),
  focusKeywords:        z.array(z.string()).default([]),
  sourceUrls:           z.array(z.string().url()).optional(),
  includeActiveSources: z.boolean().optional(),
  restrictToSources:    z.boolean().optional(),
  sourceId:             z.string().optional(),
  // New source-first fields (update-6)
  focusType:            z.enum(["route", "accommodation", "restaurant", "activity"]).optional(),
  regionFilter:         z.string().optional(),
  depth:                z.enum(["standard", "exhaustive"]).default("standard"),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL                  = "claude-sonnet-4-6";
const MIN_SCOUT_SCORE        = 0.5;
const COST_PER_INPUT_TOKEN   = 0.000003;   // $3 / MTok
const COST_PER_OUTPUT_TOKEN  = 0.000015;   // $15 / MTok
const ESTIMATED_COST_USD     = 3.00;

// Source credibility weights for trust score
const CREDIBILITY: Record<SourceType, number> = {
  blog:               1.0,
  instagram_profile:  0.85,
  instagram_post:     0.85,
  web_search:         0.5,
};

// ---------------------------------------------------------------------------
// Stage 0: Fetch rubric from DB
// ---------------------------------------------------------------------------

async function fetchRubric(db: SupabaseClient): Promise<string> {
  try {
    const { data } = await db
      .from("agent_rubric")
      .select("base_rules, rubric_text")
      .eq("id", 1)
      .single();
    if (!data) return "";
    const parts = [data.base_rules ?? ""].filter(Boolean);
    if (data.rubric_text) parts.push("\nLEARNED RUBRIC (from admin review patterns):\n" + data.rubric_text);
    return parts.join("\n");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Demand signals
// ---------------------------------------------------------------------------

interface ActivityCount { type: string; count: number }
interface DemandSignals {
  popularActivities:    ActivityCount[];
  popularVacationTypes: ActivityCount[];
  topPerformingNames:   string[];
  underperformingNames: string[];
  gapSearches:          string[];
}

function countByField(rows: Array<Record<string, unknown>>, field: string): ActivityCount[] {
  const tally: Record<string, number> = {};
  for (const row of rows) {
    const val = String(row[field] ?? "unknown");
    tally[val] = (tally[val] ?? 0) + 1;
  }
  return Object.entries(tally).sort(([, a], [, b]) => b - a).slice(0, 5).map(([type, count]) => ({ type, count }));
}

async function getRegionDemandSignals(db: SupabaseClient, region: string): Promise<DemandSignals> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: interactions } = await db
    .from("user_interactions")
    .select("session_activity_type, session_vacation_type, interaction_type, interaction_weight, content_entry_id")
    .ilike("session_region", `%${region}%`)
    .gte("created_at", since) as { data: Array<Record<string, unknown>> | null };

  const rows = interactions ?? [];
  const popularActivities    = countByField(rows, "session_activity_type");
  const popularVacationTypes = countByField(rows, "session_vacation_type");
  const topSet   = new Set<string>();
  const underSet = new Set<string>();
  for (const r of rows) {
    const id = r.content_entry_id as string | null;
    if (!id) continue;
    const w = Number(r.interaction_weight ?? 0);
    if (w >= 0.5)  topSet.add(id);
    if (w <= -0.3) underSet.add(id);
  }
  const [topData, underData] = await Promise.all([
    topSet.size   > 0 ? db.from("content_entries").select("name").in("id", [...topSet].slice(0, 10)).then(r => r.data ?? [])   : Promise.resolve([]),
    underSet.size > 0 ? db.from("content_entries").select("name").in("id", [...underSet].slice(0, 10)).then(r => r.data ?? []) : Promise.resolve([]),
  ]);
  const gapCounts: Record<string, number> = {};
  for (const r of rows.filter(r => !r.content_entry_id && r.session_activity_type)) {
    const key = `${r.session_activity_type ?? "unknown"} in ${region}`;
    gapCounts[key] = (gapCounts[key] ?? 0) + 1;
  }
  return {
    popularActivities,
    popularVacationTypes,
    topPerformingNames:   (topData as Array<{ name: string }>).map(e => e.name),
    underperformingNames: (underData as Array<{ name: string }>).map(e => e.name),
    gapSearches:          Object.entries(gapCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([k]) => k),
  };
}

function formatDemandSignals(signals: DemandSignals): string {
  if (signals.popularActivities.length === 0 && signals.gapSearches.length === 0) return "";
  const lines: string[] = ["USER DEMAND SIGNALS (past 30 days):"];
  if (signals.popularActivities.length > 0)    lines.push(`- Most searched activity types: ${signals.popularActivities.map(a => `${a.type} (${a.count})`).join(", ")}`);
  if (signals.popularVacationTypes.length > 0)  lines.push(`- Most searched vacation types: ${signals.popularVacationTypes.map(a => `${a.type} (${a.count})`).join(", ")}`);
  if (signals.topPerformingNames.length > 0)    lines.push(`- Top-performing entries: ${signals.topPerformingNames.join(", ")}`);
  if (signals.underperformingNames.length > 0)  lines.push(`- Underperforming entries: ${signals.underperformingNames.join(", ")}`);
  if (signals.gapSearches.length > 0)           lines.push(`- Content gaps: ${signals.gapSearches.join(", ")}`);
  lines.push("", "PRIORITISE finding content that fills the gaps. DEPRIORITISE content similar to underperforming entries.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Stage 1: EXTRACT — Claude + web search
// ---------------------------------------------------------------------------

function buildPrompt(
  region: string,
  vacationType: string,
  contentTypes: string[],
  focusKeywords: string[],
  maxResults: number,
  rubric = "",
  demandSignals = "",
  appendedSourceUrls: string[] = [],
  depth: "standard" | "exhaustive" = "standard",
): string {
  const keywordsLine    = focusKeywords.length > 0 ? `\nFocus keywords: ${focusKeywords.join(", ")}` : "";
  const signalsSection  = demandSignals ? `\n\n${demandSignals}` : "";
  const rubricSection   = rubric ? `\n\nQUALITY RUBRIC (apply at extraction time — reject mentions that fail these rules):\n${rubric}` : "";
  const curatedSection  = appendedSourceUrls.length > 0
    ? `\n\nCURATED SOURCE LIST\nAlso visit these specific sources:\n${appendedSourceUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
    : "";
  const depthLine = depth === "exhaustive"
    ? "\nDEPTH: Exhaustive — run at least 10 targeted searches, cover all content types thoroughly."
    : "\nDEPTH: Standard — run 5-7 targeted searches.";

  return `You are a travel research agent for TruthStay — a community-driven holiday planning platform built on authentic, peer-sourced recommendations.

RESEARCH TARGET
- Region: ${region}
- Holiday type: ${vacationType}
- Content to find: ${contentTypes.join(", ")} (up to ${maxResults} total)${keywordsLine}${depthLine}${signalsSection}${rubricSection}

RULES
- Only extract from authentic sources: personal travel blogs, Instagram posts with detailed captions, specialist travel publications.
- NEVER use TripAdvisor, Google Reviews, Booking.com, Expedia, or any sponsored/commercial platform.
- Prioritise hidden gems, locally-loved spots, and honest traveller finds.
- Each result MUST have at least one real source URL you actually found.
- Coordinates must be real and specific (not 0,0 and not a country centroid).

SEARCH STRATEGY${depthLine.replace("DEPTH: ", "")}
Run targeted web searches such as:
- "${region} ${vacationType} travel blog"
- "${region} hidden gems ${vacationType} blog"
- "${region} best ${contentTypes.join(" ")} traveller recommendation"
- "site:instagram.com ${region} ${vacationType}"
Cover all requested content types.${curatedSection}

OUTPUT
Respond with ONLY a valid JSON array — no prose, no markdown fences:
[
  {
    "name": "Exact place name",
    "type": "route | accommodation | restaurant | activity",
    "region": "${region}",
    "description": "2-3 sentences based on what travellers actually say",
    "coordinates": { "lat": 0.0, "lng": 0.0 },
    "sources": [
      { "url": "https://...", "type": "blog", "author": "Name", "excerpt": "What they said...", "publishedDate": "2025-01" }
    ],
    "highlights": ["feature 1", "feature 2"],
    "metadata": {},
    "confidenceScore": 0.0,
    "confidenceReason": "e.g. Mentioned by 3 independent bloggers"
  }
]`;
}

function buildSourceScrapingPrompt(sourceUrls: string[], region: string, restrictToSources = false, rubric = ""): string {
  const urlList        = sourceUrls.map((u, i) => `${i + 1}. ${u}`).join("\n");
  const restrictClause = restrictToSources
    ? `\nDO NOT perform general web searches. Use ONLY the priority sources above. If they yield few results, return fewer — do not supplement with other sources.\n`
    : "";
  const rubricSection  = rubric ? `\nQUALITY RUBRIC (reject mentions that fail these rules):\n${rubric}\n` : "";

  return `You are a travel content extraction agent for TruthStay.

Visit and extract EVERY place, accommodation, restaurant, and route mentioned in these sources:
${urlList}
${restrictClause}${rubricSection}
For each entry, extract:
- name, type (route|accommodation|restaurant|activity), region (default "${region}"), description (2-3 sentences)
- coordinates (real lat/lng, never 0,0), sources (url, type: blog|instagram_profile|instagram_post|web_search, author, excerpt)
- highlights (up to 3), metadata (price range, cuisine type, difficulty, etc.)
- confidenceScore (0.0-1.0), confidenceReason

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

async function discoverWithPrompt(anthropic: Anthropic, prompt: string): Promise<{ locations: DiscoveredLocation[]; inputTokens: number; outputTokens: number }> {
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
    locations: Array.isArray(locations) ? locations : [],
    inputTokens:  response.usage?.input_tokens  ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Stage 2: RESOLVE — Google Places geocoding
// ---------------------------------------------------------------------------

async function resolveCoordinates(name: string, region: string): Promise<{ lat: number; lng: number } | null> {
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

// ---------------------------------------------------------------------------
// Stage 3: MATCH — pg_trgm deduplication
// ---------------------------------------------------------------------------

async function findExistingMatch(db: SupabaseClient, type: string, name: string, region: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("match_content_entry", {
      p_type:   type,
      p_name:   name,
      p_region: region,
    }) as { data: Array<{ id: string; status: string }> | null; error: unknown };
    if (error || !data?.length) return false;
    // Don't skip if all matches are 'rejected' — admin decided no, honour that
    return data.some(r => r.status !== "rejected");
  } catch {
    // Fallback to exact ilike match if RPC not available
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

// ---------------------------------------------------------------------------
// Stage 4: SCORE — compute trust, quality, features, source_urls
// ---------------------------------------------------------------------------

function buildSourceUrls(rawSources: RawSource[]): SourceUrl[] {
  const seen   = new Set<string>();
  const result: SourceUrl[] = [];
  for (const s of (rawSources ?? [])) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    result.push({
      source_url:       s.url,
      source_type:      s.type ?? "web_search",
      source_label:     s.author || undefined,
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
  // Average credibility weight of unique sources
  const avgCredibility = sourceUrls.reduce((sum, s) => sum + (CREDIBILITY[s.source_type] ?? 0.5), 0) / sourceUrls.length;
  // Trust = (independent sources / 5, capped at 1) × avg credibility
  return Math.min(1.0, independentSourceCount / 5) * avgCredibility;
}

function computeFeatures(loc: DiscoveredLocation, coords: { lat: number; lng: number } | undefined): Record<string, unknown> {
  const meta  = loc.metadata ?? {};
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
    description_length: descLength,
    has_price:          hasPrice,
    has_photos:         false,                       // photos require image detection; default false
    has_coordinates:    isValidCoords(coords),
    has_address:        hasAddress,
    highlights_count:   (loc.highlights ?? []).length,
    quality_explanation: qualExplanation,
  };
}

function computeQualityScore(features: Record<string, unknown>): number {
  let score = 0;
  if ((features.description_length as number) >= 120)  score += 0.30;
  else if ((features.description_length as number) >= 60) score += 0.15;
  if (features.has_price)        score += 0.20;
  if (features.has_coordinates)  score += 0.25;
  if (features.has_address)      score += 0.15;
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

// ---------------------------------------------------------------------------
// Stage 5: QUEUE — insert with status='pending_review'
// ---------------------------------------------------------------------------

async function queueEntry(db: SupabaseClient, entry: ScoredEntry, runId: string, vacationType: string): Promise<boolean> {
  const { loc, sourceUrls, independentSourceCount, trustScore, qualityScore, features, coordinates } = entry;

  const { error } = await db.from("content_entries").insert({
    type:                     loc.type,
    name:                     loc.name.trim(),
    region:                   loc.region,
    activity_type:            vacationType,
    description:              loc.description,
    data: {
      coordinates:            coordinates,
      highlights:             loc.highlights ?? [],
      ...loc.metadata,
      agentRunId:             runId,
      scoutScore:             loc.confidenceScore,
      scoutReason:            loc.confidenceReason,
    },
    source_urls:              sourceUrls,
    independent_source_count: independentSourceCount,
    trust_score:              trustScore,
    quality_score:            qualityScore,
    features:                 features,
    status:                   "pending_review",
    verified:                 false,                 // deprecated mirror; admin approval sets both
    source_type:              "agent",
    last_seen_at:             new Date().toISOString(),
  });

  if (error) {
    console.warn(`[scout] insert failed for "${loc.name}": ${error.message}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// CFO Integration (unchanged)
// ---------------------------------------------------------------------------

async function invokeCFO(): Promise<void> {
  const supabaseUrl    = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/cfo-agent`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
      body:    JSON.stringify({ action: "process_spend_requests" }),
    });
    if (!res.ok) console.warn(`invokeCFO: CFO returned ${res.status}`);
  } catch (err) {
    console.warn(`invokeCFO: fetch failed (${err})`);
  }
}

async function submitSpendRequest(db: SupabaseClient, region: string, vacationType: string, maxResults: number, contentLibrarySize: number): Promise<string> {
  const actionSlug = `scan_${region}_${vacationType}`.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 120);
  const payload    = {
    action: actionSlug, regions: [region], vacation_types: [vacationType],
    estimated_cost_usd: ESTIMATED_COST_USD, cost_breakdown: { anthropic_api: 2.50, web_search: 0.50 },
    justification: `Content discovery for ${region} (${vacationType}). Requesting up to ${maxResults} entries. Library: ${contentLibrarySize}.`,
    expected_output: `Up to ${maxResults} new content entries`, content_library_size: contentLibrarySize, priority: "normal",
  };

  const { data: msg, error: msgErr } = await db.from("agent_messages").insert({
    from_agent: "location_scout", to_agent: "cfo", message_type: "spend_request",
    payload, priority: "normal", status: "pending",
  }).select("id").single();
  if (msgErr || !msg) throw new Error(`Failed to create spend_request: ${msgErr?.message}`);

  const { data: auth, error: authErr } = await db.from("spend_authorisations").insert({
    agent_id: "location_scout", request_message_id: msg.id, action: actionSlug,
    estimated_cost_usd: ESTIMATED_COST_USD, cost_breakdown: payload.cost_breakdown,
    justification: payload.justification, status: "pending", execution_status: "not_started",
  }).select("id").single();
  if (authErr || !auth) throw new Error(`Failed to create spend_authorisation: ${authErr?.message}`);

  await invokeCFO();

  const { data: decided, error: readErr } = await db.from("spend_authorisations").select("status, denial_reason, approved_amount_usd, conditions").eq("id", auth.id).single();
  if (readErr || !decided) throw new Error(`Failed to read spend_authorisation: ${readErr?.message}`);
  if (decided.status === "denied") throw new Error(`CFO denied spend request: ${decided.denial_reason ?? "No reason"}`);

  if (decided.status === "pending") {
    console.warn(`invokeCFO: authorisation ${auth.id} still pending — proceeding as fallback`);
    await db.from("spend_authorisations").update({ status: "approved", approved_amount_usd: ESTIMATED_COST_USD, conditions: "Fallback approval: CFO did not respond", decided_at: new Date().toISOString(), decided_by: "system", execution_status: "running" }).eq("id", auth.id);
  } else {
    await db.from("spend_authorisations").update({ execution_status: "running" }).eq("id", auth.id);
  }

  return auth.id;
}

async function reportActualSpend(db: SupabaseClient, authorisationId: string | null, runId: string, region: string, vacationType: string, inputTokens: number, outputTokens: number, discoveredCount: number, counts: InsertCounts): Promise<void> {
  const actualCost      = parseFloat((inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN).toFixed(6));
  const executionResults = { discovered: discoveredCount, inserted: counts.total, breakdown: counts };
  const writes: Promise<unknown>[] = [
    db.from("api_cost_log").insert({
      service: "anthropic",
      description: `Location Scout — ${region} (${vacationType}): ${counts.total} entries queued`,
      input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: actualCost, related_agent_run_id: runId,
    }),
  ];
  if (authorisationId) {
    writes.push(
      db.from("spend_authorisations").update({ actual_cost_usd: actualCost, execution_status: "completed", execution_results: executionResults, completed_at: new Date().toISOString() }).eq("id", authorisationId),
      db.from("agent_messages").insert({ from_agent: "location_scout", to_agent: "cfo", message_type: "spend_report", payload: { authorisation_id: authorisationId, actual_cost_usd: actualCost, input_tokens: inputTokens, output_tokens: outputTokens, results: executionResults }, priority: "normal", status: "resolved" }),
    );
  }
  await Promise.all(writes);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: unknown;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 }); }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const {
    region, vacationType, contentTypes, maxResults, focusKeywords,
    sourceUrls, includeActiveSources, restrictToSources,
    focusType, depth,
  } = parsed.data;

  // If focusType is set, narrow contentTypes to that single type
  const effectiveContentTypes = focusType ? [focusType] : contentTypes;
  const isSourceMode = (sourceUrls?.length ?? 0) > 0;

  // Source-mode truth table:
  //   isSourceMode=false, includeActiveSources=false → general web search only
  //   isSourceMode=false, includeActiveSources=true  → general web search + DB active sources appended as hints
  //   isSourceMode=true,  restrictToSources=false    → scrape sourceUrls (Claude may still supplement)
  //   isSourceMode=true,  restrictToSources=true     → scrape sourceUrls ONLY; no general search

  const db        = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  const runId = crypto.randomUUID();
  await db.from("agent_runs").insert({ id: runId, region, activity_type: vacationType, status: "running" });

  let authorisationId: string | null = null;

  try {
    // ── Stage 0: Fetch rubric ──────────────────────────────────────────────
    const rubric = await fetchRubric(db);
    if (rubric) console.log(`[scout] Rubric loaded (${rubric.length} chars)`);

    // ── CFO: submit spend request ──────────────────────────────────────────
    const { count: librarySize } = await db.from("content_entries").select("*", { count: "exact", head: true }).eq("status", "approved");
    try {
      authorisationId = await submitSpendRequest(db, region, vacationType, maxResults, librarySize ?? 0);
    } catch (cfoErr) {
      console.warn(`CFO spend check skipped: ${cfoErr}`);
    }

    // ── Demand signals + active sources (general-search mode only) ────────
    let demandSignals    = "";
    let appendedSourceUrls: string[] = [];
    if (!isSourceMode) {
      try {
        const signals = await getRegionDemandSignals(db, region);
        demandSignals = formatDemandSignals(signals);
      } catch (err) { console.warn(`[scout] Demand signals unavailable: ${err}`); }

      if (includeActiveSources) {
        try {
          const { data: activeSources } = await db.from("content_sources").select("url").eq("status", "active").or(`region.ilike.%${region}%,region.is.null`);
          appendedSourceUrls = (activeSources ?? []).map((r: { url: string }) => r.url);
          console.log(`[scout] Including ${appendedSourceUrls.length} active source(s)`);
        } catch (err) { console.warn(`[scout] Could not fetch active sources: ${err}`); }
      }
    }

    // ── Stage 1: EXTRACT ──────────────────────────────────────────────────
    console.log(`[scout] Stage 1: Extract — ${isSourceMode ? `${sourceUrls!.length} sources` : `general search`}`);
    const { locations: discovered, inputTokens, outputTokens } = isSourceMode
      ? await discoverWithPrompt(anthropic, buildSourceScrapingPrompt(sourceUrls!, region, restrictToSources, rubric))
      : await discoverWithPrompt(anthropic, buildPrompt(region, vacationType, effectiveContentTypes, focusKeywords, maxResults, rubric, demandSignals, appendedSourceUrls, depth));

    console.log(`[scout] Extracted ${discovered.length} candidates`);

    // ── Stages 2–5: Resolve → Match → Score → Queue ───────────────────────
    const counts: InsertCounts = { routes: 0, accommodations: 0, restaurants: 0, activities: 0, total: 0 };

    for (const loc of discovered) {
      if (!loc.name?.trim()) continue;
      if ((loc.confidenceScore ?? 0) < MIN_SCOUT_SCORE) continue;

      const locType   = loc.type ?? (effectiveContentTypes[0] as ContentType);
      const locRegion = loc.region ?? region;

      // Stage 2: RESOLVE — improve coordinates via Google Places
      let coords = isValidCoords(loc.coordinates) ? loc.coordinates : null;
      if (!coords) {
        coords = await resolveCoordinates(loc.name, locRegion);
        if (coords) console.log(`[scout] Stage 2: Resolved coords for "${loc.name}"`);
      }

      // Stage 3: MATCH — deduplicate via pg_trgm
      const duplicate = await findExistingMatch(db, locType, loc.name, locRegion);
      if (duplicate) {
        console.log(`[scout] Stage 3: Skipped duplicate "${loc.name}"`);
        continue;
      }

      // Stage 4: SCORE
      const scored = scoreEntry({ ...loc, type: locType, region: locRegion }, coords ?? undefined);

      // Stage 5: QUEUE
      const inserted = await queueEntry(db, scored, runId, vacationType);
      if (inserted) {
        counts.total++;
        if (locType === "route")          counts.routes++;
        else if (locType === "accommodation") counts.accommodations++;
        else if (locType === "restaurant")    counts.restaurants++;
        else if (locType === "activity")      counts.activities++;
      }
    }

    console.log(`[scout] Queued ${counts.total} new entries for review`);

    await reportActualSpend(db, authorisationId, runId, region, vacationType, inputTokens, outputTokens, discovered.length, counts);

    await db.from("agent_runs").update({
      status: "completed",
      routes_found:         counts.routes,
      accommodations_found: counts.accommodations,
      restaurants_found:    counts.restaurants,
      completed_at:         new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      runId, authorisationId, status: "completed",
      discovered: discovered.length, queued: counts.total, breakdown: counts,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("agent_runs").update({ status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", runId);
    if (authorisationId) await db.from("spend_authorisations").update({ execution_status: "failed", execution_results: { error: message }, completed_at: new Date().toISOString() }).eq("id", authorisationId);
    return new Response(JSON.stringify({ runId, authorisationId, error: message }), { status: 500 });
  }
});
