import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient>;

interface PlanStats {
  plan_id: string;
  plan_name: string;
  price_monthly: number;
  price_yearly: number | null;
  active_subscribers: number;
  churned_subscribers: number;
  avg_lifetime_days: number;
}

interface PromoCodeRow {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  times_used: number;
  max_uses: number | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const AGENT_ID = "pricing";
const COST_PER_INPUT_TOKEN  = 0.000003;  // $3 / MTok
const COST_PER_OUTPUT_TOKEN = 0.000015;  // $15 / MTok

// Conservative pre-run cost estimates per action
const ESTIMATED_COST = {
  analyse_conversion:  0.10,
  recommend_pricing:   0.30,
  evaluate_promos:     0.10,
  competitor_check:    0.25,
} as const;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  action: z.enum([
    "analyse_conversion",
    "recommend_pricing",
    "evaluate_promos",
    "competitor_check",
  ]),
});

// ---------------------------------------------------------------------------
// CFO integration
// ---------------------------------------------------------------------------

async function invokeCFO(): Promise<void> {
  const supabaseUrl    = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/cfo-agent`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ action: "process_spend_requests" }),
    });
    if (!res.ok) console.warn(`invokeCFO: CFO returned ${res.status}`);
  } catch (err) {
    console.warn(`invokeCFO: fetch failed — ${err}`);
  }
}

// Submit a spend_request + spend_authorisation, invoke the CFO synchronously,
// and return the authorisation ID once the request is approved.
// Throws if the CFO denies the request.
async function submitSpendRequest(
  db: SupabaseClient,
  action: string,
  estimatedCostUsd: number,
  justification: string,
  costBreakdown: Record<string, number>,
): Promise<string> {
  const { data: msg, error: msgErr } = await db
    .from("agent_messages")
    .insert({
      from_agent:   AGENT_ID,
      to_agent:     "cfo",
      message_type: "spend_request",
      payload: {
        action,
        estimated_cost_usd: estimatedCostUsd,
        cost_breakdown:     costBreakdown,
        justification,
      },
      priority: "normal",
      status:   "pending",
    })
    .select("id")
    .single();

  if (msgErr || !msg) throw new Error(`Failed to post spend_request: ${msgErr?.message}`);

  const { data: auth, error: authErr } = await db
    .from("spend_authorisations")
    .insert({
      agent_id:           AGENT_ID,
      request_message_id: msg.id,
      action,
      estimated_cost_usd: estimatedCostUsd,
      cost_breakdown:     costBreakdown,
      justification,
      status:           "pending",
      execution_status: "not_started",
    })
    .select("id")
    .single();

  if (authErr || !auth) throw new Error(`Failed to create spend_authorisation: ${authErr?.message}`);

  await invokeCFO();

  const { data: decided, error: readErr } = await db
    .from("spend_authorisations")
    .select("status, denial_reason, approved_amount_usd")
    .eq("id", auth.id)
    .single();

  if (readErr || !decided) throw new Error(`Failed to read authorisation decision: ${readErr?.message}`);

  if (decided.status === "denied") {
    throw new Error(`CFO denied spend request: ${decided.denial_reason ?? "No reason provided"}`);
  }

  if (decided.status === "pending") {
    console.warn(`spend_authorisation ${auth.id} still pending — fallback approval`);
    await db
      .from("spend_authorisations")
      .update({
        status:              "approved",
        approved_amount_usd: estimatedCostUsd,
        conditions:          "Fallback approval: CFO did not respond in time",
        decided_at:          new Date().toISOString(),
        decided_by:          "system",
        execution_status:    "running",
      })
      .eq("id", auth.id);
  } else {
    await db
      .from("spend_authorisations")
      .update({ execution_status: "running" })
      .eq("id", auth.id);
  }

  return auth.id as string;
}

// Record actual token costs and send a spend_report to the CFO.
async function reportActualSpend(
  db: SupabaseClient,
  authorisationId: string,
  action: string,
  inputTokens: number,
  outputTokens: number,
  results: Record<string, unknown>,
): Promise<void> {
  const actualCost = parseFloat(
    (inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN).toFixed(6),
  );

  await Promise.all([
    db
      .from("spend_authorisations")
      .update({
        actual_cost_usd:   actualCost,
        execution_status:  "completed",
        execution_results: results,
        completed_at:      new Date().toISOString(),
      })
      .eq("id", authorisationId),

    db.from("api_cost_log").insert({
      service:       "anthropic",
      description:   `Pricing Agent — ${action}`,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      actualCost,
    }),

    db.from("agent_messages").insert({
      from_agent:   AGENT_ID,
      to_agent:     "cfo",
      message_type: "spend_report",
      payload: {
        authorisation_id: authorisationId,
        actual_cost_usd:  actualCost,
        action,
        results,
      },
      priority: "normal",
      status:   "resolved",
    }),
  ]);
}

// Parse the first JSON object from a Claude text response.
function parseJsonFromResponse<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action: analyse_conversion
// ---------------------------------------------------------------------------
// Fetches free-to-paid conversion rates, churn by plan, and ARPU, then uses
// Claude to generate a structured analysis report stored in pricing_reports.

async function analyseConversion(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Subscription plan performance
  const { data: planRows } = await db
    .from("subscription_plans")
    .select("id, name, price_monthly, price_yearly");

  const planIds = (planRows ?? []).map((p) => p.id as string);

  // Active subscribers per plan
  const { data: activeSubs } = await db
    .from("user_subscriptions")
    .select("plan_id, billing_period")
    .eq("status", "active");

  // Churned subscribers (cancelled_at set) per plan
  const { data: churnedSubs } = await db
    .from("user_subscriptions")
    .select("plan_id, created_at, cancelled_at")
    .not("cancelled_at", "is", null)
    .in("plan_id", planIds);

  // New subscriptions this month (conversions)
  const { data: newSubs } = await db
    .from("user_subscriptions")
    .select("plan_id, billing_period")
    .gte("created_at", monthStart);

  // Total free and paid user counts
  const { count: totalUsers } = await db
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: paidUsers } = await db
    .from("user_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // Build per-plan stats
  const planStats: PlanStats[] = (planRows ?? []).map((plan) => {
    const active  = (activeSubs  ?? []).filter((s) => s.plan_id === plan.id);
    const churned = (churnedSubs ?? []).filter((s) => s.plan_id === plan.id);

    const avgLifetimeDays =
      churned.length > 0
        ? churned.reduce((sum, s) => {
            const start = new Date(s.created_at as string).getTime();
            const end   = new Date(s.cancelled_at as string).getTime();
            return sum + (end - start) / (1000 * 60 * 60 * 24);
          }, 0) / churned.length
        : 0;

    return {
      plan_id:             plan.id   as string,
      plan_name:           plan.name as string,
      price_monthly:       Number(plan.price_monthly ?? 0),
      price_yearly:        plan.price_yearly != null ? Number(plan.price_yearly) : null,
      active_subscribers:  active.length,
      churned_subscribers: churned.length,
      avg_lifetime_days:   Math.round(avgLifetimeDays),
    };
  });

  // ARPU: total MRR / total paid users
  const mrr = planStats.reduce((sum, p) => sum + p.price_monthly * p.active_subscribers, 0);
  const arpu = (paidUsers ?? 0) > 0 ? mrr / (paidUsers ?? 1) : 0;

  const conversionData = {
    total_users:           totalUsers ?? 0,
    paid_users:            paidUsers  ?? 0,
    free_users:            (totalUsers ?? 0) - (paidUsers ?? 0),
    conversion_rate:       (totalUsers ?? 0) > 0
      ? ((paidUsers ?? 0) / (totalUsers ?? 1)) * 100
      : 0,
    mrr,
    arpu,
    new_subs_this_month:   (newSubs ?? []).length,
    plan_stats:            planStats,
    analysis_date:         now.toISOString().slice(0, 10),
  };

  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "analyse_conversion",
      ESTIMATED_COST.analyse_conversion,
      `Monthly conversion analysis: ${conversionData.total_users} total users, ${conversionData.paid_users} paid, ${conversionData.conversion_rate.toFixed(1)}% conversion rate, ARPU $${arpu.toFixed(2)}.`,
      { anthropic_api: ESTIMATED_COST.analyse_conversion },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const claudeResponse = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 2048,
    system: `You are the Pricing Analyst for TruthStay, a community-driven holiday planning platform. Analyse subscription conversion and churn data to identify revenue optimisation opportunities. Be data-driven, specific, and actionable. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Analyse TruthStay subscription conversion metrics.

CONVERSION DATA:
${JSON.stringify(conversionData, null, 2)}

Respond with:
{
  "overall_health": "strong|healthy|weak|critical",
  "conversion_rate_assessment": "analysis of the free-to-paid conversion rate",
  "churn_analysis": {
    "by_plan": [{ "plan_name": string, "churn_rate_pct": number, "avg_lifetime_days": number, "assessment": string }],
    "overall_churn_rate_pct": number,
    "primary_churn_drivers": string[]
  },
  "arpu_analysis": {
    "current_arpu": number,
    "benchmark_comment": string,
    "arpu_improvement_opportunity": string
  },
  "key_findings": string[],
  "recommendations": string[],
  "urgency": "low|medium|high"
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const analysis = parseJsonFromResponse<{
    overall_health:           string;
    conversion_rate_assessment: string;
    churn_analysis:           Record<string, unknown>;
    arpu_analysis:            Record<string, unknown>;
    key_findings:             string[];
    recommendations:          string[];
    urgency:                  string;
  }>(responseText) ?? {
    overall_health:           "unknown",
    conversion_rate_assessment: "Analysis failed",
    churn_analysis:           {},
    arpu_analysis:            {},
    key_findings:             ["Analysis failed to parse"],
    recommendations:          [],
    urgency:                  "low",
  };

  // Store the report
  await db.from("pricing_reports").insert({
    report_type:     "conversion_analysis",
    report_date:     now.toISOString().slice(0, 10),
    data:            conversionData,
    analysis:        analysis,
    spend_auth_id:   authorisationId,
  });

  await reportActualSpend(
    db,
    authorisationId,
    "analyse_conversion",
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    {
      total_users:      conversionData.total_users,
      paid_users:       conversionData.paid_users,
      conversion_rate:  conversionData.conversion_rate,
      arpu:             conversionData.arpu,
      overall_health:   analysis.overall_health,
    },
  );

  await db.from("agent_messages").insert({
    from_agent:   AGENT_ID,
    to_agent:     "admin",
    message_type: "status_report",
    payload: {
      message:         `Conversion analysis: ${analysis.overall_health} health. ${conversionData.conversion_rate.toFixed(1)}% conversion, ARPU $${arpu.toFixed(2)}.`,
      key_findings:    analysis.key_findings,
      recommendations: analysis.recommendations,
      urgency:         analysis.urgency,
    },
    priority: analysis.urgency === "high" ? "high" : "normal",
    status:   "pending",
  });

  return new Response(
    JSON.stringify({
      overall_health:   analysis.overall_health,
      conversion_rate:  conversionData.conversion_rate,
      arpu:             conversionData.arpu,
      paid_users:       conversionData.paid_users,
      total_users:      conversionData.total_users,
      key_findings:     analysis.key_findings,
      recommendations:  analysis.recommendations,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: recommend_pricing
// ---------------------------------------------------------------------------
// Reads the latest conversion analysis, runs a deep Claude pricing review, and
// escalates any pricing change recommendation to the CFO as an escalation
// message (which the CFO forwards to admin for final sign-off).

async function recommendPricing(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const now = new Date();

  // Pull latest conversion report
  const { data: latestReport } = await db
    .from("pricing_reports")
    .select("*")
    .eq("report_type", "conversion_analysis")
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Current subscription plans
  const { data: plans } = await db
    .from("subscription_plans")
    .select("id, name, price_monthly, price_yearly, features");

  // Revenue trend (last 3 months)
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const { data: revenueHistory } = await db
    .from("user_subscriptions")
    .select("plan_id, billing_period, created_at, cancelled_at")
    .gte("created_at", threeMonthsAgo);

  // Active promo codes (to consider in pricing context)
  const { data: activePromos } = await db
    .from("promo_codes")
    .select("code, discount_type, discount_value, times_used")
    .eq("status", "active");

  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "recommend_pricing",
      ESTIMATED_COST.recommend_pricing,
      `Monthly pricing recommendation: analyse subscription plans, conversion data, and revenue trends to generate data-driven pricing change recommendations with projected revenue impact.`,
      { anthropic_api: ESTIMATED_COST.recommend_pricing },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const claudeResponse = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 3000,
    system: `You are the Pricing Strategist for TruthStay, a community-driven holiday planning platform. Generate specific, evidence-based pricing recommendations with projected revenue impact. Focus on maximising long-term revenue while maintaining healthy conversion rates. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Generate pricing recommendations for TruthStay.

CURRENT PLANS:
${JSON.stringify(plans ?? [], null, 2)}

LATEST CONVERSION ANALYSIS:
${JSON.stringify(latestReport?.analysis ?? "No recent analysis — run analyse_conversion first", null, 2)}

CONVERSION DATA:
${JSON.stringify(latestReport?.data ?? {}, null, 2)}

ACTIVE PROMO CODES:
${JSON.stringify(activePromos ?? [], null, 2)}

3-MONTH SUBSCRIPTION HISTORY (count: ${(revenueHistory ?? []).length} records):
${JSON.stringify(
  (revenueHistory ?? []).reduce((acc: Record<string, number>, s) => {
    const month = (s.created_at as string).slice(0, 7);
    acc[month] = (acc[month] ?? 0) + 1;
    return acc;
  }, {}),
  null, 2
)}

Respond with:
{
  "summary": "one-paragraph executive summary",
  "current_pricing_assessment": "are current prices appropriate given market position?",
  "recommendations": [
    {
      "plan_name": string,
      "current_price_monthly": number,
      "recommended_price_monthly": number,
      "current_price_yearly": number | null,
      "recommended_price_yearly": number | null,
      "price_change_pct": number,
      "reasoning": string,
      "projected_impact": {
        "conversion_change_pct": number,
        "subscriber_change_pct": number,
        "mrr_change_pct": number,
        "net_revenue_change_pct": number
      },
      "confidence": "low|medium|high",
      "implementation_risk": "low|medium|high"
    }
  ],
  "no_change_plans": [{ "plan_name": string, "reason": string }],
  "overall_mrr_impact": {
    "current_mrr_estimate": number,
    "projected_mrr": number,
    "change_pct": number
  },
  "requires_admin_approval": true,
  "implementation_notes": string,
  "review_again_in_days": number
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const recommendations = parseJsonFromResponse<{
    summary:                    string;
    current_pricing_assessment: string;
    recommendations:            Array<{
      plan_name:                  string;
      current_price_monthly:      number;
      recommended_price_monthly:  number;
      price_change_pct:           number;
      reasoning:                  string;
      projected_impact:           Record<string, number>;
      confidence:                 string;
      implementation_risk:        string;
    }>;
    no_change_plans:            Array<{ plan_name: string; reason: string }>;
    overall_mrr_impact:         { current_mrr_estimate: number; projected_mrr: number; change_pct: number };
    requires_admin_approval:    boolean;
    implementation_notes:       string;
    review_again_in_days:       number;
  }>(responseText);

  if (!recommendations) {
    await db
      .from("spend_authorisations")
      .update({ execution_status: "failed", completed_at: new Date().toISOString() })
      .eq("id", authorisationId);
    return new Response(
      JSON.stringify({ error: "Claude failed to generate valid pricing recommendations" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Store the report
  await db.from("pricing_reports").insert({
    report_type:   "pricing_recommendation",
    report_date:   now.toISOString().slice(0, 10),
    data:          {
      plans:                  plans ?? [],
      active_promos:          activePromos ?? [],
      conversion_report_date: latestReport?.report_date ?? null,
    },
    analysis:      recommendations,
    spend_auth_id: authorisationId,
  });

  // Escalate pricing change recommendations to the CFO for forwarding to admin.
  // The CFO reviews and either approves (forwarding to admin) or denies.
  const hasActualChanges = recommendations.recommendations.length > 0;
  if (hasActualChanges) {
    const currentPricing: Record<string, number> = {};
    const recommendedPricing: Record<string, number> = {};
    for (const rec of recommendations.recommendations) {
      currentPricing[`${rec.plan_name}_monthly`]     = rec.current_price_monthly;
      recommendedPricing[`${rec.plan_name}_monthly`] = rec.recommended_price_monthly;
    }

    await db.from("agent_messages").insert({
      from_agent:   AGENT_ID,
      to_agent:     "cfo",
      message_type: "escalation",
      payload: {
        type:                    "pricing_change_recommendation",
        current:                 currentPricing,
        recommended:             recommendedPricing,
        reasoning:               recommendations.summary,
        projected_impact:        recommendations.overall_mrr_impact,
        recommendations_detail:  recommendations.recommendations,
        implementation_notes:    recommendations.implementation_notes,
        requires_admin_approval: true,
      },
      priority: "high",
      status:   "pending",
    });
  }

  await reportActualSpend(
    db,
    authorisationId,
    "recommend_pricing",
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    {
      recommendations_count:  recommendations.recommendations.length,
      no_change_plans_count:  recommendations.no_change_plans.length,
      overall_mrr_impact:     recommendations.overall_mrr_impact,
      escalated_to_cfo:       hasActualChanges,
    },
  );

  return new Response(
    JSON.stringify({
      summary:               recommendations.summary,
      recommendations_count: recommendations.recommendations.length,
      overall_mrr_impact:    recommendations.overall_mrr_impact,
      escalated_to_cfo:      hasActualChanges,
      requires_admin_approval: recommendations.requires_admin_approval,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: evaluate_promos
// ---------------------------------------------------------------------------
// Reviews active promo code performance and ROI over the past 30 days and
// stores a report with recommendations.

async function evaluatePromos(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const now        = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All promo codes (active and recently expired)
  const { data: promoCodes } = await db
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, times_used, max_uses, expires_at, status, created_at")
    .or("status.eq.active,and(status.eq.expired,expires_at.gte." + thirtyDaysAgo + ")");

  if (!promoCodes || promoCodes.length === 0) {
    return new Response(
      JSON.stringify({ message: "No promo codes to evaluate", checked_at: now.toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Promo redemptions and their revenue impact
  const promoIds = (promoCodes as PromoCodeRow[]).map((p) => p.id);
  const { data: redemptions } = await db
    .from("promo_redemptions")
    .select("promo_code_id, user_id, subscription_plan_id, revenue_impact, redeemed_at")
    .in("promo_code_id", promoIds)
    .gte("redeemed_at", thirtyDaysAgo);

  // Aggregate redemption stats per promo
  const redemptionsByPromo: Record<string, {
    count: number;
    total_revenue_impact: number;
    unique_users: Set<string>;
  }> = {};

  for (const r of redemptions ?? []) {
    if (!redemptionsByPromo[r.promo_code_id]) {
      redemptionsByPromo[r.promo_code_id] = { count: 0, total_revenue_impact: 0, unique_users: new Set() };
    }
    redemptionsByPromo[r.promo_code_id].count++;
    redemptionsByPromo[r.promo_code_id].total_revenue_impact += Number(r.revenue_impact ?? 0);
    if (r.user_id) redemptionsByPromo[r.promo_code_id].unique_users.add(r.user_id as string);
  }

  const promoPerformance = (promoCodes as PromoCodeRow[]).map((promo) => {
    const stats = redemptionsByPromo[promo.id];
    return {
      code:               promo.code,
      status:             promo.status,
      discount_type:      promo.discount_type,
      discount_value:     promo.discount_value,
      total_uses:         promo.times_used,
      max_uses:           promo.max_uses,
      expires_at:         promo.expires_at,
      uses_last_30_days:  stats?.count ?? 0,
      unique_users:       stats?.unique_users.size ?? 0,
      revenue_impact_30d: stats?.total_revenue_impact ?? 0,
      fill_rate_pct:      promo.max_uses != null && promo.max_uses > 0
        ? (promo.times_used / promo.max_uses) * 100
        : null,
    };
  });

  const totalRevenueImpact = promoPerformance.reduce((s, p) => s + p.revenue_impact_30d, 0);
  const totalUses          = promoPerformance.reduce((s, p) => s + p.uses_last_30_days, 0);

  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "evaluate_promos",
      ESTIMATED_COST.evaluate_promos,
      `Weekly promo evaluation: ${promoCodes.length} codes, ${totalUses} uses in last 30 days, $${totalRevenueImpact.toFixed(2)} revenue impact.`,
      { anthropic_api: ESTIMATED_COST.evaluate_promos },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const claudeResponse = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 1500,
    system: `You are the Pricing Analyst for TruthStay, a community-driven holiday planning platform. Analyse promo code performance and ROI to optimise the discount strategy. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Evaluate TruthStay promo code performance over the last 30 days.

PROMO PERFORMANCE:
${JSON.stringify(promoPerformance, null, 2)}

SUMMARY:
- Total codes: ${promoCodes.length}
- Active codes: ${(promoCodes as PromoCodeRow[]).filter((p) => p.status === "active").length}
- Total uses (30d): ${totalUses}
- Total revenue impact (30d): $${totalRevenueImpact.toFixed(2)}

Respond with:
{
  "overall_assessment": "effective|neutral|costly|underutilised",
  "top_performing_codes": [{ "code": string, "reason": string }],
  "underperforming_codes": [{ "code": string, "issue": string, "recommendation": "pause|extend|modify|retire" }],
  "roi_analysis": {
    "total_discount_given": number,
    "estimated_revenue_attributed": number,
    "net_roi_pct": number,
    "assessment": string
  },
  "recommendations": [
    {
      "action": "create|pause|modify|retire|extend",
      "code": string | null,
      "details": string,
      "expected_impact": string
    }
  ],
  "new_promo_suggestions": [
    {
      "purpose": string,
      "discount_type": "percentage|fixed",
      "discount_value": number,
      "target_segment": string,
      "rationale": string
    }
  ],
  "summary": string
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const analysis = parseJsonFromResponse<{
    overall_assessment:     string;
    top_performing_codes:   Array<{ code: string; reason: string }>;
    underperforming_codes:  Array<{ code: string; issue: string; recommendation: string }>;
    roi_analysis:           Record<string, unknown>;
    recommendations:        Array<Record<string, string>>;
    new_promo_suggestions:  Array<Record<string, unknown>>;
    summary:                string;
  }>(responseText) ?? {
    overall_assessment:    "unknown",
    top_performing_codes:  [],
    underperforming_codes: [],
    roi_analysis:          {},
    recommendations:       [],
    new_promo_suggestions: [],
    summary:               "Analysis failed to parse",
  };

  await db.from("pricing_reports").insert({
    report_type:   "promo_evaluation",
    report_date:   now.toISOString().slice(0, 10),
    data:          { promo_performance: promoPerformance, totals: { total_uses: totalUses, total_revenue_impact: totalRevenueImpact } },
    analysis:      analysis,
    spend_auth_id: authorisationId,
  });

  await reportActualSpend(
    db,
    authorisationId,
    "evaluate_promos",
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    {
      codes_evaluated:     promoCodes.length,
      total_uses_30d:      totalUses,
      revenue_impact:      totalRevenueImpact,
      overall_assessment:  analysis.overall_assessment,
    },
  );

  await db.from("agent_messages").insert({
    from_agent:   AGENT_ID,
    to_agent:     "admin",
    message_type: "status_report",
    payload: {
      message:         `Promo evaluation: ${analysis.overall_assessment}. ${promoCodes.length} codes, ${totalUses} uses, $${totalRevenueImpact.toFixed(2)} revenue impact.`,
      summary:         analysis.summary,
      recommendations: analysis.recommendations,
    },
    priority: "normal",
    status:   "pending",
  });

  return new Response(
    JSON.stringify({
      overall_assessment:     analysis.overall_assessment,
      codes_evaluated:        promoCodes.length,
      total_uses_30d:         totalUses,
      total_revenue_impact:   totalRevenueImpact,
      top_performing_codes:   analysis.top_performing_codes,
      underperforming_codes:  analysis.underperforming_codes,
      recommendations:        analysis.recommendations,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: competitor_check
// ---------------------------------------------------------------------------
// Uses Anthropic's web search to find recent competitor pricing changes, then
// summarises findings and stores a competitor intelligence report.

async function competitorCheck(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const now = new Date();

  // Current TruthStay plans for comparison
  const { data: plans } = await db
    .from("subscription_plans")
    .select("name, price_monthly, price_yearly, features");

  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "competitor_check",
      ESTIMATED_COST.competitor_check,
      `Monthly competitor pricing check: web search for recent pricing changes at competing holiday planning and travel platforms.`,
      { anthropic_api: ESTIMATED_COST.competitor_check },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  // Use Anthropic's web search tool to fetch live competitor data.
  // web_search_20250305 is not yet in the SDK types — cast to bypass.
  const searchResponse = await (
    anthropic.messages.create as (
      params: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<Anthropic.Message>
  )(
    {
      model:      MODEL,
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `You are a competitive intelligence analyst for TruthStay, a community-driven holiday planning platform. Search for recent pricing changes and subscription plans at competing travel planning apps and platforms. Focus on apps that offer itinerary planning, trip recommendations, or community-driven travel discovery. Current date: ${now.toISOString().slice(0, 10)}.`,
      messages: [
        {
          role:    "user",
          content: `Search for current pricing information for competitors of TruthStay — a community-driven holiday planning app.

Search for pricing pages and recent announcements from:
1. Holiday planning and itinerary apps (e.g. Wanderlog, TripIt, Roadtrippers, Sygic Travel)
2. Community travel platforms (e.g. Atlas Obscura, Polarsteps, TripAdvisor subscription)
3. AI travel planning tools (any that offer subscription tiers)
4. Any platforms that recently changed pricing

Our current pricing for comparison:
${JSON.stringify(plans ?? [], null, 2)}

After searching, compile a structured analysis comparing competitor pricing to ours.`,
        },
      ],
    },
    { headers: { "anthropic-beta": "web-search-2025-03-05" } },
  );

  // Count tokens including tool use rounds
  let totalInputTokens  = searchResponse.usage.input_tokens;
  let totalOutputTokens = searchResponse.usage.output_tokens;

  // Extract the text summary from the search response
  const searchSummary =
    (searchResponse.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n\n")
      .trim() || "No search results returned.";

  // Ask Claude to structure the competitor intelligence into a clean report
  const analysisResponse = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 2000,
    system: `You are the Pricing Strategist for TruthStay. Structure competitor pricing intelligence into a clear, actionable report. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Structure this competitor pricing intelligence into a formal report.

RAW SEARCH FINDINGS:
${searchSummary}

OUR CURRENT PLANS:
${JSON.stringify(plans ?? [], null, 2)}

TODAY'S DATE: ${now.toISOString().slice(0, 10)}

Respond with:
{
  "competitors_found": [
    {
      "name": string,
      "url": string | null,
      "pricing_model": "freemium|subscription|one_time|free|unknown",
      "plans": [{ "name": string, "price_monthly": number | null, "price_yearly": number | null, "key_features": string[] }],
      "recent_changes": string | null,
      "positioning": string
    }
  ],
  "market_positioning": {
    "our_price_vs_market": "below|at|above",
    "price_range_low": number | null,
    "price_range_high": number | null,
    "market_median_monthly": number | null
  },
  "notable_trends": string[],
  "opportunities": string[],
  "threats": string[],
  "recommendations": [
    { "action": string, "rationale": string, "urgency": "low|medium|high" }
  ],
  "data_freshness": "current|partial|stale",
  "summary": string
}`,
      },
    ],
  });

  totalInputTokens  += analysisResponse.usage.input_tokens;
  totalOutputTokens += analysisResponse.usage.output_tokens;

  const analysisText = (analysisResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const report = parseJsonFromResponse<{
    competitors_found:  Array<Record<string, unknown>>;
    market_positioning: Record<string, unknown>;
    notable_trends:     string[];
    opportunities:      string[];
    threats:            string[];
    recommendations:    Array<{ action: string; rationale: string; urgency: string }>;
    data_freshness:     string;
    summary:            string;
  }>(analysisText) ?? {
    competitors_found:  [],
    market_positioning: {},
    notable_trends:     [],
    opportunities:      [],
    threats:            [],
    recommendations:    [],
    data_freshness:     "stale",
    summary:            "Analysis failed to parse",
  };

  await db.from("pricing_reports").insert({
    report_type:   "competitor_check",
    report_date:   now.toISOString().slice(0, 10),
    data:          {
      search_summary:    searchSummary,
      our_plans:         plans ?? [],
    },
    analysis:      report,
    spend_auth_id: authorisationId,
  });

  await reportActualSpend(
    db,
    authorisationId,
    "competitor_check",
    totalInputTokens,
    totalOutputTokens,
    {
      competitors_found:   report.competitors_found.length,
      notable_trends:      report.notable_trends.length,
      recommendations:     report.recommendations.length,
      data_freshness:      report.data_freshness,
    },
  );

  await db.from("agent_messages").insert({
    from_agent:   AGENT_ID,
    to_agent:     "admin",
    message_type: "status_report",
    payload: {
      message:        `Competitor pricing check: ${report.competitors_found.length} competitors found. Market positioning: ${(report.market_positioning as { our_price_vs_market?: string }).our_price_vs_market ?? "unknown"}.`,
      summary:        report.summary,
      notable_trends: report.notable_trends,
      opportunities:  report.opportunities,
      threats:        report.threats,
      recommendations: report.recommendations,
    },
    priority: report.threats.length > 0 ? "high" : "normal",
    status:   "pending",
  });

  return new Response(
    JSON.stringify({
      competitors_found:   report.competitors_found.length,
      market_positioning:  report.market_positioning,
      notable_trends:      report.notable_trends,
      opportunities:       report.opportunities,
      threats:             report.threats,
      recommendations:     report.recommendations,
      summary:             report.summary,
    }),
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
    return new Response(
      JSON.stringify({ error: parsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  try {
    switch (parsed.data.action) {
      case "analyse_conversion":
        return await analyseConversion(db, anthropic);
      case "recommend_pricing":
        return await recommendPricing(db, anthropic);
      case "evaluate_promos":
        return await evaluatePromos(db, anthropic);
      case "competitor_check":
        return await competitorCheck(db, anthropic);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
