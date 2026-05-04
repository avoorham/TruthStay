# TruthStay Multi-Agent System — Architecture & Implementation Spec

## 1. Overview

### Vision

TruthStay operates a fleet of autonomous AI agents, each responsible for a specific domain of the business. At the top of this hierarchy sits the **CFO Agent**, a financial governor that ensures all agents operate within budget and the business grows healthily.

### The Agent Hierarchy

```
                         ┌──────────────────────┐
                         │      CFO Agent        │
                         │   (Financial Governor)│
                         │                       │
                         │  • Revenue tracking   │
                         │  • Cost management    │
                         │  • Cash flow          │
                         │  • Forecasting        │
                         │  • Budget allocation  │
                         │  • Spend approval     │
                         └──────────┬─────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
          ┌─────────┴────────┐ ┌───┴────────┐ ┌────┴──────────┐
          │  Marketing Agent │ │  Pricing   │ │ Location Scout│
          │                  │ │  Agent     │ │    Agent      │
          │ • Email campaigns│ │            │ │               │
          │ • Referral prog  │ │ • Dynamic  │ │ • Region scan │
          │ • Promo codes    │ │   pricing  │ │ • Blog search │
          │ • Growth tactics │ │ • Plan     │ │ • Dedup       │
          │ • Re-engagement  │ │   optim.   │ │ • Score       │
          └──────────────────┘ │ • Revenue  │ │ • Create      │
                               │   maxim.   │ │   listings    │
                               └────────────┘ └───────────────┘
```

### Core Principle: CFO Pulls Rank

No agent can spend money without the CFO's knowledge. Every agent that incurs costs (API calls, email sends, external API usage) must request a **spend authorisation** from the CFO Agent before executing. The CFO evaluates the request against:

1. **Current budget allocation** for that agent's domain
2. **Remaining monthly budget** across all categories
3. **Revenue vs cost trajectory** — are we trending profitable?
4. **Cash reserves** — can we absorb this spend?
5. **ROI estimate** — is this spend likely to generate returns?

If the CFO denies a request, the agent can:
- Scale down (e.g., scan 5 regions instead of 20)
- Defer to next budget cycle
- Request a budget increase (which triggers a CFO review)

---

## 2. Shared Infrastructure

### 2.1 Agent Communication: The Message Bus

All agents communicate through a shared `agent_messages` table. This is the backbone of inter-agent coordination.

```sql
CREATE TABLE agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent text NOT NULL
    CHECK (from_agent IN ('cfo', 'marketing', 'pricing', 'location_scout', 'system', 'admin')),
  to_agent text NOT NULL
    CHECK (to_agent IN ('cfo', 'marketing', 'pricing', 'location_scout', 'system', 'admin', 'all')),
  message_type text NOT NULL
    CHECK (message_type IN (
      'spend_request',        -- Agent asks CFO for budget approval
      'spend_approved',       -- CFO approves
      'spend_denied',         -- CFO denies with reason
      'spend_report',         -- Agent reports actual spend after execution
      'budget_alert',         -- CFO warns agent about budget status
      'budget_update',        -- CFO adjusts agent's budget
      'status_report',        -- Agent reports its activity
      'task_request',         -- One agent asks another to do something
      'task_complete',        -- Agent confirms task completion
      'directive',            -- CFO issues a directive to an agent
      'escalation'            -- Agent escalates an issue to CFO
    )),
  payload jsonb NOT NULL,
  priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'resolved', 'expired')),
  parent_message_id uuid,     -- for threading (e.g., response to a spend_request)
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_agent_messages_to ON agent_messages (to_agent, status, created_at DESC);
CREATE INDEX idx_agent_messages_type ON agent_messages (message_type, status);
CREATE INDEX idx_agent_messages_parent ON agent_messages (parent_message_id);
```

### 2.2 Agent Registry

Track all agents, their status, and current budget allocation:

```sql
CREATE TABLE agent_registry (
  id text PRIMARY KEY,                   -- e.g., 'cfo', 'marketing', 'pricing', 'location_scout'
  display_name text NOT NULL,
  description text,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'error', 'disabled')),
  -- Budget allocation (set by CFO)
  monthly_budget_usd numeric DEFAULT 0,
  budget_spent_this_month numeric DEFAULT 0,
  budget_reset_day int DEFAULT 1,        -- day of month budget resets
  -- Execution config
  schedule_cron text,                    -- e.g., '0 3 * * 1' for weekly Monday 3am
  max_concurrent_runs int DEFAULT 1,
  last_run_at timestamptz,
  last_run_status text,
  -- Metadata
  config jsonb DEFAULT '{}',             -- agent-specific configuration
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed the registry
INSERT INTO agent_registry (id, display_name, description, monthly_budget_usd) VALUES
  ('cfo', 'CFO Agent', 'Financial governor — manages budgets, forecasts, and approves spend across all agents', 10.00),
  ('location_scout', 'Location Scout Agent', 'Discovers and curates travel content from blogs and Instagram', 50.00),
  ('marketing', 'Marketing Agent', 'Manages email campaigns, referral programs, and growth tactics', 30.00),
  ('pricing', 'Pricing Agent', 'Optimises subscription pricing and promo strategies for revenue maximisation', 10.00);
```

### 2.3 Spend Authorisation Flow

This is the critical mechanism that gives the CFO control:

```
Agent wants to execute a task that costs money
  ↓
Agent creates a spend_request message to CFO
  {
    "action": "scan_10_regions",
    "estimated_cost_usd": 2.50,
    "cost_breakdown": { "anthropic_api": 2.00, "web_search": 0.50 },
    "justification": "10 new European cycling regions with no content",
    "expected_output": "~150 new content entries",
    "priority": "normal"
  }
  ↓
CFO Agent picks up the message (via scheduled run or trigger)
  ↓
CFO evaluates:
  - Agent's remaining monthly budget: $35 of $50
  - Overall platform burn rate: healthy
  - Expected ROI: 150 entries × avg user engagement value
  - Cash reserves: sufficient
  ↓
CFO responds with spend_approved or spend_denied
  {
    "approved": true,
    "approved_amount_usd": 2.50,
    "conditions": "Limit to 5 regions if API costs exceed estimate by 50%",
    "authorisation_id": "auth_xyz123"
  }
  ↓
Agent executes with authorisation_id
  ↓
Agent reports actual spend via spend_report
  {
    "authorisation_id": "auth_xyz123",
    "actual_cost_usd": 2.15,
    "results": { "entries_created": 142 }
  }
  ↓
CFO updates budget_spent_this_month for the agent
```

