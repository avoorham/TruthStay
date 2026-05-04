# TruthStay Location Scout Agent — Implementation Spec

## 1. Overview

### What is TruthStay?

TruthStay is a community-driven holiday planning platform built on honest, real-world recommendations from friends, family, and fellow travellers. Users discover and plan vacations based on authentic reviews and insider tips — not sponsored content or algorithmic suggestions — from a trusted network of people who've actually been there.

Through a conversational AI interface, users describe the kind of holiday they're looking for and receive personalised itineraries shaped by genuine community feedback: where to stay, where to eat, what to do, and what to avoid.

### What does this agent do?

The **Location Scout Agent** proactively discovers and curates travel content to seed TruthStay's database before the community scales. It builds a base library of top attractions, routes, accommodations, and restaurants sourced primarily from **travel bloggers and Instagram** — not TripAdvisor or Google Reviews — to align with TruthStay's authentic, peer-sourced brand.

### Pipeline summary

```
INPUT:  region + activity_type (e.g. "Dolomites" + "cycling")
  ↓
PHASE 1: DISCOVER — Search travel blogs & Instagram for real traveller recommendations
  ↓
PHASE 2: EVALUATE — Score, deduplicate, and validate candidates
  ↓
PHASE 3: CREATE — Write structured entries to content_entries table
  ↓
OUTPUT: Verified content_entries rows + agent_runs tracking record
```

---

## 2. Architecture

### Deployment: Supabase Edge Function

The agent runs as a **Supabase Edge Function** (`scout-locations`) written in TypeScript/Deno. It uses the **Anthropic Claude API** with web search enabled as its reasoning and research engine.

```
┌─────────────────────────────────────────────────────────┐
│  Edge Function: scout-locations                         │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ DISCOVER │───▶│ EVALUATE │───▶│ CREATE LISTINGS  │   │
│  │          │    │          │    │                  │   │
│  │ Claude + │    │ Scoring  │    │ Insert into      │   │
│  │ Web      │    │ Dedup    │    │ content_entries  │   │
│  │ Search   │    │ Validate │    │ + agent_runs     │   │
│  └──────────┘    └──────────┘    └──────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why Edge Function?

- Fits your existing Supabase stack
- Can be triggered manually via HTTP POST, from an admin UI, or via `pg_cron` on a schedule
- Direct access to your database via `SUPABASE_DB_URL`
- Built-in secrets management for API keys
- No additional infrastructure to manage

### API endpoint

```
POST /functions/v1/scout-locations
Authorization: Bearer <SUPABASE_ANON_KEY or service_role_key>
Content-Type: application/json

{
  "region": "Dolomites, Italy",
  "activityType": "cycling",
  "contentTypes": ["route", "accommodation", "restaurant"],
  "maxResults": 15,
  "focusKeywords": ["gravel cycling", "road cycling", "mountain passes"]
}
```

---

## 3. Database Schema (existing tables used)

### `content_entries` — Primary output table

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `type` | text | `'route'`, `'accommodation'`, or `'restaurant'` |
| `name` | text | Location/place name |
| `region` | text | Geographic region |
| `activity_type` | text | e.g. `'cycling'`, `'hiking'` |
| `description` | text | Rich description sourced from blogs |
| `data` | jsonb | Structured metadata (see below) |
| `submitted_by` | uuid | null for agent-created entries |
| `source_adventure_id` | uuid | null for agent-created entries |
| `upvotes` | int | Defaults to 1 |
| `verified` | bool | `false` — requires human review |
| `embedding` | vector | Generated after insert (if auto-embeddings enabled) |
| `created_at` | timestamptz | Auto-set |

### `content_entries.data` JSONB structure

The agent should populate the `data` field with structured metadata depending on content type:

```jsonc
// For type = "route"
{
  "sources": [
    {
      "url": "https://bikepacking.com/routes/dolomites-gravel",
      "type": "blog",           // "blog" | "instagram" | "strava"
      "author": "Sarah Cycling",
      "excerpt": "One of the most scenic gravel routes...",
      "publishedDate": "2025-06"
    }
  ],
  "coordinates": { "lat": 46.41, "lng": 11.84 },
  "distanceKm": 85,
  "elevationGainM": 2200,
  "difficulty": "advanced",
  "surfaceType": "gravel",
  "highlights": ["Passo Gardena views", "quiet roads", "rifugio lunch stops"],
  "bestSeason": "June-September",
  "nearbyAccommodation": ["Rifugio Puez", "Hotel Cir"],
  "agentRunId": "run_abc123",
  "scoutScore": 0.87,
  "scoutReason": "Mentioned by 4 independent travel bloggers with consistently high praise"
}

