-- Migration 009: Curator agent runs tracking + match_content patch

-- ── agent_runs table ──────────────────────────────────────────────────────────
-- Tracks the state of each (region, activity_type) curator agent run.
-- One row per combo; UNIQUE constraint prevents duplicate concurrent runs.

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id                   text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  region               text NOT NULL,
  activity_type        text NOT NULL,
  status               text NOT NULL DEFAULT 'running'
                         CHECK (status IN ('running', 'completed', 'failed')),
  routes_found         integer NOT NULL DEFAULT 0,
  accommodations_found integer NOT NULL DEFAULT 0,
  error_message        text,
  started_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  UNIQUE (region, activity_type)
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Admins can read and write
CREATE POLICY "agent_runs_admin_all" ON public.agent_runs
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ));

-- All authenticated users can read (so the discover page can check status)
CREATE POLICY "agent_runs_auth_read" ON public.agent_runs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── Patch match_content RPC ───────────────────────────────────────────────────
-- The original function filters WHERE upvotes >= min_upvotes.
-- Curated entries written by the curator agent have upvotes=1 but verified=true.
-- This patch ensures verified entries always pass through regardless of upvote count.

CREATE OR REPLACE FUNCTION public.match_content(
  query_embedding vector,
  match_count     integer DEFAULT 8,
  min_upvotes     integer DEFAULT 1
)
RETURNS TABLE (
  id            uuid,
  type          text,
  name          text,
  region        text,
  activity_type text,
  description   text,
  data          jsonb,
  upvotes       integer,
  verified      boolean,
  similarity    double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    id, type, name, region, activity_type, description, data, upvotes, verified,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.content_entries
  WHERE (upvotes >= min_upvotes OR verified = true)
    AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
