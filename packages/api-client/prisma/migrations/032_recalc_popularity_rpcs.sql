-- Migration 032: RPC functions for popularity recalculation
-- Called by the recalc-popularity edge function every 15 minutes.

create or replace function recalc_content_entry_save_counts()
returns void language sql as $$
  update content_entries ce
  set save_count = (
    select count(*)
    from adventure_content_links acl
    inner join adventures a on a.id = acl.adventure_id
    where acl.content_entry_id = ce.id
      and a."isSaved" = true
  );
$$;

create or replace function recalc_destination_chip_save_counts()
returns void language sql as $$
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
$$;
