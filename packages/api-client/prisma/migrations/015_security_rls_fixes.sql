-- Migration 015: Security — enable RLS on all public tables + fix SECURITY DEFINER view
-- ─────────────────────────────────────────────────────────────────────────────
-- Addresses Supabase security advisor warnings:
--   • security_definer_view  — monthly_infrastructure_costs
--   • rls_disabled_in_public — 30 tables
--   • sensitive_columns_exposed — analytics_events, user_interactions (resolved by RLS above)
--
-- All admin app queries use createAdminClient() (service role) which bypasses RLS,
-- so enabling RLS does not affect any existing admin functionality.

-- ── View: switch from SECURITY DEFINER to SECURITY INVOKER ───────────────────
-- PostgreSQL views are implicitly SECURITY DEFINER (run as owner). Setting
-- security_invoker = true makes the view enforce the caller's RLS permissions.

ALTER VIEW public.monthly_infrastructure_costs SET (security_invoker = true);


-- ── Helper: idempotent DROP before each CREATE POLICY ────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════════
-- CATEGORY A — Admin-only tables
-- Only accessed via service role (createAdminClient). No user policies needed.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── platform_config ───────────────────────────────────────────────────────────
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_config_admin_all" ON public.platform_config;
CREATE POLICY "platform_config_admin_all" ON public.platform_config
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── agent_registry ────────────────────────────────────────────────────────────
ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_registry_admin_all" ON public.agent_registry;
CREATE POLICY "agent_registry_admin_all" ON public.agent_registry
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "agent_registry_auth_read" ON public.agent_registry;

-- ── agent_messages ────────────────────────────────────────────────────────────
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_messages_admin_all" ON public.agent_messages;
CREATE POLICY "agent_messages_admin_all" ON public.agent_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "agent_messages_auth_read" ON public.agent_messages;

-- ── spend_authorisations ──────────────────────────────────────────────────────
ALTER TABLE public.spend_authorisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spend_auth_admin_all" ON public.spend_authorisations;
CREATE POLICY "spend_auth_admin_all" ON public.spend_authorisations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "spend_auth_auth_read" ON public.spend_authorisations;

-- ── infrastructure_costs ──────────────────────────────────────────────────────
ALTER TABLE public.infrastructure_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "infra_costs_admin_all" ON public.infrastructure_costs;
CREATE POLICY "infra_costs_admin_all" ON public.infrastructure_costs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "infra_costs_auth_read" ON public.infrastructure_costs;

-- ── monthly_budget_plans ──────────────────────────────────────────────────────
ALTER TABLE public.monthly_budget_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budget_plans_admin_all" ON public.monthly_budget_plans;
CREATE POLICY "budget_plans_admin_all" ON public.monthly_budget_plans
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── budget_plan_amendments ────────────────────────────────────────────────────
ALTER TABLE public.budget_plan_amendments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amendments_admin_all" ON public.budget_plan_amendments;
CREATE POLICY "amendments_admin_all" ON public.budget_plan_amendments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── weekly_scenarios ──────────────────────────────────────────────────────────
ALTER TABLE public.weekly_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weekly_scenarios_admin_all" ON public.weekly_scenarios;
CREATE POLICY "weekly_scenarios_admin_all" ON public.weekly_scenarios
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "weekly_scenarios_auth_read" ON public.weekly_scenarios;

