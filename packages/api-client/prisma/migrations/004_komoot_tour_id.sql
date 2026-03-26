-- TruthStay — Komoot Tour ID on Adventure Days
-- Run this in Supabase Dashboard → SQL Editor → New query

-- Allow each adventure day to link to a Komoot tour.
-- When set, the app renders a Komoot embed iframe for that day.
-- Users can paste their own Komoot tour URL to link their GPS track + photos.
ALTER TABLE adventure_days
  ADD COLUMN IF NOT EXISTS "komootTourId" TEXT;

CREATE INDEX IF NOT EXISTS idx_adventure_days_komoot ON adventure_days("komootTourId")
  WHERE "komootTourId" IS NOT NULL;
