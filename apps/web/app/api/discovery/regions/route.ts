import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

interface Filters {
  vacation_style: string[];
  duration_days: number;
  budget: "low" | "mid" | "high";
  adults?: number;
  children?: number;
}

interface RequestBody {
  filters: Filters;
}

interface ClaudeRegion {
  name: string;
  country: string;
  description: string;
  matched_style_tags: string[];
}

interface RegionTile {
  name: string;
  country: string;
  hero_images: string[];
  description: string;
  matched_style_tags: string[];
}

// POST /api/discovery/regions
// Returns 8 AI-suggested macro regions based on vacation style + practical filters.
// Used as wizard step 3 before the user picks specific destinations.
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { filters } = body;
  if (!filters?.vacation_style?.length || !filters?.duration_days) {
    return Response.json(
      { error: "filters.vacation_style (non-empty) and filters.duration_days required" },
      { status: 400 },
    );
  }

  const { vacation_style, duration_days, budget = "mid", adults = 2, children = 0 } = filters;

  const budgetLabel =
    budget === "low" ? "budget / backpacker-friendly" :
    budget === "high" ? "luxury" :
    "mid-range";

  const partyParts = [`${adults} adult${adults !== 1 ? "s" : ""}`];
  if (children > 0) partyParts.push(`${children} child${children !== 1 ? "ren" : ""}`);
  const partyDesc = partyParts.join(" + ");

  const familyNote = children > 0
    ? "\n- Prioritise family-friendly regions with safe infrastructure and activities for children"
    : "";

  const durationNote =
    duration_days <= 4 ? "Short trip — keep logistics tight; avoid destinations requiring long-haul flights" :
    duration_days >= 14 ? "Long trip — any destination worldwide is viable" :
    "Medium trip — consider staying within a single continent to limit travel fatigue";

  const prompt = `You are a world travel expert. Suggest exactly 8 diverse holiday regions for this traveller.

Vacation style: ${vacation_style.join(", ")}
Duration: ${duration_days} days (${durationNote})
Budget: ${budgetLabel}
Party: ${partyDesc}${familyNote}

Rules:
- A "region" is a sub-national geographic area (e.g. "Tuscany", "Scottish Highlands", "Kyoto Prefecture", "Patagonia", "Bali", "Algarve"). Not a whole country.
- Span at least 4–5 different countries across the 8 suggestions.
- Mix 4–5 well-known regions with 3–4 hidden gems or underrated picks.
- Match vacation style honestly — only suggest regions that genuinely deliver those experiences.
- "matched_style_tags": pick 2–3 tags from the vacation style list that this region authentically matches. No forced matches.

Return ONLY valid JSON (no markdown, no extra text):
{
  "regions": [
    {
      "name": "Region name",
      "country": "Country name",
      "description": "2–3 engaging sentences about why this region suits this traveller",
      "matched_style_tags": ["Tag 1", "Tag 2"]
    }
  ]
}`;

  let aiRegions: ClaudeRegion[] = [];
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
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { regions?: ClaudeRegion[] };
      aiRegions = parsed.regions ?? [];
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "AI generation failed", detail: msg }, { status: 500 });
  }

  // Fetch hero images from content_entries for each suggested region
  const db = createAdminClient();
  const regionNames = aiRegions.map(r => r.name);

  type ImageRow = { name: string; region: string; image_url: string };
  let imageRows: ImageRow[] = [];
  if (regionNames.length > 0) {
    const imageFilters = regionNames
      .map(n => `region.ilike.%${n}%,name.ilike.%${n}%`)
      .join(",");
    const { data } = await db
      .from("content_entries")
      .select("name, region, image_url")
      .not("image_url", "is", null)
      .or(imageFilters)
      .limit(regionNames.length * 4);
    imageRows = (data ?? []) as ImageRow[];
  }

  // Map lowercased region name → up to 3 image URLs
  const imagesByRegion = new Map<string, string[]>();
  for (const row of imageRows) {
    for (const rName of regionNames) {
      const key = rName.toLowerCase();
      if (
        row.region?.toLowerCase().includes(key) ||
        row.name?.toLowerCase().includes(key)
      ) {
        if (!imagesByRegion.has(key)) imagesByRegion.set(key, []);
        if (imagesByRegion.get(key)!.length < 3) {
          imagesByRegion.get(key)!.push(row.image_url);
        }
      }
    }
  }

  const regions: RegionTile[] = aiRegions.map(r => ({
    name:               r.name,
    country:            r.country,
    hero_images:        imagesByRegion.get(r.name.toLowerCase()) ?? [],
    description:        r.description,
    matched_style_tags: r.matched_style_tags ?? [],
  }));

  return Response.json({ regions });
}
