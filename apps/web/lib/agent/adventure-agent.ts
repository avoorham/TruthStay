import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  ADVENTURE_TOOLS,
  getPOIRatings,
  getUserPreferences,
  searchPOIsByRegion,
  searchRoutesByRegion,
} from "./tools";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateAdventureInput {
  userId: string;
  region: string;
  activityType: string;
  durationDays: number;
  startDate?: string; // ISO date string
  additionalNotes?: string;
}

export interface RouteAlternative {
  title: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  difficulty: "easy" | "moderate" | "hard";
  description: string;
}

export interface AccommodationAlternative {
  name: string;
  type: "camping" | "hostel" | "hotel" | "guesthouse" | "luxury";
  price_range: "budget" | "mid" | "luxury";
  description: string;
}

export interface DayAlternatives {
  routes: RouteAlternative[];
  accommodation: AccommodationAlternative[];
}

export type DayAlternativesMap = Record<string, DayAlternatives>;

export interface AdventureDayPlan {
  day_number: number;
  title: string;
  description: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  route_notes: string;
  pois: Array<{
    poi_id: string;
    name: string;
    role: string;
    notes: string;
  }>;
}

export interface GeneratedAdventure {
  title: string;
  description: string;
  region: string;
  activity_type: string;
  duration_days: number;
  start_date: string | null;
  days: AdventureDayPlan[];
}

// Chat conversation message (used by /api/adventures/chat)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert adventure planner for active travellers — cyclists, hikers, trail runners, skiers, and other outdoor sports enthusiasts.

Generate a detailed, day-by-day adventure itinerary for the requested region, activity type, and duration.

Be specific and practical:
- Realistic distances and elevation for the activity type
- Named roads, climbs, trails, or routes where known
- Accommodation placed at logical stopping points (towns, villages)
- Mix of highlight days and recovery days to create a narrative arc

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "title": "Adventure title",
  "description": "1-2 sentence overview",
  "region": "Region name",
  "activity_type": "cycling|hiking|trail_running|skiing|etc",
  "duration_days": number,
  "start_date": null,
  "days": [
    {
      "day_number": 1,
      "title": "Day title",
      "description": "What makes this day special",
      "distance_km": number or null,
      "elevation_gain_m": number or null,
      "route_notes": "Practical tips — surfaces, gradients, resupply points",
      "pois": []
    }
  ]
}`;

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

async function dispatchTool(
  db: SupabaseClient,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "search_pois_by_region":
      return searchPOIsByRegion(db, toolInput as any);
    case "get_poi_ratings":
      return getPOIRatings(db, toolInput as any);
    case "search_routes_by_region":
      return searchRoutesByRegion(db, toolInput as any);
    case "get_user_preferences":
      return getUserPreferences(db, toolInput as any);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function generateAdventure(
  _db: SupabaseClient,
  input: GenerateAdventureInput
): Promise<GeneratedAdventure> {
  const client = new Anthropic();

  const userMessage = [
    `Generate a ${input.durationDays}-day ${input.activityType} adventure in ${input.region}.`,
    input.startDate ? `Start date: ${input.startDate}.` : null,
    input.additionalNotes ? `Additional context: ${input.additionalNotes}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude did not return valid JSON. Response: ${textBlock.text.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[0]) as GeneratedAdventure;
}

// ─── Save to database ─────────────────────────────────────────────────────────

export async function saveAdventure(
  db: SupabaseClient,
  userId: string,
  requestPrompt: string,
  adventure: GeneratedAdventure
): Promise<string> {
  // Insert adventure record
  const { data: adventureRow, error: adventureError } = await db
    .from("adventures")
    .insert({
      userId,
      title: adventure.title,
      description: adventure.description,
      region: adventure.region,
      activityType: adventure.activity_type,
      durationDays: adventure.duration_days,
      startDate: adventure.start_date ?? null,
      requestPrompt,
      isSaved: false,
    })
    .select("id")
    .single();

  if (adventureError || !adventureRow) {
    throw new Error(`Failed to save adventure: ${adventureError?.message}`);
  }

  const adventureId = adventureRow.id as string;

  // Insert each day and its POIs
  for (const day of adventure.days) {
    const { data: dayRow, error: dayError } = await db
      .from("adventure_days")
      .insert({
        adventureId,
        dayNumber: day.day_number,
        title: day.title,
        description: day.description,
        distanceKm: day.distance_km,
        elevationGainM: day.elevation_gain_m,
        routeNotes: day.route_notes,
      })
      .select("id")
      .single();

    if (dayError || !dayRow) {
      throw new Error(`Failed to save adventure day ${day.day_number}: ${dayError?.message}`);
    }

    const dayId = dayRow.id as string;

    if (day.pois && day.pois.length > 0) {
      const poiRows = day.pois.map((poi, idx) => ({
        adventureDayId: dayId,
        poiId: poi.poi_id,
        role: poi.role,
        notes: poi.notes,
        orderIndex: idx,
      }));

      const { error: poiError } = await db
        .from("adventure_day_pois")
        .insert(poiRows);

      if (poiError) {
        // Non-fatal: log but continue (POI may not exist in DB yet)
        console.warn(`Failed to save POIs for day ${day.day_number}:`, poiError.message);
      }
    }
  }

  return adventureId;
}
