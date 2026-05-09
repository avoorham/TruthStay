# Migration Audit: `_old_users` → `users` rename

**Date:** 2026-05-09  
**Scope:** Rename `public._old_users` → `public.users`; drop empty `public.users` stub  
**Status:** Phase 1 complete — awaiting go-ahead for Phase 2

---

## Background

The database has two user tables:

| Table | Rows | Purpose |
|-------|------|---------|
| `public._old_users` | 3 | **Real data.** Original user table with all foreign keys, `authId`, `username`, `displayName`, `avatarUrl`, `activityTypes`, etc. |
| `public.users` | 0 | **Empty stub.** New-schema attempt with different columns (`email`, `full_name`, `home_country`, etc.). Never populated. |

**Goal:** Drop `public.users`, rename `public._old_users` → `public.users`. After rename:
- Code currently using `from("_old_users")` (cast hack) → change to `from("users")` (no cast needed)
- Code currently using `from("users")` → will automatically work correctly (now points at real data)

---

## 1. Code References — `from("_old_users")` (cast-hack, must be cleaned up)

These 6 files query `_old_users` correctly but use the `as unknown as Parameters<typeof db.from>[0]` TypeScript cast to bypass type checking. After rename → change to plain `from("users")` and remove the cast.

| File | Lines | What it fetches |
|------|-------|-----------------|
| [adventures/route.ts](../apps/web/app/api/adventures/route.ts) | 13, 101 | `id` — auth lookup + ownership check |
| [adventures/\[id\]/route.ts](../apps/web/app/api/adventures/[id]/route.ts) | 36, 127, 269 | `id` — GET ownership, PATCH auth, DELETE auth |
| [adventures/\[id\]/days/\[day_number\]/content/route.ts](../apps/web/app/api/adventures/[id]/days/[day_number]/content/route.ts) | 35 | `id` — auth lookup |
| [adventures/\[id\]/days/\[day_number\]/route.ts](../apps/web/app/api/adventures/[id]/days/[day_number]/route.ts) | 20 | `id` — auth lookup |
| [discovery/save-skeleton/route.ts](../apps/web/app/api/discovery/save-skeleton/route.ts) | 55 | `id` — auth lookup |

**Total: 10 occurrences across 5 files**

---

## 2. Code References — `from("users")` (BROKEN — queries empty table)

These 14 files query `public.users` which is empty. All user lookups return `null`. After rename these will automatically resolve correctly.

| File | Lines | What it fetches | Effect today |
|------|-------|-----------------|--------------|
| [follows/route.ts](../apps/web/app/api/follows/route.ts) | 25 | `id, username, displayName, avatarUrl` | Returns empty following list |
| [feed/route.ts](../apps/web/app/api/feed/route.ts) | 21, 70 | user profile fields | Feed posts have no author data |
| [feed/like/route.ts](../apps/web/app/api/feed/like/route.ts) | 10 | `id` — auth lookup | Likes always fail (null user) |
| [feed/bookmark/route.ts](../apps/web/app/api/feed/bookmark/route.ts) | 14, 34 | `id` — auth lookup | Bookmarks always fail |
| [users/search/route.ts](../apps/web/app/api/users/search/route.ts) | 21, 37 | `id, username, displayName, avatarUrl` | Search always returns empty |
| [interactions/route.ts](../apps/web/app/api/interactions/route.ts) | 63 | `id` — auth lookup | Interactions fail silently |
| [posts/\[postId\]/comments/route.ts](../apps/web/app/api/posts/[postId]/comments/route.ts) | 11 | `id` — auth lookup | Comments fail (unauthorized) |
| [adventures/comments/route.ts](../apps/web/app/api/adventures/comments/route.ts) | 10 | `id, username, displayName, avatarUrl` | Comments fail (null user) |
| [adventures/\[id\]/reorder-tiles/route.ts](../apps/web/app/api/adventures/[id]/reorder-tiles/route.ts) | 34 | `id` — auth lookup | Reorder always fails |
| [adventures/\[id\]/fork/route.ts](../apps/web/app/api/adventures/[id]/fork/route.ts) | 20 | `id` — auth lookup | Fork always fails |
| [adventures/\[id\]/collaborators/route.ts](../apps/web/app/api/adventures/[id]/collaborators/route.ts) | 12, 90 | `id` — auth lookup | Collab routes always fail |
| [adventures/\[id\]/move-activity/route.ts](../apps/web/app/api/adventures/[id]/move-activity/route.ts) | 33 | `id` — auth lookup | Move always fails |
| [adventures/\[id\]/reorder-activity/route.ts](../apps/web/app/api/adventures/[id]/reorder-activity/route.ts) | 33 | `id` — auth lookup | Reorder always fails |
| [admin/gpx/route.ts](../apps/web/app/api/admin/gpx/route.ts) | 34 | `id` — auth lookup | GPX admin always fails |
| [admin/adventures/drafts/\[id\]/approve/route.ts](../apps/web/app/api/admin/adventures/drafts/[id]/approve/route.ts) | 45, 46 | `id` — auth lookup | Approve always fails |

**Total: 20 occurrences across 15 files** — all broken, all fixed automatically by rename

---

## 3. Database — Foreign Keys

### Foreign keys pointing to `_old_users.id` (real data, kept after rename)

