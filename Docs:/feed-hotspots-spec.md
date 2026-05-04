# TruthStay Feed — Personalised Hotspots Spec

## 1. Overview

Transform the Feed page (currently the empty pirate illustration) into a **personalised hotspot feed** that surfaces recently added and trending content entries based on three signals:

1. **User preferences** — their activity types, past adventures, and interactions
2. **User location** — nearby hotspots and seasonal recommendations
3. **Upcoming trips** — hotspots relevant to vacations they have planned

The feed should feel like Instagram's Explore page meets a travel advisor — a scrollable stream of beautiful, relevant places the user would actually want to visit.

## 2. Feed Algorithm: How Hotspots Are Ranked

Each content entry gets a **feed_score** for each user, computed from:

```
feed_score = (relevance × 0.40) + (freshness × 0.25) + (trust × 0.20) + (proximity × 0.15)
```

### Relevance (40%)
- Does the entry match the user's preferred activity types? (from `user_adventure_preferences.preferredActivityTypes` or inferred from past `adventures.activityType`)
- Does the entry match regions the user has shown interest in? (past adventures, searches, saved trips)
- Does the entry relate to an upcoming trip? (highest relevance boost)

### Freshness (25%)
- How recently was the entry added to the database?
- Recently added entries get a boost to create a sense of "what's new"
- Entries from the past 7 days get full freshness score; decays over 30 days

### Trust (20%)
- The entry's `trust_score` from the content_entries table
- User-sourced entries get a slight boost over agent-sourced in the feed

### Proximity (15%)
- How close is the entry to the user's current location or home city?
- Entries within 150km get full proximity score (local discoveries)
- Distance shown on feed cards: "12km away", "45km · Utrecht"
- Entries in the same country get partial score
- Entries near an upcoming trip destination get a proximity boost too
- **Triggers stories**: new entries within 150km create a "📍 Near you" story circle

## 3. Feed Categories

The feed shows hotspots in contextual categories:

Content entries near the user's current location — within a 150km radius. This surfaces local
discoveries: a new restaurant in their city, an activity 50km away, a unique stay within
weekend-trip distance.
- Uses device location (with permission) or home city from user profile
- **Primary radius: 150km** — covers day trips and local exploration
- Shows routes, restaurants, accommodation, and activities nearby
- Sorted by freshness + trust score
- Distance shown on each card: "12km away", "45km · Utrecht", "120km · Antwerp"
- **Also appears as Stories**: when the scout adds a new entry within 150km of a user, a story
  circle appears with a 📍 location pin thumbnail and "Near you" label
- Examples for a user in Lelystad/Utrecht:
  - New restaurant in Amsterdam (50km)
  - Cycling route in the Veluwe (30km)
  - Unique stay in the Biesbosch (80km)
  - Activity in Rotterdam (100km)

### ✈️ For Your Upcoming Trip
Content entries in the same region as the user's upcoming adventures.
- Queries `adventures` where `startDate > now()` and `isSaved = true`
- Groups by trip: "For your Algarve trip (Sep 13)"
- Shows routes, restaurants, and accommodations the user hasn't seen yet

### ⭐ Picked For You
Content entries matching the user's activity preferences and past behaviour.
- Based on `activityType` from past adventures
- Cross-references with `user_interactions` if available
- "Because you like cycling" or "Based on your Dolomites trip"

### 🆕 Recently Added
Newest content entries across all regions, regardless of personalisation.
- Simple chronological feed of recently verified entries
- Good for discovery and serendipity

### 🌍 Popular This Season
Seasonal recommendations based on the current month.
- Summer: Mediterranean beaches, Alpine cycling, Nordic hiking
- Winter: Ski destinations, tropical escapes
- Uses `data.bestSeason` field from content entries if available

## 4. Feed Card Design

Each hotspot card in the feed:

```
┌──────────────────────────────────────────┐
│                                          │
│  [Hero image / map preview]              │
│  ♡ save                                  │
│                                          │
├──────────────────────────────────────────┤
│  🚴 Route · Dolomites, Italy             │
│                                          │
│  Sellaronda Four Passes Loop             │
│                                          │
│  Four iconic Alpine passes in one loop.  │
│  Annual car-free day in June & Sept.     │
│                                          │
│  ★ 1.0  ·  85km  ·  2,200m↑  ·  🟢 Int │
│                                          │
│  ✈️ For your Dolomites trip              │
│                                          │
│  [ Add to Trip ]  [ View Details ]       │
└──────────────────────────────────────────┘
```

