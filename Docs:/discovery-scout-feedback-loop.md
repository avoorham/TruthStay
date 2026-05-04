# TruthStay Discovery ↔ Scout Feedback Loop — Implementation Spec

## 1. The Problem

Right now, two systems operate in isolation:

**Discovery page** → Users describe their ideal holiday → AI generates an adventure → stored in `adventures` + `adventure_days` → user interacts with suggestions → NO DATA flows back

**Scout Agent** → Searches blogs/Instagram → creates `content_entries` → NO KNOWLEDGE of what users actually want or like

The result: the scout blindly finds content without knowing what's popular, and the discovery page doesn't benefit from the growing content library (or contribute to it).

## 2. The Solution: Three Bridges

### Bridge 1: Scout powers the Discovery page
The AI on the Discovery page should query `content_entries` (scout-sourced, community-verified content) when building itineraries, not just generate from scratch.

### Bridge 2: Discovery page populates the database
When users create adventures, the specific places (routes, accommodations, restaurants) from `adventure_days` should flow into `content_entries` as user-sourced content.

### Bridge 3: User interactions teach the scout
What users search for, select, save, and skip creates preference data that shapes future scout runs — making the scout smarter over time.

---

## 3. Bridge 1: Scout Powers Discovery

### How it works now
The Discovery page's AI (via the `requestPrompt` on `adventures`) generates itineraries from Claude's general knowledge. It doesn't reference the `content_entries` table at all.

### How it should work
When a user asks "plan me a cycling trip in Provence," the AI should:

1. **Query content_entries** for the region + activity type, sorted by trust_score
2. **Inject these as context** into the Claude prompt that generates the itinerary
3. **Prefer verified, high-trust entries** over generating from scratch
4. **Fall back to general knowledge** only for gaps (no entries for that region/activity)

### Implementation

Update the adventure generation logic (wherever the Discovery page calls Claude) to include a content_entries lookup:

```typescript
// Before calling Claude to generate the itinerary, fetch relevant content
async function getRelevantContent(region: string, activityType: string) {
  const { data: entries } = await supabase
    .from('content_entries')
    .select('name, type, description, data, trust_score, source_type')
    .ilike('region', `%${region}%`)
    .eq('verified', true)
    .order('trust_score', { ascending: false })
    .limit(30);

  return entries;
}

// Include in the Claude prompt
const relevantContent = await getRelevantContent(region, activityType);

const systemPrompt = `
You are building a holiday itinerary for TruthStay.

IMPORTANT: Use the following verified content entries as your PRIMARY source
for routes, accommodations, and restaurants. These have been vetted by travel
bloggers and community members. Only generate from your general knowledge if
no relevant entries exist for a specific need.

VERIFIED CONTENT ENTRIES (sorted by trust score):
${JSON.stringify(relevantContent, null, 2)}

When you use a content entry, include its ID in the response so we can track
which entries were recommended.
`;
```

### Tracking which content entries get recommended

Add a junction table to track which `content_entries` the AI included in an adventure:

```sql
CREATE TABLE adventure_content_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text REFERENCES adventures(id),
  content_entry_id uuid REFERENCES content_entries(id),
  day_number int,
  role text CHECK (role IN ('route', 'accommodation', 'restaurant', 'activity', 'highlight')),
  was_selected boolean DEFAULT false,   -- did the user keep this in their final itinerary?
  was_replaced boolean DEFAULT false,   -- did the user swap it for an alternative?
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_adventure_content_adventure ON adventure_content_links (adventure_id);
CREATE INDEX idx_adventure_content_entry ON adventure_content_links (content_entry_id);
```

This lets you track: "Content entry X was recommended in 50 adventures, kept by 40 users, replaced by 10."

---

## 4. Bridge 2: Discovery Populates the Database

### How it works

When a user creates an adventure via the Discovery page and saves it (`isSaved = true`), extract the specific places from `adventure_days` and create `content_entries` for any that don't already exist.

### Extraction logic

