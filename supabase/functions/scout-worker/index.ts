import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Pinned to avoid SDK version drift across deploys.
// Last reviewed: 2026-05-05. Bump deliberately when SDK has needed changes.
import Anthropic from "npm:@anthropic-ai/sdk@0.93.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentType = "route" | "accommodation" | "restaurant" | "activity" | "things_to_do";
type SourceType  = "blog" | "instagram_profile" | "instagram_post" | "web_search";

interface RawSource {
  url:            string;
  type:           SourceType;
  author:         string;
  excerpt:        string;
  publishedDate?: string;
}

interface DiscoveredLocation {
  name:             string;
  type:             ContentType;
  region:           string;
  description:      string;
  coordinates:      { lat: number; lng: number };
  sources:          RawSource[];
  highlights:       string[];
  metadata:         Record<string, unknown>;
  confidenceScore:  number;
  confidenceReason: string;
  image_url?:       string | null;
  country?:         string | null;
}

interface SourceUrl {
  source_url:        string;
  source_type:       SourceType;
  source_label?:     string;
  evidence_excerpt?: string;
  first_seen_at:     string;
}

interface ResolvedLocation {
  lat:               number;
  lng:               number;
  place_id:          string | null;
  formatted_address?: string;
  country:           string | null;
}

interface ScoredEntry {
  loc:                    DiscoveredLocation;
  sourceUrls:             SourceUrl[];
  independentSourceCount: number;
  trustScore:             number;
  qualityScore:           number;
  features:               Record<string, unknown>;
  coordinates:            { lat: number; lng: number };
  placeId:                string | null;
  country:                string | null;
}

interface ScoutJob {
  id:              string;
  job_type:        "scrape_source" | "run_scout";
  source_id:       string | null;
  trigger_payload: Record<string, unknown>;
  attempt_count:   number;
  max_attempts:    number;
  progress:        Record<string, unknown>;
}

interface StageSummary {
  duration_ms: number;
  [key: string]: unknown;
}

interface CostSummary {
  scrapingbee_calls:          number;
  scrapingbee_usd:            number;
  anthropic_input_tokens:     number;
  anthropic_output_tokens:    number;
  anthropic_usd_estimate:     number;
  google_places_calls:        number;
  google_places_usd_estimate: number;
  total_usd_estimate:         number;
}

interface ResultSummary {
  stages:              Record<string, StageSummary>;
  total_duration_ms:   number;
  claude_calls:        number;
  google_places_calls: number;
  warnings:            string[];
  costs:               CostSummary;
}

type DB = ReturnType<typeof createClient>;

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL               = "claude-sonnet-4-6";
const MIN_SCOUT_SCORE     = 0.5;
const JOB_BUDGET_MS       = 120_000; // bail before Supabase edge fn hard cap (~150s)
// scrape_source caps (page-by-page pipeline, checkpointed — survives budget timer).
const MAX_EXTRACTIONS_STD = 25;   // standard source scrape
const MAX_EXTRACTIONS_EXH = 100;  // exhaustive source scrape
// run_scout cap: single Claude web_search call must finish inside JOB_BUDGET_MS.
// web_search_20250305 runs searches server-side; ~15-20s each. Cap at 10 so
// Claude completes in ~30-60s with 3-5 searches. Larger brackets use scrape_source.
const MAX_CLAUDE_DISCOVERIES = 10;
const MAX_SUBPAGES        = 5;

// Pricing constants — Last verified: 2026-05-05. Update when vendors change pricing.
const ANTHROPIC_INPUT_COST_PER_1M   = 3.00;   // $/1M input tokens  — claude-sonnet-4-6
const ANTHROPIC_OUTPUT_COST_PER_1M  = 15.00;  // $/1M output tokens — claude-sonnet-4-6
const GOOGLE_PLACES_COST_PER_CALL   = 0.017;  // Text Search call
const SCRAPINGBEE_CREDITS_PER_JS    = 5;       // credits per JS-rendered request
const SCRAPINGBEE_COST_PER_JS       = 0.005;   // $/request on smallest paid plan

type FocusType = ContentType | "all";

interface SkippedEntry {
  name:          string;
  would_be_type: string;
  reason:        string;
}

const LOCALE_KEYWORDS: Record<ContentType, Record<string, string[]>> = {
  accommodation: {
    en: ["hotel", "stay", "accommodat", "lodging", "guesthouse", "villa", "resort", "apartment"],
    nl: ["hotel", "overnachten", "accommodatie", "verblijf", "vakantiehuis", "appartement", "pension", "logies"],
    de: ["hotel", "unterkunft", "pension", "ferienwohnung", "gasthaus", "herberge", "apartment"],
    fr: ["hotel", "hébergement", "logement", "gîte", "chambre", "appartement", "auberge"],
    es: ["hotel", "alojamiento", "hospedaje", "apartamento", "hostal", "pension", "casa"],
    it: ["hotel", "alloggio", "albergo", "pensione", "agriturismo", "appartamento", "soggiorno"],
    pt: ["hotel", "alojamento", "hospedagem", "pousada", "apartamento", "quinta", "casa"],
  },
  restaurant: {
    en: ["restaurant", "eat", "dining", "cafe", "food", "cuisine"],
    nl: ["restaurant", "eten", "cafe", "eetcafe", "bistro"],
    de: ["restaurant", "essen", "gaststätte", "lokal", "café"],
    fr: ["restaurant", "manger", "café", "bistro", "cuisine"],
    es: ["restaurante", "comer", "café", "bar", "cocina"],
    it: ["ristorante", "mangiare", "trattoria", "osteria", "cucina"],
    pt: ["restaurante", "comer", "café", "cozinha"],
  },
  activity: {
    en: ["activity", "thing-to-do", "tour", "experience", "visit"],
    nl: ["activiteit", "bezienswaardigheden", "doen", "tour", "excursie", "bezoek"],
    de: ["aktivität", "sehenswürdigkeit", "tour", "erlebnis", "besuch"],
    fr: ["activité", "visite", "tour", "expérience", "excursion"],
    es: ["actividad", "visita", "tour", "experiencia", "excursión"],
    it: ["attività", "visita", "tour", "esperienza", "escursione"],
    pt: ["atividade", "visita", "tour", "experiência", "excursão"],
  },
  route: {
    en: ["route", "trail", "ride", "cycling", "hike", "walk"],
    nl: ["route", "wandeling", "fietsen", "wandelpad", "fietsroute"],
    de: ["route", "wanderung", "radweg", "wanderweg", "tour"],
    fr: ["route", "sentier", "randonnée", "piste", "circuit"],
    es: ["ruta", "sendero", "senderismo", "ciclismo", "camino"],
    it: ["percorso", "sentiero", "ciclabile", "escursione", "cammino"],
    pt: ["rota", "trilha", "caminhada", "ciclismo", "caminho"],
  },
  things_to_do: {
    en: ["beach", "viewpoint", "monument", "museum", "park", "church", "lighthouse", "garden", "village", "scenic"],
    nl: ["strand", "uitzichtpunt", "monument", "museum", "park", "kerk", "vuurtoren", "tuin", "dorp", "bezienswaardigh"],
    de: ["strand", "aussichtspunkt", "denkmal", "museum", "park", "kirche", "leuchtturm", "garten", "dorf", "sehenswürd"],
    fr: ["plage", "point de vue", "monument", "musée", "parc", "église", "phare", "jardin", "village", "panorama"],
    es: ["playa", "mirador", "monumento", "museo", "parque", "iglesia", "faro", "jardín", "pueblo", "panorámico"],
    it: ["spiaggia", "belvedere", "monumento", "museo", "parco", "chiesa", "faro", "giardino", "villaggio", "panorama"],
    pt: ["praia", "miradouro", "monumento", "museu", "parque", "igreja", "farol", "jardim", "aldeia", "panorâmico"],
  },
};

function getLocaleFromUrl(url: string): string {
  // Path segment: /en, /en/, /en?, /en# — all match (no trailing slash required)
  const pathMatch = url.match(/\/(en|nl|de|fr|es|it|pt)(?:\/|$|\?|#)/i);
  if (pathMatch) return pathMatch[1].toLowerCase();

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith(".nl")) return "nl";
    if (hostname.endsWith(".de")) return "de";
    if (hostname.endsWith(".fr")) return "fr";
    if (hostname.endsWith(".es")) return "es";
    if (hostname.endsWith(".it")) return "it";
    if (hostname.endsWith(".pt")) return "pt";
    if (hostname.endsWith(".be")) return "nl";  // Belgium: default Dutch
    if (hostname.endsWith(".at")) return "de";
    if (hostname.endsWith(".ch")) return "de";  // imperfect but reasonable
  } catch { /* ignore */ }

  return "en";
}