**Card elements:**
- **Hero image**: from `coverImageUrl` if available, or a styled map thumbnail showing the coordinates
- **Save button** (heart icon, top right) — adds to saved items, creates a `user_interaction` event
- **Type + region badge**: icon (🚴 route, 🏨 accommodation, 🍽 restaurant) + region name
- **Title**: entry name, bold
- **Description**: first 2 lines of description, truncated
- **Stats row**: trust score, distance/elevation for routes, price range for accommodation
- **Context tag**: why this is showing (teal pill): "For your Algarve trip", "Near you", "Trending", "Because you like cycling"
- **Action buttons**: "Add to Trip" (adds to an upcoming adventure) + "View Details"

### Card interactions tracked
- Card appears in viewport → `viewed` interaction
- User taps card → `clicked` interaction
- User saves (heart) → `saved` interaction
- User taps "Add to Trip" → `added_to_trip` interaction
- User scrolls past without interacting → `skipped` (after 2 seconds visible)

## 5. "Add to Trip" Flow

When a user taps "Add to Trip" on a hotspot card:

1. Modal shows their upcoming trips:
   ```
   ┌─ Add to which trip? ──────────────────┐
   │                                        │
   │  ✈️ Algarve Coastal Bliss — Sep 13     │
   │  🚴 Heuvelland Cycling — Jun 5         │
   │  🏔 Azores Escape — Jun 14             │
   │                                        │
   │  + Create new trip                     │
   └────────────────────────────────────────┘
   ```

2. User selects a trip → entry is linked to that adventure
3. An `adventure_content_links` record is created
4. The entry's trust score gets boosted (user endorsement)
5. A `user_interaction` with type `added_to_trip` is logged

## 6. Data Flow

```
User opens Feed
  ↓
App gets user location (if permitted) + user preferences + upcoming trips
  ↓
API endpoint queries content_entries with personalised ranking:
  - Filter by user's activity types, regions of interest, upcoming trip regions
  - Sort by computed feed_score
  - Group into categories (trending, upcoming trip, picked for you, etc.)
  ↓
Feed renders scrollable card list with category headers
  ↓
User interactions (view, save, add to trip, skip) logged to user_interactions
  ↓
Trust scores update → feed gets smarter
  ↓
Scout agent sees demand signals → finds more of what users want
```

## 7. API Endpoint

Create a Next.js API route or Edge Function for the feed:

```typescript
// app/api/feed/route.ts

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  // 1. Get user preferences and upcoming trips
  const preferences = await getUserPreferences(userId);
  const upcomingTrips = await getUpcomingTrips(userId);
  const userActivityTypes = await getPreferredActivities(userId);

  // 2. Build feed sections
  const feed = [];

  // Section: For your upcoming trips
  for (const trip of upcomingTrips) {
    const entries = await supabase
      .from('content_entries')
      .select('*')
      .ilike('region', `%${trip.region.split(',')[0]}%`)
      .eq('verified', true)
      .order('trust_score', { ascending: false })
      .limit(5);

    if (entries.data?.length) {
      feed.push({
        section: 'upcoming_trip',
        title: `For your ${trip.title}`,
        subtitle: `${trip.startDate} · ${trip.region}`,
        tripId: trip.id,
        entries: entries.data,
      });
    }
  }

  // Section: Trending near you (if location available)
  if (lat && lng) {
    const nearbyEntries = await supabase
      .rpc('get_nearby_content', { user_lat: lat, user_lng: lng, radius_km: 200 })
      .limit(10);

    if (nearbyEntries.data?.length) {
      feed.push({
        section: 'nearby',
        title: 'Trending Near You',
        entries: nearbyEntries.data,
      });
    }
  }

  // Section: Picked for you
  const personalised = await supabase
    .from('content_entries')
    .select('*')
    .eq('verified', true)
    .in('activity_type', userActivityTypes)
    .order('trust_score', { ascending: false })
    .limit(10);

  if (personalised.data?.length) {
    feed.push({
      section: 'for_you',
      title: 'Picked For You',
      subtitle: `Because you love ${userActivityTypes[0]}`,
      entries: personalised.data,
    });
  }

  // Section: Recently added
  const recent = await supabase
    .from('content_entries')
    .select('*')
    .eq('verified', true)
    .order('created_at', { ascending: false })
    .limit(10);

  feed.push({
    section: 'recent',
    title: 'Recently Added',
    entries: recent.data || [],
  });

  return Response.json({ feed, page });
}
```

### Proximity function (Postgres)

