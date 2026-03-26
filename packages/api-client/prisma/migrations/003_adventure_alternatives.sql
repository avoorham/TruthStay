-- TruthStay — Adventure Alternatives & Preference Learning
-- Run this in Supabase Dashboard → SQL Editor → New query

-- 1. Add per-day alternatives JSONB to adventure_days
--    Stores Claude-generated route and accommodation alternatives for each day:
--    { routes: [{ title, distance_km, elevation_gain_m, difficulty, description }],
--      accommodation: [{ name, type, price_range, description }] }
ALTER TABLE adventure_days
  ADD COLUMN IF NOT EXISTS alternatives JSONB NOT NULL DEFAULT '{}';

-- 2. Adventure selections — records which alternative a user picked per day
--    Used to infer fitness level and accommodation preferences over time
CREATE TABLE IF NOT EXISTS adventure_selections (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "adventureId"    TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "dayNumber"      INTEGER NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('route', 'accommodation')),
  "selectedIndex"  INTEGER NOT NULL,   -- 0 = main plan, 1 = first alt, 2 = second alt
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One selection per user per day per category (upsert target)
  UNIQUE ("userId", "adventureId", "dayNumber", category)
);

CREATE INDEX IF NOT EXISTS idx_adventure_selections_user ON adventure_selections("userId");
CREATE INDEX IF NOT EXISTS idx_adventure_selections_adv  ON adventure_selections("adventureId");
