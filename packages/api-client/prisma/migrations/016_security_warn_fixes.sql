-- Migration 016: Fix remaining security warnings
-- ─────────────────────────────────────────────────────────────────────────────
-- Addresses:
--   • function_search_path_mutable  — 8 functions missing SET search_path
--   • materialized_view_in_api      — content_affinity accessible to anon/authenticated
--   • anon/authenticated_security_definer_function — handle_new_user callable directly
--   • public_bucket_allows_listing  — 4 storage buckets with broad SELECT policies
--   • rls_policy_always_true        — 11 tables with USING(true) FOR ALL policies
--
-- NOT addressed here (require Supabase dashboard actions):
--   • auth_leaked_password_protection — Auth settings → Password strength → enable HaveIBeenPwned
--   • extension_in_public (pg_net)    — Supabase-managed extension; moving it breaks net.http_post()

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Fix mutable search_path on 8 functions
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER FUNCTION public.apply_approved_budget_plan(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recalculate_trust_score(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_scout_stories()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_nearby_content(double precision, double precision, double precision)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_budget_plan_approval()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_friend_activity_stories()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.apply_weekly_scenario(uuid, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.expire_old_stories()
  SET search_path = public, pg_temp;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. content_affinity materialized view — revoke public API access
-- ═══════════════════════════════════════════════════════════════════════════════
-- Used internally for personalisation; should not be accessible via PostgREST.

REVOKE SELECT ON public.content_affinity FROM anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. handle_new_user — revoke direct invocation from API roles
-- ═══════════════════════════════════════════════════════════════════════════════
-- This is a trigger function (called by auth.users INSERT trigger), not an RPC.
-- Revoking EXECUTE prevents it from being called via /rest/v1/rpc/handle_new_user.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Storage buckets — remove listing policies
-- ═══════════════════════════════════════════════════════════════════════════════
-- Public buckets serve files via their public URL without any storage.objects
-- RLS policy. These broad SELECT policies additionally allow clients to LIST
-- all files in the bucket, which is not needed. Dropping them removes listing
-- while leaving URL-based access intact.

DROP POLICY IF EXISTS "public read avatars"               ON storage.objects;
DROP POLICY IF EXISTS "Post photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "public read review-photos"         ON storage.objects;
DROP POLICY IF EXISTS "public read trip-covers"           ON storage.objects;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Replace overly-permissive allow_all_authenticated policies
-- ═══════════════════════════════════════════════════════════════════════════════
-- Live DB schema uses email-based ownership for most social tables:
--   trips.created_by, follows.follower_email, trip_likes.user_email, etc.
-- users.id is UUID and equals auth.uid() directly.
-- accommodations/restaurants/routes link to trips via trip_id (no user_id).

-- ── users (id = auth.uid()) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.users;

-- All authenticated users can read profiles (community platform)
CREATE POLICY "users_read_all" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only write their own profile row
CREATE POLICY "users_write_own" ON public.users
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── trips (created_by = email) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.trips;

-- Visibility-aware SELECT: own trips + public trips + collaborated trips
CREATE POLICY "trips_select" ON public.trips
  FOR SELECT USING (
    visibility = 'public'
    OR created_by = auth.email()
    OR id IN (
      SELECT trip_id FROM public.trip_collaborators
      WHERE user_email = auth.email()
    )
  );

CREATE POLICY "trips_insert" ON public.trips
  FOR INSERT WITH CHECK (created_by = auth.email());

CREATE POLICY "trips_update" ON public.trips
  FOR UPDATE USING (
    created_by = auth.email()
    OR id IN (
      SELECT trip_id FROM public.trip_collaborators
      WHERE user_email = auth.email()
        AND permission IN ('edit', 'admin')
    )
  );

CREATE POLICY "trips_delete" ON public.trips
  FOR DELETE USING (created_by = auth.email());

-- ── follows (follower_email = email) ─────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.follows;

CREATE POLICY "follows_read_all" ON public.follows
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "follows_write_own" ON public.follows
  FOR ALL USING (follower_email = auth.email())
  WITH CHECK (follower_email = auth.email());

-- ── trip_likes (user_email = email) ──────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.trip_likes;

CREATE POLICY "trip_likes_read_all" ON public.trip_likes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "trip_likes_write_own" ON public.trip_likes
  FOR ALL USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- ── trip_comments (user_email = email) ───────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.trip_comments;

CREATE POLICY "trip_comments_read_all" ON public.trip_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "trip_comments_write_own" ON public.trip_comments
  FOR ALL USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- ── trip_collaborators (user_email = email, trip_id = uuid) ──────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.trip_collaborators;

CREATE POLICY "trip_collaborators_read_all" ON public.trip_collaborators
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only the trip owner can add collaborators
CREATE POLICY "trip_collaborators_insert" ON public.trip_collaborators
  FOR INSERT WITH CHECK (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  );

CREATE POLICY "trip_collaborators_update" ON public.trip_collaborators
  FOR UPDATE USING (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  );

-- Collaborators can remove themselves; trip owner can remove anyone
CREATE POLICY "trip_collaborators_delete" ON public.trip_collaborators
  FOR DELETE USING (
    user_email = auth.email()
    OR trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  );

-- ── activity_posts (user_email = email) ──────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.activity_posts;

CREATE POLICY "activity_posts_read_all" ON public.activity_posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "activity_posts_write_own" ON public.activity_posts
  FOR ALL USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- ── saved_trips (user_email = email) ─────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.saved_trips;

-- Private bookmarks — each user sees and manages only their own
CREATE POLICY "saved_trips_own" ON public.saved_trips
  FOR ALL USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- ── accommodations (trip_id = uuid, no user column) ──────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.accommodations;

-- All authenticated users can read trip content
CREATE POLICY "accommodations_read_all" ON public.accommodations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only the trip owner can add/modify/delete accommodations
CREATE POLICY "accommodations_write_trip_owner" ON public.accommodations
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  ) WITH CHECK (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  );

-- ── restaurants (trip_id = uuid, no user column) ─────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.restaurants;

CREATE POLICY "restaurants_read_all" ON public.restaurants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "restaurants_write_trip_owner" ON public.restaurants
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  ) WITH CHECK (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  );

-- ── routes (trip_id = uuid, no user column) ───────────────────────────────────
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.routes;

CREATE POLICY "routes_read_all" ON public.routes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "routes_write_trip_owner" ON public.routes
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  ) WITH CHECK (
    trip_id IN (SELECT id FROM public.trips WHERE created_by = auth.email())
  );
