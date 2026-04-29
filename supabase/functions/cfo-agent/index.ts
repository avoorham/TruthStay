import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient>;

interface AgentBudget {
  id: string;
  display_name: string;
  monthly_budget_usd: number;
  budget_spent_this_month: number;
  weekly_budget_usd: number;
  weekly_spent: number;
  status: string;
}

interface FinancialSnapshot {
  revenue: {
    mrr: number;
    commissions_this_month: number;
    total_monthly_revenue: number;
  };
  costs: {
    by_service: { service: string; total: number }[];
    total_variable_this_month: number;
    total_infrastructure_monthly: number;
    total_this_month: number;
  };
  agents: {
    id: string;
    name: string;
    budget: number;
    spent: number;
    remaining: number;
    weekly_budget: number;
    weekly_spent: number;
    weekly_remaining: number;
    utilisation: number;
    status: string;
  }[];
  pending_requests: { agent_id: string; count: number; total_estimated: number }[];
  platform: {
    total_users: number;
    new_users_this_month: number;
    verified_content_entries: number;
  };
  burn_rate: {
    monthly_revenue: number;
    monthly_costs: number;
    net: number;
    cost_to_revenue_ratio: number;
  };
  snapshot_at: string;
}

interface CFODecision {
  decision: "approved" | "denied" | "partially_approved";
  approved_amount_usd: number | null;
  reasoning: string;
  conditions: string | null;
  recommendations: string | null;
  risk_level: "low" | "medium" | "high";
  budget_alert: boolean;
  alert_message: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const CFO_COST_PER_DECISION = 0.02; // approximate cost per Claude call

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  action: z.enum([
    "process_spend_requests",
    "generate_monthly_plan",
    "generate_weekly_scenarios",
    "reset_budgets",
  ]),
});

// ---------------------------------------------------------------------------
// Financial Snapshot Builder
// ---------------------------------------------------------------------------

