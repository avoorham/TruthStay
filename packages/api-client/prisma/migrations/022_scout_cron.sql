-- 022_scout_cron.sql
-- Cron trigger for scout-worker. Reads service-role key from Supabase Vault
-- (NOT from app.settings.* GUCs — Supabase's hosted Postgres does not allow
-- the SQL Editor role to set those parameters; this was discovered during
-- update-7 deployment).
--
-- Pre-requisites (already in place from update-7 manual deploy):
-- - pg_cron extension enabled
-- - pg_net extension enabled
-- - vault.secrets row 'scout_worker_service_role_key' contains the service-role key

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function trigger_scout_worker()
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  service_key text;
  worker_url constant text := 'https://hplczwepdpmtdfkijpnh.supabase.co/functions/v1/scout-worker';
begin
  select decrypted_secret
    into service_key
  from vault.decrypted_secrets
  where name = 'scout_worker_service_role_key';

  if service_key is null then
    raise exception 'service-role key not found in Vault under name scout_worker_service_role_key';
  end if;

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function trigger_scout_worker() from public;
grant execute on function trigger_scout_worker() to postgres;

-- The cron schedule itself is NOT created here. It is activated as the final
-- step of update-8, only after all three smoke tests pass. Activation SQL:
--
-- select cron.schedule(
--   'scout-worker-tick',
--   '30 seconds',
--   'select trigger_scout_worker();'
-- );
