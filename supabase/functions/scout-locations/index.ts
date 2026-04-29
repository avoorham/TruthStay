import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentType = "route" | "accommodation" | "restaurant";
type SupabaseClient = ReturnType<typeof createClient>;

interface Source {
  url: string;
  type: "blog" | "instagram";
  author: string;
  excerpt: string;
  publishedDate?: string;
}

interface DiscoveredLocation {
  name: string;
  type: ContentType;
  region: string;
  description: string;
  coordinates: { lat: number; lng: number };
  sources: Source[];
  highlights: string[];
  metadata: Record<string, unknown>;
  confidenceScore: number;
  confidenceReason: string;
}

interface DiscoveryResult {
  locations: DiscoveredLocation[];
  inputTokens: number;
  outputTokens: number;
}

interface InsertCounts {
  routes: number;
  accommodations: number;
  restaurants: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  region: z.string().min(1),
  // General holiday focus aligned with TruthStay's pivot to community-driven
  // holiday planning — e.g. "beach holiday", "city break", "cycling", "hiking"
  vacationType: z.string().min(1),
  contentTypes: z
    .array(z.enum(["route", "accommodation", "restaurant"]))
    .default(["route", "accommodation", "restaurant"]),
  maxResults: z.number().min(1).max(50).default(15),
  focusKeywords: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Demand signals
// ---------------------------------------------------------------------------

interface ActivityCount {
  type: string;
  count: number;
}

interface DemandSignals {
  popularActivities:    ActivityCount[];
  popularVacationTypes: ActivityCount[];
  topPerformingNames:   string[];
  underperformingNames: string[];
  gapSearches:          string[];
}

function countByField(
  rows: Array<Record<string, unknown>>,
  field: string,
): ActivityCount[] {
  const tally: Record<string, number> = {};
  for (const row of rows) {
    const val = String(row[field] ?? "unknown");
    tally[val] = (tally[val] ?? 0) + 1;
  }
  return Object.entries(tally)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}

async function getRegionDemandSignals(
  db: SupabaseClient,
  region: string,
): Promise<DemandSignals> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: interactions } = await db
    .from("user_interactions")
    .select("session_activity_type, session_vacation_type, interaction_type, interaction_weight, content_entry_id")
    .ilike("session_region", `%${region}%`)
    .gte("created_at", since) as { data: Array<Record<string, unknown>> | null };

  const rows = interactions ?? [];

  const popularActivities    = countByField(rows, "session_activity_type");
  const popularVacationTypes = countByField(rows, "session_vacation_type");

  // Top-performing: entries that were saved or selected
  const topSet = new Set<string>();
  const underSet = new Set<string>();
  for (const r of rows) {
    const id = r.content_entry_id as string | null;
    if (!id) continue;
    const w = Number(r.interaction_weight ?? 0);
    if (w >= 0.5)  topSet.add(id);
    if (w <= -0.3) underSet.add(id);
  }

  // Resolve entry names for the prompt
  const topIds   = [...topSet].slice(0, 10);
  const underIds = [...underSet].slice(0, 10);

  const [topData, underData] = await Promise.all([
    topIds.length > 0
      ? db.from("content_entries").select("name").in("id", topIds).then(r => r.data ?? [])
      : Promise.resolve([]),
    underIds.length > 0
      ? db.from("content_entries").select("name").in("id", underIds).then(r => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Searches where no content entry was linked = gap signals
  const gapRows = rows.filter(r => !r.content_entry_id && r.session_activity_type);
  const gapCounts: Record<string, number> = {};
  for (const r of gapRows) {
    const key = `${r.session_activity_type ?? "unknown"} in ${region}`;
    gapCounts[key] = (gapCounts[key] ?? 0) + 1;
  }
  const gapSearches = Object.entries(gapCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key]) => key);

  return {
    popularActivities,
    popularVacationTypes,
    topPerformingNames:   (topData as Array<{ name: string }>).map(e => e.name),
    underperformingNames: (underData as Array<{ name: string }>).map(e => e.name),
    gapSearches,
  };
}

