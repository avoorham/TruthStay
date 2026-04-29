-- Migration 011: Agent system — CFO, message bus, spend authorisations, budget planning
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Patch agent_runs (009 omitted restaurants_found) ─────────────────────────
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS restaurants_found integer NOT NULL DEFAULT 0;

-- ── platform_config ───────────────────────────────────────────────────────────
-- Generic key/value store for CFO rules, system config, and growth targets.

CREATE TABLE IF NOT EXISTS public.platform_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_config_admin_all" ON public.platform_config
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Seed CFO operating rules
INSERT INTO public.platform_config (key, value) VALUES
  ('cfo_rules', '{
    "max_cost_to_revenue_ratio": 0.80,
    "reserve_pct": 0.20,
    "auto_approve_under_usd": 1.00,
    "lightweight_approve_under_usd": 5.00,
    "weekly_auto_apply": "base",
    "plan_approval_deadline_day": 3,
    "forecast_horizon_months": 3,
    "pre_revenue_monthly_budget": 100
  }'),
  ('growth_targets', '{
    "mau_target_3m": 500,
    "mau_target_12m": 5000,
    "mrr_target_3m": 250,
    "mrr_target_12m": 2500,
    "content_entries_target": 1000
  }'),
  ('system', '{
    "supabase_url": "",
    "service_role_key": ""
  }')
ON CONFLICT (key) DO NOTHING;

-- ── agent_registry ────────────────────────────────────────────────────────────
-- Tracks all agents, their status, and current budget allocations.

CREATE TABLE IF NOT EXISTS public.agent_registry (
  id                        text PRIMARY KEY,
  display_name              text NOT NULL,
  description               text,
  status                    text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'error', 'disabled')),
  -- Monthly budget (set by CFO / approved plan)
  monthly_budget_usd        numeric NOT NULL DEFAULT 0,
  budget_spent_this_month   numeric NOT NULL DEFAULT 0,
  budget_reset_day          int NOT NULL DEFAULT 1,
  -- Weekly budget (set by selected weekly scenario)
  weekly_budget_usd         numeric NOT NULL DEFAULT 0,
  weekly_spent              numeric NOT NULL DEFAULT 0,
  weekly_reset_day          int NOT NULL DEFAULT 1,   -- 1 = Monday
  -- Execution config
  schedule_cron             text,
  max_concurrent_runs       int NOT NULL DEFAULT 1,
  last_run_at               timestamptz,
  last_run_status           text,
  -- Metadata
  config                    jsonb NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_registry_admin_all" ON public.agent_registry
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "agent_registry_auth_read" ON public.agent_registry
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed agent registry
INSERT INTO public.agent_registry (id, display_name, description, monthly_budget_usd) VALUES
  ('cfo',            'CFO Agent',            'Financial governor — manages budgets, forecasts, and approves spend across all agents', 10.00),
  ('location_scout', 'Location Scout Agent', 'Discovers and curates travel content from blogs and Instagram',                        50.00),
  ('marketing',      'Marketing Agent',      'Manages email campaigns, referral programs, and growth tactics',                      30.00),
  ('pricing',        'Pricing Agent',        'Optimises subscription pricing and promo strategies for revenue maximisation',         10.00)
ON CONFLICT (id) DO NOTHING;

-- ── agent_messages ────────────────────────────────────────────────────────────
-- Inter-agent message bus. Every spend request, approval, and status report
-- flows through this table.

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent        text NOT NULL
    CHECK (from_agent IN ('cfo', 'marketing', 'pricing', 'location_scout', 'system', 'admin')),
  to_agent          text NOT NULL
    CHECK (to_agent IN ('cfo', 'marketing', 'pricing', 'location_scout', 'system', 'admin', 'all')),
  message_type      text NOT NULL
    CHECK (message_type IN (
      'spend_request', 'spend_approved', 'spend_denied', 'spend_report',
      'budget_alert', 'budget_update', 'status_report',
      'task_request', 'task_complete', 'directive', 'escalation'
    )),
  payload           jsonb NOT NULL DEFAULT '{}',
  priority          text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'resolved', 'expired')),
  parent_message_id uuid REFERENCES public.agent_messages(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_to
  ON public.agent_messages (to_agent, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type
  ON public.agent_messages (message_type, status);
CREATE INDEX IF NOT EXISTS idx_agent_messages_parent
  ON public.agent_messages (parent_message_id);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_messages_admin_all" ON public.agent_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "agent_messages_auth_read" ON public.agent_messages
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── spend_authorisations ──────────────────────────────────────────────────────
-- Every spend request submitted to the CFO, with decision, execution tracking,
-- and actual cost once the work is done.

CREATE TABLE IF NOT EXISTS public.spend_authorisations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            text REFERENCES public.agent_registry(id),
  request_message_id  uuid REFERENCES public.agent_messages(id),
  response_message_id uuid REFERENCES public.agent_messages(id),
  -- Request details
  action              text NOT NULL,
  estimated_cost_usd  numeric NOT NULL,
  cost_breakdown      jsonb,
  justification       text,
  -- CFO decision
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'partially_approved', 'expired')),
  approved_amount_usd numeric,
  conditions          text,
  denial_reason       text,
  decided_at          timestamptz,
  decided_by          text DEFAULT 'cfo_agent',
  -- Execution tracking
  actual_cost_usd     numeric,
  execution_status    text NOT NULL DEFAULT 'not_started'
    CHECK (execution_status IN ('not_started', 'running', 'completed', 'failed', 'cancelled')),
  execution_results   jsonb,
  completed_at        timestamptz,
  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_spend_auth_agent
  ON public.spend_authorisations (agent_id, status);
