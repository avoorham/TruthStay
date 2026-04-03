#!/usr/bin/env node
/**
 * review-team.ts — 3-agent parallel code review
 *
 * Usage:
 *   npx tsx scripts/review-team.ts               # uncommitted changes (git diff HEAD)
 *   npx tsx scripts/review-team.ts main...HEAD   # PR branch vs main
 *   npx tsx scripts/review-team.ts <any git ref>
 *
 * Requires: ANTHROPIC_API_KEY in environment.
 * Outputs:  markdown report to stdout, raw JSON to stderr.
 */

import { execSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
const DIFF_CHAR_LIMIT = 200_000;
const CHUNK_CHAR_SIZE  = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low" | "info";
type AgentName = "security" | "performance" | "test";

interface Finding {
  severity: Severity;
  file: string;
  line?: number;
  title: string;
  detail: string;
  suggestion: string;
  snippet?: string;
}

interface ReviewFindings {
  agent: AgentName;
  summary: string;
  findings: Finding[];
  stats: Record<Severity, number>;
}

interface Report {
  timestamp: string;
  diffRef: string;
  agents: ReviewFindings[];
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

function getDiff(ref: string): string {
  const exclude = [
    ":(exclude)pnpm-lock.yaml",
    ":(exclude)package-lock.json",
    ":(exclude)yarn.lock",
    ":(exclude)*.snap",
  ].join(" ");
  try {
    return execSync(`git diff ${ref} -- . ${exclude}`, {
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024,
    }).toString();
  } catch {
    return execSync(`git diff ${ref}`, {
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024,
    }).toString();
  }
}

function chunkDiff(diff: string): string[] {
  if (diff.length <= DIFF_CHAR_LIMIT) return [diff];
  const sections = diff.split(/(?=^diff --git )/m);
  const chunks: string[] = [];
  let current = "";
  for (const section of sections) {
    if (current.length + section.length > CHUNK_CHAR_SIZE && current.length > 0) {
      chunks.push(current);
      current = "";
    }
    current += section;
  }
  if (current) chunks.push(current);
  return chunks;
}

// ─── System prompts ───────────────────────────────────────────────────────────

const SECURITY_SYSTEM = `\
You are a security-focused code reviewer for a Next.js 15 + Expo React Native monorepo \
(TruthStay — sport travel app, Supabase/Postgres backend, Anthropic Claude AI agents).

Review the provided git diff for security vulnerabilities. Focus on:

1. AUTH BYPASSES — routes that call createAdminClient() (service-role key, bypasses RLS) \
on unauthenticated endpoints; user-supplied IDs used without ownership verification.
2. INJECTION — SQL injection, prompt injection into LLM system prompts via user-controlled \
RAG content, unvalidated enum/string values written directly to the database.
3. EXPOSED SECRETS — API keys, service-role keys logged or returned in responses.
4. PRIVILEGE ESCALATION — admin-gated routes missing isAdmin checks; user-controlled data \
written to privileged fields.
5. BROKEN LOGIC — idempotency failures (e.g. approving a draft twice causes duplicate rows), \
race conditions in upsert patterns.
6. INSECURE DEFAULTS — CORS wildcard on mutation endpoints, missing input validation \
on numeric range fields.

Only flag ADDED or MODIFIED code (lines beginning with "+"). Do not flag removed code.

Severity:
- critical: exploitable immediately without authentication, or exposes production secrets
- high: exploitable with a normal user account, or leads to data corruption
- medium: requires specific conditions or has limited impact
- low: defence-in-depth concern, not directly exploitable
- info: hygiene / style with no immediate security impact

Respond with ONLY a valid JSON object — no markdown fences, no prose outside the JSON:
{
  "agent": "security",
  "summary": "1-2 sentence overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/to/file.ts",
      "line": <optional number>,
      "title": "short title (≤80 chars)",
      "detail": "2-5 sentences of explanation",
      "suggestion": "concrete fix",
      "snippet": "optional verbatim code fragment from the diff"
    }
  ],
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
}`;

const PERFORMANCE_SYSTEM = `\
You are a performance-focused code reviewer for a Next.js 15 API + Expo React Native monorepo \
(TruthStay — sport travel app, Supabase/Postgres backend).

Review the provided git diff for performance problems. Focus on:

1. N+1 QUERIES — sequential await inside for...of loops that hit Supabase/Postgres; \
should be batched into a single insert/upsert or RPC call.
2. MISSING PAGINATION — queries fetching unbounded result sets (no .range() or .limit()), \
especially on public endpoints whose data grows with usage.
3. MISSING INDEXES — columns used in .eq(), .ilike(), .gte() filters or ORDER BY that are \
unlikely to be indexed (e.g. computed columns, infrequent access patterns).
4. LARGE PAYLOADS — selecting full JSONB columns in list queries; uncompressed data returned \
to clients; embedding vectors included in API responses.
5. NO RATE LIMITING — endpoints calling OpenAI/Anthropic APIs or doing expensive DB work \
with no rate limit, debounce, or concurrency guard.
6. REDUNDANT COMPUTATION — embeddings regenerated on every request with no cache; \
sequential AI agent calls that could use Promise.allSettled with a concurrency limit.

Only flag ADDED or MODIFIED code (lines beginning with "+").

Severity:
- critical: will cause production outage or cascading DB load under normal traffic
- high: visible latency or cost explosion at moderate scale (>100 DAU)
- medium: noticeable degradation, addressable before launch
- low: micro-optimisation, minimal real-world impact
- info: observation with no immediate performance consequence

Respond with ONLY a valid JSON object — no markdown fences, no prose outside the JSON:
{
  "agent": "performance",
  "summary": "1-2 sentence overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/to/file.ts",
      "line": <optional number>,
      "title": "short title (≤80 chars)",
      "detail": "2-5 sentences of explanation",
      "suggestion": "concrete fix",
      "snippet": "optional verbatim code fragment from the diff"
    }
  ],
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
}`;

const TEST_SYSTEM = `\
You are a test-coverage-focused code reviewer for a Next.js 15 + Expo React Native monorepo \
(TruthStay — sport travel app).

Review the provided git diff for missing test coverage and broken code paths. Focus on:

1. ZERO TEST FILES — new .ts/.tsx source files with no corresponding .test.ts or .spec.ts \
added in the same diff. The absence of a test file for a new source file is itself a finding.
2. DEAD / BROKEN CODE — statements that cannot execute as written: e.g. passing a \
PostgrestFilterBuilder object (db.rpc(...)) where a plain number value is expected, \
calling .catch() on a type that doesn't have it, etc.
3. UNTESTED ERROR PATHS — try/catch blocks that silently swallow errors \
(/* non-critical */, catch {}), especially when those errors affect user-visible state.
4. MISSING EDGE CASES — numeric fields used without bounds validation (ratings 1–5, \
dayNumber ≥ 1), optional return values used without null/undefined checks.
5. MISSING AUTH TESTS — routes gated on isAdmin with no test verifying 403 for normal users.
6. ASYNC ISSUES — fire-and-forget async calls whose rejection is unobservable; \
upsert-then-read patterns that may return stale data.

Only flag ADDED or MODIFIED code (lines beginning with "+"). Absence of a test file counts.

Severity:
- critical: broken code that produces wrong results in production today
- high: critical path (auth, data mutation) with no test coverage at all
- medium: realistic edge case uncovered, likely to trigger under normal use
- low: nice-to-have coverage, low probability of hitting
- info: test quality suggestion with no production risk

Respond with ONLY a valid JSON object — no markdown fences, no prose outside the JSON:
{
  "agent": "test",
  "summary": "1-2 sentence overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/to/file.ts",
      "line": <optional number>,
      "title": "short title (≤80 chars)",
      "detail": "2-5 sentences of explanation",
      "suggestion": "concrete fix",
      "snippet": "optional verbatim code fragment from the diff"
    }
  ],
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
}`;

// ─── Agent runner ─────────────────────────────────────────────────────────────

const ZERO_STATS = (): Record<Severity, number> =>
  ({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });

async function runAgent(
  client: Anthropic,
  agentName: AgentName,
  systemPrompt: string,
  diff: string,
): Promise<ReviewFindings> {
  const chunks = chunkDiff(diff);
  const allFindings: Finding[] = [];
  const allSummaries: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks.length > 1
      ? `Chunk ${i + 1} of ${chunks.length}:\n\n${chunks[i]}`
      : chunks[i];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: `Review this diff:\n\n${content}` }],
    });

    const text = response.content.find(b => b.type === "text")?.text ?? "";
    // Strip markdown fences the model may emit despite instructions
    const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) continue;

    try {
      const parsed = JSON.parse(match[0]) as ReviewFindings;
      allFindings.push(...(parsed.findings ?? []));
      if (parsed.summary) allSummaries.push(parsed.summary);
    } catch { /* skip malformed chunk */ }
  }

  // Recompute stats from merged findings (avoids double-counting on multi-chunk)
  const stats = ZERO_STATS();
  for (const f of allFindings) stats[f.severity]++;

  return {
    agent: agentName,
    summary: allSummaries.join(" ") || "No findings.",
    findings: allFindings,
    stats,
  };
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

