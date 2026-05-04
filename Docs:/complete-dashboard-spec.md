# TruthStay Admin Dashboard — Complete Implementation Spec

> **This is the single definitive spec for the TruthStay admin dashboard.**
> It consolidates all modules, design system, and agent dashboards into one file.
> Tables that already exist in the database are marked with ✅.
> Tables that need to be created are marked with 🆕.

## Database Status

### Tables that ALREADY EXIST (do NOT recreate):
✅ content_entries, content_upvotes, users, admin_users, adventures, adventure_days,
   adventure_day_pois, adventure_feedback, adventure_collaborators, agent_runs,
   trips, follows, saved_trips, trip_likes, trip_comments, trip_collaborators,
   accommodations, restaurants, routes, activity_posts, pois, reviews,
   analytics_events, subscription_plans, user_subscriptions, booking_partners,
   booking_commissions, api_cost_log, cost_budgets, referral_codes,
   referral_conversions, promo_codes, promo_redemptions, email_campaigns,
   notification_templates, notification_sends, announcements, user_reports,
   support_contacts, platform_config, agent_registry, agent_messages,
   spend_authorisations, monthly_budget_plans, budget_plan_amendments,
   weekly_scenarios, infrastructure_costs

### Tables that NEED TO BE CREATED:
🆕 campaign_sends — individual email/push send tracking with engagement
🆕 social_posts — automated social media posts with performance metrics
🆕 social_connections — Instagram/TikTok/X API credentials
🆕 trip_invitations — trip invitation viral loop tracking

### Columns that need to be ADDED to existing tables:
🔄 email_campaigns — add: channel, agent_rationale, agent_suggested_send_time,
   approval_status, approved_by, approved_at, rejection_reason, is_transactional,
   push_title, push_body, open_count_24h, open_count_48h, click_details

---

# TruthStay Admin Dashboard — Implementation Spec

## 1. Overview

### What is this?

A standalone admin portal at `admin.truthstay.com` that gives the TruthStay team complete visibility and control over the platform. Built with Next.js (matching the main app stack), deployed separately on Vercel, connecting to the same Supabase backend.

### Who uses it?

A small team of 2-5 people with role-based access:

| Role | Access |
|---|---|
| `super_admin` | Full access to all modules, can manage other admins |
| `admin` | Full access to all modules |
| `content_moderator` | Content management + support moderation only |
| `analyst` | Analytics + finance (read-only) |
| `marketer` | Marketing + notifications |

### Modules (Day 1)

1. **Content Management** — View, edit, approve/reject `content_entries`, manage POIs, routes, accommodations, restaurants
2. **User Management** — View profiles, assign roles, ban/suspend users
3. **Analytics** — Sessions, DAU/MAU, popular regions, adventure generation stats, agent performance
4. **Finance** — Subscription tiers, booking commissions, API costs, revenue tracking
5. **Marketing** — Email campaigns, referral program, promo codes, growth metrics
6. **Partner Management** — Booking partners, commission rates, partner performance
7. **Notifications** — Push notifications, email sends, in-app announcements, templates
8. **Support & Feedback** — Adventure feedback, user reports, flagged content, contact log

---

## 2. Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | Supabase Auth (check `admin_users` table for role) |
| Data | Supabase JS client (using `service_role` key server-side) |
| Charts | Recharts |
| Tables | TanStack Table (React Table v8) |
| Deployment | Vercel (separate project, `admin.truthstay.com`) |
| State | React Server Components + SWR for client-side data fetching |

### Project Structure

```
truthstay-admin/
├── app/
│   ├── layout.tsx                  # Root layout with sidebar nav
│   ├── page.tsx                    # Dashboard overview (redirect to /content)
│   ├── login/
│   │   └── page.tsx                # Admin login
│   ├── content/
│   │   ├── page.tsx                # Content entries list (filterable, sortable)
│   │   ├── [id]/
│   │   │   └── page.tsx            # Content entry detail + edit
│   │   └── review-queue/
│   │       └── page.tsx            # Unverified entries queue
│   ├── users/
│   │   ├── page.tsx                # User list
│   │   └── [id]/
│   │       └── page.tsx            # User detail + actions
│   ├── analytics/
│   │   ├── page.tsx                # Overview dashboard
│   │   ├── regions/
│   │   │   └── page.tsx            # Region popularity breakdown
│   │   └── agent/
│   │       └── page.tsx            # Agent run performance
│   ├── finance/
│   │   ├── page.tsx                # Revenue overview
│   │   ├── subscriptions/
│   │   │   └── page.tsx            # Subscription management
│   │   ├── commissions/
│   │   │   └── page.tsx            # Booking commissions
│   │   └── costs/
│   │       └── page.tsx            # API costs tracking
│   └── settings/
│       └── page.tsx                # Admin team management
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   ├── Header.tsx              # Top bar with user info + search
│   │   └── BreadcrumbNav.tsx
│   ├── content/
│   │   ├── ContentTable.tsx        # Main content entries table
│   │   ├── ContentEditForm.tsx     # Edit form for content entry
│   │   ├── ReviewCard.tsx          # Card for review queue
│   │   ├── TrustScoreBadge.tsx     # Visual trust score indicator
│   │   └── SourcePreview.tsx       # Preview of blog/instagram sources
│   ├── users/
│   │   ├── UserTable.tsx
│   │   ├── UserDetailCard.tsx
│   │   └── RoleSelector.tsx
│   ├── analytics/
│   │   ├── KPICard.tsx             # Metric card with sparkline
│   │   ├── TimeSeriesChart.tsx     # Reusable time series chart
│   │   ├── RegionHeatmap.tsx       # Map showing popular regions
│   │   └── AgentRunsTable.tsx
│   ├── finance/
│   │   ├── RevenueChart.tsx
│   │   ├── SubscriptionTable.tsx
│   │   ├── CostBreakdown.tsx
│   │   └── CommissionLog.tsx
│   └── shared/
│       ├── DataTable.tsx           # Reusable sortable/filterable table
│       ├── StatusBadge.tsx
│       ├── ConfirmDialog.tsx
│       ├── DateRangePicker.tsx
│       └── ExportButton.tsx        # Export to CSV
├── lib/
│   ├── supabase-admin.ts           # Supabase client with service_role
│   ├── auth.ts                     # Admin auth helpers
│   ├── queries/                    # Data fetching functions
│   │   ├── content.ts
│   │   ├── users.ts
│   │   ├── analytics.ts
│   │   └── finance.ts
│   └── utils.ts
├── middleware.ts                    # Auth guard: redirect to /login if not admin
└── .env.local
```

### Authentication Flow

```
1. Admin navigates to admin.truthstay.com
2. middleware.ts checks for valid Supabase session
3. If no session → redirect to /login
4. On login → check admin_users table for user_id + role
5. If not in admin_users → show "Access denied" message
6. If valid → set role in session, render dashboard
7. Role checked on each page load via middleware
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://hplczwepdpmtdfkijpnh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Server-side only, never exposed to client
```

---

## 3. Module 1: Content Management

### 3.1 Content Entries List (`/content`)

A sortable, filterable data table showing all `content_entries`:

**Columns:**
- Name (clickable → detail page)
- Type (route / accommodation / restaurant) with icon
- Region
- Activity Type
- Trust Score (visual bar 0–1.0)
- Source Type (agent / user / admin) with badge
- Verified (checkbox toggle)
- Upvotes
- Created At

**Filters:**
- Type dropdown (route, accommodation, restaurant)
- Region search (text input)
- Verified toggle (all / verified / unverified)
- Source type (all / agent / user / admin)
- Trust score range slider
- Date range picker

**Actions:**
- Bulk verify selected entries
- Bulk delete selected entries
- Export filtered results to CSV
- Link to "Review Queue" for unverified entries

**Query:**
```sql
SELECT
  id, type, name, region, activity_type, trust_score, source_type,
  verified, upvotes, created_at,
  data->>'scoutScore' as scout_score,
  data->'sources' as sources
FROM content_entries
ORDER BY created_at DESC
LIMIT 50 OFFSET ?;
```

### 3.2 Content Entry Detail (`/content/[id]`)

Full detail view with inline editing:

**Top section:**
- Name (editable)
- Type badge
- Region (editable)
- Trust score gauge
- Source type badge
- Verified toggle

**Description section:**
- Rich text description (editable)
- Activity type (editable dropdown)
- Highlights (editable tag list)

**Sources section:**
- List of sources from `data.sources` with clickable URLs
- Source type (blog / instagram / strava)
- Author name
- Excerpt preview

**Metadata section (from `data` JSONB):**
- Coordinates (lat/lng with mini map preview)
- Type-specific fields (distanceKm, elevationGainM, priceRange, etc.)
- scoutScore, scoutReason
- agentRunId (link to agent run detail)

**Community section:**
- Upvote count
- Reviews linked to this entry (from `reviews` table)
- User comments
- Interaction stats (from `user_interactions` if implemented)

**Actions:**
- Save changes
- Verify / Unverify
- Delete (with confirmation dialog)
- View on main app (link)

### 3.3 Review Queue (`/content/review-queue`)

Card-based view of unverified entries, sorted by scoutScore descending:

Each card shows:
- Name, type, region
- Scout score (large, prominent)
- Scout reason
- Source previews (blog titles + URLs)
- Description (first 200 chars)
- Approve / Reject buttons
- "View Full Detail" link

**Bulk actions:**
- Approve all entries with scoutScore ≥ 0.85
- Reject all entries with scoutScore < 0.3

---

## 4. Module 2: User Management

### 4.1 User List (`/users`)

Data table showing all users from the `users` table:

**Columns:**
- Avatar (thumbnail)
- Full Name
- Email
- Home Country
- Favorite Activities (badges)
- Trips Count (computed)
- Reviews Count (computed)
- Admin Role (from `admin_users` join, if any)
- Created Date
- Status (active / suspended / banned)

**Filters:**
- Search by name or email
- Country dropdown
- Activity type filter
- Role filter (all / user / admin / moderator)
- Status filter

**Actions:**
- View user detail
- Assign admin role
- Suspend / ban user
- Export user list to CSV

### 4.2 User Detail (`/users/[id]`)

- Profile info (avatar, name, email, bio, country)
- Activity preferences
- Their trips (list with links)
- Their reviews (list)
- Their adventures (list)
- Their content contributions
- Admin actions: change role, suspend, ban, delete account

### 4.3 Schema Changes for User Management

Add a `status` column to the `users` table:

```sql
ALTER TABLE users
  ADD COLUMN status text DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'banned'));
```

---

## 5. Module 3: Analytics

### 5.1 Analytics Overview (`/analytics`)

A dashboard with KPI cards and charts:

**KPI Cards (top row):**
- Total Users (with % change vs last period)
- DAU (Daily Active Users)
- MAU (Monthly Active Users)
- Total Adventures Created
- Total Content Entries
- Agent Runs This Month

**Charts:**
- User signups over time (line chart, daily/weekly/monthly toggle)
- Adventures created per day (bar chart)
- Active users over time (line chart)
- Top 10 regions by adventure count (horizontal bar)
- Activity type distribution (pie/donut chart)

**Date range selector** at the top affecting all widgets.

### 5.2 Region Analytics (`/analytics/regions`)

- Table of regions sorted by adventure count
- Map visualisation showing popularity density
- Drilldown: click a region to see activity types, content entry count, user reviews

### 5.3 Agent Performance (`/analytics/agent`)

Table of `agent_runs` with:
- Run ID, region, activity type
- Status (running / completed / failed) with badge
- Routes found, accommodations found
- Duration (completed_at - started_at)
- Error message (if failed)
- Link to view created content entries

KPI cards:
- Total runs
- Success rate (%)
- Average entries per run
- Total entries created by agent

### 5.4 Analytics Data Sources

Analytics queries pull from existing tables. For session tracking, you'll need to add an `analytics_events` table:

```sql
CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES users(id),
  session_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_analytics_events_type_date
  ON analytics_events (event_type, created_at DESC);

CREATE INDEX idx_analytics_events_user
  ON analytics_events (user_id, created_at DESC);
```

Events to track:
- `session_start` — user opens the app
- `adventure_created` — user generates an adventure
- `adventure_saved` — user saves an adventure
- `content_viewed` — user views a content entry detail
- `review_submitted` — user submits a review
- `search_performed` — user searches for a destination

---

## 6. Module 4: Finance

### Current Implementation — Specific Fixes

The dashboard is already built with the correct structure (sidebar, tabs, KPIs, chart, table). The following are specific CSS/component fixes to address the current visual issues:

**Fix 1: Tab spacing and styling**
Current: "RevenueCostsCash FlowForecasted Performance" runs together as unstyled text.
Fix: Use shadcn/ui `Tabs` with `TabsList` and `TabsTrigger`. Each tab needs `px-4 py-2` padding, `text-sm font-medium` typography, and an `underline-offset-4 data-[state=active]:border-b-2 data-[state=active]:border-primary` active state. Add `gap-2` between tabs.

```tsx
<Tabs defaultValue="revenue" className="w-full">
  <div className="flex items-center justify-between mb-8">
    <TabsList className="bg-transparent gap-1">
      <TabsTrigger value="revenue" className="px-4 py-2 text-sm">Revenue</TabsTrigger>
      <TabsTrigger value="costs" className="px-4 py-2 text-sm">Costs</TabsTrigger>
      <TabsTrigger value="cashflow" className="px-4 py-2 text-sm">Cash Flow</TabsTrigger>
      <TabsTrigger value="forecast" className="px-4 py-2 text-sm">Forecasted Performance</TabsTrigger>
    </TabsList>
    {/* Time range toggle — right side */}
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {['7D', '1M', '3M', '6M', '1Y'].map(range => (
        <button key={range} className="px-3 py-1 text-xs rounded-md data-[active]:bg-background data-[active]:shadow-sm">
          {range}
        </button>
      ))}
    </div>
  </div>
  <TabsContent value="revenue">...</TabsContent>
</Tabs>
```

