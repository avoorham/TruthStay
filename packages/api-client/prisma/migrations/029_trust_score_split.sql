-- Update 17: split trust_score into source_trust_score (scrape-time) and user_trust_score (interaction-derived).
-- Combined trust_score = 0.4 * source_trust_score + 0.6 * user_trust_score
ALTER TABLE content_entries RENAME COLUMN trust_score TO source_trust_score;
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS user_trust_score real NOT NULL DEFAULT 0.5;
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS trust_score real;
UPDATE content_entries SET trust_score = 0.4 * source_trust_score + 0.6 * user_trust_score;
ALTER TABLE content_entries ALTER COLUMN trust_score SET NOT NULL;
CREATE INDEX IF NOT EXISTS content_entries_trust_score_idx ON content_entries (trust_score DESC) WHERE status = 'pending_review';
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS auto_promoted_at timestamptz;
