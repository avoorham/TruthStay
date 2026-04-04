// ─── TruthStay Business Models & Marketing Strategies ───────────────────────
// This data is used by the finance agent system prompt.

export interface PricingTier {
  name: string;
  price_monthly_eur: number | null;
  price_annual_eur: number | null;
  features: string[];
}

export interface RevenueProjection {
  year: number;
  mau: number;
  paying_users: number;
  mrr_eur: number;
  arr_eur: number;
}

export interface BusinessModel {
  id: string;
  name: string;
  description: string;
  tiers?: PricingTier[];
  gross_margin_pct: number;
  feasibility: "HIGH" | "MEDIUM" | "LOW";
  feasibility_rationale: string;
  unit_economics: string[];
  projections?: RevenueProjection[];
  best_used_when: string;
  risks: string[];
}

export interface MarketingStrategy {
  id: string;
  name: string;
  monthly_budget_eur_min: number;
  monthly_budget_eur_max: number;
  channels: {
    platform: string;
    tactics: string[];
  }[];
  expected_monthly_signups_min: number;
  expected_monthly_signups_max: number;
  timeline_to_traction: string;
  best_for: string;
}

// ─── Business Models ──────────────────────────────────────────────────────────

export const BUSINESS_MODELS: BusinessModel[] = [
  {
    id: "model_a",
    name: "Freemium + AI Generation Paywall",
    description:
      "Free tier with limited AI adventure generation; Pro subscription unlocks unlimited AI, advanced filters, and offline access.",
    tiers: [
      {
        name: "Free",
        price_monthly_eur: 0,
        price_annual_eur: 0,
        features: [
          "3 AI-generated adventures per month",
          "Full social feed (follow, like, comment)",
          "Basic discovery and filtering",
          "Save up to 5 adventures",
          "Write reviews",
        ],
      },
      {
        name: "Pro",
        price_monthly_eur: 4.99,
        price_annual_eur: 44.99,
        features: [
          "Unlimited AI adventure generation",
          "Priority generation (no queue)",
          "Advanced discovery filters (difficulty, distance, rating)",
          "Unlimited saved adventures",
          "Offline access to saved adventures",
          "Early access to new features",
        ],
      },
    ],
    gross_margin_pct: 84,
    feasibility: "HIGH",
    feasibility_rationale:
      "Proven by Strava (€4.99/month), AllTrails Plus (€26.99/year), and Komoot Premium. Outdoor sports audience regularly pays for quality planning tools. 3–5% free-to-pro conversion is industry standard.",
    unit_economics: [
      "Anthropic API cost per Pro user: ~€0.85/month (12 adventures × ~€0.071 each with claude-opus-4-6)",
      "Pro gross margin: 83% (€4.99 - €0.85 = €4.14 per user per month)",
      "Annual plan gross margin: 87% (€44.99/year = €3.75/month, same AI cost base)",
      "Break-even: 1 Pro user covers ~6 Free users' API costs",
    ],
    projections: [
      { year: 1, mau: 2000, paying_users: 80, mrr_eur: 400, arr_eur: 4800 },
      { year: 2, mau: 15000, paying_users: 600, mrr_eur: 3000, arr_eur: 36000 },
      { year: 3, mau: 50000, paying_users: 2000, mrr_eur: 10000, arr_eur: 120000 },
    ],
    best_used_when:
      "Primary revenue model from Year 1. Launch as soon as you reach 500 active users — earlier adoption creates habit before paywalls feel restrictive.",
    risks: [
      "AI API costs scale with usage — monitor per-user cost carefully",
      "3 adventures/month free limit may be too restrictive for casual users",
      "Must implement generation counting in the backend before launch",
    ],
  },
  {
    id: "model_b",
    name: "Affiliate Commissions (Booking.com + TheFork)",
    description:
      "Free app that earns passive commission whenever users book accommodation or restaurants through TruthStay-embedded links.",
    gross_margin_pct: 92,
    feasibility: "MEDIUM",
    feasibility_rationale:
      "Zero marginal cost per booking, but revenue is negligible below 10k MAU. Best as a secondary stream layered on top of Model A. Booking.com affiliate config placeholder already exists in the codebase (NEXT_PUBLIC_BOOKING_AFFILIATE_ID env var).",
    unit_economics: [
      "Booking.com: ~4% commission on completed hotel stays (avg booking €130 → €5.20 commission)",
      "TheFork: €3–5 per seated booking referral",
      "If 10% of MAU books 1 stay/month: 5,000 bookings × €5.20 = €26,000/month at 50k MAU",
      "Realistic: 2–3% booking rate → €5,000–8,000/month at 50k MAU",
    ],
    projections: [
      { year: 1, mau: 2000, paying_users: 0, mrr_eur: 50, arr_eur: 600 },
      { year: 2, mau: 15000, paying_users: 0, mrr_eur: 600, arr_eur: 7200 },
      { year: 3, mau: 50000, paying_users: 0, mrr_eur: 3000, arr_eur: 36000 },
    ],
    best_used_when:
      "Enable immediately once Booking.com affiliate account is approved. Requires adding the affiliate ID to env vars and appending tracking parameters to accommodation links in the AI chat output.",
    risks: [
      "Cookie-based tracking is disrupted by iOS privacy changes — conversion attribution may be low",
      "Revenue is volume-dependent and unpredictable month-to-month",
      "Booking.com affiliate approval can take 2–4 weeks",
      "TheFork revenue share terms need direct negotiation",
    ],
  },
  {
    id: "model_c",
    name: "Verified Listings / Marketplace",
    description:
      "Accommodation providers, restaurants, and tour operators pay a monthly fee to be 'Verified on TruthStay', gaining a badge and priority placement in AI recommendations.",
    tiers: [
      {
        name: "Restaurant Verified",
        price_monthly_eur: 25,
        price_annual_eur: 240,
        features: [
          "Verified badge on TruthStay profile",
          "Priority in AI restaurant recommendations",
          "Respond to reviews",
          "Analytics dashboard (views, clicks)",
        ],
      },
      {
        name: "Accommodation Verified",
        price_monthly_eur: 39,
        price_annual_eur: 375,
        features: [
          "Verified badge on TruthStay profile",
          "Priority in AI accommodation suggestions",
          "Rich profile (photos, amenities, sport-friendly highlights)",
          "Respond to reviews",
          "Analytics dashboard",
        ],
      },
      {
        name: "Tour Operator / Guide",
        price_monthly_eur: 79,
        price_annual_eur: 759,
        features: [
          "Featured route listings",
          "Priority in AI adventure suggestions for guided trips",
          "Lead generation (user inquiry form)",
          "Verified operator badge",
          "Analytics dashboard",
        ],
      },
    ],
    gross_margin_pct: 88,
    feasibility: "MEDIUM",
    feasibility_rationale:
      "High margin but requires a sales motion (outreach to properties) and a large enough user base to make the listing valuable to operators. Typically viable once you have 5,000+ active users in a specific region. Start with free 'claimed listings' to build supply before charging.",
    unit_economics: [
      "Stripe processing fee: ~2.9% + €0.30 per transaction",
      "At 100 verified listings (mix of tiers): €3,900–7,900/month",
      "No per-unit variable cost — margin is ~88% after Stripe fees",
      "Sales cost: founder time only in early stage",
    ],
    projections: [
      { year: 1, mau: 2000, paying_users: 0, mrr_eur: 0, arr_eur: 0 },
      { year: 2, mau: 15000, paying_users: 20, mrr_eur: 780, arr_eur: 9360 },
      { year: 3, mau: 50000, paying_users: 100, mrr_eur: 3900, arr_eur: 46800 },
    ],
    best_used_when:
      "Launch after reaching 5,000 MAU and establishing presence in at least 2–3 specific regions (e.g., Dolomites cycling, Scottish Highland hiking). Begin with free claimed listings to populate the directory, then introduce paid verification.",
    risks: [
      "Requires Stripe integration (not yet built)",
      "Needs outbound sales effort — time-intensive for solo founder",
      "Operators may not pay until user base is large enough to generate real leads",
      "Need to build operator dashboard (analytics, review management)",
    ],
  },
  {
    id: "model_d_combined",
    name: "Recommended Combined Roadmap",
    description:
      "Phased approach combining all three models as the user base grows. Each phase adds a new revenue stream without removing the previous ones.",
    gross_margin_pct: 86,
    feasibility: "HIGH",
    feasibility_rationale:
      "Each model is independently viable and they compound well. Starting free removes friction for early growth, then monetizing progressively reduces churn risk vs. paywalling too early.",
    unit_economics: [
      "Phase 2 blended ARPU: €0.20–0.30/user/month (freemium + affiliate)",
      "Phase 3 blended ARPU: €0.40–0.80/user/month (all 3 streams)",
      "Target Year 3 blended gross margin: ~86%",
    ],
    projections: [
      { year: 1, mau: 2000, paying_users: 0, mrr_eur: 0, arr_eur: 0 },
      { year: 2, mau: 15000, paying_users: 620, mrr_eur: 3600, arr_eur: 43200 },
      { year: 3, mau: 50000, paying_users: 2100, mrr_eur: 13900, arr_eur: 166800 },
    ],
    best_used_when: "Always — this is the recommended execution path.",
    risks: [
      "Execution risk: each model requires separate engineering effort",
      "Phase transitions require careful communication to existing users",
    ],
  },
];