function getLocale(url: string, html?: string): string {
  // URL path segment is the strongest signal
  const fromUrl = getLocaleFromUrl(url);
  // If URL gave a non-English locale, or explicitly contained /en/, trust it
  if (fromUrl !== "en" || /\/en(?:\/|$|\?|#)/i.test(url)) return fromUrl;

  // Fall back to <html lang="..."> if HTML is available
  if (html) {
    const langMatch = html.match(/<html[^>]+lang=["']([a-z]{2})/i);
    if (langMatch) return langMatch[1].toLowerCase();
  }

  return fromUrl;
}

function getPathLocale(url: string): string | null {
  const m = url.match(/\/(en|nl|de|fr|es|it|pt)(?:\/|$|\?|#)/i);
  return m ? m[1].toLowerCase() : null;
}

function getTldLocale(url: string): string | null {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.endsWith(".nl")) return "nl";
    if (h.endsWith(".de")) return "de";
    if (h.endsWith(".fr")) return "fr";
    if (h.endsWith(".es")) return "es";
    if (h.endsWith(".it")) return "it";
    if (h.endsWith(".pt")) return "pt";
    if (h.endsWith(".be")) return "nl";
    if (h.endsWith(".at")) return "de";
    if (h.endsWith(".ch")) return "de";
  } catch { /* ignore */ }
  return null;
}

const ALL_CONTENT_TYPES: ContentType[] = ["accommodation", "restaurant", "activity", "things_to_do", "route"];

function getKeywordsForLocale(focusType: FocusType, locale: string): string[] {
  if (focusType === "all") {
    const combined = new Set<string>();
    for (const type of ALL_CONTENT_TYPES) {
      for (const kw of LOCALE_KEYWORDS[type][locale] ?? []) combined.add(kw);
    }
    return Array.from(combined);
  }
  return LOCALE_KEYWORDS[focusType][locale] ?? [];
}

function getEffectiveKeywords(
  url:       string,
  html:      string | undefined,
  focusType: FocusType,
): { keywords: string[]; sources: string[] } {
  const sources: string[] = [];
  const merged = new Set<string>();

  // 1. Always include English
  for (const kw of getKeywordsForLocale(focusType, "en")) merged.add(kw);
  sources.push("en");

  // 2. Path-based locale (page content language)
  const pathLocale = getPathLocale(url);
  if (pathLocale && pathLocale !== "en") {
    const kws = getKeywordsForLocale(focusType, pathLocale);
    if (kws.length > 0) { for (const kw of kws) merged.add(kw); sources.push(pathLocale); }
  }

  // 3. TLD-based locale (site's underlying language — often differs from path)
  const tldLocale = getTldLocale(url);
  if (tldLocale && tldLocale !== "en" && tldLocale !== pathLocale) {
    const kws = getKeywordsForLocale(focusType, tldLocale);
    if (kws.length > 0) { for (const kw of kws) merged.add(kw); sources.push(tldLocale); }
  }

  // 4. <html lang> as tiebreaker
  if (html) {
    const langMatch = html.match(/<html[^>]+lang=["']([a-z]{2})/i);
    if (langMatch) {
      const htmlLang = langMatch[1].toLowerCase();
      const kws = getKeywordsForLocale(focusType, htmlLang);
      if (kws.length > 0) { for (const kw of kws) merged.add(kw); sources.push(`html-lang:${htmlLang}`); }
    }
  }

  return { keywords: Array.from(merged), sources };
}

const CREDIBILITY: Record<string, number> = {
  blog:               1.0,
  instagram_profile:  0.85,
  instagram_post:     0.85,
  web_search:         0.5,
};

const RETRYABLE_HTTP_CODES  = [408, 429, 502, 503, 504];
const RETRYABLE_ERROR_NAMES = ["NetworkError", "TimeoutError"];

// ── Module-level progress state (reset per invocation) ────────────────────────

let progressState: Record<string, unknown> = {};

// ── Client factories ──────────────────────────────────────────────────────────

function makeDb(): DB {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function makeAnthropic(): Anthropic {
  return new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
}

// ── Progress helpers ──────────────────────────────────────────────────────────

async function updateProgress(db: DB, jobId: string, patch: Record<string, unknown>): Promise<void> {
  progressState = { ...progressState, ...patch };
  const { error } = await db.from("scout_jobs").update({ progress: progressState }).eq("id", jobId);
  if (error) console.warn(`[worker] progress write error: ${error.message}`);
}

// ── Timing wrapper ────────────────────────────────────────────────────────────

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - t0 };
}

// ── Stage 0: Fetch rubric from DB ─────────────────────────────────────────────

async function fetchRubric(db: DB): Promise<string> {
  try {
    const { data } = await db.from("agent_rubric").select("base_rules, rubric_text").eq("id", 1).single();
    if (!data) return "";
    const parts = [data.base_rules ?? ""].filter(Boolean);
    if (data.rubric_text) parts.push("\nLEARNED RUBRIC (from admin review patterns):\n" + data.rubric_text);
    return parts.join("\n");
  } catch {
    return "";
  }
}

// ── HTML utilities (regex-based, no external deps) ────────────────────────────

interface ExtractedLink {
  url:        string;
  anchorText: string;
  title?:     string;
}

function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Match full <a> tags — allow > inside quoted attribute values before the closing >
  const aTagRe  = /<a\s+((?:[^>"']|"[^"]*"|'[^']*')*?)>([\s\S]*?)<\/a>/gi;
  const hrefRe  = /href=["']([^"']+)["']/i;
  const titleRe = /title=["']([^"']*)["']/i;
  const seen    = new Map<string, ExtractedLink>();
  let match: RegExpExecArray | null;

  while ((match = aTagRe.exec(clean)) !== null) {
    const attrs      = match[1];
    const inner      = match[2];
    const hrefMatch  = hrefRe.exec(attrs);
    if (!hrefMatch) continue;
    if (hrefMatch[1].startsWith("#")) continue;
    try {
      const url = new URL(hrefMatch[1], baseUrl).href;
      if (seen.has(url)) continue;
      const titleMatch = titleRe.exec(attrs);
      const anchorText = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
      seen.set(url, { url, anchorText, title: titleMatch?.[1] });
    } catch { /* skip malformed */ }
  }
  return [...seen.values()];
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToTextWithImages(html: string): string {
  // Skip data URIs — base64 LQIP placeholders can be 3KB+ each and would flood the text budget.
  // Only annotate real http(s) URLs, capped at 300 chars to guard against extremely long CDN URLs.
  const imgAnnotation = (src: string, alt: string): string => {
    if (src.startsWith("data:") || !src.startsWith("http")) return "";
    const safeSrc = src.length > 300 ? src.slice(0, 300) + "…" : src;
    return `[IMAGE src="${safeSrc}" alt="${alt}"]`;
  };

  return html
    // Preserve <img> tags as readable [IMAGE ...] annotations before stripping all other tags.
    // Three passes: src-before-alt, alt-before-src, src-only.
    .replace(/<img\s[^>]*?src=["']([^"']+)["'][^>]*?alt=["']([^"']*)["'][^>]*?>/gi,
             (_, src, alt) => imgAnnotation(src, alt))
    .replace(/<img\s[^>]*?alt=["']([^"']*)["'][^>]*?src=["']([^"']+)["'][^>]*?>/gi,
             (_, alt, src) => imgAnnotation(src, alt))
    .replace(/<img\s[^>]*?src=["']([^"']+)["'][^>]*?>/gi,
             (_, src) => imgAnnotation(src, ""))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    // Strip CSS rule blocks that survived <style> stripping (e.g. JS-injected text-node CSS).
    // Matches selector{prop:val;} patterns; safe for prose (prose never starts with ./#/@).
    .replace(/[.#@][^{}<>\n]*\{[^{}]*:[^{}]*;[^{}]*\}/g, " ")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Extracts the first top-level JSON value (object or array) from text.
// Used for multi-type responses that return { entries, skipped } objects.
function extractJsonValue(text: string): string | null {
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  const start = objStart === -1 ? arrStart
               : arrStart === -1 ? objStart
               : Math.min(objStart, arrStart);
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function validateAndResolveImageUrl(
  raw: string | null | undefined,
  pageUrl: string,
): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (raw.startsWith("data:")) return null;
  if (raw.length > 500) return null;
  try {
    const resolved = new URL(raw, pageUrl).href;
    if (!/^https?:\/\//i.test(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

// ── Stage 1A: Fetch source page ───────────────────────────────────────────────

interface FetchedPage {
  html:                string;
  finalUrl:            string;
  contentType:         string;
  status:              number;
  fetchMethod:         "static" | "headless";
  spaDetectionReason?: string;
  costEstimateUsd:     number;
}

interface SpaMethodCache {
  method: "static" | "headless" | null;
}

function isCloudflareChallenge(html: string): boolean {
  const lc = html.toLowerCase();
  return lc.includes("data-cf-ray=") ||
         lc.includes("cf-challenge") ||
         lc.includes("cf-turnstile") ||
         lc.includes("_cf_chl") ||
         lc.includes("checking your browser") ||
         lc.includes("just a moment") ||
         lc.includes("cloudflare ray id") ||
         lc.includes("__cf_bm") ||
         (lc.includes("cloudflare") && lc.includes("security check"));
}

function isLikelySPA(html: string): { isSPA: boolean; reason: string } {
  if (/<div\s+id=["'](?:root|app|__next)["']>\s*<\/div>/i.test(html)) {
    return { isSPA: true, reason: "empty SPA root container" };
  }
  const linkCount = (html.match(/<a\s+[^>]*href=/gi) ?? []).length;
  if (linkCount < 5) {
    return { isSPA: true, reason: `only ${linkCount} <a> tags in static HTML` };
  }
  const visibleText = htmlToText(html);
  if (visibleText.length < 500) {
    return { isSPA: true, reason: `only ${visibleText.length} chars of visible text` };
  }
  if (/<noscript>[^<]*javascript/i.test(html)) {
    return { isSPA: true, reason: "noscript JS warning present" };
  }
  return { isSPA: false, reason: "static HTML viable" };
}

async function assertWithinScrapingBudget(db: DB): Promise<void> {
  const budget = parseFloat(Deno.env.get("SCRAPINGBEE_MONTHLY_BUDGET_USD") ?? "5");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data } = await db
    .from("scrapingbee_usage")
    .select("cost_usd")
    .eq("month_start", monthStart.toISOString().split("T")[0])
    .maybeSingle();
  const spent = parseFloat(String(data?.cost_usd ?? "0"));
  if (spent >= budget) {
    throw Object.assign(
      new Error(`SCRAPING_BUDGET_EXCEEDED: $${spent.toFixed(4)} of $${budget} used this month`),
      { name: "BudgetError", code: "SCRAPING_BUDGET_EXCEEDED" },
    );
  }
}

async function recordScrapingBeeUsage(db: DB, calls: number, costUsd: number): Promise<void> {
  try {
    await db.rpc("increment_scrapingbee_usage", { p_calls: calls, p_cost: costUsd });
  } catch (e) {
    console.warn("[worker] failed to record ScrapingBee usage:", (e as Error).message);
  }
}

async function fetchViaScrapingBee(
  url:    string,
  db:     DB,
  signal: AbortSignal,
): Promise<{ html: string; costEstimateUsd: number }> {
  const apiKey = Deno.env.get("SCRAPINGBEE_API_KEY");
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY not configured");

  await assertWithinScrapingBudget(db);

  // 8s wait: many React tourism SPAs do staged rendering
  // (initial shell → API fetch → second render). 8s covers the
  // common case. Verified against visitalgarve.pt/en 2026-05-05.
  // block_resources=false: JS bundles must be able to fetch dependencies
  // or the second render stage won't complete (also verified 2026-05-05).
  // timeout=30000 + wait=8000 = 38s max ScrapingBee wall time.
  // Local AbortController set to 45s to ensure we never cut ScrapingBee
  // off mid-render (previous 30s fired before 33s ScrapingBee limit).
  const params = new URLSearchParams({
    api_key:         apiKey,
    url:             url,
    render_js:       "true",
    wait:            "8000",
    block_resources: "false",
    timeout:         "30000",
  });

  const controller    = new AbortController();
  const timer         = setTimeout(() => controller.abort(), 45_000);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });

  try {
    const response = await fetch(
      `https://app.scrapingbee.com/api/v1/?${params.toString()}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`ScrapingBee fetch failed (${response.status}): ${errText.slice(0, 200)}`);
    }
    const rawHtml         = await response.text();
    // Strip <style> and <script> blocks BEFORE the 500k cap.
    // JS-heavy pages (e.g. WordPress/Astra with mega-menu CSS) can inject megabytes
    // of navigation CSS into the rendered DOM, pushing article content past the cap.
    // htmlToTextWithImages strips these anyway, so removing them here is safe and
    // maximises the 500k window for actual visible content.
    const html            = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const costEstimateUsd = SCRAPINGBEE_COST_PER_JS;
    await recordScrapingBeeUsage(db, SCRAPINGBEE_CREDITS_PER_JS, costEstimateUsd);
    return { html: html.slice(0, 500_000), costEstimateUsd };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

async function fetchStaticHtml(url: string, signal: AbortSignal): Promise<Omit<FetchedPage, "fetchMethod" | "spaDetectionReason" | "costEstimateUsd">> {
  const controller    = new AbortController();
  const timer         = setTimeout(() => controller.abort(), 10_000);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal:   controller.signal,
      headers:  {
        "User-Agent": "TruthStayBot/1.0 (+https://truth-stay.com)",
        "Accept":     "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status} fetching ${url}`), { status: response.status });
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`non-HTML content type (${contentType}) for ${url}`);
    }
    const html = await response.text();
    return { html: html.slice(0, 500_000), finalUrl: response.url, contentType, status: response.status };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

async function fetchRawText(url: string, signal: AbortSignal): Promise<{ text: string; status: number }> {
  const controller    = new AbortController();
  const timer         = setTimeout(() => controller.abort(), 10_000);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });
  try {
    const response = await fetch(url, {
      signal:   controller.signal,
      headers:  { "User-Agent": "TruthStayBot/1.0 (+https://truth-stay.com)", "Accept": "*/*" },
      redirect: "follow",
    });
    const text = await response.text();
    return { text: text.slice(0, 2_000_000), status: response.status };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

async function fetchSourcePage(
  url:       string,
  db:        DB,
  signal:    AbortSignal,
  spaCache?: SpaMethodCache,
): Promise<FetchedPage> {
  // Fast path: SPA method already known from first page on this run
  if (spaCache?.method === "headless") {
    const headless = await fetchViaScrapingBee(url, db, signal);
    return { ...headless, finalUrl: url, contentType: "text/html", status: 200, fetchMethod: "headless" };
  }
  if (spaCache?.method === "static") {
    const stat = await fetchStaticHtml(url, signal);
    return { ...stat, fetchMethod: "static", costEstimateUsd: 0 };
  }

  // Auto-detect: try static first, fall back to headless if SPA
  const stat = await fetchStaticHtml(url, signal);
  if (stat.contentType.includes("text/html")) {
    const spa = isLikelySPA(stat.html);
    if (!spa.isSPA) {
      if (spaCache) spaCache.method = "static";
      return { ...stat, fetchMethod: "static", costEstimateUsd: 0 };
    }
    const headless = await fetchViaScrapingBee(url, db, signal);
    // Don't lock sub-pages to headless if SPA detection fired on a Cloudflare challenge page —
    // content pages may be directly accessible even though the homepage is CF-protected.
    if (spaCache) spaCache.method = isCloudflareChallenge(stat.html) ? null : "headless";
    return {
      ...headless, finalUrl: url, contentType: "text/html", status: 200,
      fetchMethod: "headless", spaDetectionReason: isCloudflareChallenge(stat.html) ? "cloudflare_block" : spa.reason,
    };
  }
  return { ...stat, fetchMethod: "static", costEstimateUsd: 0 };
}

// ── Stage 1B: Discover sub-pages ─────────────────────────────────────────────

interface DiscoverResult {
  sub_pages:             string[];
  strategy:              "seed_urls" | "sitemap" | "homepage_links";
  candidate_links_total: number;
  locale_used:           string;
  locale_sources:        string[];
  keywords_total:        number;
  sitemap_urls_total?:   number;
  sitemap_url_used?:     string;
  top_candidates:        Array<{ url: string; score: number; matched_keywords: string[]; anchor_text?: string }>;
}

function scoreLink(
  link:     ExtractedLink,
  keywords: string[],
): { score: number; matched_keywords: string[] } {
  const urlLc  = link.url.toLowerCase();
  const textLc = (link.anchorText + " " + (link.title ?? "")).toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (urlLc.includes(kw))  matched.push(kw + "@url");
    if (textLc.includes(kw)) matched.push(kw + "@text");
  }
  // URL matches score 2 (more reliable), anchor-text matches score 1
  const score =
    matched.filter(m => m.endsWith("@url")).length  * 2 +
    matched.filter(m => m.endsWith("@text")).length * 1;
  return { score, matched_keywords: matched };
}

function discoverFromHomepageLinks(html: string, baseUrl: string, focusType: FocusType): DiscoverResult {
  let baseHostname = "";
  try { baseHostname = new URL(baseUrl).hostname; } catch { /* ignore */ }

  const locale                          = getLocale(baseUrl, html);
  const { keywords, sources: localeSources } = getEffectiveKeywords(baseUrl, html, focusType);

  const allLinks   = extractLinks(html, baseUrl);
  const sameDomain = allLinks.filter(l => {
    try { return new URL(l.url).hostname === baseHostname; } catch { return false; }
  });

  const scored = sameDomain.map(link => {
    const { score, matched_keywords } = scoreLink(link, keywords);
    return { url: link.url, score, matched_keywords, anchor_text: link.anchorText.slice(0, 120) };
  });

  const withScore = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Fallback: if nothing scored, use first 4 same-domain links by discovery order
  const candidates = withScore.length > 0
    ? withScore
    : sameDomain.slice(0, MAX_SUBPAGES).map(l => ({ url: l.url, score: 0, matched_keywords: [] as string[], anchor_text: l.anchorText.slice(0, 120) }));

  const top_candidates = candidates.slice(0, 5);

  const picked = candidates
    .map(s => s.url)
    .filter((u, i, arr) => arr.indexOf(u) === i)  // dedupe
    .filter(u => u !== baseUrl)
    .slice(0, MAX_SUBPAGES - 1);                   // reserve slot 0 for baseUrl

  return {
    sub_pages:             [baseUrl, ...picked],
    strategy:              "homepage_links",
    candidate_links_total: sameDomain.length,
    locale_used:           locale,
    locale_sources:        localeSources,
    keywords_total:        keywords.length,
    top_candidates,
  };
}

// ── Stage 1B: Sitemap discovery ───────────────────────────────────────────────

function parseSitemapXml(xml: string): { urls: string[]; isIndex: boolean } {
  const isIndex  = /<sitemapindex/i.test(xml);
  const tag      = isIndex ? "sitemap" : "url";
  const urlPat   = new RegExp(`<${tag}>[\\s\\S]*?<loc>([^<]+)<\\/loc>[\\s\\S]*?<\\/${tag}>`, "gi");
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlPat.exec(xml)) !== null) {
    const u = m[1]?.trim();
    if (u) urls.push(u);
    if (urls.length >= 5000) break;
  }
  return { urls, isIndex };
}

function filterSitemapUrls(urls: string[], focusType: FocusType, baseUrl: string): string[] {
  const { keywords } = getEffectiveKeywords(baseUrl, undefined, focusType);
  let baseHostname = "";
  try { baseHostname = new URL(baseUrl).hostname; } catch { /* ignore */ }

  const sameDomain = urls.filter(u => {
    try { return new URL(u).hostname === baseHostname; } catch { return false; }
  });

  const scored = sameDomain.map(u => {
    const urlLc  = u.toLowerCase();
    const matched = keywords.filter(kw => urlLc.includes(kw));
    return { url: u, score: matched.length };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(s => s.url);
}

async function trySitemapDiscovery(
  baseUrl:   string,
  focusType: FocusType,
  signal:    AbortSignal,
): Promise<Pick<DiscoverResult, "sub_pages" | "strategy" | "sitemap_urls_total" | "sitemap_url_used" | "locale_used" | "locale_sources" | "keywords_total" | "candidate_links_total" | "top_candidates">> {
  const { keywords, sources: localeSources } = getEffectiveKeywords(baseUrl, undefined, focusType);
  const locale = getLocaleFromUrl(baseUrl);
  const emptyMeta = { locale_used: locale, locale_sources: localeSources, keywords_total: keywords.length, candidate_links_total: 0, top_candidates: [] };

  const candidates: string[] = [];
  try { candidates.push(new URL("/sitemap.xml",       baseUrl).href); } catch { /* ignore */ }
  try { candidates.push(new URL("/sitemap_index.xml", baseUrl).href); } catch { /* ignore */ }

  // Also check robots.txt for Sitemap: directives
  try {
    const robots = await fetchRawText(new URL("/robots.txt", baseUrl).href, signal);
    if (robots.status === 200) {
      const matches = robots.text.match(/^Sitemap:\s*(\S+)/gmi) ?? [];
      for (const m of matches.slice(0, 3)) {
        const u = m.replace(/^Sitemap:\s*/i, "").trim();
        if (u) candidates.push(u);
      }
    }
  } catch { /* robots.txt missing is fine */ }

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetchRawText(sitemapUrl, signal);
      if (res.status !== 200) continue;

      const { urls, isIndex } = parseSitemapXml(res.text);

      let allUrls = urls;
      if (isIndex) {
        allUrls = [];
        for (const childUrl of urls.slice(0, 5)) {
          try {
            const childRes   = await fetchRawText(childUrl, signal);
            const childParsed = parseSitemapXml(childRes.text);
            allUrls.push(...childParsed.urls);
          } catch { /* skip broken child sitemaps */ }
        }
      }

      const filtered = filterSitemapUrls(allUrls, focusType, baseUrl);
      if (filtered.length === 0) continue;

      return {
        sub_pages:          filtered.slice(0, MAX_SUBPAGES),
        strategy:           "sitemap",
        sitemap_urls_total: allUrls.length,
        sitemap_url_used:   sitemapUrl,
        ...emptyMeta,
      };
    } catch { /* try next candidate */ }
  }

  return { sub_pages: [], strategy: "homepage_links", sitemap_urls_total: 0, ...emptyMeta };
}

// ── Stage 1B: Candidate sub-page orchestration (seed > sitemap > homepage) ────

interface SourceForDiscovery {
  url:       string;
  seed_urls: string[];
}

async function buildCandidateSubPages(
  source:    SourceForDiscovery,
  html:      string,
  finalUrl:  string,
  focusType: FocusType,
  signal:    AbortSignal,
): Promise<DiscoverResult> {
  // Strategy 1: explicit seed URLs (highest priority)
  if (source.seed_urls && source.seed_urls.length > 0) {
    const { keywords, sources: localeSources } = getEffectiveKeywords(source.url, undefined, focusType);
    const locale = getLocaleFromUrl(source.url);
    return {
      sub_pages:             source.seed_urls.slice(0, MAX_SUBPAGES),
      strategy:              "seed_urls",
      candidate_links_total: source.seed_urls.length,
      locale_used:           locale,
      locale_sources:        localeSources,
      keywords_total:        keywords.length,
      top_candidates:        [],
    };
  }

  // Strategy 2: sitemap.xml discovery
  const sitemapResult = await trySitemapDiscovery(finalUrl, focusType, signal);
  if (sitemapResult.sub_pages.length > 0) return sitemapResult as DiscoverResult;

  // Strategy 3: homepage-link discovery (existing behaviour)
  return discoverFromHomepageLinks(html, finalUrl, focusType);
}

// ── Stage 1C: Per-page extraction (bounded Claude call, no web_search) ────────

async function extractFromPage(
  anthropic:     Anthropic,
  pageUrl:       string,
  pageHtml:      string,
  focusType:     FocusType,
  rubric:        string,
  defaultRegion: string,
  signal:        AbortSignal,
): Promise<{
  locations:      DiscoveredLocation[];
  skippedEntries: SkippedEntry[];
  inputTokens:    number;
  outputTokens:   number;
  debugInfo:      { text_length: number; text_first_500: string; text_last_500: string; html_length: number; html_hit_cap: boolean };
}> {
  const text          = htmlToTextWithImages(pageHtml).slice(0, 40_000);
  const rubricSection = rubric
    ? `\nQUALITY RUBRIC (skip entries that fail these rules):\n${rubric}\n`
    : "";

  const isMultiType = focusType === "all";

  const focusInstruction = isMultiType
    ? `You are extracting travel-related entries from a single web page.
Extract entries of these five types:
- accommodation: hotels, hostels, B&Bs, guesthouses, villas, apartments, retreats
- restaurant: restaurants, cafés, bars, food spots, eateries
- activity: physical/sport activities — hikes, surfing, kayaking, biking, climbing, diving, anything requiring physical exertion or sport gear
- things_to_do: casual/cultural — beaches (for swimming/relaxing/viewing), viewpoints, monuments, churches, museums, parks, gardens, neighborhoods to wander, lighthouses
- route: multi-day or significant journeys — long-distance hiking trails, cycling routes, multi-day expeditions

For each entry, set "type" to the most appropriate of these FIVE values.

CLASSIFICATION RULE:
- If the entity is described primarily as a place to BE or VISIT (passive viewing, relaxing, walking around) → things_to_do
- If the entity is described primarily as something to DO (sport, exercise, active engagement) → activity
- When ambiguous (e.g. a beach that mentions both sunbathing and surfing), prefer the type matching how the page primarily presents it
- Multi-day or named long-distance journeys → route, not activity`
    : `You are extracting ${focusType} entries from a single web page.`;

  const entryTypeField = isMultiType
    ? `"type": "accommodation|restaurant|activity|things_to_do|route",`
    : `"type": "${focusType}",`;

  const skipInstruction = isMultiType
    ? `
If a candidate entry doesn't fit any of the five types above (e.g. a wellness retreat that's too service-focused, a ferry crossing, a shopping district), DO NOT include it in the entries array. Instead add it to a "skipped" array:
{
  "name": "...",
  "would_be_type": "your_suggested_type",
  "reason": "Doesn't fit accommodation/restaurant/activity/things_to_do/route."
}

Return the full response as:
{ "entries": [...], "skipped": [...] }
`
    : `
OUTPUT — ONLY a valid JSON array, no prose, no markdown fences.`;

  const returnInstruction = isMultiType
    ? `Return up to 30 entries total across all five types. Return { "entries": [], "skipped": [] } if the page has no matching content.`
    : `Return a JSON array of up to 15 specifically-named ${focusType} places found on this page.\nReturn [] if the page contains no ${focusType} entries.`;

  const prompt = `${focusInstruction}

Source URL: ${pageUrl}
Default region: ${defaultRegion}
${rubricSection}
PAGE TEXT:
${text}

${returnInstruction}

Each entry must follow this exact shape:
{
  "name": "Exact place name",
  ${entryTypeField}
  "region": "city or region mentioned (default to '${defaultRegion}' if unspecified)",
  "country": "country in English (e.g. Portugal, Italy, United States) or null",
  "description": "1-2 sentences from the page text about this place",
  "coordinates": {"lat": 0, "lng": 0},
  "sources": [{"url": "${pageUrl}", "type": "blog", "author": "", "excerpt": "sentence that mentions this place"}],
  "highlights": [],
  "metadata": {},
  "confidenceScore": 0.65,
  "confidenceReason": "Named in page content",
  "image_url": "https://example.com/image.jpg or null"
}

For the country field:
- Use the English country name (e.g. "Portugal" not "Portuguesa", "Germany" not "Deutschland")
- Infer from the page URL TLD if the page text doesn't state it explicitly (.pt → Portugal, .de → Germany, .it → Italy, .es → Spain, .fr → France, .uk or .co.uk → United Kingdom)
- For multi-country travel blogs describing a specific place, use the country of that specific place
- Return null only if you genuinely cannot determine the country

For each entry, also identify the SINGLE most relevant image URL from the page that depicts that specific place. Selection rules:
1. Prefer images that appear near the place's mention in the HTML (within the same article, card, or section).
2. Prefer images whose alt text or surrounding caption refers to the place name (e.g. alt="Hotel Bela Vista pool").
3. Skip generic/decorative images: logos, banners, navigation icons, "share on Facebook" thumbnails, page-header heroes that aren't specific to one place.
4. Skip lazy-loading placeholders (data:image/svg+xml..., 1x1 spacer gifs, or src values that contain "placeholder", "loading", "blank").
5. Resolve relative URLs to absolute (use the page URL as base).
6. If the page has multiple images of the same place, pick the one that appears first in the DOM.
7. If NO suitable image can be identified for a place, return image_url: null. Do not guess or fabricate URLs.

Return image_url as a string or null. Do not return an array of images.
${skipInstruction}`;

  const debugInfo = {
    text_length:    text.length,
    text_first_500: text.slice(0, 500),
    text_last_500:  text.slice(-500),
    html_length:    pageHtml.length,
    html_hit_cap:   pageHtml.length === 500_000,
  };

  const empty = { locations: [], skippedEntries: [], inputTokens: 0, outputTokens: 0, debugInfo };

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 8192,
      messages:   [{ role: "user", content: prompt }],
    }, { signal });
  } catch (e) {
    // Re-throw AbortErrors so the pipeline can handle timeouts/budget correctly.
    // For all other errors (e.g. 529 Overloaded), return empty with debugInfo preserved.
    if ((e as Error).name === "AbortError") throw e;
    console.warn("[worker] extractFromPage: Anthropic call failed:", (e as Error).message);
    return { ...empty, inputTokens: 0, outputTokens: 0 };
  }

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("\n");

  const inputTokens  = response.usage?.input_tokens  ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  const jsonStr = extractJsonValue(raw);
  if (!jsonStr) return { locations: [], skippedEntries: [], inputTokens, outputTokens, debugInfo };

  try {
    const parsed = JSON.parse(jsonStr);
    const rawEntries: DiscoveredLocation[] = Array.isArray(parsed)
      ? (parsed as DiscoveredLocation[])
      : ((parsed.entries ?? []) as DiscoveredLocation[]);
    const skippedEntries: SkippedEntry[] = Array.isArray(parsed) ? [] : (parsed.skipped ?? []);

    const validTypes = new Set<string>(ALL_CONTENT_TYPES);
    const locations: DiscoveredLocation[] = rawEntries
      .filter(loc => {
        if (isMultiType && (!loc.type || !validTypes.has(loc.type as string))) {
          console.warn(`[worker] extractFromPage: dropped entry missing valid type: "${loc.name}" type="${loc.type}"`);
          return false;
        }
        return true;
      })
      .map(loc => ({
        ...loc,
        image_url: validateAndResolveImageUrl(loc.image_url, pageUrl),
      }));

    return { locations, skippedEntries, inputTokens, outputTokens, debugInfo };
  } catch {
    console.warn("[worker] extractFromPage: JSON.parse failed, raw snippet:", jsonStr.slice(0, 200));
    return { locations: [], skippedEntries: [], inputTokens, outputTokens, debugInfo };
  }
}

// ── Instagram strategy: bounded web_search via discoverWithPrompt ─────────────

async function runInstagramScrape(
  anthropic:     Anthropic,
  sourceUrl:     string,
  focusType:     FocusType,
  rubric:        string,
  region:        string,
  signal:        AbortSignal,
  db:            DB,
  jobId:         string,
  summary:       ResultSummary,
): Promise<DiscoveredLocation[]> {
  // Extract handle (e.g. instagram.com/visitalgarve -> "visitalgarve")
  const handle = sourceUrl
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-zA-Z0-9_.]/g, "")
    || "unknown";

  await updateProgress(db, jobId, { stage: "extract", stage_started_at: new Date().toISOString() });

  const rubricSection = rubric ? `\nQUALITY RUBRIC:\n${rubric}\n` : "";

  // TODO: Instagram extraction quality needs tuning. Tourism captions
  // rarely contain literal focus_type words like "accommodation".
  // Consider broadening query terms (e.g. "stayed at", "hotel", "villa"
  // for accommodation focus) or relaxing the extraction schema.
  // See update-8 smoke test A for context.

  const igFocusLabel = focusType === "all" ? "travel" : focusType;
  const igTypeField  = focusType === "all" ? `"type": "accommodation|restaurant|activity|things_to_do|route",` : `"type": "${focusType}",`;

  // One bounded web_search: find Instagram posts, extract from snippets only
  const prompt = `You are finding ${igFocusLabel} recommendations from the Instagram account @${handle}.

Search for: site:instagram.com "${handle}" ${igFocusLabel} ${region}

Instructions:
- Run ONE web_search with the query above.
- Extract ${igFocusLabel} entries ONLY from the search result snippets (~200 chars each). Do not follow any links.
- Maximum 8 entries total.
- Only include specifically named places.${focusType !== "all" ? ` Only include places that are clearly ${focusType} type.` : " Set type to accommodation, restaurant, activity, things_to_do, or route based on the place."}${rubricSection}

Return a JSON array:
[{
  "name": "Place name",
  ${igTypeField}
  "region": "${region}",
  "description": "What the snippet says about this place",
  "coordinates": {"lat": 0, "lng": 0},
  "sources": [{"url": "https://instagram.com/${handle}", "type": "instagram_profile", "author": "@${handle}", "excerpt": "..."}],
  "highlights": [],
  "metadata": {},
  "confidenceScore": 0.65,
  "confidenceReason": "From Instagram search snippets"
}]

OUTPUT — ONLY a valid JSON array, no prose.`;

  const extractStart = Date.now();
  const { locations, inputTokens, outputTokens } = await discoverWithPrompt(anthropic, prompt, signal);

  summary.stages.extract = {
    duration_ms:   Date.now() - extractStart,
    extractions:   locations.length,
    strategy:      "instagram_web_search",
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
  };
  summary.claude_calls                    = 1;
  summary.costs.anthropic_input_tokens  += inputTokens;
  summary.costs.anthropic_output_tokens += outputTokens;

  const stagesCompleted = ["extract"];
  await updateProgress(db, jobId, {
    stages_completed:  stagesCompleted,
    extractions_found: locations.length,
    extractions:       locations,
    sub_pages_total:   1,
    sub_pages_done:    1,
  });

  return locations;
}

// ── Stage 1 for run_scout jobs: build prompt + fat Claude call ────────────────
// Kept for run_scout pipeline only. scrape_source now uses 1A/1B/1C above.

function buildGeneralSearchPrompt(
  region:           string,
  vacationType:     string,
  contentTypes:     string[],
  focusKeywords:    string[],
  maxResults:       number,
  rubric:           string,
  demandSignals:    string,
  appendedUrls:     string[],
  depth:            "standard" | "exhaustive",
): string {
  const keywordsLine   = focusKeywords.length > 0 ? `\nFocus keywords: ${focusKeywords.join(", ")}` : "";
  const signalsSection = demandSignals ? `\n\n${demandSignals}` : "";
  const rubricSection  = rubric ? `\n\nQUALITY RUBRIC (apply at extraction time):\n${rubric}` : "";
  const sourcesHint    = appendedUrls.length > 0
    ? `\n\nKNOWN SOURCES\nThe following travel blogs and sites are known to cover this region — cite them when you know they feature a specific place:\n${appendedUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
    : "";
  const depthLine = depth === "exhaustive"
    ? `Return up to ${maxResults} results, covering all content types thoroughly.`
    : `Return up to ${maxResults} high-quality results. Focus on the most notable finds.`;

  return `You are a travel research agent for TruthStay — a community-driven holiday planning platform.
You are working from your training knowledge — you do NOT have web search tools in this session.

RESEARCH TARGET
- Region: ${region}
- Holiday type: ${vacationType}
- Content to find: ${contentTypes.join(", ")}
- ${depthLine}${keywordsLine}${signalsSection}${rubricSection}

RULES
- Draw on your training knowledge of authentic travel content for this region.
- Focus on personal travel blog coverage, Instagram finds, and specialist travel publications — NOT TripAdvisor, Booking.com, or sponsored platforms.
- Prioritise hidden gems, locally-loved spots, and honest traveller finds.
- For each result, cite the most plausible authentic source URL from your knowledge (a blog or Instagram you know has covered this place). If unsure of the exact URL, cite the site's homepage.
- Coordinates must be real and accurate (not 0,0 and not a country centroid).
- Only include places you are genuinely confident exist in this region.${sourcesHint}

OUTPUT — ONLY a valid JSON array, no prose, no markdown fences:
[
  {
    "name": "Exact place name",
    "type": "route | accommodation | restaurant | activity | things_to_do",
    "region": "${region}",
    "description": "2–3 sentences based on what travellers say about this place",
    "coordinates": { "lat": 0.0, "lng": 0.0 },
    "sources": [{ "url": "https://...", "type": "blog", "author": "Name or null", "excerpt": "What travellers say..." }],
    "highlights": ["feature 1", "feature 2"],
    "metadata": {},
    "confidenceScore": 0.0,
    "confidenceReason": "e.g. Well-documented boutique hotel mentioned across multiple travel blogs"
  }
]`;
}

async function discoverWithPrompt(
  anthropic: Anthropic,
  prompt:    string,
  signal?:   AbortSignal,
): Promise<{ locations: DiscoveredLocation[]; inputTokens: number; outputTokens: number }> {
  // No web_search tool — Claude answers from training knowledge.
  // web_search_20250305 makes multiple server-side page fetches (~15-20s each)
  // and consistently exceeds the 120s edge-function budget.
  // Real web sources are handled by scrape_source (paginated, checkpointed).
  const response = await anthropic.messages.create(
    {
      model:      MODEL,
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    },
    { signal },
  );

  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter(b => b.type === "text").map(b => b.text ?? "").join("\n");

  const match = text.match(/\[[\s\S]*\]/);
  let locations: DiscoveredLocation[] = [];
  if (match) {
    try { locations = JSON.parse(match[0]); } catch { locations = []; }
  }

  return {
    locations:    Array.isArray(locations) ? locations : [],
    inputTokens:  response.usage?.input_tokens  ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

// ── Stage 2: Resolve — Google Places geocoding ────────────────────────────────

function extractCountryFromAddressComponents(
  components: Array<{ long_name?: string; short_name?: string; types?: string[] }> | undefined,
): string | null {
  if (!Array.isArray(components)) return null;
  const c = components.find(c => Array.isArray(c?.types) && c.types.includes("country"));
  return c?.long_name ?? null;
}

async function resolveCoordinates(
  name:   string,
  region: string,
): Promise<ResolvedLocation | null> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return null;

  try {
    const query  = encodeURIComponent(`${name} ${region}`);
    const url    = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}&language=en`;
    const res    = await fetch(url);
    const data   = await res.json() as {
      results?: Array<{
        place_id?:           string;
        formatted_address?:  string;
        geometry?:           { location?: { lat: number; lng: number } };
        address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
      }>;
    };
    const result = data.results?.[0];
    if (!result?.geometry?.location) return null;
    return {
      lat:               result.geometry.location.lat,
      lng:               result.geometry.location.lng,
      place_id:          result.place_id ?? null,
      formatted_address: result.formatted_address ?? undefined,
      country:           extractCountryFromAddressComponents(result.address_components),
    };
  } catch {
    return null;
  }
}

function isValidCoords(c: { lat: number; lng: number } | undefined): boolean {
  return !!c && !(c.lat === 0 && c.lng === 0);
}

// ── Stage 3: Match — pg_trgm dedup ───────────────────────────────────────────

// Returns the existing entry's id if a match is found, null otherwise.
async function findExistingMatch(
  db:       DB,
  type:     string,
  name:     string,
  region:   string,
  resolved: ResolvedLocation,
): Promise<string | null> {
  // Primary: place_id exact match
  if (resolved.place_id) {
    const { data } = await db
      .from("content_entries")
      .select("id, status")
      .eq("place_id", resolved.place_id)
      .neq("status", "rejected")
      .limit(1);
    if (data?.length) return (data[0] as { id: string }).id;
  }

  // Fallback: name similarity > 0.6 + 50m proximity + same type
  try {
    const { data, error } = await db.rpc("match_content_entry_v2", {
      p_name:       name,
      p_lat:        resolved.lat,
      p_lng:        resolved.lng,
      p_focus_type: type,
    }) as { data: Array<{ id: string; status: string }> | null; error: unknown };
    if (error || !data?.length) return null;
    const match = data.find(r => r.status !== "rejected");
    return match?.id ?? null;
  } catch {
    // Last-resort exact name match
    const { data } = await db
      .from("content_entries")
      .select("id")
      .ilike("name", name)
      .ilike("region", region)
      .eq("type", type)
      .limit(1);
    return (data?.length ?? 0) > 0 ? (data![0] as { id: string }).id : null;
  }
}

// Merges new source evidence into an existing entry via a DB-side atomic function.
// The merge_scout_sources() Postgres function holds a FOR UPDATE lock on the row,
// so concurrent scout runs cannot lose evidence on the same entry.
async function mergeSourceIntoExisting(
  db:         DB,
  existingId: string,
  sourceUrls: SourceUrl[],
): Promise<void> {
  const { error } = await db.rpc("merge_scout_sources", {
    p_entry_id:        existingId,
    p_new_source_urls: sourceUrls,  // Supabase JS serialises array → jsonb; don't double-stringify
  });
  if (error) {
    console.warn(`[worker] merge_scout_sources failed for ${existingId}: ${error.message}`);
  }
}

// ── Stage 4: Score — heuristic ────────────────────────────────────────────────

function buildSourceUrls(rawSources: RawSource[]): SourceUrl[] {
  const seen   = new Set<string>();
  const result: SourceUrl[] = [];
  for (const s of (rawSources ?? [])) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    result.push({
      source_url:       s.url,
      source_type:      s.type ?? "web_search",
      source_label:     s.author  || undefined,
      evidence_excerpt: s.excerpt || undefined,
      first_seen_at:    new Date().toISOString(),
    });
  }
  return result;
}

function countIndependentSources(sourceUrls: SourceUrl[]): number {
  const domains = new Set(sourceUrls.map(s => {
    try { return new URL(s.source_url).hostname.replace(/^www\./, ""); } catch { return s.source_url; }
  }));
  return domains.size;
}

function computeTrustScore(sourceUrls: SourceUrl[], independentSourceCount: number): number {
  if (sourceUrls.length === 0) return 0;
  const avgCredibility = sourceUrls.reduce(
    (sum, s) => sum + (CREDIBILITY[s.source_type] ?? 0.5), 0
  ) / sourceUrls.length;
  return Math.min(1.0, independentSourceCount / 5) * avgCredibility;
}

function computeFeatures(loc: DiscoveredLocation, coords: { lat: number; lng: number } | undefined): Record<string, unknown> {
  const meta     = loc.metadata ?? {};
  const hasPrice = !!(
    meta.priceRange || meta.price_range || meta.pricePerNight ||
    String(loc.description ?? "").match(/\$|€|£|price|per night|from \d/i)
  );
  const hasAddress = !!(
    meta.address || String(loc.description ?? "").match(/\d+\s+\w+\s+(street|road|avenue|blvd|lane|st\.|rd\.|ave\.)/i)
  );
  const descLength = (loc.description ?? "").length;
  const qualExplanation = [
    descLength  < 80  && "short description",
    !hasPrice         && "no price info",
    !coords           && "no coordinates",
  ].filter(Boolean).join("; ") || "meets quality criteria";

  return {
    description_length:  descLength,
    has_price:           hasPrice,
    has_photos:          false,
    has_coordinates:     isValidCoords(coords),
    has_address:         hasAddress,
    highlights_count:    (loc.highlights ?? []).length,
    quality_explanation: qualExplanation,
  };
}

function computeQualityScore(features: Record<string, unknown>): number {
  let score = 0;
  if ((features.description_length as number) >= 120)     score += 0.30;
  else if ((features.description_length as number) >= 60) score += 0.15;
  if (features.has_price)                                  score += 0.20;
  if (features.has_coordinates)                            score += 0.25;
  if (features.has_address)                                score += 0.15;
  if ((features.highlights_count as number) >= 2)         score += 0.10;
  return Math.min(1.0, score);
}

function scoreEntry(loc: DiscoveredLocation, resolved: ResolvedLocation): ScoredEntry {
  const coords                 = { lat: resolved.lat, lng: resolved.lng };
  const sourceUrls             = buildSourceUrls(loc.sources ?? []);
  const independentSourceCount = countIndependentSources(sourceUrls);
  const trustScore             = computeTrustScore(sourceUrls, independentSourceCount);
  const features               = computeFeatures(loc, coords);
  const qualityScore           = computeQualityScore(features);
  return { loc, sourceUrls, independentSourceCount, trustScore, qualityScore, features, coordinates: coords, placeId: resolved.place_id, country: resolved.country };
}

// ── Stage 5: Queue — insert with pending_review ───────────────────────────────

async function queueEntry(db: DB, entry: ScoredEntry, runId: string, vacationType: string): Promise<boolean> {
  const { loc, sourceUrls, independentSourceCount, trustScore, qualityScore, features, coordinates, placeId, country } = entry;
  const { error } = await db.from("content_entries").insert({
    type:                     loc.type,
    name:                     loc.name.trim(),
    region:                   loc.region,
    activity_type:            vacationType,
    description:              loc.description,
    data: {
      coordinates,
      highlights:  loc.highlights ?? [],
      ...loc.metadata,
      agentRunId:  runId,
      scoutScore:  loc.confidenceScore,
      scoutReason: loc.confidenceReason,
    },
    source_urls:              sourceUrls,
    independent_source_count: independentSourceCount,
    source_trust_score:       trustScore,
    quality_score:            qualityScore,
    features,
    image_url:                loc.image_url ?? null,
    place_id:                 placeId ?? null,
    country:                  country ?? null,
    status:                   "pending_review",
    verified:                 false,
    source_type:              "agent",
    last_seen_at:             new Date().toISOString(),
  });
  if (error) {
    console.warn(`[worker] insert failed for "${loc.name}": ${error.message}`);
    return false;
  }
  return true;
}

// ── Demand signals (for run_scout jobs) ───────────────────────────────────────

async function getDemandSignals(db: DB, region: string): Promise<string> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await db
      .from("user_interactions")
      .select("session_activity_type, session_vacation_type, interaction_weight, content_entry_id")
      .ilike("session_region", `%${region}%`)
      .gte("created_at", since) as { data: Array<Record<string, unknown>> | null };

    if (!rows?.length) return "";

    const activityTally: Record<string, number> = {};
    const gapCounts:     Record<string, number> = {};

    for (const r of rows) {
      const at = String(r.session_activity_type ?? "unknown");
      activityTally[at] = (activityTally[at] ?? 0) + 1;
      if (!r.content_entry_id && r.session_activity_type) {
        const key = `${r.session_activity_type} in ${region}`;
        gapCounts[key] = (gapCounts[key] ?? 0) + 1;
      }
    }

    const topActivities = Object.entries(activityTally)
      .sort(([, a], [, b]) => b - a).slice(0, 5).map(([t, c]) => `${t} (${c})`);
    const gapList = Object.entries(gapCounts)
      .sort(([, a], [, b]) => b - a).slice(0, 5).map(([k]) => k);

    const lines = ["USER DEMAND SIGNALS (past 30 days):"];
    if (topActivities.length) lines.push(`- Most searched activity types: ${topActivities.join(", ")}`);
    if (gapList.length)       lines.push(`- Content gaps: ${gapList.join(", ")}`);
    lines.push("", "PRIORITISE content that fills the gaps.");
    return lines.join("\n");
  } catch {
    return "";
  }
}

