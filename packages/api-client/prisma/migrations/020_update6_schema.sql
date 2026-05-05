-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

-- ── Extend content_entries ───────────────────────────────────────────────────

-- Add 'activity' to the allowed type set
alter table content_entries drop constraint if exists content_entries_type_check;
alter table content_entries add constraint content_entries_type_check
  check (type = any(array['route','accommodation','restaurant','activity']));

alter table content_entries
  add column if not exists source_urls             jsonb        not null default '[]'::jsonb,
  add column if not exists independent_source_count integer     not null default 0,
  add column if not exists quality_score           numeric(4,3) not null default 0,
  -- status: deprecated verified boolean is mirrored here; verified stays for backward compat
  add column if not exists status                  text         not null default 'pending_review'
    check (status in ('pending_review','approved','rejected','merged')),
  add column if not exists canonical_id            uuid         references content_entries(id),
  add column if not exists last_seen_at            timestamptz  not null default now(),
  add column if not exists features                jsonb        not null default '{}'::jsonb;
-- NB: verified boolean kept as deprecated mirror — do not drop in this update

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists content_entries_status_idx
  on content_entries (status);
create index if not exists content_entries_canonical_idx
  on content_entries (canonical_id) where canonical_id is not null;
create index if not exists content_entries_name_trgm_idx
  on content_entries using gin (name gin_trgm_ops);

-- ── Backfill existing entries ─────────────────────────────────────────────────
update content_entries
  set status = case when verified = true then 'approved' else 'pending_review' end
  where status = 'pending_review';

update content_entries
set
  source_urls = coalesce(
    (select jsonb_agg(
       jsonb_build_object(
         'source_url',      src->>'url',
         'source_type',     coalesce(src->>'type', 'blog'),
         'source_label',    coalesce(src->>'author', ''),
         'evidence_excerpt', coalesce(src->>'excerpt', ''),
         'first_seen_at',   created_at
       )
     ) from jsonb_array_elements(coalesce(data->'sources','[]'::jsonb)) src
     where (src->>'url') is not null
    ),
    '[]'::jsonb
  ),
  independent_source_count = greatest(1, jsonb_array_length(coalesce(data->'sources','[]'::jsonb))),
  last_seen_at = created_at
where source_urls = '[]'::jsonb;

-- ── Helper RPC: fuzzy name match for Stage 3 dedup ──────────────────────────
create or replace function match_content_entry(
  p_type    text,
  p_name    text,
  p_region  text default ''
) returns table (
  id                       uuid,
  name                     text,
  source_urls              jsonb,
  independent_source_count integer,
  trust_score              real,
  status                   text,
  canonical_id             uuid
) language sql security definer set search_path = public as $$
  select
    id,
    name,
    source_urls,
    independent_source_count,
    trust_score::real,
    status,
    canonical_id
  from content_entries
  where type = p_type
    and status != 'rejected'
    and (p_region = '' or region ilike '%' || p_region || '%')
    and similarity(name, p_name) > 0.5
  order by similarity(name, p_name) desc
  limit 5;
$$;

-- ── review_decisions ─────────────────────────────────────────────────────────
create table if not exists review_decisions (
  id               uuid        primary key default gen_random_uuid(),
  entry_id         uuid        not null references content_entries(id) on delete cascade,
  reviewer_id      uuid        not null references auth.users(id),
  decision         text        not null check (decision in ('approve','reject','edit')),
  reason           text,
  feature_snapshot jsonb       not null,
  created_at       timestamptz not null default now()
);

create index if not exists review_decisions_decision_idx on review_decisions (decision);
create index if not exists review_decisions_created_idx  on review_decisions (created_at desc);

alter table review_decisions enable row level security;
create policy "admins manage decisions"
  on review_decisions for all
  using  (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ── agent_rubric (singleton) ──────────────────────────────────────────────────
create table if not exists agent_rubric (
  id                              integer     primary key default 1 check (id = 1),
  rubric_text                     text        not null default '',
  generated_from_decisions_count  integer     not null default 0,
  generated_at                    timestamptz,
  base_rules                      text        not null default ''
);

insert into agent_rubric (id, base_rules)
values (1, E'BASE QUALITY RUBRIC (always applied):\n- Specific named place, not a generic category ("Hotel Bela Vista" not "a nice hotel")\n- Description has at least one concrete detail (location, view, amenity, price tier, vibe)\n- Coordinates or full address present, OR enough context to geocode unambiguously\n- For accommodations: room types or price range mentioned where possible\n- For restaurants: cuisine type and at least one dish or atmosphere note\n- For activities: duration, difficulty, or what makes it distinct\n- No marketing fluff ("paradise", "unforgettable") without substance behind it')
on conflict (id) do nothing;
