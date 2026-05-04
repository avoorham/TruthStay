# Campaign Management + Planner — Claude Code Prompt

Paste this into Claude Code:

```
Read /Users/alexandervoorham/Documents/Apps/TruthStay/Docs/complete-dashboard-spec.md for context on the marketing module.

Build a Campaign Management page at /marketing/campaigns with THREE views: Kanban, Table, and Planner. The view toggle sits top-right: [ Table | Kanban | Planner ]

1. PAGE HEADER (shared across all views):
   - Title: "Campaigns"
   - "+ Create Campaign" button (teal, rounded-full, top right)
   - Search bar (left) + Filter button
   - Date range selector dropdown
   - View toggle: [ Table | Kanban | Planner ] pill buttons, active state has bg-slate-900 text-white

2. KANBAN VIEW — 5 status columns with drag-and-drop:

   Columns: Draft (grey) → Scheduled (blue) → Sending (amber) → Sent (green) → Cancelled (red)

   Each card shows:
   - Campaign name (bold)
   - Channel tags as pills: "Email" (blue), "Push" (purple)
   - Target segment + recipient count (e.g. "Cycling + France (84 users)")
   - 🤖 if agent-drafted, user avatar if manual
   - Date with calendar icon
   - For sent: "32% opened · 8% clicked" mini stats
   - For drafts: "⚡ Needs approval" teal badge

   Drag behaviour:
   - Draft → Scheduled = approve campaign (opens schedule date picker modal first)
   - Any → Cancelled = cancel campaign
   - Use @hello-pangea/dnd or dnd-kit

3. PLANNER VIEW — A weekly/monthly calendar scheduler with drag-and-drop:

   This is a visual timeline where you see all campaigns plotted on a calendar and can drag them to reschedule.

   Layout:
   ```
   ┌──────────────────────────────────────────────────────────────────┐
   │  ◀  Week of 28 April — 4 May 2026  ▶     [ Week | Month ]      │
   ├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
   │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │  Sun   │
   │  28    │  29    │  30    │  1     │  2     │  3     │  4     │
   ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
   │        │        │        │        │        │        │        │
   │ ┌────┐ │        │ ┌────┐ │        │ ┌────┐ │        │        │
   │ │ 📧 │ │        │ │ 📱 │ │        │ │ 📧 │ │        │        │
   │ │Churn│ │        │ │Push│ │        │ │Summ│ │        │        │
   │ │Prev.│ │        │ │Trip│ │        │ │er  │ │        │        │
   │ │9:00 │ │        │ │Rem.│ │        │ │Laun│ │        │        │
   │ └────┘ │        │ │8:00│ │        │ │10am│ │        │        │
   │        │        │ └────┘ │        │ └────┘ │        │        │
   │ ┌────┐ │        │        │ ┌────┐ │        │        │        │
   │ │ 📸 │ │        │        │ │ 📸 │ │        │        │        │
   │ │IG  │ │        │        │ │TT  │ │        │        │        │
   │ │Post │ │        │        │ │Post│ │        │        │        │
   │ │12pm │ │        │        │ │7pm │ │        │        │        │
   │ └────┘ │        │        │ └────┘ │        │        │        │
   └────────┴────────┴────────┴────────┴────────┴────────┴────────┘

   Unscheduled campaigns (drag onto calendar):
   ┌─────────────────────────────────────────────────────────────────┐
   │  📋 Unscheduled Drafts (3)                                      │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
   │  │ 📧 Cycling    │  │ 📱 Win-back  │  │ 📧 Algarve   │          │
   │  │ Provence      │  │ Inactive     │  │ Summer       │          │
   │  │ 84 users      │  │ 120 users    │  │ 56 users     │          │
   │  │ ⚡ Draft       │  │ ⚡ Draft      │  │ ⚡ Draft      │          │
   │  └──────────────┘  └──────────────┘  └──────────────┘          │
   └─────────────────────────────────────────────────────────────────┘
   ```

   Week view features:
   - 7 columns (Mon-Sun), each day showing all campaigns scheduled for that day
   - Campaign cards are colour-coded by channel: blue=email, purple=push, pink=social
   - Cards show: icon, campaign name (truncated), time, status indicator
   - DRAG AND DROP: drag a card from one day to another to reschedule
     → On drop: update email_campaigns SET scheduled_at = new_date WHERE id = ?
     → Show a confirmation toast: "Rescheduled to Wed 30 Apr at 9:00"
   - Drag from Unscheduled Drafts tray (bottom) onto a day to schedule a draft
     → On drop: opens a time picker, then sets status = 'scheduled', scheduled_at = selected datetime
     → This also approves the campaign (approval_status = 'approved')
   - Click a card to open campaign detail page
   - Navigate weeks with ◀ ▶ arrows
   - Today's column highlighted with teal left border

   Month view:
   - Standard calendar grid (like Google Calendar)
   - Each day cell shows small dots/indicators for scheduled campaigns
   - Click a day to zoom into that day's schedule
   - Drag campaigns between days to reschedule

   Unscheduled tray:
   - Sits below the calendar
   - Shows all campaigns with status = 'draft' and scheduled_at IS NULL
   - Cards are draggable onto the calendar
   - Collapsible with a toggle

   Social posts integration:
   - Also show social_posts on the calendar (from the social_posts table if it exists)
   - Social posts shown as smaller cards with platform icons (📸 IG, 🎵 TT, 🐦 X)
   - These are read-only on this view (managed in /marketing/social)

4. TABLE VIEW — Data table with columns:
   Name, Channel (badge), Segment, Recipients, Status (badge), Open Rate,
   Click Rate, Scheduled Date, Sent Date, Created By
   Sortable, filterable by status/channel/date.

5. CAMPAIGN DETAIL PAGE (/marketing/campaigns/[id]):
   - Header: campaign name, status badge, channel tags
   - If draft: "Approve & Schedule" / "Edit" / "Reject" buttons
   - If draft by agent: agent rationale in teal info box
   - KPI row: Recipients, Opened (%), Clicked (%), Converted (%), Unsubscribed (%)
   - Open rate over time chart (72 hours)
   - Email preview panel
   - Recipient table: user, status, opened at, clicked at

6. "+ CREATE CAMPAIGN" MODAL:
   - Campaign name, channel toggle (Email/Push/Both)
   - Subject line, push title/body
   - Email body (textarea or rich text)
   - Audience segment builder with dropdowns:
     Activity type, Region interest, Last active, Subscription plan
     Live recipient count
   - Schedule: date/time picker or "Save as Draft" (goes to unscheduled tray)
   - Buttons: "Save as Draft" / "Schedule"

7. DATA — Use existing email_campaigns table:
   Map status to Kanban columns: draft/scheduled/sending/sent/cancelled
   
   Drag actions:
   - Kanban: Draft → Scheduled = approve + open date picker
   - Planner: Unscheduled → Day = approve + set scheduled_at
   - Planner: Day → Day = update scheduled_at
   - Kanban/Planner: Any → Cancelled = set status cancelled

8. DESIGN — TruthStay design system:
   - Teal (#2DD4BF) for CTAs, "needs approval" badges, today indicator
   - rounded-2xl cards in Kanban, rounded-xl smaller cards in Planner
   - Channel colours: blue=email, purple=push, pink/rose=social
   - Kanban columns with light tinted backgrounds matching status colour
   - Planner: clean grid lines, today column highlighted, drop zones glow teal on drag-over
   - Unscheduled tray: slate-100 background, collapsible
   - View toggle: pill buttons matching app's Upcoming/Past style

9. SIDEBAR — Under Marketing:
   📣 Marketing
     ├─ Overview
     ├─ Campaigns  ← this page (Kanban + Table + Planner)
     ├─ Social
     ├─ Referrals
     ├─ Growth
     └─ Agent Activity
```
