#!/usr/bin/env node
/**
 * UX Review Agent — TruthStay vs Waymo Design Audit
 *
 * Phase 1 (this script):
 *   1. Screenshot each main screen via ADB
 *   2. Send screenshot + source to Claude vision API
 *   3. Get per-issue JSON with bounding boxes (visual-only, no functional changes)
 *   4. Annotate screenshots with orange callout boxes
 *   5. Write apps/mobile/ux-review/REPORT.md
 *
 * Prerequisites:
 *   - Android emulator running, dev client installed, user logged in
 *   - adb devices shows emulator
 *   - ANTHROPIC_API_KEY set in env or .env.local at repo root
 *
 * Run: node apps/mobile/scripts/ux-review.js
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const MOBILE = path.resolve(__dirname, "..");
const OUT_DIR = path.join(MOBILE, "ux-review");

const Anthropic = require(path.join(ROOT, "node_modules/@anthropic-ai/sdk"));
const sharp = require(path.join(ROOT, "node_modules/sharp"));

// ── Config ────────────────────────────────────────────────────────────────────

// Load API key from .env.local if not already in environment
if (!process.env.ANTHROPIC_API_KEY) {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8")
      .split("\n")
      .forEach((line) => {
        const [k, ...v] = line.split("=");
        if (k && v.length) process.env[k.trim()] = v.join("=").trim();
      });
  }
}

const SCREENS = [
  {
    name: "Feed",
    slug: "feed",
    deepLink: "truthstay://feed",
    sourceFile: "app/(app)/feed/index.tsx",
  },
  {
    name: "Explore",
    slug: "explore",
    deepLink: "truthstay://explore",
    sourceFile: "app/(app)/explore/index.tsx",
  },
  {
    name: "Discover",
    slug: "discover",
    deepLink: "truthstay://discover",
    sourceFile: "app/(app)/discover/index.tsx",
  },
  {
    name: "My Trips",
    slug: "trips",
    deepLink: "truthstay://trips",
    sourceFile: "app/(app)/trips/index.tsx",
  },
  {
    name: "Profile",
    slug: "profile",
    deepLink: "truthstay://profile",
    sourceFile: "app/(app)/profile/index.tsx",
  },
];

const WAYMO_PRINCIPLES = `
Waymo design language (visual rules only):
1. Pill-shaped CTAs — borderRadius: 999 (fully rounded), never square or lightly rounded
2. Page background: light grey #F8F9FA; content cards: white with soft shadow (elevation 2)
3. Consistent 8px spacing grid — padding/margins should be multiples of 8
4. Typography hierarchy: one dominant bold heading, one muted body size per section — avoid mixed font weights across the same block
5. Icons: consistent stroke weight throughout; all outlined style — no mixing filled and outlined
6. Empty states: centered illustration/icon + single short copy line + one pill CTA
7. Bottom nav bar: equal visual weight for icon + label; inactive items at ~40% opacity, no coloured fills
8. Action buttons in rows: right-aligned within the row, NOT stretched to full width
9. No redundant visual chrome: no double dividers, no unnecessary border outlines on cards
10. Color restraint: 1–2 accent colors max per screen; avoid multiple competing hues on the same element
`.trim();

const SYSTEM_PROMPT = `You are a mobile UI design reviewer performing a visual-only audit.

IMPORTANT SCOPE RESTRICTION:
- Review ONLY visual styling: colors, spacing, typography, border radius, shadows, icon stroke weight, layout proportions of decorative elements.
- Do NOT comment on navigation logic, app functionality, data handling, component behaviour, or accessibility.
- Every issue you report must be fixable by changing a StyleSheet property — nothing else.

${WAYMO_PRINCIPLES}

For each visual issue found, return a JSON object. Return ONLY a valid JSON array — no markdown, no explanation outside the JSON.

Each issue must have:
{
  "priority": "high" | "medium" | "low",
  "description": "one-line plain-English description of the visual problem",
  "file": "relative path from repo root, e.g. apps/mobile/app/(app)/feed/index.tsx",
  "line": <approximate line number>,
  "current_value": "the current style value causing the issue",
  "suggested_value": "the corrected style value",
  "bbox_pct": {
    "x": <left edge as fraction 0.0–1.0 of image width>,
    "y": <top edge as fraction 0.0–1.0 of image height>,
    "w": <width as fraction 0.0–1.0>,
    "h": <height as fraction 0.0–1.0>
  }
}

Return between 3 and 8 issues per screen. Prioritise issues that are most visually inconsistent with Waymo's style.`;

// ── ADB helpers ───────────────────────────────────────────────────────────────

function adbCheck() {
  try {
    const result = execSync("adb devices", { encoding: "utf8" });
    const lines = result.split("\n").filter((l) => l.includes("\tdevice"));
    if (lines.length === 0) {
      console.error("No ADB device found. Start the emulator and try again.");
      process.exit(1);
    }
    console.log(`ADB: ${lines[0].trim()}`);
  } catch {
    console.error("adb not found. Install Android SDK platform-tools.");
    process.exit(1);
  }
}

function navigateTo(deepLink) {
  execSync(
    `adb shell am start -a android.intent.action.VIEW -d "${deepLink}" com.truthstay.app`,
    { stdio: "pipe" }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screencap() {
  const result = spawnSync("adb", ["exec-out", "screencap", "-p"], {
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result.stdout; // Buffer
}

// ── Claude API ────────────────────────────────────────────────────────────────

async function reviewScreen(screenName, screenshotBuffer, sourceCode) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: screenshotBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: `Screen: ${screenName}\n\nSource code (for file + line references):\n\`\`\`tsx\n${sourceCode}\n\`\`\`\n\nReturn ONLY a JSON array of visual issues.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim();
  // Strip markdown code fences if Claude wrapped the JSON
  const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(jsonText);
}

// ── Annotation ────────────────────────────────────────────────────────────────

const COLOURS = {
  high: "#FF4444",
  medium: "#FF8C00",
  low: "#2ECDA7",
};

async function annotate(screenshotBuffer, issues, outPath) {
  const img = sharp(screenshotBuffer);
  const { width, height } = await img.metadata();

  const annotations = issues
    .map((issue, i) => {
      const x = Math.round(issue.bbox_pct.x * width);
      const y = Math.round(issue.bbox_pct.y * height);
      const w = Math.max(Math.round(issue.bbox_pct.w * width), 60);
      const h = Math.max(Math.round(issue.bbox_pct.h * height), 30);
      const colour = COLOURS[issue.priority] || COLOURS.medium;
      const badgeR = 18;
      const label = String(i + 1);

      return `
      <!-- issue ${i + 1} box -->
      <rect x="${x}" y="${y}" width="${w}" height="${h}"
            fill="none" stroke="${colour}" stroke-width="4" rx="6"/>
      <!-- badge circle -->
      <circle cx="${x + badgeR}" cy="${y + badgeR}" r="${badgeR}" fill="${colour}"/>
      <text x="${x + badgeR}" y="${y + badgeR + 7}"
            font-family="Arial,sans-serif" font-size="18" font-weight="bold"
            fill="white" text-anchor="middle">${label}</text>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${annotations}
  </svg>`;

  await img
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}

// ── Report ────────────────────────────────────────────────────────────────────

function priorityBadge(p) {
  return p === "high" ? "🔴 High" : p === "medium" ? "🟠 Med" : "🟢 Low";
}

function buildReport(results) {
  const lines = ["# UX Review Report — TruthStay vs Waymo Design Audit\n"];
  lines.push(`_Generated: ${new Date().toLocaleString()}_\n`);
  lines.push("Visual-only audit. Each issue is fixable by changing a StyleSheet property — no logic or functionality changes.\n");
  lines.push("---\n");

  for (const { screen, issues, annotatedFile } of results) {
    lines.push(`## ${screen.name}\n`);
    lines.push(`![${screen.name} annotated](./${path.basename(annotatedFile)})\n`);

    if (!issues.length) {
      lines.push("_No issues found._\n");
      continue;
    }

    lines.push("| # | Priority | Issue | File | Current → Suggested |");
    lines.push("|---|----------|-------|------|---------------------|");

    issues.forEach((issue, i) => {
      const fileLink = `[${path.basename(issue.file)}:${issue.line}](../../${issue.file}#L${issue.line})`;
      const change = `\`${issue.current_value}\` → \`${issue.suggested_value}\``;
      lines.push(
        `| ${i + 1} | ${priorityBadge(issue.priority)} | ${issue.description} | ${fileLink} | ${change} |`
      );
    });

    lines.push("");
  }

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY not set. Add it to .env.local at repo root or export it in your shell."
    );
    process.exit(1);
  }

  adbCheck();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Read shared theme context once
  const themeSource = fs.readFileSync(
    path.join(MOBILE, "lib/theme.ts"),
    "utf8"
  );

  const results = [];

  for (const screen of SCREENS) {
    console.log(`\n→ ${screen.name}`);

    // Navigate
    console.log(`  navigating to ${screen.deepLink}`);
    navigateTo(screen.deepLink);
    await sleep(2500);

    // Screenshot
    console.log("  capturing screenshot…");
    const screenshot = await screencap();

    // Read source
    const sourcePath = path.join(MOBILE, screen.sourceFile);
    const source = fs.existsSync(sourcePath)
      ? fs.readFileSync(sourcePath, "utf8").slice(0, 12000) // cap to avoid token overflow
      : "(source not found)";

    const combinedSource = `// theme.ts (shared tokens)\n${themeSource.slice(0, 3000)}\n\n// ${screen.sourceFile}\n${source}`;

    // Claude review
    console.log("  asking Claude for visual review…");
    let issues;
    try {
      issues = await reviewScreen(screen.name, screenshot, combinedSource);
      console.log(`  ${issues.length} issues found`);
    } catch (err) {
      console.warn(`  Claude error: ${err.message}`);
      issues = [];
    }

    // Annotate
    const annotatedFile = path.join(OUT_DIR, `${screen.slug}-annotated.png`);
    if (issues.length > 0) {
      console.log("  annotating screenshot…");
      await annotate(screenshot, issues, annotatedFile);
    } else {
      // Save plain screenshot even if no issues
      await sharp(screenshot).png().toFile(annotatedFile);
    }

    results.push({ screen, issues, annotatedFile });
  }

  // Write report
  const reportPath = path.join(OUT_DIR, "REPORT.md");
  fs.writeFileSync(reportPath, buildReport(results), "utf8");

  console.log(`\n✓ Done. Open: apps/mobile/ux-review/REPORT.md`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