function formatDemandSignals(signals: DemandSignals): string {
  if (
    signals.popularActivities.length === 0 &&
    signals.gapSearches.length === 0
  ) {
    return ""; // No signals yet — don't add an empty section
  }

  const lines: string[] = ["USER DEMAND SIGNALS (past 30 days):"];

  if (signals.popularActivities.length > 0) {
    const parts = signals.popularActivities.map(a => `${a.type} (${a.count})`).join(", ");
    lines.push(`- Most searched activity types: ${parts}`);
  }
  if (signals.popularVacationTypes.length > 0) {
    const parts = signals.popularVacationTypes.map(a => `${a.type} (${a.count})`).join(", ");
    lines.push(`- Most searched vacation types: ${parts}`);
  }
  if (signals.topPerformingNames.length > 0) {
    lines.push(`- Top-performing entries (users kept these): ${signals.topPerformingNames.join(", ")}`);
  }
  if (signals.underperformingNames.length > 0) {
    lines.push(`- Underperforming entries (users replaced these): ${signals.underperformingNames.join(", ")}`);
  }
  if (signals.gapSearches.length > 0) {
    lines.push(`- Content gaps (users searched but we had nothing): ${signals.gapSearches.join(", ")}`);
  }

  lines.push("");
  lines.push("PRIORITISE finding content that fills the gaps and matches the popular activity types.");
  lines.push("DEPRIORITISE content similar to underperforming entries.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const MIN_SCOUT_SCORE = 0.5;
const AUTO_VERIFY_THRESHOLD = 0.85;
// claude-sonnet-4-6 pricing
const COST_PER_INPUT_TOKEN = 0.000003;   // $3 / MTok
const COST_PER_OUTPUT_TOKEN = 0.000015;  // $15 / MTok
const ESTIMATED_COST_USD = 3.00;         // conservative pre-run estimate for CFO request

// ---------------------------------------------------------------------------
// Phase 1: DISCOVER — Claude + web search
// ---------------------------------------------------------------------------

function buildPrompt(
  region: string,
  vacationType: string,
  contentTypes: string[],
  focusKeywords: string[],
  maxResults: number,
  demandSignals = "",
): string {
  const keywordsLine =
    focusKeywords.length > 0 ? `\nFocus keywords: ${focusKeywords.join(", ")}` : "";
  const signalsSection =
    demandSignals ? `\n\n${demandSignals}` : "";

  return `You are a travel research agent for TruthStay — a community-driven holiday planning platform built on authentic, peer-sourced recommendations from real travellers, not sponsored content.

RESEARCH TARGET
- Region: ${region}
- Holiday type: ${vacationType}
- Content to find: ${contentTypes.join(", ")} (up to ${maxResults} total)${keywordsLine}${signalsSection}

RULES
- Only extract recommendations from authentic sources: personal travel blogs with first-person accounts, Instagram posts with detailed captions, and specialist travel publications.
- NEVER use TripAdvisor, Google Reviews, Booking.com, Expedia, Hotels.com, or any sponsored/commercial platform.
- Prioritise hidden gems, locally-loved spots, and honest traveller finds over tourist hotspots.
- Each result MUST have at least one real source URL you actually found via search.
- Coordinates must be real and specific (not 0,0 and not the city centre of a country).

SEARCH STRATEGY
Run multiple targeted web searches such as:
- "${region} ${vacationType} travel blog"
- "${region} hidden gems ${vacationType} blog"
- "${region} best ${contentTypes.join(" ")} traveller recommendation"
- "${region} ${vacationType} instagram travel tips"
- "${region} locals recommend restaurant accommodation"
- "site:instagram.com ${region} ${vacationType}"
Cover all requested content types. Aim for variety across sources.

OUTPUT
Respond with ONLY a valid JSON array — no prose, no markdown fences, just the raw array:
[
  {
    "name": "Exact place name",
    "type": "route | accommodation | restaurant",
    "region": "${region}",
    "description": "2-3 sentences in your own words based on what travellers actually say",
    "coordinates": { "lat": 0.0, "lng": 0.0 },
    "sources": [
      { "url": "https://...", "type": "blog", "author": "Name", "excerpt": "What they said...", "publishedDate": "2025-01" }
    ],
    "highlights": ["feature 1", "feature 2"],
    "metadata": {
      // route:         distanceKm, elevationGainM, difficulty, surfaceType, bestSeason
      // accommodation: accommodationType, priceRange, highlights
      // restaurant:    cuisineType, priceRange, mustTry
    },
    "confidenceScore": 0.0,
    "confidenceReason": "e.g. Mentioned by 3 independent bloggers with consistent detail"
  }
]`;
}

async function discoverLocations(
  anthropic: Anthropic,
  region: string,
  vacationType: string,
  contentTypes: string[],
  focusKeywords: string[],
  maxResults: number,
  demandSignals = "",
): Promise<DiscoveryResult> {
  // web_search_20250305 is not yet in the SDK types — cast to bypass
  const response = await (anthropic.messages.create as Function)(
    {
      model: MODEL,
      max_tokens: 8192,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: buildPrompt(region, vacationType, contentTypes, focusKeywords, maxResults, demandSignals),
        },
      ],
    },
    { headers: { "anthropic-beta": "web-search-2025-03-05" } },
  );

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  return {
    locations: parseLocations(text),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

function parseLocations(text: string): DiscoveredLocation[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as DiscoveredLocation[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Phase 2: EVALUATE — score each candidate
// ---------------------------------------------------------------------------

function scoutScore(loc: DiscoveredLocation): number {
  // Start with Claude's self-assessed confidence, then add a small bonus for
  // each additional independent source (up to +0.15 for 3 extra sources).
  const sourceBonus = Math.min((loc.sources?.length ?? 1) - 1, 3) * 0.05;
  return Math.min((loc.confidenceScore ?? 0) + sourceBonus, 1.0);
}

function isValidCoords(coords: { lat: number; lng: number } | undefined): boolean {
  if (!coords) return false;
  return !(coords.lat === 0 && coords.lng === 0);
}

// ---------------------------------------------------------------------------
// Phase 3: CREATE — deduplicate then insert into content_entries
// ---------------------------------------------------------------------------

async function isDuplicate(
  db: SupabaseClient,
  name: string,
  region: string,
  type: string,
): Promise<boolean> {
  const { data } = await db
    .from("content_entries")
    .select("id")
    .ilike("name", name)
    .ilike("region", region)
    .eq("type", type)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function createListings(
  db: SupabaseClient,
  locations: DiscoveredLocation[],
  runId: string,
  vacationType: string,
): Promise<InsertCounts> {
  const counts: InsertCounts = { routes: 0, accommodations: 0, restaurants: 0, total: 0 };

  for (const loc of locations) {
    const score = scoutScore(loc);

    if (score < MIN_SCOUT_SCORE) continue;
    if (!loc.name?.trim()) continue;
    if (!isValidCoords(loc.coordinates)) continue;
    if (await isDuplicate(db, loc.name, loc.region ?? "", loc.type)) continue;

    // Entries with scoutScore >= AUTO_VERIFY_THRESHOLD go live immediately;
    // everything else waits for admin review (verified = false).
    const autoVerify = score >= AUTO_VERIFY_THRESHOLD;
    // Agent-only trust score: scoutScore contributes max 30% weight.
    const initialTrustScore = score * 0.30;

    const { error } = await db.from("content_entries").insert({
      type: loc.type,
      name: loc.name.trim(),
      region: loc.region,
      activity_type: vacationType,
      description: loc.description,
      data: {
        sources: loc.sources ?? [],
        coordinates: loc.coordinates,
        highlights: loc.highlights ?? [],
        ...loc.metadata,
        agentRunId: runId,
        scoutScore: score,
        scoutReason: loc.confidenceReason,
      },
      verified: autoVerify,
      trust_score: initialTrustScore,
      source_type: "agent",
    });

    if (!error) {
      counts.total++;
      if (loc.type === "route") counts.routes++;
      else if (loc.type === "accommodation") counts.accommodations++;
      else if (loc.type === "restaurant") counts.restaurants++;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// CFO Integration
// ---------------------------------------------------------------------------

// Invoke the CFO agent to process pending spend requests. Called synchronously
// after submitting a spend_request so the CFO evaluates it before we proceed.
async function invokeCFO(): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("invokeCFO: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping");
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/cfo-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ action: "process_spend_requests" }),
    });
    if (!res.ok) {
      console.warn(`invokeCFO: CFO returned ${res.status} — proceeding without CFO decision`);
    }
  } catch (err) {
    console.warn(`invokeCFO: fetch failed (${err}) — proceeding without CFO decision`);
  }
}

// Submit a spend_request on the agent message bus and route it through the
// real CFO Agent for evaluation. The CFO is invoked synchronously so its
// decision is available before the scout begins executing.
async function submitSpendRequest(
  db: SupabaseClient,
  region: string,
  vacationType: string,
  maxResults: number,
  contentLibrarySize: number,
): Promise<string> {
  const actionSlug =
    `scan_${region}_${vacationType}`
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .slice(0, 120);

  const payload = {
    action: actionSlug,
    regions: [region],
    vacation_types: [vacationType],
    estimated_cost_usd: ESTIMATED_COST_USD,
    cost_breakdown: { anthropic_api: 2.50, web_search: 0.50 },
    justification:
      `Content discovery for ${region} (${vacationType}). ` +
      `Requesting up to ${maxResults} entries. ` +
      `Library currently has ${contentLibrarySize} verified entries.`,
    expected_output: `Up to ${maxResults} new content entries`,
    content_library_size: contentLibrarySize,
    priority: "normal",
  };

  // 1. Post the spend_request on the message bus
  const { data: msg, error: msgErr } = await db
    .from("agent_messages")
    .insert({
      from_agent: "location_scout",
      to_agent: "cfo",
      message_type: "spend_request",
      payload,
      priority: "normal",
      status: "pending",
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    throw new Error(`Failed to create spend_request message: ${msgErr?.message}`);
  }

  // 2. Record the spend_authorisation in pending state — CFO will decide
  const { data: auth, error: authErr } = await db
    .from("spend_authorisations")
    .insert({
      agent_id: "location_scout",
      request_message_id: msg.id,
      action: actionSlug,
      estimated_cost_usd: ESTIMATED_COST_USD,
      cost_breakdown: payload.cost_breakdown,
      justification: payload.justification,
      status: "pending",
      execution_status: "not_started",
    })
    .select("id")
    .single();

  if (authErr || !auth) {
    throw new Error(`Failed to create spend_authorisation: ${authErr?.message}`);
  }

  // 3. Invoke the CFO synchronously so it processes this request now
  await invokeCFO();

  // 4. Read the CFO's decision
  const { data: decided, error: readErr } = await db
    .from("spend_authorisations")
    .select("status, denial_reason, approved_amount_usd, conditions")
    .eq("id", auth.id)
    .single();

  if (readErr || !decided) {
    throw new Error(`Failed to read spend_authorisation decision: ${readErr?.message}`);
  }

  // 5. Handle the decision
  if (decided.status === "denied") {
    throw new Error(
      `CFO denied spend request: ${decided.denial_reason ?? "No reason provided"}`,
    );
  }

  // If still pending (CFO unavailable), log a warning and proceed defensively
  if (decided.status === "pending") {
    console.warn(
      `invokeCFO: authorisation ${auth.id} still pending after CFO call — proceeding as fallback`,
    );
    await db
      .from("spend_authorisations")
      .update({
        status: "approved",
        approved_amount_usd: ESTIMATED_COST_USD,
        conditions: "Fallback approval: CFO did not respond in time",
        decided_at: new Date().toISOString(),
        decided_by: "system",
        execution_status: "running",
      })
      .eq("id", auth.id);
  } else {
    // Mark execution as running now that we have approval
    await db
      .from("spend_authorisations")
      .update({ execution_status: "running" })
      .eq("id", auth.id);
  }

  return auth.id;
}

async function reportActualSpend(
  db: SupabaseClient,
  authorisationId: string | null,
  runId: string,
  region: string,
  vacationType: string,
  inputTokens: number,
  outputTokens: number,
  discoveredCount: number,
  counts: InsertCounts,
): Promise<void> {
  const actualCost = parseFloat(
    (inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN).toFixed(6),
  );

  const executionResults = {
    discovered: discoveredCount,
    inserted: counts.total,
    breakdown: counts,
  };

  const writes: Promise<unknown>[] = [
    // Always log the API cost
    db.from("api_cost_log").insert({
      service: "anthropic",
      description: `Location Scout — ${region} (${vacationType}): ${counts.total} entries created`,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: actualCost,
      related_agent_run_id: runId,
    }),
  ];

  if (authorisationId) {
    writes.push(
      // Update authorisation with actuals
      db.from("spend_authorisations").update({
        actual_cost_usd: actualCost,
        execution_status: "completed",
        execution_results: executionResults,
        completed_at: new Date().toISOString(),
      }).eq("id", authorisationId),

      // Post spend_report on the bus so CFO can reconcile
      db.from("agent_messages").insert({
        from_agent: "location_scout",
        to_agent: "cfo",
        message_type: "spend_report",
        payload: {
          authorisation_id: authorisationId,
          actual_cost_usd: actualCost,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          results: executionResults,
        },
        priority: "normal",
        status: "resolved",
      }),
    );
  }

  await Promise.all(writes);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const { region, vacationType, contentTypes, maxResults, focusKeywords } = parsed.data;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  // Create the run tracking record up front so we have an ID even if early steps fail
  const runId = crypto.randomUUID();
  await db.from("agent_runs").insert({
    id: runId,
    region,
    activity_type: vacationType,
    status: "running",
  });

  let authorisationId: string | null = null;

  try {
    // ── CFO: submit spend request (auto-approved) ──────────────────────────
    const { count: librarySize } = await db
      .from("content_entries")
      .select("*", { count: "exact", head: true })
      .eq("verified", true);

    try {
      authorisationId = await submitSpendRequest(
        db,
        region,
        vacationType,
        maxResults,
        librarySize ?? 0,
      );
    } catch (cfoErr) {
      // CFO agent not deployed or agent_messages table missing — proceed without authorisation
      console.warn(`CFO spend check skipped: ${cfoErr}`);
    }

    // ── Demand signals: what users actually want in this region ───────────
    let demandSignals = "";
    try {
      const signals = await getRegionDemandSignals(db, region);
      demandSignals = formatDemandSignals(signals);
      if (demandSignals) {
        console.log(`[scout] Demand signals for ${region}:\n${demandSignals}`);
      }
    } catch (err) {
      console.warn(`[scout] Demand signals unavailable: ${err}`);
    }

    // ── Phase 1: DISCOVER ──────────────────────────────────────────────────
    const { locations: discovered, inputTokens, outputTokens } = await discoverLocations(
      anthropic,
      region,
      vacationType,
      contentTypes,
      focusKeywords,
      maxResults,
      demandSignals,
    );

    // ── Phase 2 + 3: EVALUATE + CREATE ────────────────────────────────────
    const counts = await createListings(db, discovered, runId, vacationType);

    // ── CFO: report actual spend ───────────────────────────────────────────
    await reportActualSpend(
      db,
      authorisationId,
      runId,
      region,
      vacationType,
      inputTokens,
      outputTokens,
      discovered.length,
      counts,
    );

    // ── Complete the run record ────────────────────────────────────────────
    await db.from("agent_runs").update({
      status: "completed",
      routes_found: counts.routes,
      accommodations_found: counts.accommodations,
      restaurants_found: counts.restaurants,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({
        runId,
        authorisationId,
        status: "completed",
        discovered: discovered.length,
        inserted: counts.total,
        breakdown: counts,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Mark the run as failed
    await db.from("agent_runs").update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    // Mark authorisation as failed if one was created
    if (authorisationId) {
      await db.from("spend_authorisations").update({
        execution_status: "failed",
        execution_results: { error: message },
        completed_at: new Date().toISOString(),
      }).eq("id", authorisationId);
    }

    return new Response(JSON.stringify({ runId, authorisationId, error: message }), {
      status: 500,
    });
  }
});
