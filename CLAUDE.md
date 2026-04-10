# TruthStay

AI-powered outdoor adventure planner. Users describe a trip via a chat interface; the AI generates a multi-day adventure plan with route alternatives and accommodation options.

## Stack

- **Mobile:** Expo (React Native), TypeScript, expo-router, Supabase JS client
- **Web:** Next.js 15 App Router, TypeScript, Supabase (server + admin clients), Anthropic SDK
- **DB:** Supabase (Postgres), Prisma for migrations (`packages/api-client`)
- **Auth:** Supabase Auth
- **AI:** Anthropic claude-opus-4-5 (chat route)
- **Monorepo:** pnpm workspaces

## Monorepo layout

```
apps/mobile/        Expo React Native app
apps/web/           Next.js web app + all API routes
packages/
  types/            Shared TypeScript types
  api-client/       Shared Supabase client + Prisma config
  ui/               Shared React components (minimal, web-only)
  eslint-config/
  typescript-config/
```

---

## Mobile app — apps/mobile/

### Screens — apps/mobile/app/

| Screen | Path | Notes |
|--------|------|-------|
| Root layout | `app/_layout.tsx` | Auth routing, font loading |
| Auth | `app/(auth)/auth.tsx` | Login / signup |
| Onboarding | `app/(auth)/onboarding.tsx` | Activity preferences |
| Tab layout | `app/(app)/_layout.tsx` | Tab bar (height 64), bottom nav config |
| **Discover / Chat** | `app/(app)/discover/index.tsx` | **Main feature** — AI chat, date picker trigger, adventure generation |
| Trips list | `app/(app)/trips/index.tsx` | Saved adventures; uses useFocusEffect for refresh |
| Trip detail | `app/(app)/trips/[id].tsx` | Itinerary detail (pending full build) |
| Explore | `app/(app)/explore/index.tsx` | Public adventures map |
| Feed | `app/(app)/feed/index.tsx` | Social feed |
| Profile | `app/(app)/profile/index.tsx` | User profile, settings |

### Components — apps/mobile/components/

| Component | Purpose |
|-----------|---------|
| `AdventurePlanCard.tsx` | Route + accommodation selection UI after AI generates plan; phase pills (Routes / Stay) |
| `RouteTile.tsx` | Single route card — activity gradient, elevation silhouette, difficulty badge |
| `AccommodationTile.tsx` | Single accommodation card — Booking.com link, image carousel |
| `RichOptionTiles.tsx` | Horizontal carousel of option tiles in discover chat |
| `QuickReplies.tsx` | Quick reply chips in discover chat (supports disabled state while loading) |
| `DateRangePicker.tsx` | Calendar modal — date range + adults/children/rooms; pure RN, no extra packages |

### Lib — apps/mobile/lib/

| File | Purpose |
|------|---------|
| `adventure-types.ts` | All TS interfaces: GeneratedAdventure, RouteAlternative, AccommodationStop, RichOption, etc. |
| `api.ts` | API call functions: saveAdventure, recordSelection, shareAdventurePublic, fetchTrips, etc. |
| `theme.ts` | Design tokens: colors, spacing, fontSize, radius, shadow, ACTIVITY_EMOJI, DIFFICULTY_COLOR |
| `auth-context.tsx` | AuthProvider + useAuth hook |
| `supabase.ts` | Supabase client for mobile |
| `chat-history.ts` | AsyncStorage persistence for discover chat messages |
| `storage.ts` | Generic AsyncStorage helpers |

### Config

- `app.json` — EAS / Expo config; `softwareKeyboardLayoutMode: "resize"` (Android keyboard behaviour)
- `app/(app)/_layout.tsx` — Tab bar height is 64; affects input bar bottom padding

---

## Web app — apps/web/

### API routes — apps/web/app/api/