// For type = "accommodation"
{
  "sources": [...],
  "coordinates": { "lat": 46.52, "lng": 11.77 },
  "accommodationType": "guesthouse",     // hotel | hostel | campsite | guesthouse | rifugio
  "priceRange": "mid",                   // budget | mid | luxury
  "bikeFriendly": true,
  "highlights": ["family-run", "local breakfast", "bike storage"],
  "nearbyRoutes": ["Sella Ronda loop"],
  "agentRunId": "run_abc123",
  "scoutScore": 0.82,
  "scoutReason": "Featured in 3 cycling blogs as a trusted base for Dolomites riding"
}

// For type = "restaurant"
{
  "sources": [...],
  "coordinates": { "lat": 46.49, "lng": 11.79 },
  "cuisineType": "South Tyrolean",
  "priceRange": "mid",
  "highlights": ["handmade pasta", "garden terrace", "recommended by locals"],
  "agentRunId": "run_abc123",
  "scoutScore": 0.75,
  "scoutReason": "Multiple bloggers mentioned this as a hidden gem for lunch mid-ride"
}
```

### `agent_runs` — Tracking table

| Column | Type | Purpose |
|---|---|---|
| `id` | text | UUID, primary key |
| `region` | text | Region searched |
| `activity_type` | text | Activity type searched |
| `status` | text | `'running'`, `'completed'`, `'failed'` |
| `routes_found` | int | Count of route entries created |
| `accommodations_found` | int | Count of accommodation entries created |
| `error_message` | text | Error details if failed |
| `started_at` | timestamptz | Auto-set |
| `completed_at` | timestamptz | Set on completion |

---

## 4. Phase 1: DISCOVER

### Strategy

The agent uses Claude with web search to find travel blog posts and Instagram content about the target region + activity. The goal is to extract **specific place names, routes, and recommendations** from authentic traveller content.

### Search queries (executed by Claude via web search tool)

For a request like `{ region: "Dolomites", activityType: "cycling" }`, Claude should execute multiple targeted searches:

**Blog searches:**
1. `"best cycling routes Dolomites" blog`
2. `"Dolomites gravel cycling" bikepacking blog`
3. `"cycling Dolomites hidden gems" travel blog`
4. `"where to stay Dolomites cycling" blog`
5. `"best restaurants Dolomites cyclists"`
6. `"Dolomites cycling itinerary" blog 2025`

**Instagram-adjacent searches:**
7. `site:instagram.com "Dolomites cycling" route`
8. `"#dolomitescycling" best spots`
9. `"cycling Dolomites" instagram travel recommendations`

**Niche/specialist sources:**
10. `"Dolomites cycling" site:komoot.com OR site:bikepacking.com OR site:cyclinguphill.com`
11. `"Dolomites gravel" site:strava.com segments`

### Exclusion rules

Claude should **ignore** results from:
- TripAdvisor (`tripadvisor.com`)
- Google Reviews / Google Maps reviews
- Booking.com, Expedia, Hotels.com (sponsored/commercial)
- SEO-farm travel sites with no personal voice
- AI-generated listicles with no real travel experience

Claude should **prioritise** results from:
- Personal travel blogs with first-person accounts
- Cycling/outdoor-specific publications (bikepacking.com, etc.)
- Instagram posts with detailed captions
- Strava/Komoot community recommendations
- Local tourism boards with genuine content

### Claude system prompt for discovery

```
You are a travel research agent for TruthStay, a platform built on authentic, 
peer-sourced travel recommendations. Your job is to discover unique travel 
locations that real travellers love.

IMPORTANT RULES:
- Only extract recommendations from authentic sources: personal travel blogs, 
  Instagram posts with real travel stories, and specialist outdoor publications.
- NEVER use TripAdvisor, Google Reviews, Booking.com, or any sponsored/commercial 
  review platform.
- Look for specific place names, coordinates, distances, and practical details.
- Prioritise "hidden gems" and locally-loved spots over tourist hotspots.
- For each location found, note: the source URL, the author, a brief excerpt 
  of what they said about it, and any practical details (distance, difficulty, 
  price range, etc.).

OUTPUT FORMAT:
Respond with a JSON array of discovered locations. Each location should include:
{
  "name": "Place name",
  "type": "route | accommodation | restaurant",
  "region": "Geographic region",
  "description": "2-3 sentence description in your own words based on sources",
  "coordinates": { "lat": number, "lng": number },
  "sources": [{ "url": "...", "type": "blog|instagram", "author": "...", "excerpt": "..." }],
  "highlights": ["key feature 1", "key feature 2"],
  "metadata": { /* type-specific fields like distanceKm, priceRange, etc. */ },
  "confidenceScore": 0.0-1.0,
  "confidenceReason": "Why this score"
}
```

### Implementation pattern

```typescript
import Anthropic from "npm:@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

