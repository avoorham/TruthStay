import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface DestinationInput {
  name: string;
  type: string;
}

interface Budget { min: number; max: number; }

interface Filters {
  budget?: Budget;
  travelers?: number;
  vacation_style?: string[];
}

interface RequestBody {
  destinations: DestinationInput[];
  duration_days: number;
  filters?: Filters;
}

interface AccommodationStop {
  destination: string;
  nights: number;
  night_numbers: number[];
}

interface SkeletonDay {
  day_number: number;
  destination: string;
  title: string;
}

interface ItinerarySkeleton {
  title: string;
  description: string;
  activity_type: string;
  duration_days: number;
  accommodation_stops: AccommodationStop[];
  days: SkeletonDay[];
}

// POST /api/discovery/itinerary-skeleton
// Takes selected destinations + duration, AI proposes night allocation.
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { destinations, duration_days, filters } = body;
  if (!destinations?.length) {
    return Response.json({ error: "destinations required" }, { status: 400 });
  }
  if (!duration_days || duration_days < 1) {
    return Response.json({ error: "duration_days required" }, { status: 400 });
  }

  const destList = destinations.map(d => d.name).join(", ");
  const b = filters?.budget;
  const bLabel = b ? `€${b.min}–€${b.max}` : "mid-range";

  const prompt = `You are a trip planner. The user has selected ${destinations.length} destination(s) for a ${duration_days}-day trip (budget ${bLabel}): ${destList}.

Propose an optimal night allocation. Consider geographic flow and travel days between stops.

Rules:
- Night numbers must start at 1 and end at ${duration_days}
- Total nights must sum to exactly ${duration_days}
- Generate one day entry per day (${duration_days} day entries total)
- Day 1 title for each new destination should be "Arrival in [destination]"
- If moving between destinations, that travel day belongs to the destination you arrive at
- If only 1 destination, all nights stay there

Respond with ONLY valid JSON:
{
  "skeleton": {
    "title": "Catchy trip title (e.g. '7 Days in the Algarve')",
    "description": "2-sentence overview of the trip",
    "activity_type": "other",
    "duration_days": ${duration_days},
    "accommodation_stops": [
      { "destination": "City name", "nights": 2, "night_numbers": [1, 2] }
    ],
    "days": [
      { "day_number": 1, "destination": "City name", "title": "Arrival in City name" },
      { "day_number": 2, "destination": "City name", "title": "City name" }
    ]
  }
}`;

  let skeleton: ItinerarySkeleton | null = null;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text?: string }).text ?? "";
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { skeleton?: ItinerarySkeleton };
      skeleton = parsed.skeleton ?? null;
    }
  } catch {
    return Response.json({ error: "AI generation failed" }, { status: 500 });
  }

  if (!skeleton) {
    return Response.json({ error: "Failed to generate skeleton" }, { status: 500 });
  }

  // Validate night totals add up
  const totalNights = skeleton.accommodation_stops.reduce((sum, s) => sum + s.nights, 0);
  if (totalNights !== duration_days) {
    // Patch the last stop to absorb any rounding error
    const last = skeleton.accommodation_stops[skeleton.accommodation_stops.length - 1];
    if (last) last.nights += duration_days - totalNights;
  }

  // Ensure day count matches
  if (skeleton.days.length !== duration_days) {
    skeleton.days = Array.from({ length: duration_days }, (_, i) => {
      const dayNum = i + 1;
      const existing = skeleton!.days.find(d => d.day_number === dayNum);
      if (existing) return existing;
      const stop = skeleton!.accommodation_stops.find(s => s.night_numbers.includes(dayNum));
      return { day_number: dayNum, destination: stop?.destination ?? destinations[0]?.name ?? "", title: `Day ${dayNum}` };
    });
  }

  return Response.json({ skeleton });
}