```typescript
async function extractContentFromAdventure(adventureId: string) {
  // Get the adventure and its days
  const { data: adventure } = await supabase
    .from('adventures')
    .select('*, adventure_days(*)')
    .eq('id', adventureId)
    .single();

  if (!adventure || !adventure.isSaved) return;

  for (const day of adventure.adventure_days) {
    // Extract route as a content entry
    if (day.title && day.distanceKm) {
      await createContentEntryIfNotExists({
        type: 'route',
        name: day.title,
        region: adventure.region,
        activity_type: adventure.activityType,
        description: day.description || day.routeNotes,
        data: {
          distanceKm: day.distanceKm,
          elevationGainM: day.elevationGainM,
          komootTourId: day.komootTourId,
          sourceAdventureId: adventure.id,
          dayNumber: day.dayNumber,
        },
        source_type: 'user',
        verified: true,  // user content is auto-verified
        source_adventure_id: adventure.id,
      });
    }

    // Extract POIs linked to this day (accommodations, restaurants)
    const { data: dayPois } = await supabase
      .from('adventure_day_pois')
      .select('*, pois(*)')
      .eq('adventureDayId', day.id);

    for (const dayPoi of dayPois || []) {
      const poi = dayPoi.pois;
      if (!poi) continue;

      const contentType = mapPoiCategoryToContentType(poi.category);
      if (!contentType) continue;

      await createContentEntryIfNotExists({
        type: contentType,
        name: poi.name,
        region: adventure.region,
        activity_type: adventure.activityType,
        description: dayPoi.notes,
        data: {
          coordinates: { lat: poi.lat, lng: poi.lng },
          address: poi.address,
          website: poi.website,
          poiCategory: poi.category,
          sourceAdventureId: adventure.id,
          role: dayPoi.role, // accommodation, lunch, dinner, etc.
        },
        source_type: 'user',
        verified: true,
        source_adventure_id: adventure.id,
      });
    }
  }
}

function mapPoiCategoryToContentType(category: string): string | null {
  const mapping: Record<string, string> = {
    hotel: 'accommodation',
    hostel: 'accommodation',
    campsite: 'accommodation',
    guesthouse: 'accommodation',
    restaurant: 'restaurant',
    cafe: 'restaurant',
    bar: 'restaurant',
  };
  return mapping[category] || null;
}

async function createContentEntryIfNotExists(entry: any) {
  // Check for duplicates by name + region + type
  const { data: existing } = await supabase
    .from('content_entries')
    .select('id')
    .ilike('name', entry.name)
    .ilike('region', `%${entry.region}%`)
    .eq('type', entry.type)
    .limit(1);

  if (existing && existing.length > 0) {
    // Entry already exists — increment upvotes instead
    await supabase
      .from('content_entries')
      .update({ upvotes: supabase.rpc('increment_upvotes') })
      .eq('id', existing[0].id);
    return;
  }

  // Create new entry
  await supabase.from('content_entries').insert(entry);
}
```

### When to trigger

This extraction should run:
- When a user saves an adventure (`isSaved` goes from `false` to `true`)
- As a Postgres trigger or called from the app backend

```sql
-- Postgres trigger approach (alternative to app-level code)
CREATE OR REPLACE FUNCTION on_adventure_saved()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."isSaved" = true AND (OLD."isSaved" IS NULL OR OLD."isSaved" = false) THEN
    -- Call edge function to extract content
    PERFORM net.http_post(
      url := 'https://hplczwepdpmtdfkijpnh.supabase.co/functions/v1/extract-adventure-content',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <service-role-key>"}'::jsonb,
      body := jsonb_build_object('adventureId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER adventure_saved_trigger
  AFTER UPDATE ON adventures
  FOR EACH ROW
  EXECUTE FUNCTION on_adventure_saved();
```

---

## 5. Bridge 3: User Interactions Teach the Scout

### 5.1 What to track on the Discovery page

Create the `user_interactions` table (from the scout-agent-spec):

```sql
CREATE TABLE user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,                 -- references _old_users or auth.users
  content_entry_id uuid REFERENCES content_entries(id),
  adventure_id text REFERENCES adventures(id),
  interaction_type text NOT NULL
    CHECK (interaction_type IN (
      'viewed', 'selected', 'saved', 'replaced',
      'skipped', 'rated_up', 'rated_down', 'shared'
    )),
  interaction_weight real NOT NULL DEFAULT 0,
  -- Session context
  session_id text,
  session_query text,                    -- what the user asked (e.g., "cycling trip in Provence")
  session_region text,
  session_activity_type text,
  session_vacation_type text,
  -- Details
  day_number int,
  alternative_index int,                 -- which alternative they selected (0 = primary)
  replaced_by_entry_id uuid,            -- if they swapped, what did they swap TO
  dwell_time_seconds int,
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_interactions_content ON user_interactions (content_entry_id);
CREATE INDEX idx_user_interactions_session ON user_interactions (session_region, session_activity_type);
CREATE INDEX idx_user_interactions_user ON user_interactions (user_id, created_at DESC);
```

