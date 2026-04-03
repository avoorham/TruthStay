-- TruthStay — Row Level Security Migration
-- Run once in Supabase Dashboard → SQL Editor → New query
--
-- SAFE TO RUN: All API routes use createAdminClient() (service-role key),
-- which bypasses RLS entirely. This migration only closes the PostgREST
-- anon-key vector — it will not affect any existing functionality.

-- ── 0. Add public-adventure columns (needed by adventures RLS policy) ─────────
ALTER TABLE adventures
  ADD COLUMN IF NOT EXISTS "isPublic"      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS level           TEXT CHECK (level IN ('beginner','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS budget          TEXT CHECK (budget IN ('budget','mid','luxury')),
  ADD COLUMN IF NOT EXISTS rating          REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ratingCount"   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS meta            JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_adventures_public ON adventures("isPublic") WHERE "isPublic" = TRUE;

CREATE TABLE IF NOT EXISTS public_adventure_drafts (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slot                 JSONB NOT NULL,
  adventure            JSONB NOT NULL,
  day_alternatives     JSONB NOT NULL DEFAULT '{}',
  accommodation_stops  JSONB NOT NULL DEFAULT '[]',
  meta                 JSONB NOT NULL DEFAULT '{}',
  qa_notes             TEXT,
  status               TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  approved_at          TIMESTAMPTZ,
  adventure_id         TEXT REFERENCES adventures(id)
);

CREATE TABLE IF NOT EXISTS adventure_feedback (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adventureId"         TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "userId"              TEXT NOT NULL,
  "dayNumber"           INTEGER NOT NULL,
  "routeRating"         INTEGER CHECK ("routeRating" BETWEEN 1 AND 5),
  "accommodationRating" INTEGER CHECK ("accommodationRating" BETWEEN 1 AND 5),
  "restaurantRating"    INTEGER CHECK ("restaurantRating" BETWEEN 1 AND 5),
  notes                 TEXT,
  "createdAt"           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("adventureId", "userId", "dayNumber")
);

CREATE TABLE IF NOT EXISTS content_entries (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type                 TEXT NOT NULL CHECK (type IN ('route','accommodation','restaurant')),
  name                 TEXT NOT NULL,
  region               TEXT,
  activity_type        TEXT,
  description          TEXT,
  data                 JSONB DEFAULT '{}',
  embedding            vector(1536),
  upvotes              INTEGER DEFAULT 0,
  submitted_by         TEXT,
  source_adventure_id  TEXT REFERENCES adventures(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_upvotes (
  entry_id   TEXT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entry_id, user_id)
);

-- ── 1. users ──────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

-- ── 2. follows ────────────────────────────────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select_all" ON follows
  FOR SELECT USING (true);

-- ── 3. trips ──────────────────────────────────────────────────────────────────
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_select" ON trips
  FOR SELECT USING (
    "isPublished" = true
    OR "userId" = auth.uid()::text
  );

-- ── 4. stages ─────────────────────────────────────────────────────────────────
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages_select" ON stages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = "tripId"
        AND (t."isPublished" = true OR t."userId" = auth.uid()::text)
    )
  );

-- ── 5. pois ───────────────────────────────────────────────────────────────────
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pois_select_all" ON pois
  FOR SELECT USING (true);

-- ── 6. reviews ────────────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_all" ON reviews
  FOR SELECT USING (true);

-- ── 7. posts ──────────────────────────────────────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_all" ON posts
  FOR SELECT USING (true);

-- ── 8. post_poi_mentions ──────────────────────────────────────────────────────
ALTER TABLE post_poi_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_poi_mentions_select_all" ON post_poi_mentions
  FOR SELECT USING (true);

-- ── 9. post_likes ─────────────────────────────────────────────────────────────
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_likes_select_all" ON post_likes
  FOR SELECT USING (true);

-- ── 10. trip_likes ────────────────────────────────────────────────────────────
ALTER TABLE trip_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_likes_select_all" ON trip_likes
  FOR SELECT USING (true);

-- ── 11. comments ──────────────────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON comments
  FOR SELECT USING (true);

-- ── 12. notifications — private, own-only ─────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING ("userId" = auth.uid()::text);

-- ── 13. stage_reviews ─────────────────────────────────────────────────────────
ALTER TABLE stage_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage_reviews_select_all" ON stage_reviews
  FOR SELECT USING (true);

-- ── 14. user_adventure_preferences — private, own-only ────────────────────────
ALTER TABLE user_adventure_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_adventure_preferences_select_own" ON user_adventure_preferences
  FOR SELECT USING ("userId" = auth.uid()::text);

-- ── 15. adventures ────────────────────────────────────────────────────────────
ALTER TABLE adventures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adventures_select" ON adventures
  FOR SELECT USING (
    "isPublic" = true
    OR "userId" = auth.uid()::text
  );

-- ── 16. adventure_days ────────────────────────────────────────────────────────
ALTER TABLE adventure_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adventure_days_select" ON adventure_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM adventures a
      WHERE a.id = "adventureId"
        AND (a."isPublic" = true OR a."userId" = auth.uid()::text)
    )
  );

-- ── 17. adventure_day_pois ────────────────────────────────────────────────────
ALTER TABLE adventure_day_pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adventure_day_pois_select" ON adventure_day_pois
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM adventure_days ad
      JOIN adventures a ON a.id = ad."adventureId"
      WHERE ad.id = "adventureDayId"
        AND (a."isPublic" = true OR a."userId" = auth.uid()::text)
    )
  );

-- ── 18. adventure_selections — private, own-only ──────────────────────────────
ALTER TABLE adventure_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adventure_selections_select_own" ON adventure_selections
  FOR SELECT USING ("userId" = auth.uid()::text);

-- ── 19. public_adventure_drafts — admin only, no direct access ────────────────
ALTER TABLE public_adventure_drafts ENABLE ROW LEVEL SECURITY;
-- No permissive policy added. Anon + authenticated clients are fully blocked.
-- Service-role key (used by all admin API routes) bypasses RLS and retains access.

-- ── 20. adventure_feedback ────────────────────────────────────────────────────
ALTER TABLE adventure_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adventure_feedback_select_all" ON adventure_feedback
  FOR SELECT USING (true);

-- ── 21. content_entries ───────────────────────────────────────────────────────
ALTER TABLE content_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_entries_select_all" ON content_entries
  FOR SELECT USING (true);

-- ── 22. content_upvotes ───────────────────────────────────────────────────────
ALTER TABLE content_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_upvotes_select_all" ON content_upvotes
  FOR SELECT USING (true);
