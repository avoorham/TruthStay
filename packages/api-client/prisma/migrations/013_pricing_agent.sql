-- Migration 013: Pricing Agent — reports table and pg_cron schedules
-- ─────────────────────────────────────────────────────────────────────────────

-- ── pricing_reports ───────────────────────────────────────────────────────────
-- Stores output from all Pricing Agent actions:
--   • conversion_analysis  (monthly, 5th)
--   • pricing_recommendation (monthly, 6th)
--   • promo_evaluation       (weekly, Wednesday)
--   • competitor_check       (monthly, 15th)

CREATE TABLE IF NOT EXISTS public.pricing_reports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type    text        NOT NULL
    CHECK (report_type IN (
      'conversion_analysis',
      'pricing_recommendation',
      'promo_evaluation',
      'competitor_check'
    )),
  report_date    date        NOT NULL,
  data           jsonb       NOT NULL DEFAULT '{}',
  analysis       jsonb       NOT NULL DEFAULT '{}',
  spend_auth_id  uuid        REFERENCES public.spend_authorisations(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_reports_type_date
  ON public.pricing_reports (report_type, report_date DESC);

ALTER TABLE public.pricing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_reports_admin_all" ON public.pricing_reports
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── Register the Pricing Agent ────────────────────────────────────────────────

INSERT INTO public.agent_registry (id, display_name, description, monthly_budget_usd, weekly_budget_usd)
VALUES (
  'pricing',
  'Pricing Agent',
  'Optimises subscription pricing and promo strategies for revenue maximisation',
  10.00,
  3.00
)
ON CONFLICT (id) DO NOTHING;

-- ── pg_cron schedules ─────────────────────────────────────────────────────────
-- Requires the pg_cron extension (enabled on Supabase Pro).
-- The SUPABASE_URL and service-role key are injected via Supabase Vault secrets
-- in production; replace the placeholder values below with your project details.

DO $$
DECLARE
  v_url  text := current_setting('app.settings.supabase_url',  true);
  v_key  text := current_setting('app.settings.service_role_key', true);
BEGIN
  -- analyse_conversion: monthly on the 5th at 09:00 UTC
  PERFORM cron.schedule(
    'pricing-analyse-conversion',
    '0 9 5 * *',
    format(
      $q$
      SELECT net.http_post(
        url     := %L || '/functions/v1/pricing-agent',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{"action":"analyse_conversion"}'::jsonb
      );
      $q$,
      v_url, v_key
    )
  );

  -- recommend_pricing: monthly on the 6th at 09:00 UTC
  -- Runs the day after conversion analysis so fresh data is available.
  PERFORM cron.schedule(
    'pricing-recommend-pricing',
    '0 9 6 * *',
    format(
      $q$
      SELECT net.http_post(
        url     := %L || '/functions/v1/pricing-agent',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{"action":"recommend_pricing"}'::jsonb
      );
      $q$,
      v_url, v_key
    )
  );

  -- evaluate_promos: weekly on Wednesday at 09:00 UTC
  PERFORM cron.schedule(
    'pricing-evaluate-promos',
    '0 9 * * 3',
    format(
      $q$
      SELECT net.http_post(
        url     := %L || '/functions/v1/pricing-agent',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{"action":"evaluate_promos"}'::jsonb
      );
      $q$,
      v_url, v_key
    )
  );

  -- competitor_check: monthly on the 15th at 09:00 UTC
  PERFORM cron.schedule(
    'pricing-competitor-check',
    '0 9 15 * *',
    format(
      $q$
      SELECT net.http_post(
        url     := %L || '/functions/v1/pricing-agent',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{"action":"competitor_check"}'::jsonb
      );
      $q$,
      v_url, v_key
    )
  );
END;
$$;
