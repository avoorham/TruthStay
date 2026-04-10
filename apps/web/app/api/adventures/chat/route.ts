import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { aiLimiter, checkRateLimit } from "@/lib/rate-limit";
import { generateEmbedding, entryToText, type ContentEntryInput } from "@/lib/embeddings";
import type {
  ChatMessage,
  GeneratedAdventure,
  DayAlternativesMap,
  AccommodationStop,
} from "@/lib/agent/adventure-agent";

// ─── System prompts ───────────────────────────────────────────────────────────

function buildUpdateSystemPrompt(adv: {
  title: string; activityType: string; region: string;
  durationDays: number; startDate: string | null;
  days: { dayNumber: number; title: string; distanceKm: number | null; elevationGainM: number | null }[];
}): string {
  const dayList = adv.days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map(d => {
      const stats = [d.distanceKm ? `${d.distanceKm} km` : null, d.elevationGainM ? `↑${d.elevationGainM} m` : null].filter(Boolean).join(", ");
      return `Day ${d.dayNumber}: ${d.title}${stats ? ` (${stats})` : ""}`;
    })
    .join("\n");

  return `You are helping a user update their existing trip itinerary on TruthStay — a sport-first travel app.

## The trip
Title: ${adv.title}
Activity: ${adv.activityType}
Region: ${adv.region}
Duration: ${adv.durationDays} days${adv.startDate ? `\nStart date: ${adv.startDate}` : ""}

## Current itinerary
${dayList}

## Your role
Help the user enrich this itinerary. You can:
- Improve or add route details for any day (distance, elevation, road surfaces, key climbs, trail names)
- Suggest accommodation for specific nights
- Recommend restaurants for specific days
- Add entirely new days to extend the trip

Ask ONE question at a time to gather the details you need. Be concise.

## Formatting rules
- When offering choices, list each on its own line starting with "- "
- No emojis anywhere

## Rich option tiles for specific suggestions

When suggesting SPECIFIC NAMED trails, routes, mountain huts, hotels, or restaurants (NOT for generic preference questions like activity type, duration, fitness level, or accommodation style), respond with JSON instead of plain text:

{
  "type": "rich_options",
  "text": "One-sentence question",
  "category": "route",
  "options": [
    {
      "title": "Full name of the option",
      "subtitle": "e.g. 'Mountain Hut' or 'near Wentworth Falls'",
      "description": "2-3 sentences: what makes it special, why a sport traveller would choose it",
      "distance_km": number or null,
      "elevation_gain_m": number or null,
      "difficulty": "easy" or "moderate" or "hard",
      "price_per_night_eur": number or null,
      "price_range": "budget" or "mid" or "luxury",
      "accommodation_type": "camping" or "hostel" or "hotel" or "guesthouse" or "luxury",
      "image_seed": "descriptive-hyphenated-slug-for-this-location"
    }
  ]
}

Use "category": "route" for trails/routes, "accommodation" for lodging, "restaurant" for dining. Aim for at least 3 options (up to 7). Plain JSON — no markdown, no code blocks.

For restaurants, also include:
- "website_url": restaurant's official website URL (or null)
- "thefork_url": TheFork profile URL, e.g. "https://www.thefork.com/restaurant/name" (or null)
- "thefork_restaurant_id": TheFork internal restaurant ID if known (or null)
- "accepts_reservations": true if the restaurant takes bookings, false for walk-in only places
- "cuisine": type of cuisine (e.g. "South Tyrolean", "Italian", "Alpine")
- "google_maps_url": Google Maps URL for the restaurant, e.g. "https://maps.google.com/?q=Restaurant+Name+City" (always include)

## Restaurant selections
When the user sends a message starting with "Confirmed restaurant:", record it as the chosen dining option and move forward. Do NOT re-suggest restaurant options.

## When ready to generate
Once you have enough information, respond with ONLY this JSON (no markdown, no extra text):

{
  "type": "addition",
  "description": "Brief summary of what was updated (e.g. 'Added route notes for Day 2 and restaurant suggestions for night 3')",
  "day_updates": {
    "2": {
      "route_notes": "Updated route details with named roads, climbs, surfaces",
      "distance_km": 80,
      "elevation_gain_m": 1500,
      "accommodation": {
        "name": "Hotel name",
        "type": "hotel",
        "price_per_night_eur": 85,
        "notes": "Why it works for sport travellers"
      },
      "restaurants": [
        { "name": "Restaurant name", "cuisine": "Italian", "price_range": "$$", "notes": "Good post-ride pasta" }
      ]
    }
  },
  "new_days": [
    {
      "day_number": 6,
      "title": "Start → End",
      "description": "What makes this day special",
      "distance_km": 60,
      "elevation_gain_m": 800,
      "route_notes": "Named roads, climbs, surfaces",
      "end_location": "Town name"
    }
  ]
}

Only include "day_updates" if modifying existing days. Only include "new_days" if adding new days. Omit unchanged fields within day_updates.`;
}