// ── Stages 2–5 shared pipeline ────────────────────────────────────────────────

async function runResolveMatchScoreQueue(
  db:            DB,
  discovered:    DiscoveredLocation[],
  defaultRegion: string,
  vacationType:  string,
  runId:         string,
  jobId:         string,
  summary:       ResultSummary,
  jobStart:      number,
  signal:        AbortSignal,
): Promise<number> {
  const stagesCompleted: string[] = (progressState.stages_completed as string[] ?? []).slice();

  // Budget check before Stage 2
  if (signal.aborted || Date.now() - jobStart > JOB_BUDGET_MS - 10_000) {
    console.warn("[worker] approaching timeout budget before Stage 2 — requeuing");
    return -1;
  }

  await updateProgress(db, jobId, { stage: "resolve", stage_started_at: new Date().toISOString(), stages_completed: stagesCompleted });

  const resolveStart = Date.now();
  const toStage3: Array<{ loc: DiscoveredLocation; resolved: ResolvedLocation }> = [];
  let googleCalls  = 0;
  let resolvedCnt  = 0;
  let skippedCnt   = 0;

  for (const loc of discovered) {
    if (!loc.name?.trim()) continue;
    if ((loc.confidenceScore ?? 0) < MIN_SCOUT_SCORE) { skippedCnt++; continue; }

    let resolved: ResolvedLocation | null = isValidCoords(loc.coordinates)
      ? { lat: loc.coordinates.lat, lng: loc.coordinates.lng, place_id: null, country: null }
      : null;

    if (!resolved) {
      resolved = await resolveCoordinates(loc.name, loc.region ?? defaultRegion);
      googleCalls++;
      if (!resolved) {
        summary.warnings.push(`Stage 2: no coordinates for "${loc.name}" — skipped`);
        continue;
      }
      resolvedCnt++;
    }

    // Reconcile country: Google Places is authoritative; Claude extraction is fallback
    const country = resolved.country ?? loc.country ?? null;
    if (resolved.country && loc.country && resolved.country !== loc.country) {
      summary.warnings.push(`Stage 2: country mismatch for "${loc.name}" — Places="${resolved.country}" Claude="${loc.country}" (using Places)`);
    }

    toStage3.push({ loc: { ...loc, region: loc.region ?? defaultRegion }, resolved: { ...resolved, country } });
  }

  summary.stages.resolve = { duration_ms: Date.now() - resolveStart, resolved: resolvedCnt, skipped: skippedCnt };
  summary.google_places_calls += googleCalls;

  stagesCompleted.push("resolve");
  await updateProgress(db, jobId, { stages_completed: stagesCompleted, extractions_resolved: toStage3.length });

  // Stage 3: MATCH
  await updateProgress(db, jobId, { stage: "match", stage_started_at: new Date().toISOString() });

  const matchStart  = Date.now();
  const toScore: Array<{ loc: DiscoveredLocation; resolved: ResolvedLocation }> = [];
  let duplicateCnt  = 0;
  let mergedCnt     = 0;

  for (const { loc, resolved } of toStage3) {
    const existingId = await findExistingMatch(db, loc.type ?? "activity", loc.name, loc.region, resolved);
    if (existingId) {
      // Existing entry found — merge new source evidence rather than discarding it.
      const scored = scoreEntry(loc, resolved);
      await mergeSourceIntoExisting(db, existingId, scored.sourceUrls);
      mergedCnt++;
      duplicateCnt++;
      continue;
    }
    toScore.push({ loc, resolved });
  }

  summary.stages.match = { duration_ms: Date.now() - matchStart, new: toScore.length, duplicates: duplicateCnt, merged: mergedCnt };

  stagesCompleted.push("match");
  await updateProgress(db, jobId, { stages_completed: stagesCompleted, extractions_matched: toScore.length });

  // Stage 4: SCORE
  await updateProgress(db, jobId, { stage: "score", stage_started_at: new Date().toISOString() });

  const scoreStart = Date.now();
  const scored     = toScore.map(({ loc, resolved }) => scoreEntry(loc, resolved));

  summary.stages.score = { duration_ms: Date.now() - scoreStart, scored: scored.length };

  stagesCompleted.push("score");
  await updateProgress(db, jobId, { stages_completed: stagesCompleted });

  // Stage 5: QUEUE
  await updateProgress(db, jobId, { stage: "queue", stage_started_at: new Date().toISOString() });

  const queueStart = Date.now();
  let queued = 0;
  for (const entry of scored) {
    const inserted = await queueEntry(db, entry, runId, vacationType);
    if (inserted) queued++;
  }

  summary.stages.queue = { duration_ms: Date.now() - queueStart, queued };

  stagesCompleted.push("queue");
  await updateProgress(db, jobId, { stage: "done", stages_completed: stagesCompleted, entries_queued: queued });

  return queued;
}

