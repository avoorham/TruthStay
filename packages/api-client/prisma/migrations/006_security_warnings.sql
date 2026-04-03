-- TruthStay — Security Warning Fixes
-- Run once in Supabase Dashboard → SQL Editor → New query
--
-- Addresses:
--   1. function_search_path_mutable  — add SET search_path to all three functions
--   2. extension_in_public (vector)  — move to extensions schema

-- ── 1. Fix mutable search_path on all three functions ─────────────────────────
--
-- Uses the oid::regprocedure cast to get the full signature automatically,
-- so no need to hard-code parameter types.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM   pg_proc
    WHERE  pronamespace = 'public'::regnamespace
    AND    proname IN ('add_content_upvote', 'check_content_verified', 'match_content')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_temp',
      r.sig
    );
    RAISE NOTICE 'Fixed search_path on %', r.sig;
  END LOOP;
END;
$$;

-- ── 2. Move pgvector extension out of the public schema ───────────────────────
--
-- The extensions schema is always in Supabase's default search_path,
-- so existing vector(1536) columns and function signatures continue to work.

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