### 5.2 What interactions to capture

On the Discovery page, track these events:

| Event | When | Weight | What it means |
|---|---|---|---|
| `viewed` | AI shows a content entry in the itinerary | 0.1 | Entry was relevant enough to suggest |
| `selected` | User keeps the suggested option (doesn't swap) | 0.5 | User is happy with this choice |
| `replaced` | User swaps for an alternative | -0.3 | Primary suggestion wasn't preferred |
| `saved` | User saves the adventure | 0.8 | Strong signal of approval for all entries |
| `skipped` | User sees alternatives but picks "none" | -0.5 | None of the options were good |
| `rated_up` | User rates the adventure positively | 0.9 | All entries in this adventure are validated |
| `rated_down` | User rates negatively | -0.7 | Something was wrong |
| `shared` | User shares the trip with friends | 1.0 | Strongest possible endorsement |

### 5.3 How the scout uses this data

The scout agent should query `user_interactions` before running to understand what users actually want:

```typescript
// Before scouting a region, check what users have been searching for
async function getRegionDemandSignals(region: string) {
  const { data: signals } = await supabase
    .from('user_interactions')
    .select(`
      session_activity_type,
      session_vacation_type,
      interaction_type,
      content_entry_id,
      content_entries(type, name, data)
    `)
    .ilike('session_region', `%${region}%`)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Analyse: what activity types are most searched?
  // Which content entries are most selected vs replaced?
  // What's missing? (searches with no content to show)

  return {
    popularActivities: countByField(signals, 'session_activity_type'),
    popularVacationTypes: countByField(signals, 'session_vacation_type'),
    topPerformingEntries: getTopEntries(signals),
    underperformingEntries: getReplacedEntries(signals),
    gapSignals: getSearchesWithNoContent(signals),
  };
}
```

This data gets injected into the scout's Claude prompt:

```
You are scouting for content in ${region}.

USER DEMAND SIGNALS (from the past 30 days):
- Most searched activity types: cycling (45%), hiking (30%), surfing (25%)
- Most popular content entries: [list of high-scoring entries]
- Underperforming entries (frequently replaced): [list]
- Content gaps (users searched but we had nothing): "budget camping", "kid-friendly routes"

PRIORITISE finding content that fills the gaps and matches the popular activity types.
DEPRIORITISE content similar to underperforming entries.
```

### 5.4 Content affinity materialised view

Aggregate interaction data to understand which content works for which queries:

```sql
CREATE MATERIALIZED VIEW content_affinity AS
SELECT
  ui.content_entry_id,
  ui.session_activity_type,
  ui.session_region,
  ui.session_vacation_type,
  COUNT(*) FILTER (WHERE ui.interaction_weight > 0.3) as positive_count,
  COUNT(*) FILTER (WHERE ui.interaction_weight < 0) as negative_count,
  AVG(ui.interaction_weight) as avg_weight,
  COUNT(DISTINCT ui.user_id) as unique_users
FROM user_interactions ui
WHERE ui.content_entry_id IS NOT NULL
  AND ui.session_activity_type IS NOT NULL
GROUP BY ui.content_entry_id, ui.session_activity_type, ui.session_region, ui.session_vacation_type
HAVING COUNT(*) >= 3;

CREATE INDEX idx_affinity_lookup
  ON content_affinity (session_activity_type, session_region);

-- Refresh daily
-- SELECT cron.schedule('refresh-content-affinity', '0 4 * * *', 'REFRESH MATERIALIZED VIEW content_affinity');
```

### 5.5 Trust score integration

User interactions from the Discovery page feed into the trust score recalculation:

```sql
-- Update the trust score to include discovery page interactions
CREATE OR REPLACE FUNCTION recalculate_trust_score(entry_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_scout_score float := 0;
  v_upvotes int := 0;
  v_review_count int := 0;
  v_avg_rating float := 0;
  v_discovery_score float := 0;
  v_agent_component float;
  v_community_component float;
  v_discovery_component float;
  v_trust_score float;
BEGIN
  -- Agent score
  SELECT COALESCE((data->>'scoutScore')::float, 0), COALESCE(upvotes, 0)
  INTO v_scout_score, v_upvotes
  FROM content_entries WHERE id = entry_id;

  -- Discovery page engagement
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE (
        (LEAST(COUNT(*) FILTER (WHERE interaction_type = 'saved'), 10)::float / 10.0) * 0.40 +
        (LEAST(COUNT(*) FILTER (WHERE interaction_type = 'selected'), 20)::float / 20.0) * 0.30 +
        (GREATEST(AVG(interaction_weight), 0)) * 0.30
      )
    END
  INTO v_discovery_score
  FROM user_interactions
  WHERE content_entry_id = entry_id;

  -- Trust score: agent (20%) + community (50%) + discovery (30%)
  v_agent_component := v_scout_score;
  v_community_component := LEAST(v_upvotes, 20)::float / 20.0;
  v_discovery_component := v_discovery_score;

  v_trust_score :=
    (v_agent_component * 0.20) +
    (v_community_component * 0.50) +
    (v_discovery_component * 0.30);

  UPDATE content_entries
  SET trust_score = v_trust_score
  WHERE id = entry_id;
END;
$$;
```

---

## 6. The Complete Feedback Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE TRUTHSTAY LEARNING LOOP                  │
│                                                                 │
│  User: "Plan me a cycling trip in Provence"                     │
│    ↓                                                            │
│  Discovery AI queries content_entries (Bridge 1)                │
│    ↓                                                            │
│  AI builds itinerary using scout-sourced + user-sourced entries │
│    ↓                                                            │
│  User interacts: selects Route A, replaces Hotel B              │
│    ↓                                                            │
│  Interactions logged to user_interactions (Bridge 3)            │
│    ↓                                                            │
│  User saves adventure                                           │
│    ↓                                                            │
│  Adventure content extracted to content_entries (Bridge 2)      │
│    ↓                                                            │
│  Trust scores recalculated:                                     │
│    Route A trust ↑ (selected)                                   │
│    Hotel B trust ↓ (replaced)                                   │
│    New restaurant from adventure → added to content_entries     │
│    ↓                                                            │
│  Scout agent runs next week:                                    │
│    "Users love scenic Provence routes, not chain hotels"        │
│    "Gap: no budget camping options for Provence"                │
│    → Scout focuses on finding camping + authentic restaurants   │
│    ↓                                                            │
│  Next user who asks for Provence cycling gets better results    │
│    ↓                                                            │
│  Cycle repeats → platform gets smarter with every user          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Order

1. **Create `user_interactions` and `adventure_content_links` tables** (migration)
2. **Update Discovery page AI prompt** to query `content_entries` first (Bridge 1)
3. **Build adventure-to-content extraction** as an Edge Function or trigger (Bridge 2)
4. **Add interaction tracking** to the Discovery page frontend (Bridge 3)
5. **Update scout agent** to query demand signals before running
6. **Create `content_affinity` materialised view** + cron refresh
7. **Update trust score function** to include discovery interactions

---

## 8. Claude Code Prompt

```
Read /Users/alexandervoorham/Documents/Apps/TruthStay/Docs/discovery-scout-feedback-loop.md.

Implement the Discovery ↔ Scout feedback loop in this order:

STEP 1 — DATABASE: Create two new tables:
- user_interactions (tracks what users select, skip, save on the Discovery page)
- adventure_content_links (tracks which content_entries are used in adventures)
Create the content_affinity materialised view.
Update the recalculate_trust_score function to include discovery interactions.

STEP 2 — BRIDGE 1 (Scout powers Discovery): Update the adventure generation logic
in the Discovery page to query content_entries first. When building an itinerary,
fetch the top 30 verified entries for the region + activity type sorted by trust_score,
and inject them into the Claude prompt as the PRIMARY source for routes, accommodations,
and restaurants. Track which entries were used via adventure_content_links.

STEP 3 — BRIDGE 2 (Discovery populates database): Create an Edge Function at
supabase/functions/extract-adventure-content/index.ts that extracts places from
saved adventures and creates content_entries with source_type='user' and verified=true.
Add a Postgres trigger on the adventures table that fires when isSaved changes to true.
Check for duplicates before inserting — if an entry already exists, increment its upvotes.

STEP 4 — BRIDGE 3 (User interactions teach scout): Add interaction tracking to the
Discovery page frontend. Log events to user_interactions when users: view suggestions
(viewed), keep suggestions (selected), swap alternatives (replaced), save adventures
(saved), rate adventures (rated_up/rated_down), or share (shared). Include session
context: what they searched for, region, activity type, vacation type.

STEP 5 — UPDATE SCOUT: Modify the scout-locations Edge Function to query
user_interactions and content_affinity before scouting. Include demand signals
(popular activities, content gaps, underperforming entries) in the Claude prompt
so the scout learns what users actually want.
```
