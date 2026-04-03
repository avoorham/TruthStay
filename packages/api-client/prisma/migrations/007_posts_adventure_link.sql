-- Link posts to adventures (AI-generated itineraries) and specific days.
-- The existing tripId references the legacy trips table; adventureId references
-- the newer adventures table used by the mobile app.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS "adventureId" TEXT REFERENCES adventures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "dayNumber"   INT;
