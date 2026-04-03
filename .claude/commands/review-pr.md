---
description: Run a 3-agent parallel code review (security, performance, test coverage) on uncommitted changes or a PR branch.
---

# /review-pr — Parallel Code Review Agent Team

Spawn three specialised review agents **simultaneously** using the Agent tool. Each reviews the same diff from a different angle and returns structured findings.

## Step 1: Get the diff

Run this command and capture the output as the diff to review:

```bash
git diff $ARGUMENTS -- . ':(exclude)pnpm-lock.yaml' ':(exclude)package-lock.json' ':(exclude)yarn.lock' ':(exclude)*.snap'
```

If `$ARGUMENTS` is empty, default to `HEAD` (uncommitted changes):

```bash
git diff HEAD -- . ':(exclude)pnpm-lock.yaml' ':(exclude)package-lock.json' ':(exclude)yarn.lock' ':(exclude)*.snap'
```

If the diff is empty, stop and tell the user there is nothing to review.

Note the total character count. If it exceeds 500,000 characters, warn the user this is a very large diff and the review may take longer.

## Step 2: Spawn 3 agents IN PARALLEL

Use the Agent tool to launch all three agents in a **single message** with three simultaneous tool calls. Do NOT wait for one to finish before starting the next.

Pass the **full diff text** to each agent inside their prompt.

---

### Security Agent prompt

```
You are a security-focused code reviewer for TruthStay — a Next.js 15 + Expo React Native monorepo using Supabase/Postgres and Anthropic Claude AI agents.

Review this git diff for security vulnerabilities:

Focus on:
1. AUTH BYPASSES — routes calling createAdminClient() (service-role key, bypasses RLS) on unauthenticated endpoints; user-supplied IDs used without ownership verification.
2. INJECTION — SQL injection, prompt injection into LLM system prompts via user-controlled RAG content, unvalidated enum values written directly to the database.
3. EXPOSED SECRETS — API keys or service-role keys logged or returned in responses.
4. PRIVILEGE ESCALATION — admin-gated routes missing isAdmin checks; user-controlled data written to privileged fields.
5. BROKEN LOGIC — idempotency failures (duplicate rows on double-approve), race conditions in upsert patterns.
6. INSECURE DEFAULTS — missing input validation on numeric range fields, CORS wildcard on mutation endpoints.

Only flag ADDED or MODIFIED code (lines beginning with "+").

Severity: critical = exploitable without auth; high = exploitable as normal user; medium = conditional; low = defence-in-depth; info = hygiene.

Return ONLY a valid JSON object in this exact shape (no markdown fences):
{
  "agent": "security",
  "summary": "1-2 sentence overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/file.ts",
      "line": <optional number>,
      "title": "short title ≤80 chars",
      "detail": "2-5 sentences",
      "suggestion": "concrete fix",
      "snippet": "optional verbatim code from diff"
    }
  ],
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
}

DIFF:
[INSERT FULL DIFF HERE]
```

---

### Performance Agent prompt

```
You are a performance-focused code reviewer for TruthStay — a Next.js 15 API + Expo React Native monorepo with a Supabase/Postgres backend.

Review this git diff for performance problems:

Focus on:
1. N+1 QUERIES — sequential await inside for...of loops hitting Supabase; should be batched.
2. MISSING PAGINATION — queries with no .range() or .limit() on public endpoints that grow with data.
3. MISSING INDEXES — filter columns (.eq, .ilike, .gte) or ORDER BY columns unlikely to be indexed.
4. LARGE PAYLOADS — full JSONB columns selected in list queries; embedding vectors returned to client.
5. NO RATE LIMITING — endpoints calling OpenAI/Anthropic with no rate limit or concurrency guard.
6. REDUNDANT COMPUTATION — embeddings regenerated every request with no cache; sequential AI calls that should use Promise.allSettled with a concurrency limiter.

Only flag ADDED or MODIFIED code (lines beginning with "+").

Severity: critical = production outage under normal load; high = visible latency at >100 DAU; medium = noticeable at scale; low = micro-optimisation; info = observation.

Return ONLY a valid JSON object in this exact shape (no markdown fences):
{
  "agent": "performance",
  "summary": "1-2 sentence overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/file.ts",
      "line": <optional number>,
      "title": "short title ≤80 chars",
      "detail": "2-5 sentences",
      "suggestion": "concrete fix",
      "snippet": "optional verbatim code from diff"
    }
  ],
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
}

DIFF:
[INSERT FULL DIFF HERE]
```

---

### Test Agent prompt

```
You are a test-coverage-focused code reviewer for TruthStay — a Next.js 15 + Expo React Native monorepo.

Review this git diff for missing test coverage and broken code paths:

Focus on:
1. ZERO TEST FILES — new .ts/.tsx files with no corresponding .test.ts or .spec.ts. The absence of a test file is itself a finding.
2. DEAD / BROKEN CODE — statements that cannot execute correctly: e.g. db.rpc() returning a PostgrestFilterBuilder object passed where a number is expected, .catch() on a non-Promise type.
3. UNTESTED ERROR PATHS — try/catch blocks silently swallowing errors (/* non-critical */, empty catch) that affect user-visible state.
4. MISSING EDGE CASES — numeric fields used without bounds validation (ratings 1-5, dayNumber ≥ 1), nullable return values used without null-checks.
5. MISSING AUTH TESTS — routes gated on isAdmin with no test verifying 403 for normal users.
6. ASYNC ISSUES — fire-and-forget async calls whose rejection is unobservable; upsert-then-read that may return stale data.

Only flag ADDED or MODIFIED code (lines beginning with "+"). Absence of a test file counts as a finding.

Severity: critical = broken code producing wrong results today; high = critical path with no test; medium = realistic edge case uncovered; low = nice-to-have; info = suggestion.

Return ONLY a valid JSON object in this exact shape (no markdown fences):
{
  "agent": "test",
  "summary": "1-2 sentence overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "file": "relative/path/file.ts",
      "line": <optional number>,
      "title": "short title ≤80 chars",
      "detail": "2-5 sentences",
      "suggestion": "concrete fix",
      "snippet": "optional verbatim code from diff"
    }
  ],
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
}

DIFF:
[INSERT FULL DIFF HERE]
```

---

## Step 3: Collect and parse results

Wait for all three agents to complete. Parse each agent's JSON response.

If an agent returns non-parseable output, use this fallback:
```json
{ "agent": "<name>", "summary": "Agent returned no parseable JSON.", "findings": [], "stats": {"critical":0,"high":0,"medium":0,"low":0,"info":0} }
```

## Step 4: Render the combined report

Print the combined report using this structure:

```
# Code Review: <diffRef>
<ISO timestamp>

## Summary
| Agent | Critical | High | Medium | Low | Info | Total |
|-------|----------|------|--------|-----|------|-------|
| security    | N | N | N | N | N | N |
| performance | N | N | N | N | N | N |
| test        | N | N | N | N | N | N |

## Critical & High Findings
(all critical + high findings across all agents, sorted: critical first, then by file)
For each: severity badge, title, agent name, file path, optional line number, detail, fix

## Security Findings
(all security agent findings, grouped by file, all severities)

## Performance Findings
(all performance agent findings, grouped by file, all severities)

## Test Coverage Findings
(all test agent findings, grouped by file, all severities)
```

Use severity labels: 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🔵 LOW, ⚪ INFO.

Show ALL findings — do not truncate or summarise any agent's output.