### 2.4 Spend Authorisation Table

```sql
CREATE TABLE spend_authorisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text REFERENCES agent_registry(id),
  request_message_id uuid REFERENCES agent_messages(id),
  response_message_id uuid REFERENCES agent_messages(id),
  -- Request details
  action text NOT NULL,
  estimated_cost_usd numeric NOT NULL,
  cost_breakdown jsonb,
  justification text,
  -- CFO decision
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'partially_approved', 'expired')),
  approved_amount_usd numeric,
  conditions text,
  denial_reason text,
  decided_at timestamptz,
  decided_by text DEFAULT 'cfo_agent',   -- 'cfo_agent' or 'admin' for manual override
  -- Execution tracking
  actual_cost_usd numeric,
  execution_status text DEFAULT 'not_started'
    CHECK (execution_status IN ('not_started', 'running', 'completed', 'failed', 'cancelled')),
  execution_results jsonb,
  completed_at timestamptz,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_spend_auth_agent ON spend_authorisations (agent_id, status);
CREATE INDEX idx_spend_auth_status ON spend_authorisations (status, created_at DESC);
```

---

## 3. CFO Agent

### 3.1 Responsibilities

The CFO Agent is the financial brain of TruthStay. It:

1. **Monitors revenue** — Tracks subscription income, booking commissions, and total revenue trends
2. **Controls costs** — Approves or denies spend requests from other agents
3. **Manages cash flow** — Ensures the platform never overspends relative to income
4. **Forecasts** — Projects revenue and costs 3-6 months ahead based on growth trends
5. **Allocates budgets** — Distributes monthly budgets across agents based on priorities and performance
6. **Alerts** — Warns when costs approach thresholds or revenue trends change

### 3.2 CFO Decision Logic

The CFO Agent uses Claude to make financial decisions. Its system prompt:

```
You are the CFO of TruthStay, a community-driven travel platform. Your role is
to ensure the business grows healthily by managing finances prudently.

CURRENT FINANCIAL STATE:
{financial_snapshot}

AGENT BUDGETS:
{agent_budgets}

REVENUE TREND:
{revenue_data}

COST TREND:
{cost_data}

SUBSCRIPTION PLANS:
{subscription_plans}

YOUR RULES:
1. Never approve spend that would push total monthly costs above 80% of
   monthly revenue. If we're pre-revenue, never exceed the monthly burn
   budget set by the admin.
2. Prioritise spend that directly drives user acquisition or retention.
3. Location Scout spend is an investment — approve generously when the
   content library is small (< 1000 entries), tighten as it grows.
4. Marketing spend should correlate with user growth targets.
5. Always leave a 20% budget reserve for unexpected costs.
6. If an agent consistently underspends, reallocate unused budget to
   higher-performing agents.
7. If revenue is declining, cut all non-essential spend immediately and
   issue directives to agents.
8. Log every decision with clear reasoning for admin review.

Given the spend request below, provide your decision as JSON:
{spend_request}

Respond with:
{
  "decision": "approved" | "denied" | "partially_approved",
  "approved_amount_usd": number | null,
  "reasoning": "explanation of your decision",
  "conditions": "any conditions on the approval" | null,
  "recommendations": "optional suggestions for the requesting agent",
  "risk_level": "low" | "medium" | "high",
  "budget_alert": true | false,
  "alert_message": "warning if budget is getting tight" | null
}
```

### 3.3 Financial Snapshot Builder

The CFO needs a real-time view of the business. This function builds the context:

```typescript
async function buildFinancialSnapshot(sql: ReturnType<typeof postgres>) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Current month revenue
  const [subscriptionRevenue] = await sql`
    SELECT COALESCE(SUM(
      CASE WHEN us.billing_period = 'monthly' THEN sp.price_monthly
           WHEN us.billing_period = 'yearly' THEN sp.price_yearly / 12
      END
    ), 0) as mrr
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.status = 'active'
  `;

  const [commissionRevenue] = await sql`
    SELECT COALESCE(SUM(commission_amount), 0) as total
    FROM booking_commissions
    WHERE status IN ('confirmed', 'paid')
      AND booked_at >= ${monthStart}
  `;

  // Current month costs
  const costs = await sql`
    SELECT service, COALESCE(SUM(cost_usd), 0) as total
    FROM api_cost_log
    WHERE created_at >= ${monthStart}
    GROUP BY service
  `;

  // Agent budgets
  const agents = await sql`
    SELECT id, display_name, monthly_budget_usd, budget_spent_this_month
    FROM agent_registry
    WHERE status = 'active'
  `;

  // Pending spend requests
  const pendingRequests = await sql`
    SELECT agent_id, COUNT(*) as count, SUM(estimated_cost_usd) as total_estimated
    FROM spend_authorisations
    WHERE status = 'pending'
    GROUP BY agent_id
  `;

  // User growth
  const [userCount] = await sql`SELECT COUNT(*) as total FROM users`;
  const [newUsersThisMonth] = await sql`
    SELECT COUNT(*) as total FROM users
    WHERE created_date >= ${monthStart}
  `;

  // Content library size
  const [contentCount] = await sql`
    SELECT COUNT(*) as total FROM content_entries WHERE verified = true
  `;

  return {
    revenue: {
      mrr: subscriptionRevenue.mrr,
      commissions_this_month: commissionRevenue.total,
      total_monthly_revenue: Number(subscriptionRevenue.mrr) + Number(commissionRevenue.total),
    },
    costs: {
      by_service: costs,
      total_this_month: costs.reduce((sum, c) => sum + Number(c.total), 0),
    },
    agents: agents.map(a => ({
      id: a.id,
      name: a.display_name,
      budget: Number(a.monthly_budget_usd),
      spent: Number(a.budget_spent_this_month),
      remaining: Number(a.monthly_budget_usd) - Number(a.budget_spent_this_month),
      utilisation: Number(a.budget_spent_this_month) / Number(a.monthly_budget_usd),
    })),
    pending_requests: pendingRequests,
    platform: {
      total_users: userCount.total,
      new_users_this_month: newUsersThisMonth.total,
      verified_content_entries: contentCount.total,
    },
    burn_rate: {
      monthly_revenue: Number(subscriptionRevenue.mrr) + Number(commissionRevenue.total),
      monthly_costs: costs.reduce((sum, c) => sum + Number(c.total), 0),
      net: (Number(subscriptionRevenue.mrr) + Number(commissionRevenue.total))
           - costs.reduce((sum, c) => sum + Number(c.total), 0),
    },
  };
}
```