// ── Pipeline: scrape_source (decomposed Stage 1) ──────────────────────────────

async function runScrapePipeline(
  db:        DB,
  anthropic: Anthropic,
  job:       ScoutJob,
  summary:   ResultSummary,
  jobStart:  number,
  signal:    AbortSignal,
): Promise<number> {
  const { data: source } = await db
    .from("content_sources")
    .select("id, url, type, label, region, seed_urls, focus_type")
    .eq("id", job.source_id!)
    .single() as { data: { id: string; url: string; type: string; label: string; region: string | null; seed_urls: string[]; focus_type: string | null } | null };

  if (!source) throw new Error(`Source ${job.source_id} not found`);

  const region    = source.region ?? "Europe";
  const rubric    = await fetchRubric(db);
  const focusType = (job.trigger_payload.focus_type as FocusType | undefined)
    ?? (source.focus_type as FocusType | null)
    ?? "accommodation";
  const depth     = job.trigger_payload.mode === "exhaustive" ? "exhaustive" : "standard";
  const maxResults = depth === "exhaustive" ? MAX_EXTRACTIONS_EXH : MAX_EXTRACTIONS_STD;

  const isInstagram = source.type === "instagram" || source.url.includes("instagram.com");

  // ── Resume-state detection ────────────────────────────────────────────────────
  const cachedSubPages  = Array.isArray(job.progress?.sub_pages)   ? job.progress.sub_pages  as string[]             : null;
  const cachedExtracts  = Array.isArray(job.progress?.extractions)  ? job.progress.extractions as DiscoveredLocation[] : [];
  const subPagesDone    = Number(job.progress?.sub_pages_done   ?? 0);
  const subPagesTotal   = Number(job.progress?.sub_pages_total  ?? 0);

  const isStage1Complete = cachedSubPages !== null && subPagesDone >= subPagesTotal && subPagesTotal > 0;
  const isPartialResume  = cachedSubPages !== null && !isStage1Complete;

  let allExtractions: DiscoveredLocation[];
  const spaCache: SpaMethodCache = { method: null }; // filled after Stage 1A; null = auto-detect

  if (isStage1Complete) {
    // All sub-pages processed — skip straight to Stages 2–5
    allExtractions             = cachedExtracts;
    summary.stages.extract     = { duration_ms: 0, extractions: allExtractions.length, cached: true };
    summary.claude_calls       = 0;
    console.log(`[worker] Stage 1 complete (checkpoint) — ${allExtractions.length} extractions, skipping to Stage 2`);

  } else if (isInstagram) {
    allExtractions = await runInstagramScrape(
      anthropic, source.url, focusType, rubric, region, signal, db, job.id, summary,
    );

  } else {
    // Website: Stage 1A → 1B → 1C  (or resume from partial 1C)
    let subPages:  string[];
    let startPage: number;

    if (isPartialResume) {
      subPages   = cachedSubPages!;
      startPage  = subPagesDone;
      allExtractions = [...cachedExtracts];
      console.log(`[worker] Stage 1C resuming at page ${startPage}/${subPages.length}`);
      await updateProgress(db, job.id, { stage: "extract", stage_started_at: new Date().toISOString() });

    } else {
      // Stage 1A — fetch (hybrid: static first, headless fallback for SPAs)
      await updateProgress(db, job.id, { stage: "fetch", stage_started_at: new Date().toISOString() });
      const fetchStart  = Date.now();
      const homePage    = await fetchSourcePage(source.url, db, signal);
      summary.stages.fetch = {
        duration_ms:           Date.now() - fetchStart,
        fetch_method:          homePage.fetchMethod,
        cost_estimate_usd:     homePage.costEstimateUsd,
        ...(homePage.spaDetectionReason ? { spa_detection_reason: homePage.spaDetectionReason } : {}),
      };
      summary.costs.scrapingbee_usd += homePage.costEstimateUsd;
      if (homePage.fetchMethod === "headless") summary.costs.scrapingbee_calls++;

      // Stage 1B — discover sub-pages (seed_urls > sitemap > homepage_links)
      await updateProgress(db, job.id, { stage: "discover", stage_started_at: new Date().toISOString() });
      const discoverStart  = Date.now();
      const discoverResult = await buildCandidateSubPages(
        { url: source.url, seed_urls: source.seed_urls ?? [] },
        homePage.html,
        homePage.finalUrl,
        focusType,
        signal,
      );
      subPages = discoverResult.sub_pages;
      summary.stages.discover = {
        duration_ms:           Date.now() - discoverStart,
        strategy:              discoverResult.strategy,
        sub_pages:             subPages.length,
        candidate_links_total: discoverResult.candidate_links_total,
        locale_used:           discoverResult.locale_used,
        locale_sources:        discoverResult.locale_sources,
        keywords_total:        discoverResult.keywords_total,
        ...(discoverResult.sitemap_urls_total !== undefined ? { sitemap_urls_total: discoverResult.sitemap_urls_total } : {}),
        ...(discoverResult.sitemap_url_used   ? { sitemap_url_used:   discoverResult.sitemap_url_used   } : {}),
        top_candidates:        discoverResult.top_candidates,
      };

      startPage      = 0;
      allExtractions = [];

      // Cache the SPA method detected on the homepage; Stage 1C sub-page fetches inherit it
      spaCache.method = homePage.fetchMethod;

      await updateProgress(db, job.id, {
        stage:           "extract",
        stage_started_at: new Date().toISOString(),
        sub_pages:        subPages,
        sub_pages_total:  subPages.length,
        sub_pages_done:   0,
        extractions:      [],
      });
    }
    // For partial resumes, spaCache.method stays null → auto-detect on first sub-page

    // Stage 1C — per-page extraction loop
    const extractStart       = Date.now();
    let extractInputTokens   = 0;
    let extractOutputTokens  = 0;
    let firstPageDebug: Record<string, unknown> | undefined;
    const allSkipped: SkippedEntry[] = [];

    for (let i = startPage; i < subPages.length; i++) {
      if (signal.aborted) {
        await updateProgress(db, job.id, { sub_pages_done: i, extractions: allExtractions });
        throw Object.assign(new Error(`Worker budget reached after ${i}/${subPages.length} pages`), { name: "AbortError" });
      }

      // Fetch page — uses cached SPA method after first page
      let pageHtml: string;
      try {
        const fetched = await fetchSourcePage(subPages[i], db, signal, spaCache);
        pageHtml = fetched.html;
        summary.costs.scrapingbee_usd += fetched.costEstimateUsd;
        if (fetched.fetchMethod === "headless") summary.costs.scrapingbee_calls++;
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          await updateProgress(db, job.id, { sub_pages_done: i, extractions: allExtractions });
          throw e;
        }
        summary.warnings.push(`Page ${i + 1} fetch failed (${subPages[i]}): ${(e as Error).message}`);
        await updateProgress(db, job.id, { sub_pages_done: i + 1, extractions: allExtractions });
        continue;
      }

      // Extract
      let pageExtractions: DiscoveredLocation[] = [];
      try {
        const result = await extractFromPage(
          anthropic, subPages[i], pageHtml, focusType, rubric, region, signal,
        );
        pageExtractions          = result.locations;
        extractInputTokens      += result.inputTokens;
        extractOutputTokens     += result.outputTokens;
        summary.costs.anthropic_input_tokens  += result.inputTokens;
        summary.costs.anthropic_output_tokens += result.outputTokens;
        if (i === startPage) firstPageDebug = { page: subPages[i], ...result.debugInfo };
        if (result.skippedEntries.length > 0) allSkipped.push(...result.skippedEntries);
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          await updateProgress(db, job.id, { sub_pages_done: i, extractions: allExtractions });
          throw e;
        }
        summary.warnings.push(`Page ${i + 1} extract failed (${subPages[i]}): ${(e as Error).message}`);
      }

      // Cap total extractions
      const remaining = maxResults - allExtractions.length;
      allExtractions.push(...pageExtractions.slice(0, remaining));

      // Checkpoint after each page
      await updateProgress(db, job.id, { sub_pages_done: i + 1, extractions: allExtractions });
      console.log(`[worker] page ${i + 1}/${subPages.length}: ${pageExtractions.length} extractions (total ${allExtractions.length})`);

      if (allExtractions.length >= maxResults) break;
    }

    summary.stages.extract = {
      duration_ms:   Date.now() - extractStart,
      extractions:   allExtractions.length,
      pages:         subPages.length,
      input_tokens:  extractInputTokens,
      output_tokens: extractOutputTokens,
      claude_calls:  subPages.length,
      ...(allSkipped.length > 0 ? { skipped_unknown_types: allSkipped } : {}),
      ...(firstPageDebug ? { debug: firstPageDebug } : {}),
    };
    summary.claude_calls = subPages.length;

    const stagesCompleted = [
      ...(summary.stages.fetch   ? ["fetch"]   : []),
      ...(summary.stages.discover ? ["discover"] : []),
      "extract",
    ];
    await updateProgress(db, job.id, {
      stages_completed:  stagesCompleted,
      extractions_found: allExtractions.length,
    });
  }

  const runId  = crypto.randomUUID();
  const queued = await runResolveMatchScoreQueue(
    db, allExtractions, region, `source_scrape:${job.source_id}`,
    runId, job.id, summary, jobStart, signal,
  );

  if (queued === -1) {
    throw Object.assign(new Error("Soft timeout at stage boundary"), { name: "AbortError" });
  }

  return queued;
}

