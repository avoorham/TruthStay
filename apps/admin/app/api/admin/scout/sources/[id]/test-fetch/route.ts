import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Inline utilities (mirrors scout-worker logic for static HTML only) ─────────
// ScrapingBee is not called here — SPAs are flagged but headless is not triggered.
// Full headless rendering happens in the worker when a job actually runs.

interface ExtractedLink { url: string; anchorText: string; title?: string }

function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const aTagRe  = /<a\s([^>]*)>([\s\S]*?)<\/a>/gi;
  const hrefRe  = /href=["']([^"']+)["']/i;
  const titleRe = /title=["']([^"']*)["']/i;
  const seen    = new Map<string, ExtractedLink>();
  let match: RegExpExecArray | null;
  while ((match = aTagRe.exec(clean)) !== null) {
    const attrs     = match[1];
    const inner     = match[2];
    if (!attrs || !inner) continue;
    const hrefMatch = hrefRe.exec(attrs);
    const href      = hrefMatch?.[1];
    if (!href || href.startsWith("#")) continue;
    try {
      const url        = new URL(href, baseUrl).href;
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
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

function isLikelySPA(html: string): { isSPA: boolean; reason: string } {
  if (/<div\s+id=["'](?:root|app|__next)["']>\s*<\/div>/i.test(html))
    return { isSPA: true, reason: "empty SPA root container" };
  const linkCount = (html.match(/<a\s+[^>]*href=/gi) ?? []).length;
  if (linkCount < 5)
    return { isSPA: true, reason: `only ${linkCount} <a> tags in static HTML` };
  if (htmlToText(html).length < 500)
    return { isSPA: true, reason: "less than 500 chars of visible text" };
  if (/<noscript>[^<]*javascript/i.test(html))
    return { isSPA: true, reason: "noscript JS warning present" };
  return { isSPA: false, reason: "static HTML viable" };
}

function getLocale(url: string, html?: string): string {
  const pathMatch = url.match(/\/(en|nl|de|fr|es|it|pt)(?:\/|$|\?|#)/i);
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase();
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith(".nl")) return "nl";
    if (hostname.endsWith(".de")) return "de";
    if (hostname.endsWith(".fr")) return "fr";
    if (hostname.endsWith(".es")) return "es";
    if (hostname.endsWith(".it")) return "it";
    if (hostname.endsWith(".pt")) return "pt";
    if (hostname.endsWith(".be")) return "nl";
    if (hostname.endsWith(".at") || hostname.endsWith(".ch")) return "de";
  } catch { /* ignore */ }
  if (html) {
    const m = html.match(/<html[^>]+lang=["']([a-z]{2})/i);
    if (m?.[1]) return m[1].toLowerCase();
  }
  return "en";
}

const LOCALE_KW: Record<string, Record<string, string[]>> = {
  accommodation: {
    en: ["hotel","stay","accommodat","lodging","guesthouse","villa","resort","apartment"],
    nl: ["hotel","overnachten","accommodatie","verblijf","vakantiehuis","appartement","pension","logies"],
    de: ["hotel","unterkunft","pension","ferienwohnung","gasthaus","herberge","apartment"],
    fr: ["hotel","hébergement","logement","gîte","chambre","appartement","auberge"],
    es: ["hotel","alojamiento","hospedaje","apartamento","hostal","pension","casa"],
    it: ["hotel","alloggio","albergo","pensione","agriturismo","appartamento","soggiorno"],
    pt: ["hotel","alojamento","hospedagem","pousada","apartamento","quinta","casa"],
  },
  restaurant: {
    en: ["restaurant","eat","dining","cafe","food","cuisine"],
    nl: ["restaurant","eten","cafe","eetcafe","bistro"],
    de: ["restaurant","essen","gaststätte","lokal","café"],
    fr: ["restaurant","manger","café","bistro","cuisine"],
    es: ["restaurante","comer","café","bar","cocina"],
    it: ["ristorante","mangiare","trattoria","osteria","cucina"],
    pt: ["restaurante","comer","café","cozinha"],
  },
  activity: {
    en: ["activity","thing-to-do","tour","experience","visit"],
    nl: ["activiteit","bezienswaardigheden","doen","tour","excursie","bezoek"],
    de: ["aktivität","sehenswürdigkeit","tour","erlebnis","besuch"],
    fr: ["activité","visite","tour","expérience","excursion"],
    es: ["actividad","visita","tour","experiencia","excursión"],
    it: ["attività","visita","tour","esperienza","escursione"],
    pt: ["atividade","visita","tour","experiência","excursão"],
  },
  route: {
    en: ["route","trail","ride","cycling","hike","walk"],
    nl: ["route","wandeling","fietsen","wandelpad","fietsroute"],
    de: ["route","wanderung","radweg","wanderweg","tour"],
    fr: ["route","sentier","randonnée","piste","circuit"],
    es: ["ruta","sendero","senderismo","ciclismo","camino"],
    it: ["percorso","sentiero","ciclabile","escursione","cammino"],
    pt: ["rota","trilha","caminhada","ciclismo","caminho"],
  },
};

function discoverPreview(
  html: string, baseUrl: string, focusType: string,
): {
  locale_used: string;
  candidate_links_total: number;
  top_candidates: Array<{ url: string; score: number; matched_keywords: string[] }>;
  sub_pages: string[];
} {
  let baseHostname = "";
  try { baseHostname = new URL(baseUrl).hostname; } catch { /* ignore */ }

  const locale    = getLocale(baseUrl, html);
  const localeKws = LOCALE_KW[focusType]?.[locale] ?? [];
  const engKws    = LOCALE_KW[focusType]?.["en"] ?? [];
  const keywords  = [...new Set([...engKws, ...localeKws])];

  const allLinks   = extractLinks(html, baseUrl);
  const sameDomain = allLinks.filter(l => {
    try { return new URL(l.url).hostname === baseHostname; } catch { return false; }
  });

  const scored = sameDomain.map(link => {
    const urlLc  = link.url.toLowerCase();
    const textLc = (link.anchorText + " " + (link.title ?? "")).toLowerCase();
    const matched: string[] = [];
    for (const kw of keywords) {
      if (urlLc.includes(kw))  matched.push(kw + "@url");
      if (textLc.includes(kw)) matched.push(kw + "@text");
    }
    const score = matched.filter(m => m.endsWith("@url")).length * 2
                + matched.filter(m => m.endsWith("@text")).length * 1;
    return { url: link.url, score, matched_keywords: matched };
  });

  const withScore = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  const fallback  = withScore.length === 0;
  const candidates = fallback
    ? sameDomain.slice(0, 5).map(l => ({ url: l.url, score: 0, matched_keywords: [] as string[] }))
    : withScore;

  const top_candidates = candidates.slice(0, 10);
  const sub_pages = [baseUrl, ...candidates.filter(c => c.url !== baseUrl).slice(0, 4).map(c => c.url)];

  return { locale_used: locale, candidate_links_total: sameDomain.length, top_candidates, sub_pages };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const focusType: string = body.focus_type ?? "accommodation";

  const db = createAdminClient();
  const { data: source, error: srcErr } = await db
    .from("content_sources").select("id, url, type, label").eq("id", id).single();

  if (srcErr || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const isInstagram = source.type === "instagram" || source.url.includes("instagram.com");
  if (isInstagram) {
    return NextResponse.json({
      source_id:   id,
      source_url:  source.url,
      fetch_method: "instagram",
      note: "Instagram sources use a web_search strategy in the worker — no static fetch preview available.",
    });
  }

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(source.url, {
      signal:   controller.signal,
      headers:  { "User-Agent": "TruthStayBot/1.0 (+https://truth-stay.com)", "Accept": "text/html,*/*" },
      redirect: "follow",
    });

    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json({
        source_id: id, source_url: source.url,
        error: `HTTP ${response.status} from source`,
      }, { status: 200 });
    }

    const html        = (await response.text()).slice(0, 500_000);
    const finalUrl    = response.url;
    const spa         = isLikelySPA(html);
    const visibleText = htmlToText(html);

    const discover = spa.isSPA
      ? null
      : discoverPreview(html, finalUrl, focusType);

    return NextResponse.json({
      source_id:          id,
      source_url:         source.url,
      final_url:          finalUrl,
      fetch_method:       spa.isSPA ? "headless_required" : "static",
      spa_detected:       spa.isSPA,
      spa_reason:         spa.reason,
      visible_text_chars: visibleText.length,
      cost_estimate_usd:  spa.isSPA ? 0.005 : 0,
      discover,
      note: spa.isSPA
        ? "This site is a SPA. The worker will use ScrapingBee for JS rendering (~$0.005/page). Discover preview unavailable from static HTML."
        : null,
    });
  } catch (e: unknown) {
    clearTimeout(timer);
    return NextResponse.json({
      source_id: id, source_url: source.url,
      error: (e as Error).message ?? "fetch failed",
    }, { status: 200 });
  }
}
