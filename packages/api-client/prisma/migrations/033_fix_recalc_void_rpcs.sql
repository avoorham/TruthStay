-- Migration 033: fix recalc-popularity RPCs — change RETURNS void → RETURNS integer
--
-- Root cause: PostgREST returns HTTP 204 No Content for RETURNS void functions.
-- The supabase-js client (imported via esm.sh/@supabase/supabase-js@2 in the
-- recalc-popularity edge function) interprets the empty 204 body as an error
-- object, causing the edge function to return HTTP 500 on every invocation.
-- The SQL UPDATEs were actually running correctly; only the response handling failed.
--
-- Fix: change both functions to RETURNS integer and add `select 1` so PostgREST
-- returns a non-empty body (HTTP 200 with [1]). No caller logic changes needed —
-- the edge function ignores the return value and only checks `error`.

drop function if exists recalc_content_entry_save_counts();
drop function if exists recalc_destination_chip_save_counts();

create function recalc_content_entry_save_counts()
returns integer language sql as $$
  update content_entries ce
  set save_count = (
    select count(*)
    from adventure_content_links acl
    inner join adventures a on a.id = acl.adventure_id
    where acl.content_entry_id = ce.id
      and a."isSaved" = true
  );
  select 1;
$$;

create or replace function recalc_destination_chip_save_counts()
returns integer language sql as $$
  update destination_chips dc
  set
    save_count = (
      select count(distinct a.id)
      from adventures a
      where a."isSaved" = true
        and (
          a.region = dc.name
          or exists (
            select 1
            from adventure_days ad
            where ad."adventureId" = a.id
              and ad.alternatives->>'destination' = dc.name
          )
        )
    ),
    last_recalculated_at = now();
  select 1;
$$;