// ── Pipeline: run_scout ───────────────────────────────────────────────────────

async function runScoutPipeline(
  db:        DB,
  anthropic: Anthropic,
  job:       ScoutJob,
  summary:   ResultSummary,
  jobStart:  number,
  signal:    AbortSignal,
): Promise<number> {
  const p = job.trigger_payload;

  const region            = String(p.region ?? "Europe");
  const vacationType      = String(p.vacationType ?? "Active Holiday");
  const contentTypes      = (p.contentTypes as string[] | undefined) ?? ["route", "accommodation", "restaurant"];
  const maxResults        = Number(p.maxResults ?? 10);
  // run_scout is a single-shot Claude call; large brackets exceed the 120s JOB_BUDGET_MS.
  // scrape_source handles large brackets page-by-page — no cap needed there.
  const claudeRequestMax  = Math.min(maxResults, MAX_CLAUDE_DISCOVERIES);
  const focusKeywords     = (p.focusKeywords as string[] | undefined) ?? [];
  const includeActiveSrcs = Boolean(p.includeActiveSources);
  const depth             = p.depth === "exhaustive" ? "exhaustive" : "standard";
  const sourceUrls        = (p.sourceUrls as string[] | undefined) ?? [];
  const restrictToSrcs    = Boolean(p.restrictToSources);
  const isSourceMode      = sourceUrls.length > 0;

  const rubric          = await fetchRubric(db);
  let demandSignals     = "";
  let appendedUrls: string[] = [];

  if (!isSourceMode) {
    demandSignals = await getDemandSignals(db, region);
    if (includeActiveSrcs) {
      try {
        const { data: activeSources } = await db
          .from("content_sources")
          .select("url")
          .eq("status", "active")
          .or(`region.ilike.%${region}%,region.is.null`);
        appendedUrls = (activeSources ?? []).map((r: { url: string }) => r.url);
      } catch { /* non-fatal */ }
    }
  }

  // Stage 1: Extract — with checkpoint for re-entry
  let discovered: DiscoveredLocation[];

  const cached = job.progress?.extractions;
  if (Array.isArray(cached) && cached.length > 0) {
    discovered             = cached as DiscoveredLocation[];
    summary.stages.extract = { duration_ms: 0, extractions: discovered.length, cached: true };
    summary.claude_calls   = 0;
    console.log(`[worker] Stage 1 skipped (re-entry) — ${discovered.length} cached extractions`);
  } else {
    await updateProgress(db, job.id, { stage: "extract", stage_started_at: new Date().toISOString() });

    const prompt = isSourceMode
      ? buildGeneralSearchPrompt(region, vacationType, contentTypes, focusKeywords, claudeRequestMax, rubric, demandSignals, sourceUrls, depth)
      : buildGeneralSearchPrompt(region, vacationType, contentTypes, focusKeywords, claudeRequestMax, rubric, demandSignals, appendedUrls, depth);

    const { result, durationMs } = await timed(() => discoverWithPrompt(anthropic, prompt, signal));

    let locations  = result.locations;
    const capped   = locations.length > maxResults;
    if (capped) {
      summary.warnings.push(`Stage 1: capped at ${maxResults} (found ${locations.length})`);
      locations = locations.slice(0, maxResults);
    }

    // If Claude returned fewer than requested, all available sources were exhausted.
    const sourcesExhausted = !capped && locations.length < maxResults;

    discovered             = locations;
    summary.stages.extract = { duration_ms: durationMs, extractions: discovered.length, capped, sources_exhausted: sourcesExhausted };
    summary.claude_calls   = 1;

    const stagesCompleted = ["extract"];
    await updateProgress(db, job.id, {
      stages_completed:  stagesCompleted,
      extractions_found: discovered.length,
      extractions:       discovered,
    });
  }

  const runId  = crypto.randomUUID();
  const queued = await runResolveMatchScoreQueue(
    db, discovered, region, vacationType, runId, job.id, summary, jobStart, signal,
  );

  if (queued === -1) {
    throw Object.assign(new Error("Soft timeout at stage boundary"), { name: "AbortError" });
  }

  return queued;
}