async function buildFinancialSnapshot(db: SupabaseClient): Promise<FinancialSnapshot> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // MRR from active subscriptions
  const { data: subscriptions } = await db
    .from("user_subscriptions")
    .select("billing_period, subscription_plans(price_monthly, price_yearly)")
    .eq("status", "active");

  const mrr = (subscriptions ?? []).reduce((sum, s) => {
    const plan = s.subscription_plans as { price_monthly: number; price_yearly: number } | null;
    if (!plan) return sum;
    if (s.billing_period === "monthly") return sum + (plan.price_monthly ?? 0);
    if (s.billing_period === "yearly") return sum + (plan.price_yearly ?? 0) / 12;
    return sum + (plan.price_monthly ?? 0);
  }, 0);

  // Commissions this month
  const { data: commissions } = await db
    .from("booking_commissions")
    .select("commission_amount")
    .in("status", ["confirmed", "paid"])
    .gte("booked_at", monthStart);

  const commissionsThisMonth = (commissions ?? []).reduce(
    (sum, c) => sum + (c.commission_amount ?? 0),
    0,
  );

  // Variable API costs this month grouped by service
  const { data: apiCosts } = await db
    .from("api_cost_log")
    .select("service, cost_usd")
    .gte("created_at", monthStart);

  const costsByService: Record<string, number> = {};
  for (const row of apiCosts ?? []) {
    costsByService[row.service] = (costsByService[row.service] ?? 0) + (row.cost_usd ?? 0);
  }
  const costBreakdown = Object.entries(costsByService).map(([service, total]) => ({
    service,
    total,
  }));
  const totalVariable = costBreakdown.reduce((sum, c) => sum + c.total, 0);

  // Infrastructure monthly costs
  const { data: infra } = await db
    .from("infrastructure_costs")
    .select("monthly_equivalent")
    .eq("status", "active");

  const totalInfra = (infra ?? []).reduce(
    (sum, i) => sum + (i.monthly_equivalent ?? 0),
    0,
  );

  // Agent registry
  const { data: agents } = await db
    .from("agent_registry")
    .select(
      "id, display_name, monthly_budget_usd, budget_spent_this_month, weekly_budget_usd, weekly_spent, status",
    )
    .in("status", ["active", "paused"]);

  const agentData = (agents ?? []).map((a: AgentBudget) => ({
    id: a.id,
    name: a.display_name,
    budget: Number(a.monthly_budget_usd),
    spent: Number(a.budget_spent_this_month),
    remaining: Number(a.monthly_budget_usd) - Number(a.budget_spent_this_month),
    weekly_budget: Number(a.weekly_budget_usd),
    weekly_spent: Number(a.weekly_spent),
    weekly_remaining: Number(a.weekly_budget_usd) - Number(a.weekly_spent),
    utilisation:
      Number(a.monthly_budget_usd) > 0
        ? Number(a.budget_spent_this_month) / Number(a.monthly_budget_usd)
        : 0,
    status: a.status,
  }));

  // Pending spend requests
  const { data: pending } = await db
    .from("spend_authorisations")
    .select("agent_id, estimated_cost_usd")
    .eq("status", "pending");

  const pendingByAgent: Record<string, { count: number; total_estimated: number }> = {};
  for (const row of pending ?? []) {
    if (!pendingByAgent[row.agent_id]) {
      pendingByAgent[row.agent_id] = { count: 0, total_estimated: 0 };
    }
    pendingByAgent[row.agent_id].count++;
    pendingByAgent[row.agent_id].total_estimated += Number(row.estimated_cost_usd ?? 0);
  }
  const pendingRequests = Object.entries(pendingByAgent).map(([agent_id, v]) => ({
    agent_id,
    ...v,
  }));

  // Platform stats
  const { count: totalUsers } = await db
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: newUsersThisMonth } = await db
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_date", monthStart);

  const { count: verifiedContent } = await db
    .from("content_entries")
    .select("*", { count: "exact", head: true })
    .eq("verified", true);

  const totalRevenue = mrr + commissionsThisMonth;
  const totalCosts = totalVariable + totalInfra;

  return {
    revenue: {
      mrr,
      commissions_this_month: commissionsThisMonth,
      total_monthly_revenue: totalRevenue,
    },
    costs: {
      by_service: costBreakdown,
      total_variable_this_month: totalVariable,
      total_infrastructure_monthly: totalInfra,
      total_this_month: totalCosts,
    },
    agents: agentData,
    pending_requests: pendingRequests,
    platform: {
      total_users: totalUsers ?? 0,
      new_users_this_month: newUsersThisMonth ?? 0,
      verified_content_entries: verifiedContent ?? 0,
    },
    burn_rate: {
      monthly_revenue: totalRevenue,
      monthly_costs: totalCosts,
      net: totalRevenue - totalCosts,
      cost_to_revenue_ratio: totalRevenue > 0 ? totalCosts / totalRevenue : 999,
    },
    snapshot_at: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CFO System Prompt
// ---------------------------------------------------------------------------

function buildCFOSystemPrompt(snapshot: FinancialSnapshot): string {
  return `You are the CFO of TruthStay, a community-driven holiday planning platform in early growth stage. Your role is to ensure the business grows healthily by managing finances prudently.

CURRENT FINANCIAL STATE:
${JSON.stringify(snapshot, null, 2)}

YOUR RULES:
1. Never approve spend that would push total monthly costs above 80% of monthly revenue. If we are pre-revenue (MRR = 0), never exceed the monthly burn budget of $100 total (infrastructure included).
2. Prioritise spend that directly drives user acquisition or content library growth.
3. Location Scout spend is an investment — approve generously when the content library is small (< 1000 entries), tighten as it grows.
4. Marketing spend should correlate with user growth targets.
5. Always leave a 20% budget reserve for unexpected costs.
6. If an agent consistently underspends, consider reallocating unused budget to higher-performing agents.
7. If revenue is declining, cut all non-essential spend immediately.
8. Log every decision with clear reasoning for admin review.
9. Pre-revenue mode: total agent budget = $100/month minus infrastructure costs (~$54.50/month) = ~$45.50 available for agents.

Given the spend request, respond with ONLY a valid JSON object (no prose, no markdown):
{
  "decision": "approved" | "denied" | "partially_approved",
  "approved_amount_usd": number | null,
  "reasoning": "explanation of your decision",
  "conditions": "any conditions on the approval or null",
  "recommendations": "optional suggestions for the requesting agent or null",
  "risk_level": "low" | "medium" | "high",
  "budget_alert": true | false,
  "alert_message": "warning if budget is getting tight or null"
}`;
}

// ---------------------------------------------------------------------------
// Claude decision for a single spend request
// ---------------------------------------------------------------------------

async function getCFODecision(
  snapshot: FinancialSnapshot,
  request: {
    id: string;
    agent_id: string;
    estimated_cost_usd: number;
    action: string;
    justification: string | null;
    request_payload: Record<string, unknown>;
  },
  anthropic: Anthropic,
): Promise<CFODecision> {
  const agentBudget = snapshot.agents.find((a) => a.id === request.agent_id);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildCFOSystemPrompt(snapshot),
    messages: [
      {
        role: "user",
        content: `Process this spend request:

Agent: ${request.agent_id}
Action: ${request.action}
Estimated cost: $${Number(request.estimated_cost_usd).toFixed(4)}
Justification: ${request.justification ?? "None provided"}

Full request payload:
${JSON.stringify(request.request_payload, null, 2)}

Agent budget status:
- Monthly budget: $${agentBudget?.budget?.toFixed(2) ?? "unknown"}
- Spent this month: $${agentBudget?.spent?.toFixed(2) ?? "unknown"}
- Remaining: $${agentBudget?.remaining?.toFixed(2) ?? "unknown"}
- Weekly budget: $${agentBudget?.weekly_budget?.toFixed(2) ?? "unknown"}
- Weekly spent: $${agentBudget?.weekly_spent?.toFixed(2) ?? "unknown"}
- Weekly remaining: $${agentBudget?.weekly_remaining?.toFixed(2) ?? "unknown"}`,
      },
    ],
  });

  const text =
    (response.content as Array<{ type: string; text?: string }>)
      .find((b) => b.type === "text")?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      decision: "denied",
      approved_amount_usd: null,
      reasoning: "CFO failed to produce a valid JSON decision",
      conditions: null,
      recommendations: null,
      risk_level: "high",
      budget_alert: false,
      alert_message: null,
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as CFODecision;
  } catch {
    return {
      decision: "denied",
      approved_amount_usd: null,
      reasoning: "CFO response JSON could not be parsed",
      conditions: null,
      recommendations: null,
      risk_level: "high",
      budget_alert: false,
      alert_message: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Action: process_spend_requests
// ---------------------------------------------------------------------------

async function processSpendRequests(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  // 1. Load pending spend authorisations with message payloads
  const { data: pendingAuths, error: fetchErr } = await db
    .from("spend_authorisations")
    .select(
      "id, agent_id, estimated_cost_usd, action, justification, request_message_id, agent_messages!request_message_id(payload, priority)",
    )
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!pendingAuths || pendingAuths.length === 0) {
    return new Response(JSON.stringify({ message: "No pending requests", processed: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Sort by message priority (critical → high → normal → low)
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  pendingAuths.sort((a, b) => {
    const msgA = a.agent_messages as { priority?: string } | null;
    const msgB = b.agent_messages as { priority?: string } | null;
    const pa = priorityOrder[msgA?.priority ?? "normal"] ?? 2;
    const pb = priorityOrder[msgB?.priority ?? "normal"] ?? 2;
    return pa - pb;
  });

  // 2. Build financial snapshot once for the whole batch
  const snapshot = await buildFinancialSnapshot(db);

  // 3. Check if an approved monthly plan exists (dual budget gate §9.6)
  const currentMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString().slice(0, 10);

  const { data: approvedPlan } = await db
    .from("monthly_budget_plans")
    .select("id, total_budget_usd, agent_budgets")
    .eq("plan_month", currentMonthStart)
    .eq("status", "approved")
    .maybeSingle();

  // Load CFO rules
  const { data: cfgRow } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "cfo_rules")
    .maybeSingle();

  const rules = (cfgRow?.value ?? {}) as Record<string, number>;
  const autoApproveUnder = Number(rules.auto_approve_under_usd ?? 1.0);
  const lightweightUnder = Number(rules.lightweight_approve_under_usd ?? 5.0);

  // 4. Process each request
  const results: { requestId: string; decision: string; reasoning: string }[] = [];
  let cfoCallCount = 0;

  for (const auth of pendingAuths) {
    const estimatedCost = Number(auth.estimated_cost_usd ?? 0);
    const agentBudget = snapshot.agents.find((a) => a.id === auth.agent_id);
    const msgPayload =
      (auth.agent_messages as { payload?: Record<string, unknown> } | null)?.payload ?? {};

    let decision: CFODecision;

    // Gate 1: no approved monthly plan → deny
    if (!approvedPlan) {
      decision = {
        decision: "denied",
        approved_amount_usd: null,
        reasoning:
          "No approved monthly budget plan for this month. All agent spending is paused until admin approves the plan at /agents/cfo/budget-plan.",
        conditions: null,
        recommendations: "Wait for admin approval of the monthly budget plan.",
        risk_level: "high",
        budget_alert: true,
        alert_message: "No approved budget plan — all spend requests denied until plan is approved.",
      };
    } else if (agentBudget && estimatedCost > agentBudget.remaining) {
      // Gate 2: exceeds remaining monthly budget → deny
      decision = {
        decision: "denied",
        approved_amount_usd: null,
        reasoning: `Request of $${estimatedCost.toFixed(4)} exceeds agent ${auth.agent_id}'s remaining monthly budget of $${agentBudget.remaining.toFixed(2)}.`,
        conditions: null,
        recommendations: `Reduce scope or wait for next budget cycle. Remaining budget: $${agentBudget.remaining.toFixed(2)}.`,
        risk_level: "high",
        budget_alert: true,
        alert_message: `${auth.agent_id} has exhausted its monthly budget.`,
      };
    } else if (estimatedCost < autoApproveUnder) {
      // Gate 3: micro-request — auto-approve without Claude
      decision = {
        decision: "approved",
        approved_amount_usd: estimatedCost,
        reasoning: `Auto-approved: request is below the $${autoApproveUnder} auto-approve threshold.`,
        conditions: null,
        recommendations: null,
        risk_level: "low",
        budget_alert: false,
        alert_message: null,
      };
    } else if (estimatedCost < lightweightUnder && agentBudget) {
      // Gate 4: lightweight rule-based check
      const remainingOk = agentBudget.remaining >= estimatedCost;
      decision = remainingOk
        ? {
            decision: "approved",
            approved_amount_usd: estimatedCost,
            reasoning: `Lightweight approval: request is below $${lightweightUnder} and agent has sufficient budget ($${agentBudget.remaining.toFixed(2)} remaining).`,
            conditions: null,
            recommendations: null,
            risk_level: "low",
            budget_alert: agentBudget.utilisation > 0.8,
            alert_message:
              agentBudget.utilisation > 0.8
                ? `${auth.agent_id} has used ${(agentBudget.utilisation * 100).toFixed(0)}% of monthly budget.`
                : null,
          }
        : {
            decision: "denied",
            approved_amount_usd: null,
            reasoning: `Insufficient budget: $${agentBudget.remaining.toFixed(2)} remaining, $${estimatedCost.toFixed(4)} requested.`,
            conditions: null,
            recommendations: null,
            risk_level: "medium",
            budget_alert: true,
            alert_message: `${auth.agent_id} is near budget limit.`,
          };
    } else {
      // Gate 5: full Claude analysis for requests ≥ $5
      decision = await getCFODecision(
        snapshot,
        {
          id: auth.id,
          agent_id: auth.agent_id,
          estimated_cost_usd: estimatedCost,
          action: auth.action,
          justification: auth.justification,
          request_payload: msgPayload,
        },
        anthropic,
      );
      cfoCallCount++;
    }

    // 5. Record the decision
    const messageType =
      decision.decision === "denied" ? "spend_denied" : "spend_approved";

    const { data: responseMsg } = await db
      .from("agent_messages")
      .insert({
        from_agent: "cfo",
        to_agent: auth.agent_id,
        message_type: messageType,
        payload: decision,
        priority: decision.budget_alert ? "high" : "normal",
        status: "pending",
      })
      .select("id")
      .single();

    await db
      .from("spend_authorisations")
      .update({
        status: decision.decision,
        approved_amount_usd: decision.approved_amount_usd,
        conditions: decision.conditions,
        denial_reason: decision.decision === "denied" ? decision.reasoning : null,
        response_message_id: responseMsg?.id ?? null,
        decided_at: new Date().toISOString(),
        decided_by: "cfo_agent",
      })
      .eq("id", auth.id);

    // Update agent's spent budget if approved
    if (
      (decision.decision === "approved" || decision.decision === "partially_approved") &&
      decision.approved_amount_usd != null
    ) {
      await db
        .from("agent_registry")
        .update({
          budget_spent_this_month: (agentBudget?.spent ?? 0) + decision.approved_amount_usd,
          weekly_spent:
            (agentBudget?.weekly_spent ?? 0) + decision.approved_amount_usd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.agent_id);
    }

    // Budget alert message
    if (decision.budget_alert && decision.alert_message) {
      await db.from("agent_messages").insert({
        from_agent: "cfo",
        to_agent: auth.agent_id,
        message_type: "budget_alert",
        payload: { message: decision.alert_message },
        priority: "high",
        status: "pending",
      });
    }

    // Mark original request message as resolved
    if (auth.request_message_id) {
      await db
        .from("agent_messages")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", auth.request_message_id);
    }

    results.push({
      requestId: auth.id,
      decision: decision.decision,
      reasoning: decision.reasoning,
    });

    // Refresh agent snapshot for the next request in this batch
    if (agentBudget && decision.approved_amount_usd != null) {
      agentBudget.spent += decision.approved_amount_usd;
      agentBudget.remaining -= decision.approved_amount_usd;
      agentBudget.weekly_spent += decision.approved_amount_usd;
      agentBudget.weekly_remaining -= decision.approved_amount_usd;
    }
  }

  // 6. Log CFO's own cost
  if (cfoCallCount > 0) {
    const cfoCost = parseFloat((cfoCallCount * CFO_COST_PER_DECISION).toFixed(4));
    await db.from("api_cost_log").insert({
      service: "anthropic",
      description: `CFO Agent — processed ${cfoCallCount} spend request(s) via Claude`,
      cost_usd: cfoCost,
    });
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: generate_monthly_plan
// ---------------------------------------------------------------------------

async function generateMonthlyPlan(db: SupabaseClient, anthropic: Anthropic): Promise<Response> {
  const snapshot = await buildFinancialSnapshot(db);

  // Last month's plan and actuals
  const lastMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth() - 1,
    1,
  ).toISOString().slice(0, 10);

  const { data: lastPlan } = await db
    .from("monthly_budget_plans")
    .select("*")
    .eq("plan_month", lastMonthStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Agent performance this month
  const thisMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data: agentRuns } = await db
    .from("agent_runs")
    .select("activity_type, routes_found, accommodations_found, restaurants_found, status")
    .gte("started_at", thisMonthStart);

  const { data: spendApproved } = await db
    .from("spend_authorisations")
    .select("agent_id, actual_cost_usd, execution_status")
    .in("status", ["approved", "partially_approved"])
    .gte("created_at", thisMonthStart);

  const { data: spendDenied } = await db
    .from("spend_authorisations")
    .select("agent_id")
    .eq("status", "denied")
    .gte("created_at", thisMonthStart);

  const agentPerformance = snapshot.agents.map((a) => {
    const approved = (spendApproved ?? []).filter((s) => s.agent_id === a.id);
    const denied = (spendDenied ?? []).filter((s) => s.agent_id === a.id);
    return {
      id: a.id,
      name: a.name,
      monthly_budget_usd: a.budget,
      budget_spent_this_month: a.spent,
      budget_remaining: a.remaining,
      approved_requests: approved.length,
      denied_requests: denied.length,
      total_actual_spend: approved.reduce((s, r) => s + Number(r.actual_cost_usd ?? 0), 0),
    };
  });

  // Content entries created via agent runs
  const totalEntriesThisMonth =
    (agentRuns ?? []).reduce(
      (sum, r) =>
        sum +
        (r.routes_found ?? 0) +
        (r.accommodations_found ?? 0) +
        (r.restaurants_found ?? 0),
      0,
    );

  // Growth targets from platform_config
  const { data: growthCfg } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "growth_targets")
    .maybeSingle();

  const { data: cfoRules } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "cfo_rules")
    .maybeSingle();

  const nextMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    1,
  );

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are the CFO of TruthStay, a community-driven holiday planning platform in early growth stage.
Generate a Monthly Budget Plan for ${nextMonthStart.toLocaleString("en-GB", { month: "long", year: "numeric" })}.
Your plan will be reviewed and approved by the company founder before taking effect.
Be data-driven, thorough, and transparent about assumptions and risks.
The founder values prudent spending and healthy growth over aggressive scaling.
Pre-revenue mode is in effect: total monthly budget ceiling = $100 (including infrastructure ~$54.50/month).
Respond ONLY with a valid JSON object — no prose, no markdown fences, just the raw JSON.`,
    messages: [
      {
        role: "user",
        content: `Generate the Monthly Budget Plan.

CURRENT FINANCIAL STATE:
${JSON.stringify(snapshot, null, 2)}

LAST MONTH'S PLAN & ACTUALS:
${JSON.stringify(lastPlan ?? "No previous plan", null, 2)}

AGENT PERFORMANCE THIS MONTH:
${JSON.stringify(agentPerformance, null, 2)}

CONTENT ENTRIES CREATED THIS MONTH: ${totalEntriesThisMonth}

GROWTH TARGETS:
${JSON.stringify(growthCfg?.value ?? {}, null, 2)}

CFO RULES:
${JSON.stringify(cfoRules?.value ?? {}, null, 2)}

Generate a complete budget plan with structure:
{
  "total_budget_usd": number,
  "total_revenue_forecast_usd": number,
  "projected_net_usd": number,
  "agent_budgets": {
    "<agent_id>": {
      "budget_usd": number,
      "change_from_last_month": string,
      "priority": "low"|"medium"|"high"|"critical",
      "rationale": string,
      "planned_activities": string[]
    },
    "reserve": { "budget_usd": number, "rationale": string }
  },
  "last_month_review": {
    "total_budget": number,
    "total_spent": number,
    "variance_pct": number,
    "revenue_actual": number,
    "highlights": string[],
    "concerns": string[]
  },
  "revenue_forecast": {
    "mrr_current": number,
    "mrr_projected": number,
    "growth_assumption": string,
    "commission_projected": number,
    "total_projected": number
  },
  "risks_and_recommendations": string,
  "key_assumptions": string
}`,
      },
    ],
  });

  const planText =
    (response.content as Array<{ type: string; text?: string }>)
      .find((b) => b.type === "text")?.text ?? "";

  const jsonMatch = planText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return new Response(JSON.stringify({ error: "CFO failed to generate a valid plan JSON" }), {
      status: 500,
    });
  }

  let plan: Record<string, unknown>;
  try {
    plan = JSON.parse(jsonMatch[0]);
  } catch {
    return new Response(JSON.stringify({ error: "CFO plan JSON could not be parsed" }), {
      status: 500,
    });
  }

  const { error: insertErr } = await db.from("monthly_budget_plans").upsert(
    {
      plan_month: nextMonthStart.toISOString().slice(0, 10),
      status: "pending_approval",
      total_budget_usd: plan.total_budget_usd,
      total_revenue_forecast_usd: plan.total_revenue_forecast_usd,
      projected_net_usd: plan.projected_net_usd,
      agent_budgets: plan.agent_budgets ?? {},
      last_month_review: plan.last_month_review ?? null,
      revenue_forecast: plan.revenue_forecast ?? null,
      risks_and_recommendations: plan.risks_and_recommendations ?? null,
      key_assumptions: plan.key_assumptions ?? null,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "plan_month" },
  );

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
  }

  await db.from("agent_messages").insert({
    from_agent: "cfo",
    to_agent: "admin",
    message_type: "status_report",
    payload: {
      message: `Monthly Budget Plan for ${nextMonthStart.toLocaleString("en-GB", { month: "long", year: "numeric" })} is ready for your review.`,
      action_url: "/agents/cfo/budget-plan",
      action_required: true,
    },
    priority: "high",
    status: "pending",
  });

  const cfoCost = parseFloat(CFO_COST_PER_DECISION.toFixed(4));
  await db.from("api_cost_log").insert({
    service: "anthropic",
    description: `CFO Agent — generated monthly budget plan for ${nextMonthStart.toISOString().slice(0, 7)}`,
    cost_usd: cfoCost,
  });

  return new Response(JSON.stringify({ plan }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Action: generate_weekly_scenarios
// ---------------------------------------------------------------------------

async function generateWeeklyScenarios(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const snapshot = await buildFinancialSnapshot(db);

  // Infrastructure costs
  const { data: infraView } = await db
    .from("infrastructure_costs")
    .select("monthly_equivalent")
    .eq("status", "active");

  const totalInfra = (infraView ?? []).reduce(
    (sum, i) => sum + Number(i.monthly_equivalent ?? 0),
    0,
  );

  // Approved monthly plan for current month
  const currentMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString().slice(0, 10);

  const { data: monthlyPlan } = await db
    .from("monthly_budget_plans")
    .select("*")
    .eq("plan_month", currentMonthStart)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!monthlyPlan) {
    return new Response(
      JSON.stringify({
        error: "No approved monthly plan — cannot generate weekly scenarios",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Last week's spend
  const lastWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: lastWeekSpend } = await db
    .from("spend_authorisations")
    .select("agent_id, actual_cost_usd")
    .in("status", ["approved", "partially_approved"])
    .gte("completed_at", lastWeekStart);

  const lastWeekByAgent: Record<string, number> = {};
  for (const row of lastWeekSpend ?? []) {
    lastWeekByAgent[row.agent_id] =
      (lastWeekByAgent[row.agent_id] ?? 0) + Number(row.actual_cost_usd ?? 0);
  }

  const monthBudgetSpent = snapshot.agents.reduce((sum, a) => sum + a.spent, 0);
  const monthBudgetRemaining =
    Number(monthlyPlan.total_budget_usd) - monthBudgetSpent;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();
  const weekNumber = Math.ceil(now.getDate() / 7);

  // Calculate next Monday
  const nextMonday = new Date(now);
  const daysUntilMonday = ((1 + 7 - now.getDay()) % 7) || 7;
  nextMonday.setDate(now.getDate() + daysUntilMonday);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are the CFO of TruthStay, a community-driven holiday planning platform in early growth stage.
Generate three weekly spending scenarios for the week starting ${nextMonday.toISOString().slice(0, 10)}.
Each scenario must stay within the remaining monthly budget of $${monthBudgetRemaining.toFixed(2)}.
Infrastructure costs of $${totalInfra.toFixed(2)}/month are fixed overhead.
Be specific about what each agent will do, projected outcomes, and risk levels.
Respond ONLY with a valid JSON object — no prose, no markdown fences:
{
  "optimistic": { ... },
  "base": { ... },
  "conservative": { ... },
  "performance_summary": string,
  "risk_assessment": string
}
Each scenario object must match this shape:
{
  "label": string,
  "total_weekly_spend": number,
  "agent_limits": {
    "<agent_id>": {
      "weekly_budget": number,
      "planned_runs"?: number,
      "planned_campaigns"?: number,
      "planned_actions"?: string[],
      "target_entries"?: number,
      "rationale": string
    }
  },
  "projected_outcomes": { "new_content_entries"?: number, "email_campaigns_sent"?: number, "projected_new_signups"?: number },
  "risk_level": "low"|"medium"|"high",
  "risk_note": string,
  "conditions"?: string
}`,
    messages: [
      {
        role: "user",
        content: `Generate weekly scenarios.

FINANCIAL STATE: ${JSON.stringify(snapshot, null, 2)}
MONTHLY PLAN: ${JSON.stringify(monthlyPlan, null, 2)}
INFRASTRUCTURE MONTHLY: $${totalInfra.toFixed(2)}
LAST WEEK SPEND BY AGENT: ${JSON.stringify(lastWeekByAgent, null, 2)}
REMAINING MONTHLY BUDGET: $${monthBudgetRemaining.toFixed(2)}
MONTH BUDGET SPENT SO FAR: $${monthBudgetSpent.toFixed(2)}
DAYS REMAINING IN MONTH: ${daysRemaining}
WEEK NUMBER: ${weekNumber}`,
      },
    ],
  });

  const scenarioText =
    (response.content as Array<{ type: string; text?: string }>)
      .find((b) => b.type === "text")?.text ?? "";

  const jsonMatch = scenarioText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return new Response(
      JSON.stringify({ error: "CFO failed to generate valid scenarios JSON" }),
      { status: 500 },
    );
  }

  let scenarios: Record<string, unknown>;
  try {
    scenarios = JSON.parse(jsonMatch[0]);
  } catch {
    return new Response(
      JSON.stringify({ error: "CFO scenarios JSON could not be parsed" }),
      { status: 500 },
    );
  }

  const { error: insertErr } = await db.from("weekly_scenarios").insert({
    week_start: nextMonday.toISOString().slice(0, 10),
    plan_month_id: monthlyPlan.id,
    optimistic: scenarios.optimistic ?? {},
    base: scenarios.base ?? {},
    conservative: scenarios.conservative ?? {},
    month_budget_remaining: monthBudgetRemaining,
    month_budget_spent: monthBudgetSpent,
    month_days_remaining: daysRemaining,
    performance_summary: (scenarios.performance_summary as string) ?? "",
    risk_assessment: (scenarios.risk_assessment as string) ?? "",
    week_number: weekNumber,
  });

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
  }

  await db.from("agent_messages").insert({
    from_agent: "cfo",
    to_agent: "admin",
    message_type: "status_report",
    payload: {
      message: `Weekly scenarios for w/c ${nextMonday.toISOString().slice(0, 10)} are ready for your review.`,
      action_url: "/agents/cfo/weekly-plan",
      action_required: true,
    },
    priority: "high",
    status: "pending",
  });

  const cfoCost = parseFloat(CFO_COST_PER_DECISION.toFixed(4));
  await db.from("api_cost_log").insert({
    service: "anthropic",
    description: `CFO Agent — generated weekly scenarios for w/c ${nextMonday.toISOString().slice(0, 10)}`,
    cost_usd: cfoCost,
  });

  return new Response(JSON.stringify({ scenarios }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Action: reset_budgets
// ---------------------------------------------------------------------------

async function resetBudgets(db: SupabaseClient): Promise<Response> {
  const { error } = await db
    .from("agent_registry")
    .update({
      budget_spent_this_month: 0,
      weekly_spent: 0,
      updated_at: new Date().toISOString(),
    })
    .neq("id", ""); // update all rows

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  await db.from("agent_messages").insert({
    from_agent: "cfo",
    to_agent: "all",
    message_type: "budget_update",
    payload: {
      message: "Monthly and weekly budgets have been reset for all agents.",
      reset_at: new Date().toISOString(),
    },
    priority: "normal",
    status: "resolved",
  });

  return new Response(
    JSON.stringify({ reset: true, timestamp: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  try {
    switch (parsed.data.action) {
      case "process_spend_requests":
        return await processSpendRequests(db, anthropic);
      case "generate_monthly_plan":
        return await generateMonthlyPlan(db, anthropic);
      case "generate_weekly_scenarios":
        return await generateWeeklyScenarios(db, anthropic);
      case "reset_budgets":
        return await resetBudgets(db);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