async function discoverLocations(
  region: string,
  activityType: string,
  contentTypes: string[],
  focusKeywords: string[]
): Promise<DiscoveredLocation[]> {

  const prompt = buildDiscoveryPrompt(region, activityType, contentTypes, focusKeywords);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  // Extract the text response containing JSON
  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // Parse the JSON array of locations from Claude's response
  return parseLocations(textContent);
}
```

---

## 5. Phase 2: EVALUATE

### Scoring criteria

Each discovered location gets a **scoutScore** (0.0 – 1.0) based on:

| Factor | Weight | Description |
|---|---|---|
| Source count | 30% | How many independent sources mention it |
| Source quality | 25% | Blog > Instagram; first-person > listicle |
| Detail richness | 20% | Does the source include practical details (coordinates, distances, prices)? |
| Uniqueness | 15% | Is it already well-covered in mainstream guides, or is it a genuine find? |
| Recency | 10% | More recent sources score higher |

### Deduplication

Before inserting, check against existing `content_entries`:

```typescript
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

async function isDuplicate(name: string, region: string, type: string): Promise<boolean> {
  const existing = await sql`
    SELECT id FROM content_entries
    WHERE LOWER(name) = LOWER(${name})
      AND LOWER(region) = LOWER(${region})
      AND type = ${type}
    LIMIT 1
  `;
  return existing.length > 0;
}

// If you have embeddings enabled, also do semantic dedup:
async function findSemanticDuplicates(
  description: string,
  threshold: number = 0.9
): Promise<boolean> {
  // Generate embedding for the candidate description
  // Then query content_entries using cosine similarity
  // Return true if any match above threshold
}
```

### Minimum thresholds

- **scoutScore >= 0.5** to be inserted
- **At least 1 credible source** (personal blog or Instagram with detailed caption)
- **Coordinates must be present** (even approximate)
- **Name must be specific** (not "a nice restaurant in the area")

---

## 6. Phase 3: CREATE LISTINGS

### Insert into `content_entries`

```typescript
async function createListings(
  locations: EvaluatedLocation[],
  agentRunId: string,
  activityType: string
): Promise<number> {
  let inserted = 0;

  for (const loc of locations) {
    if (loc.scoutScore < 0.5) continue;
    if (await isDuplicate(loc.name, loc.region, loc.type)) continue;

    await sql`
      INSERT INTO content_entries (type, name, region, activity_type, description, data, verified)
      VALUES (
        ${loc.type},
        ${loc.name},
        ${loc.region},
        ${activityType},
        ${loc.description},
        ${JSON.stringify({
          sources: loc.sources,
          coordinates: loc.coordinates,
          highlights: loc.highlights,
          ...loc.metadata,
          agentRunId: agentRunId,
          scoutScore: loc.scoutScore,
          scoutReason: loc.confidenceReason,
        })},
        false
      )
    `;
    inserted++;
  }

  return inserted;
}
```

### Update `agent_runs`

```typescript
async function updateAgentRun(
  runId: string,
  routesFound: number,
  accommodationsFound: number,
  status: "completed" | "failed",
  errorMessage?: string
) {
  await sql`
    UPDATE agent_runs
    SET
      status = ${status},
      routes_found = ${routesFound},
      accommodations_found = ${accommodationsFound},
      error_message = ${errorMessage ?? null},
      completed_at = NOW()
    WHERE id = ${runId}
  `;
}
```

---

## 7. Full Edge Function Structure

### File: `supabase/functions/scout-locations/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { z } from "npm:zod";

// --- Config ---
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