| Table | Column | On Delete |
|-------|--------|-----------|
| `_old_follows` | `followerId` | CASCADE |
| `_old_follows` | `followingId` | CASCADE |
| `_old_trip_likes` | `userId` | CASCADE |
| `_old_trips` | `userId` | CASCADE |
| `adventure_collaborators` | `userId` | CASCADE |
| `adventure_collaborators` | `addedById` | SET NULL |
| `adventure_selections` | `userId` | CASCADE |
| `adventures` | `userId` | CASCADE |
| `comments` | `userId` | CASCADE |
| `notifications` | `userId` | CASCADE |
| `pois` | `userId` | CASCADE |
| `post_likes` | `userId` | CASCADE |
| `posts` | `userId` | CASCADE |
| `reviews` | `userId` | CASCADE |
| `stage_reviews` | `userId` | CASCADE |
| `user_adventure_preferences` | `userId` | CASCADE |

**Action:** None — Postgres renames FKs automatically when the table is renamed. All 16 FKs remain valid.

### Foreign keys pointing to `users.id` (empty stub, dropped)

| Table | Column | Notes |
|-------|--------|-------|
| `analytics_events` | `user_id` | No data |
| `booking_commissions` | `user_id` | No data |
| `notification_sends` | `user_id` | No data |
| `promo_redemptions` | `user_id` | No data |
| `referral_codes` | `user_id` | No data |
| `referral_conversions` | `referrer_id` | No data |
| `referral_conversions` | `referred_id` | No data |
| `support_contacts` | `user_id` | No data |
| `user_reports` | `reporter_id` | No data |
| `user_subscriptions` | `user_id` | No data |

**Action:** Must `DROP TABLE ... CASCADE` or drop FKs first before dropping `public.users`. These tables are all empty (new-schema tables that were never populated) — dropping FKs is safe.

---

## 4. Database — RLS Policies

### Policies on `_old_users` (survive rename as-is — Postgres updates references)

| Policy | Command | Notes |
|--------|---------|-------|
| `users_select_all` | SELECT | `qual = true` — no table reference, survives rename |

### Policies on `users` (empty stub — dropped with table)

| Policy | Command |
|--------|---------|
| `users_read_all` | SELECT |
| `users_write_own` | ALL |

**Action:** Both policies dropped automatically when `public.users` is dropped.

### Policies on OTHER tables that reference `_old_users` by name

These two policies embed `_old_users` in their SQL and must be recreated after rename:

**`adventure_collaborators.collab_read_own` (SELECT)**
```sql
EXISTS (
  SELECT 1 FROM _old_users u
  WHERE u.id = adventure_collaborators."userId"
    AND u."authId" = auth.uid()::text
)
```
→ After rename: replace `_old_users` with `users`

**`adventure_collaborators.owner_manage_collabs` (ALL)**
```sql
EXISTS (
  SELECT 1
  FROM adventures a
  JOIN _old_users u ON u.id = a."userId"
  WHERE a.id = adventure_collaborators."adventureId"
    AND u."authId" = auth.uid()::text
)
```
→ After rename: replace `_old_users` with `users`

---

## 5. Database — Triggers

| Trigger | Table | Function | References users? |
|---------|-------|----------|--------------------|
| `content_entry_story_trigger` | `content_entries` | `generate_scout_stories()` | No — queries `user_adventure_preferences` only |
| `activity_post_story_trigger` | `activity_posts` | `generate_friend_activity_stories()` | **No** — queries `follows` by email columns only; inserts into `feed_stories` |
| `trg_check_verified` | `content_entries` | `check_content_verified()` | No |
| `on_auth_user_created` | `auth.users` | `handle_new_user()` | Separate schema, unaffected |

**Action:** None — all trigger functions are safe. Pre-Phase-2 check complete (2026-05-09).

---

## 6. Database — Functions

| Function | References users? |
|----------|-------------------|
| `generate_scout_stories()` | Comment only — safe |
| `recalc_content_entry_save_counts()` | No |
| `recalc_destination_chip_save_counts()` | No |
| `select_entries_needing_trust_recalc()` | No |

No SQL functions reference `users` or `_old_users` by table name.

---

## 7. Views

No views in `public` schema reference `users` or `_old_users`.

---

## 8. Mobile App

No `_old_users` or `users` table references in `apps/mobile/`. The mobile app calls web API routes which handle user resolution server-side.

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| `from("_old_users")` cast-hack references | 10 occurrences / 5 files | Change to `from("users")`, remove cast |
| `from("users")` broken references | 20 occurrences / 15 files | No code change — fixed by rename |
| FKs on `_old_users` (survive) | 16 | None — auto-updated by Postgres |
| FKs on `public.users` stub (dropped) | 10 | Drop with CASCADE |
| RLS policies requiring rewrite | 2 | Recreate with `users` instead of `_old_users` |
| Functions to update | 0 | None |
| Views to update | 0 | None |

---

## Phase 2 Checklist (DO NOT START until go-ahead)

- [ ] Verify `generate_friend_activity_stories()` body — does it reference `users`/`_old_users`?
- [ ] Write migration: drop FK constraints on `public.users` dependents, then `DROP TABLE public.users`
- [ ] Write migration: `ALTER TABLE _old_users RENAME TO users`
- [ ] Write migration: drop + recreate `adventure_collaborators.collab_read_own` and `owner_manage_collabs` policies
- [ ] Update 5 web API files: remove `as unknown as Parameters<typeof db.from>[0]` cast, change `"_old_users"` → `"users"`
- [ ] Regenerate Supabase TypeScript types (`supabase gen types`)
- [ ] TypeScript compile check
- [ ] Smoke test: auth lookup, adventure save, trip list
