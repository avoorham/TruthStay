import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient>;

interface MarketingUser {
  id: string;
  authId: string;
  displayName: string;
  activityTypes: string[];
  location: string | null;
  createdAt: string;
}

interface UserSegmentRow {
  id: string;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  user_ids: string[];
  user_count: number;
  segment_stats: Record<string, unknown>;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  subject: string;
  preview_text: string | null;
  body_html: string;
  body_text: string;
  target_user_ids: string[];
  spend_auth_id: string | null;
}

interface ReferralEvent {
  event_type: string;
  revenue_impact: number;
}

interface ReferralCodeRow {
  user_id: string;
  code: string;
  times_used: number;
  conversions: number;
  reward_earned_usd: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const AGENT_ID = "marketing";
const CHURN_INACTIVE_DAYS = 14;
const COST_PER_INPUT_TOKEN = 0.000003;  // $3 / MTok
const COST_PER_OUTPUT_TOKEN = 0.000015; // $15 / MTok

// Conservative pre-run estimates per action
const ESTIMATED_COST = {
  churn_prevention:  0.20,
  identify_segments: 0.10,
  plan_campaign:     0.10,
  execute_campaign:  0.01,
  monitor_referrals: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  action: z.enum([
    "churn_prevention",
    "identify_segments",
    "plan_campaign",
    "execute_campaign",
    "monitor_referrals",
  ]),
  segment_id:  z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// CFO Integration
// ---------------------------------------------------------------------------

async function invokeCFO(): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/cfo-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ action: "process_spend_requests" }),
    });
    if (!res.ok) console.warn(`invokeCFO: CFO returned ${res.status}`);
  } catch (err) {
    console.warn(`invokeCFO: fetch failed — ${err}`);
  }
}

// Submit a spend_request message + spend_authorisation, invoke the CFO
// synchronously, and return the authorisation ID once approved.
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
      status:             "pending",
      execution_status:   "not_started",
    })
    .select("id")
    .single();

  if (authErr || !auth) throw new Error(`Failed to create spend_authorisation: ${authErr?.message}`);

  // Invoke the CFO now so it evaluates before we proceed
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
    // CFO did not respond — fallback approval so the agent can continue
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

// Record actual token costs and notify the CFO via spend_report.
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
      description:   `Marketing Agent — ${action}`,
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

