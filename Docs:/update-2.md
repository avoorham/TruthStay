# Update 2 — Dashboard Visual Refresh (Supabase Light Style)

Paste this into Claude Code:

```
The admin dashboard at apps/admin needs a visual refresh. The target look is Supabase's
dashboard (light mode) — clean white backgrounds, generous spacing, subtle grey borders,
professional typography, and a calm, functional feel. NOT dark/heavy — light and airy.

Apply these changes across ALL pages in the admin dashboard:

1. OVERALL LAYOUT:
   - Page background: bg-white (not slate-50, not grey — pure white like Supabase)
   - Content area: max-w-7xl mx-auto px-8 py-6 (centered, not edge-to-edge)
   - No card shadows anywhere — use border border-slate-200 only (like Supabase)
   - Clean separation between sections with subtle borders, not shadows or background colours

2. SIDEBAR — Match Supabase's sidebar style:
   - Background: bg-slate-900 (keep the dark sidebar, it works)
   - BUT make the nav items more spacious: py-2 px-3 for each item
   - Section labels (PLATFORM, INSIGHTS, GROWTH, OPERATIONS): text-[11px] font-medium
     tracking-widest uppercase text-slate-500 mt-6 mb-2 px-3
   - Active item: bg-slate-800 text-white rounded-md with a 2px teal-400 left border
   - Inactive items: text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-md
   - Icons: w-4 h-4 mr-3 opacity-70 for inactive, opacity-100 for active
   - More spacing between section groups: mb-1 between items, mt-8 between sections
   - User info at top: smaller, more subtle — text-sm for name, text-xs text-slate-500 for email

3. PAGE HEADERS — Like Supabase's "TruthStay NANO" header:
   - Title: text-2xl font-normal (not bold — Supabase uses lighter weight headers)
   - Subtitle: text-sm text-slate-500 mt-1
   - Border-b border-slate-200 pb-6 mb-8 to separate from content
   - No background colour on headers — just clean white

4. TABLES — Like Supabase's Authentication users table:
   - Table wrapper: border border-slate-200 rounded-lg overflow-hidden (no shadow)
   - Header row: bg-slate-50 border-b border-slate-200
   - Header text: text-xs font-medium uppercase tracking-wider text-slate-500 px-4 py-3
   - Body cells: text-sm text-slate-700 px-4 py-3 border-b border-slate-100
   - Row hover: hover:bg-slate-50/50 transition
   - No alternating row colours — just subtle border-b between rows
   - Pagination at bottom: text-sm text-slate-500, matching Supabase's "Total: 3 users" style

5. BADGES AND PILLS:
   - Type badges (Route, Restaurant, Accommodation): bg-slate-100 text-slate-600
     rounded-full px-2.5 py-0.5 text-xs font-medium — subtle, not colourful
   - Status badges: use a small coloured dot (w-2 h-2 rounded-full) + text,
     not full coloured pills. Like Supabase's status indicators.
     Green dot = active/verified, amber dot = pending, red dot = error
   - Source badge "Agent": bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 text-xs

6. TRUST SCORE: Replace the current red bars with a simple percentage in text:
   - Score >= 0.7: text-green-600 font-mono text-sm
   - Score 0.3-0.7: text-amber-600 font-mono text-sm  
   - Score < 0.3: text-red-600 font-mono text-sm
   - Just the number, no bar, no pill — clean like Supabase's metric displays

7. BUTTONS — Like Supabase's "Add user" and "Connect" buttons:
   - Primary: bg-teal-500 hover:bg-teal-600 text-white rounded-md px-4 py-2 text-sm
     font-medium (not rounded-full — rounded-md like Supabase)
   - Secondary: bg-white border border-slate-200 hover:bg-slate-50 text-slate-700
     rounded-md px-4 py-2 text-sm font-medium
   - Subtle: text-slate-500 hover:text-slate-700 text-sm (no background, just text)

8. DROPDOWNS AND FILTERS — Like Supabase's "Email address" / "All columns" selectors:
   - bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700
   - Chevron icon on right: text-slate-400
   - Gap between filters: gap-3
   - Search inputs: same styling with a subtle search icon in slate-400

9. CARDS (for KPI cards, agent cards, etc.):
   - border border-slate-200 rounded-lg p-5 (NOT rounded-2xl — use rounded-lg like Supabase)
   - No shadow — just the border
   - Card title: text-xs font-medium uppercase tracking-wider text-slate-500 mb-1
   - Card value: text-2xl font-normal text-slate-900 (not bold)
   - Card subtitle: text-xs text-slate-400 mt-1

10. CHARTS:
    - Chart container: border border-slate-200 rounded-lg p-6
    - No background fill on the container
    - Chart colours: teal-500 as primary, slate-300 as secondary
    - Axis text: text-xs text-slate-400
    - Gridlines: stroke-slate-100 (very subtle)
    - No chart title inside the container — title goes above as a section header

11. EMPTY STATES — Like Supabase's clean empty states:
    - Centered in container: flex flex-col items-center justify-center py-20
    - Icon: text-slate-300 w-10 h-10 mb-3 (very subtle, not coloured)
    - Heading: text-sm font-medium text-slate-900 mb-1
    - Description: text-sm text-slate-500
    - No big illustrations — keep it minimal like Supabase

12. NAVIGATION BREADCRUMBS AND TABS:
    - Tabs: border-b border-slate-200, active tab has border-b-2 border-slate-900
      text-slate-900 font-medium, inactive tabs text-slate-500 hover:text-slate-700
    - Use slate-900 for active (not teal) — teal is for CTAs only
    - Tab padding: px-4 py-3 text-sm

13. SPECIFIC COLOUR RULES:
    - Teal-500 (#2DD4BF) is ONLY for: primary CTA buttons, active sidebar indicator,
      and interactive accent elements
    - Everything else uses the slate palette: slate-900 for headings, slate-700 for body,
      slate-500 for secondary text, slate-400 for muted, slate-200 for borders,
      slate-100 for subtle backgrounds, slate-50 for hover states
    - The result should feel professional and calm — like a tool built by Supabase or Vercel,
      not like a template with lots of colours

Apply ALL of these changes across every page: Content, Users, Analytics, Finance,
Marketing (Overview, Editorial, Campaigns, Social, Referrals, Growth, Agent Activity),
Partners, Agents (Overview, CFO, Location Scout, Marketing, Pricing),
Notifications, Support. Be thorough — every component should match this system.
```
