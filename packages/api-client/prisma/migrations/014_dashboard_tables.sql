-- Migration 014: Dashboard tables — marketing sends, social, trip invitations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── campaign_sends ───────────────────────────────────────────────────────────
-- Individual email/push send tracking with per-user engagement signals.
-- Distinct from campaign_recipients (migration 012) which tracks marketing_campaigns;
-- campaign_sends tracks the separate email_campaigns table.

CREATE TABLE IF NOT EXISTS public.campaign_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  channel           text NOT NULL
    CHECK (channel IN ('email', 'push')),
  status            text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  sent_at           timestamptz NOT NULL DEFAULT now(),
  opened_at         timestamptz,
  clicked_at        timestamptz,
  clicked_links     jsonb NOT NULL DEFAULT '[]',
  converted         boolean NOT NULL DEFAULT false,
  conversion_action text   -- e.g. 'saved_trip', 'subscribed', 'booked'
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign
  ON public.campaign_sends (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_user
  ON public.campaign_sends (user_id, sent_at DESC);

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_sends_admin_all" ON public.campaign_sends
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── social_posts ──────────────────────────────────────────────────────────────
-- Automated social media posts drafted / published by the Marketing Agent.

CREATE TABLE IF NOT EXISTS public.social_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            text NOT NULL
    CHECK (platform IN ('instagram', 'tiktok', 'x')),
  post_type           text NOT NULL DEFAULT 'image'
    CHECK (post_type IN ('image', 'video', 'carousel', 'story', 'reel', 'thread', 'text')),
  -- Content
  caption             text,
  media_urls          text[]  NOT NULL DEFAULT '{}',
  hashtags            text[]  NOT NULL DEFAULT '{}',
  link_url            text,
  -- Thread support (X threads only)
  thread_posts        jsonb,
  -- Scheduling
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at        timestamptz,
  published_at        timestamptz,
  -- Platform response
  platform_post_id    text,
  platform_url        text,
  -- Performance metrics (updated periodically)
  impressions         int NOT NULL DEFAULT 0,
  reach               int NOT NULL DEFAULT 0,
  likes               int NOT NULL DEFAULT 0,
  comments            int NOT NULL DEFAULT 0,
  shares              int NOT NULL DEFAULT 0,
  saves               int NOT NULL DEFAULT 0,
  link_clicks         int NOT NULL DEFAULT 0,
  profile_visits      int NOT NULL DEFAULT 0,
  video_views         int NOT NULL DEFAULT 0,
  engagement_rate     real NOT NULL DEFAULT 0,
  -- Agent metadata
  content_entry_id    uuid,
  agent_rationale     text,
  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  metrics_updated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_social_posts_platform
  ON public.social_posts (platform, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled
  ON public.social_posts (scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_posts_admin_all" ON public.social_posts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── social_connections ────────────────────────────────────────────────────────
-- Platform API credentials (tokens stored encrypted at the app layer).

CREATE TABLE IF NOT EXISTS public.social_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform                text NOT NULL UNIQUE
    CHECK (platform IN ('instagram', 'tiktok', 'x')),
  is_connected            boolean NOT NULL DEFAULT false,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  account_id              text,
  account_name            text,
  connected_at            timestamptz,
  last_post_at            timestamptz
);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_connections_admin_all" ON public.social_connections
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── trip_invitations ──────────────────────────────────────────────────────────
-- Trip invitation viral-loop tracking (the "power loop").

CREATE TABLE IF NOT EXISTS public.trip_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid REFERENCES public.adventures(id) ON DELETE CASCADE,
  inviter_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email   text NOT NULL,
  invitee_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'opened', 'signed_up', 'joined_trip', 'expired')),
  invite_method   text NOT NULL DEFAULT 'email'
    CHECK (invite_method IN ('email', 'link', 'push', 'sms')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  opened_at       timestamptz,
  signed_up_at    timestamptz,
  joined_trip_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_trip_invitations_inviter
  ON public.trip_invitations (inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_status
  ON public.trip_invitations (status);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip
  ON public.trip_invitations (trip_id);

ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_invitations_admin_all" ON public.trip_invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── ALTER email_campaigns ────────────────────────────────────────────────────
-- Add marketing-agent and approval columns to the existing email_campaigns table.

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS channel               text    DEFAULT 'email'
    CHECK (channel IN ('email', 'push', 'both')),
  ADD COLUMN IF NOT EXISTS agent_rationale       text,
  ADD COLUMN IF NOT EXISTS agent_suggested_send_time timestamptz,
  ADD COLUMN IF NOT EXISTS approval_status       text    DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  ADD COLUMN IF NOT EXISTS approved_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_at           timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason      text,
  ADD COLUMN IF NOT EXISTS is_transactional      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_title            text,
  ADD COLUMN IF NOT EXISTS push_body             text,
  ADD COLUMN IF NOT EXISTS open_count_24h        int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count_48h        int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_details         jsonb   DEFAULT '[]';

-- ── ALTER users — add status ───────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'banned'));

-- ── platform_config: social settings seed ────────────────────────────────────

INSERT INTO public.platform_config (key, value)
VALUES (
  'social_settings',
  '{
    "instagram": {"posts_per_week": 3, "auto_post": true, "optimal_times": ["09:00", "17:00"]},
    "tiktok":    {"posts_per_week": 2, "auto_post": true, "optimal_times": ["12:00", "19:00"]},
    "x":         {"posts_per_week": 3, "auto_post": true, "optimal_times": ["08:00", "12:00", "18:00"]},
    "brand_voice": "Friendly, authentic, no marketing speak. First-person perspective. Focus on real experiences, not polished tourism content.",
    "content_sources": ["content_entries", "adventures", "user_reviews"]
  }'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