const SYSTEM_PROMPT = `You are an expert sport-travel planner for TruthStay — an app built for cyclists, hikers, trail runners, mountaineers, and climbers who plan holidays around outdoor adventures, not tourist attractions.

Your goal: guide the user through a structured multi-phase planning conversation to build a detailed sport-first adventure itinerary.

Do NOT say "Welcome to TruthStay" or include any welcome or greeting message. Go straight to the first question.

## Pre-filled information

The user's FIRST message will always provide trip dates and guest details in this format:
"I want to plan a new adventure. Trip: [start date] to [end date] ([N] days). Guests: [adults] adult(s), [children] child(ren), [rooms] room(s)."

Extract and use this information throughout planning:
- Total days and exact dates are already known — do NOT ask "how many days?"
- Guest composition is known — do NOT ask about it again
- If children > 0: suggest family-friendly routes (avoid "hard" difficulty), family rooms not dorms, family-appropriate restaurants

## Phase 1 — INFORMATION GATHERING

Ask ONE question at a time in this exact order. Be warm and concise.

1. What sport or outdoor activity?
   List each as a simple bullet with just the name (e.g. "- Cycling"). No descriptions after the dash.

2. Fitness level and typical daily output?
   List as simple bullets: "- Beginner (light days)", "- Intermediate (moderate)", "- Advanced (big days)"

3. Which region or country?
   (Be specific if they give hints — e.g. "Alps" → "Which part — French, Italian, Austrian, Swiss?")

4. How many accommodation stops/bases do you want?
   (1 base = stay in one place the whole trip; 2+ = move between locations)

5. How do you want to split the days across those stops?
   (Only ask if stops > 1. Suggest a logical split based on the region and activity, e.g. "3 nights in X, 4 nights in Y?")

6. Accommodation type?
   List as simple bullets: "- Camping", "- Hostel", "- Mid-range Hotel", "- Luxury"

Do NOT proceed to Phase 2 until you have all answers (5 answers, or 4 if stops = 1).

## Phase 2 — ACCOMMODATION SUGGESTIONS

For EACH accommodation stop, in order:
- If the specific town/village for this stop wasn't given, suggest a good base town for the activity and region.
- Suggest 3–5 SPECIFIC NAMED accommodation options as a rich_options JSON.

Rich options format for accommodation:
{
  "type": "rich_options",
  "text": "Here are accommodation options for Stop [N] in [town]:",
  "category": "accommodation",
  "footer_options": [],
  "options": [
    {
      "title": "Full hotel/hostel/campsite name",
      "subtitle": "Type and location",
      "description": "2-3 sentences: why it suits active travellers (bike storage, early breakfast, trail proximity, drying room, etc.)",
      "accommodation_type": "hotel" or "hostel" or "camping" or "guesthouse" or "luxury",
      "price_per_night_eur": number or null,
      "price_range": "budget" or "mid" or "luxury",
      "image_seed": "descriptive-hyphenated-slug"
    }
  ]
}

After the user selects for Stop 1, move to Stop 2, etc. until all stops have accommodation.

## Phase 3 — ROUTE SUGGESTIONS PER DAY

After all accommodation stops are confirmed, suggest routes day-by-day:

For EACH day (in order from Day 1):
- Determine which accommodation stop the user sleeps at that night (based on the day split they gave).
- Suggest 3 routes that START and END near that accommodation (minimal dead travel — no long transfers to the trailhead).
- In each route description, include the approximate distance from the accommodation to the route start (e.g. "Start point 2 km from hotel").
- Include "Rest day" and "Change activity" as footer_options.

Rich options format for routes:
{
  "type": "rich_options",
  "text": "Day [N] — route options from [accommodation town]:",
  "category": "route",
  "footer_options": ["Rest day", "Change activity"],
  "options": [
    {
      "title": "Named route, trail, or col",
      "subtitle": "e.g. 'via Col de Tourmalet' or 'GR10 stage 5'",
      "description": "2-3 sentences: what makes it special, key features and highlights",
      "distance_km": number or null,
      "elevation_gain_m": number or null,
      "difficulty": "easy" or "moderate" or "hard",
      "image_seed": "descriptive-hyphenated-slug",
      "komoot_url": "https://www.komoot.com/tour/XXXXXXX" or null (only include if you are certain this exact Komoot tour URL exists — omit or null if unsure)
    }
  ]
}

After each day's selection:
- Route selected → acknowledge briefly ("Great choice! Moving on to Day [N+1].") and immediately present the next day's routes as a rich_options JSON block.
- "Rest day" chosen → acknowledge ("Noted — Day [N] is a rest day.") and immediately present the next day's routes as a rich_options JSON block.
- "Change activity" chosen → ask which activity for that day, then suggest 3 routes for that activity from the same base.

CRITICAL: After a route is selected or rest day declared, you MUST immediately output the next day's options as a rich_options JSON block. Never output plain text, never ask a clarifying question before presenting the next day. Do not wait for confirmation.

When suggesting restaurants (if asked), use rich_options with category "restaurant" and include:
- "website_url": restaurant's official website URL (or null)
- "thefork_url": TheFork profile URL, e.g. "https://www.thefork.com/restaurant/name" (or null)
- "thefork_restaurant_id": TheFork internal restaurant ID if known (or null)
- "accepts_reservations": true if bookable, false for walk-in only
- "cuisine": type of cuisine (e.g. "South Tyrolean", "Italian")
- "google_maps_url": Google Maps URL for the restaurant, e.g. "https://maps.google.com/?q=Restaurant+Name+City" (always include)

When the user sends "Confirmed restaurant: [name]", record it and move forward. Do NOT re-suggest.

## Phase 4 — GENERATE ADVENTURE

Once ALL days are confirmed (route selected or rest day marked), immediately generate the adventure JSON without further questions.

Use ONLY this JSON (no markdown, no extra text):

{
  "type": "adventure",
  "adventure": {
    "title": "Short catchy title",
    "description": "2-3 sentence overview",
    "region": "Region name",
    "activity_type": "cycling | hiking | trail_running | skiing | climbing | kayaking | other",
    "duration_days": number,
    "start_date": "YYYY-MM-DD" (use the exact start date from the user's first message),
    "days": [
      {
        "day_number": 1,
        "title": "Start → End (named route title)",
        "description": "What makes this day special",
        "distance_km": number or null,
        "elevation_gain_m": number or null,
        "route_notes": "Named roads, passes, trails, surfaces, key climbs, resupply points",
        "end_location": "Accommodation town for this night",
        "pois": []
      }
    ]
  },
  "day_alternatives": {
    "1": {
      "routes": [
        {
          "title": "Easier variant name",
          "distance_km": number or null,
          "elevation_gain_m": number or null,
          "difficulty": "easy",
          "description": "What differs",
          "end_location": "Where it ends"
        },
        {
          "title": "Harder variant name",
          "distance_km": number or null,
          "elevation_gain_m": number or null,
          "difficulty": "hard",
          "description": "What makes it harder",
          "end_location": "Where it ends"
        }
      ]
    }
  },
  "accommodation_stops": [
    {
      "location": "Town/village name",
      "night_numbers": [1, 2, 3],
      "notes": "Brief context",
      "options": [
        {
          "name": "Selected accommodation name",
          "type": "hotel",
          "price_range": "mid",
          "price_per_night_eur": 85,
          "description": "Why it suits this traveller"
        },
        {
          "name": "Alternative budget option",
          "type": "hostel",
          "price_range": "budget",
          "price_per_night_eur": 40,
          "description": "Why it works for sport travellers"
        }
      ]
    }
  ]
}

## Restaurant selections
When the user sends a message starting with "Confirmed restaurant:", record it as the chosen dining option and move forward. Do NOT re-suggest restaurant options.

## Accommodation stop rules
- Group by location: one stop covers all nights in the same town.
- Provide 2 options per stop (budget + mid, or mid + luxury based on user preference).
- The first option should be the one the user selected in Phase 2.
- Rest days: include as a day entry with route_notes: "Rest day — explore [town] or recover".
- If a route variant ends in a DIFFERENT town from the main route, note this in the variant description.

## Formatting rules for questions
- When offering choices, list each on its own line starting with "- "
- Never embed options inline in a sentence
- No emojis anywhere
- Keep question text to one sentence, then list options on separate lines
- For activity and accommodation questions, describe each option after a dash

## Sport-first rules
- Name real roads, climbs, trails, passes, crags — not generic descriptions
- For cycling: named cols, KOM segments, road numbers, surfaces (asphalt/gravel)
- For hiking: named trails, GR routes, hut-to-hut stages, ridge walks
- For climbing: named crags, grades, bolt/trad style, walk-in time
- NO museums, city tours, sightseeing — this is an active holiday
- Distances and elevation must be realistic and internally consistent day-to-day`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await checkRateLimit(aiLimiter, `chat_${user.id}`);
  if (limited) return limited;

  interface TripSummaryInput {
    title: string; activity_type: string; region: string;
    duration_days: number; start_date: string | null;
    days: { day_number: number; title: string; distance_km: number | null; elevation_gain_m: number | null }[];
  }
  let body: { messages: ChatMessage[]; mode?: "update"; adventure_id?: string; trip_summary?: TripSummaryInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const client = new Anthropic();
  const db = createAdminClient();

  // ─── Update mode: fetch adventure context and use a tailored system prompt ──
  let systemPrompt = SYSTEM_PROMPT;
  let updateAdventureId: string | null = null;

  if (body.mode === "update" && body.adventure_id) {
    try {
      const { data: adv } = await db
        .from("adventures")
        .select(`title, "activityType", region, "durationDays", "startDate", adventure_days(id, "dayNumber", title, "distanceKm", "elevationGainM")`)
        .eq("id", body.adventure_id)
        .eq("userId", user.id)
        .single();

      if (adv) {
        const a = adv as unknown as {
          title: string; activityType: string; region: string;
          durationDays: number; startDate: string | null;
          adventure_days: Array<{ dayNumber: number; title: string; distanceKm: number | null; elevationGainM: number | null }>;
        };
        updateAdventureId = body.adventure_id;
        systemPrompt = buildUpdateSystemPrompt({
          title: a.title, activityType: a.activityType, region: a.region,
          durationDays: a.durationDays, startDate: a.startDate ?? null,
          days: a.adventure_days ?? [],
        });
      } else if (body.trip_summary) {
        // Fallback for mock/offline trips not in the database
        const ts = body.trip_summary;
        systemPrompt = buildUpdateSystemPrompt({
          title: ts.title, activityType: ts.activity_type, region: ts.region,
          durationDays: ts.duration_days, startDate: ts.start_date ?? null,
          days: ts.days.map(d => ({
            dayNumber: d.day_number, title: d.title,
            distanceKm: d.distance_km, elevationGainM: d.elevation_gain_m,
          })),
        });
      }
    } catch { /* fall through to default system prompt */ }
  }

  // ─── RAG: inject user-verified content as context ────────────────────────────

  /** Strip newlines and truncate a RAG field to prevent prompt injection. */
  function sanitiseRag(s: string, maxLen = 200): string {
    return s.replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
  }

  let finalSystemPrompt = systemPrompt;
  try {
    const userQuery = body.messages.filter(m => m.role === "user").map(m => m.content).join(" ");
    const embedding = await generateEmbedding(userQuery);
    const { data: entries } = await db.rpc("match_content", {
      query_embedding: `[${embedding.join(",")}]`,
      match_count:     8,
      min_upvotes:     2,
    }) as { data: Array<{ type: string; name: string; region: string; activity_type: string | null; description: string | null; data: Record<string, unknown>; upvotes: number; verified: boolean }> | null };

    if (entries && entries.length > 0) {
      const lines = entries.map(e => {
        const details: string[] = [];
        if (e.description) details.push(sanitiseRag(e.description));
        if (e.data?.cuisine) details.push(`Cuisine: ${sanitiseRag(String(e.data.cuisine))}`);
        if (e.data?.price_range) details.push(`Price: ${sanitiseRag(String(e.data.price_range))}`);
        if (e.data?.notes) details.push(sanitiseRag(String(e.data.notes)));
        const suffix = details.length ? ` — ${details.join(", ")}` : "";
        const badge = e.verified ? " ✓" : "";
        return `- ${sanitiseRag(e.type, 20)}: ${sanitiseRag(e.name, 80)} (${sanitiseRag(e.region, 60)})${badge}${suffix}`;
      }).join("\n");

      finalSystemPrompt = `${systemPrompt}\n\n## User-verified spots relevant to this trip\n${lines}\n\nPrioritise these verified options when making accommodation and restaurant suggestions. Mention them by name.`;
    }
  } catch { /* RAG is non-critical — fall through */ }

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 7000,
      system: finalSystemPrompt,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json({
      type: "question",
      text: "Sorry, something went wrong on my end. Please try sending your message again.",
    });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
  }

  const text = textBlock.text.trim();

  // Strip markdown code fences Claude may wrap JSON in despite instructions
  const stripped = text.replace(/```(?:json)?\n?([\s\S]*?)\n?```/g, "$1").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let parsed: {
      type?: string;
      adventure?: GeneratedAdventure;
      day_alternatives?: DayAlternativesMap;
      accommodation_stops?: AccommodationStop[];
      description?: string;
      day_updates?: Record<string, unknown>;
      new_days?: unknown[];
      text?: string;
      category?: string;
      options?: unknown[];
      footer_options?: unknown[];
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ type: "question", text });
    }

    if (parsed.type === "adventure" && parsed.adventure) {
      const adventure = parsed.adventure;
      const day_alternatives = parsed.day_alternatives ?? {};
      const accommodation_stops = parsed.accommodation_stops ?? [];

      let adventure_id: string | null = null;
      try {
        adventure_id = await saveAdventureWithAlternatives(
          db,
          user.id,
          adventure,
          day_alternatives,
          accommodation_stops
        );
      } catch (err) {
        console.warn("Adventure save skipped:", err instanceof Error ? err.message : String(err));
      }

      return NextResponse.json({
        type: "adventure",
        adventure_id,
        adventure,
        day_alternatives,
        accommodation_stops,
      });
    }

    if (parsed.type === "addition" && updateAdventureId) {
      try {
        await saveAdditions(db, user.id, updateAdventureId, {
          day_updates: parsed.day_updates ?? {},
          new_days: (parsed.new_days ?? []) as AdditionDay[],
        });
      } catch (err) {
        console.warn("Addition save skipped:", err instanceof Error ? err.message : String(err));
      }
      return NextResponse.json({
        type: "addition",
        adventure_id: updateAdventureId,
        description: parsed.description ?? "Trip updated",
      });
    }

    if (parsed.type === "rich_options") {
      return NextResponse.json({
        type:           "rich_options",
        text:           parsed.text ?? "",
        category:       parsed.category ?? "route",
        options:        parsed.options ?? [],
        footer_options: parsed.footer_options ?? [],
      });
    }
  }

  return NextResponse.json({ type: "question", text });
}