// ─── Marketing Strategies ─────────────────────────────────────────────────────

export const MARKETING_STRATEGIES: MarketingStrategy[] = [
  {
    id: "strategy_1",
    name: "Organic Content",
    monthly_budget_eur_min: 0,
    monthly_budget_eur_max: 200,
    channels: [
      {
        platform: "Instagram",
        tactics: [
          "Daily cycling/hiking content — route cards, elevation profiles, trip recaps",
          "Reels showing the AI planning flow (converts best)",
          "Post at 7am and 6pm local time",
          "Use hashtags: #bikepacking #cyclingholiday #hikingadventure #adventureplanning",
          "Stories: behind-the-scenes, user trip reposts (with permission)",
        ],
      },
      {
        platform: "YouTube",
        tactics: [
          "'Planning my X adventure with TruthStay' screen recording series",
          "Route reviews: 'Was the AI right about the Col de X?' videos",
          "High SEO value — people actively search 'cycling holiday planner' on YouTube",
          "Aim for 1 video per 2 weeks initially",
        ],
      },
      {
        platform: "Reddit",
        tactics: [
          "Active participation in r/cycling, r/bicycletouring, r/ultralight, r/hiking, r/thru_hiking, r/bikepacking",
          "Share genuine trip reports and mention TruthStay naturally when relevant",
          "Answer planning questions — never spam",
          "Post AI-generated itineraries and ask for community feedback",
        ],
      },
      {
        platform: "Strava",
        tactics: [
          "Create a TruthStay club — share routes generated by the app",
          "Comment on public activities in target regions",
          "Engage with cycling/hiking segment communities",
        ],
      },
    ],
    expected_monthly_signups_min: 20,
    expected_monthly_signups_max: 80,
    timeline_to_traction: "12–18 months to 1,000 users",
    best_for: "Phase 1 (0–500 users). Zero budget, founder-led, community trust building.",
  },
  {
    id: "strategy_2",
    name: "Micro-Influencer Partnerships",
    monthly_budget_eur_min: 500,
    monthly_budget_eur_max: 1500,
    channels: [
      {
        platform: "Instagram / YouTube",
        tactics: [
          "Target creators with 5k–100k followers in cycling, bikepacking, hiking niches",
          "Offer: free Pro account + €50–200/post or affiliate revenue share (10% of conversions)",
          "Brief: 'Plan your next adventure using TruthStay' — authentic content, not scripted ads",
          "Track performance via custom referral codes per creator",
        ],
      },
      {
        platform: "Komoot",
        tactics: [
          "Apply for Komoot Ambassador program — cross-promotion opportunity",
          "Komoot has 38M+ users with strong overlap with TruthStay's target audience",
        ],
      },
      {
        platform: "Publications",
        tactics: [
          "Pitch bikepacking.com, cyclingweekly.com, outdoormagazine.co.uk for editorial coverage",
          "Offer exclusive data: 'Most popular cycling regions in Europe according to TruthStay users'",
          "Guest blog posts on adventure travel sites",
        ],
      },
    ],
    expected_monthly_signups_min: 100,
    expected_monthly_signups_max: 400,
    timeline_to_traction: "6–9 months from launch to 5,000 users",
    best_for: "Phase 2 (500–5,000 users). Leverage social proof and niche authority.",
  },
  {
    id: "strategy_3",
    name: "Paid Acquisition",
    monthly_budget_eur_min: 2000,
    monthly_budget_eur_max: 5000,
    channels: [
      {
        platform: "Meta Ads (Facebook + Instagram)",
        tactics: [
          "Targeting: Strava users, cycling holidays, hiking, outdoor adventure interests",
          "Lookalike audiences from email list (upload once you have 500+ emails)",
          "Video creative: 30-second demo of planning an adventure in the app",
          "Target CAC: €8–15 for free user signup",
          "Retarget: users who visited but didn't sign up",
        ],
      },
      {
        platform: "Google Search Ads",
        tactics: [
          "Keywords: 'cycling holiday planner', 'hiking itinerary generator', 'bikepacking route planner', 'adventure trip planning app'",
          "High intent — these users are actively looking for the product",
          "Target CPC: €0.80–2.50 depending on keyword competitiveness",
          "Landing page: dedicated to the AI planning feature, not homepage",
        ],
      },
      {
        platform: "Apple Search Ads (once iOS app exists)",
        tactics: [
          "Target: Strava, AllTrails, Komoot users",
          "High conversion rate vs. other paid channels for app installs",
          "Target CPT (cost per tap): €0.50–1.50",
        ],
      },
    ],
    expected_monthly_signups_min: 400,
    expected_monthly_signups_max: 1200,
    timeline_to_traction: "3–6 months to 10,000 users (with budget)",
    best_for:
      "Phase 3 (5,000+ users). Scale what's already working organically. Don't run paid ads before product-market fit is confirmed.",
  },
];