```sql
-- Function to find content entries near a location
CREATE OR REPLACE FUNCTION get_nearby_content(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 150
)
RETURNS SETOF content_entries
LANGUAGE sql
AS $$
  SELECT ce.*
  FROM content_entries ce
  WHERE ce.verified = true
    AND ce.data->'coordinates' IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians((ce.data->'coordinates'->>'lat')::float))
        * cos(radians((ce.data->'coordinates'->>'lng')::float) - radians(user_lng))
        + sin(radians(user_lat)) * sin(radians((ce.data->'coordinates'->>'lat')::float))
      )
    ) <= radius_km
  ORDER BY
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians((ce.data->'coordinates'->>'lat')::float))
        * cos(radians((ce.data->'coordinates'->>'lng')::float) - radians(user_lng))
        + sin(radians(user_lat)) * sin(radians((ce.data->'coordinates'->>'lat')::float))
      )
    ) ASC
  LIMIT 20;
$$;
```

## 8. Feed in the App vs Admin Dashboard

### In the TruthStay app (Feed tab)
- This is the user-facing feed as described above
- Replaces the empty pirate illustration
- Scrollable, card-based, personalised
- Interactions tracked for the learning loop

### In the admin dashboard (/analytics)
- Add a "Feed Performance" section showing:
  - Most viewed hotspots this week
  - Most saved hotspots
  - Most "added to trip" actions
  - Feed engagement rate (views that led to saves or adds)
  - Content gaps: searches/trips with no matching content

## 9. Feed States & Editorial Posts

### 9.1 The Four Feed States

**State 1: New user, no friends, no trips**
→ Keep the pirate illustration exactly as it is now. "Your feed is empty — Follow friends to see their adventures, photos, and itineraries here" + "Find friends" button. Nothing changes.

**State 2: User has trips planned but no friends yet**
→ Pirate image removed. Feed shows:
- Stories bar: scout hotspot stories + trip update stories (no friend stories)
- Feed content: editorial posts from approved scouted vacations (see 9.2 below) + "For your upcoming trip" hotspot cards + "Picked for you" + "Recently added"
- No friend activity in the feed (they have no friends yet)

