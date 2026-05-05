-- 023_scrapingbee_usage.sql
-- Monthly ScrapingBee usage tracking. Used by scout-worker budget guard to
-- prevent runaway spend. Upserted after every headless fetch via
-- increment_scrapingbee_usage().

create table if not exists scrapingbee_usage (
  month_start     date           primary key,
  api_calls_total integer        not null default 0,
  cost_usd        numeric(10, 4) not null default 0,
  updated_at      timestamptz    not null default now()
);

create or replace function increment_scrapingbee_usage(
  p_calls integer,
  p_cost  numeric
) returns void
language plpgsql
as $$
declare
  current_month date := date_trunc('month', now())::date;
begin
  insert into scrapingbee_usage (month_start, api_calls_total, cost_usd, updated_at)
  values (current_month, p_calls, p_cost, now())
  on conflict (month_start) do update set
    api_calls_total = scrapingbee_usage.api_calls_total + excluded.api_calls_total,
    cost_usd        = scrapingbee_usage.cost_usd + excluded.cost_usd,
    updated_at      = now();
end;
$$;