// ─── Budget Scenarios ─────────────────────────────────────────────────────────

export const BUDGET_SCENARIOS = [
  {
    monthly_budget_eur: 0,
    strategy: "100% organic (Strategy 1)",
    expected_monthly_signups: "20–50",
    notes: "Founder time only. Sustainable but slow.",
  },
  {
    monthly_budget_eur: 500,
    strategy: "Organic + boosted posts + 1–2 micro-influencers",
    expected_monthly_signups: "80–200",
    notes: "Best ROI for early stage. Spend €200 on content tools (Canva Pro, scheduling), €300 on first influencer.",
  },
  {
    monthly_budget_eur: 2000,
    strategy: "Strategy 1 + Strategy 2 (scaled influencers)",
    expected_monthly_signups: "300–600",
    notes: "Ready for this once you have 1,000 users and early retention data.",
  },
  {
    monthly_budget_eur: 5000,
    strategy: "Strategy 1 + 2 + paid acquisition (Strategy 3)",
    expected_monthly_signups: "800–1,500",
    notes: "Only viable once Pro conversion is proven and CAC payback is understood.",
  },
];

// ─── Current App State (for agent context) ───────────────────────────────────

export const APP_STATE = {
  stage: "Internal Testing",
  users: 0,
  revenue: 0,
  monetization_implemented: false,
  platform: "Android (Google Play Internal Testing)",
  ios_status: "Not yet started",
  backend: "Deployed on Vercel (truthstay.com)",
  infrastructure_costs_monthly_eur: {
    supabase: 0, // free tier
    vercel: 0, // free tier (Hobby)
    anthropic_api: 0, // pay-as-you-go, ~€0 with 0 users
    upstash_redis: 0, // free tier
    openai_api: 0, // embeddings only, ~€0 with 0 users
    total: 0,
  },
  notes: [
    "Booking.com affiliate ID placeholder exists but is empty — needs affiliate account setup",
    "TheFork integration exists but is not fully production-ready",
    "Rate limiting is already in place (10 AI calls/hour) — good foundation for freemium gating",
    "No Stripe integration yet — required for Model A (Pro) and Model C (Verified Listings)",
    "No analytics tracking — install PostHog or Mixpanel before launching paid tiers",
  ],
};