### 3.4 CFO Edge Function

```typescript
// supabase/functions/cfo-agent/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

Deno.serve(async (req) => {
  const { action } = await req.json();

  switch (action) {
    case "process_spend_requests":
      return await processSpendRequests();
    case "monthly_review":
      return await monthlyBudgetReview();
    case "generate_forecast":
      return await generateForecast();
    case "reallocate_budgets":
      return await reallocateBudgets();
    default:
      return new Response("Unknown action", { status: 400 });
  }
});

async function processSpendRequests() {
  // 1. Get all pending spend requests
  const pending = await sql`
    SELECT sa.*, am.payload as request_payload
    FROM spend_authorisations sa
    JOIN agent_messages am ON am.id = sa.request_message_id
    WHERE sa.status = 'pending'
      AND sa.expires_at > NOW()
    ORDER BY
      CASE WHEN am.priority = 'critical' THEN 1
           WHEN am.priority = 'high' THEN 2
           WHEN am.priority = 'normal' THEN 3
           ELSE 4 END,
      sa.created_at ASC
  `;

  if (pending.length === 0) {
    return new Response(JSON.stringify({ message: "No pending requests" }));
  }

  // 2. Build financial context
  const snapshot = await buildFinancialSnapshot(sql);

  // 3. Process each request through Claude
  const results = [];
  for (const request of pending) {
    const decision = await getCFODecision(snapshot, request);
    
    // 4. Record the decision
    await sql`
      UPDATE spend_authorisations
      SET
        status = ${decision.decision},
        approved_amount_usd = ${decision.approved_amount_usd},
        conditions = ${decision.conditions},
        denial_reason = ${decision.decision === 'denied' ? decision.reasoning : null},
        decided_at = NOW()
      WHERE id = ${request.id}
    `;

    // 5. Send response message
    await sql`
      INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, status)
      VALUES (
        'cfo',
        ${request.agent_id},
        ${decision.decision === 'denied' ? 'spend_denied' : 'spend_approved'},
        ${JSON.stringify(decision)},
        'pending'
      )
    `;

    // 6. Update agent's spent budget if approved
    if (decision.decision === 'approved' || decision.decision === 'partially_approved') {
      await sql`
        UPDATE agent_registry
        SET budget_spent_this_month = budget_spent_this_month + ${decision.approved_amount_usd}
        WHERE id = ${request.agent_id}
      `;
    }

    // 7. Send budget alert if needed
    if (decision.budget_alert) {
      await sql`
        INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, priority)
        VALUES ('cfo', ${request.agent_id}, 'budget_alert',
          ${JSON.stringify({ message: decision.alert_message })}, 'high')
      `;
    }

    results.push({ requestId: request.id, decision: decision.decision });
  }

  // 8. Log CFO run cost
  const cfoCost = pending.length * 0.015; // Approximate cost per Claude call
  await sql`
    INSERT INTO api_cost_log (service, description, cost_usd)
    VALUES ('anthropic', 'CFO Agent - processed ${String(pending.length)} spend requests', ${cfoCost})
  `;

  return new Response(JSON.stringify({ processed: results.length, results }));
}

async function getCFODecision(snapshot: any, request: any) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: buildCFOSystemPrompt(snapshot),
    messages: [{
      role: "user",
      content: `Process this spend request:\n${JSON.stringify(request.request_payload, null, 2)}\n\nFrom agent: ${request.agent_id}\nEstimated cost: $${request.estimated_cost_usd}\nAgent's remaining budget: $${snapshot.agents.find(a => a.id === request.agent_id)?.remaining ?? 0}`
    }],
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch?.[0] ?? '{"decision": "denied", "reasoning": "Failed to parse CFO response"}');
}
```

### 3.5 CFO Scheduled Tasks

The CFO runs on multiple schedules:

| Schedule | Action | Description |
|---|---|---|
| Every 15 minutes | `process_spend_requests` | Check for and decide on pending spend requests |
| Daily at midnight | `daily_financial_summary` | Generate daily P&L and cost summary |
| Weekly (Monday 6am) | `weekly_review` | Analyse agent performance and ROI |
| Monthly (1st, 1am) | `monthly_review` | Full budget review, reallocate budgets, generate forecast |
| Monthly (1st, 2am) | `reset_budgets` | Reset `budget_spent_this_month` on all agents |

```sql
-- Schedule CFO tasks via pg_cron
SELECT cron.schedule('cfo-spend-check', '*/15 * * * *', $$
  SELECT net.http_post(
    url := '<project-url>/functions/v1/cfo-agent',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service-role-key>"}'::jsonb,
    body := '{"action":"process_spend_requests"}'::jsonb
  );
$$);

SELECT cron.schedule('cfo-monthly-reset', '0 2 1 * *', $$
  UPDATE agent_registry SET budget_spent_this_month = 0;
$$);
```

### 3.6 CFO Forecasting

The CFO generates 3-month rolling forecasts:

```sql
CREATE TABLE financial_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date date NOT NULL,           -- date this forecast was generated
  forecast_month date NOT NULL,          -- the month being forecasted
  -- Revenue projections
  projected_mrr numeric,
  projected_commissions numeric,
  projected_total_revenue numeric,
  -- Cost projections
  projected_api_costs numeric,
  projected_marketing_costs numeric,
  projected_infrastructure_costs numeric,
  projected_total_costs numeric,
  -- Derived
  projected_net numeric,
  -- Growth assumptions
  assumptions jsonb,
  -- Metadata
  confidence text DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now()
);
```

---

## 4. Marketing Agent

### 4.1 Responsibilities

The Marketing Agent drives user acquisition and retention:

1. **Email campaigns** — Identifies segments to target, drafts campaigns, schedules sends
2. **Referral programme** — Monitors referral performance, adjusts rewards
3. **Promo codes** — Creates time-limited promos for growth pushes
4. **Re-engagement** — Identifies churning users and triggers win-back campaigns
5. **Growth experiments** — Tests different acquisition strategies and reports results

### 4.2 How It Works With the CFO

Before any campaign that costs money:

```json
// Marketing Agent → CFO
{
  "from_agent": "marketing",
  "to_agent": "cfo",
  "message_type": "spend_request",
  "payload": {
    "action": "email_campaign_summer_launch",
    "estimated_cost_usd": 5.20,
    "cost_breakdown": {
      "anthropic_api": 0.20,
      "email_provider": 5.00
    },
    "justification": "Re-engage 500 inactive users with summer trip recommendations. Expected reactivation rate: 8-12% based on industry benchmarks.",
    "expected_output": "40-60 reactivated users",
    "estimated_roi": "If 10% convert to paid: $40-60 MRR increase",
    "priority": "normal"
  }
}
```

### 4.3 Marketing Agent Edge Function

```typescript
// supabase/functions/marketing-agent/index.ts