// --- Input validation ---
const RequestSchema = z.object({
  region: z.string().min(1),
  activityType: z.string().min(1),
  contentTypes: z.array(z.enum(["route", "accommodation", "restaurant"])).default(["route", "accommodation", "restaurant"]),
  maxResults: z.number().min(1).max(50).default(15),
  focusKeywords: z.array(z.string()).optional().default([]),
});

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const parseResult = RequestSchema.safeParse(await req.json());
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), { status: 400 });
  }

  const { region, activityType, contentTypes, maxResults, focusKeywords } = parseResult.data;

  // 1. Create agent_run record
  const runId = crypto.randomUUID();
  await sql`
    INSERT INTO agent_runs (id, region, activity_type, status)
    VALUES (${runId}, ${region}, ${activityType}, 'running')
  `;

  try {
    // 2. DISCOVER — Claude + web search
    const discovered = await discoverLocations(region, activityType, contentTypes, focusKeywords, maxResults);

    // 3. EVALUATE — Score + dedup
    const evaluated = await evaluateLocations(discovered);

    // 4. CREATE — Insert into content_entries
    const counts = await createListings(evaluated, runId, activityType);

    // 5. Update agent_run
    await updateAgentRun(runId, counts.routes, counts.accommodations, "completed");

    return new Response(JSON.stringify({
      runId,
      status: "completed",
      discovered: discovered.length,
      inserted: counts.total,
      breakdown: counts,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    await updateAgentRun(runId, 0, 0, "failed", error.message);
    return new Response(JSON.stringify({ runId, error: error.message }), { status: 500 });
  }
});
```

---

## 8. Secrets & Environment Variables

Set these via the Supabase CLI or dashboard:

```bash
# Required
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Already available by default in Edge Functions:
# SUPABASE_URL
# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_DB_URL
```

---

## 9. Deployment

### Deploy the Edge Function

```bash
# From your project root (where supabase/ directory lives)
supabase functions deploy scout-locations
```

### Test locally

```bash
# Create .env file at supabase/functions/.env
echo "ANTHROPIC_API_KEY=sk-ant-..." > supabase/functions/.env

# Serve locally
supabase functions serve scout-locations --env-file supabase/functions/.env

# Test with curl
curl -X POST http://localhost:54321/functions/v1/scout-locations \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Dolomites, Italy",
    "activityType": "cycling",
    "maxResults": 10
  }'
```

### Optional: Schedule with pg_cron

To run the scout automatically for multiple regions:

```sql
-- Enable pg_cron extension first
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Run weekly for key regions
SELECT cron.schedule(
  'scout-dolomites-cycling',
  '0 3 * * 1',  -- Every Monday at 3am
  $$
  SELECT net.http_post(
    url := '<your-project-url>/functions/v1/scout-locations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <service-role-key>"}'::jsonb,
    body := '{"region": "Dolomites, Italy", "activityType": "cycling", "maxResults": 15}'::jsonb
  );
  $$
);
```

---

## 10. Admin Dashboard Integration

You'll want to build a simple admin view to manage the scout. Key features:

- **Trigger runs** — Select region + activity type, click "Scout"
- **View agent_runs** — See status, counts, errors for each run
- **Review entries** — Browse `content_entries` where `verified = false`, preview the sources, then approve/reject
- **Bulk approve** — Mark reviewed entries as `verified = true`

Query for the review queue:

```sql
SELECT
  ce.id, ce.type, ce.name, ce.region, ce.description,
  ce.data->>'scoutScore' as score,
  ce.data->>'scoutReason' as reason,
  ce.data->'sources' as sources,
  ar.region as run_region,
  ar.started_at as scouted_at
FROM content_entries ce
LEFT JOIN agent_runs ar ON ar.id = (ce.data->>'agentRunId')
WHERE ce.verified = false
ORDER BY (ce.data->>'scoutScore')::float DESC;
```

---

## 11. Trust Score & Verification System

### Core Principle

Community contributions always outweigh agent-generated content. The agent seeds the database at scale, but user reviews, tips, ratings, and photos carry more authority and are the foundation of TruthStay's trust model.

### Trust Score (0.0 – 1.0)

Every `content_entries` record has a **trustScore** that determines ranking and visibility. It blends two weighted components:

```
trustScore = (agentComponent × 0.30) + (communityComponent × 0.70)
```

Community signals are capped at **70% weight** — more than double the agent's maximum — ensuring user contributions always dominate.

### Agent Component (max 0.30)

The agent component is derived from the `scoutScore` already generated during Phase 2:

```
agentComponent = scoutScore × 1.0  (range 0.0 – 1.0)
```

So an agent entry with scoutScore 0.9 contributes `0.9 × 0.30 = 0.27` to the trustScore.

### Community Component (max 0.70)

The community component is a weighted sum of user signals, normalized to 0.0 – 1.0:

| Signal | Weight within community | Description |
|---|---|---|
| User reviews with text | 40% | A written review from someone who visited |
| Average rating (1-5 stars) | 25% | Normalized: `(avg_rating - 1) / 4` |
| Upvotes | 15% | Diminishing returns: `min(upvotes, 20) / 20` |
| User-uploaded photos | 10% | Proof of visit: `min(photos, 5) / 5` |
| User-added tips | 10% | Practical additions from travellers |

Formula:

```
reviewSignal    = min(review_count, 5) / 5
ratingSignal    = (avg_rating - 1) / 4
upvoteSignal    = min(upvotes, 20) / 20
photoSignal     = min(photo_count, 5) / 5
tipSignal       = min(tip_count, 3) / 3