**State 3: User has friends and friends are posting, but no trips planned**
→ Pirate image removed. Feed shows:
- Stories bar: friend activity stories only
- Feed content: friend activity posts (photos, comments, ratings from friends' trips) + editorial posts + "Recently added" hotspots
- No trip-related sections

**State 4: User has friends AND trips (full experience)**
→ Full feed:
- Stories bar: mix of everything (friend activity, scout hotspots, trip updates)
- Feed content: editorial posts + "For your upcoming trip" hotspot cards + friend activity posts in the feed (NOT in stories — friends' posts appear as feed cards) + "Picked for you" + "Recently added"

**Key clarification:** Friend activity (photos, comments from friends' trips) appears **in the feed as cards**, not as stories. Stories are for scout hotspots, trip updates, and editorial highlights. Friend posts scroll in the main feed timeline.

### 9.2 Editorial Posts (Admin-Curated Content)

Editorial posts are feed content created from approved scouted vacations. As admin, you approve the images, text, and layout before the post goes live. These fill the feed for users who don't have friends yet (State 2) and appear alongside other content for all users.

**How it works:**

```
Scout finds great content entries → entries get verified
  ↓
System (or marketing agent) generates an editorial post draft
  ↓
Post appears in admin dashboard approval queue
  ↓
You review: edit images, text, headline, call-to-action
  ↓
You approve → post goes live in all relevant users' feeds
  ↓
Users see curated, beautiful content that feels editorial, not AI-generated
```

**Editorial post types:**

| Type | Example | Source |
|---|---|---|
| Hotspot spotlight | "Hidden gem: Rifugio Scotoni in the Dolomites" | Single high-scoring content_entry |
| Route collection | "5 stunning gravel routes in Provence" | Multiple content_entries grouped |
| Seasonal pick | "Where to cycle this summer" | Curated selection by season |
| Destination guide | "Your guide to Corsica's coast" | Region-based content roundup |
| New additions | "12 new spots added this week" | Recent content_entries batch |

**Schema:**

```sql
CREATE TABLE editorial_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Content
  title text NOT NULL,
  subtitle text,
  body text,                             -- rich text / markdown
  hero_image_url text,
  images jsonb DEFAULT '[]',             -- array of image URLs
  post_type text NOT NULL
    CHECK (post_type IN ('hotspot_spotlight', 'route_collection', 'seasonal_pick', 'destination_guide', 'new_additions')),
  -- Linked content
  content_entry_ids uuid[] DEFAULT '{}', -- which content_entries are featured
  region text,
  activity_type text,
  vacation_type text,
  -- Targeting
  target_audience jsonb DEFAULT '{"type": "all_users"}',
  -- e.g., {"type": "activity", "activity": "cycling"}
  -- e.g., {"type": "region_interest", "region": "Dolomites"}
  -- e.g., {"type": "upcoming_trip", "region": "Corsica"}
  -- Approval
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  generated_by text DEFAULT 'agent'
    CHECK (generated_by IN ('agent', 'admin')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  -- Publishing
  published_at timestamptz,
  -- Engagement
  view_count int DEFAULT 0,
  save_count int DEFAULT 0,
  click_count int DEFAULT 0,
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_editorial_posts_status ON editorial_posts (status, published_at DESC);
CREATE INDEX idx_editorial_posts_region ON editorial_posts (region);
```

**Admin approval page (`/marketing/editorial` or `/content/editorial`):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  📝 Editorial Posts                                  [ + Create ]   │
│                                                                      │
│  [ Drafts (3) ]  [ Pending Review (2) ]  [ Published ]  [ Archived ]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  🆕 Pending Review                              Agent-drafted │  │
│  │                                                                │  │
│  │  [Hero image preview]                                          │  │
│  │                                                                │  │
│  │  Hidden gem: Rifugio Scotoni                                   │  │
│  │  "Fire-cooked food in a family-owned mountain restaurant..."   │  │
│  │                                                                │  │
│  │  Region: Dolomites · Type: Hotspot Spotlight                   │  │
│  │  Target: Users interested in Dolomites or cycling              │  │
│  │  Linked entries: Rifugio Scotoni (★ 0.98)                      │  │
│  │                                                                │  │
│  │  [ Preview ]  [ Edit ]  [ Approve & Publish ]  [ Reject ]     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Edit page** — full control over:
- Hero image (upload new, crop, or use scout-provided)
- Title and subtitle
- Body text (rich text editor)
- Additional images
- Target audience (who should see this post)
- Schedule (publish now or schedule for later)

**In the user's feed, an editorial post looks like:**

```
┌──────────────────────────────────────────┐
│                                          │
│  [Beautiful hero image]                  │
│                                          │
│  ♡ Save                                 │
│                                          │
├──────────────────────────────────────────┤
│  📍 truthstay · Dolomites, Italy         │
│                                          │
│  Hidden gem: Rifugio Scotoni             │
│                                          │
│  Fire-cooked food in a family-owned      │
│  mountain restaurant with stunning       │
│  valley views. A favourite among local   │
│  cyclists for post-ride meals.           │
│                                          │
│  [ View Details ]  [ Add to Trip ]       │
│                                          │
│  ❤️ 12 saves · Added 2 days ago          │
└──────────────────────────────────────────┘
```

The "truthstay" byline (instead of a user name) signals this is editorial content from the platform.

### 9.3 Future: Sponsored & Partner Posts (NOT building now — placeholder)

> **NOTE FOR FUTURE DEVELOPMENT:** Once the feed is established, add:
> - **Sponsored travel advisories**: paid placements from tourism boards or travel brands, clearly labeled as "Sponsored"
> - **Partner vacation posts**: booking partners (hotels, tour operators) can create and publish vacation packages that appear in the feed and stories
> - **Partner stories**: dedicated story circles for partner content, labeled with the partner's brand
> - These require: a partner content management system, ad targeting logic, revenue tracking per impression/click, and clear "Sponsored" / "Partner" labels to maintain TruthStay's authenticity brand
> - Schema additions: `partner_posts` table, `sponsorship_campaigns` table, partner billing integration
> - This should be built AFTER the core feed is complete and has active users

## 10. Stories — Instagram-Style Circles at the Top of the Feed

### 10.1 What are Stories?

Stories are Instagram-style circular thumbnails at the very top of the Feed page. They auto-play through a sequence of full-screen cards when tapped. They mix three content types into one stream:

1. **Scout hotspots** — New content entries relevant to the user (based on location, preferences, upcoming trips)
2. **User photos & activity posts** — Photos and comments from friends' trips (from `activity_posts` and `posts` tables)
3. **Trip-relevant updates** — "A new restaurant was added for your Corsica trip!"

### 10.2 Story Circle Bar (top of Feed)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐            │
│  │ 🆕 │  │ 🏖 │  │ 👤 │  │ 🍽 │  │ 👤 │  │ 🚴 │  ──▶      │
│  │New!│  │Alga│  │Sara│  │Cors│  │ Ben│  │Dolo│            │
│  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘            │
│   3 new   Your    Sarah   Your    Ben's   Picked            │
│           trip    posted  trip    photos  for you            │
└──────────────────────────────────────────────────────────────┘
```

**Circle types:**
- **Teal ring** = unviewed stories (new content)
- **Grey ring** = already viewed
- **User avatar** = friend's activity post
- **Map thumbnail / type icon** = scout hotspot or trip update

The bar scrolls horizontally. Circles are ordered: unviewed first, then by relevance score.

### 10.3 Story Types

**Type 1: Scout Hotspot Story**
When the scout adds a new content entry that's relevant to the user (matches their location, preferences, or upcoming trip), it becomes a story.

Full-screen card shows:
```
┌──────────────────────────────────┐
│                                  │
│  [Map view / image of location]  │
│                                  │
│                                  │
│  ─────────────────────────────── │
│  🆕  New hotspot near you        │
│                                  │
│  Rifugio Scotoni                 │
│  🍽 Restaurant · Dolomites       │
│                                  │
│  Fire-cooked food in a family-   │
│  owned mountain restaurant with  │
│  stunning valley views.          │
│                                  │
│  ★ 0.98  ·  Mid-range           │
│                                  │
│  [ Add to Trip ]  [ Save ♡ ]    │
│                                  │
│  ▮▮▮▮▮▯▯  3/7                   │
└──────────────────────────────────┘
```

**Type 2: Trip Update Story**
When new content is added to a region where the user has an upcoming trip, they get a trip-specific story.

```
┌──────────────────────────────────┐
│                                  │
│  [Map showing Corsica]           │
│                                  │
│                                  │
│  ─────────────────────────────── │
│  ✈️ For your Corsica trip        │
│     Sep 13 — Sep 17              │
│                                  │
│  3 new spots added this week:    │
│                                  │
│  🍽 Le Moulin · Restaurant       │
│  🏨 Casa di l'Orcu · Guesthouse │
│  🚴 GR20 South · Hiking route   │
│                                  │
│  [ View All ]  [ Add to Trip ]   │
│                                  │
│  ▮▮▮▯▯▯▯  2/7                   │
└──────────────────────────────────┘
```

**Type 3: Friend Activity Story**
When a friend (someone the user follows) posts an `activity_post` with photos or a `post` about a trip, it becomes a story.

```
┌──────────────────────────────────┐
│                                  │
│  [User's uploaded photo]         │
│                                  │
│                                  │
│  ─────────────────────────────── │
│  👤 Sarah · Algarve, Portugal    │
│     2 hours ago                  │
│                                  │
│  "Amazing hidden beach cove      │
│   near Ferragudo. No crowds,     │
│   crystal clear water! 🏖"       │
│                                  │
│  📍 Praia do Pintadinho          │
│  ⭐ Rated 5/5                    │
│                                  │
│  [ View Trip ]  [ ♡ ]  [ 💬 ]   │
│                                  │
│  ▮▮▮▮▯▯▯  4/7                   │
└──────────────────────────────────┘
```

### 10.4 Story Grouping Logic

Stories are grouped into circles based on context:

| Source | Circle label | Thumbnail | Ring colour |
|---|---|---|---|
| New scout entries near user | "New!" or region name | Map thumbnail | Teal (new) |
| New entries for upcoming trip | Trip title (e.g., "Corsica") | Trip cover image or map | Teal (new) |
| Friend's activity post | Friend's name | Friend's avatar | Teal (new) |
| Friend's trip post with photos | Friend's name | First photo | Teal (new) |
| Picked-for-you hotspot | "For you" or activity type | Type icon | Teal (new) |
| Already viewed | Same as above | Same | Grey |

Multiple stories from the same source get grouped into one circle (like Instagram — tap through them). For example:
- "Corsica" circle might have 3 stories: a new restaurant + a new route + a new accommodation
- "Sarah" circle might have 2 stories: a photo from Ferragudo + a photo from Benagil cave

### 10.5 Story Lifecycle

**When a story is created:**
- Scout adds a new content entry → check all users with matching preferences/location/trips → create story for each relevant user
- User posts an `activity_post` with photos → create story for all followers
- User creates a `post` about a trip → create story for all followers

**How long it stays:**
- **Unviewed stories**: stay until dismissed or until the content is no longer relevant (trip date passes)
- **Viewed stories**: stay for 7 days after first view, then auto-expire
- **Trip-related stories**: stay until 1 day after the trip end date
- User can explicitly dismiss a story (swipe away or X button)

### 10.6 Schema

```sql
CREATE TABLE feed_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who sees this story
  target_user_id text NOT NULL,          -- the user who should see this story
  -- Story content
  story_type text NOT NULL
    CHECK (story_type IN ('scout_hotspot', 'trip_update', 'friend_activity', 'friend_post', 'picked_for_you')),
  -- Source references (one of these will be set)
  content_entry_id uuid REFERENCES content_entries(id),
  activity_post_id uuid,                 -- references activity_posts(id)
  post_id text,                          -- references posts(id)
  adventure_id text,                     -- references adventures(id) for trip updates
  -- Grouping
  group_key text NOT NULL,               -- groups stories into circles (e.g., "trip:corsica", "user:sarah", "scout:dolomites")
  group_label text,                      -- display label for the circle
  group_thumbnail_url text,              -- thumbnail for the circle
  -- Story content (denormalised for fast rendering)
  title text,
  subtitle text,
  description text,
  image_url text,                        -- hero image for the full-screen story
  metadata jsonb DEFAULT '{}',           -- type-specific data (coordinates, rating, highlights, etc.)
  -- Context
  context_tag text,                      -- "Near you", "For your Corsica trip", "Sarah posted"
  context_trip_id text,                  -- if this story relates to an upcoming trip
  -- Interaction
  is_viewed boolean DEFAULT false,
  viewed_at timestamptz,
  is_dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  is_saved boolean DEFAULT false,
  -- Lifecycle
  expires_at timestamptz,               -- auto-calculated based on story type
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feed_stories_user ON feed_stories (target_user_id, is_dismissed, is_viewed, created_at DESC);
CREATE INDEX idx_feed_stories_group ON feed_stories (target_user_id, group_key);
CREATE INDEX idx_feed_stories_content ON feed_stories (content_entry_id);
CREATE INDEX idx_feed_stories_expiry ON feed_stories (expires_at) WHERE is_dismissed = false;

-- Auto-expire old stories
-- SELECT cron.schedule('expire-stories', '0 3 * * *', $$
--   UPDATE feed_stories SET is_dismissed = true, dismissed_at = now()
--   WHERE expires_at < now() AND is_dismissed = false;
-- $$);
```

### 10.7 Story Generation Triggers

**When scout creates content entries:**

```sql
CREATE OR REPLACE FUNCTION generate_scout_stories()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_user record;
  v_trip record;
  v_group_key text;
  v_context text;
  v_expires timestamptz;
BEGIN
  -- Find users with upcoming trips in this region
  FOR v_trip IN
    SELECT a.id, a.title, a."userId", a."startDate", a."endDate", a.region
    FROM adventures a
    WHERE a."isSaved" = true
      AND a."startDate" > now()
      AND LOWER(a.region) LIKE '%' || LOWER(split_part(NEW.region, ',', 1)) || '%'
  LOOP
    v_group_key := 'trip:' || v_trip.id;
    v_context := 'For your ' || v_trip.title;
    v_expires := COALESCE(v_trip."endDate"::timestamptz + interval '1 day', now() + interval '30 days');

    INSERT INTO feed_stories (
      target_user_id, story_type, content_entry_id, adventure_id,
      group_key, group_label, title, subtitle, description,
      metadata, context_tag, context_trip_id, expires_at
    ) VALUES (
      v_trip."userId", 'trip_update', NEW.id, v_trip.id,
      v_group_key, v_trip.title, NEW.name,
      NEW.type || ' · ' || NEW.region,
      LEFT(NEW.description, 200),
      NEW.data, v_context, v_trip.id, v_expires
    );
  END LOOP;

  -- Find users NEAR this content entry (within 150km) for location-based stories
  -- This is the "Near You" story that surfaces local discoveries
  IF NEW.data->'coordinates' IS NOT NULL
     AND NEW.data->'coordinates'->>'lat' IS NOT NULL THEN

    FOR v_user IN
      SELECT u.id, u."homeCity", u."homeLatitude", u."homeLongitude"
      FROM "_old_users" u
      WHERE u."homeLatitude" IS NOT NULL
        AND u."homeLongitude" IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(u."homeLatitude")) * cos(radians((NEW.data->'coordinates'->>'lat')::float))
            * cos(radians((NEW.data->'coordinates'->>'lng')::float) - radians(u."homeLongitude"))
            + sin(radians(u."homeLatitude")) * sin(radians((NEW.data->'coordinates'->>'lat')::float))
          )
        ) <= 150  -- 150km radius
      LIMIT 200
    LOOP
      v_group_key := 'nearby:' || LOWER(split_part(NEW.region, ',', 1));

      INSERT INTO feed_stories (
        target_user_id, story_type, content_entry_id,
        group_key, group_label, title, subtitle, description,
        metadata, context_tag, expires_at
      ) VALUES (
        v_user.id, 'scout_hotspot', NEW.id,
        v_group_key, '📍 Near you', NEW.name,
        NEW.type || ' · ' || NEW.region,
        LEFT(NEW.description, 200),
        NEW.data, 'Near you',
        now() + interval '14 days'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Also find users by activity preference (broader reach, not location-based)
  FOR v_user IN
    SELECT u.id FROM "_old_users" u
    WHERE u."activityTypes" @> ARRAY[NEW.activity_type::"ActivityType"]
    LIMIT 50
  LOOP
    v_group_key := 'scout:' || LOWER(split_part(NEW.region, ',', 1));

    INSERT INTO feed_stories (
      target_user_id, story_type, content_entry_id,
      group_key, group_label, title, subtitle, description,
      metadata, context_tag, expires_at
    ) VALUES (
      v_user.id, 'scout_hotspot', NEW.id,
      v_group_key, split_part(NEW.region, ',', 1), NEW.name,
      NEW.type || ' · ' || NEW.region,
      LEFT(NEW.description, 200),
      NEW.data, 'New hotspot',
      now() + interval '30 days'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER content_entry_story_trigger
  AFTER INSERT ON content_entries
  FOR EACH ROW
  WHEN (NEW.verified = true)
  EXECUTE FUNCTION generate_scout_stories();
```

**When a friend posts an activity with photos:**

```sql
CREATE OR REPLACE FUNCTION generate_friend_activity_stories()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_follower record;
  v_user_name text;
  v_photo_url text;
  v_trip_region text;
BEGIN
  -- Get the poster's name
  SELECT "displayName" INTO v_user_name FROM "_old_users" WHERE id = (
    SELECT id FROM "_old_users" WHERE id = (
      -- Find user by email since activity_posts uses user_email
      SELECT id FROM "_old_users" LIMIT 1 -- simplified, needs proper email lookup
    )
  );

  -- Get first photo URL
  v_photo_url := NEW.photos->0->>'url';

  -- Get trip region
  SELECT region INTO v_trip_region FROM trips WHERE id = NEW.trip_id;

  -- Create stories for all followers
  FOR v_follower IN
    SELECT "followerId" FROM "_old_follows" WHERE "followingId" = (
      SELECT id FROM "_old_users" WHERE id = NEW.user_email -- needs proper lookup
    )
  LOOP
    INSERT INTO feed_stories (
      target_user_id, story_type, activity_post_id,
      group_key, group_label, group_thumbnail_url,
      title, subtitle, description, image_url,
      metadata, context_tag, expires_at
    ) VALUES (
      v_follower."followerId", 'friend_activity', NEW.id,
      'user:' || NEW.user_email, COALESCE(v_user_name, NEW.user_email), null,
      NEW.item_name, NEW.item_type || ' · ' || COALESCE(NEW.location, v_trip_region, ''),
      NEW.notes, v_photo_url,
      jsonb_build_object('rating', NEW.rating, 'day_number', NEW.day_number, 'photos', NEW.photos),
      COALESCE(v_user_name, 'A friend') || ' posted',
      now() + interval '7 days'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER activity_post_story_trigger
  AFTER INSERT ON activity_posts
  FOR EACH ROW
  WHEN (NEW.photos IS NOT NULL AND NEW.photos != '[]'::jsonb)
  EXECUTE FUNCTION generate_friend_activity_stories();
```

### 10.8 Story API Endpoint

```typescript
// app/api/feed/stories/route.ts

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  // Get all active stories for this user, grouped by group_key
  const { data: stories } = await supabase
    .from('feed_stories')
    .select('*')
    .eq('target_user_id', userId)
    .eq('is_dismissed', false)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('is_viewed', { ascending: true })    // unviewed first
    .order('created_at', { ascending: false });

  // Group into circles
  const circles = new Map();
  for (const story of stories || []) {
    if (!circles.has(story.group_key)) {
      circles.set(story.group_key, {
        group_key: story.group_key,
        label: story.group_label,
        thumbnail_url: story.group_thumbnail_url,
        has_unviewed: false,
        stories: [],
      });
    }
    const circle = circles.get(story.group_key);
    circle.stories.push(story);
    if (!story.is_viewed) circle.has_unviewed = true;
  }

  // Sort: unviewed circles first, then by most recent story
  const sortedCircles = Array.from(circles.values())
    .sort((a, b) => {
      if (a.has_unviewed !== b.has_unviewed) return a.has_unviewed ? -1 : 1;
      return new Date(b.stories[0].created_at).getTime() - new Date(a.stories[0].created_at).getTime();
    });

  return Response.json({ circles: sortedCircles });
}

// Mark story as viewed
export async function PATCH(req: Request) {
  const { storyId } = await req.json();
  await supabase
    .from('feed_stories')
    .update({ is_viewed: true, viewed_at: new Date().toISOString() })
    .eq('id', storyId);
  return Response.json({ ok: true });
}
```

### 10.9 Real-Time Updates

Use Supabase Realtime to push new stories to the feed instantly:

```typescript
// In the Feed page component
useEffect(() => {
  const channel = supabase
    .channel('feed-stories')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'feed_stories',
      filter: `target_user_id=eq.${userId}`,
    }, (payload) => {
      // New story arrived — add to circles
      addStoryToFeed(payload.new);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId]);
```

This means: when the scout adds a new restaurant for Corsica, users with a Corsica trip see a new story circle appear **in real-time**, no refresh needed.

---

## 11. Claude Code Prompt

```
Read /Users/alexandervoorham/Documents/Apps/TruthStay/Docs/feed-hotspots-spec.md.

Build the personalised hotspot feed, Stories system, and editorial posts for the
TruthStay app's Feed tab. The pirate illustration stays for State 1 (no friends, no trips).
It is replaced once the user has friends posting OR has trips planned.

STEP 1 — DATABASE:
  - Create the feed_stories table (story targeting, grouping, lifecycle, interactions)
  - Create the editorial_posts table (admin-curated content from scouted entries)
  - Create the get_nearby_content Postgres function (Haversine proximity query)
  - Create the user_interactions table if it doesn't exist yet
  - Create triggers: content_entry_story_trigger (generates stories when scout adds entries)
    and activity_post_story_trigger (generates stories when friends post with photos)
  - Set up the expire-stories cron job

STEP 2 — FEED STATES: Implement the 4 feed states from Section 9.1:
  - State 1 (no friends, no trips): keep pirate illustration as-is
  - State 2 (trips, no friends): stories bar (scout hotspots + trip updates) + editorial
    posts + hotspot cards. No friend content.
  - State 3 (friends posting, no trips): NO stories bar. Friend posts appear as feed cards
    + editorial posts. Pirate image removed.
  - State 4 (full): everything. Stories bar has scout hotspots + trip updates.
    Friend activity appears as feed cards (NOT stories). Editorial posts + hotspot cards.

STEP 3 — STORIES BAR: Instagram-style circles at top of feed (States 2 and 4 only):
  - Teal ring = unviewed, grey ring = viewed
  - Circle types: map/icon (scout hotspots), trip cover (trip updates),
    📍 location pin (nearby hotspots within 150km)
  - IMPORTANT: Friend activity does NOT appear as stories — it goes in the main feed
  - "Near you" stories: when scout adds a new entry within 150km of a user's location,
    they get a story circle with a 📍 pin thumbnail and "Near you" label. The story
    card shows distance ("12km away") and a map centered on the entry's coordinates.
  - Tap circle → full-screen story viewer with auto-advance + progress bar
  - Story cards: scout hotspot (map + details + Add to Trip), trip update
    (region map + list of new entries), nearby hotspot (map + distance + details)
  - Mark viewed on display, log interactions

STEP 4 — EDITORIAL POSTS IN FEED: Build editorial post cards styled like Instagram
  posts — hero image, "truthstay" byline with app logo avatar (not a user), title,
  description, "View Details" + "Add to Trip" buttons, save count + timestamp.
  Query editorial_posts WHERE status = 'approved' sorted by published_at.
  Target posts to users by preferences/region/activity using target_audience JSON.

STEP 5 — EDITORIAL ADMIN PAGE: Add /marketing/editorial to the admin dashboard.
  Tabs: Drafts / Pending Review / Published / Archived.
  Each post card shows: hero image preview, title, region, post type, target audience,
  linked content entries with scout scores. Approve/Edit/Reject buttons.
  Edit page: hero image upload, title, subtitle, body (rich text editor), additional
  images, target audience selector, content entry linker, schedule/publish controls.

STEP 6 — FRIEND ACTIVITY IN FEED: Show friends' activity_posts as feed cards
  (NOT stories). Card shows: friend avatar + name, their uploaded photo,
  notes/comment, location, rating stars, "View Trip" + Like + Comment buttons.
  Query activity_posts joined with follows for the current user, ordered by date.

STEP 7 — HOTSPOT CARDS IN FEED: The personalised hotspot sections:
  "Trending Near You" (within 150km, show distance on each card like "12km away"),
  "For your upcoming trip", "Picked For You", "Recently Added"
  with content_entries cards, "Add to Trip" modal, interaction tracking.
  The "Trending Near You" section uses the get_nearby_content Postgres function
  with a 150km radius from the user's device location or home city coordinates.

STEP 8 — REAL-TIME: Supabase Realtime subscription on feed_stories filtered
  by target_user_id. New story circles appear with teal ring animation instantly.

Design: TruthStay app style — teal accent (#2DD4BF), rounded cards matching
the adventure card style from the Explore page. Editorial posts use "truthstay"
as the byline with the app logo as avatar. Full-screen story viewer has dark
overlay with white cards.
```
