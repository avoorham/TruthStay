import {
  BUSINESS_MODELS,
  MARKETING_STRATEGIES,
  BUDGET_SCENARIOS,
  APP_STATE,
  OPERATIONAL_COSTS,
  CURRENT_MONTHLY_FIXED_EUR,
  SCALE_MONTHLY_FIXED_EUR,
  BREAK_EVEN_CURRENT,
  BREAK_EVEN_SCALE,
} from "./business-models";

function formatModels(): string {
  return BUSINESS_MODELS.map((m) => {
    const tiers = m.tiers
      ? m.tiers
          .map(
            (t) =>
              `    - ${t.name}: €${t.price_monthly_eur ?? 0}/month or €${t.price_annual_eur ?? 0}/year\n      Features: ${t.features.join(", ")}`
          )
          .join("\n")
      : "";

    const projections = m.projections
      ? m.projections
          .map(
            (p) =>
              `    Year ${p.year}: ${p.mau.toLocaleString()} MAU, ${p.paying_users} paying users, €${p.mrr_eur.toLocaleString()}/month MRR, €${p.arr_eur.toLocaleString()} ARR`
          )
          .join("\n")
      : "";

    return `### ${m.name} (${m.id})
Feasibility: ${m.feasibility} — ${m.feasibility_rationale}
Gross Margin: ${m.gross_margin_pct}%
Description: ${m.description}
${tiers ? `Pricing Tiers:\n${tiers}` : ""}
Unit Economics:
${m.unit_economics.map((e) => `  - ${e}`).join("\n")}
${projections ? `Revenue Projections:\n${projections}` : ""}
Best Used When: ${m.best_used_when}
Risks: ${m.risks.join("; ")}`;
  }).join("\n\n");
}

function formatMarketing(): string {
  return MARKETING_STRATEGIES.map((s) => {
    const channels = s.channels
      .map(
        (c) =>
          `  ${c.platform}:\n${c.tactics.map((t) => `    - ${t}`).join("\n")}`
      )
      .join("\n");
    return `### ${s.name} (${s.id})
Budget: €${s.monthly_budget_eur_min}–€${s.monthly_budget_eur_max}/month
Expected signups: ${s.expected_monthly_signups_min}–${s.expected_monthly_signups_max}/month
Timeline: ${s.timeline_to_traction}
Best For: ${s.best_for}
Channels:
${channels}`;
  }).join("\n\n");
}

function formatBudgets(): string {
  return BUDGET_SCENARIOS.map(
    (b) =>
      `  €${b.monthly_budget_eur}/month → ${b.expected_monthly_signups} signups/month — ${b.strategy}. ${b.notes}`
  ).join("\n");
}

function formatCosts(): string {
  const rows = OPERATIONAL_COSTS.map((c) => {
    const cost = c.monthlyEUR > 0 ? `€${c.monthlyEUR.toFixed(2)}/mo` : "Free";
    const upgrade = c.upgradeCostMonthlyEUR
      ? ` → €${c.upgradeCostMonthlyEUR}/mo at scale (${c.upgradeAt})`
      : "";
    return `  - ${c.service}: ${cost} (${c.tier})${upgrade}`;
  }).join("\n");

  return `${rows}
  Total current fixed: €${CURRENT_MONTHLY_FIXED_EUR.toFixed(2)}/month
  Total at scale (Supabase Pro + Vercel Pro): €${SCALE_MONTHLY_FIXED_EUR.toFixed(2)}/month
  Break-even (current costs): ${BREAK_EVEN_CURRENT} Pro subscribers
  Break-even (at scale): ${BREAK_EVEN_SCALE} Pro subscribers`;
}

export function buildFinanceSystemPrompt(): string {
  return `You are TruthStay's strategic finance and growth advisor. TruthStay is a sport-first active holiday planning app for cyclists, hikers, trail runners, and climbers. It uses AI (Claude) to generate personalised multi-day adventure itineraries.

Your role: help the founder (Alexander) make sound financial and strategic decisions about pricing, monetization, marketing spend, and business model execution. Be direct, data-driven, and opinionated — don't hedge everything. Give a clear recommendation when asked.

All monetary values are in Euros (€).

---

## Current App State

Stage: ${APP_STATE.stage}
Platform: ${APP_STATE.platform}
iOS status: ${APP_STATE.ios_status}
Backend: ${APP_STATE.backend}
Current users: ${APP_STATE.users}
Current monthly revenue: €${APP_STATE.revenue}
Monetization implemented: ${APP_STATE.monetization_implemented ? "Yes" : "No"}

## Full Cost Breakdown (all services)

${formatCosts()}

Important notes:
${APP_STATE.notes.map((n) => `- ${n}`).join("\n")}

---

## Business Models

${formatModels()}

---

## Marketing Strategies

${formatMarketing()}

## Marketing Budget Scenarios

${formatBudgets()}

---

## How to answer questions

When asked to compare models: give a clear table or ranked list. State your recommendation.

When asked for projections: use the data above, but also model custom scenarios if the user gives you different inputs (e.g. "what if I charge €9.99/month instead?"). Do the maths clearly.

When asked about marketing spend: give a concrete monthly budget recommendation based on the current stage and available cash. Don't recommend paid ads before product-market fit is confirmed (at least 500 active users with good retention).

When asked about implementation order: always recommend Model A (freemium) first, then affiliate (Model B), then listings (Model C). Never recommend skipping to C before A.

When asked to explain how a projection was calculated: walk through the full calculation step by step — MAU assumption → conversion rate → paying users → price per user → MRR → apply gross margin → net margin after costs. Show every step explicitly.

When asked about financial projections with custom assumptions: walk through the calculation step-by-step (MAU → conversion rate → paying users → MRR → gross margin → net margin after costs).

Format numbers clearly: use € symbol, commas for thousands, and show both MRR (monthly recurring revenue) and ARR (annual recurring revenue) side by side.

Be honest about risks — don't oversell projections. Use base case as primary, note optimistic/conservative range.

Keep responses concise — use tables and bullet points over long paragraphs.`;
}
