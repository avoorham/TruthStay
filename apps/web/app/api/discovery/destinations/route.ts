import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

interface DestinationInput {
  name: string;
  type: "region" | "city" | "route";
}

interface Budget { min: number; max: number; }

interface Filters {
  duration_days: number;
  budget?: Budget;
  travelers?: number;
  vacation_style?: string[];
}

interface RequestBody {
  input: DestinationInput;
  filters: Filters;
}

interface DestinationTile {
  name: string;
  type: "city" | "region" | "stop";
  country: string | null;
  region: string;
  hero_images: string[];
  description: string;
  why_it_fits: string[];
  matched_style_tags: string[];
  source_entry_ids: string[];
}

interface ClaudeDestination {
  name: string;
  type: string;
  country: string | null;
  region: string;
  description: string;
  why_it_fits: string[];
  matched_style_tags: string[];
}

// POST /api/discovery/destinations
// Takes a chip selection + filters, returns AI-proposed destination tiles.
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { input, filters } = body;
  if (!input?.name || !input?.type) {
    return Response.json({ error: "input.name and input.type required" }, { status: 400 });
  }
  if (!filters?.duration_days) {
    return Response.json({ error: "filters.duration_days required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Pull content_entries relevant to the input for grounding the AI
  type ContentRow = {
    id: string;
    name: string;
    type: string;
    region: string;
    country: string | null;
    description: string | null;
    trust_score: number;
    save_count: number;
    image_url: string | null;
  };

  let contentQuery = db
    .from("content_entries")
    .select("id, name, type, region, country, description, trust_score, save_count, image_url")
    .eq("verified", true)
    .eq("status", "approved")
    .order("trust_score", { ascending: false })
    .limit(60);

  if (input.type === "region") {
    contentQuery = contentQuery.ilike("region", `%${input.name}%`);
  } else if (input.type === "city") {
    contentQuery = contentQuery.or(`region.ilike.%${input.name}%,name.ilike.%${input.name}%`);
  } else {
    // route — search by name
    contentQuery = contentQuery.ilike("name", `%${input.name}%`);
  }

  const { data: entries } = await contentQuery;
  const contentRows = (entries ?? []) as ContentRow[];

  // Group entries by region/city for context
  const byRegion = new Map<string, ContentRow[]>();
  for (const e of contentRows) {
    const key = e.region ?? "Unknown";
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key)!.push(e);
  }

  const sourceData = [...byRegion.entries()]
    .map(([region, rows]) => {
      const sample = rows.slice(0, 5).map(r =>
        `  - [${r.type}] ${r.name}: ${(r.description ?? "").slice(0, 120)}`
      ).join("\n");
      return `${region} (${rows.length} entries):\n${sample}`;
    })
    .join("\n\n");

  const b = filters.budget;
  const bMin = b?.min ?? 1500;
  const bMax = b?.max ?? 3500;
  const bMid = Math.round((bMin + bMax) / 2);
  const perNight = Math.round(bMid / Math.max(filters.duration_days, 1) / Math.max(filters.travelers ?? 2, 1));
  const budgetLabel = `€${bMin}–€${bMax} total (≈€${Math.round(perNight * 0.9)}–€${Math.round(perNight * 1.1)}/night/adult)`;
  const duration = filters.duration_days;
  const vacationStyle = filters.vacation_style ?? [];

  let instruction = "";
  if (input.type === "region") {
    instruction = `Propose 5–8 cities or towns within the ${input.name} region that suit a ${duration}-day trip.`;
  } else if (input.type === "city") {
    instruction = `Propose the city of ${input.name} plus 2–4 nearby destinations that pair well for a ${duration}-day trip.`;
  } else {
    instruction = `The user wants to follow the "${input.name}" route. Decompose it into its natural stops (towns/villages the route passes through), treating each stop as a destination tile.`;
  }

  const styleSection = vacationStyle.length > 0
    ? `\nVacation style signals (use as soft ranking — prioritise destinations that genuinely match multiple of these, but don't exclude destinations that only match a few):
${vacationStyle.map(s => `  - ${s}`).join("\n")}

For each destination include "matched_style_tags": an array of 2–4 tags from the list above that this destination genuinely matches. Only include tags that are a real, honest fit — don't force matches.

Rewrite "why_it_fits" as 2–3 plain-English sentences that cite the matched style traits naturally (e.g. "Matches your taste for a local-town feel and romantic evenings — Sagres is quiet enough for slow mornings but has enough character to fill your days."). Do not use bullet points in why_it_fits; write in flowing prose.`
    : "";

  const prompt = `You are a travel planner. ${instruction}

Trip parameters: ${duration} days, ${filters.travelers ?? 2} travellers, budget ${budgetLabel}.${styleSection}

Use the source data below as your knowledge base. Synthesise accurate, specific descriptions.

Source data from our database:
${sourceData || "(No scraped content yet — rely on your knowledge of the destination)"}

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "destinations": [
    {
      "name": "City/town name",
      "type": "city",
      "country": "Country name",
      "region": "${input.name}",
      "description": "2–3 sentence description of what makes this destination special and why it suits this traveller",
      "why_it_fits": ["Plain-English sentence citing matched style traits", "Another reason"],
      "matched_style_tags": ["Tag 1", "Tag 2"]
    }
  ]
}`;

  let aiDestinations: ClaudeDestination[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text?: string }).text ?? "";
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { destinations?: ClaudeDestination[] };
      aiDestinations = parsed.destinations ?? [];
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "AI generation failed", detail: msg }, { status: 500 });
  }

  // For each AI-suggested destination, fetch images via a dedicated broad query
  // (no verified/status gate — any real photo is fine for display)
  const destNames = aiDestinations.map(d => d.name);

  type ImageRow = { id: string; region: string; name: string; image_url: string };
  let imageRows: ImageRow[] = [];
  if (destNames.length > 0) {
    const imageFilters = destNames
      .map(n => `region.ilike.%${n}%,name.ilike.%${n}%`)
      .join(",");
    const { data: imageEntries } = await db
      .from("content_entries")
      .select("id, region, name, image_url")
      .not("image_url", "is", null)
      .or(imageFilters)
      .limit(Math.max(destNames.length * 5, 20));
    imageRows = (imageEntries ?? []) as ImageRow[];
  }

  // Build a map: lowercased dest name → image URLs
  const imagesByDest = new Map<string, string[]>();
  for (const row of imageRows) {
    for (const destName of destNames) {
      const key = destName.toLowerCase();
      if (
        row.region?.toLowerCase().includes(key) ||
        row.name?.toLowerCase().includes(key)
      ) {
        if (!imagesByDest.has(key)) imagesByDest.set(key, []);
        if (row.image_url && imagesByDest.get(key)!.length < 3) {
          imagesByDest.get(key)!.push(row.image_url);
        }
      }
    }
  }

  // Attach source_entry_ids, hero_images, and matched_style_tags per destination
  const destinations: DestinationTile[] = aiDestinations.map(dest => {
    const key = dest.name.toLowerCase();
    const matching = contentRows.filter(e =>
      e.region?.toLowerCase().includes(key) ||
      e.name?.toLowerCase().includes(key)
    );
    const sourceEntryIds = [...new Set(matching.map(e => e.id))].slice(0, 10);
    const heroImages = imagesByDest.get(key) ?? [];

    if (heroImages.length === 0) {
      console.warn(`[destinations] No hero photo for "${dest.name}" (region: ${dest.region}) — falling back to stock`);
    }

    return {
      name:              dest.name,
      type:              dest.type as "city" | "region" | "stop",
      country:           dest.country,
      region:            dest.region,
      hero_images:       heroImages,
      description:       dest.description,
      why_it_fits:       dest.why_it_fits ?? [],
      matched_style_tags: dest.matched_style_tags ?? [],
      source_entry_ids:  sourceEntryIds,
    };
  });

  return Response.json({ destinations });
}
