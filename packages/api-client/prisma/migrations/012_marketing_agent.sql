-- Migration 012: Marketing Agent — user segments, campaigns, referral programme
-- ─────────────────────────────────────────────────────────────────────────────

-- ── user_segments ─────────────────────────────────────────────────────────────
-- Snapshots of user cohorts identified by the Marketing Agent. Archived and
-- recreated each time identify_segments runs.

CREATE TABLE IF NOT EXISTS public.user_segments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  criteria       jsonb NOT NULL DEFAULT '{}',
  user_ids       text[] NOT NULL DEFAULT '{}',
  user_count     int NOT NULL DEFAULT 0,
  segment_stats  jsonb NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'draft')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_segments_status
  ON public.user_segments (status, created_at DESC);

ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_segments_admin_all" ON public.user_segments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── marketing_campaigns ───────────────────────────────────────────────────────
-- Campaigns drafted by plan_campaign and sent by execute_campaign.

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  campaign_type       text NOT NULL
    CHECK (campaign_type IN (
      'churn_prevention', 'segment_blast', 'referral_prompt',
      'welcome', 're_engagement'
    )),
  segment_id          uuid REFERENCES public.user_segments(id),
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending_spend_approval', 'approved',
      'sending', 'sent', 'paused', 'cancelled'
    )),
  subject             text NOT NULL,
  preview_text        text,
  body_html           text NOT NULL,
  body_text           text NOT NULL,
  target_user_ids     text[] NOT NULL DEFAULT '{}',
  estimated_cost_usd  numeric NOT NULL DEFAULT 0,
  actual_cost_usd     numeric,
  spend_auth_id       uuid REFERENCES public.spend_authorisations(id),
  sent_count          int NOT NULL DEFAULT 0,
  delivered_count     int NOT NULL DEFAULT 0,
  open_count          int NOT NULL DEFAULT 0,
  click_count         int NOT NULL DEFAULT 0,
  scheduled_for       timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status
  ON public.marketing_campaigns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_type
  ON public.marketing_campaigns (campaign_type, status);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_admin_all" ON public.marketing_campaigns
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── campaign_recipients ───────────────────────────────────────────────────────
-- Per-user send + engagement tracking for every campaign.

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  user_id            text NOT NULL,
  email              text NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  sent_at            timestamptz,
  opened_at          timestamptz,
  clicked_at         timestamptz,
  resend_message_id  text,
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign
  ON public.campaign_recipients (campaign_id, status);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_admin_all" ON public.campaign_recipients
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── referral_codes ────────────────────────────────────────────────────────────
-- One code per user, generated on-demand by the marketing agent or app.

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            text NOT NULL UNIQUE,
  code               text NOT NULL UNIQUE,
  times_used         int NOT NULL DEFAULT 0,
  conversions        int NOT NULL DEFAULT 0,
  reward_earned_usd  numeric NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON public.referral_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes (code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_codes_admin_all" ON public.referral_codes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Users can read their own referral code
CREATE POLICY "referral_codes_user_read" ON public.referral_codes
  FOR SELECT USING (
    user_id = (
      SELECT id FROM public.users
      WHERE "authId" = auth.uid()::text
      LIMIT 1
    )
  );

-- ── referral_events ───────────────────────────────────────────────────────────
-- Every action in the referral funnel: click → signup → first_adventure → subscription.

CREATE TABLE IF NOT EXISTS public.referral_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id text NOT NULL,
  referee_user_id  text,
  referral_code    text NOT NULL,
  event_type       text NOT NULL
    CHECK (event_type IN ('click', 'signup', 'first_adventure', 'subscription')),
  revenue_impact   numeric NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer
  ON public.referral_events (referrer_user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_created
  ON public.referral_events (created_at DESC);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_events_admin_all" ON public.referral_events
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── referral_programme_reports ────────────────────────────────────────────────
-- Weekly AI-generated performance reports from monitor_referrals.

CREATE TABLE IF NOT EXISTS public.referral_programme_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date        date NOT NULL,
  period_start       date NOT NULL,
  period_end         date NOT NULL,
  total_referrals    int NOT NULL DEFAULT 0,
  total_signups      int NOT NULL DEFAULT 0,
  total_conversions  int NOT NULL DEFAULT 0,
  conversion_rate    numeric NOT NULL DEFAULT 0,
  revenue_impact     numeric NOT NULL DEFAULT 0,
  top_referrers      jsonb NOT NULL DEFAULT '[]',
  ai_insights        text,
  recommendations    text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_programme_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_reports_admin_all" ON public.referral_programme_reports
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── invoke_marketing_agent ────────────────────────────────────────────────────
-- pg_cron helper: POST to the marketing-agent edge function.
-- Reads project URL and service role key from platform_config.key = 'system'.

CREATE OR REPLACE FUNCTION public.invoke_marketing_agent(
  action text,
  params jsonb DEFAULT '{}'
)
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
    RAISE WARNING 'invoke_marketing_agent: platform_config.system not configured — skipping %', action;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/marketing-agent',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('action', action) || params
  );
END;
$$;

-- ── pg_cron schedules ─────────────────────────────────────────────────────────
-- Requires pg_cron + pg_net extensions (Supabase Pro, same as CFO schedules).

SELECT cron.schedule(
  'marketing-churn-prevention',
  '0 8 * * *',     -- Daily 08:00 UTC
  $$ SELECT public.invoke_marketing_agent('churn_prevention') $$
);

SELECT cron.schedule(
  'marketing-identify-segments',
  '0 9 * * 1',     -- Monday 09:00 UTC
  $$ SELECT public.invoke_marketing_agent('identify_segments') $$
);

SELECT cron.schedule(
  'marketing-monitor-referrals',
  '0 10 * * 2',    -- Tuesday 10:00 UTC
  $$ SELECT public.invoke_marketing_agent('monitor_referrals') $$
);