const BADGE: Record<Severity, string> = {
  critical: "🔴 CRITICAL",
  high:     "🟠 HIGH",
  medium:   "🟡 MEDIUM",
  low:      "🔵 LOW",
  info:     "⚪ INFO",
};

function renderMarkdown(report: Report): string {
  const lines: string[] = [];

  lines.push(`# Code Review: \`${report.diffRef}\``);
  lines.push(`*${report.timestamp}*`);
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("| Agent | Critical | High | Medium | Low | Info | Total |");
  lines.push("|-------|:--------:|:----:|:------:|:---:|:----:|:-----:|");
  for (const a of report.agents) {
    const total = Object.values(a.stats).reduce((s, n) => s + n, 0);
    lines.push(`| **${a.agent}** | ${a.stats.critical} | ${a.stats.high} | ${a.stats.medium} | ${a.stats.low} | ${a.stats.info} | ${total} |`);
  }
  lines.push("");

  // Top findings
  const topFindings = report.agents
    .flatMap(a => a.findings.map(f => ({ ...f, agentName: a.agent })))
    .filter(f => f.severity === "critical" || f.severity === "high")
    .sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1));

  if (topFindings.length > 0) {
    lines.push("## Critical & High Findings");
    for (const f of topFindings) {
      lines.push(`### ${BADGE[f.severity]} — ${f.title}`);
      lines.push(`**Agent:** ${f.agentName} · **File:** \`${f.file}\`${f.line != null ? ` · **Line:** ~${f.line}` : ""}`);
      lines.push("");
      lines.push(f.detail);
      lines.push("");
      lines.push(`**Fix:** ${f.suggestion}`);
      if (f.snippet) {
        lines.push("```");
        lines.push(f.snippet);
        lines.push("```");
      }
      lines.push("");
    }
  }

  // Per-agent sections
  for (const a of report.agents) {
    const cap = a.agent.charAt(0).toUpperCase() + a.agent.slice(1);
    lines.push(`## ${cap} Agent`);
    lines.push(`*${a.summary}*`);
    lines.push("");

    if (a.findings.length === 0) {
      lines.push("No findings.");
      lines.push("");
      continue;
    }

    // Group by file
    const byFile = new Map<string, typeof a.findings>();
    for (const f of a.findings) {
      const arr = byFile.get(f.file) ?? [];
      arr.push(f);
      byFile.set(f.file, arr);
    }

    for (const [file, findings] of byFile.entries()) {
      lines.push(`### \`${file}\``);
      for (const f of findings) {
        lines.push(`- **${BADGE[f.severity]}** ${f.title}`);
        lines.push(`  ${f.detail}`);
        lines.push(`  *Fix:* ${f.suggestion}`);
        if (f.snippet) {
          lines.push("  ```");
          lines.push(`  ${f.snippet}`);
          lines.push("  ```");
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const diffRef = process.argv[2] ?? "HEAD";
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    process.stderr.write("Error: ANTHROPIC_API_KEY is not set.\n");
    process.exit(1);
  }

  process.stderr.write(`[review-team] Fetching diff for ref: ${diffRef}\n`);
  const diff = getDiff(diffRef);

  if (!diff.trim()) {
    process.stderr.write("[review-team] No changes found — nothing to review.\n");
    process.exit(0);
  }

  process.stderr.write(`[review-team] Diff: ${diff.split("\n").length} lines, ${diff.length} chars\n`);

  if (diff.length > DIFF_CHAR_LIMIT) {
    const est = Math.ceil(diff.length / CHUNK_CHAR_SIZE);
    process.stderr.write(`[review-team] Large diff — will split into ~${est} chunks per agent\n`);
  }

  const client = new Anthropic({ apiKey });

  process.stderr.write("[review-team] Spawning 3 agents in parallel...\n");
  const [security, performance, test] = await Promise.all([
    runAgent(client, "security",    SECURITY_SYSTEM,    diff),
    runAgent(client, "performance", PERFORMANCE_SYSTEM, diff),
    runAgent(client, "test",        TEST_SYSTEM,        diff),
  ]);
  process.stderr.write("[review-team] All agents complete.\n");

  const report: Report = {
    timestamp: new Date().toISOString(),
    diffRef,
    agents: [security, performance, test],
  };

  // Machine-readable JSON → stderr (keeps stdout clean for piping markdown)
  process.stderr.write("\n" + JSON.stringify(report, null, 2) + "\n");

  // Human-readable markdown → stdout
  process.stdout.write(renderMarkdown(report) + "\n");
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