// ── Retry / failure logic ─────────────────────────────────────────────────────

function isRetryable(err: unknown): { retry: boolean; code: string } {
  const e = err as Record<string, unknown>;
  if (e?.status && RETRYABLE_HTTP_CODES.includes(e.status as number)) {
    return { retry: true, code: `HTTP_${e.status}` };
  }
  if (e?.name && RETRYABLE_ERROR_NAMES.includes(e.name as string)) {
    return { retry: true, code: e.name as string };
  }
  if ((e?.message as string)?.match(/timeout|ECONNRESET|ENOTFOUND/i)) {
    return { retry: true, code: "NETWORK" };
  }
  return { retry: false, code: "PERMANENT" };
}

async function handleFailure(
  db:       DB,
  job:      ScoutJob,
  err:      unknown,
  summary:  ResultSummary,
  jobStart: number,
): Promise<void> {
  const e       = err as Record<string, unknown>;
  const message = (e?.message as string | undefined)?.slice(0, 500) ?? String(err).slice(0, 500);
  const { retry, code } = isRetryable(err);

  summary.total_duration_ms = Date.now() - jobStart;

  if (retry && job.attempt_count < job.max_attempts) {
    const backoffSecs = [30, 120, 600][job.attempt_count - 1] ?? 600;
    await db.from("scout_jobs").update({
      status:          "queued",
      next_attempt_at: new Date(Date.now() + backoffSecs * 1000).toISOString(),
      last_error:      message,
      last_error_code: code,
      progress:        progressState,
    }).eq("id", job.id);
    console.log(`[worker] job ${job.id} retry in ${backoffSecs}s (${code})`);
  } else {
    await db.from("scout_jobs").update({
      status:          "failed",
      finished_at:     new Date().toISOString(),
      last_error:      message,
      last_error_code: code,
      result_summary:  summary,
      progress:        progressState,
    }).eq("id", job.id);

    if (job.source_id) {
      await updateSourceOnFailure(db, job.source_id, message);
    }

    console.error(`[worker] job ${job.id} failed permanently (${code}): ${message}`);
  }
}

