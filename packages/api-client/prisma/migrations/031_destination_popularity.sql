-- Update 19: destination popularity tracking + skeleton trip support

-- 1. Add save_count to content_entries
ALTER TABLE content_entries
  ADD COLUMN IF NOT EXISTS save_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS content_entries_save_count_idx
  ON content_entries (save_count DESC);

-- 2. Destination chips table
CREATE TABLE IF NOT EXISTS destination_chips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('region', 'city', 'route')),
  parent_region       TEXT,
  country             TEXT,
  save_count          INTEGER NOT NULL DEFAULT 0,
  description         TEXT,
  source_entry_ids    UUID[],
  last_recalculated_at TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS destination_chips_save_count_idx
  ON destination_chips (save_count DESC);

CREATE INDEX IF NOT EXISTS destination_chips_name_search_idx
  ON destination_chips USING GIN (to_tsvector('simple', name));

-- 3. Relax NOT NULL on adventure_days so skeleton trips can have empty days
ALTER TABLE adventure_days
  ALTER COLUMN "distanceKm" DROP NOT NULL,
  ALTER COLUMN "elevationGainM" DROP NOT NULL,
  ALTER COLUMN title DROP NOT NULL;

-- 4. increment_save_count helper — called by save-skeleton endpoint
CREATE OR REPLACE FUNCTION increment_save_count(entry_ids UUID[])
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE content_entries
  SET save_count = save_count + 1
  WHERE id = ANY(entry_ids);
$$;

-- 5. Backfill save_count from existing saved adventures
UPDATE content_entries ce
SET save_count = (
  SELECT COUNT(*)
  FROM adventure_content_links acl
  INNER JOIN adventures a ON a.id = acl.adventure_id
  WHERE acl.content_entry_id = ce.id
    AND a."isSaved" = true
);

-- 6. Seed destination chips — regions
INSERT INTO destination_chips (name, type, parent_region, country, save_count, description) VALUES
  ('Algarve',         'region', NULL, 'Portugal',     100, 'Sun-drenched coast in southern Portugal'),
  ('Tuscany',         'region', NULL, 'Italy',          90, 'Rolling hills and Renaissance cities'),
  ('Provence',        'region', NULL, 'France',         80, 'Lavender fields and old villages'),
  ('Andalusia',       'region', NULL, 'Spain',          75, 'Flamenco, Moorish architecture, white villages'),
  ('Costa Brava',     'region', NULL, 'Spain',          70, 'Mediterranean coastline north of Barcelona'),
  ('Highlands',       'region', NULL, 'Scotland',       65, 'Lochs, mountains, distilleries'),
  ('Dolomites',       'region', NULL, 'Italy',          60, 'Dramatic mountain peaks and ski villages'),
  ('Costa Vicentina', 'region', NULL, 'Portugal',       55, 'Wild Atlantic coast'),
  ('Limburg',         'region', NULL, 'Netherlands',    50, 'Hilly south of the Netherlands');

-- 7. Seed destination chips — routes from verified content_entries
INSERT INTO destination_chips (name, type, country, save_count, description, source_entry_ids)
SELECT
  ce.name,
  'route',
  ce.country,
  GREATEST(ce.save_count, 30),
  LEFT(ce.description, 100),
  ARRAY[ce.id]
FROM content_entries ce
WHERE ce.type = 'route'
  AND ce.verified = true
  AND ce.status = 'approved';