Deno.serve(async (req) => {
  const { action } = await req.json();

  switch (action) {
    case "identify_segments":
      return await identifyTargetSegments();
    case "plan_campaign":
      return await planCampaign();
    case "execute_campaign":
      return await executeCampaign();  // Only runs after CFO approval
    case "monitor_referrals":
      return await monitorReferralPerformance();
    case "churn_prevention":
      return await identifyChurningUsers();
    default:
      return new Response("Unknown action", { status: 400 });
  }
});

async function identifyChurningUsers() {
  // Find users who haven't logged in for 14+ days but were previously active
  const churning = await sql`
    SELECT u.id, u.full_name, u.email,
      MAX(ae.created_at) as last_active,
      COUNT(DISTINCT a.id) as adventure_count
    FROM users u
    LEFT JOIN analytics_events ae ON ae.user_id = u.id
    LEFT JOIN adventures a ON a.user_id = u.id
    WHERE u.status = 'active'
      AND (ae.created_at IS NULL OR ae.created_at < NOW() - interval '14 days')
      AND u.created_date < NOW() - interval '7 days'  -- Not brand new
    GROUP BY u.id
    HAVING COUNT(DISTINCT a.id) >= 1  -- They've engaged before
    LIMIT 100
  `;

  if (churning.length === 0) return new Response(JSON.stringify({ message: "No churning users found" }));

  // Request budget from CFO before sending re-engagement emails
  const estimatedCost = churning.length * 0.01 + 0.05; // email cost + API cost for personalisation

  await sql`
    INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, priority)
    VALUES ('marketing', 'cfo', 'spend_request', ${JSON.stringify({
      action: "churn_prevention_campaign",
      estimated_cost_usd: estimatedCost,
      cost_breakdown: { email_provider: churning.length * 0.01, anthropic_api: 0.05 },
      justification: `${churning.length} users at risk of churning. Re-engagement campaign targeting users inactive 14+ days who previously created adventures.`,
      expected_output: `${Math.round(churning.length * 0.1)} estimated reactivations`,
      priority: "high"
    })}, 'high')
  `;

  // Also insert the spend authorisation record
  // ... (the CFO will pick this up on its next run)

  return new Response(JSON.stringify({
    churning_users: churning.length,
    spend_request_sent: true,
    estimated_cost: estimatedCost
  }));
}
```

### 4.4 Marketing Agent Schedule

| Schedule | Action | Description |
|---|---|---|
| Daily (8am) | `churn_prevention` | Identify users at risk of churning |
| Weekly (Monday 9am) | `identify_segments` | Analyse user base for campaign opportunities |
| Weekly (Tuesday 10am) | `monitor_referrals` | Review referral programme performance |
| On-demand | `plan_campaign` | Plan a specific campaign (triggered by admin) |
| After CFO approval | `execute_campaign` | Execute an approved campaign |

---

## 5. Pricing Agent

### 5.1 Responsibilities

The Pricing Agent optimises TruthStay's monetisation:

1. **Subscription plan analysis** — Monitor conversion rates between free and paid tiers
2. **Price elasticity testing** — Recommend A/B tests on pricing
3. **Promo strategy** — Suggest optimal promo code values and durations
4. **Revenue maximisation** — Identify pricing sweet spots based on user behaviour
5. **Competitor monitoring** — Track competitor pricing changes

### 5.2 How It Works With the CFO

The Pricing Agent mostly advises rather than spends. Its main costs are API calls for analysis. But pricing changes have revenue implications, so the CFO must approve:

```json
// Pricing Agent → CFO
{
  "from_agent": "pricing",
  "to_agent": "cfo",
  "message_type": "spend_request",
  "payload": {
    "action": "pricing_analysis_q3",
    "estimated_cost_usd": 0.30,
    "cost_breakdown": { "anthropic_api": 0.30 },
    "justification": "Quarterly pricing review. Analysing conversion rates, churn by plan, and recommending adjustments.",
    "expected_output": "Pricing recommendation report with projected revenue impact"
  }
}
```

For actual price changes, the Pricing Agent sends a **directive request** to the CFO:

```json
// Pricing Agent → CFO
{
  "from_agent": "pricing",
  "to_agent": "cfo",
  "message_type": "escalation",
  "payload": {
    "type": "pricing_change_recommendation",
    "current": { "explorer_monthly": 9.99, "pro_monthly": 19.99 },
    "recommended": { "explorer_monthly": 12.99, "pro_monthly": 24.99 },
    "reasoning": "Conversion analysis shows price sensitivity threshold at €15 for Explorer. Current price leaves ~30% on the table. Recommended increase projected to reduce conversion by 5% but increase ARPU by 25%.",
    "projected_impact": {
      "mrr_change": "+18%",
      "subscriber_change": "-5%",
      "net_revenue_change": "+12%"
    },
    "requires_admin_approval": true
  }
}
```

The CFO reviews and either approves (forwarding to admin for final sign-off) or denies.

### 5.3 Pricing Agent Edge Function

```typescript
// supabase/functions/pricing-agent/index.ts

Deno.serve(async (req) => {
  const { action } = await req.json();

  switch (action) {
    case "analyse_conversion":
      return await analyseConversionRates();
    case "recommend_pricing":
      return await recommendPricingChanges();
    case "evaluate_promos":
      return await evaluatePromoPerformance();
    case "competitor_check":
      return await competitorPricingCheck();  // Uses web search
    default:
      return new Response("Unknown action", { status: 400 });
  }
});