async function updateSourceOnFailure(db: DB, sourceId: string, errorMessage: string): Promise<void> {
  await db.from("content_sources").update({
    last_error_at:      new Date().toISOString(),
    last_error_message: errorMessage,
  }).eq("id", sourceId);

  const { data: recent } = await db
    .from("scout_jobs")
    .select("status")
    .eq("source_id", sourceId)
    .eq("job_type", "scrape_source")
    .order("created_at", { ascending: false })
    .limit(3);

  if (recent && recent.length >= 3 && recent.every((j: { status: string }) => j.status === "failed")) {
    await db.from("content_sources").update({ health: "broken" }).eq("id", sourceId);
    console.warn(`[worker] source ${sourceId} marked broken after 3 consecutive failures`);
  }
}

async function updateSourceAfterSuccess(db: DB, sourceId: string, entriesCreated: number): Promise<void> {
  const { data: src } = await db
    .from("content_sources").select("entry_count").eq("id", sourceId).single();
  await db.from("content_sources").update({
    last_scraped_at:    new Date().toISOString(),
    entry_count:        (src?.entry_count ?? 0) + entriesCreated,
    status:             "active",
    health:             "ok",
    last_error_at:      null,
    last_error_message: null,
  }).eq("id", sourceId);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  progressState = {};

  const db        = makeDb();
  const anthropic = makeAnthropic();
  const jobStart  = Date.now();

  const { data: claimed, error: claimError } = await db.rpc("claim_next_scout_job");
  if (claimError) {
    console.error(`[worker] claim error: ${claimError.message}`);
    return new Response("claim error", { status: 500 });
  }

  const job: ScoutJob | null = Array.isArray(claimed)
    ? (claimed[0] ?? null)
    : (claimed ?? null);

  if (!job) {
    return new Response("no jobs", { status: 200 });
  }

  progressState = { ...(job.progress ?? {}) };

  const summary: ResultSummary = {
    stages:              {},
    total_duration_ms:   0,
    claude_calls:        0,
    google_places_calls: 0,
    warnings:            [],
    costs: {
      scrapingbee_calls:          0,
      scrapingbee_usd:            0,
      anthropic_input_tokens:     0,
      anthropic_output_tokens:    0,
      anthropic_usd_estimate:     0,
      google_places_calls:        0,
      google_places_usd_estimate: 0,
      total_usd_estimate:         0,
    },
  };

  console.log(`[worker] claiming job ${job.id} (type=${job.job_type}, attempt=${job.attempt_count})`);
  await updateProgress(db, job.id, {
    stage:            "starting",
    stage_started_at:  new Date().toISOString(),
    stages_completed:  progressState.stages_completed ?? [],
  });

  // Step 4: AbortController for the 120s worker budget
  const workerAbort = new AbortController();
  const budgetTimer = setTimeout(() => {
    console.warn(`[worker] budget timer fired (${JOB_BUDGET_MS}ms) — aborting job ${job.id}`);
    workerAbort.abort("budget");
  }, JOB_BUDGET_MS);

  try {
    let entriesCreated = 0;

    if (job.job_type === "scrape_source") {
      entriesCreated = await runScrapePipeline(db, anthropic, job, summary, jobStart, workerAbort.signal);
    } else if (job.job_type === "run_scout") {
      entriesCreated = await runScoutPipeline(db, anthropic, job, summary, jobStart, workerAbort.signal);
    }

    summary.total_duration_ms = Date.now() - jobStart;

    // Finalize derived cost fields
    summary.costs.anthropic_usd_estimate =
      (summary.costs.anthropic_input_tokens  / 1_000_000) * ANTHROPIC_INPUT_COST_PER_1M +
      (summary.costs.anthropic_output_tokens / 1_000_000) * ANTHROPIC_OUTPUT_COST_PER_1M;
    summary.costs.google_places_calls        = summary.google_places_calls;
    summary.costs.google_places_usd_estimate = summary.google_places_calls * GOOGLE_PLACES_COST_PER_CALL;
    summary.costs.total_usd_estimate =
      summary.costs.scrapingbee_usd +
      summary.costs.anthropic_usd_estimate +
      summary.costs.google_places_usd_estimate;

    await db.from("scout_jobs").update({
      status:          "done",
      finished_at:     new Date().toISOString(),
      entries_created: entriesCreated,
      result_summary:  summary,
      progress:        progressState,
    }).eq("id", job.id);

    if (job.job_type === "scrape_source" && job.source_id) {
      await updateSourceAfterSuccess(db, job.source_id, entriesCreated);
    }

    console.log(`[worker] job ${job.id} done — ${entriesCreated} entries (${summary.total_duration_ms}ms)`);
    return new Response("ok", { status: 200 });

  } catch (err) {
    const e = err as { name?: string; message?: string };

    if (e.name === "AbortError" || e.name === "APIUserAbortError") {
      // Budget exhausted or explicit abort: checkpoint already written by pipeline.
      // Requeue immediately (5s) so the next cron tick picks it up.
      await db.from("scout_jobs").update({
        status:          "queued",
        next_attempt_at:  new Date(Date.now() + 5_000).toISOString(),
        last_error:       `Checkpoint: ${e.message ?? "worker budget exceeded"}`,
        last_error_code:  "BUDGET_CHECKPOINT",
        progress:         progressState,
      }).eq("id", job.id);
      console.log(`[worker] job ${job.id} checkpointed and requeued (${e.message})`);
    } else {
      await handleFailure(db, job, err, summary, jobStart);
    }

    return new Response("ok", { status: 200 });

  } finally {
    clearTimeout(budgetTimer);
  }
});
