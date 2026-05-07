-- Update 16: add focus_type to content_sources so each source knows what type(s) to extract.
-- 'all' enables multi-type extraction (hotels + restaurants + activities + routes in one call).
ALTER TABLE content_sources ADD COLUMN focus_type text NOT NULL DEFAULT 'accommodation';