| Route | Purpose |
|-------|---------|
| `adventures/chat/route.ts` | **Main AI endpoint** — system prompt, Anthropic call, adventure DB insert, normalizeActivityType |
| `adventures/route.ts` | List / create adventures |
| `adventures/[id]/route.ts` | Get / update / delete single adventure |
| `adventures/[id]/days/route.ts` | Adventure days |
| `adventures/[id]/select/route.ts` | Record route or accommodation selection |
| `adventures/public/route.ts` | Public adventures for Explore screen |
| `adventures/generate/route.ts` | Admin bulk generation |
| `adventures/[id]/feedback/route.ts` | User feedback on adventure |
| `thefork/token/route.ts` | TheFork restaurant API OAuth token |
| `thefork/availability/route.ts` | Restaurant availability check |
| `thefork/book/route.ts` | Restaurant booking |
| `thefork/webhook/route.ts` | TheFork booking webhook |
| `feed/route.ts` | Social feed |
| `posts/route.ts` | Create posts |
| `follows/route.ts` | Follow / unfollow |
| `profile/stats/route.ts` | Profile stats |
| `content/route.ts` | Content management |
| `finance/chat/route.ts` | Internal finance AI (not user-facing) |
| `admin/adventures/drafts/route.ts` | Admin: adventure review queue |

### Lib — apps/web/lib/

| File | Purpose |
|------|---------|
| `supabase/client.ts` | Browser Supabase client |
| `supabase/server.ts` | Server Supabase client (cookies) |
| `supabase/admin.ts` | Admin Supabase client (service role) |
| `auth/get-user.ts` | Server-side auth helper |
| `agent/adventure-agent.ts` | Adventure generation agent |
| `agent/tools.ts` | Agent tool definitions |
| `embeddings.ts` | Vector embeddings for semantic search |
| `rate-limit.ts` | API rate limiting |

---

## Shared packages

| Package | Purpose |
|---------|---------|
| `packages/types/src/index.ts` | Shared types: Trip, User, POI, Review, Post, Activity |
| `packages/api-client/src/index.ts` | Shared API client |
| `packages/api-client/src/supabase.ts` | Shared Supabase client |
| `packages/api-client/prisma.config.ts` | Prisma config for migrations |

---

## Task → files to read

| Task | Files |
|------|-------|
| AI chat flow / stuck loop | `apps/mobile/app/(app)/discover/index.tsx` + `apps/web/app/api/adventures/chat/route.ts` |
| Discover chat UI (tiles, replies) | `discover/index.tsx` + `RichOptionTiles.tsx` + `QuickReplies.tsx` |
| Adventure plan UI (routes, stays) | `AdventurePlanCard.tsx` + `RouteTile.tsx` + `AccommodationTile.tsx` |
| Date picker / calendar | `DateRangePicker.tsx` + `discover/index.tsx` |
| Saving adventures / trips | `lib/api.ts` + `web/api/adventures/route.ts` + `web/api/adventures/chat/route.ts` |
| Trips screen | `trips/index.tsx` + `trips/[id].tsx` |
| Tab bar / navigation | `app/(app)/_layout.tsx` |
| Keyboard / input bar gap | `discover/index.tsx` + `app.json` |
| Styling / design tokens | `lib/theme.ts` |
| Auth / user session | `lib/auth-context.tsx` + `lib/supabase.ts` |
| Explore map / public adventures | `explore/index.tsx` + `web/api/adventures/public/route.ts` |
| Restaurant booking | `web/api/thefork/token` + `availability` + `book` routes |
| Type definitions | `lib/adventure-types.ts` + `packages/types/src/` |
| DB schema / migrations | Read memory `project_stack.md` first, then `packages/api-client/prisma.config.ts` |
| System prompt changes | `web/api/adventures/chat/route.ts` only |
| ActivityType enum | Supabase enum values: `cycling hiking trail_running skiing snowboarding kayaking climbing other` — `mtb` maps to `cycling` via `normalizeActivityType()` in the chat route |