async function analyseConversionRates() {
  // Analyse free → paid conversion, plan distribution, churn by plan
  const planStats = await sql`
    SELECT
      sp.name as plan_name,
      sp.price_monthly,
      COUNT(us.id) as active_subscribers,
      COUNT(us.id) FILTER (WHERE us.cancelled_at IS NOT NULL) as churned,
      AVG(EXTRACT(days FROM (COALESCE(us.cancelled_at, NOW()) - us.created_at))) as avg_lifetime_days
    FROM subscription_plans sp
    LEFT JOIN user_subscriptions us ON us.plan_id = sp.id
    GROUP BY sp.id, sp.name, sp.price_monthly
    ORDER BY sp.price_monthly
  `;

  const totalUsers = await sql`SELECT COUNT(*) as total FROM users`;
  const paidUsers = await sql`
    SELECT COUNT(DISTINCT user_id) as total
    FROM user_subscriptions WHERE status = 'active'
  `;

  // Request CFO approval for the API cost of running the analysis through Claude
  await requestCFOApproval('pricing', {
    action: 'conversion_analysis',
    estimated_cost_usd: 0.10,
    cost_breakdown: { anthropic_api: 0.10 },
    justification: 'Monthly conversion rate analysis',
    expected_output: 'Conversion report with recommendations'
  });

  return new Response(JSON.stringify({ planStats, totalUsers, paidUsers }));
}
```

### 5.4 Pricing Agent Schedule

| Schedule | Action | Description |
|---|---|---|
| Monthly (5th, 9am) | `analyse_conversion` | Analyse conversion and churn rates |
| Monthly (6th, 9am) | `recommend_pricing` | Generate pricing recommendations based on analysis |
| Weekly (Wednesday) | `evaluate_promos` | Review active promo code performance |
| Monthly (15th) | `competitor_check` | Web search for competitor pricing changes |

---

## 6. Location Scout Agent (Updated)

### 6.1 Integration With CFO

The Location Scout Agent (detailed in the separate scout-agent-spec.md) now operates under CFO governance. Before running a batch of region scans:

```json
// Location Scout → CFO
{
  "from_agent": "location_scout",
  "to_agent": "cfo",
  "message_type": "spend_request",
  "payload": {
    "action": "batch_region_scan",
    "regions": ["Dolomites, Italy", "Swiss Alps", "Algarve, Portugal"],
    "activity_types": ["cycling", "hiking", "surfing"],
    "estimated_cost_usd": 4.50,
    "cost_breakdown": {
      "anthropic_api": 3.00,
      "web_search": 1.50
    },
    "justification": "3 high-demand regions with < 10 content entries each. User search data shows these are the top requested regions with insufficient content.",
    "expected_output": "~45 new content entries across 3 regions",
    "content_library_size": 142,
    "priority": "normal"
  }
}
```

### 6.2 Updated Scout Function

The scout function now wraps execution in CFO approval:

```typescript
// Before executing, check for CFO approval
async function executeWithApproval(region: string, activityType: string) {
  // 1. Estimate cost
  const estimatedCost = estimateRunCost(region, activityType);

  // 2. Submit spend request
  const authId = await submitSpendRequest('location_scout', {
    action: `scan_${region}_${activityType}`,
    estimated_cost_usd: estimatedCost,
    justification: `Content gap: ${region} has low coverage for ${activityType}`,
  });

  // 3. Wait for CFO approval (poll or use Postgres NOTIFY)
  const approval = await waitForApproval(authId, { timeout_ms: 60000 });

  if (approval.status !== 'approved') {
    console.log(`CFO denied: ${approval.denial_reason}`);
    return { skipped: true, reason: approval.denial_reason };
  }

  // 4. Execute with the approved budget cap
  const result = await discoverLocations(region, activityType, {
    maxCost: approval.approved_amount_usd,
  });

  // 5. Report actual spend
  await reportSpend(authId, result.actualCost, result.summary);

  return result;
}
```

---

## 7. Monthly Budget Plan (Admin Approval Required)

### 7.1 Core Principle: You Set the Parameters

The CFO Agent does **not** operate autonomously. Every month, the CFO generates a proposed Monthly Budget Plan. You (or a super_admin) must review and approve it before the CFO or any other agent can spend. This is the single most important governance mechanism in the system.

### 7.2 Monthly Budget Plan Flow

```
25th of each month:
  ┌─────────────────────────────────────────────────────────┐
  │  CFO Agent runs "generate_monthly_plan"                 │
  │                                                         │
  │  Inputs:                                                │
  │  • Last month's actuals (revenue, costs, agent output)  │
  │  • Current content library size & growth rate            │
  │  • User growth trend                                    │
  │  • Subscription & commission revenue                    │
  │  • Growth targets from platform_config                  │
  │  • Last month's budget vs actual variance               │
  │                                                         │
  │  Outputs:                                               │
  │  • Proposed total budget for next month                  │
  │  • Per-agent budget allocation                           │
  │  • Revenue forecast                                     │
  │  • Key assumptions & risks                               │
  │  • Recommendations                                      │
  └────────────────────┬────────────────────────────────────┘
                       ↓
  Plan appears in Admin Dashboard → /agents/cfo/budget-plan
                       ↓
  You review, adjust line items if needed, add notes
                       ↓
  You click "Approve Plan" (or "Request Revision")
                       ↓
  Approved plan becomes the operating budget for the month
                       ↓
  CFO enforces these exact parameters until next approval
                       ↓
  ⚠️ If no approval by 3rd of month → ALL agents paused