**Fix 2: KPI cards — add visual hierarchy and breathing room**
Current: KPI row feels like a flat spreadsheet row with no emphasis.
Fix: Wrap in a `grid grid-cols-4 gap-6 mb-8` container. Each card gets `p-6 rounded-xl border bg-card`. The number should be `text-3xl font-bold tracking-tight font-mono`. Add a change indicator below: `text-sm text-muted-foreground` with a coloured arrow.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
  <div className="p-6 rounded-xl border bg-card">
    <p className="text-sm text-muted-foreground mb-1">MRR</p>
    <p className="text-3xl font-bold tracking-tight font-mono">€0.00</p>
    <p className="text-sm text-muted-foreground mt-1">
      <span className="text-emerald-500">—</span> No previous data
    </p>
  </div>
  {/* Repeat for ARR, Active Subscriptions, Commission Income */}
</div>
```

**Fix 3: Chart height and presence**
Current: Chart area is too short (~200px) and feels compressed.
Fix: Set chart container to `h-[400px] mb-8` minimum. Add `p-6 rounded-xl border bg-card` wrapper. Use Recharts with `<ResponsiveContainer width="100%" height="100%">`. Remove dense gridlines — use only 3-4 horizontal lines with `strokeOpacity={0.1}`.

**Fix 4: Section spacing**
Current: Chart runs directly into subscriptions table.
Fix: Add `space-y-8` to the tab content container. Add a section header above the table:
```tsx
<div className="space-y-8">
  {/* KPI cards */}
  {/* Chart */}
  <div>
    <h3 className="text-lg font-semibold mb-4">Subscriptions</h3>
    {/* Table */}
  </div>
</div>
```

**Fix 5: Empty state for tables**
Current: "No results found" is plain text in a bare table.
Fix: Replace with a proper empty state component:
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
  <h3 className="text-lg font-medium mb-1">No subscriptions yet</h3>
  <p className="text-sm text-muted-foreground max-w-sm">
    Subscriptions will appear here once users sign up for paid plans.
  </p>
</div>
```

**Fix 6: Page header**
Current: "Finance" title and subtitle are functional but plain.
Fix: Add more vertical space and refine:
```tsx
<div className="mb-8">
  <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
  <p className="text-muted-foreground mt-1">
    Revenue, costs, cash flow, and performance forecasting.
  </p>
</div>
```

### Design Philosophy

Inspired by Origin's spending dashboard, X Analytics, and Neon's project dashboard. The finance module should feel spacious, data-rich but uncluttered, with clear visual hierarchy. Key principles:

- **Tabbed navigation** across the top (like Origin: Cash flow / Expenses / Income / Transfers)
- **Large, breathing charts** as the focal point — not crammed into cards
- **Summary KPI row** below the chart (like Origin: Total income / Total expenses / Net cash flow / Avg cash flow)
- **Time range toggles** in the top-right (like X: 7D / 2W / 4W / 3M / 1Y)
- **Clean data tables** below the metrics for drill-down
- **Minimal borders and shadows** — use whitespace and subtle dividers to separate sections
- **Usage meters** for infrastructure (like Neon: Branches 4/10, Compute 2.38/100 CU-hrs)

### 6.1 Finance Overview (`/finance`)

**Layout: Full-width, single column, generous spacing**

**Top Bar:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  💰 Finance                                                         │
│                                                                      │
│  [ Overview ]  [ Subscriptions ]  [ Commissions ]  [ Costs ]         │
│                                                 ┌──────────────────┐ │
│                                                 │ 7D 1M 3M 6M 1Y  │ │
│                                                 └──────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Tabs run horizontally below the page title (like Origin's Overview / Breakdown & budget / Transactions / Recurring / Reports). The active tab is underlined. Time range toggle (like X's 7D/2W/4W/3M/1Y pill buttons) sits top-right and affects all data on the page.

**Main Chart — Cash Flow (hero element, full width, tall):**