communityComponent = (reviewSignal × 0.40)
                   + (ratingSignal  × 0.25)
                   + (upvoteSignal  × 0.15)
                   + (photoSignal   × 0.10)
                   + (tipSignal     × 0.10)
```

### Trust Score Examples

| Scenario | Agent | Community | trustScore |
|---|---|---|---|
| Agent-only, high scoutScore (0.9) | 0.27 | 0.00 | **0.27** |
| Agent (0.9) + 1 upvote | 0.27 | 0.005 | **0.28** |
| Agent (0.9) + 1 user review (4★) | 0.27 | 0.18 | **0.45** |
| Agent (0.9) + 3 reviews (4.5★) + 5 upvotes + photos | 0.27 | 0.49 | **0.76** |
| User-submitted (no agent) + 2 reviews (5★) + 3 upvotes | 0.00 | 0.38 | **0.38** |
| User-submitted + 5 reviews (4.5★) + 10 upvotes + photos + tips | 0.00 | 0.63 | **0.63** |

Key takeaway: a user-submitted entry with just 2 good reviews already outranks a high-confidence agent entry with no community validation.

### Auto-Verification Rules

The `verified` field on `content_entries` controls whether content is visible to users. Verification rules:

**Auto-verified (set `verified = true` immediately):**
- Agent entries with `scoutScore >= 0.85` (high confidence from multiple blog sources)
- Any entry submitted by a registered user (user-generated content is verified by default)

**Requires admin review (`verified = false`):**
- Agent entries with `scoutScore < 0.85`
- Flagged content

**Auto-promoted (becomes more visible over time):**
- Entries where `trustScore >= 0.50` get surfaced more prominently in search results and itinerary suggestions
- Entries where `trustScore >= 0.70` are treated as "community verified" — the gold standard

### Schema Changes

Add a `trust_score` column and a `source_type` column to `content_entries`:

```sql
-- Add trust score and source tracking
ALTER TABLE content_entries
  ADD COLUMN trust_score real DEFAULT 0,
  ADD COLUMN source_type text DEFAULT 'agent'
    CHECK (source_type IN ('agent', 'user', 'admin'));

-- Index for sorting by trust score
CREATE INDEX idx_content_entries_trust_score
  ON content_entries (trust_score DESC)
  WHERE verified = true;
