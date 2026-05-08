import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

interface DestinationInput {
  name: string;
  type: "region" | "city" | "route";
}

interface Filters {
  duration_days: number;
  budget?: string;
  travelers?: number;
  vacation_type?: string;
  preferences?: string[];
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
  source_entry_ids: string[];
}

interface ClaudeDestination {
  name: string;
  type: string;
  country: string | null;
  region: string;
  description: string;
  why_it_fits: string[];
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

  const vacationType = filters.vacation_type ?? "mixed";
  const budget = filters.budget ?? "mid";
  const duration = filters.duration_days;

  let instruction = "";
  if (input.type === "region") {
    instruction = `Propose 5–8 cities or towns within the ${input.name} region that suit a ${duration}-day ${vacationType} trip.`;
  } else if (input.type === "city") {
    instruction = `Propose the city of ${input.name} plus 2–4 nearby destinations that pair well for a ${duration}-day ${vacationType} trip.`;
  } else {
    instruction = `The user wants to follow the "${input.name}" route. Decompose it into its natural stops (towns/villages the route passes through), treating each stop as a destination tile.`;
  }

  const prompt = `You are a travel planner. ${instruction}

Trip parameters: ${duration} days, ${vacationType} style, ${budget} budget, ${filters.travelers ?? 2} travellers.
${filters.preferences?.length ? `Preferences: ${filters.preferences.join(", ")}.` : ""}

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
      "why_it_fits": ["Reason 1 (be specific)", "Reason 2", "Reason 3"]
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

  // Attach source_entry_ids and hero_images per destination
  const destinations: DestinationTile[] = aiDestinations.map(dest => {
    const matching = contentRows.filter(e =>
      e.region?.toLowerCase().includes(dest.name.toLowerCase()) ||
      e.name?.toLowerCase().includes(dest.name.toLowerCase())
    );
    const sourceEntryIds = [...new Set(matching.map(e => e.id))].slice(0, 10);
    const heroImages = matching
      .filter(e => e.image_url)
      .slice(0, 3)
      .map(e => e.image_url!);

    return {
      name:             dest.name,
      type:             dest.type as "city" | "region" | "stop",
      country:          dest.country,
      region:           dest.region,
      hero_images:      heroImages,
      description:      dest.description,
      why_it_fits:      dest.why_it_fits ?? [],
      source_entry_ids: sourceEntryIds,
    };
  });

  return Response.json({ destinations });
}