```

### 7.3 Monthly Budget Plan Schema

```sql
CREATE TABLE monthly_budget_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Period
  plan_month date NOT NULL,              -- first day of the month (e.g., 2026-07-01)
  -- Status
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'revision_requested', 'approved', 'rejected')),
  -- Totals
  total_budget_usd numeric NOT NULL,
  total_revenue_forecast_usd numeric,
  projected_net_usd numeric,
  -- Per-agent allocation
  agent_budgets jsonb NOT NULL,
  -- Example:
  -- {
  --   "location_scout": { "budget_usd": 50, "priority": "high", "rationale": "..." },
  --   "marketing": { "budget_usd": 30, "priority": "medium", "rationale": "..." },
  --   "pricing": { "budget_usd": 10, "priority": "low", "rationale": "..." },
  --   "cfo": { "budget_usd": 10, "priority": "medium", "rationale": "..." },
  --   "reserve": { "budget_usd": 25, "priority": "critical", "rationale": "Emergency buffer" }
  -- }
  -- CFO analysis
  last_month_review jsonb,
  -- Example:
  -- {
  --   "total_budget": 100,
  --   "total_spent": 78.50,
  --   "variance_pct": -21.5,
  --   "revenue_actual": 450,
  --   "revenue_target": 500,
  --   "content_entries_added": 230,
  --   "new_users": 85,
  --   "agent_performance": {
  --     "location_scout": { "budget": 50, "spent": 42, "entries_created": 230, "cost_per_entry": 0.18 },
  --     "marketing": { "budget": 30, "spent": 22, "campaigns_sent": 4, "users_reactivated": 35 },
  --     "pricing": { "budget": 10, "spent": 3.50, "recommendations": 2 }
  --   }
  -- }
  revenue_forecast jsonb,
  -- Example:
  -- {
  --   "mrr_current": 450,
  --   "mrr_projected": 520,
  --   "commission_projected": 80,
  --   "total_projected": 600,
  --   "assumptions": ["10% subscriber growth", "2 new booking partners", "summer season uplift"]
  -- }
  risks_and_recommendations text,
  key_assumptions text,
  -- Approval
  approved_by uuid,
  approved_at timestamptz,
  admin_notes text,                      -- notes from the admin during review
  admin_adjustments jsonb,               -- any changes the admin made to the proposed plan
  -- Metadata
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_budget_plans_month ON monthly_budget_plans (plan_month);
CREATE INDEX idx_budget_plans_status ON monthly_budget_plans (status);
```

### 7.4 What the CFO Generates

The CFO Agent produces a comprehensive plan document. Here's what it looks like:

```json
{
  "plan_month": "2026-07-01",
  "total_budget_usd": 125.00,
  "total_revenue_forecast_usd": 600.00,
  "projected_net_usd": 475.00,

  "last_month_review": {
    "total_budget": 100.00,
    "total_spent": 78.50,
    "variance_pct": -21.5,
    "revenue_actual": 450.00,
    "highlights": [
      "Location Scout created 230 new entries at $0.18/entry — excellent efficiency",
      "Marketing reactivated 35 users from churn prevention campaigns",
      "Pricing agent recommended Explorer plan increase — pending your approval"
    ],
    "concerns": [
      "Marketing underspent by 27% — campaigns could be more aggressive",
      "Commission revenue below target — only 2 of 5 partner integrations live"
    ]
  },

  "agent_budgets": {
    "location_scout": {
      "budget_usd": 55.00,
      "change_from_last_month": "+5.00",
      "priority": "high",
      "rationale": "Content library at 750 entries, target is 1000 by launch. Increasing budget to accelerate coverage in Mediterranean and Scandinavian regions.",
      "planned_activities": [
        "Scan 15 new regions (cycling, hiking, surfing)",
        "Re-scan 5 existing regions for freshness",
        "Expected output: ~250 new entries"
      ]
    },
    "marketing": {
      "budget_usd": 35.00,
      "change_from_last_month": "+5.00",
      "priority": "medium",
      "rationale": "Increasing to support summer launch campaign. Last month's underspend was due to delayed email provider integration — now resolved.",
      "planned_activities": [
        "Summer launch email blast (all users)",
        "Weekly churn prevention campaigns",
        "Referral programme promotion",
        "2 region-specific campaigns (Dolomites, Algarve)"
      ]
    },
    "pricing": {
      "budget_usd": 10.00,
      "change_from_last_month": "0.00",
      "priority": "low",
      "rationale": "Stable. Monthly analysis + competitor check. Pending Explorer plan price change implementation.",
      "planned_activities": [
        "Monthly conversion analysis",
        "Implement approved Explorer plan price change",
        "Competitor pricing scan"
      ]
    },
    "cfo": {
      "budget_usd": 10.00,
      "change_from_last_month": "0.00",
      "priority": "medium",
      "rationale": "Self-governance costs. Spend request processing + monthly analysis."
    },
    "reserve": {
      "budget_usd": 15.00,
      "rationale": "12% reserve. Available for reallocation if agents need emergency budget."
    }
  },

  "revenue_forecast": {
    "mrr_current": 450.00,
    "mrr_projected": 520.00,
    "growth_assumption": "15% subscriber growth from summer campaign + organic",
    "commission_projected": 80.00,
    "commission_assumption": "2 new partners go live, avg 4 bookings/week",
    "total_projected": 600.00
  },

  "risks_and_recommendations": "Primary risk: partner integrations are behind schedule, which impacts commission revenue. Recommend allocating 1 admin day to partner onboarding. Secondary: if summer campaign underperforms, consider reallocating marketing budget to content (location scout) to build value for autumn.",

  "key_assumptions": "Summer travel season drives 15% uplift in signups. Email provider costs remain at $0.01/email. Anthropic API pricing stable. At least 2 of 3 pending booking partners go live by mid-July."
}
```

### 7.5 Admin Review Page (`/agents/cfo/budget-plan`)

The admin dashboard needs a dedicated budget plan review page:

**Header:**
- Plan month (e.g., "July 2026 Budget Plan")
- Status badge (Pending Approval / Approved / Revision Requested)
- Generated date

**Last Month Performance (read-only):**
- Budget vs actual spend (bar chart per agent)
- Revenue actual vs target
- Key highlights and concerns from CFO analysis

**Proposed Budget (editable):**
- Table with one row per agent
- Columns: Agent name, Last month budget, Last month actual, Proposed budget (editable), Priority, Rationale
- Total row at bottom
- Reserve line item
- Each agent row expandable to show planned activities

**Revenue Forecast (read-only with notes):**
- MRR current vs projected
- Commission current vs projected
- Assumptions listed
- Admin can add notes / challenge assumptions

**Risks & Recommendations (read-only):**
- CFO's risk assessment
- Recommendations

**Admin Actions:**
- **Adjust budgets** — Inline edit any agent's budget amount. Changes tracked in `admin_adjustments`
- **Add notes** — Free text field for admin commentary
- **Approve Plan** — Locks the plan, activates budgets for the month
- **Request Revision** — Sends the plan back to CFO with notes. CFO regenerates with adjustments
- **Reject Plan** — Blocks all agent spending for the month (emergency brake)

### 7.6 Approval Enforcement

Once approved, the plan parameters are written to `agent_registry`:

```sql
-- On plan approval, update agent budgets
CREATE OR REPLACE FUNCTION apply_approved_budget_plan(plan_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan monthly_budget_plans;
  v_agent_id text;
  v_budget jsonb;
BEGIN
  SELECT * INTO v_plan FROM monthly_budget_plans WHERE id = plan_id;

  IF v_plan.status != 'approved' THEN
    RAISE EXCEPTION 'Plan must be approved before applying';
  END IF;

  -- Reset all agent budgets
  FOR v_agent_id, v_budget IN
    SELECT key, value FROM jsonb_each(v_plan.agent_budgets)
    WHERE key != 'reserve'
  LOOP
    UPDATE agent_registry
    SET
      monthly_budget_usd = (v_budget->>'budget_usd')::numeric,
      budget_spent_this_month = 0,
      updated_at = NOW()
    WHERE id = v_agent_id;
  END LOOP;

  -- Store reserve in platform_config
  UPDATE platform_config
  SET value = jsonb_set(value, '{reserve_usd}',
    to_jsonb((v_plan.agent_budgets->'reserve'->>'budget_usd')::numeric)),
    updated_at = NOW()
  WHERE key = 'burn_budget';
END;
$$;
```

### 7.7 Safety Net: No Approval = No Spending

If you haven't approved a plan by the 3rd of the month, all agents pause automatically:

```sql
-- Scheduled check: pause agents if no approved plan
-- Runs daily at 6am via pg_cron
CREATE OR REPLACE FUNCTION check_budget_plan_approval()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_month date := date_trunc('month', CURRENT_DATE)::date;
  v_day int := EXTRACT(day FROM CURRENT_DATE);
  v_has_approved boolean;
BEGIN
  -- Only enforce after the 3rd
  IF v_day < 3 THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM monthly_budget_plans
    WHERE plan_month = v_current_month AND status = 'approved'
  ) INTO v_has_approved;

  IF NOT v_has_approved THEN
    -- Pause all agents except CFO (so it can still generate plans)
    UPDATE agent_registry
    SET status = 'paused'
    WHERE id != 'cfo' AND status = 'active';

    -- Send alert to admin
    INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, priority)
    VALUES ('system', 'admin', 'budget_alert', jsonb_build_object(
      'message', 'WARNING: No approved budget plan for ' || to_char(v_current_month, 'Month YYYY') || '. All agents have been paused. Please review and approve the pending plan at /agents/cfo/budget-plan.',
      'action_required', true
    ), 'critical');
  END IF;
