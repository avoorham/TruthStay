-- TruthStay — Adventure System Migration
-- Run this in Supabase Dashboard → SQL Editor → New query

-- 1. Add granular attributes JSONB column to reviews
--    Stores category-specific scores, e.g.:
--    Accommodation: { cleanliness, comfort, value, facilities, staff, cycle_friendliness }
--    Restaurant/cafe: { food_quality, service, value, portion_size, cyclist_friendly }
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}';

-- 2. Stage reviews — rate individual route segments
CREATE TABLE IF NOT EXISTS stage_reviews (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "stageId"        TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  "userId"         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tripId"         TEXT REFERENCES trips(id) ON DELETE SET NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  difficulty       INTEGER CHECK (difficulty BETWEEN 1 AND 5),  -- 1=easy, 5=extreme
  scenery          INTEGER CHECK (scenery BETWEEN 1 AND 5),
  "surfaceQuality" INTEGER CHECK ("surfaceQuality" BETWEEN 1 AND 5),
  "trafficLevel"   INTEGER CHECK ("trafficLevel" BETWEEN 1 AND 5), -- 1=no traffic, 5=heavy
  body             TEXT,
  "wouldRepeat"    BOOLEAN NOT NULL DEFAULT TRUE,
  "visitedAt"      DATE NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "stageId")
);

-- 3. User adventure preferences
CREATE TABLE IF NOT EXISTS user_adventure_preferences (
  "userId"                   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  "fitnessLevel"             TEXT NOT NULL DEFAULT 'intermediate'
                             CHECK ("fitnessLevel" IN ('beginner','intermediate','advanced','expert')),
  "preferredActivityTypes"   "ActivityType"[] DEFAULT '{}',
  "preferredDailyDistanceKm" DOUBLE PRECISION,
  "preferredDailyElevationM" DOUBLE PRECISION,
  "accommodationPreference"  TEXT NOT NULL DEFAULT 'mid_range'
                             CHECK ("accommodationPreference" IN ('camping','budget','mid_range','luxury')),
  "groupSize"                INTEGER NOT NULL DEFAULT 1,
  "dietaryNotes"             TEXT,
  "otherNotes"               TEXT,
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Adventures — AI-generated multi-day itineraries
CREATE TABLE IF NOT EXISTS adventures (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  region          TEXT NOT NULL,
  "activityType"  "ActivityType" NOT NULL,
  "durationDays"  INTEGER NOT NULL,
  "startDate"     DATE,
  "requestPrompt" TEXT NOT NULL,
  "isSaved"       BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Adventure days — one row per day of the adventure
CREATE TABLE IF NOT EXISTS adventure_days (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adventureId"    TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "dayNumber"      INTEGER NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  "distanceKm"     DOUBLE PRECISION,
  "elevationGainM" DOUBLE PRECISION,
  "routeNotes"     TEXT,
  UNIQUE ("adventureId", "dayNumber")
);

-- 6. Adventure day POI assignments
CREATE TABLE IF NOT EXISTS adventure_day_pois (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adventureDayId" TEXT NOT NULL REFERENCES adventure_days(id) ON DELETE CASCADE,
  "poiId"          TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  role             TEXT NOT NULL
                   CHECK (role IN ('accommodation','lunch','dinner','breakfast','start','end','highlight','rest_stop')),
  notes            TEXT,
  "orderIndex"     INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stage_reviews_stage     ON stage_reviews("stageId");
CREATE INDEX IF NOT EXISTS idx_stage_reviews_user      ON stage_reviews("userId");
CREATE INDEX IF NOT EXISTS idx_adventures_user         ON adventures("userId");
CREATE INDEX IF NOT EXISTS idx_adventures_region       ON adventures(region);
CREATE INDEX IF NOT EXISTS idx_adventure_days_adv      ON adventure_days("adventureId");
CREATE INDEX IF NOT EXISTS idx_adventure_day_pois_day  ON adventure_day_pois("adventureDayId");
CREATE INDEX IF NOT EXISTS idx_reviews_attributes      ON reviews USING gin(attributes);
