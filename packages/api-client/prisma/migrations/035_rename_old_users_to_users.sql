-- Migration 035: rename _old_users → users; drop empty users stub
--
-- public.users was an unpopulated new-schema stub (email, full_name, etc.)
-- public._old_users is the real table with data, FKs, and auth lookups.
-- Steps:
--   1. Safety-check: abort if public.users has rows (it never should)
--   2. Drop FK constraints from stub-dependent tables (all empty)
--   3. Drop the empty users stub
--   4. Rename _old_users → users
--   5. Recreate adventure_collaborators RLS policies that hard-coded _old_users

do $$
begin
  if (select count(*) from public.users) > 0 then
    raise exception 'Abort: public.users is not empty — manual review required';
  end if;
end $$;

-- Drop FKs pointing to the empty stub
alter table analytics_events       drop constraint if exists analytics_events_user_id_fkey;
alter table user_subscriptions     drop constraint if exists user_subscriptions_user_id_fkey;
alter table booking_commissions    drop constraint if exists booking_commissions_user_id_fkey;
alter table referral_codes         drop constraint if exists referral_codes_owner_user_id_fkey;
alter table referral_conversions   drop constraint if exists referral_conversions_referrer_user_id_fkey;
alter table referral_conversions   drop constraint if exists referral_conversions_referred_user_id_fkey;
alter table promo_redemptions      drop constraint if exists promo_redemptions_user_id_fkey;
alter table notification_sends     drop constraint if exists notification_sends_recipient_user_id_fkey;
alter table user_reports           drop constraint if exists user_reports_reporter_user_id_fkey;
alter table support_contacts       drop constraint if exists support_contacts_user_id_fkey;

-- Drop the empty stub (RLS policies on it are dropped automatically)
drop table public.users;

-- Rename the real table
alter table public._old_users rename to users;

-- Recreate adventure_collaborators RLS policies that hard-coded _old_users
drop policy if exists collab_read_own        on adventure_collaborators;
drop policy if exists owner_manage_collabs   on adventure_collaborators;

create policy collab_read_own on adventure_collaborators
  for select
  using (
    exists (
      select 1 from users u
      where u.id = adventure_collaborators."userId"
        and u."authId" = auth.uid()::text
    )
  );

create policy owner_manage_collabs on adventure_collaborators
  for all
  using (
    exists (
      select 1
      from adventures a
      join users u on u.id = a."userId"
      where a.id = adventure_collaborators."adventureId"
        and u."authId" = auth.uid()::text
    )
  );