```

### Trust Score Recalculation

The trust score should be recalculated whenever community signals change. Implement this as a Postgres function triggered by inserts/updates on `content_upvotes`, `reviews`, and a future `user_tips` table:

```sql
CREATE OR REPLACE FUNCTION recalculate_trust_score(entry_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_scout_score float := 0;
  v_upvotes int := 0;
  v_review_count int := 0;
  v_avg_rating float := 0;
  v_photo_count int := 0;
  v_tip_count int := 0;
  v_agent_component float;
  v_community_component float;
  v_trust_score float;
BEGIN
  -- Get agent score
  SELECT COALESCE((data->>'scoutScore')::float, 0)
  INTO v_scout_score
  FROM content_entries WHERE id = entry_id;

  -- Get upvotes
  SELECT COALESCE(upvotes, 0)
  INTO v_upvotes
  FROM content_entries WHERE id = entry_id;

  -- Get review stats (link reviews to content_entries via a join or direct FK)
  -- This is a placeholder — adapt to your actual review linking
  -- SELECT COUNT(*), COALESCE(AVG(rating), 0)
  -- INTO v_review_count, v_avg_rating
  -- FROM reviews WHERE content_entry_id = entry_id;

  -- Calculate components
  v_agent_component := v_scout_score;

  v_community_component :=
    (LEAST(v_review_count, 5)::float / 5.0) * 0.40 +
    (GREATEST(v_avg_rating - 1, 0) / 4.0) * 0.25 +
    (LEAST(v_upvotes, 20)::float / 20.0) * 0.15 +
    (LEAST(v_photo_count, 5)::float / 5.0) * 0.10 +
    (LEAST(v_tip_count, 3)::float / 3.0) * 0.10;

  v_trust_score := (v_agent_component * 0.30) + (v_community_component * 0.70);

  UPDATE content_entries
  SET trust_score = v_trust_score
  WHERE id = entry_id;
END;
$$;
```

### User-Submitted Content

When a user submits a tip, review, or location recommendation directly (not through the agent), it enters `content_entries` with:

```sql
INSERT INTO content_entries (type, name, region, description, data, source_type, verified, trust_score)
VALUES (
  'restaurant',
  'Malga Panna',
  'Val di Fassa, Dolomites',
  'Amazing homemade canederli with a view of the Catinaccio...',
  '{"coordinates": {"lat": 46.43, "lng": 11.76}, "submittedBy": "user_uuid", "highlights": ["homemade canederli", "mountain views"]}'::jsonb,
  'user',    -- source_type = user, not agent
  true,      -- user content is auto-verified
  0.0        -- trust_score starts at 0, recalculated when community signals arrive
);
```

User-submitted content has `source_type = 'user'` and starts with a trustScore of 0 (no agent component, no community signals yet). But as soon as other users upvote or review it, the community component kicks in and the trustScore climbs quickly — and since there's no 0.30 ceiling from the agent component, a well-reviewed user tip naturally overtakes agent content.

### Content Ranking for the AI Interface

When the conversational AI builds itineraries, it should rank `content_entries` by `trust_score` and prefer community-validated content:

```sql
-- Get the best restaurants in a region for the AI to recommend
SELECT name, description, trust_score, source_type,
  data->'highlights' as highlights,
  data->'coordinates' as coordinates
FROM content_entries
WHERE region ILIKE '%Dolomites%'
  AND type = 'restaurant'
  AND verified = true
ORDER BY trust_score DESC
LIMIT 10;
```

### The Agent's Ongoing Role

Even after the community grows, the agent continues to run and add value:

1. **Discovery in new regions** — As TruthStay expands to new areas, the agent seeds content before users arrive
2. **Gap filling** — The agent identifies regions or activity types with low content density and proactively scouts them
3. **Content freshness** — The agent periodically re-scans existing regions for new blog posts about places that aren't in the database yet
4. **Deduplication service** — The agent can flag when user-submitted content overlaps with existing entries and suggest merges

The agent should **not** overwrite or modify user-submitted content. If the agent discovers a location that a user has already submitted, it should skip it or enrich the existing entry's metadata (e.g., adding blog source URLs to the `data.sources` array) without changing the user's description or ratings.

---

## 12. Future Enhancements (updated)

Once the base agent and trust score system are working, consider these additions:

1. **Embedding-based deduplication** — Use your existing `vector` extension + `content_entries.embedding` column to catch semantically similar entries even if names differ.

2. **Komoot integration** — Pull route data from Komoot's API (you already have `komootTourId` in `adventure_days`) to enrich route entries with GPX data, distance, and elevation.

3. **Image fetching** — Extract hero images from blog posts and Instagram to populate `coverImageUrl` on auto-generated adventures.

4. **Community feedback loop** — Once users start reviewing agent-curated content, use their ratings to tune the scoutScore weights.

5. **Multi-region batch runs** — A single endpoint that accepts an array of regions and queues them for sequential processing.

6. **Instagram API integration** — When available, use Instagram's official API for hashtag search instead of web-search-based discovery.

---

## 14. User Interaction Learning

### Purpose

Every interaction on the AI discovery page is a learning opportunity. When a user describes their ideal holiday and then saves, clicks, or skips specific suggestions, that creates a mapping between **intent** (what they asked for) and **outcome** (what they chose). Over time, this makes the AI's recommendations sharper without retraining the underlying model.

### Interaction Signals

Capture every meaningful action from the discovery page:

| Signal | Type | Weight | Description |
|---|---|---|---|
| `add_to_itinerary` | Strong positive | 1.0 | User added this to their trip plan |
| `save` | Strong positive | 0.9 | User bookmarked for later |
| `book` | Strong positive | 1.0 | User booked accommodation/activity |
| `share` | Strong positive | 0.8 | User shared with a friend |
| `click` | Mild positive | 0.3 | User tapped into the detail page |
| `view` | Mild positive | 0.1 | Entry appeared in results and user saw it |
| `dwell` | Mild positive | 0.1–0.5 | Scaled by time spent on detail page (>30s = 0.5) |
| `skip` | Mild negative | -0.2 | User scrolled past without interacting |
| `remove` | Negative | -0.5 | User removed from itinerary after adding |
| `not_interested` | Negative | -0.8 | User explicitly dismissed |

### Schema

```sql
-- Track every meaningful user interaction on the discovery page
CREATE TABLE user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  content_entry_id uuid REFERENCES content_entries(id),
  interaction_type text NOT NULL
    CHECK (interaction_type IN (
      'view', 'click', 'save', 'add_to_itinerary',
      'remove', 'skip', 'share', 'book', 'not_interested'
    )),
  interaction_weight real NOT NULL DEFAULT 0,
  -- Session context: what did the user ask for?
  session_id uuid NOT NULL,
  session_query text,              -- the natural language request (e.g. "cycling in Dolomites with kids")
  session_activity_type text,      -- parsed activity type
  session_region text,             -- parsed region
  session_tags text[],             -- parsed preferences (e.g. ['family-friendly', 'budget', 'scenic'])
  -- Engagement depth
  dwell_time_seconds int,          -- time spent on the detail page
  position_in_results int,         -- where this entry appeared in the list (1 = top)
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

-- Fast lookup: which entries are popular for a given query pattern?
CREATE INDEX idx_interactions_session_query
  ON user_interactions (session_activity_type, session_region)
  WHERE interaction_weight > 0;

-- Fast lookup: engagement signals per content entry (for trust score)
CREATE INDEX idx_interactions_content_entry
  ON user_interactions (content_entry_id, interaction_type);

-- Fast lookup: user preference history
CREATE INDEX idx_interactions_user
  ON user_interactions (user_id, created_at DESC);
```

### How Interactions Feed Into Trust Score

User interactions on the discovery page become an additional community signal in the trust score calculation. Add an `engagement_score` to the community component:

```sql
-- Calculate engagement score for a content entry
CREATE OR REPLACE FUNCTION calculate_engagement_score(entry_id uuid)
RETURNS real
LANGUAGE plpgsql
AS $$
DECLARE
  v_positive_interactions int;
  v_negative_interactions int;
  v_total_saves int;
  v_total_adds int;
  v_engagement real;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE interaction_weight > 0),
    COUNT(*) FILTER (WHERE interaction_weight < 0),
    COUNT(*) FILTER (WHERE interaction_type = 'save'),
    COUNT(*) FILTER (WHERE interaction_type IN ('add_to_itinerary', 'book'))
  INTO v_positive_interactions, v_negative_interactions, v_total_saves, v_total_adds
  FROM user_interactions
  WHERE content_entry_id = entry_id;

  -- Engagement score: ratio of positive to total, weighted by saves/adds
  IF (v_positive_interactions + v_negative_interactions) = 0 THEN
    RETURN 0;
  END IF;

  v_engagement := (
    (LEAST(v_total_adds, 10)::real / 10.0) * 0.50 +
    (LEAST(v_total_saves, 15)::real / 15.0) * 0.30 +
    (v_positive_interactions::real / (v_positive_interactions + v_negative_interactions)::real) * 0.20
  );

  RETURN v_engagement;
