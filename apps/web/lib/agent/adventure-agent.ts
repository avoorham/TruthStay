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

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert adventure planner for active travellers — cyclists, hikers, trail runners, skiers, and other outdoor sports enthusiasts.

Your job is to generate detailed, personalised multi-day adventure itineraries based on:
- Community-validated data from real travellers (POI ratings, route reviews)
- The user's fitness level, preferences, and group size
- The chosen region, activity type, and duration

When generating an adventure:
1. Start by fetching the user's saved preferences with get_user_preferences
2. Search for rated routes in the region using search_routes_by_region
3. Search for accommodation options using search_pois_by_region with categories ["hotel","hostel","campsite","guesthouse"]
4. Search for quality dining using search_pois_by_region with categories ["restaurant","cafe","bar"]
5. For top-rated POIs, get detailed ratings with get_poi_ratings to verify quality
6. Build a day-by-day plan that:
   - Matches the user's fitness level and preferred daily distances
   - Places accommodation at logical stopping points
   - Recommends highly-rated venues based on real community feedback
   - Creates a narrative arc (build-up, highlight day, wind-down)
   - Includes practical route notes from community reviews

Be specific and practical. Reference actual POI IDs so the app can link them.
Distances and elevation should be realistic for the activity type.

When you have gathered enough data, respond with a JSON object in this exact format:
{
  "title": "Adventure title",
  "description": "1-2 sentence overview",
  "region": "Region name",
  "activity_type": "cycling|hiking|trail_running|skiing|etc",
  "duration_days": number,
  "start_date": "YYYY-MM-DD or null",
  "days": [
    {
      "day_number": 1,
      "title": "Day title",
      "description": "What makes this day special",
      "distance_km": number or null,
      "elevation_gain_m": number or null,
      "route_notes": "Practical notes from community reviews",
      "pois": [
        {
          "poi_id": "uuid",
          "name": "POI name",
          "role": "accommodation|lunch|dinner|breakfast|start|end|highlight|rest_stop",
          "notes": "Why this was chosen, what the community says"
        }
      ]
    }
  ]
}

Only include POIs that you found via the search tools (use their actual IDs).
If no rated POIs exist in the database for this region yet, still generate the adventure but omit the pois array for affected days and note in route_notes that these are suggestions pending community validation.`;

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
  db: SupabaseClient,
  input: GenerateAdventureInput
): Promise<GeneratedAdventure> {
  const client = new Anthropic();

  const userMessage = [
    `Generate a ${input.durationDays}-day ${input.activityType} adventure in ${input.region}.`,
    input.startDate ? `Start date: ${input.startDate}.` : null,
    `User ID: ${input.userId}`,
    input.additionalNotes ? `Additional notes: ${input.additionalNotes}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Agentic loop — run until Claude stops calling tools
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: ADVENTURE_TOOLS as unknown as Anthropic.Tool[],
      messages,
    });

    // Append Claude's response to the conversation
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      // Extract the JSON adventure plan from the final text block
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Agent did not return a text response");
      }

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Agent response did not contain valid JSON");
      }

      return JSON.parse(jsonMatch[0]) as GeneratedAdventure;
    }

    if (response.stop_reason === "tool_use") {
      // Execute all tool calls in parallel
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          let result: unknown;
          let isError = false;

          try {
            result = await dispatchTool(
              db,
              block.name,
              block.input as Record<string, unknown>
            );
          } catch (err) {
            result = { error: err instanceof Error ? err.message : String(err) };
            isError = true;
          }

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
            is_error: isError,
          };
        })
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    throw new Error(`Unexpected stop reason: ${response.stop_reason}`);
  }
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
