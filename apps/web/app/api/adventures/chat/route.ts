import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ChatMessage,
  GeneratedAdventure,
  DayAlternativesMap,
} from "@/lib/agent/adventure-agent";
import { saveAdventure } from "@/lib/agent/adventure-agent";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert sport-travel planner for TruthStay — an app built for cyclists, hikers, trail runners, mountaineers, and climbers who plan their holidays around outdoor adventures, not tourist attractions.

Your goal is to help the user plan a detailed, sport-first adventure itinerary through a short conversation.

## Conversation flow

Ask ONE question at a time in this order. Be warm and concise — this is a chat, not a form.

1. What sport or outdoor activity? (cycling road/gravel/MTB, hiking, trail running, climbing, skiing, kayaking, etc.)
2. Which region or country? (be specific if they give hints — e.g. "Alps" → "Which part — French, Italian, Austrian, Swiss?")
3. How many days? (suggest a typical range for the activity if they're unsure)
4. Fitness level and typical daily distance/elevation? (e.g. "intermediate cyclist, happy doing 80km and 1500m a day")
5. Accommodation preference? (camping / budget hostel / mid-range hotel / luxury)

Once you have all five answers, DO NOT ask more questions. Generate the adventure immediately.

## Generating the adventure

When you have enough information, respond with ONLY a JSON object (no markdown code blocks, no explanation text before or after):

{
  "type": "adventure",
  "adventure": {
    "title": "Short catchy title",
    "description": "2-3 sentence overview — what makes this trip special",
    "region": "Region name",
    "activity_type": "cycling | hiking | trail_running | skiing | climbing | kayaking | mtb | other",
    "duration_days": number,
    "start_date": null,
    "days": [
      {
        "day_number": 1,
        "title": "Stage name (e.g. 'Palma → Sóller via Sa Calobra')",
        "description": "1-2 sentences on what makes this day special",
        "distance_km": number or null,
        "elevation_gain_m": number or null,
        "route_notes": "Practical info: road surfaces, key climbs, resupply points, safety notes",
        "pois": []
      }
    ]
  },
  "day_alternatives": {
    "1": {
      "routes": [
        {
          "title": "Easier variant title",
          "distance_km": number or null,
          "elevation_gain_m": number or null,
          "difficulty": "easy",
          "description": "Brief description of how/why this is easier"
        },
        {
          "title": "Harder variant title",
          "distance_km": number or null,
          "elevation_gain_m": number or null,
          "difficulty": "hard",
          "description": "Brief description of the extra challenge"
        }
      ],
      "accommodation": [
        {
          "name": "Budget option name",
          "type": "hostel or camping",
          "price_range": "budget",
          "description": "Why it suits cyclists/hikers specifically"
        },
        {
          "name": "Comfort option name",
          "type": "hotel or guesthouse",
          "price_range": "mid",
          "description": "Standout feature for sport travellers"
        }
      ]
    }
  }
}

## Sport-first rules
- Name real roads, climbs, trails, passes, crags — not generic descriptions
- For cycling: named cols, KOM segments, road numbers, surfaces (asphalt/gravel)
- For hiking: named trails, GR routes, hut-to-hut stages, ridge walks
- For climbing: named crags, grades, bolt/trad style, walk-in time
- Accommodation should be sport-traveller friendly (bike storage, early breakfast, drying room, etc.)
- NO museums, city tours, sightseeing — this is an active holiday
- Distances and elevation must be realistic and internally consistent day-to-day`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { messages: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  // Call Claude
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
  }

  const text = textBlock.text.trim();

  // Try to detect a JSON adventure response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let parsed: { type?: string; adventure?: GeneratedAdventure; day_alternatives?: DayAlternativesMap };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Malformed JSON — treat as a question
      return NextResponse.json({ type: "question", text });
    }

    if (parsed.type === "adventure" && parsed.adventure) {
      const adventure = parsed.adventure;
      const day_alternatives = parsed.day_alternatives ?? {};

      // Save best-effort
      const adminDb = createAdminClient();
      let adventure_id: string | null = null;
      try {
        adventure_id = await saveAdventureWithAlternatives(
          adminDb,
          user.id,
          adventure,
          day_alternatives
        );
      } catch (err) {
        console.warn("Adventure save skipped:", err instanceof Error ? err.message : String(err));
      }

      return NextResponse.json({
        type: "adventure",
        adventure_id,
        adventure,
        day_alternatives,
      });
    }
  }

  // Otherwise it's a follow-up question
  return NextResponse.json({ type: "question", text });
}

// ─── Save adventure with alternatives ────────────────────────────────────────

async function saveAdventureWithAlternatives(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  adventure: GeneratedAdventure,
  dayAlternatives: DayAlternativesMap
): Promise<string> {
  const requestPrompt = `${adventure.duration_days}-day ${adventure.activity_type} in ${adventure.region}`;

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

  for (const day of adventure.days) {
    const alternatives = dayAlternatives[String(day.day_number)] ?? {};

    await db.from("adventure_days").insert({
      adventureId,
      dayNumber: day.day_number,
      title: day.title,
      description: day.description,
      distanceKm: day.distance_km,
      elevationGainM: day.elevation_gain_m,
      routeNotes: day.route_notes,
      alternatives,
    });
  }

  return adventureId;
}
