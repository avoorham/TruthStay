-- Migration 034: fix recalc RPCs — add WHERE true to unbounded UPDATEs
--
-- Root cause: PostgREST rejects LANGUAGE sql functions containing UPDATE statements
-- without a WHERE clause (SQLSTATE 21000, "UPDATE requires a WHERE clause"). This
-- restriction applies to inlineable SQL functions because PostgREST inspects the body.
-- LANGUAGE plpgsql functions are opaque to PostgREST and would not hit this check,
-- but the simplest fix is to add WHERE true — equivalent semantics, satisfies PostgREST.
-- Migration 033 already changed the return type from void → integer; this builds on it.

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
  )
  where true;
  select 1;
$$;

create function recalc_destination_chip_save_counts()
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
    last_recalculated_at = now()
  where true;
  select 1;
$$;
