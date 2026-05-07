create extension if not exists cube;
create extension if not exists earthdistance;

alter table content_entries
  add column if not exists place_id text;

create index if not exists content_entries_place_id_idx
  on content_entries (place_id)
  where place_id is not null;

comment on column content_entries.place_id is
  'Google Places API place_id — unique identifier per business/location. Primary dedup key when available; falls back to name+coordinate proximity otherwise.';

create or replace function match_content_entry_v2(
  p_name       text,
  p_lat        numeric,
  p_lng        numeric,
  p_focus_type text
)
returns table(id uuid, name text, place_id text, status text, canonical_id uuid)
language sql
security definer
set search_path to 'public'
as $$
  select
    ce.id,
    ce.name,
    ce.place_id,
    ce.status,
    ce.canonical_id
  from content_entries ce
  where ce.status != 'rejected'
    and ce.type = p_focus_type
    and similarity(ce.name, p_name) > 0.6
    and earth_distance(
      ll_to_earth((ce.data->'coordinates'->>'lat')::numeric,
                  (ce.data->'coordinates'->>'lng')::numeric),
      ll_to_earth(p_lat, p_lng)
    ) < 50
  order by similarity(ce.name, p_name) desc
  limit 1;
$$;
