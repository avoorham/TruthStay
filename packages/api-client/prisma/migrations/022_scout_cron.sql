-- ── Extensions ────────────────────────────────────────────────────────────────
-- pg_net is already enabled. pg_cron must be enabled for the cron schedule.
-- If this fails, enable pg_cron via Supabase Dashboard → Database → Extensions,
-- then re-run this migration.
create extension if not exists pg_cron;
create extension if not exists pg_net;  -- already enabled; idempotent

-- ── Service-role key setup ────────────────────────────────────────────────────
-- IMPORTANT: Run the following manually after obtaining the service-role key
-- from Supabase Dashboard → Project Settings → API → service_role key.
-- Do NOT commit the key to source control.
--
--   alter database postgres
--     set app.settings.service_role_key = '<your-service-role-key-here>';
--
-- Then reconnect (or run `select pg_reload_conf();`) for the setting to take effect.

-- ── trigger_scout_worker ──────────────────────────────────────────────────────
-- Security-definer function called by pg_cron every 30s.
-- The service-role key is read from a database setting at call time; it is
-- never embedded in source-controlled SQL.
-- EXECUTE is restricted to the postgres superuser role so ordinary users
-- cannot trigger the worker or read the key indirectly.
create or replace function trigger_scout_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url              := 'https://hplczwepdpmtdfkijpnh.supabase.co/functions/v1/scout-worker',
    headers          := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body             := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function trigger_scout_worker() from public;
grant  execute on function trigger_scout_worker() to postgres;

-- ── Cron schedule ─────────────────────────────────────────────────────────────
-- DO NOT UNCOMMENT until the smoke test in Step 10 passes.
-- A broken worker firing every 30s is a bad time.
--
-- After smoke test confirms the worker processes a job successfully, run:
--
--   select cron.schedule(
--     'scout-worker-tick',
--     '30 seconds',
--     $$ select trigger_scout_worker(); $$
--   );
--
-- To pause without removing the schedule:
--   select cron.unschedule('scout-worker-tick');
