-- Atomic helper for cross-source evidence merging in the scout worker.
-- When Stage 3 (Match) finds a location already in content_entries,
-- the worker calls this instead of discarding the new source evidence.
-- FOR UPDATE lock prevents concurrent merges from racing on the same row.

CREATE OR REPLACE FUNCTION merge_scout_sources(
  p_entry_id        uuid,
  p_new_source_urls jsonb   -- jsonb array of SourceUrl objects
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_sources jsonb;
  v_merged_sources   jsonb;
  v_new_isc          integer;
  v_avg_cred         real;
  v_new_src_trust    real;
BEGIN
  -- Lock target row — prevents concurrent merges from racing
  SELECT source_urls
  INTO   v_existing_sources
  FROM   content_entries
  WHERE  id = p_entry_id
  FOR UPDATE;

  -- Merge: union existing + new, deduplicate by source_url, keep earliest first_seen_at
  SELECT jsonb_agg(elem)
  INTO   v_merged_sources
  FROM (
    SELECT DISTINCT ON (elem->>'source_url') elem
    FROM (
      SELECT jsonb_array_elements(COALESCE(v_existing_sources, '[]'::jsonb)) AS elem
      UNION ALL
      SELECT jsonb_array_elements(p_new_source_urls) AS elem
    ) combined
    ORDER BY (elem->>'source_url'), (elem->>'first_seen_at') ASC NULLS LAST
  ) deduped;

  -- independent_source_count: distinct hostnames (strips scheme + www.)
  SELECT COUNT(DISTINCT
    regexp_replace(
      regexp_replace(elem->>'source_url', '^https?://', '', 'i'),
      '^(?:www\.)?([^/?#]+).*', '\1', 'i'
    )
  )::integer
  INTO v_new_isc
  FROM jsonb_array_elements(COALESCE(v_merged_sources, '[]'::jsonb)) AS elem;

  -- Average credibility (mirrors CREDIBILITY map in worker)
  SELECT COALESCE(AVG(
    CASE elem->>'source_type'
      WHEN 'blog'              THEN 1.0
      WHEN 'instagram_profile' THEN 0.85
      WHEN 'instagram_post'    THEN 0.85
      WHEN 'web_search'        THEN 0.5
      ELSE                          0.5
    END
  ), 0.5)
  INTO v_avg_cred
  FROM jsonb_array_elements(COALESCE(v_merged_sources, '[]'::jsonb)) AS elem;

  -- source_trust_score: min(isc/5, 1.0) × avg_credibility
  v_new_src_trust := LEAST(1.0, v_new_isc::real / 5.0) * v_avg_cred;

  UPDATE content_entries
  SET
    source_urls              = COALESCE(v_merged_sources, '[]'::jsonb),
    independent_source_count = v_new_isc,
    source_trust_score       = v_new_src_trust,
    -- Recompute combined trust_score (mirrors migration 029 formula)
    trust_score              = 0.4 * v_new_src_trust + 0.6 * COALESCE(user_trust_score, 0),
    last_seen_at             = NOW()
  WHERE id = p_entry_id;
END;
$$;