-- ── booking_commissions ───────────────────────────────────────────────────────
ALTER TABLE public.booking_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_commissions_admin_all" ON public.booking_commissions;
CREATE POLICY "booking_commissions_admin_all" ON public.booking_commissions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── booking_partners ──────────────────────────────────────────────────────────
ALTER TABLE public.booking_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_partners_admin_all" ON public.booking_partners;
CREATE POLICY "booking_partners_admin_all" ON public.booking_partners
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── api_cost_log ──────────────────────────────────────────────────────────────
ALTER TABLE public.api_cost_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_cost_log_admin_all" ON public.api_cost_log;
CREATE POLICY "api_cost_log_admin_all" ON public.api_cost_log
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── cost_budgets ──────────────────────────────────────────────────────────────
ALTER TABLE public.cost_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cost_budgets_admin_all" ON public.cost_budgets;
CREATE POLICY "cost_budgets_admin_all" ON public.cost_budgets
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── promo_codes ───────────────────────────────────────────────────────────────
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_codes_admin_all" ON public.promo_codes;
CREATE POLICY "promo_codes_admin_all" ON public.promo_codes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── promo_redemptions ─────────────────────────────────────────────────────────
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_redemptions_admin_all" ON public.promo_redemptions;
CREATE POLICY "promo_redemptions_admin_all" ON public.promo_redemptions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── referral_conversions ──────────────────────────────────────────────────────
ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_conversions_admin_all" ON public.referral_conversions;
CREATE POLICY "referral_conversions_admin_all" ON public.referral_conversions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── analytics_events ──────────────────────────────────────────────────────────
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_events_admin_all" ON public.analytics_events;
CREATE POLICY "analytics_events_admin_all" ON public.analytics_events
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── user_interactions ─────────────────────────────────────────────────────────
-- Written exclusively via /api/interactions (service role). session_id is sensitive.
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_interactions_admin_all" ON public.user_interactions;
CREATE POLICY "user_interactions_admin_all" ON public.user_interactions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── notification_templates ────────────────────────────────────────────────────
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_templates_admin_all" ON public.notification_templates;
CREATE POLICY "notification_templates_admin_all" ON public.notification_templates
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── notification_sends ────────────────────────────────────────────────────────
ALTER TABLE public.notification_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_sends_admin_all" ON public.notification_sends;
CREATE POLICY "notification_sends_admin_all" ON public.notification_sends
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── email_campaigns ───────────────────────────────────────────────────────────
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_campaigns_admin_all" ON public.email_campaigns;
CREATE POLICY "email_campaigns_admin_all" ON public.email_campaigns
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── announcements ─────────────────────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
CREATE POLICY "announcements_admin_all" ON public.announcements
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── user_reports ──────────────────────────────────────────────────────────────
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_reports_admin_all" ON public.user_reports;
CREATE POLICY "user_reports_admin_all" ON public.user_reports
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── support_contacts ──────────────────────────────────────────────────────────
ALTER TABLE public.support_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_contacts_admin_all" ON public.support_contacts;
CREATE POLICY "support_contacts_admin_all" ON public.support_contacts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- CATEGORY B — User-facing tables
-- Some columns / rows must be readable / writable by authenticated app users.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── feed_stories ──────────────────────────────────────────────────────────────
-- Mobile app subscribes via Supabase Realtime: filter target_user_id=eq.{auth.uid()}.
-- target_user_id is TEXT; users.id is UUID (= auth.uid() directly in live DB).
-- Written only by server routes using service role.
ALTER TABLE public.feed_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_stories_admin_all" ON public.feed_stories;
CREATE POLICY "feed_stories_admin_all" ON public.feed_stories
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "feed_stories_user_select" ON public.feed_stories;
CREATE POLICY "feed_stories_user_select" ON public.feed_stories
  FOR SELECT USING (target_user_id = auth.uid()::text);

-- ── editorial_posts ───────────────────────────────────────────────────────────
-- Served via API route (service role) but a direct SELECT policy is safe to add.
ALTER TABLE public.editorial_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "editorial_posts_admin_all" ON public.editorial_posts;
CREATE POLICY "editorial_posts_admin_all" ON public.editorial_posts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "editorial_posts_user_select" ON public.editorial_posts;
CREATE POLICY "editorial_posts_user_select" ON public.editorial_posts
  FOR SELECT USING (status = 'approved');

-- ── adventure_content_links ───────────────────────────────────────────────────
-- Mobile: apps/mobile/lib/api.ts:863 inserts directly via authenticated client.
-- adventure_id and adventures.userId are both TEXT; auth.uid() cast to text for comparison.
ALTER TABLE public.adventure_content_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adventure_content_links_admin_all" ON public.adventure_content_links;
CREATE POLICY "adventure_content_links_admin_all" ON public.adventure_content_links
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "adventure_content_links_user_insert" ON public.adventure_content_links;
CREATE POLICY "adventure_content_links_user_insert" ON public.adventure_content_links
  FOR INSERT WITH CHECK (
    adventure_id IN (
      SELECT id FROM public.adventures WHERE "userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "adventure_content_links_user_select" ON public.adventure_content_links;
CREATE POLICY "adventure_content_links_user_select" ON public.adventure_content_links
  FOR SELECT USING (
    adventure_id IN (
      SELECT id FROM public.adventures WHERE "userId" = auth.uid()::text
    )
  );

-- ── subscription_plans ────────────────────────────────────────────────────────
-- Reference data. All authenticated (and anon) users need to read available plans.
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_plans_admin_all" ON public.subscription_plans;
CREATE POLICY "subscription_plans_admin_all" ON public.subscription_plans
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "subscription_plans_public_select" ON public.subscription_plans;
CREATE POLICY "subscription_plans_public_select" ON public.subscription_plans
  FOR SELECT USING (true);

-- ── user_subscriptions ────────────────────────────────────────────────────────
-- user_id is UUID; users.id IS auth.uid() in the live DB (no authId indirection).
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_subscriptions_admin_all" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_admin_all" ON public.user_subscriptions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "user_subscriptions_user_select" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_user_select" ON public.user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- ── referral_codes ────────────────────────────────────────────────────────────
-- Live DB column is owner_user_id UUID (differs from migration 012's user_id text).
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_codes_admin_all" ON public.referral_codes;
CREATE POLICY "referral_codes_admin_all" ON public.referral_codes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "referral_codes_user_read" ON public.referral_codes;
CREATE POLICY "referral_codes_user_read" ON public.referral_codes
  FOR SELECT USING (owner_user_id = auth.uid());
