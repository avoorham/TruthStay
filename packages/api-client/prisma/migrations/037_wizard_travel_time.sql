-- Migration 037: wizard restructure — adults/children on adventures + travel_time_cache
--
-- adventures: add adults (default 2, min 1) and children (default 0).
-- endDate already exists (nullable). durationDays stays; populated on save.
-- travel_time_cache: stores Google Maps driving results and flight heuristics.
--   Coordinates rounded to 3 dp (~110m) for cache hit maximisation.
--   TTL 30 days — stale rows are refreshed asynchronously.

ALTER TABLE adventures
  ADD COLUMN IF NOT EXISTS adults   INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS children INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS travel_time_cache (
  origin_lat        DOUBLE PRECISION NOT NULL,
  origin_lon        DOUBLE PRECISION NOT NULL,
  destination_lat   DOUBLE PRECISION NOT NULL,
  destination_lon   DOUBLE PRECISION NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('driving', 'flying')),
  travel_seconds    INTEGER NOT NULL,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (origin_lat, origin_lon, destination_lat, destination_lon, mode)
);

CREATE INDEX IF NOT EXISTS idx_travel_time_cache_fetched
  ON travel_time_cache (fetched_at);