END;
$$;

SELECT cron.schedule('check-budget-approval', '0 6 * * *', 'SELECT check_budget_plan_approval()');
```

### 7.8 Mid-Month Adjustments

You can adjust the approved plan mid-month without waiting for the next cycle:

- Go to `/agents/cfo/budget-plan` → click "Amend Current Plan"
- Edit agent budgets inline
- Add a reason for the amendment
- Click "Apply Amendment"

Amendments are tracked:

```sql
CREATE TABLE budget_plan_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES monthly_budget_plans(id),
  amendment_type text NOT NULL
    CHECK (amendment_type IN ('budget_increase', 'budget_decrease', 'reallocation', 'emergency_cut')),
  changes jsonb NOT NULL,
  -- Example: { "location_scout": { "old": 55, "new": 70 }, "marketing": { "old": 35, "new": 20 } }
  reason text NOT NULL,
  applied_by uuid,
  created_at timestamptz DEFAULT now()
);
```

### 7.9 CFO Plan Generation Function

```typescript
async function generateMonthlyPlan() {
  const snapshot = await buildFinancialSnapshot(sql);

  // Get last month's plan and actuals
  const lastMonthStart = new Date();
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  lastMonthStart.setDate(1);

  const [lastPlan] = await sql`
    SELECT * FROM monthly_budget_plans
    WHERE plan_month = ${lastMonthStart}
    ORDER BY created_at DESC LIMIT 1
  `;

  // Get agent performance data
  const agentPerformance = await sql`
    SELECT
      ar.id, ar.display_name, ar.monthly_budget_usd, ar.budget_spent_this_month,
      (SELECT COUNT(*) FROM content_entries ce
       WHERE (ce.data->>'agentRunId') IS NOT NULL
         AND ce.created_at >= ${lastMonthStart}) as entries_created,
      (SELECT COUNT(*) FROM spend_authorisations sa
       WHERE sa.agent_id = ar.id
         AND sa.status = 'approved'
         AND sa.created_at >= ${lastMonthStart}) as approved_requests,
      (SELECT COUNT(*) FROM spend_authorisations sa
       WHERE sa.agent_id = ar.id
         AND sa.status = 'denied'
         AND sa.created_at >= ${lastMonthStart}) as denied_requests
    FROM agent_registry ar
    WHERE ar.status IN ('active', 'paused')
  `;

  // Get growth targets
  const [growthTargets] = await sql`
    SELECT value FROM platform_config WHERE key = 'growth_targets'
  `;

  // Ask Claude to generate the plan
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are the CFO of TruthStay. Generate a Monthly Budget Plan for next month.
Your plan will be reviewed and approved by the company founder before taking effect.
Be thorough, data-driven, and transparent about assumptions and risks.
The founder values prudent spending and healthy growth over aggressive scaling.
Respond ONLY with a valid JSON object matching the monthly_budget_plans schema.`,
    messages: [{
      role: "user",
      content: `Generate the Monthly Budget Plan.

CURRENT FINANCIAL STATE:
${JSON.stringify(snapshot, null, 2)}

LAST MONTH'S PLAN & ACTUALS:
${JSON.stringify(lastPlan, null, 2)}

AGENT PERFORMANCE:
${JSON.stringify(agentPerformance, null, 2)}

GROWTH TARGETS:
${JSON.stringify(growthTargets, null, 2)}

Generate a complete budget plan with per-agent allocations, revenue forecast,
last month review, risks, and recommendations.`
    }],
  });

  const planText = response.content.find(b => b.type === "text")?.text ?? "";
  const plan = JSON.parse(planText.match(/\{[\s\S]*\}/)?.[0] ?? "{}");

  // Save the plan
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);

  await sql`
    INSERT INTO monthly_budget_plans (
      plan_month, status, total_budget_usd, total_revenue_forecast_usd,
      projected_net_usd, agent_budgets, last_month_review, revenue_forecast,
      risks_and_recommendations, key_assumptions
    ) VALUES (
      ${nextMonth}, 'pending_approval', ${plan.total_budget_usd},
      ${plan.total_revenue_forecast_usd}, ${plan.projected_net_usd},
      ${JSON.stringify(plan.agent_budgets)}, ${JSON.stringify(plan.last_month_review)},
      ${JSON.stringify(plan.revenue_forecast)}, ${plan.risks_and_recommendations},
      ${plan.key_assumptions}
    )
  `;

  // Notify admin
  await sql`
    INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, priority)
    VALUES ('cfo', 'admin', 'status_report', ${JSON.stringify({
      message: 'Monthly Budget Plan for ' + nextMonth.toISOString().slice(0, 7) + ' is ready for your review.',
      action_url: '/agents/cfo/budget-plan',
      action_required: true
    })}, 'high')
  `;

  return plan;
}
```