A large combined bar + line chart occupying ~40% of the viewport height (like Origin's cash flow chart). Bars show income (green, upward) and expenses (red/grey, downward). A dashed trend line connects the net cash flow points. The chart should breathe — generous padding, no cramped axes.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Cash Flow                                              [ Bar ▾ ]   │
│  Apr 2026 – Apr 2027                                                 │
│                                                                      │
│       ██                                                    €150     │
│       ██    ░░                                                       │
│  ──── ██ ── ░░ ──── ░░ ──── ██ ────────────────────────── €0        │
│            ░░░░    ░░░░                                              │
│                    ░░░░                                    -€150     │
│                                                                      │
│  Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec                │
│                                                                      │
│  █ Revenue   ░ Expenses   ---- Net cash flow                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**KPI Summary Row (below chart, 4-5 cards, evenly spaced, like Origin):**

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Total Income │  │Total Expenses│  │Net Cash Flow │  │   MRR        │  │  Burn Rate   │
│              │  │              │  │              │  │              │  │              │
│   €1,240     │  │   €680       │  │   €560       │  │   €520       │  │  €54/mo      │
│   ↑ 12%      │  │   ↓ 5%       │  │   ↑ 22%      │  │   ↑ 15%      │  │  infra only  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

Each card is minimal: label on top (small, muted), large number below, change indicator (green arrow up / red arrow down + percentage vs previous period). No borders — just a subtle background or divider lines between cards. Percentage change colours: green for positive revenue/positive net, red for increasing expenses.

**Monthly Breakdown Table (below KPIs, like Origin's month table):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Month ↓      │  Income      │  Expenses    │  Net Cash Flow        │
│───────────────│──────────────│──────────────│───────────────────────│
│  April        │  €520        │  €125        │  €395                 │
│  March        │  €450        │  €110        │  €340                 │
│  February     │  €270        │  €98         │  €172                 │
│  January      │  €0          │  €398        │  -€398                │
│  December     │  €0          │  €26         │  -€26                 │
└──────────────────────────────────────────────────────────────────────┘
```

Clean table with alternating row shading. Negative values in red. Clickable rows → drill into that month's detail.

**Schemas:** (unchanged — use the existing `subscription_plans`, `user_subscriptions`, `booking_commissions`, `api_cost_log` tables)

### 6.2 Subscriptions Tab (`/finance/subscriptions`)

**Layout: Same tabbed structure, Subscriptions tab active**

**Top Section — Plan Distribution (two-column layout):**

Left column (60%): Horizontal bar chart showing subscriber count per plan. Each bar is a different colour. The bars should be thick and clean (like X Analytics bars).

Right column (40%): KPI stack:
- Active Subscribers (large number)
- Free vs Paid ratio
- Churn Rate (with sparkline)
- Average Revenue Per User (ARPU)

**Time range toggle** affects subscriber growth chart below.

**Subscriber Growth Chart (full width):**

Line chart showing cumulative subscribers over time, with separate lines per plan (Free, Explorer, Pro). Like X's "Follows over time" chart — clean, minimal gridlines, clear legend.

**Subscription Table (below chart):**

| User | Plan | Status | Billing | Started | Renews | MRR Contribution |
|---|---|---|---|---|---|---|
| Anna K. | Pro | 🟢 Active | Monthly | Mar 2026 | Apr 2026 | €19.99 |
| Ben T. | Explorer | 🟢 Active | Yearly | Feb 2026 | Feb 2027 | €8.33 |
| Chris M. | Explorer | 🟡 Past Due | Monthly | Jan 2026 | — | €0 |

Searchable, sortable, with status badges (green dot Active, yellow Past Due, grey Cancelled). Filter by plan, status, billing period.

**Churn Section (below table):**

Two side-by-side charts (like X's "Follows over time" and "Posts & Replies" layout):
- Left: Cancellations per week/month (bar chart)
- Right: Churn rate % over time (line chart with threshold line)

**Schema:** (existing — no changes needed to `subscription_plans`, `user_subscriptions`)

### 6.3 Commissions Tab (`/finance/commissions`)

**Layout: Same tabbed structure, Commissions tab active**

**Top — Commission Summary (KPI cards, 4 across):**

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Pending    │  │  Confirmed   │  │   Paid Out   │  │  This Month  │
│              │  │              │  │              │  │              │
│   €340       │  │   €1,200     │  │   €890       │  │   €180       │
│   12 orders  │  │   45 orders  │  │   38 orders  │  │   ↑ 25%      │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**Commission Trend Chart (full width, like Origin cash flow):**

Bar chart showing monthly commission revenue. Stacked by booking type (accommodation / activity / restaurant) in different shades.

**Commission Log Table (below chart):**

| Date | User | Partner | Type | Booking Value | Rate | Commission | Status |
|---|---|---|---|---|---|---|---|
| 15 Apr | Anna K. | Hotel Cir | Accommodation | €350 | 10% | €35 | 🟢 Confirmed |
| 12 Apr | Ben T. | Rifugio Puez | Accommodation | €120 | 10% | €12 | 🟡 Pending |

Sortable, filterable by status, type, partner, date range. Status badges match the colour system.

**Top Partners (side panel or below):**

Ranked list: Partner name, total bookings, total commission generated. Like a simple leaderboard.

**Schema:** (existing — no changes needed to `booking_commissions`)

### 6.4 Costs Tab (`/finance/costs`)

**Layout: Same tabbed structure, Costs tab active**

**Top — Infrastructure Usage Meters (inspired by Neon's dashboard):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Infrastructure                                                      │
│                                                                      │
│  Supabase ⓘ        Vercel ⓘ           API Calls ⓘ       Email ⓘ   │
│  €25 / €25          €18 / €20          €42 / €50          €3 / €10  │
│  ██████████████░░   █████████████░░░   ████████████░░░░   ███░░░░░  │
│  100%               90%                84%                 30%       │
│                                                                      │
│  Usage since Apr 1, 2026. Resets monthly.                            │
└──────────────────────────────────────────────────────────────────────┘
```

Progress bars colour-coded: green < 60%, yellow 60-80%, red > 80% (like budget threshold warnings). Each meter shows spent/budget. Hoverable for detail breakdown.

**Cost Trend Chart (full width, stacked area):**

Stacked area chart showing costs over time by category (Anthropic API, Infrastructure, Email, Other). Clean like Origin's chart with a dashed line showing the budget ceiling.

**Cost Breakdown Table (below chart, like Origin's monthly table):**

| Month | Anthropic | Infrastructure | Email | Other | Total | vs Budget |
|---|---|---|---|---|---|---|
| April | €42 | €54.50 | €3 | €2 | €101.50 | 81% |
| March | €38 | €54.50 | €2 | €1 | €95.50 | 76% |
| February | €22 | €54.50 | €0 | €0 | €76.50 | 61% |

Colour the "vs Budget" column: green < 70%, yellow 70-90%, red > 90%.

**Cost per Unit Metrics (two small cards, bottom):**

```
┌──────────────────────────┐  ┌──────────────────────────┐
│  Cost per Content Entry  │  │  Cost per Adventure      │
│                          │  │                          │
│  €0.18                   │  │  €0.42                   │
│  ↓ 12% vs last month     │  │  ↓ 8% vs last month      │
└──────────────────────────┘  └──────────────────────────┘
```

**Schema:** (existing — no changes needed to `api_cost_log`, `cost_budgets`)

### 6.5 Design Specifications

**Colour palette for finance:**
- Revenue / positive: `#22C55E` (green-500)
- Expenses / negative: `#EF4444` (red-500)
- Neutral / infrastructure: `#6B7280` (gray-500)
- Warning threshold: `#F59E0B` (amber-500)
- Chart fills: Use 20% opacity versions of the above for area fills
- Bars: Solid colour, rounded corners (4px radius)

**Typography:**
- KPI numbers: `text-3xl font-semibold tracking-tight` (like Origin's $141, $681)
- KPI labels: `text-sm text-muted-foreground`
- Change indicators: `text-sm font-medium` with green/red colour
- Table text: `text-sm`, monospace for financial figures (`font-mono`)

**Spacing:**
- Chart height: minimum 320px, ideally 400px (like Origin — let it breathe)
- KPI card padding: `p-6`
- Gap between KPI cards: `gap-4` on desktop, stack vertically on mobile
- Section spacing: `space-y-8` between chart, KPIs, and table

**Chart library:** Recharts with custom theming to match the design system. No grid clutter — use only horizontal gridlines at major values, very light (`stroke-opacity: 0.1`).

**Responsive:**
- Desktop: 4-5 KPI cards in a row, full-width charts
- Tablet: 2-3 KPI cards per row, charts scale down
- Mobile: 2 KPI cards per row, charts full-width with horizontal scroll for tables

---

## 7. Sidebar Navigation

```
┌─────────────────────────┐
│  🏔 TruthStay Admin     │
│                         │
│  📋 Content             │
│    ├─ All Entries        │
│    └─ Review Queue       │
│                         │
│  👥 Users               │
│                         │
│  📊 Analytics           │
│    ├─ Overview           │
│    ├─ Regions            │
│    └─ Agent Runs         │
│                         │
│  💰 Finance             │
│    ├─ Revenue            │
│    ├─ Subscriptions      │
│    ├─ Commissions        │
│    └─ API Costs          │
│                         │
│  📣 Marketing           │
│    ├─ Growth Metrics     │
│    ├─ Referrals          │
│    ├─ Promo Codes        │
│    └─ Email Campaigns    │
│                         │
│  🤝 Partners            │
│    ├─ All Partners       │
│    └─ Performance        │
│                         │
│  🔔 Notifications       │
│    ├─ Send               │
│    ├─ Templates          │
│    ├─ Announcements      │
│    └─ History            │
│                         │
│  🛟 Support             │
│    ├─ Feedback           │
│    ├─ Reports            │
│    ├─ Flagged Content    │
│    └─ Contact Log        │
│                         │
│  ⚙️ Settings            │
│                         │
│  ─────────────────────  │
│  👤 Alex (Admin)        │
│  🚪 Sign Out            │
└─────────────────────────┘
```

---

## 8. Role-Based Access Control

Extend the existing `admin_users` table:

```sql
ALTER TABLE admin_users
  ALTER COLUMN role SET DEFAULT 'admin',
  ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('super_admin', 'admin', 'content_moderator', 'analyst', 'marketer'));
```

Middleware access matrix:

| Route | super_admin | admin | content_moderator | analyst | marketer |
|---|---|---|---|---|---|
| `/content/*` | ✅ | ✅ | ✅ (read + approve) | ❌ | ❌ |
| `/users/*` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/analytics/*` | ✅ | ✅ | ❌ | ✅ (read-only) | ❌ |
| `/finance/*` | ✅ | ✅ | ❌ | ✅ (read-only) | ❌ |
| `/marketing/*` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `/partners/*` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/notifications/*` | ✅ | ✅ | ✅ (send only) | ❌ | ✅ |
| `/support/*` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/settings/*` | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Module 5: Marketing

### 9.1 Marketing Overview (`/marketing`)

**KPI Cards:**
- Total Signups (with % change vs last period)
- Signups This Week / Month
- Referral Conversions
- Active Promo Codes
- Email Open Rate (average)
- Conversion Rate (visitor → registered user)

**Charts:**
- User acquisition funnel (visitor → signup → first adventure → saved trip → subscriber)
- Signup source breakdown (organic, referral, social, direct)
- Weekly growth trend (line chart)

### 9.2 Referral Program (`/marketing/referrals`)

**Schema:**

```sql
CREATE TABLE referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,             -- e.g. 'ALEX2026', 'SUMMER10'
  owner_user_id uuid REFERENCES users(id),  -- who owns this code (null for system codes)
  reward_type text DEFAULT 'credit'
    CHECK (reward_type IN ('credit', 'free_month', 'discount_pct', 'none')),
  reward_value numeric DEFAULT 0,        -- e.g. 10.00 for €10 credit, 20 for 20% off
  reward_for_referrer text DEFAULT 'credit'
    CHECK (reward_for_referrer IN ('credit', 'free_month', 'commission', 'none')),
  referrer_reward_value numeric DEFAULT 0,
  max_uses int,                          -- null = unlimited
  times_used int DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE referral_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid REFERENCES referral_codes(id),
  referred_user_id uuid REFERENCES users(id),
  referrer_user_id uuid REFERENCES users(id),
  status text DEFAULT 'signed_up'
    CHECK (status IN ('signed_up', 'activated', 'subscribed', 'rewarded')),
  reward_paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_referral_conversions_code ON referral_conversions (referral_code_id);
CREATE INDEX idx_referral_conversions_referrer ON referral_conversions (referrer_user_id);
```

**Dashboard view:**
- Table of all referral codes with usage stats
- Create / edit / deactivate referral codes
- Referral funnel: code shared → signed up → activated → subscribed
- Top referrers leaderboard
- Referral conversion rate over time

### 9.3 Promo Codes (`/marketing/promos`)

**Schema:**

```sql
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,             -- e.g. 'LAUNCH50', 'EARLYBIRD'
  description text,
  discount_type text NOT NULL
    CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_trial_days')),
  discount_value numeric NOT NULL,       -- e.g. 50 for 50%, 10.00 for €10 off, 30 for 30 days
  applies_to text DEFAULT 'subscription'
    CHECK (applies_to IN ('subscription', 'booking', 'all')),
  min_plan text,                         -- minimum plan required (null = any)
  max_redemptions int,                   -- null = unlimited
  times_redeemed int DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES promo_codes(id),
  user_id uuid REFERENCES users(id),
  discount_applied numeric NOT NULL,
  redeemed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_promo_redemptions_code ON promo_redemptions (promo_code_id);
```

**Dashboard view:**
- Table of all promo codes with redemption stats
- Create / edit / deactivate promo codes
- Redemption history log
- Revenue impact chart (revenue with vs without promos)

### 9.4 Email Campaigns (`/marketing/campaigns`)

**Schema:**

```sql
CREATE TABLE email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- e.g. 'Summer Launch', 'Win-back Inactive Users'
  subject text NOT NULL,
  body_html text,
  body_text text,
  segment_query jsonb,                   -- defines target audience
  -- Segment examples:
  -- {"type": "all_users"}
  -- {"type": "inactive", "days_since_last_login": 30}
  -- {"type": "region_interest", "region": "Dolomites"}
  -- {"type": "activity", "activity_type": "cycling"}
  -- {"type": "subscription", "plan": "free"}
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int DEFAULT 0,
  opened_count int DEFAULT 0,
  clicked_count int DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON email_campaigns (status);
```

**Dashboard view:**
- Campaign list with status badges (draft, scheduled, sent)
- Create new campaign with audience segment builder
- Campaign detail: open rate, click rate, unsubscribes
- Campaign performance comparison chart
- Template library (reusable email templates)

### 9.5 Growth Metrics (`/marketing/growth`)

Computed metrics pulling from existing tables — no new schema needed:

- **User growth curve** — signups per day/week/month (from `users.created_date`)
- **Activation rate** — % of signups who create their first adventure within 7 days
- **Retention cohorts** — month-over-month retention by signup cohort
- **Viral coefficient** — average referrals per user × conversion rate
- **Time to value** — average time from signup to first saved adventure

---

## 10. Module 6: Partner Management

### 10.1 Partner Overview (`/partners`)

**KPI Cards:**
- Total Active Partners
- New Partners This Month
- Total Booking Volume (via partners)
- Average Commission Rate
- Top Performing Partner

**Schema:**

```sql
CREATE TABLE booking_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL
    CHECK (type IN ('accommodation', 'activity_provider', 'restaurant', 'tour_operator', 'transport')),
  contact_name text,
  contact_email text,
  website text,
  region text,                           -- primary operating region
  commission_rate numeric NOT NULL DEFAULT 0.10,  -- partner-specific rate
  contract_start_date date,
  contract_end_date date,
  status text DEFAULT 'active'
    CHECK (status IN ('prospect', 'onboarding', 'active', 'paused', 'terminated')),
  notes text,
  logo_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_partners_status ON booking_partners (status);
CREATE INDEX idx_partners_type ON booking_partners (type);

-- Link partners to booking commissions
ALTER TABLE booking_commissions
  ADD COLUMN partner_id uuid REFERENCES booking_partners(id);
```

### 10.2 Partner List (`/partners`)

Data table with:
- Partner name (clickable → detail)
- Type badge (accommodation, activity, restaurant, etc.)
- Region
- Commission rate
- Status badge
- Total bookings (computed)
- Total revenue generated (computed)
- Contract end date (highlight if expiring soon)

**Actions:**
- Add new partner
- Edit partner details
- Change status (onboarding → active → paused)
- Adjust commission rate

### 10.3 Partner Detail (`/partners/[id]`)

- Partner profile (name, type, contact info, website, logo)
- Commission rate and contract dates
- Booking history table (all bookings through this partner)
- Revenue generated over time (line chart)
- Performance metrics: conversion rate, average booking value
- Notes / internal comments
- Edit all fields inline

### 10.4 Partner Performance (`/partners/performance`)

- Ranked table of partners by total booking volume
- Commission cost per partner (bar chart)
- Partner onboarding pipeline (kanban: prospect → onboarding → active)
- Partners with expiring contracts (alert list)

---

## 11. Module 7: Notifications & Communications

### 11.1 Notifications Overview (`/notifications`)

Central hub for all outbound communications to users.

**Schema:**

```sql
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- e.g. 'Welcome Email', 'Trip Reminder'
  channel text NOT NULL
    CHECK (channel IN ('push', 'email', 'in_app')),
  subject text,                          -- for email
  title text,                            -- for push / in_app
  body text NOT NULL,
  -- Template variables: {{user_name}}, {{adventure_title}}, {{region}}, etc.
  variables text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE notification_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES notification_templates(id),
  campaign_id uuid REFERENCES email_campaigns(id),  -- null for manual sends
  channel text NOT NULL
    CHECK (channel IN ('push', 'email', 'in_app')),
  recipient_user_id uuid REFERENCES users(id),
  title text,
  body text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'failed')),
  sent_at timestamptz,
  opened_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notification_sends_user ON notification_sends (recipient_user_id, created_at DESC);
CREATE INDEX idx_notification_sends_status ON notification_sends (status);

-- In-app announcements (banners shown to all or targeted users)
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  link_url text,                         -- optional CTA link
  link_text text,                        -- e.g. 'Learn More', 'Try It Now'
  target_segment jsonb DEFAULT '{"type": "all_users"}',
  priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  is_active boolean DEFAULT true,
  dismissible boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
```

### 11.2 Templates (`/notifications/templates`)

- List of all notification templates by channel
- Create / edit templates with variable placeholders
- Preview template with sample data
- Test send to yourself

### 11.3 Send Notifications (`/notifications/send`)

- Select channel (push / email / in-app)
- Choose template or write custom message
- Define audience segment:
  - All users
  - By region of interest
  - By activity type preference
  - By subscription plan
  - By last active date (e.g., "inactive for 14+ days")
  - Custom user list (paste emails)
- Schedule or send immediately
- Preview recipient count before sending

### 11.4 Announcements (`/notifications/announcements`)

- List of active and past announcements
- Create new announcement with start/end dates
- Target specific segments or show to everyone
- Priority levels (low = subtle banner, critical = modal)
- Preview how it looks in the app

### 11.5 Send History (`/notifications/history`)

- Full log of all notifications sent
- Filter by channel, template, date, status
- Delivery stats: sent, delivered, opened, failed
- Click-through rates for emails with links

---

## 12. Module 8: Support & Feedback

### 12.1 Support Overview (`/support`)

**KPI Cards:**
- Open Tickets
- Average Response Time
- Average Resolution Time
- User Satisfaction Score (from feedback)
- Flagged Content Count

### 12.2 Adventure Feedback (`/support/feedback`)

Pulls from your existing `adventure_feedback` table:

- Table of all feedback sorted by date (newest first)
- Columns: Adventure title, User, Day number, Route rating, Accommodation rating, Restaurant rating, Notes
- Filter by rating (show only low ratings for quick triage)
- Filter by region
- Link to the adventure detail
- Mark as "acknowledged" or "actioned"

**Schema addition for tracking:**

```sql
ALTER TABLE adventure_feedback
  ADD COLUMN admin_status text DEFAULT 'new'
    CHECK (admin_status IN ('new', 'acknowledged', 'investigating', 'resolved', 'wont_fix')),
  ADD COLUMN admin_notes text,
  ADD COLUMN assigned_to uuid;
```

### 12.3 User Reports (`/support/reports`)

**Schema:**

```sql
CREATE TABLE user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES users(id),
  reported_type text NOT NULL
    CHECK (reported_type IN ('content_entry', 'review', 'user', 'adventure', 'comment', 'other')),
  reported_id text,                      -- ID of the reported item
  reason text NOT NULL
    CHECK (reason IN ('spam', 'offensive', 'misleading', 'outdated', 'copyright', 'safety', 'other')),
  description text,
  status text DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_by uuid,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_user_reports_status ON user_reports (status);
CREATE INDEX idx_user_reports_type ON user_reports (reported_type);
```

**Dashboard view:**
- Report queue sorted by date (open reports first)
- Each report card shows: reporter, reported item preview, reason, description
- Actions: investigate (opens the reported item), resolve, dismiss
- Filter by type (content, review, user) and reason
- Resolution history

### 12.4 Flagged Content (`/support/flagged`)

Automated flags from the system + manual reports combined:

- Content entries with low trust scores that were previously verified (possible quality degradation)
- Reviews with profanity or spam signals
- Users with multiple reports against them
- Content entries where sources are now returning 404s (stale agent content)

### 12.5 Contact Log (`/support/contacts`)

**Schema:**

```sql
CREATE TABLE support_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  channel text DEFAULT 'email'
    CHECK (channel IN ('email', 'in_app', 'social', 'app_store_review')),
  subject text,
  body text NOT NULL,
  category text
    CHECK (category IN ('bug', 'feature_request', 'complaint', 'question', 'praise', 'other')),
  status text DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_support_contacts_status ON support_contacts (status, priority DESC);
```

**Dashboard view:**
- Ticket queue with status badges and priority indicators
- Assign tickets to team members
- Internal notes per ticket
- Response templates for common questions
- Metrics: response time, resolution time, tickets per day

---

## 13. Deployment

### Vercel Setup

```bash
# Create separate Vercel project for admin
cd truthstay-admin
vercel link  # Link to new Vercel project

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy
vercel --prod

# Configure custom domain
# In Vercel dashboard: Settings → Domains → Add admin.truthstay.com
```

### Supabase RLS Considerations

The admin dashboard uses the `service_role` key server-side, which bypasses RLS. All data access goes through Next.js API routes or Server Components — never directly from the client. This means:

- All Supabase queries happen in server components or API routes
- The `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the browser
- Client components fetch data via Next.js API routes, which handle auth checking

---

## 14. Design System — Aligned With TruthStay App

The admin dashboard must feel like it belongs to the TruthStay product family. While it's a professional internal tool, it should carry the same visual DNA as the consumer app — the teal accent colour, the airy spacing, the rounded cards, and the friendly-but-sharp typography.

### 14.1 Brand Tokens (Derived from the TruthStay App)

**Primary colour — Teal/Mint:**
```css
--truthstay-primary: #2DD4BF;       /* teal-400 — main accent, active states, CTAs */
--truthstay-primary-dark: #14B8A6;   /* teal-500 — hover states */
--truthstay-primary-light: #99F6E4;  /* teal-200 — subtle highlights, chart fills */
--truthstay-primary-bg: #F0FDFA;     /* teal-50 — card tints, selected row background */
```

The app uses this teal consistently: bottom tab active state, the Discover icon, the "Find friends" CTA, chart line colours in the admin dashboard. Every interactive accent in the admin should use this palette.

**Sidebar — Dark navy (already implemented correctly):**
```css
--sidebar-bg: #0F172A;              /* slate-900 — matches current dark sidebar */
--sidebar-text: #94A3B8;            /* slate-400 — inactive nav items */
--sidebar-text-active: #FFFFFF;     /* white — active nav item */
--sidebar-accent: #2DD4BF;          /* teal — active indicator dot/line */
--sidebar-section-label: #64748B;   /* slate-500 — PLATFORM, INSIGHTS, GROWTH, OPERATIONS labels */
```

The current sidebar grouping (PLATFORM → Content, Users / INSIGHTS → Analytics, Finance / GROWTH → Marketing, Partners / OPERATIONS → Notifications, Support) is well-structured and matches the app's bottom nav concept of grouped sections.

**Content area — Light and airy:**
```css
--content-bg: #F8FAFC;              /* slate-50 — page background (not pure white) */
--card-bg: #FFFFFF;                  /* white — card backgrounds */
--card-border: #E2E8F0;             /* slate-200 — subtle card borders */
--card-radius: 16px;                /* large radius — matches app cards (adventure cards, pirate illustration card) */
--card-shadow: 0 1px 3px rgba(0,0,0,0.04);  /* very subtle shadow, like app cards */
```

**Typography:**
```css
--font-heading: 'Inter', system-ui, sans-serif;   /* clean, modern — matches app headings */
--font-mono: 'JetBrains Mono', monospace;          /* for financial figures, IDs, scores */
```

**Status colours:**
```css
--status-success: #22C55E;          /* green-500 — verified, active, approved */
--status-warning: #F59E0B;          /* amber-500 — pending, approaching limit */
--status-error: #EF4444;            /* red-500 — failed, denied, banned */
--status-info: #2DD4BF;             /* teal — matches brand, used for informational badges */
--status-muted: #94A3B8;            /* slate-400 — idle, inactive, neutral */
```

### 14.2 Component Patterns (From the App)

**Cards — Large radius, minimal border, soft shadow:**
The app uses cards with ~16px radius (the adventure cards on Explore, the pirate illustration on Feed). The admin should match:
```tsx
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
  {/* content */}
</div>
```

**Empty states — Illustrative, friendly, actionable:**
The app has excellent empty states (pirate looking through telescope for empty feed, map icon for no trips). The admin should follow this pattern:
```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  {/* Optional: illustration or large icon in teal/slate */}
  <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
    <CreditCard className="h-8 w-8 text-teal-500" />
  </div>
  <h3 className="text-lg font-semibold mb-2">No subscriptions yet</h3>
  <p className="text-sm text-slate-500 max-w-sm mb-6">
    Subscriptions will appear here once users sign up for paid plans.
  </p>
  <button className="bg-teal-500 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-teal-600 transition">
    View plans
  </button>
</div>
```

Note the CTA button uses `rounded-full` (pill shape) matching the app's "Find friends" button style.

**Tab navigation — Pill-style toggles:**
The app uses pill-shaped toggles for Upcoming/Past on My Trips. The admin tabs should be similar:
```tsx
{/* For binary toggles like the app's Upcoming/Past */}
<div className="inline-flex bg-slate-100 rounded-full p-1">
  <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-slate-900 text-white">
    Upcoming
  </button>
  <button className="px-4 py-1.5 rounded-full text-sm font-medium text-slate-500">
    Past
  </button>
</div>

{/* For multi-tab navigation like Finance tabs */}
<div className="flex gap-1 border-b border-slate-200">
  <button className="px-4 py-3 text-sm font-medium text-teal-600 border-b-2 border-teal-500">
    Revenue
  </button>
  <button className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700">
    Costs
  </button>
  {/* ... */}
</div>
```

**Status badges — Rounded pill with subtle background:**
```tsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
  Active
</span>

<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
  Pending
</span>
```

The small dot + text pattern matches the app's clean indicator style.

**Charts — Teal as the primary chart colour:**
```tsx
// Recharts theme
const chartTheme = {
  primary: '#2DD4BF',        // main line/bar colour
  primaryLight: '#99F6E4',   // area fill (20% opacity)
  secondary: '#6366F1',      // second data series (indigo — complements teal)
  grid: '#E2E8F0',           // gridlines (very subtle)
  gridOpacity: 0.3,
  axis: '#94A3B8',           // axis labels
  tooltip: {
    bg: '#0F172A',           // dark tooltip (matches sidebar)
    text: '#FFFFFF',
  }
};
```

### 14.3 Layout Principles

**Spacing rhythm:**
- Page margin: `px-8 py-6`
- Section gap: `space-y-8`
- Card padding: `p-6`
- KPI card gap: `gap-6`
- Table cell padding: `px-4 py-3`

**Visual hierarchy (largest to smallest):**
1. Page title — `text-2xl font-bold tracking-tight`
2. KPI numbers — `text-3xl font-bold font-mono`
3. Section headings — `text-lg font-semibold`
4. Card labels — `text-sm text-slate-500`
5. Table text — `text-sm`
6. Metadata — `text-xs text-slate-400`

**Content area max-width:**
No fixed max-width on the content area — let tables and charts use the full width. But keep text content (descriptions, notes) to `max-w-prose` for readability.

### 14.4 What to Tell Claude Code

When implementing or refining the dashboard's visual layer:

> "The admin dashboard should match the TruthStay consumer app's design language:
> teal (#2DD4BF) as the primary accent colour, 16px border radius on cards,
> soft shadows, slate-50 page background, and generous spacing.
> Use pill-shaped buttons for primary CTAs (rounded-full), dot+text status badges,
> and the app's empty state pattern (large icon, heading, description, teal CTA).
> Charts should use teal as the primary colour with dark tooltips matching the sidebar.
> The sidebar is already correct — dark navy with grouped sections.
> See Section 14 of the admin dashboard spec for exact colour tokens and
> component code snippets."

---

## 15. Handing This to Claude Code

Create a new repo `truthstay-admin` and tell Claude Code:

> "Read docs/admin-dashboard-spec.md and scaffold a Next.js admin dashboard.
> Start with the layout (sidebar + header), auth middleware checking
> admin_users, and the Content Management module. Then add the remaining
> 7 modules: Users, Analytics, Finance, Marketing, Partners,
> Notifications, and Support. Use shadcn/ui components, Tailwind CSS,
> Recharts for charts, and TanStack Table for data tables.
> Connect to my existing Supabase project (hplczwepdpmtdfkijpnh).
> Create all new tables needed: subscription_plans, user_subscriptions,
> booking_commissions, api_cost_log, cost_budgets, analytics_events,
> referral_codes, referral_conversions, promo_codes, promo_redemptions,
> email_campaigns, booking_partners, notification_templates,
> notification_sends, announcements, user_reports, support_contacts.
> Also run the ALTER TABLE migrations for adventure_feedback and
> booking_commissions."

Claude Code can scaffold the entire project, set up the routing, and implement each module against your live database.
-e 

---

# PART 2: MARKETING AGENT DASHBOARD

---

# TruthStay Marketing Agent Dashboard — Implementation Spec

## 1. Overview

### What is this?

A dedicated marketing operations dashboard within the admin portal at `/marketing`. This is where you manage, monitor, and approve everything the Marketing Agent does — from email campaigns to social media posts to referral tracking. Since you want to be hands-on daily, this dashboard is designed for daily review with clear approval queues and real-time metrics.

### Your Marketing Strategy

**Channels:** Email (Resend/SendGrid), Push Notifications (via app), Social Media (Instagram, TikTok, X)

**Acquisition:** Word of mouth + referral programme + trip invitations (organic viral loop)

**Agent split:**
- Agent drafts all campaigns → you review and approve → agent sends
- Transactional messages (welcome, password reset, trip invites) → auto-send
- Social media → agent drafts and posts directly via API (full automation)

### The Two Growth Loops

TruthStay has two organic growth loops that the dashboard should track separately:

```
Loop 1: Referral Programme
  User shares invite code → friend signs up → both get reward → friend creates trip → repeat

Loop 2: Trip Invitations (the power loop)
  User plans a trip → invites friends to join → friends sign up to participate
  → friends see recommendations → friends plan their own trips → invite their friends → repeat
```

Loop 2 is your most powerful acquisition channel because it's embedded in the core product experience. The dashboard needs to surface how many signups come through trip invitations vs referral codes vs organic.

---

## 2. Dashboard Structure

### Navigation (within the admin sidebar)

```
📣 Marketing
  ├─ Overview          ← daily command centre
  ├─ Campaigns         ← email + push drafts, approvals, history
  ├─ Social            ← Instagram, TikTok, X — automated posts
  ├─ Referrals         ← referral codes + trip invitation tracking
  ├─ Growth            ← acquisition funnel, cohorts, viral metrics
  └─ Agent Activity    ← what the marketing agent is doing / planning
```

---

## 3. Marketing Overview (`/marketing`)

Your daily command centre. Open this every morning to see what happened overnight and what needs your attention.

### 3.1 Layout

**Top: Action Required Banner (only shows when items need approval)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚡ 3 items need your attention                                     │
│                                                                      │
│  📧 2 email campaigns ready for review          [ Review → ]        │
│  📱 1 push notification draft pending            [ Review → ]        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Teal left border, subtle background. Disappears when all items are approved/dismissed. Links go directly to the approval queue.

**KPI Cards (6 across, full width)**

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│New Users │ │ Trip     │ │ Referral │ │ Emails   │ │ Push     │ │ Social   │
│ Today    │ │ Invites  │ │ Signups  │ │ Sent     │ │ Sent     │ │ Posts    │
│          │ │ Sent     │ │ This Wk  │ │ This Wk  │ │ This Wk  │ │ This Wk  │
│   12     │ │   34     │ │   8      │ │  450     │ │  120     │ │   14     │
│  ↑ 20%   │ │  ↑ 15%   │ │  ↑ 60%   │ │  ↓ 5%    │ │  ↑ 30%   │ │  ↑ 40%   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Two-column layout below KPIs:**

Left (60%): **Acquisition Sources Chart** — stacked area chart showing daily signups by source:
- Organic (direct)
- Referral code
- Trip invitation (the power loop)
- Social media link

Right (40%): **Today's Activity Feed** — real-time log of what the marketing agent has done:
```
10:42  📧 Drafted "Summer Cycling" campaign — awaiting approval
09:15  📱 Auto-sent 3 welcome push notifications
08:30  📸 Posted to Instagram: Dolomites sunset route
08:00  🔍 Identified 12 users at risk of churning
07:00  📊 Generated daily growth report
```

**Bottom: Quick Stats Table**

| Channel | Sent (7d) | Open Rate | Click Rate | Conversions |
|---|---|---|---|---|
| Email campaigns | 450 | 32% | 8.5% | 12 |
| Transactional email | 120 | 85% | 22% | — |
| Push notifications | 120 | 45% | 12% | 8 |
| Social (Instagram) | 7 posts | — | — | 24 profile visits |
| Social (TikTok) | 4 posts | — | — | 15 profile visits |
| Social (X) | 3 posts | — | — | 8 link clicks |

---

## 4. Campaigns (`/marketing/campaigns`)

### 4.1 Campaign Tabs

```
[ All ]  [ Drafts (2) ]  [ Scheduled ]  [ Sent ]  [ Auto-send ]
```

**Drafts** — campaigns the agent has drafted and are awaiting your approval. This is your daily review queue.

**Scheduled** — approved campaigns scheduled for future send.

**Sent** — delivered campaigns with performance metrics.

**Auto-send** — transactional messages that send automatically (welcome, password reset, trip invite confirmation, booking confirmation).

### 4.2 Campaign Approval Queue (`/marketing/campaigns?tab=drafts`)

Each draft campaign shows as a card:

```
┌──────────────────────────────────────────────────────────────────────┐
│  📧 Email Campaign                                    Draft · Today │
│                                                                      │
│  Summer Cycling in Provence                                          │
│  ──────────────────────────────────                                  │
│  Segment: Users interested in cycling + France (84 recipients)       │
│  Agent rationale: "These users searched for cycling in France but    │
│  haven't saved a trip yet. Content library now has 45 Provence       │
│  entries — good time to re-engage."                                  │
│                                                                      │
│  Subject: Your perfect Provence cycling route is waiting 🚴          │
│                                                                      │
│  [ Preview Email ]    [ Edit ]    [ Approve & Schedule ]  [ Reject ] │
│                                                                      │
│  Estimated cost: €0.84 (email send) + €0.05 (personalisation)       │
│  CFO status: ✅ Pre-approved within weekly budget                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Preview Email** — opens a modal showing the full rendered email as the recipient would see it.

**Edit** — opens the campaign editor where you can modify subject, body, segment, and schedule.

**Approve & Schedule** — sets the send time (default: next optimal time the agent suggests based on open rate data). You can override.

**Reject** — with a reason field. Agent learns from rejections to improve future drafts.

### 4.3 Campaign Editor (`/marketing/campaigns/[id]/edit`)

- **Subject line** — editable, with A/B test option (agent suggests variant)
- **Email body** — rich text editor, pre-filled by agent using personalisation variables (`{{first_name}}`, `{{recommended_region}}`, `{{saved_trip_name}}`)
- **Audience segment** — visual segment builder showing recipient count:
  - Activity type filter
  - Region interest filter
  - Last active filter (e.g., "active in last 30 days")
  - Subscription plan filter
  - Custom: "has saved a trip but not booked"
- **Schedule** — date/time picker, or "Send now"
- **Channel toggle** — Email / Push / Both
- **Push notification variant** — title + short body (auto-generated from email, editable)

### 4.4 Campaign Detail (`/marketing/campaigns/[id]`)

After a campaign is sent, the detail page shows performance:

**KPI row:**
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Recipients│ │ Opened   │ │ Clicked  │ │Converted │ │Unsub'd   │
│          │ │          │ │          │ │          │ │          │
│   84     │ │  28 (33%)│ │   8 (10%)│ │  3 (4%)  │ │  1 (1%)  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Open rate over time** — line chart showing opens in the first 24h, 48h, 72h.

**Click heatmap** — which links in the email were clicked most.

**Conversion detail** — who converted and what they did (saved a trip, signed up, subscribed).

### 4.5 Auto-Send Templates (`/marketing/campaigns?tab=auto-send`)

Transactional messages that fire automatically. You set them up once, the agent sends them:

| Template | Trigger | Channel | Status |
|---|---|---|---|
| Welcome | User signs up | Email + Push | 🟢 Active |
| Trip invitation | User invites friend | Email | 🟢 Active |
| Trip reminder | 3 days before trip | Push | 🟢 Active |
| Churn prevention | Inactive 14 days | Email | 🟢 Active |
| Review request | 2 days after trip ends | Push | 🟢 Active |
| Booking confirmation | User books via partner | Email | 🟡 Draft |

Each template editable with preview. Toggle active/inactive.

### 4.6 Schema

```sql
-- Extend the existing email_campaigns table
ALTER TABLE email_campaigns
  ADD COLUMN channel text DEFAULT 'email'
    CHECK (channel IN ('email', 'push', 'both')),
  ADD COLUMN agent_rationale text,
  ADD COLUMN agent_suggested_send_time timestamptz,
  ADD COLUMN approval_status text DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN rejection_reason text,
  ADD COLUMN is_transactional boolean DEFAULT false,
  ADD COLUMN push_title text,
  ADD COLUMN push_body text,
  ADD COLUMN open_count_24h int DEFAULT 0,
  ADD COLUMN open_count_48h int DEFAULT 0,
  ADD COLUMN click_details jsonb DEFAULT '[]';

-- Track individual email/push sends with engagement
CREATE TABLE campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id),
  user_id uuid REFERENCES users(id),
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  status text DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  clicked_links jsonb DEFAULT '[]',
  converted boolean DEFAULT false,
  conversion_action text  -- e.g., 'saved_trip', 'subscribed', 'booked'
);

CREATE INDEX idx_campaign_sends_campaign ON campaign_sends (campaign_id);
CREATE INDEX idx_campaign_sends_user ON campaign_sends (user_id);
```

---

## 5. Social Media (`/marketing/social`)

The agent posts directly to Instagram, TikTok, and X via API. You see everything it's posted and what's coming up.

### 5.1 Layout

**Tabs:**
```
[ Content Calendar ]  [ Published ]  [ Performance ]  [ Settings ]
```

### 5.2 Content Calendar (`/marketing/social?tab=calendar`)

A weekly calendar view showing planned and published posts:

```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  Mon    │  Tue    │  Wed    │  Thu    │  Fri    │  Sat    │  Sun    │
│         │         │         │         │         │         │         │
│ 📸 IG   │         │ 🎵 TT   │ 📸 IG   │         │ 🐦 X    │ 📸 IG   │
│ Dolomit │         │ Cycling │ Algarve │         │ Thread: │ Provenc │
│ sunset  │         │ tips    │ surf    │         │ top 5   │ gravel  │
│ 9:00am  │         │ 12:00pm │ 9:00am  │         │ 10:00am │ 9:00am  │
│ ✅ Sent  │         │ ⏰ Sched│ ✅ Sent  │         │ ⏰ Sched│ 📝 Draft│
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

Click any cell to view/edit the post. Colour-coded by platform (purple=IG, pink=TikTok, blue=X).

**Week navigation** — arrows to go forward/back. "This week" button to jump to current.

### 5.3 Published Posts (`/marketing/social?tab=published`)

Grid of all published posts with engagement metrics:

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ 📸 Instagram · Apr 26           │  │ 🐦 X · Apr 25                   │
│                                 │  │                                 │
│ [Image thumbnail]               │  │ Thread: "5 cycling routes in    │
│                                 │  │ Provence you haven't heard of"  │
│ "Sunset over the Sella Pass..." │  │                                 │
│                                 │  │ 💬 12  🔄 8  ❤️ 45  👁 1.2k     │
│ ❤️ 23  💬 4  📤 2  👁 340        │  │                                 │
│ 🔗 Bio link clicks: 8           │  │ 🔗 Link clicks: 24              │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

Filterable by platform, date range. Sortable by engagement.

### 5.4 Social Performance (`/marketing/social?tab=performance`)

**KPI cards (per platform):**

```
┌─ Instagram ─────────┐  ┌─ TikTok ──────────────┐  ┌─ X ────────────────────┐
│ Followers: 142       │  │ Followers: 58          │  │ Followers: 89          │
│ Posts (30d): 12      │  │ Posts (30d): 8         │  │ Posts (30d): 15        │
│ Avg engagement: 4.2% │  │ Avg views: 1.2k       │  │ Avg impressions: 450   │
│ Bio link clicks: 45  │  │ Profile visits: 23     │  │ Link clicks: 34        │
│ ↑ 25% vs last month  │  │ ↑ 40% vs last month   │  │ ↑ 15% vs last month   │
└──────────────────────┘  └───────────────────────┘  └────────────────────────┘
```

**Best performing posts** — top 5 by engagement, with "why it worked" analysis from the agent.

**Post frequency vs engagement chart** — helps you see if posting more/less affects engagement.

**Optimal posting times** — heatmap showing when your audience is most active per platform.

### 5.5 Social Settings (`/marketing/social?tab=settings`)

| Setting | Value | Description |
|---|---|---|
| Instagram API connected | ✅ | Meta Graph API |
| TikTok API connected | ✅ | TikTok Content Posting API |
| X API connected | ✅ | X API v2 |
| Posts per week (Instagram) | 3 | Agent targets this frequency |
| Posts per week (TikTok) | 2 | Agent targets this frequency |
| Posts per week (X) | 3 | Agent targets this frequency |
| Auto-post enabled | ✅ | Agent posts without approval |
| Content sources | Content entries, trip data | What the agent draws from |
| Brand voice notes | "Friendly, authentic, no marketing speak" | Agent uses this for tone |
| Hashtag strategy | Auto-generated per post | Agent selects relevant hashtags |

### 5.6 Schema

```sql
CREATE TABLE social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL
    CHECK (platform IN ('instagram', 'tiktok', 'x')),
  post_type text DEFAULT 'image'
    CHECK (post_type IN ('image', 'video', 'carousel', 'story', 'reel', 'thread', 'text')),
  -- Content
  caption text,
  media_urls text[],
  hashtags text[],
  link_url text,
  -- Thread support (for X threads)
  thread_posts jsonb,                   -- array of {text, media_url} for multi-tweet threads
  -- Scheduling
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  -- Platform response
  platform_post_id text,                -- ID returned by the platform API
  platform_url text,                    -- direct link to the post
  -- Performance metrics (updated periodically)
  impressions int DEFAULT 0,
  reach int DEFAULT 0,
  likes int DEFAULT 0,
  comments int DEFAULT 0,
  shares int DEFAULT 0,
  saves int DEFAULT 0,                  -- Instagram saves
  link_clicks int DEFAULT 0,
  profile_visits int DEFAULT 0,
  video_views int DEFAULT 0,            -- TikTok/Reels
  engagement_rate real DEFAULT 0,
  -- Agent metadata
  content_entry_id uuid,                -- which content entry inspired this post
  agent_rationale text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  metrics_updated_at timestamptz
);

CREATE INDEX idx_social_posts_platform ON social_posts (platform, status);
CREATE INDEX idx_social_posts_scheduled ON social_posts (scheduled_at) WHERE status = 'scheduled';

-- Social platform credentials (encrypted)
CREATE TABLE social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE
    CHECK (platform IN ('instagram', 'tiktok', 'x')),
  is_connected boolean DEFAULT false,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  account_id text,
  account_name text,
  connected_at timestamptz,
  last_post_at timestamptz
);

-- Social settings
INSERT INTO platform_config (key, value) VALUES
  ('social_settings', '{
    "instagram": {"posts_per_week": 3, "auto_post": true, "optimal_times": ["09:00", "17:00"]},
    "tiktok": {"posts_per_week": 2, "auto_post": true, "optimal_times": ["12:00", "19:00"]},
    "x": {"posts_per_week": 3, "auto_post": true, "optimal_times": ["08:00", "12:00", "18:00"]},
    "brand_voice": "Friendly, authentic, no marketing speak. First-person perspective. Focus on real experiences, not polished tourism content.",
    "content_sources": ["content_entries", "adventures", "user_reviews"]
  }')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## 6. Referrals & Trip Invitations (`/marketing/referrals`)

### 6.1 Tabs

```
[ Overview ]  [ Referral Codes ]  [ Trip Invitations ]  [ Leaderboard ]
```

### 6.2 Referral Overview

**The two loops side by side:**

```
┌─ Referral Programme ──────────────┐  ┌─ Trip Invitations (Power Loop) ──┐
│                                   │  │                                   │
│  Active codes: 45                 │  │  Invites sent (30d): 234          │
│  Signups this month: 18           │  │  Signups from invites: 67         │
│  Conversion rate: 12%             │  │  Conversion rate: 29%             │
│  Avg referrals per user: 1.4      │  │  Avg invites per trip: 2.8        │
│  Rewards paid out: €45            │  │  Trips with invited friends: 42   │
│                                   │  │                                   │
│  ████████████░░░░ 12%             │  │  █████████████████████░░░ 29%     │
└───────────────────────────────────┘  └───────────────────────────────────┘
```

The trip invitation conversion rate (29%) should visually dwarf the referral rate (12%) — this reinforces that trip invitations are the power loop.

**Acquisition source breakdown chart (donut):**
- Organic: 40%
- Trip invitations: 35%
- Referral codes: 15%
- Social media: 10%

### 6.3 Trip Invitation Tracking

Track the trip invitation viral loop specifically:

```sql
CREATE TABLE trip_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES adventures(id),
  inviter_user_id uuid REFERENCES users(id),
  invitee_email text NOT NULL,
  invitee_user_id uuid REFERENCES users(id),  -- null until they sign up
  status text DEFAULT 'sent'
    CHECK (status IN ('sent', 'opened', 'signed_up', 'joined_trip', 'expired')),
  invite_method text DEFAULT 'email'
    CHECK (invite_method IN ('email', 'link', 'push', 'sms')),
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  signed_up_at timestamptz,
  joined_trip_at timestamptz
);

CREATE INDEX idx_trip_invitations_inviter ON trip_invitations (inviter_user_id);
CREATE INDEX idx_trip_invitations_status ON trip_invitations (status);
CREATE INDEX idx_trip_invitations_trip ON trip_invitations (trip_id);
```

**Dashboard view:**

| Trip | Inviter | Invitees | Signed Up | Joined Trip | Conversion |
|---|---|---|---|---|---|
| Provence Cycling | Alex | 4 invited | 2 signed up | 2 joined | 50% |
| Dolomites Hiking | Sarah | 3 invited | 1 signed up | 1 joined | 33% |
| Algarve Surf | Ben | 6 invited | 3 signed up | 2 joined | 50% |

**Viral chain visualisation:**
Show how one user's trip invitation leads to cascading signups:
```
Alex invites 4 friends to Provence trip
  → 2 sign up
    → Sarah creates her own trip, invites 3
      → 1 signs up
        → Creates own trip, invites 2...
```

This is your **K-factor** (viral coefficient) in action. The dashboard should calculate and display it:
```
K-factor = avg invitations per user × conversion rate
         = 2.8 × 0.29
         = 0.81

(K > 1.0 means organic viral growth — you're close!)
```

### 6.4 Referral Codes (`/marketing/referrals?tab=codes`)

Table of all referral codes (from existing `referral_codes` table):

| Code | Owner | Uses | Signups | Conversions | Reward | Status |
|---|---|---|---|---|---|---|
| ALEX2026 | Alex V. | 12 | 8 | 3 | €5 credit | 🟢 Active |
| SUMMER10 | System | 45 | 18 | 7 | 10% off | 🟢 Active |
| BETAUSER | System | ∞ | 25 | 10 | Free month | 🟡 Expiring |

Actions: Create code, edit, deactivate, view detail.

### 6.5 Leaderboard (`/marketing/referrals?tab=leaderboard`)

```
🏆 Top Referrers (All Time)

 1. Sarah K.     — 12 referrals, 8 converted     ████████████████
 2. Alex V.      — 8 referrals, 5 converted       ██████████
 3. Ben T.       — 6 referrals, 4 converted        ████████
 4. Maria G.     — 5 referrals, 3 converted         ██████
 5. Chris P.     — 4 referrals, 2 converted          ████

🏆 Top Trip Inviters (All Time)

 1. Alex V.      — 14 invites, 6 joined trips    ██████████████████
 2. Sarah K.     — 9 invites, 4 joined trips      ████████████
 3. Ben T.       — 8 invites, 3 joined trips        ██████████
```

---

## 7. Growth (`/marketing/growth`)

Deep analytics on user acquisition and retention. No new schema needed — computed from existing tables.

### 7.1 Acquisition Funnel

Visual funnel chart:

```
  Visited site/app store                 10,000
  ──────────────────────────────────── ████████████████████
  Downloaded / signed up                  1,200  (12%)
  ──────────────────────────────────── █████████
  Created first trip                        340  (28%)
  ──────────────────────────────────── ████
  Invited a friend                          120  (35%)
  ──────────────────────────────────── ██
  Saved/booked via partner                   45  (38%)
  ──────────────────────────────────── █
  Subscribed (paid)                          18  (40%)
  ──────────────────────────────────── ░
```

Each stage clickable → drill into who's at that stage.

### 7.2 Cohort Retention

Month-over-month retention table:

| Cohort | Month 0 | Month 1 | Month 2 | Month 3 | Month 4 |
|---|---|---|---|---|---|
| Jan 2026 | 100% | 45% | 32% | 28% | 25% |
| Feb 2026 | 100% | 52% | 38% | — | — |
| Mar 2026 | 100% | 48% | — | — | — |
| Apr 2026 | 100% | — | — | — | — |

Cells colour-coded: green > 40%, yellow 20-40%, red < 20%.

### 7.3 Viral Metrics

| Metric | Value | Trend | Target |
|---|---|---|---|
| K-factor (viral coefficient) | 0.81 | ↑ 12% | > 1.0 |
| Avg trip invitations per user | 2.8 | ↑ 8% | 3.0 |
| Trip invite conversion rate | 29% | ↑ 3% | 35% |
| Referral code conversion rate | 12% | — | 15% |
| Time to first trip invite | 4.2 days | ↓ 0.5d | < 3 days |
| Organic signup rate | 40% | ↓ 5% | maintain |

### 7.4 Channel Attribution

Where do users come from, and which source produces the most valuable users?

| Source | Signups (30d) | First Trip Rate | Invite Rate | Paid Conversion | LTV Estimate |
|---|---|---|---|---|---|
| Trip invitation | 67 | 78% | 42% | 12% | €45 |
| Referral code | 18 | 55% | 28% | 8% | €32 |
| Organic | 48 | 35% | 15% | 5% | €18 |
| Instagram | 12 | 40% | 20% | 6% | €22 |
| X | 5 | 30% | 10% | 4% | €15 |

This table proves the trip invitation loop produces the highest-quality users. The dashboard should surface this insight prominently.

---

## 8. Agent Activity (`/marketing/agent`)

See exactly what the marketing agent is doing, has done, and is planning.

### 8.1 Agent Status Card

```
┌──────────────────────────────────────────────────────────────────────┐
│  📣 Marketing Agent                                    🟢 Active     │
│                                                                      │
│  Weekly budget: €12.00 (Base scenario)                               │
│  Spent this week: €4.20 (35%)     ████████░░░░░░░░░░░░░░            │
│  Monthly budget: €35.00                                              │
│  Spent this month: €18.40 (53%)   ██████████████░░░░░░░░            │
│                                                                      │
│  Last run: Today 10:42am          Next scheduled: Today 2:00pm       │
│  Campaigns drafted: 2             Campaigns sent: 14 (this month)    │
│  Social posts: 14 (this month)    Churn alerts: 3 (this week)        │
│                                                                      │
│  [ Pause Agent ]  [ View Spend Log ]  [ Adjust Budget ]             │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Agent Decision Log

Chronological log of every decision the agent made:

```
Apr 28, 10:42  DRAFT    Created email campaign "Summer Cycling in Provence"
               Segment: cycling + France interest (84 users)
               Estimated cost: €0.89
               CFO: ✅ Pre-approved (within weekly budget)
               Status: ⏳ Awaiting your approval

Apr 28, 09:15  AUTO     Sent 3 welcome emails (transactional, auto-approved)
               Cost: €0.03

Apr 28, 08:30  POST     Published Instagram post: Dolomites sunset route
               Content source: content_entry #a4b2c1
               Hashtags: #dolomites #cycling #truthstay
               Cost: €0.01

Apr 28, 08:00  CHURN    Identified 12 users at risk (inactive 14+ days)
               Drafted churn prevention email
               Submitted spend request to CFO: €0.15
               CFO: ✅ Approved
               Status: ⏳ Awaiting your approval

Apr 27, 14:00  SOCIAL   Generated 3 social posts for next week
               Platforms: 1x IG, 1x TikTok, 1x X thread
               Content from: Algarve surf entries
               Cost: €0.08
```

### 8.3 Agent Performance (monthly review)

| Metric | This Month | Last Month | Change |
|---|---|---|---|
| Campaigns sent | 14 | 10 | ↑ 40% |
| Open rate (avg) | 32% | 28% | ↑ 4pp |
| Click rate (avg) | 8.5% | 7.2% | ↑ 1.3pp |
| Users reactivated (churn prevention) | 35 | 22 | ↑ 59% |
| Social posts published | 14 | 8 | ↑ 75% |
| Social engagement (avg) | 4.2% | 3.1% | ↑ 1.1pp |
| Cost per reactivated user | €0.43 | €0.65 | ↓ 34% |
| Budget utilisation | 53% | 73% | ↓ 20pp |

---

## 9. Design Notes

Follow the TruthStay design system from `admin-dashboard-spec.md` Section 14:

- Teal accent (#2DD4BF) for active states, progress bars, CTAs
- rounded-2xl cards with subtle shadows
- Approval banner: teal left border on white card
- Platform badges: purple for Instagram, pink for TikTok, blue for X
- Status dots: green=active/sent, amber=pending/draft, red=failed
- Charts: teal primary, use the Recharts theme from the design system
- Empty states: follow the pirate illustration pattern from the app

---

## 10. Handing This to Claude Code

```
Read /Users/alexandervoorham/Documents/Apps/TruthStay/Docs/marketing-agent-dashboard-spec.md.
Build the marketing dashboard within the existing admin portal under /marketing.
Restructure the existing Marketing module with 6 sub-pages: Overview, Campaigns,
Social, Referrals, Growth, and Agent Activity. Create the new tables: campaign_sends,
social_posts, social_connections, trip_invitations. Run the ALTER TABLE migration
on email_campaigns to add the new columns. Follow the design system from
/Users/alexandervoorham/Documents/Apps/TruthStay/Docs/admin-dashboard-spec.md Section 14.
The campaign approval queue is the most important page — build that first.
```
-e 

---

# PART 3: CFO COMMAND CENTRE & AGENT OPERATIONS

---

## 9. Weekly Scenario Forecasting

### 9.1 How It Works

Every week (Sunday evening), the CFO generates **three scenarios** for the coming week and month. You review them in the dashboard and select the scenario that sets the operating parameters.

```
Sunday evening:
  CFO Agent runs "generate_weekly_scenarios"
    ↓
  Analyses: current spend pace, revenue trends, content growth,
  infrastructure costs, remaining monthly budget
    ↓
  Generates 3 scenarios:
    🟢 OPTIMISTIC — Aggressive growth, higher spend
    🟡 BASE — Steady state, planned spend
    🔴 CONSERVATIVE — Tighten spending, preserve cash
    ↓
  Scenarios appear in Admin Dashboard → /agents/cfo/weekly-plan
    ↓
  You review scenarios, optionally adjust, select one
    ↓
  Selected scenario sets agent spending limits for the week
    ↓
  CFO enforces the weekly limits within the monthly envelope
    ↓
  If no scenario selected by Monday 9am → BASE is auto-applied
```

### 9.2 Weekly Scenario Schema

```sql
CREATE TABLE weekly_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Period
  week_start date NOT NULL,              -- Monday of the target week
  plan_month_id uuid REFERENCES monthly_budget_plans(id),
  -- Status
  status text DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'scenario_selected', 'expired')),
  -- Three scenarios
  optimistic jsonb NOT NULL,
  base jsonb NOT NULL,
  conservative jsonb NOT NULL,
  -- Selected scenario
  selected_scenario text
    CHECK (selected_scenario IN ('optimistic', 'base', 'conservative', 'custom')),
  custom_parameters jsonb,               -- if admin picks 'custom' and adjusts values
  selected_at timestamptz,
  selected_by uuid,
  -- Context
  week_number int,                       -- week of the month (1-5)
  month_budget_remaining numeric,        -- how much of the monthly budget is left
  month_budget_spent numeric,            -- how much has been spent so far this month
  month_days_remaining int,
  -- CFO analysis
  performance_summary text,              -- how did last week go?
  risk_assessment text,
  -- Metadata
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_weekly_scenarios_week ON weekly_scenarios (week_start DESC);
CREATE INDEX idx_weekly_scenarios_status ON weekly_scenarios (status);
```

### 9.3 What Each Scenario Contains

```json
{
  "optimistic": {
    "label": "Accelerate Growth",
    "total_weekly_spend": 38.00,
    "agent_limits": {
      "location_scout": {
        "weekly_budget": 18.00,
        "planned_runs": 5,
        "target_entries": 80,
        "rationale": "Push hard on Mediterranean regions before summer peak"
      },
      "marketing": {
        "weekly_budget": 12.00,
        "planned_campaigns": 3,
        "target_reach": 2000,
        "rationale": "Launch summer campaign series + referral push"
      },
      "pricing": {
        "weekly_budget": 3.00,
        "planned_actions": ["competitor analysis", "conversion funnel review"],
        "rationale": "Deeper analysis to prep price increase"
      },
      "cfo": {
        "weekly_budget": 5.00,
        "rationale": "Higher decision volume with increased agent activity"
      }
    },
    "projected_outcomes": {
      "new_content_entries": 80,
      "email_campaigns_sent": 3,
      "projected_new_signups": 25,
      "projected_reactivations": 15
    },
    "risk_level": "medium",
    "risk_note": "Spends 30% of remaining monthly budget in one week. Only viable if content ROI holds.",
    "conditions": "Only recommended if last week's content entries had avg trust score > 0.3"
  },

  "base": {
    "label": "Steady Growth",
    "total_weekly_spend": 25.00,
    "agent_limits": {
      "location_scout": {
        "weekly_budget": 12.00,
        "planned_runs": 3,
        "target_entries": 45,
        "rationale": "Maintain steady content expansion"
      },
      "marketing": {
        "weekly_budget": 8.00,
        "planned_campaigns": 2,
        "target_reach": 1200,
        "rationale": "Churn prevention + one targeted regional campaign"
      },
      "pricing": {
        "weekly_budget": 2.00,
        "planned_actions": ["monthly analysis"],
        "rationale": "Standard monitoring"
      },
      "cfo": {
        "weekly_budget": 3.00,
        "rationale": "Normal decision processing"
      }
    },
    "projected_outcomes": {
      "new_content_entries": 45,
      "email_campaigns_sent": 2,
      "projected_new_signups": 15,
      "projected_reactivations": 8
    },
    "risk_level": "low",
    "risk_note": "On track with monthly plan. No adjustments needed."
  },

  "conservative": {
    "label": "Preserve Cash",
    "total_weekly_spend": 12.00,
    "agent_limits": {
      "location_scout": {
        "weekly_budget": 5.00,
        "planned_runs": 1,
        "target_entries": 15,
        "rationale": "Only highest-priority region gaps"
      },
      "marketing": {
        "weekly_budget": 4.00,
        "planned_campaigns": 1,
        "target_reach": 500,
        "rationale": "Churn prevention only — no new acquisition spend"
      },
      "pricing": {
        "weekly_budget": 1.00,
        "planned_actions": ["pause non-essential analysis"],
        "rationale": "Minimal monitoring"
      },
      "cfo": {
        "weekly_budget": 2.00,
        "rationale": "Reduced processing"
      }
    },
    "projected_outcomes": {
      "new_content_entries": 15,
      "email_campaigns_sent": 1,
      "projected_new_signups": 5,
      "projected_reactivations": 3
    },
    "risk_level": "low",
    "risk_note": "Preserves budget for later in the month. Use if revenue is below forecast or costs are running hot.",
    "conditions": "Recommended if month-to-date spend > 60% of monthly budget"
  }
}
```

### 9.4 Weekly Scenario Review Page (`/agents/cfo/weekly-plan`)

**Header:**
- Week (e.g., "Week of 6 July 2026")
- Monthly budget status: spent / remaining / total (progress bar)
- Days remaining in month

**Last Week Performance:**
- Budget vs actual spend per agent
- Key outcomes (entries created, campaigns sent, signups)
- CFO commentary on what went well / what didn't

**Three Scenario Cards (side by side):**

| | 🟢 Optimistic | 🟡 Base | 🔴 Conservative |
|---|---|---|---|
| Weekly spend | $38 | $25 | $12 |
| Content entries | ~80 | ~45 | ~15 |
| Campaigns | 3 | 2 | 1 |
| Risk level | Medium | Low | Low |
| **Select** | [ Button ] | [ Button ] | [ Button ] |

Each card expandable to show full agent breakdown, rationale, projected outcomes, and risk notes.

**Custom Option:**
- "Create Custom" button → opens an editor pre-populated with the Base scenario
- Adjust any agent's weekly budget and planned activities
- System validates that custom plan doesn't exceed remaining monthly budget

**Admin Actions:**
- Select a scenario → confirms and activates for the week
- Create custom → save and activate
- If no selection by Monday 9am → Base auto-applies (with notification)

### 9.5 Weekly Scenario Enforcement

When a scenario is selected, weekly limits are written to `agent_registry`:

```sql
-- Apply selected weekly scenario
ALTER TABLE agent_registry
  ADD COLUMN weekly_budget_usd numeric DEFAULT 0,
  ADD COLUMN weekly_spent numeric DEFAULT 0,
  ADD COLUMN weekly_reset_day int DEFAULT 1;  -- 1=Monday