CREATE INDEX IF NOT EXISTS idx_spend_auth_status
  ON public.spend_authorisations (status, created_at DESC);

ALTER TABLE public.spend_authorisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spend_auth_admin_all" ON public.spend_authorisations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "spend_auth_auth_read" ON public.spend_authorisations
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── infrastructure_costs ──────────────────────────────────────────────────────
-- Fixed and semi-fixed platform costs. Normalised to a monthly_equivalent for
-- budget calculations regardless of billing cycle.

CREATE TABLE IF NOT EXISTS public.infrastructure_costs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service            text NOT NULL,
  plan_name          text,
  billing_cycle      text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time', 'usage_based')),
  cost_per_cycle     numeric NOT NULL,
  monthly_equivalent numeric NOT NULL,
  next_billing_date  date,
  auto_renew         boolean NOT NULL DEFAULT true,
  status             text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'trial', 'paused')),
  notes              text,
  dashboard_url      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.infrastructure_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "infra_costs_admin_all" ON public.infrastructure_costs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "infra_costs_auth_read" ON public.infrastructure_costs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed current infrastructure
INSERT INTO public.infrastructure_costs
  (service, plan_name, billing_cycle, cost_per_cycle, monthly_equivalent, notes, dashboard_url)
VALUES
  ('supabase',         'Pro',                        'monthly',   25.00,  25.00, 'Database, Auth, Storage, Edge Functions',        'https://supabase.com/dashboard/org/_/billing'),
  ('vercel',           'Pro',                        'monthly',   20.00,  20.00, 'Hosting, Serverless, Bandwidth',                 'https://vercel.com/account/billing'),
  ('apple_developer',  'Apple Developer Program',    'yearly',    99.00,   8.25, 'Required for App Store',                        'https://developer.apple.com/account'),
  ('google_developer', 'Google Play Console',        'one_time',  25.00,   0.00, 'One-time registration fee (already paid)',        null),
  ('domain',           'truthstay.com',              'yearly',    15.00,   1.25, 'Domain registration',                            null),
  ('email_provider',   'Resend Free',                'monthly',    0.00,   0.00, 'Free tier: 3000 emails/month',                   'https://resend.com/settings/billing')
ON CONFLICT DO NOTHING;

-- ── financial_forecasts ───────────────────────────────────────────────────────
-- Rolling 3-month forecasts generated by the CFO Agent.

CREATE TABLE IF NOT EXISTS public.financial_forecasts (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date                   date NOT NULL,
  forecast_month                  date NOT NULL,
  projected_mrr                   numeric,
  projected_commissions           numeric,
  projected_total_revenue         numeric,
  projected_api_costs             numeric,
  projected_marketing_costs       numeric,
  projected_infrastructure_costs  numeric,
  projected_total_costs           numeric,
  projected_net                   numeric,
  assumptions                     jsonb,
  confidence                      text NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  created_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecasts_admin_all" ON public.financial_forecasts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── monthly_budget_plans ──────────────────────────────────────────────────────
-- CFO-generated monthly budget proposals. Must be approved by admin before
-- any agent can spend for that month (safety governance).

CREATE TABLE IF NOT EXISTS public.monthly_budget_plans (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_month                  date NOT NULL,
  status                      text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'revision_requested', 'approved', 'rejected')),
  total_budget_usd            numeric NOT NULL,
  total_revenue_forecast_usd  numeric,
  projected_net_usd           numeric,
  agent_budgets               jsonb NOT NULL DEFAULT '{}',
  last_month_review           jsonb,
  revenue_forecast            jsonb,
  risks_and_recommendations   text,
  key_assumptions             text,
  approved_by                 uuid,
  approved_at                 timestamptz,
  admin_notes                 text,
  admin_adjustments           jsonb,
  generated_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_plans_month
  ON public.monthly_budget_plans (plan_month);