---

## 8. Full Cost Tracking (Including Infrastructure)

### 8.1 Complete Cost Picture

The CFO doesn't just track agent API costs — it tracks **every cost** the platform incurs. This gives you a true P&L view.

**Variable costs (agent-driven):**
- Anthropic API calls (all agents)
- Web search API calls (scout, pricing agents)
- Email provider sends (marketing agent)

**Fixed/semi-fixed infrastructure costs:**
- Supabase (database, auth, storage, edge functions, realtime)
- Vercel (hosting, bandwidth, serverless function invocations)
- Domain registration & DNS
- Apple Developer Program ($99/year)
- Google Play Developer ($25 one-time)
- Email service provider (Resend, SendGrid, etc.)
- Monitoring/error tracking (Sentry, etc.)
- Any other SaaS subscriptions

### 8.2 Infrastructure Cost Registry

```sql
CREATE TABLE infrastructure_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  -- e.g. 'supabase', 'vercel', 'domain', 'apple_developer', 'google_developer',
  --      'email_provider', 'monitoring', 'analytics', 'other'
  plan_name text,                        -- e.g. 'Supabase Pro', 'Vercel Pro'
  billing_cycle text DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time', 'usage_based')),
  cost_per_cycle numeric NOT NULL,       -- cost per billing period
  monthly_equivalent numeric NOT NULL,   -- normalised to monthly for budgeting
  next_billing_date date,
  auto_renew boolean DEFAULT true,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'trial', 'paused')),
  notes text,
  dashboard_url text,                    -- link to the service's billing page
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed with your current infrastructure
INSERT INTO infrastructure_costs (service, plan_name, billing_cycle, cost_per_cycle, monthly_equivalent, notes, dashboard_url) VALUES
  ('supabase', 'Pro', 'monthly', 25.00, 25.00, 'Database, Auth, Storage, Edge Functions', 'https://supabase.com/dashboard/org/ofakfjectvqziqstscme/billing'),
  ('vercel', 'Pro', 'monthly', 20.00, 20.00, 'Hosting, Serverless, Bandwidth', 'https://vercel.com/account/billing'),
  ('apple_developer', 'Apple Developer Program', 'yearly', 99.00, 8.25, 'Required for App Store', 'https://developer.apple.com/account'),
  ('google_developer', 'Google Play Console', 'one_time', 25.00, 0.00, 'One-time registration fee (already paid)', null),
  ('domain', 'truthstay.com', 'yearly', 15.00, 1.25, 'Domain registration', null),
  ('email_provider', 'Resend Free', 'monthly', 0.00, 0.00, 'Free tier: 3000 emails/month', 'https://resend.com/settings/billing');
```

### 8.3 Monthly Infrastructure Cost View

```sql
-- Total monthly infrastructure burn rate
CREATE OR REPLACE VIEW monthly_infrastructure_costs AS
SELECT
  SUM(monthly_equivalent) as total_monthly,
  jsonb_agg(jsonb_build_object(
    'service', service,
    'plan', plan_name,
    'monthly_cost', monthly_equivalent,
    'billing_cycle', billing_cycle,
    'next_billing', next_billing_date
  ) ORDER BY monthly_equivalent DESC) as breakdown
FROM infrastructure_costs
WHERE status = 'active';
```

The CFO now includes this in every financial snapshot and budget plan:

```
Total Monthly Costs = Infrastructure Costs + Agent Variable Costs
                    = (Supabase + Vercel + Domain + ...) + (API calls + emails + ...)
```

### 8.4 Infrastructure Cost Dashboard (`/finance/infrastructure`)

Add to the admin dashboard Finance module:

- Table of all active infrastructure subscriptions
- Monthly equivalent cost per service
- Total infrastructure burn rate
- Renewal calendar (upcoming billing dates highlighted)
- Add / edit / cancel subscriptions
- Usage tracking where available (Supabase usage, Vercel bandwidth)
- Alerts for upcoming renewals or plan limit warnings

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

Build the agents in this sequence:

1. **Shared infrastructure first** — `agent_messages`, `agent_registry`, `spend_authorisations`, `platform_config` tables
2. **CFO Agent** — The governor must exist before other agents can request budgets
3. **Location Scout Agent** (updated) — Already partially built, add CFO integration
4. **Marketing Agent** — Email campaigns + churn prevention
5. **Pricing Agent** — Lightweight, runs infrequently

### Deploy Order

```bash
# 1. Run migrations for shared tables
supabase migration new agent_system_tables

# 2. Deploy CFO agent
supabase functions deploy cfo-agent

# 3. Update existing scout agent with CFO integration
supabase functions deploy scout-locations

# 4. Deploy marketing agent
supabase functions deploy marketing-agent

# 5. Deploy pricing agent
supabase functions deploy pricing-agent

# 6. Set up cron schedules
# (via SQL in Supabase dashboard or migration)
```

---

## 14. Handing This to Claude Code

Drop this spec into your project (e.g., `docs/multi-agent-spec.md`) alongside the existing `docs/scout-agent-spec.md` and `docs/admin-dashboard-spec.md`, then tell Claude Code:

> "Read docs/multi-agent-spec.md. First, create the shared infrastructure tables
> (agent_messages, agent_registry, spend_authorisations, platform_config,
> monthly_budget_plans, budget_plan_amendments, weekly_scenarios,
> infrastructure_costs).
> Then implement the CFO Agent as a Supabase Edge Function at
> supabase/functions/cfo-agent/index.ts — including generate_monthly_plan,
> generate_weekly_scenarios, and the dual weekly+monthly budget enforcement.
> After that, update the existing scout-locations function to request CFO
> approval before executing. Then build the marketing-agent and pricing-agent
> functions. Set up pg_cron schedules for all agents, including the
> check_budget_plan_approval safety net and weekly budget resets.
> Reference docs/scout-agent-spec.md for the Location Scout details and
> docs/admin-dashboard-spec.md for the admin portal.
> Add the CFO Command Centre at /agents/cfo with tabs for monthly plan,
> weekly scenarios, infrastructure costs, forecasts, and spend log.
> Add the CFO settings page at /agents/cfo/settings for configurable
> parameters."

The three spec documents together give Claude Code the complete picture of TruthStay's agent system, from database schema to financial governance to admin visibility.