CREATE OR REPLACE FUNCTION apply_weekly_scenario(scenario_id uuid, selected text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_scenario weekly_scenarios;
  v_params jsonb;
  v_agent_id text;
  v_agent_config jsonb;
BEGIN
  SELECT * INTO v_scenario FROM weekly_scenarios WHERE id = scenario_id;

  -- Get the selected scenario's parameters
  v_params := CASE selected
    WHEN 'optimistic' THEN v_scenario.optimistic
    WHEN 'base' THEN v_scenario.base
    WHEN 'conservative' THEN v_scenario.conservative
    WHEN 'custom' THEN v_scenario.custom_parameters
  END;

  -- Apply weekly limits to each agent
  FOR v_agent_id, v_agent_config IN
    SELECT key, value FROM jsonb_each(v_params->'agent_limits')
  LOOP
    UPDATE agent_registry
    SET
      weekly_budget_usd = (v_agent_config->>'weekly_budget')::numeric,
      weekly_spent = 0,
      updated_at = NOW()
    WHERE id = v_agent_id;
  END LOOP;

  -- Mark scenario as selected
  UPDATE weekly_scenarios
  SET
    status = 'scenario_selected',
    selected_scenario = selected,
    selected_at = NOW()
  WHERE id = scenario_id;
END;
$$;

-- Reset weekly budgets every Monday at midnight
SELECT cron.schedule('reset-weekly-budgets', '0 0 * * 1', $$
  UPDATE agent_registry SET weekly_spent = 0;
$$);
```

### 9.6 Dual Enforcement: Weekly AND Monthly

The CFO now enforces **two** budget gates on every spend request:

```
Can this agent spend?
  ↓
  1. Is there an approved monthly plan? → No → DENY
  2. Is there a selected weekly scenario? → No → auto-apply Base
  3. Would this spend exceed the agent's weekly budget? → Yes → DENY
  4. Would this spend exceed the agent's monthly budget? → Yes → DENY
  5. Both checks pass → evaluate with CFO logic → APPROVE/DENY
```

### 9.7 CFO Weekly Scenario Generation Function

```typescript
async function generateWeeklyScenarios() {
  const snapshot = await buildFinancialSnapshot(sql);
  const infrastructure = await sql`SELECT * FROM monthly_infrastructure_costs`;

  // Get the approved monthly plan
  const currentMonth = new Date();
  currentMonth.setDate(1);
  const [monthlyPlan] = await sql`
    SELECT * FROM monthly_budget_plans
    WHERE plan_month = ${currentMonth} AND status = 'approved'
    ORDER BY created_at DESC LIMIT 1
  `;

  if (!monthlyPlan) {
    return { error: "No approved monthly plan — cannot generate weekly scenarios" };
  }

  // Get last week's performance
  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekSpend = await sql`
    SELECT agent_id, SUM(actual_cost_usd) as spent
    FROM spend_authorisations
    WHERE status IN ('approved', 'partially_approved')
      AND completed_at >= ${lastWeekStart}
    GROUP BY agent_id
  `;

  // Calculate remaining monthly budget
  const monthBudgetRemaining = Number(monthlyPlan.total_budget_usd)
    - snapshot.agents.reduce((sum, a) => sum + a.spent, 0);
  const daysRemaining = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
    - new Date().getDate();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are the CFO of TruthStay. Generate three spending scenarios for next week.
Each scenario must stay within the remaining monthly budget of $${monthBudgetRemaining.toFixed(2)}.
Infrastructure costs of $${Number(infrastructure[0]?.total_monthly || 0).toFixed(2)}/month are fixed and already accounted for.
The founder will choose which scenario to activate.
Be specific about what each agent will do and why.
Respond ONLY with valid JSON containing: { optimistic, base, conservative } objects.`,
    messages: [{
      role: "user",
      content: `Generate weekly scenarios.

FINANCIAL STATE: ${JSON.stringify(snapshot, null, 2)}
MONTHLY PLAN: ${JSON.stringify(monthlyPlan, null, 2)}
INFRASTRUCTURE: ${JSON.stringify(infrastructure, null, 2)}
LAST WEEK SPEND: ${JSON.stringify(lastWeekSpend, null, 2)}
REMAINING MONTHLY BUDGET: $${monthBudgetRemaining.toFixed(2)}
DAYS REMAINING IN MONTH: ${daysRemaining}
WEEK NUMBER: ${Math.ceil((new Date().getDate()) / 7)} of ${Math.ceil(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() / 7)}`
    }],
  });

  // Parse and save scenarios
  const scenarioText = response.content.find(b => b.type === "text")?.text ?? "";
  const scenarios = JSON.parse(scenarioText.match(/\{[\s\S]*\}/)?.[0] ?? "{}");

  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));

  await sql`
    INSERT INTO weekly_scenarios (
      week_start, plan_month_id, optimistic, base, conservative,
      month_budget_remaining, month_budget_spent, month_days_remaining,
      performance_summary, risk_assessment, week_number
    ) VALUES (
      ${nextMonday}, ${monthlyPlan.id},
      ${JSON.stringify(scenarios.optimistic)},
      ${JSON.stringify(scenarios.base)},
      ${JSON.stringify(scenarios.conservative)},
      ${monthBudgetRemaining}, ${snapshot.agents.reduce((s, a) => s + a.spent, 0)},
      ${daysRemaining},
      ${scenarios.performance_summary || ''},
      ${scenarios.risk_assessment || ''},
      ${Math.ceil(nextMonday.getDate() / 7)}
    )
  `;

  // Notify admin
  await sql`
    INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, priority)
    VALUES ('cfo', 'admin', 'status_report', ${JSON.stringify({
      message: 'Weekly scenarios for w/c ' + nextMonday.toISOString().slice(0, 10) + ' are ready for your review.',
      action_url: '/agents/cfo/weekly-plan',
      action_required: true
    })}, 'high')
  `;

  return scenarios;
}
```

---

## 10. Budget Dashboard Controls (`/agents/cfo`)

### 10.1 CFO Command Centre

The admin dashboard's CFO page becomes the central financial control panel:

**Top Bar — Financial Health:**
- Total monthly budget (approved plan)
- Spent this month (progress bar, colour-coded by pace)
- Infrastructure costs (fixed, shown separately)
- Net position: revenue - total costs
- Weekly budget (from selected scenario)
- Spent this week (progress bar)

**Tab 1 — Monthly Plan:**
- Current approved plan with per-agent allocations
- Budget vs actual per agent (bar chart)
- "Amend Plan" button for mid-month adjustments
- Historical plans (past months)

**Tab 2 — Weekly Scenarios:**
- Current week's selected scenario
- Next week's pending scenarios (if generated)
- Last 4 weeks' scenario history with actual outcomes
- "Which scenario performed best?" comparison view

**Tab 3 — Infrastructure:**
- All active subscriptions with monthly costs
- Total infrastructure burn rate
- Renewal calendar
- Add / edit / cancel subscriptions
- Alerts for upcoming renewals

**Tab 4 — Forecasts:**
- 3-month revenue + cost projections
- Cash flow chart
- Break-even analysis
- "What if" toggles: what if we double marketing? What if we cut scout budget?

**Tab 5 — Agent Spend Log:**
- Full audit trail of all spend requests, approvals, denials
- Filter by agent, date, amount, status
- Total spend by agent over time (stacked area chart)
- CFO reasoning for each decision

### 10.2 Quick Actions

Buttons always visible in the CFO dashboard:

- **Approve Monthly Plan** → opens the pending plan review
- **Select Weekly Scenario** → opens scenario selection
- **Pause All Agents** → emergency stop (requires confirmation)
- **Resume Agents** → un-pause (requires active plan)
- **Override CFO Decision** → manual approve/deny a specific request
- **Adjust Agent Budget** → inline edit any agent's weekly or monthly budget
- **Add Infrastructure Cost** → register a new subscription

### 10.3 Parameter Controls (`/agents/cfo/settings`)

A settings page where you define the CFO's operating rules:

| Parameter | Default | Description | Editable |
|---|---|---|---|
| Monthly burn budget (pre-revenue) | $100 | Total ceiling before revenue | ✅ |
| Max cost-to-revenue ratio | 80% | CFO blocks spend above this | ✅ |
| Reserve percentage | 20% | Budget held back for emergencies | ✅ |
| Auto-approve threshold | $1.00 | Requests below this skip CFO analysis | ✅ |
| Weekly scenario auto-apply | Base | Which scenario applies if you don't choose | ✅ |
| Plan approval deadline | 3rd of month | Agents pause if no plan approved by this date | ✅ |
| Scenario generation day | Sunday | Day CFO generates weekly scenarios | ✅ |
| Forecast horizon | 3 months | How far ahead the CFO projects | ✅ |

All editable inline, changes saved to `platform_config`:

```sql
INSERT INTO platform_config (key, value) VALUES
  ('cfo_rules', '{
    "max_cost_to_revenue_ratio": 0.80,
    "reserve_pct": 0.20,
    "auto_approve_under_usd": 1.00,
    "weekly_auto_apply": "base",
    "plan_approval_deadline_day": 3,
    "scenario_generation_day": "sunday",
    "forecast_horizon_months": 3,
    "pre_revenue_monthly_budget": 100
  }')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

---

## 11. Budget Operations
## 10. Budget Dashboard Controls (`/agents/cfo`)

### 10.1 CFO Command Centre

The admin dashboard's CFO page becomes the central financial control panel:

**Top Bar — Financial Health:**
- Total monthly budget (approved plan)
- Spent this month (progress bar, colour-coded by pace)
- Infrastructure costs (fixed, shown separately)
- Net position: revenue - total costs
- Weekly budget (from selected scenario)
- Spent this week (progress bar)

**Tab 1 — Monthly Plan:**
- Current approved plan with per-agent allocations
- Budget vs actual per agent (bar chart)
- "Amend Plan" button for mid-month adjustments
- Historical plans (past months)

**Tab 2 — Weekly Scenarios:**
- Current week's selected scenario
- Next week's pending scenarios (if generated)
- Last 4 weeks' scenario history with actual outcomes
- "Which scenario performed best?" comparison view

**Tab 3 — Infrastructure:**
- All active subscriptions with monthly costs
- Total infrastructure burn rate
- Renewal calendar
- Add / edit / cancel subscriptions
- Alerts for upcoming renewals

**Tab 4 — Forecasts:**
- 3-month revenue + cost projections
- Cash flow chart
- Break-even analysis
- "What if" toggles: what if we double marketing? What if we cut scout budget?

**Tab 5 — Agent Spend Log:**
- Full audit trail of all spend requests, approvals, denials
- Filter by agent, date, amount, status
- Total spend by agent over time (stacked area chart)
- CFO reasoning for each decision

### 10.2 Quick Actions

Buttons always visible in the CFO dashboard:

- **Approve Monthly Plan** → opens the pending plan review
- **Select Weekly Scenario** → opens scenario selection
- **Pause All Agents** → emergency stop (requires confirmation)
- **Resume Agents** → un-pause (requires active plan)
- **Override CFO Decision** → manual approve/deny a specific request
- **Adjust Agent Budget** → inline edit any agent's weekly or monthly budget
- **Add Infrastructure Cost** → register a new subscription

### 10.3 Parameter Controls (`/agents/cfo/settings`)

A settings page where you define the CFO's operating rules:

| Parameter | Default | Description | Editable |
|---|---|---|---|
| Monthly burn budget (pre-revenue) | $100 | Total ceiling before revenue | ✅ |
| Max cost-to-revenue ratio | 80% | CFO blocks spend above this | ✅ |
| Reserve percentage | 20% | Budget held back for emergencies | ✅ |
| Auto-approve threshold | $1.00 | Requests below this skip CFO analysis | ✅ |
| Weekly scenario auto-apply | Base | Which scenario applies if you don't choose | ✅ |
| Plan approval deadline | 3rd of month | Agents pause if no plan approved by this date | ✅ |
| Scenario generation day | Sunday | Day CFO generates weekly scenarios | ✅ |
| Forecast horizon | 3 months | How far ahead the CFO projects | ✅ |

All editable inline, changes saved to `platform_config`:

```sql
INSERT INTO platform_config (key, value) VALUES
  ('cfo_rules', '{
    "max_cost_to_revenue_ratio": 0.80,
    "reserve_pct": 0.20,
    "auto_approve_under_usd": 1.00,
    "weekly_auto_apply": "base",
    "plan_approval_deadline_day": 3,
    "scenario_generation_day": "sunday",
    "forecast_horizon_months": 3,
    "pre_revenue_monthly_budget": 100
  }')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

---

## 11. Budget Operations

### 11.1 Dynamic Reallocation (Within Approved Plan)

The CFO can reallocate budgets mid-month **within the approved total** — it cannot exceed the total you approved:

```json
// CFO → Location Scout
{
  "from_agent": "cfo",
  "to_agent": "location_scout",
  "message_type": "budget_update",
  "payload": {
    "previous_budget_usd": 55.00,
    "new_budget_usd": 65.00,
    "source": "marketing underspend",
    "reason": "Marketing Agent underspent by $15 this month. Reallocating $10 to Location Scout to accelerate content expansion in high-demand regions. Remaining $5 returns to reserve.",
    "approved_plan_total_unchanged": true
  }
}
```

If the CFO wants to exceed the approved total, it must escalate to admin:

```json
// CFO → Admin
{
  "from_agent": "cfo",
  "to_agent": "admin",
  "message_type": "escalation",
  "payload": {
    "type": "budget_increase_request",
    "current_total": 125.00,
    "requested_total": 150.00,
    "reason": "Unexpected opportunity: 3 high-profile travel bloggers offered partnership content for the Algarve region. Location Scout needs additional $25 to process and integrate this content. Estimated ROI: 500+ high-quality entries.",
    "urgency": "time-sensitive — partnership offer expires in 5 days"
  }
}
```

### 11.2 Pre-Revenue Budget Mode

Before TruthStay has paying users, the CFO operates in **pre-revenue mode**:

- Total monthly burn budget set by admin in CFO settings (e.g., $100/month)
- Infrastructure costs are subtracted first, remaining budget allocated to agents
- CFO proposes allocation within this ceiling
- Revenue projections based on signup velocity and planned launch date
- Weekly scenarios account for infrastructure as fixed overhead

```
Monthly budget: $100
  - Infrastructure: $54.50 (Supabase $25 + Vercel $20 + Apple $8.25 + Domain $1.25)
  = Available for agents: $45.50
  = CFO allocates this across location_scout, marketing, pricing, reserve
```

### 11.3 Auto-Approval Threshold

To avoid bottlenecks, the CFO auto-approves small requests (within the approved plan):

- Requests under $1.00 are **auto-approved** without Claude analysis
- Requests under $5.00 use a lightweight rule-based check (budget remaining > request amount)
- Requests over $5.00 get full Claude-powered CFO analysis
- **No request can be approved if no monthly plan is active**
- **No request can exceed the selected weekly scenario's agent limit**

---

## 12. Monitoring & Admin Visibility
## 12. Monitoring & Admin Visibility

### 12.1 Agent Dashboard (Admin Portal)

Add a new module to the admin dashboard — **Agent Operations**:

**Agent Overview (`/agents`):**
- Card per agent: status, budget used/remaining, last run, health indicator
- Active spend requests (pending CFO decisions)
- Recent agent messages (message bus log)

**Agent Detail (`/agents/[id]`):**
- Full message history for this agent
- Spend authorisation log (approved, denied, amounts)
- Cost trend chart (daily/weekly spend)
- Performance metrics (entries created, campaigns sent, etc.)
- Pause / resume / adjust budget controls

**CFO Dashboard (`/agents/cfo`):**
- Financial health score (green/yellow/red)
- Revenue vs cost chart (real-time)
- Cash flow projection (3-month forecast)
- Budget utilisation per agent (progress bars)
- Pending decisions (with manual override option)
- CFO decision log with reasoning

### 12.2 Admin Override

Admins can override CFO decisions:

```sql
-- Admin manually approves a denied request
UPDATE spend_authorisations
SET
  status = 'approved',
  approved_amount_usd = estimated_cost_usd,
  decided_by = 'admin',
  conditions = 'Admin override'
WHERE id = '<authorisation_id>';
```

Admins can also:
- Pause any agent
- Adjust agent budgets directly (overriding CFO allocation)
- Set the pre-revenue burn budget
- Define CFO rules (max cost ratio, reserve %, auto-approve threshold)
- Force the CFO to reprocess a decision

---

## 13. Implementation Order

---

# PART 4: SCOUT CONTROL PANEL

---

## Scout Control Panel (`/agents/location-scout`)

### Purpose

A visual interface for triggering, configuring, and monitoring Location Scout searches directly from the dashboard. No more curl commands — you select regions, activity types, and vacation styles from dropdowns and click "Run Scout."

### Layout

**Top: Scout Trigger Form (the main control)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔍 Run Location Scout                                              │
│                                                                      │
│  Region              Vacation Type         Activity Focus            │
│  ┌────────────────┐  ┌────────────────┐   ┌────────────────┐        │
│  │ Dolomites, IT ▾│  │ Active Holiday▾│   │ Cycling       ▾│        │
│  └────────────────┘  └────────────────┘   └────────────────┘        │
│                                                                      │
│  Content Types                    Max Results                        │
│  ☑ Routes  ☑ Accommodation       ┌────────────────┐                 │
│  ☑ Restaurants                   │ 10            ▾│                 │
│  ☐ Activities                    └────────────────┘                 │
│                                                                      │
│  Focus Keywords (optional)                                           │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │ gravel cycling, mountain passes, scenic routes           │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                                                      │
│  Estimated cost: ~€0.50        CFO budget remaining: €38.00          │
│                                                                      │
│  [ Run Scout ]                                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Dropdown Options

**Region** — Searchable dropdown with predefined popular regions + custom text input:

```
Predefined regions (grouped by geography):
── Western Europe ──
  Dolomites, Italy
  Amalfi Coast, Italy
  Tuscany, Italy
  Provence, France
  French Alps, France
  Swiss Alps, Switzerland
  Austrian Alps, Austria
  Algarve, Portugal
  Basque Country, Spain
  Mallorca, Spain
  Costa Brava, Spain
  Scottish Highlands, UK
  Lake District, UK
  Black Forest, Germany
── Scandinavia ──
  Norwegian Fjords, Norway
  Lofoten Islands, Norway
  Swedish Lapland, Sweden
── Eastern Europe ──
  Dalmatian Coast, Croatia
  Julian Alps, Slovenia
  Transylvania, Romania
── Mediterranean ──
  Crete, Greece
  Peloponnese, Greece
  Sardinia, Italy
  Corsica, France
── Other ──
  Canary Islands, Spain
  Madeira, Portugal
  Iceland (South Coast)
── Custom ──
  [Type custom region...]
```

**Vacation Type** — Maps to the `vacationType` field the scout function expects:

```
Active Holiday
Beach Holiday
City Break
Cultural / Heritage
Winter Sports
Road Trip
Nature / Wildlife
Food & Wine
Wellness / Retreat
Family Holiday
Adventure / Expedition
```

**Activity Focus** — Specific activity within the vacation type:

```
Cycling (Road)
Cycling (Gravel)
Cycling (Mountain Bike)
Hiking
Trail Running
Skiing
Snowboarding
Surfing
Kayaking / Canoeing
Climbing
Swimming
Sailing
Diving / Snorkelling
Horse Riding
Walking / Trekking
None (general)
```

**Content Types** — Checkboxes (multi-select):
- ☑ Routes
- ☑ Accommodation
- ☑ Restaurants
- ☐ Activities / Attractions

**Max Results** — Dropdown: 5, 10, 15, 20, 30, 50

### Run Behaviour

When you click "Run Scout":

1. Dashboard sends a POST to `/functions/v1/scout-locations` with the selected parameters
2. A loading state shows: "Scout is searching... This may take 60-90 seconds"
3. Progress updates appear as results stream in (if possible, otherwise show a spinner)
4. On completion, results appear in the "Latest Run" section below
5. The `agent_runs` table is updated with the run status

### Latest Run Results (below the form)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Latest Run: Dolomites, Italy — Cycling              ✅ Completed   │
│  Started: 2 minutes ago  •  Duration: 68s  •  Cost: €0.42          │
│                                                                      │
│  Found 12 locations  •  8 routes  •  3 accommodations  •  1 rest.   │
│                                                                      │
│  ┌─ Routes ──────────────────────────────────────────────────────┐  │
│  │ ★ 0.92  Passo Gardena Loop — 85km gravel, 2200m elevation    │  │
│  │         Sources: bikepacking.com, 2 Instagram posts           │  │
│  │         [ View ] [ Approve ] [ Reject ]                       │  │
│  │                                                                │  │
│  │ ★ 0.87  Sella Ronda Circuit — 138km road, 3800m elevation    │  │
│  │         Sources: cyclinguphill.com, roadcyclinguk.com          │  │
│  │         [ View ] [ Approve ] [ Reject ]                       │  │
│  │                                                                │  │
│  │ ★ 0.78  Val Gardena MTB Trails — 45km MTB, 1200m elevation   │  │
│  │         Sources: trailforks blog, singletracks.com             │  │
│  │         [ View ] [ Approve ] [ Reject ]                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ Accommodation ──────────────────────────────────────────────┐   │
│  │ ★ 0.85  Rifugio Puez — guesthouse, mid-range, bike-friendly │   │
│  │ ★ 0.79  Hotel Cir — hotel, mid-range, bike storage           │   │
│  │ ★ 0.71  Camping Sass Dlacia — campsite, budget               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [ Approve All (score ≥ 0.8) ]  [ View in Content Manager ]        │
└──────────────────────────────────────────────────────────────────────┘
```

Each result card shows:
- Scout score (★) with colour (green ≥ 0.8, yellow 0.5-0.8, red < 0.5)
- Name and key details
- Source count and source names
- Approve / Reject / View buttons
- "View" opens the full content entry detail in `/content/[id]`

**Bulk actions:**
- "Approve All (score ≥ 0.8)" — verifies all high-confidence entries at once
- "View in Content Manager" — opens `/content?source=agent&runId=xxx`

### Run History (below latest run)

Table of all past scout runs from `agent_runs`:

| Date | Region | Vacation Type | Status | Found | Approved | Cost | Duration |
|---|---|---|---|---|---|---|---|
| Today 15:42 | Dolomites, IT | Cycling | ✅ Completed | 12 | 8 | €0.42 | 68s |
| Yesterday | Algarve, PT | Surfing | ✅ Completed | 9 | 6 | €0.38 | 54s |
| Apr 26 | Algarve, PT | Beach | ❌ Failed | 0 | 0 | €0.00 | 1s |

Failed runs show the error message on hover/expand.

### Scheduled Runs (future — when pg_cron is set up)

A table showing any recurring scout schedules:

| Schedule | Region | Type | Frequency | Next Run | Status |
|---|---|---|---|---|---|
| Scout Dolomites | Dolomites | Cycling | Weekly Mon 3am | May 5 | 🟢 Active |
| Scout Algarve | Algarve | Surfing | Weekly Wed 3am | Apr 30 | 🟢 Active |

With "Add Schedule" button to create new recurring runs.

### Quick Scout Presets

Saved configurations for regions you scout frequently:

```
┌─ Quick Presets ──────────────────────────────────────────────────────┐
│                                                                      │
│  [ 🏔 Dolomites Cycling ]  [ 🏖 Algarve Surf ]  [ 🥾 Swiss Hiking ] │
│  [ 🚴 Mallorca Road ]  [ ❄️ Austrian Ski ]  [ + Add Preset ]        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Click a preset → auto-fills the form → click "Run Scout."

Presets stored in `platform_config` under key `scout_presets`:

```sql
INSERT INTO platform_config (key, value) VALUES
  ('scout_presets', '[
    {"name": "Dolomites Cycling", "icon": "🏔", "region": "Dolomites, Italy", "vacationType": "Active Holiday", "activityFocus": "Cycling (Road)", "contentTypes": ["route", "accommodation", "restaurant"], "maxResults": 15},
    {"name": "Algarve Surf", "icon": "🏖", "region": "Algarve, Portugal", "vacationType": "Beach Holiday", "activityFocus": "Surfing", "contentTypes": ["route", "accommodation", "restaurant"], "maxResults": 10},
    {"name": "Swiss Hiking", "icon": "🥾", "region": "Swiss Alps, Switzerland", "vacationType": "Active Holiday", "activityFocus": "Hiking", "contentTypes": ["route", "accommodation", "restaurant"], "maxResults": 15}
  ]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### Content Library Stats (sidebar or top)

Show the current state of the content library so you know where gaps are:

```
┌─ Content Library ────────────────────────────────────────────────────┐
│                                                                      │
│  Total verified entries: 10    Target: 1,000     ██░░░░░░░░ 1%      │
│                                                                      │
│  By region:                    By type:                              │
│  Dolomites: 10                 Routes: 6                             │
│  Algarve: 0                    Accommodation: 3                      │
│  Provence: 0                   Restaurants: 1                        │
│  Swiss Alps: 0                 Activities: 0                         │
│  (38 more with 0 entries)                                            │
│                                                                      │
│  🔴 Regions with no content: Algarve, Provence, Swiss Alps, +35     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

This helps you prioritise which regions to scout next.

---

# CLAUDE CODE PROMPT

Use this single prompt to build the complete dashboard:

```
Read /Users/alexandervoorham/Documents/Apps/TruthStay/Docs/complete-dashboard-spec.md.

This is the single definitive spec for the entire admin dashboard. Build it in this order:

STEP 1 — Create the 4 new tables (campaign_sends, social_posts, social_connections,
trip_invitations) and run the ALTER TABLE migration on email_campaigns to add the
new columns. All other tables already exist — do NOT recreate them.

STEP 2 — Apply the design system from Section 14 across all existing pages: teal
accent (#2DD4BF), 16px card radius (rounded-2xl), slate-50 backgrounds, Inter font
for headings, JetBrains Mono for financial figures. Apply the 6 specific Finance
page fixes from the "Current Implementation — Specific Fixes" at the top of Section 6.

STEP 3 — Build/refine the core modules:
  - Content Management (Section 3) — entries list, detail/edit, review queue
  - User Management (Section 4) — user list, detail, role management
  - Analytics (Section 5) — KPI overview, region breakdown, agent performance
  - Finance (Section 6) — redesigned with Origin-style cash flow chart, usage meters,
    tabbed layout (Revenue/Costs/Cash Flow/Forecasted Performance)

STEP 4 — Build the new modules:
  - Marketing (Part 2) — overview with daily action banner, campaigns with approval
    queue, social media calendar + automated posting, referrals + trip invitations
    tracking with viral metrics, growth funnel, agent activity log
  - Partners (Section 10) — partner list, detail, performance
  - Notifications (Section 11) — templates, send interface, announcements, history
  - Support (Section 12) — feedback triage, user reports, flagged content, contact log

STEP 5 — Build the Agent Operations module:
  - /agents — overview cards for all 4 agents (CFO, Scout, Marketing, Pricing)
  - /agents/cfo — CFO Command Centre with 5 tabs: Monthly Plan (approval flow),
    Weekly Scenarios (3-scenario comparison + selection), Infrastructure (usage meters),
    Forecasts (3-month projections), Spend Log (audit trail)
  - /agents/cfo/settings — editable CFO parameters
  - /agents/[id] — agent detail with message history, spend log, pause/resume

Follow the design system from Section 14 for all new pages. The sidebar grouping
(PLATFORM/INSIGHTS/GROWTH/OPERATIONS) is already correct — add Agent Operations
under OPERATIONS.
```