CREATE INDEX IF NOT EXISTS idx_budget_plans_status
  ON public.monthly_budget_plans (status);

ALTER TABLE public.monthly_budget_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_plans_admin_all" ON public.monthly_budget_plans
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── budget_plan_amendments ────────────────────────────────────────────────────
-- Tracks mid-month adjustments to approved plans.

CREATE TABLE IF NOT EXISTS public.budget_plan_amendments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES public.monthly_budget_plans(id),
  amendment_type  text NOT NULL
    CHECK (amendment_type IN ('budget_increase', 'budget_decrease', 'reallocation', 'emergency_cut')),
  changes         jsonb NOT NULL DEFAULT '{}',
  reason          text NOT NULL,
  applied_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_plan_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amendments_admin_all" ON public.budget_plan_amendments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── weekly_scenarios ──────────────────────────────────────────────────────────
-- Sunday-generated three-scenario spending plans. Admin selects one (or BASE
-- is auto-applied Monday 9am). Selection writes weekly limits to agent_registry.

CREATE TABLE IF NOT EXISTS public.weekly_scenarios (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start            date NOT NULL,
  plan_month_id         uuid REFERENCES public.monthly_budget_plans(id),
  status                text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'scenario_selected', 'expired')),
  optimistic            jsonb NOT NULL DEFAULT '{}',
  base                  jsonb NOT NULL DEFAULT '{}',
  conservative          jsonb NOT NULL DEFAULT '{}',
  selected_scenario     text
    CHECK (selected_scenario IN ('optimistic', 'base', 'conservative', 'custom')),
  custom_parameters     jsonb,
  selected_at           timestamptz,
  selected_by           uuid,
  week_number           int,
  month_budget_remaining  numeric,
  month_budget_spent      numeric,
  month_days_remaining    int,
  performance_summary   text,
  risk_assessment       text,
  generated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_scenarios_week
  ON public.weekly_scenarios (week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_scenarios_status
  ON public.weekly_scenarios (status);

ALTER TABLE public.weekly_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_scenarios_admin_all" ON public.weekly_scenarios
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "weekly_scenarios_auth_read" ON public.weekly_scenarios
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── Views ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.monthly_infrastructure_costs AS
SELECT
  COALESCE(SUM(monthly_equivalent), 0) AS total_monthly,
  jsonb_agg(
    jsonb_build_object(
      'service',        service,
      'plan',           plan_name,
      'monthly_cost',   monthly_equivalent,
      'billing_cycle',  billing_cycle,
      'next_billing',   next_billing_date
    ) ORDER BY monthly_equivalent DESC
  ) AS breakdown
FROM public.infrastructure_costs
WHERE status = 'active';

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Apply an approved monthly budget plan to agent_registry.
CREATE OR REPLACE FUNCTION public.apply_approved_budget_plan(plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_plan  public.monthly_budget_plans;
  v_key   text;
  v_val   jsonb;
BEGIN
  SELECT * INTO v_plan FROM public.monthly_budget_plans WHERE id = plan_id;

  IF v_plan.status != 'approved' THEN
    RAISE EXCEPTION 'Plan % must be approved before applying (status: %)', plan_id, v_plan.status;
  END IF;

  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(v_plan.agent_budgets)
  LOOP
    IF v_key = 'reserve' THEN CONTINUE; END IF;

    UPDATE public.agent_registry
    SET
      monthly_budget_usd      = (v_val->>'budget_usd')::numeric,
      budget_spent_this_month = 0,
      updated_at              = NOW()
    WHERE id = v_key;
  END LOOP;
END;
$$;

-- Daily safety net: pause non-CFO agents if no approved plan exists after the 3rd.
CREATE OR REPLACE FUNCTION public.check_budget_plan_approval()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_current_month  date := date_trunc('month', CURRENT_DATE)::date;
  v_day            int  := EXTRACT(day FROM CURRENT_DATE);
  v_has_approved   boolean;
BEGIN
  IF v_day < 3 THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.monthly_budget_plans
    WHERE plan_month = v_current_month AND status = 'approved'
  ) INTO v_has_approved;

  IF NOT v_has_approved THEN
    UPDATE public.agent_registry
    SET status = 'paused'
    WHERE id != 'cfo' AND status = 'active';

    INSERT INTO public.agent_messages
      (from_agent, to_agent, message_type, payload, priority)
    VALUES (
      'system', 'admin', 'budget_alert',
      jsonb_build_object(
        'message',         'WARNING: No approved budget plan for ' ||
                           to_char(v_current_month, 'Month YYYY') ||
                           '. All agents have been paused. Please review and approve the pending plan at /agents/cfo/budget-plan.',
        'action_required', true,
        'action_url',      '/agents/cfo/budget-plan'
      ),
      'critical'
    );
  END IF;
END;
$$;

-- Apply a selected weekly scenario, writing weekly budget limits to agent_registry.
CREATE OR REPLACE FUNCTION public.apply_weekly_scenario(
  scenario_id uuid,
  selected    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_scenario   public.weekly_scenarios;
  v_params     jsonb;
  v_agent_id   text;
  v_agent_cfg  jsonb;
BEGIN
  SELECT * INTO v_scenario FROM public.weekly_scenarios WHERE id = scenario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Weekly scenario % not found', scenario_id;
  END IF;

  v_params := CASE selected
    WHEN 'optimistic'   THEN v_scenario.optimistic
    WHEN 'base'         THEN v_scenario.base
    WHEN 'conservative' THEN v_scenario.conservative
    WHEN 'custom'       THEN v_scenario.custom_parameters
    ELSE NULL
  END;

  IF v_params IS NULL THEN
    RAISE EXCEPTION 'Unknown scenario variant: %', selected;
  END IF;

  FOR v_agent_id, v_agent_cfg IN
    SELECT key, value FROM jsonb_each(v_params->'agent_limits')
  LOOP
    UPDATE public.agent_registry
    SET
      weekly_budget_usd = (v_agent_cfg->>'weekly_budget')::numeric,
      weekly_spent      = 0,
      updated_at        = NOW()
    WHERE id = v_agent_id;
  END LOOP;

  UPDATE public.weekly_scenarios
  SET
    status            = 'scenario_selected',
    selected_scenario = selected,
    selected_at       = NOW()
  WHERE id = scenario_id;
END;
$$;

-- pg_cron helper: invoke a CFO edge function action via net.http_post.
-- Reads project URL and service role key from platform_config.key = 'system'.
-- Run once after deployment: UPDATE platform_config SET value = '{"supabase_url":"<url>","service_role_key":"<key>"}' WHERE key = 'system';
CREATE OR REPLACE FUNCTION public.invoke_cfo_agent(action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cfg  jsonb;
  v_url  text;
  v_key  text;
BEGIN
  SELECT value INTO v_cfg FROM public.platform_config WHERE key = 'system';
  v_url := v_cfg->>'supabase_url';
  v_key := v_cfg->>'service_role_key';

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'invoke_cfo_agent: platform_config.system.supabase_url or service_role_key not set — skipping %', action;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/cfo-agent',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('action', action)
  );
END;
$$;

-- ── pg_cron schedules ─────────────────────────────────────────────────────────
-- Requires pg_cron + pg_net extensions (Supabase Pro).
-- If not available, these can be set up manually via the Supabase dashboard.

SELECT cron.schedule(
  'cfo-spend-check',
  '*/15 * * * *',
  $$ SELECT public.invoke_cfo_agent('process_spend_requests') $$
);

SELECT cron.schedule(
  'cfo-weekly-scenarios',
  '0 18 * * 0',    -- Sunday 18:00 UTC
  $$ SELECT public.invoke_cfo_agent('generate_weekly_scenarios') $$
);

SELECT cron.schedule(
  'cfo-monthly-plan',
  '0 9 25 * *',    -- 25th of month 09:00 UTC
  $$ SELECT public.invoke_cfo_agent('generate_monthly_plan') $$
);

SELECT cron.schedule(
  'cfo-budget-reset',
  '0 1 1 * *',     -- 1st of month 01:00 UTC
  $$ SELECT public.invoke_cfo_agent('reset_budgets') $$
);

SELECT cron.schedule(
  'check-budget-approval',
  '0 6 * * *',     -- Daily 06:00 UTC
  $$ SELECT public.check_budget_plan_approval() $$
);
