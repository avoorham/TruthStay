-- ── Extend content_sources: error tracking and health (Step 5e) ─────────────
alter table content_sources
  add column if not exists last_error_at      timestamptz,
  add column if not exists last_error_message text,
  add column if not exists health             text not null default 'ok'
    check (health in ('ok', 'broken'));

-- ── scout_jobs ────────────────────────────────────────────────────────────────
create table if not exists scout_jobs (
  id              uuid    primary key default gen_random_uuid(),
  job_type        text    not null check (job_type in ('scrape_source','run_scout')),
  status          text    not null default 'queued'
    check (status in ('queued','running','done','failed','cancelled')),

  -- inputs
  source_id       uuid    references content_sources(id) on delete cascade,
  trigger_payload jsonb   not null default '{}'::jsonb,
  created_by      uuid    references auth.users(id),

  -- execution tracking
  attempt_count   integer not null default 0,
  max_attempts    integer not null default 3,
  last_error      text,
  last_error_code text,
  retryable       boolean not null default true,

  -- progress (worker writes here; UI polls and renders stage badge + counters)
  progress        jsonb   not null default '{}'::jsonb,

  -- results
  entries_created integer,
  entries_updated integer,
  result_summary  jsonb,

  -- timing
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  next_attempt_at timestamptz
);

create index scout_jobs_status_next_idx
  on scout_jobs (status, next_attempt_at)
  where status in ('queued','running');

create index scout_jobs_source_idx
  on scout_jobs (source_id, created_at desc);

create index scout_jobs_created_idx
  on scout_jobs (created_at desc);

alter table scout_jobs enable row level security;

create policy "admins read jobs"
  on scout_jobs for select
  using (auth.uid() is not null);

create policy "admins insert jobs"
  on scout_jobs for insert
  with check (auth.uid() = created_by);

-- worker (service-role) updates rows; service-role bypasses RLS, no policy needed

-- ── claim_next_scout_job ──────────────────────────────────────────────────────
-- Atomically claims one queued job, returning it. Uses FOR UPDATE SKIP LOCKED
-- so concurrent cron ticks never claim the same job.
create or replace function claim_next_scout_job()
returns scout_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed scout_jobs;
begin
  update scout_jobs
  set
    status        = 'running',
    started_at    = now(),
    attempt_count = attempt_count + 1
  where id = (
    select id from scout_jobs
    where status = 'queued'
      and (next_attempt_at is null or next_attempt_at <= now())
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;