END;
$$;
```

Update the trust score formula to include engagement:

```
trustScore = (agentComponent × 0.25) + (communityComponent × 0.55) + (engagementComponent × 0.20)
```

Note: the agent weight drops slightly from 0.30 to 0.25 to make room for engagement, keeping community signals dominant at 0.55 + 0.20 = 0.75 total user-driven weight.

### Preference Learning: Making the AI Smarter

Beyond trust scores, interaction data teaches the AI **which entries to recommend for which types of requests**. This is the collaborative filtering layer.

#### Step 1: Build preference profiles

For each `content_entry`, track which query patterns led to positive engagement:

```sql
-- Materialised view: which entries perform well for which query types?
CREATE MATERIALIZED VIEW content_affinity AS
SELECT
  content_entry_id,
  session_activity_type,
  session_region,
  unnest(session_tags) as tag,
  COUNT(*) FILTER (WHERE interaction_weight > 0.5) as strong_positive_count,
  COUNT(*) FILTER (WHERE interaction_weight > 0) as positive_count,
  COUNT(*) FILTER (WHERE interaction_weight < 0) as negative_count,
  AVG(interaction_weight) as avg_weight
FROM user_interactions
WHERE session_activity_type IS NOT NULL
GROUP BY content_entry_id, session_activity_type, session_region, tag
HAVING COUNT(*) >= 3;  -- minimum interactions to be meaningful

-- Refresh periodically (e.g. daily via pg_cron)
-- SELECT cron.schedule('refresh-content-affinity', '0 4 * * *', 'REFRESH MATERIALIZED VIEW content_affinity');

CREATE INDEX idx_affinity_lookup
  ON content_affinity (session_activity_type, session_region, tag);
