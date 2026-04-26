import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentType = "route" | "accommodation" | "restaurant";

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
  // General holiday focus aligned with VacationWizard focuses:
  // e.g. "beach holiday", "city break", "wellness retreat",
  // "ski holiday", "cultural tour", "food & gastronomy", "family holiday", etc.
  vacationType: z.string().min(1),
  contentTypes: z
    .array(z.enum(["route", "accommodation", "restaurant"]))
    .default(["route", "accommodation", "restaurant"]),
  maxResults: z.number().min(1).max(50).default(15),
  focusKeywords: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const MIN_SCOUT_SCORE = 0.5;
const AUTO_VERIFY_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Phase 1: DISCOVER — Claude + web search
// ---------------------------------------------------------------------------

function buildPrompt(
  region: string,
  vacationType: string,
  contentTypes: string[],
  focusKeywords: string[],
  maxResults: number
): string {
  const keywordsLine =
    focusKeywords.length > 0 ? `\nFocus keywords: ${focusKeywords.join(", ")}` : "";

  return `You are a travel research agent for TruthStay — a community-driven holiday planning platform built on authentic, peer-sourced recommendations from real travellers, not sponsored content.

RESEARCH TARGET
- Region: ${region}
- Holiday type: ${vacationType}
- Content to find: ${contentTypes.join(", ")} (up to ${maxResults} total)${keywordsLine}

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
  maxResults: number
): Promise<DiscoveredLocation[]> {
  const response = await (anthropic.messages.create as Function)(
    {
      model: MODEL,
      max_tokens: 8192,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        { role: "user", content: buildPrompt(region, vacationType, contentTypes, focusKeywords, maxResults) },
      ],
    },
    { headers: { "anthropic-beta": "web-search-2025-03-05" } }
  );

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  return parseLocations(text);
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
  // Start with Claude's self-assessed confidence, boost for multiple sources
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
  db: ReturnType<typeof createClient>,
  name: string,
  region: string,
  type: string
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
  db: ReturnType<typeof createClient>,
  locations: DiscoveredLocation[],
  runId: string,
  vacationType: string
): Promise<InsertCounts> {
  const counts: InsertCounts = { routes: 0, accommodations: 0, restaurants: 0, total: 0 };

  for (const loc of locations) {
    const score = scoutScore(loc);

    if (score < MIN_SCOUT_SCORE) continue;
    if (!loc.name?.trim()) continue;
    if (!isValidCoords(loc.coordinates)) continue;
    if (await isDuplicate(db, loc.name, loc.region ?? "", loc.type)) continue;

    const autoVerify = score >= AUTO_VERIFY_THRESHOLD;
    // Agent-only trust score: scoutScore contributes 30% weight maximum
    const initialTrustScore = score * 0.30;

    const { error } = await db.from("content_entries").insert({
      type: loc.type,
      name: loc.name.trim(),
      region: loc.region,
      activity_type: vacationType,   // stores holiday focus e.g. "beach holiday"
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  // Create tracking record
  const runId = crypto.randomUUID();
  await db.from("agent_runs").insert({
    id: runId,
    region,
    activity_type: vacationType,
    status: "running",
  });

  try {
    // Phase 1: Discover
    const discovered = await discoverLocations(
      anthropic, region, vacationType, contentTypes, focusKeywords, maxResults
    );

    // Phase 2+3: Evaluate + Create
    const counts = await createListings(db, discovered, runId, vacationType);

    // Update run record
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
        status: "completed",
        discovered: discovered.length,
        inserted: counts.total,
        breakdown: counts,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("agent_runs").update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({ runId, error: message }), { status: 500 });
  }
});