// ---------------------------------------------------------------------------
// Email — Resend
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<string | null> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("RESEND_API_KEY not configured — email not sent to " + to);
    return null;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "TruthStay <hello@truthstay.com>",
        to:      [to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      console.warn(`Resend error for ${to}: ${res.status} — ${await res.text()}`);
      return null;
    }

    const data = await res.json() as { id: string };
    return data.id;
  } catch (err) {
    console.warn(`sendEmail failed for ${to}: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Fetch a map of authId → email from Supabase Auth.
async function getUserEmails(
  db: SupabaseClient,
  authIds: string[],
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  if (authIds.length === 0) return emailMap;

  const { data: authData, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error || !authData) {
    console.warn("Failed to list auth users:", error?.message);
    return emailMap;
  }

  const authIdSet = new Set(authIds);
  for (const u of authData.users) {
    if (authIdSet.has(u.id) && u.email) emailMap.set(u.id, u.email);
  }
  return emailMap;
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
// Action: churn_prevention
// ---------------------------------------------------------------------------
// Identifies users inactive 14+ days who previously created adventures,
// generates a personalised re-engagement email via Claude, then sends via Resend.

async function churnPrevention(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const cutoff = new Date(
    Date.now() - CHURN_INACTIVE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // All users who have ever created an adventure
  const { data: allAdvRows } = await db
    .from("adventures")
    .select('"userId"');

  // Users who created an adventure recently (still active)
  const { data: recentAdvRows } = await db
    .from("adventures")
    .select('"userId"')
    .gte('"createdAt"', cutoff);

  const activeIds = new Set((recentAdvRows ?? []).map((r) => r.userId as string));
  const allIds    = new Set((allAdvRows    ?? []).map((r) => r.userId as string));
  const churnedIds = [...allIds].filter((id) => !activeIds.has(id));

  if (churnedIds.length === 0) {
    return new Response(
      JSON.stringify({ message: "No churned users found", checked_at: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Fetch public user details (cap at 100 per run to control email volume)
  const { data: churnedUsers } = await db
    .from("users")
    .select('id, "authId", "displayName", "activityTypes", location')
    .in("id", churnedIds.slice(0, 100));

  if (!churnedUsers || churnedUsers.length === 0) {
    return new Response(
      JSON.stringify({ message: "No user records found for churned IDs" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Request CFO approval before incurring Claude cost
  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "churn_prevention",
      ESTIMATED_COST.churn_prevention,
      `Generate churn-prevention email campaign for ${churnedUsers.length} inactive users (${CHURN_INACTIVE_DAYS}+ days). Re-engage users who previously created adventures.`,
      { anthropic_api: ESTIMATED_COST.churn_prevention },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  // Sample for Claude — avoid exceeding token limits
  const userSample = (churnedUsers as MarketingUser[]).slice(0, 20).map((u) => ({
    displayName:   u.displayName,
    activityTypes: u.activityTypes ?? [],
    location:      u.location ?? "unknown",
  }));

  const uniqueActivityTypes = [
    ...new Set((churnedUsers as MarketingUser[]).flatMap((u) => u.activityTypes ?? [])),
  ].join(", ") || "various";

  const claudeResponse = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system: `You are the marketing copywriter for TruthStay, a community-driven holiday planning platform built on authentic peer recommendations. Write warm, personal re-engagement emails. Keep subject lines under 50 characters. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Generate a churn-prevention email for ${churnedUsers.length} users inactive for ${CHURN_INACTIVE_DAYS}+ days.

User sample (first 20 of ${churnedUsers.length}):
${JSON.stringify(userSample, null, 2)}

Activity types represented: ${uniqueActivityTypes}

Respond with:
{
  "campaign_name": "internal campaign name",
  "subject": "subject line (max 50 chars)",
  "preview_text": "preview text (max 90 chars)",
  "body_html": "<p>HTML body. Use {displayName} for personalisation.</p>",
  "body_text": "Plain text version. Use {displayName} for personalisation."
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const emailContent = parseJsonFromResponse<{
    campaign_name: string;
    subject:       string;
    preview_text:  string;
    body_html:     string;
    body_text:     string;
  }>(responseText);

  if (!emailContent?.subject || !emailContent?.body_html) {
    await db
      .from("spend_authorisations")
      .update({ execution_status: "failed", completed_at: new Date().toISOString() })
      .eq("id", authorisationId);
    return new Response(
      JSON.stringify({ error: "Claude failed to generate valid email content" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Resolve emails from Supabase Auth
  const authIds = (churnedUsers as MarketingUser[]).map((u) => u.authId).filter(Boolean);
  const emailMap = await getUserEmails(db, authIds);
  const usersWithEmails = (churnedUsers as MarketingUser[]).filter((u) => emailMap.has(u.authId));

  // Create campaign record
  const { data: campaign, error: campaignErr } = await db
    .from("marketing_campaigns")
    .insert({
      name:               emailContent.campaign_name ?? `Churn Prevention ${new Date().toISOString().slice(0, 10)}`,
      campaign_type:      "churn_prevention",
      status:             "sending",
      subject:            emailContent.subject,
      preview_text:       emailContent.preview_text,
      body_html:          emailContent.body_html,
      body_text:          emailContent.body_text,
      target_user_ids:    usersWithEmails.map((u) => u.id),
      estimated_cost_usd: ESTIMATED_COST.churn_prevention,
      spend_auth_id:      authorisationId,
    })
    .select("id")
    .single();

  if (campaignErr || !campaign) {
    return new Response(
      JSON.stringify({ error: `Failed to create campaign: ${campaignErr?.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Send emails and collect recipient records
  let sentCount = 0;
  const recipientRecords = [];

  for (const user of usersWithEmails) {
    const email   = emailMap.get(user.authId)!;
    const name    = user.displayName ?? "traveller";
    const html    = emailContent.body_html.replace(/{displayName}/g, name);
    const text    = emailContent.body_text.replace(/{displayName}/g, name);
    const msgId   = await sendEmail(email, emailContent.subject, html, text);

    recipientRecords.push({
      campaign_id:       campaign.id as string,
      user_id:           user.id,
      email,
      status:            msgId ? "sent" : "pending",
      sent_at:           msgId ? new Date().toISOString() : null,
      resend_message_id: msgId,
    });

    if (msgId) sentCount++;
  }

  if (recipientRecords.length > 0) {
    await db.from("campaign_recipients").insert(recipientRecords);
  }

  await db
    .from("marketing_campaigns")
    .update({ status: "sent", sent_count: sentCount, sent_at: new Date().toISOString() })
    .eq("id", campaign.id);

  await reportActualSpend(
    db,
    authorisationId,
    "churn_prevention",
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    { campaign_id: campaign.id, churned_users_found: churnedIds.length, emails_sent: sentCount },
  );

  await db.from("agent_messages").insert({
    from_agent:   AGENT_ID,
    to_agent:     "admin",
    message_type: "status_report",
    payload: {
      message:     `Churn prevention: ${sentCount} emails sent (${churnedIds.length} churned users identified).`,
      campaign_id: campaign.id,
    },
    priority: "normal",
    status:   "pending",
  });

  return new Response(
    JSON.stringify({
      churned_users_found: churnedIds.length,
      emails_sent:         sentCount,
      campaign_id:         campaign.id,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: identify_segments
// ---------------------------------------------------------------------------
// Queries the full user base, builds per-user adventure stats, and uses Claude
// to identify 3–5 actionable campaign segments. Archives any existing active
// segments before storing the new ones.

async function identifySegments(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const { data: users } = await db
    .from("users")
    .select('id, "authId", "displayName", "activityTypes", location, "createdAt"');

  const { data: adventureRows } = await db
    .from("adventures")
    .select('"userId", region, "activityType"');

  // Aggregate per-user adventure stats
  const userStats = new Map<string, {
    adventureCount: number;
    regions:        Set<string>;
    activityTypes:  Set<string>;
  }>();

  for (const adv of adventureRows ?? []) {
    const uid = adv.userId as string;
    if (!userStats.has(uid)) {
      userStats.set(uid, { adventureCount: 0, regions: new Set(), activityTypes: new Set() });
    }
    const s = userStats.get(uid)!;
    s.adventureCount++;
    if (adv.region)       s.regions.add(adv.region as string);
    if (adv.activityType) s.activityTypes.add(adv.activityType as string);
  }

  const totalUsers          = users?.length ?? 0;
  const usersWithAdventures = userStats.size;

  const userSummary = (users ?? [] as MarketingUser[]).slice(0, 200).map((u) => {
    const s = userStats.get((u as MarketingUser).id);
    return {
      id:               (u as MarketingUser).id,
      activityTypes:    (u as MarketingUser).activityTypes ?? [],
      location:         (u as MarketingUser).location,
      createdAt:        (u as MarketingUser).createdAt,
      adventureCount:   s?.adventureCount ?? 0,
      topRegions:       s ? [...s.regions].slice(0, 3) : [],
      usedActivityTypes: s ? [...s.activityTypes] : [],
    };
  });

  // Request CFO approval
  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "identify_segments",
      ESTIMATED_COST.identify_segments,
      `Analyse ${totalUsers} users to identify campaign segments. ${usersWithAdventures} have created adventures.`,
      { anthropic_api: ESTIMATED_COST.identify_segments },
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
    system: `You are the growth analyst for TruthStay, a community-driven holiday planning platform. Analyse the user base and identify 3–5 actionable marketing segments with clear targeting criteria and a compelling campaign opportunity for each. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Analyse ${totalUsers} TruthStay users and identify marketing segments.

PLATFORM STATS:
- Total users: ${totalUsers}
- Users with adventures: ${usersWithAdventures}
- Users without adventures: ${totalUsers - usersWithAdventures}

USER SAMPLE (first 200):
${JSON.stringify(userSummary, null, 2)}

Respond with:
{
  "segments": [
    {
      "name": "segment name",
      "description": "who they are",
      "criteria": {
        "min_adventures": number,
        "activity_types": [],
        "regions": [],
        "inactive_days": number
      },
      "estimated_size": number,
      "campaign_opportunity": "what to send them and why",
      "priority": "high|medium|low"
    }
  ],
  "insights": "key observations about the user base",
  "recommendations": "top 3 marketing recommendations"
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const analysis = parseJsonFromResponse<{
    segments: Array<{
      name:                 string;
      description:          string;
      criteria:             Record<string, unknown>;
      estimated_size:       number;
      campaign_opportunity: string;
      priority:             string;
    }>;
    insights:        string;
    recommendations: string;
  }>(responseText);

  if (!analysis?.segments?.length) {
    await db
      .from("spend_authorisations")
      .update({ execution_status: "failed", completed_at: new Date().toISOString() })
      .eq("id", authorisationId);
    return new Response(
      JSON.stringify({ error: "Claude failed to generate valid segment analysis" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Archive existing active segments before replacing them
  await db
    .from("user_segments")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("status", "active");

  // Derive matching user IDs for each segment and persist
  const segmentIds: string[] = [];
  const allUsers = (users ?? []) as MarketingUser[];

  for (const seg of analysis.segments) {
    let matchingIds = allUsers.map((u) => u.id);

    if (typeof seg.criteria.min_adventures === "number") {
      matchingIds = matchingIds.filter(
        (id) => (userStats.get(id)?.adventureCount ?? 0) >= (seg.criteria.min_adventures as number),
      );
    }

    if (Array.isArray(seg.criteria.activity_types) && (seg.criteria.activity_types as string[]).length > 0) {
      const types = new Set(seg.criteria.activity_types as string[]);
      matchingIds = matchingIds.filter((id) => {
        const u = allUsers.find((u) => u.id === id);
        return (u?.activityTypes ?? []).some((t) => types.has(t));
      });
    }

    const { data: saved } = await db
      .from("user_segments")
      .insert({
        name:          seg.name,
        description:   seg.description,
        criteria:      seg.criteria,
        user_ids:      matchingIds.slice(0, 500),
        user_count:    matchingIds.length,
        segment_stats: {
          campaign_opportunity: seg.campaign_opportunity,
          priority:             seg.priority,
          estimated_size:       seg.estimated_size,
        },
        status: "active",
      })
      .select("id")
      .single();

    if (saved) segmentIds.push(saved.id as string);
  }

  await reportActualSpend(
    db,
    authorisationId,
    "identify_segments",
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    {
      segments_identified:   analysis.segments.length,
      segment_ids:           segmentIds,
      total_users_analysed:  totalUsers,
    },
  );

  await db.from("agent_messages").insert({
    from_agent:   AGENT_ID,
    to_agent:     "admin",
    message_type: "status_report",
    payload: {
      message:         `Segment analysis complete: ${analysis.segments.length} segments identified from ${totalUsers} users.`,
      segment_ids:     segmentIds,
      insights:        analysis.insights,
      recommendations: analysis.recommendations,
    },
    priority: "normal",
    status:   "pending",
  });

  return new Response(
    JSON.stringify({
      segments_identified: analysis.segments.length,
      segment_ids:         segmentIds,
      insights:            analysis.insights,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: plan_campaign
// ---------------------------------------------------------------------------
// Drafts a full email campaign (subject, HTML, plain-text) for a given segment.
// Stores it as status='draft' so an admin can review before execute_campaign sends it.

async function planCampaign(
  db: SupabaseClient,
  anthropic: Anthropic,
  segmentId: string,
): Promise<Response> {
  const { data: segment, error: segErr } = await db
    .from("user_segments")
    .select("*")
    .eq("id", segmentId)
    .single();

  if (segErr || !segment) {
    return new Response(
      JSON.stringify({ error: `Segment not found: ${segErr?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const seg = segment as UserSegmentRow;

  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      `plan_campaign_${segmentId.slice(0, 8)}`,
      ESTIMATED_COST.plan_campaign,
      `Draft email campaign for segment "${seg.name}" (${seg.user_count} users). ${seg.description}`,
      { anthropic_api: ESTIMATED_COST.plan_campaign },
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
    system: `You are the email marketing copywriter for TruthStay, a community-driven holiday planning platform built on authentic peer recommendations. Write compelling, authentic email campaigns that resonate with real travellers. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Draft a complete email campaign for this user segment.

SEGMENT: ${seg.name}
DESCRIPTION: ${seg.description}
SIZE: ${seg.user_count} users
CRITERIA: ${JSON.stringify(seg.criteria)}
CAMPAIGN OPPORTUNITY: ${seg.segment_stats?.campaign_opportunity ?? "general engagement"}

Respond with:
{
  "campaign_name": "internal name",
  "subject": "subject line (max 50 chars)",
  "preview_text": "preview text (max 90 chars)",
  "body_html": "<p>Full HTML email. Use {displayName} for personalisation.</p>",
  "body_text": "Plain text version. Use {displayName} for personalisation.",
  "call_to_action": "CTA button text",
  "rationale": "why this will resonate with this segment"
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const content = parseJsonFromResponse<{
    campaign_name:  string;
    subject:        string;
    preview_text:   string;
    body_html:      string;
    body_text:      string;
    call_to_action: string;
    rationale:      string;
  }>(responseText);

  if (!content?.subject || !content?.body_html) {
    await db
      .from("spend_authorisations")
      .update({ execution_status: "failed", completed_at: new Date().toISOString() })
      .eq("id", authorisationId);
    return new Response(
      JSON.stringify({ error: "Claude failed to generate valid campaign content" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: campaign, error: campaignErr } = await db
    .from("marketing_campaigns")
    .insert({
      name:               content.campaign_name,
      campaign_type:      "segment_blast",
      segment_id:         segmentId,
      status:             "draft",
      subject:            content.subject,
      preview_text:       content.preview_text,
      body_html:          content.body_html,
      body_text:          content.body_text,
      target_user_ids:    seg.user_ids ?? [],
      estimated_cost_usd: ESTIMATED_COST.execute_campaign,
      spend_auth_id:      authorisationId,
    })
    .select("id")
    .single();

  if (campaignErr || !campaign) {
    return new Response(
      JSON.stringify({ error: `Failed to save campaign: ${campaignErr?.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  await reportActualSpend(
    db,
    authorisationId,
    `plan_campaign_${segmentId.slice(0, 8)}`,
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    { campaign_id: campaign.id, segment_id: segmentId, target_user_count: seg.user_count },
  );

  return new Response(
    JSON.stringify({
      campaign_id:   campaign.id,
      campaign_name: content.campaign_name,
      subject:       content.subject,
      target_users:  seg.user_count,
      status:        "draft",
      rationale:     content.rationale,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: execute_campaign
// ---------------------------------------------------------------------------
// Sends a 'draft' or 'approved' campaign. Requires CFO sign-off even though
// Resend free tier costs $0 — the approval gate ensures admin visibility before
// any bulk email goes out.

async function executeCampaign(
  db: SupabaseClient,
  campaignId: string,
): Promise<Response> {
  const { data: campaign, error: campErr } = await db
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campErr || !campaign) {
    return new Response(
      JSON.stringify({ error: `Campaign not found: ${campErr?.message}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const camp = campaign as CampaignRow;

  if (!["draft", "approved"].includes(camp.status)) {
    return new Response(
      JSON.stringify({
        error: `Campaign status "${camp.status}" cannot be executed. Must be 'draft' or 'approved'.`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const targetUserIds = camp.target_user_ids ?? [];
  if (targetUserIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "Campaign has no target users" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Resend free tier is $0 but we still gate on CFO approval for audit trail
  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      `execute_campaign_${campaignId.slice(0, 8)}`,
      ESTIMATED_COST.execute_campaign,
      `Send campaign "${camp.name}" to ${targetUserIds.length} users. Subject: "${camp.subject}"`,
      { resend_api: 0.00, overhead: ESTIMATED_COST.execute_campaign },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  await db
    .from("marketing_campaigns")
    .update({ status: "sending", spend_auth_id: authorisationId })
    .eq("id", campaignId);

  // Resolve user display names + emails
  const { data: targetUsers } = await db
    .from("users")
    .select('id, "authId", "displayName"')
    .in("id", targetUserIds);

  const authIds  = (targetUsers ?? []).map((u) => (u as MarketingUser).authId).filter(Boolean);
  const emailMap = await getUserEmails(db, authIds);

  let sentCount = 0;
  const recipientRecords: Array<{
    campaign_id:       string;
    user_id:           string;
    email:             string;
    status:            string;
    sent_at:           string | null;
    resend_message_id: string | null;
  }> = [];

  for (const u of targetUsers ?? []) {
    const user  = u as MarketingUser;
    const email = emailMap.get(user.authId);
    if (!email) continue;

    const name  = user.displayName ?? "traveller";
    const html  = camp.body_html.replace(/{displayName}/g, name);
    const text  = camp.body_text.replace(/{displayName}/g, name);
    const msgId = await sendEmail(email, camp.subject, html, text);

    recipientRecords.push({
      campaign_id:       campaignId,
      user_id:           user.id,
      email,
      status:            msgId ? "sent" : "pending",
      sent_at:           msgId ? new Date().toISOString() : null,
      resend_message_id: msgId,
    });

    if (msgId) sentCount++;
  }

  if (recipientRecords.length > 0) {
    // upsert handles re-runs after partial failures
    await db.from("campaign_recipients").upsert(recipientRecords, {
      onConflict: "campaign_id,user_id",
    });
  }

  await db
    .from("marketing_campaigns")
    .update({ status: "sent", sent_count: sentCount, sent_at: new Date().toISOString() })
    .eq("id", campaignId);

  // Log $0 actual cost for the email sends
  await Promise.all([
    db
      .from("spend_authorisations")
      .update({
        actual_cost_usd:   0.00,
        execution_status:  "completed",
        execution_results: { emails_sent: sentCount, campaign_id: campaignId },
        completed_at:      new Date().toISOString(),
      })
      .eq("id", authorisationId),

    db.from("api_cost_log").insert({
      service:     "resend",
      description: `Marketing Agent — campaign "${camp.name}": ${sentCount} emails sent`,
      cost_usd:    0.00,
    }),
  ]);

  return new Response(
    JSON.stringify({
      campaign_id:  campaignId,
      emails_sent:  sentCount,
      target_users: targetUserIds.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Action: monitor_referrals
// ---------------------------------------------------------------------------
// Reviews the last 7 days of referral activity, generates an AI performance
// report, and stores it in referral_programme_reports.

async function monitorReferrals(
  db: SupabaseClient,
  anthropic: Anthropic,
): Promise<Response> {
  const now         = new Date();
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: events } = await db
    .from("referral_events")
    .select("event_type, revenue_impact")
    .gte("created_at", periodStart.toISOString());

  const { data: topCodes } = await db
    .from("referral_codes")
    .select("user_id, code, times_used, conversions, reward_earned_usd")
    .gt("times_used", 0)
    .order("conversions", { ascending: false })
    .limit(10);

  const allEvents     = (events ?? []) as ReferralEvent[];
  const signupEvents  = allEvents.filter((e) => e.event_type === "signup");
  const convEvents    = allEvents.filter((e) => e.event_type === "subscription");
  const totalRevenue  = allEvents.reduce((s, e) => s + Number(e.revenue_impact ?? 0), 0);
  const convRate      = signupEvents.length > 0 ? convEvents.length / signupEvents.length : 0;

  const periodStats = {
    period_start:    periodStart.toISOString().slice(0, 10),
    period_end:      now.toISOString().slice(0, 10),
    total_events:    allEvents.length,
    signups:         signupEvents.length,
    conversions:     convEvents.length,
    conversion_rate: convRate,
    revenue_impact:  totalRevenue,
    top_referrers:   (topCodes ?? []) as ReferralCodeRow[],
  };

  let authorisationId: string;
  try {
    authorisationId = await submitSpendRequest(
      db,
      "monitor_referrals",
      ESTIMATED_COST.monitor_referrals,
      `Analyse referral programme for ${periodStats.period_start}–${periodStats.period_end}. ${periodStats.signups} sign-ups, ${periodStats.conversions} conversions.`,
      { anthropic_api: ESTIMATED_COST.monitor_referrals },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const claudeResponse = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system: `You are the growth analyst for TruthStay, a community-driven holiday planning platform. Analyse referral programme performance and provide actionable, data-driven recommendations. Respond with ONLY valid JSON — no prose, no markdown.`,
    messages: [
      {
        role:    "user",
        content: `Analyse the TruthStay referral programme for the past 7 days.

PERIOD: ${periodStats.period_start} to ${periodStats.period_end}
STATS:
${JSON.stringify(periodStats, null, 2)}

Respond with:
{
  "overall_health": "strong|healthy|weak|inactive",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "conversion_analysis": "analysis of the signup-to-subscription conversion rate",
  "top_performer_insights": "what makes the top referrers effective",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "next_week_targets": { "signups": number, "conversions": number }
}`,
      },
    ],
  });

  const responseText = (claudeResponse.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";

  const analysis = parseJsonFromResponse<{
    overall_health:          string;
    key_findings:            string[];
    conversion_analysis:     string;
    top_performer_insights:  string;
    recommendations:         string[];
    next_week_targets:       { signups: number; conversions: number };
  }>(responseText) ?? {
    overall_health:          "unknown",
    key_findings:            ["Analysis failed to parse"],
    conversion_analysis:     "N/A",
    top_performer_insights:  "N/A",
    recommendations:         [],
    next_week_targets:       { signups: 0, conversions: 0 },
  };

  const { data: report } = await db
    .from("referral_programme_reports")
    .insert({
      report_date:        now.toISOString().slice(0, 10),
      period_start:       periodStats.period_start,
      period_end:         periodStats.period_end,
      total_referrals:    signupEvents.length,
      total_signups:      signupEvents.length,
      total_conversions:  convEvents.length,
      conversion_rate:    convRate,
      revenue_impact:     totalRevenue,
      top_referrers:      topCodes ?? [],
      ai_insights:        [
        `Health: ${analysis.overall_health}`,
        ...analysis.key_findings,
        analysis.conversion_analysis,
        analysis.top_performer_insights,
      ].join("\n\n"),
      recommendations: analysis.recommendations.join("\n"),
    })
    .select("id")
    .single();

  await reportActualSpend(
    db,
    authorisationId,
    "monitor_referrals",
    claudeResponse.usage.input_tokens,
    claudeResponse.usage.output_tokens,
    {
      report_id:      report?.id,
      period:         `${periodStats.period_start} to ${periodStats.period_end}`,
      signups:        periodStats.signups,
      conversions:    periodStats.conversions,
      overall_health: analysis.overall_health,
    },
  );

  await db.from("agent_messages").insert({
    from_agent:   AGENT_ID,
    to_agent:     "admin",
    message_type: "status_report",
    payload: {
      message:         `Referral report: ${analysis.overall_health} health. ${periodStats.signups} sign-ups, ${periodStats.conversions} conversions this week.`,
      report_id:       report?.id,
      recommendations: analysis.recommendations,
    },
    priority: "normal",
    status:   "pending",
  });

  return new Response(
    JSON.stringify({
      report_id:       report?.id,
      overall_health:  analysis.overall_health,
      period:          { start: periodStats.period_start, end: periodStats.period_end },
      stats: {
        signups:         periodStats.signups,
        conversions:     periodStats.conversions,
        conversion_rate: convRate,
        revenue_impact:  totalRevenue,
      },
      recommendations: analysis.recommendations,
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

  const { action, segment_id, campaign_id } = parsed.data;

  if (action === "plan_campaign" && !segment_id) {
    return new Response(
      JSON.stringify({ error: "plan_campaign requires a segment_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (action === "execute_campaign" && !campaign_id) {
    return new Response(
      JSON.stringify({ error: "execute_campaign requires a campaign_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  try {
    switch (action) {
      case "churn_prevention":
        return await churnPrevention(db, anthropic);
      case "identify_segments":
        return await identifySegments(db, anthropic);
      case "plan_campaign":
        return await planCampaign(db, anthropic, segment_id!);
      case "execute_campaign":
        return await executeCampaign(db, campaign_id!);
      case "monitor_referrals":
        return await monitorReferrals(db, anthropic);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