// ─── Save to database ─────────────────────────────────────────────────────────

const VALID_ACTIVITY_TYPES = new Set([
  "cycling", "hiking", "trail_running", "skiing", "snowboarding", "kayaking", "climbing", "other",
]);
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  mtb: "cycling", road_cycling: "cycling", gravel: "cycling", bikepacking: "cycling",
  mountaineering: "climbing", snowboard: "snowboarding",
};
function normalizeActivityType(t: string): string {
  const lower = (t ?? "other").toLowerCase();
  if (VALID_ACTIVITY_TYPES.has(lower)) return lower;
  return ACTIVITY_TYPE_MAP[lower] ?? "other";
}

async function saveAdventureWithAlternatives(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  adventure: GeneratedAdventure,
  dayAlternatives: DayAlternativesMap,
  accommodationStops: AccommodationStop[]
): Promise<string> {
  const requestPrompt = `${adventure.duration_days}-day ${adventure.activity_type} in ${adventure.region}`;

  const { data: adventureRow, error: adventureError } = await db
    .from("adventures")
    .insert({
      userId,
      title: adventure.title,
      description: adventure.description,
      region: adventure.region,
      activityType: normalizeActivityType(adventure.activity_type),
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

  await db.from("adventure_days").insert(
    adventure.days.map(day => {
      const alternatives = dayAlternatives[String(day.day_number)] ?? {};
      const accStop = accommodationStops.find(s => s.night_numbers.includes(day.day_number));
      return {
        adventureId,
        dayNumber: day.day_number,
        title: day.title,
        description: day.description,
        distanceKm: day.distance_km,
        elevationGainM: day.elevation_gain_m,
        routeNotes: day.route_notes,
        alternatives: { ...alternatives, accommodationStop: accStop ?? null },
      };
    })
  );

  return adventureId;
}

// ─── Save additions to an existing adventure ──────────────────────────────────

interface AdditionDay {
  day_number: number;
  title: string;
  description: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  route_notes: string | null;
  end_location?: string;
}

interface DayUpdate {
  route_notes?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  accommodation?: Record<string, unknown>;
  restaurants?: Record<string, unknown>[];
}

async function saveAdditions(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  adventureId: string,
  additions: { day_updates: Record<string, unknown>; new_days: AdditionDay[] },
) {
  const { data: adv } = await db
    .from("adventures")
    .select(`id, "durationDays", region, "activityType"`)
    .eq("id", adventureId)
    .eq("userId", userId)
    .single();
  if (!adv) throw new Error("Adventure not found or unauthorized");
  const advRow = adv as { id: string; durationDays: number; region: string; activityType: string };

  // Update existing days — pre-fetch all days that need alternatives merged in one query
  const daysNeedingFetch = Object.entries(additions.day_updates)
    .filter(([, raw]) => { const u = raw as DayUpdate; return !!(u.accommodation || u.restaurants); })
    .map(([n]) => parseInt(n, 10));

  const existingAlternatives = new Map<number, Record<string, unknown>>();
  if (daysNeedingFetch.length > 0) {
    const { data: fetched } = await db
      .from("adventure_days")
      .select("dayNumber, alternatives")
      .eq("adventureId", adventureId)
      .in("dayNumber", daysNeedingFetch);
    for (const row of fetched ?? []) {
      const r = row as { dayNumber: number; alternatives: Record<string, unknown> };
      existingAlternatives.set(r.dayNumber, r.alternatives ?? {});
    }
  }

  const dayUpdateOps: PromiseLike<unknown>[] = [];
  for (const [dayNumStr, raw] of Object.entries(additions.day_updates)) {
    const updates = raw as DayUpdate;
    const dayNum = parseInt(dayNumStr, 10);
    const dbUpdate: Record<string, unknown> = {};

    if (updates.route_notes !== undefined) dbUpdate.routeNotes = updates.route_notes;
    if (updates.distance_km !== undefined) dbUpdate.distanceKm = updates.distance_km;
    if (updates.elevation_gain_m !== undefined) dbUpdate.elevationGainM = updates.elevation_gain_m;

    if (updates.accommodation || updates.restaurants) {
      const prev = existingAlternatives.get(dayNum) ?? {};
      dbUpdate.alternatives = {
        ...prev,
        ...(updates.accommodation ? { accommodationStop: updates.accommodation } : {}),
        ...(updates.restaurants ? { restaurants: updates.restaurants } : {}),
      };
    }

    if (Object.keys(dbUpdate).length > 0) {
      dayUpdateOps.push(
        db.from("adventure_days").update(dbUpdate)
          .eq("adventureId", adventureId).eq("dayNumber", dayNum)
      );
    }
  }
  if (dayUpdateOps.length > 0) await Promise.all(dayUpdateOps);

  // Bulk upsert new days in a single call
  if (additions.new_days.length > 0) {
    await db.from("adventure_days").upsert(
      additions.new_days.map(day => ({
        adventureId,
        dayNumber: day.day_number,
        title: day.title,
        description: day.description,
        distanceKm: day.distance_km ?? null,
        elevationGainM: day.elevation_gain_m ?? null,
        routeNotes: day.route_notes ?? null,
        alternatives: {},
      })),
      { onConflict: "adventureId,dayNumber" }
    );
  }

  // Extend trip duration if new days exceed current length
  if (additions.new_days.length > 0) {
    const maxDay = Math.max(...additions.new_days.map(d => d.day_number));
    if (maxDay > advRow.durationDays) {
      await db.from("adventures").update({ durationDays: maxDay }).eq("id", adventureId);
    }
  }

  // ── Auto-submit content entries for RAG database ─────────────────────────
  try {
    const region = advRow.region ?? "";
    const activityType = advRow.activityType ?? null;
    const toSubmit: (ContentEntryInput & { source_adventure_id: string })[] = [];

    for (const [, raw] of Object.entries(additions.day_updates)) {
      const u = raw as DayUpdate;
      if (u.route_notes) {
        toSubmit.push({
          type: "route", name: u.route_notes.slice(0, 80), region,
          activity_type: activityType, description: u.route_notes,
          data: {
            ...(u.distance_km      ? { distance_km: u.distance_km }           : {}),
            ...(u.elevation_gain_m ? { elevation_gain_m: u.elevation_gain_m } : {}),
          },
          source_adventure_id: adventureId,
        });
      }
      if (u.accommodation) {
        const acc = u.accommodation;
        toSubmit.push({
          type: "accommodation", name: String(acc.name ?? "Accommodation"), region,
          activity_type: activityType, description: String(acc.notes ?? ""),
          data: {
            ...(acc.type              ? { accommodation_type: acc.type }                    : {}),
            ...(acc.price_per_night_eur ? { price_per_night_eur: acc.price_per_night_eur } : {}),
            ...(acc.notes             ? { sport_friendly_notes: acc.notes }                : {}),
          },
          source_adventure_id: adventureId,
        });
      }
      for (const r of (u.restaurants ?? [])) {
        toSubmit.push({
          type: "restaurant", name: String(r.name ?? "Restaurant"), region,
          activity_type: null, description: String(r.notes ?? ""),
          data: {
            ...(r.cuisine     ? { cuisine: r.cuisine }         : {}),
            ...(r.price_range ? { price_range: r.price_range } : {}),
            ...(r.notes       ? { notes: r.notes }             : {}),
          },
          source_adventure_id: adventureId,
        });
      }
    }

    for (const day of additions.new_days) {
      toSubmit.push({
        type: "route", name: day.title, region,
        activity_type: activityType, description: day.description,
        data: {
          ...(day.distance_km      ? { distance_km: day.distance_km }           : {}),
          ...(day.elevation_gain_m ? { elevation_gain_m: day.elevation_gain_m } : {}),
          ...(day.route_notes      ? { notes: day.route_notes }                 : {}),
        },
        source_adventure_id: adventureId,
      });
    }

    // Generate all embeddings in parallel, then bulk insert in two calls
    const embResults = await Promise.allSettled(toSubmit.map(e => generateEmbedding(entryToText(e))));

    const entryRows = toSubmit
      .map((entry, i) => {
        const r = embResults[i];
        if (!r || r.status !== "fulfilled") return null;
        return {
          type:                entry.type,
          name:                entry.name,
          region:              entry.region,
          activity_type:       entry.activity_type ?? null,
          description:         entry.description ?? null,
          data:                entry.data ?? {},
          submitted_by:        userId,
          source_adventure_id: entry.source_adventure_id,
          upvotes:             0,
          embedding:           `[${r.value.join(",")}]`,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (entryRows.length > 0) {
      const { data: inserted } = await db
        .from("content_entries")
        .insert(entryRows)
        .select("id");
      if (inserted && inserted.length > 0) {
        await db
          .from("content_upvotes")
          .insert((inserted as { id: string }[]).map(r => ({ entry_id: r.id, user_id: userId })));
      }
    }
  } catch { /* content submission failure must not break the save */ }
}