```

#### Step 2: Query affinity data when building itineraries

When a user asks "plan me a family-friendly cycling trip in the Dolomites," the AI first queries content entries by trust score, then boosts entries that have high affinity for those specific tags:

```sql
-- Get entries that users with similar queries loved
SELECT
  ce.id, ce.name, ce.type, ce.description, ce.trust_score,
  COALESCE(ca.avg_weight, 0) as affinity_score,
  -- Blended ranking: trust score + affinity boost
  (ce.trust_score * 0.6 + COALESCE(ca.avg_weight, 0) * 0.4) as recommendation_score
FROM content_entries ce
LEFT JOIN content_affinity ca ON ca.content_entry_id = ce.id
  AND ca.session_activity_type = 'cycling'
  AND ca.session_region ILIKE '%Dolomites%'
  AND ca.tag = 'family-friendly'
WHERE ce.region ILIKE '%Dolomites%'
  AND ce.verified = true
ORDER BY recommendation_score DESC
LIMIT 20;
```

#### Step 3: Include affinity context in the AI prompt

When the conversational AI generates an itinerary, inject the preference data:

```
You are building a personalised holiday itinerary for a user who asked:
"{user_query}"

Here are the available locations, ranked by a blend of community trust
and preference learning from similar users:

{entries_with_recommendation_scores}

Additionally, users who searched for similar trips most frequently
chose these entries:
{top_affinity_entries}

Prioritise entries with high recommendation scores. If an entry has
a high trust score but low affinity for this query type, include it
only if it fills a gap (e.g. no other accommodation in the area).
```

### User Preference Memory

For logged-in users, build a personal preference profile based on their history:

```sql
-- What does this user tend to prefer?
CREATE MATERIALIZED VIEW user_preferences AS
SELECT
  user_id,
  -- Activity preferences
  session_activity_type,
  COUNT(*) as activity_count,
  -- Price range preferences (from chosen entries)
  MODE() WITHIN GROUP (ORDER BY ce.data->>'priceRange') as preferred_price_range,
  -- Accommodation preferences
  MODE() WITHIN GROUP (ORDER BY ce.data->>'accommodationType') as preferred_accommodation,
  -- Average difficulty of chosen routes
  AVG((ce.data->>'difficulty')::real) FILTER (WHERE ce.type = 'route') as avg_difficulty
FROM user_interactions ui
JOIN content_entries ce ON ce.id = ui.content_entry_id
WHERE ui.interaction_weight > 0.5
GROUP BY user_id, session_activity_type;
```

When a returning user asks for a new trip, the AI can reference their preference profile:

```
This user's history shows they prefer:
- Activity: cycling (12 past interactions), hiking (5)
- Accommodation: guesthouse over hotel
- Price range: mid
- Route difficulty: intermediate

Adjust recommendations accordingly.
```

### Privacy & Data Considerations

- All interaction data is tied to authenticated users (`user_id` references `profiles`)
- Users should be able to view and delete their interaction history (GDPR compliance)
- Add a `data_retention_days` setting — purge raw interaction data older than N days while keeping aggregated affinity data
- The `user_preferences` materialised view contains no PII — only behavioural patterns
- Session queries may contain personal information — consider anonymising after aggregation

```sql
-- Purge old raw interactions (keep aggregated views)
CREATE OR REPLACE FUNCTION purge_old_interactions(retention_days int DEFAULT 365)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM user_interactions
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Schedule monthly cleanup
-- SELECT cron.schedule('purge-old-interactions', '0 2 1 * *', 'SELECT purge_old_interactions(365)');
```

### Feedback Loop Summary

```
User asks: "Plan me a cycling trip in the Dolomites"
  ↓
AI queries content_entries × trust_score × content_affinity
  ↓
AI presents ranked suggestions on discovery page
  ↓
User interacts: saves Route A, clicks Restaurant B, skips Hotel C
  ↓
Interactions logged to user_interactions table
  ↓
Trust scores recalculated (Route A ↑, Hotel C stays)
  ↓
content_affinity refreshed: "cycling + Dolomites" → Route A boosted
  ↓
Next user who asks similar query → Route A ranked higher
```

---

## 15. Handing This to Claude Code

Copy this spec into your project (e.g. `docs/scout-agent-spec.md`) and tell Claude Code:

> "Read docs/scout-agent-spec.md and implement the scout-locations Edge Function. 
> Start with the main handler in supabase/functions/scout-locations/index.ts, 
> then implement the discover, evaluate, and create phases as described in the spec.
> Also implement the user_interactions table, trust score recalculation, and 
> content_affinity materialised view from Section 14.
> Use my existing content_entries and agent_runs tables — don't create new ones."

Claude Code will have full access to your repo, can see your existing code patterns, and can deploy the function directly.
