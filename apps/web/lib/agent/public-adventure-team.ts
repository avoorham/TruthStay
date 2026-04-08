import Anthropic from "@anthropic-ai/sdk";
import type {
  GeneratedAdventure,
  DayAlternativesMap,
  AccommodationStop,
} from "./adventure-agent";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VacationSlot {
  country: string;
  region: string;
  activity: string;
  duration: number;
  budget: "budget" | "mid" | "luxury";
  level: "beginner" | "intermediate" | "advanced";
}

export interface DraftMeta {
  coords: [number, number]; // [lng, lat] — map centre
  country: string;
  tags: string[];
  avgDistanceKm: number | null;
  avgElevationM: number | null;
}

export interface VacationDraft {
  slot: VacationSlot;
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  accommodationStops: AccommodationStop[];
  meta: DraftMeta;
  qaNotes: string;
}

// ─── 100-slot manifest ────────────────────────────────────────────────────────

export const VACATION_SLOTS: VacationSlot[] = [
  // ── France (18) ─────────────────────────────────────────────────────────────
  { country: "France", region: "Alpe d'Huez & Galibier, French Alps",       activity: "cycling",      duration: 7,  budget: "mid",    level: "advanced"     },
  { country: "France", region: "Pyrenees Grand Tour, France",                activity: "cycling",      duration: 8,  budget: "mid",    level: "advanced"     },
  { country: "France", region: "Provence, France",                           activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "France", region: "Corsica, France",                            activity: "cycling",      duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "France", region: "Vosges, Alsace, France",                     activity: "gravel",       duration: 5,  budget: "budget", level: "intermediate" },
  { country: "France", region: "Tour du Mont Blanc, Chamonix, France",       activity: "hiking",       duration: 10, budget: "mid",    level: "intermediate" },
  { country: "France", region: "GR20, Corsica, France",                      activity: "hiking",       duration: 15, budget: "budget", level: "advanced"     },
  { country: "France", region: "Pyrenees HRP, France",                       activity: "hiking",       duration: 12, budget: "budget", level: "advanced"     },
  { country: "France", region: "Gorges du Verdon, Provence, France",         activity: "hiking",       duration: 4,  budget: "mid",    level: "beginner"     },
  { country: "France", region: "GR5 French Alps, France",                    activity: "hiking",       duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "France", region: "Massif des Ecrins, French Alps",             activity: "hiking",       duration: 8,  budget: "budget", level: "advanced"     },
  { country: "France", region: "Chamonix Valley, French Alps",               activity: "trail_running",duration: 5,  budget: "mid",    level: "advanced"     },
  { country: "France", region: "Pyrenees, France",                           activity: "trail_running",duration: 4,  budget: "budget", level: "advanced"     },
  { country: "France", region: "Ecrins, French Alps",                        activity: "trail_running",duration: 4,  budget: "mid",    level: "advanced"     },
  { country: "France", region: "Beaufortain & Aravis, French Alps",          activity: "trail_running",duration: 4,  budget: "mid",    level: "intermediate" },
  { country: "France", region: "Vosges, France",                             activity: "mtb",          duration: 4,  budget: "budget", level: "intermediate" },
  { country: "France", region: "Pre-Alps & Verdon, France",                  activity: "mtb",          duration: 4,  budget: "mid",    level: "advanced"     },
  { country: "France", region: "Gorges du Verdon, Provence, France",         activity: "climbing",     duration: 5,  budget: "mid",    level: "intermediate" },

  // ── Italy (14) ──────────────────────────────────────────────────────────────
  { country: "Italy",  region: "Stelvio & Mortirolo, Italian Alps",          activity: "cycling",      duration: 7,  budget: "mid",    level: "advanced"     },
  { country: "Italy",  region: "Tuscany, Italy",                             activity: "cycling",      duration: 6,  budget: "mid",    level: "intermediate" },
  { country: "Italy",  region: "Sardinia, Italy",                            activity: "cycling",      duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Italy",  region: "Dolomites, Italy",                           activity: "cycling",      duration: 6,  budget: "luxury", level: "advanced"     },
  { country: "Italy",  region: "Alta Via 1, Dolomites, Italy",               activity: "hiking",       duration: 8,  budget: "mid",    level: "intermediate" },
  { country: "Italy",  region: "Cinque Terre, Liguria, Italy",               activity: "hiking",       duration: 4,  budget: "mid",    level: "beginner"     },
  { country: "Italy",  region: "Amalfi Coast, Campania, Italy",              activity: "hiking",       duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Italy",  region: "Alta Via 2, Dolomites, Italy",               activity: "hiking",       duration: 9,  budget: "mid",    level: "advanced"     },
  { country: "Italy",  region: "Dolomites, Italy",                           activity: "trail_running",duration: 5,  budget: "mid",    level: "advanced"     },
  { country: "Italy",  region: "Ligurian Alps, Italy",                       activity: "trail_running",duration: 4,  budget: "budget", level: "intermediate" },
  { country: "Italy",  region: "Dolomites, Italy",                           activity: "mtb",          duration: 5,  budget: "mid",    level: "advanced"     },
  { country: "Italy",  region: "Tuscany, Italy",                             activity: "gravel",       duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Italy",  region: "Arco, Lake Garda, Italy",                    activity: "climbing",     duration: 6,  budget: "mid",    level: "intermediate" },
  { country: "Italy",  region: "Sardinia coastline, Italy",                  activity: "kayaking",     duration: 5,  budget: "mid",    level: "beginner"     },

  // ── Spain (12) ──────────────────────────────────────────────────────────────
  { country: "Spain",  region: "Mallorca, Balearic Islands, Spain",          activity: "cycling",      duration: 7,  budget: "mid",    level: "advanced"     },
  { country: "Spain",  region: "Basque Country, Spain",                      activity: "cycling",      duration: 6,  budget: "mid",    level: "advanced"     },
  { country: "Spain",  region: "Catalonia, Spain",                           activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Spain",  region: "Gran Canaria, Canary Islands, Spain",        activity: "cycling",      duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Spain",  region: "Camino de Santiago Frances, Spain",          activity: "hiking",       duration: 14, budget: "budget", level: "beginner"     },
  { country: "Spain",  region: "Picos de Europa, Asturias, Spain",           activity: "hiking",       duration: 6,  budget: "budget", level: "intermediate" },
  { country: "Spain",  region: "GR11 Pyrenees, Spain",                       activity: "hiking",       duration: 10, budget: "budget", level: "advanced"     },
  { country: "Spain",  region: "Tenerife, Canary Islands, Spain",            activity: "hiking",       duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Spain",  region: "Catalonia, Spain",                           activity: "trail_running",duration: 4,  budget: "mid",    level: "advanced"     },
  { country: "Spain",  region: "Basque Country, Spain",                      activity: "trail_running",duration: 4,  budget: "mid",    level: "intermediate" },
  { country: "Spain",  region: "Catalonia Pyrenees, Spain",                  activity: "mtb",          duration: 5,  budget: "mid",    level: "advanced"     },
  { country: "Spain",  region: "Siurana, Catalonia, Spain",                  activity: "climbing",     duration: 5,  budget: "budget", level: "intermediate" },

  // ── Switzerland (8) ─────────────────────────────────────────────────────────
  { country: "Switzerland", region: "Engadin Valley, Switzerland",           activity: "cycling",      duration: 6,  budget: "mid",    level: "intermediate" },
  { country: "Switzerland", region: "Swiss Alpine Cols, Switzerland",        activity: "cycling",      duration: 7,  budget: "luxury", level: "advanced"     },
  { country: "Switzerland", region: "Jungfrau Region, Bernese Alps",         activity: "hiking",       duration: 6,  budget: "mid",    level: "intermediate" },
  { country: "Switzerland", region: "Tour de Suisse hike, Switzerland",      activity: "hiking",       duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Switzerland", region: "Graubunden, Switzerland",               activity: "hiking",       duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Switzerland", region: "Verbier, Valais, Switzerland",          activity: "mtb",          duration: 4,  budget: "luxury", level: "advanced"     },
  { country: "Switzerland", region: "Engadin, Switzerland",                  activity: "mtb",          duration: 4,  budget: "mid",    level: "advanced"     },
  { country: "Switzerland", region: "Jura Mountains, Switzerland",           activity: "climbing",     duration: 4,  budget: "budget", level: "intermediate" },

  // ── Austria (6) ─────────────────────────────────────────────────────────────
  { country: "Austria", region: "Otztal & Zillertal, Tirol, Austria",        activity: "cycling",      duration: 7,  budget: "mid",    level: "advanced"     },
  { country: "Austria", region: "Danube Cycle Route, Austria",               activity: "cycling",      duration: 5,  budget: "budget", level: "beginner"     },
  { country: "Austria", region: "Tirol hut-to-hut, Austria",                 activity: "hiking",       duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Austria", region: "Grossglockner, Hohe Tauern, Austria",       activity: "hiking",       duration: 4,  budget: "mid",    level: "advanced"     },
  { country: "Austria", region: "Arlberg, Vorarlberg, Austria",              activity: "mtb",          duration: 4,  budget: "mid",    level: "advanced"     },
  { country: "Austria", region: "Tirol ski touring, Austria",                activity: "skiing",       duration: 5,  budget: "mid",    level: "intermediate" },

  // ── Portugal (6) ────────────────────────────────────────────────────────────
  { country: "Portugal", region: "Algarve coast, Portugal",                  activity: "cycling",      duration: 6,  budget: "budget", level: "beginner"     },
  { country: "Portugal", region: "Douro Valley, Portugal",                   activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Portugal", region: "Rota Vicentina, Alentejo, Portugal",       activity: "hiking",       duration: 7,  budget: "budget", level: "beginner"     },
  { country: "Portugal", region: "Azores, Sao Miguel, Portugal",             activity: "hiking",       duration: 5,  budget: "mid",    level: "beginner"     },
  { country: "Portugal", region: "Alentejo, Portugal",                       activity: "trail_running",duration: 4,  budget: "budget", level: "intermediate" },
  { country: "Portugal", region: "Serra da Estrela, Portugal",               activity: "mtb",          duration: 4,  budget: "budget", level: "intermediate" },

  // ── Norway (5) ──────────────────────────────────────────────────────────────
  { country: "Norway",  region: "Jotunheimen, Norway",                       activity: "hiking",       duration: 7,  budget: "budget", level: "intermediate" },
  { country: "Norway",  region: "Lofoten Islands, Norway",                   activity: "hiking",       duration: 6,  budget: "mid",    level: "intermediate" },
  { country: "Norway",  region: "Hardangervidda, Norway",                    activity: "hiking",       duration: 7,  budget: "budget", level: "advanced"     },
  { country: "Norway",  region: "Sognefjord, Norway",                        activity: "kayaking",     duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Norway",  region: "Lofoten Islands, Norway",                   activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },

  // ── Greece (5) ──────────────────────────────────────────────────────────────
  { country: "Greece",  region: "Kalymnos, Dodecanese, Greece",              activity: "climbing",     duration: 7,  budget: "budget", level: "intermediate" },
  { country: "Greece",  region: "Meteora, Thessaly, Greece",                 activity: "climbing",     duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Greece",  region: "Crete, Greece",                             activity: "hiking",       duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Greece",  region: "Mount Olympus, Greece",                     activity: "hiking",       duration: 3,  budget: "budget", level: "advanced"     },
  { country: "Greece",  region: "Peloponnese, Greece",                       activity: "cycling",      duration: 7,  budget: "mid",    level: "intermediate" },

  // ── UK / Ireland (5) ────────────────────────────────────────────────────────
  { country: "Scotland", region: "West Highland Way, Scotland",              activity: "hiking",       duration: 7,  budget: "budget", level: "intermediate" },
  { country: "Wales",    region: "Snowdonia, Wales",                         activity: "hiking",       duration: 5,  budget: "budget", level: "intermediate" },
  { country: "Scotland", region: "Scottish Highlands NC500, Scotland",       activity: "cycling",      duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "England",  region: "Lake District, England",                   activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Wales",    region: "Peak District & Welsh crags, UK",          activity: "climbing",     duration: 5,  budget: "budget", level: "intermediate" },

  // ── Germany (5) ─────────────────────────────────────────────────────────────
  { country: "Germany", region: "Rhine Valley, Germany",                     activity: "cycling",      duration: 6,  budget: "budget", level: "beginner"     },
  { country: "Germany", region: "Black Forest, Germany",                     activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Germany", region: "Bavarian Alps, Germany",                    activity: "hiking",       duration: 6,  budget: "mid",    level: "intermediate" },
  { country: "Germany", region: "Black Forest Westweg, Germany",             activity: "hiking",       duration: 7,  budget: "budget", level: "intermediate" },
  { country: "Germany", region: "Sauerland, Germany",                        activity: "mtb",          duration: 4,  budget: "budget", level: "intermediate" },

  // ── Croatia (4) ─────────────────────────────────────────────────────────────
  { country: "Croatia", region: "Dalmatian Coast, Croatia",                  activity: "cycling",      duration: 7,  budget: "mid",    level: "intermediate" },
  { country: "Croatia", region: "Plitvice to Paklenica, Croatia",            activity: "hiking",       duration: 6,  budget: "budget", level: "intermediate" },
  { country: "Croatia", region: "Istria, Croatia",                           activity: "hiking",       duration: 5,  budget: "mid",    level: "beginner"     },
  { country: "Croatia", region: "Kornati National Park, Croatia",            activity: "kayaking",     duration: 5,  budget: "mid",    level: "beginner"     },

  // ── Slovenia (3) ────────────────────────────────────────────────────────────
  { country: "Slovenia", region: "Triglav National Park, Slovenia",          activity: "hiking",       duration: 5,  budget: "budget", level: "advanced"     },
  { country: "Slovenia", region: "Julian Alps, Slovenia",                    activity: "cycling",      duration: 5,  budget: "mid",    level: "intermediate" },
  { country: "Slovenia", region: "Soca Valley, Slovenia",                    activity: "mtb",          duration: 4,  budget: "mid",    level: "advanced"     },

  // ── Belgium (2) ─────────────────────────────────────────────────────────────
  { country: "Belgium", region: "Ardennes, Belgium",                         activity: "cycling",      duration: 4,  budget: "mid",    level: "intermediate" },
  { country: "Belgium", region: "Flanders, Belgium",                         activity: "cycling",      duration: 4,  budget: "mid",    level: "intermediate" },

  // ── Balkans / Eastern Europe (5) ────────────────────────────────────────────
  { country: "Albania",    region: "Albanian Alps (Accursed Mountains)",     activity: "hiking",       duration: 7,  budget: "budget", level: "advanced"     },
  { country: "Montenegro", region: "Bay of Kotor, Montenegro",               activity: "kayaking",     duration: 4,  budget: "budget", level: "beginner"     },
  { country: "Montenegro", region: "Durmitor National Park, Montenegro",     activity: "hiking",       duration: 5,  budget: "budget", level: "intermediate" },
  { country: "Slovakia",   region: "High Tatras, Slovakia",                  activity: "hiking",       duration: 6,  budget: "budget", level: "advanced"     },
  { country: "Bulgaria",   region: "Pirin Mountains, Bulgaria",              activity: "hiking",       duration: 5,  budget: "budget", level: "intermediate" },

  // ── Netherlands / Czech Republic (2) ────────────────────────────────────────
  { country: "Netherlands", region: "North Sea Coastal Route, Netherlands",  activity: "cycling",      duration: 5,  budget: "budget", level: "beginner"     },
  { country: "Czech Republic", region: "Bohemia & Moravia, Czech Republic",  activity: "cycling",      duration: 5,  budget: "budget", level: "beginner"     },
];

// ─── System prompts ───────────────────────────────────────────────────────────

function routeAgentPrompt(slot: VacationSlot): string {
  return `You are an expert sport-travel planner creating a publication-quality public adventure for TruthStay, a sport-first travel platform. This trip will inspire users globally.

Activity: ${slot.activity}
Region: ${slot.region}
Duration: ${slot.duration} days
Budget: ${slot.budget}
Fitness level: ${slot.level}

## Rules
- Name REAL roads, passes, trails, cols, crags — be specific (e.g. "Coll de Sa Calobra", "GR20 stage 1 Calenzana→Ortu di u Piobbu", "Voie Normale, Mont Blanc massif")
- Cycling: named cols, road numbers (D902, etc.), surfaces (asphalt/gravel/cobbles), gradient %
- Hiking: named GR/PR routes, hut names (Refugio X), ridgeline names, daily stage endpoints
- Climbing: crag names, sector names, grade range (6a-7b), bolt/trad, approach time
- Kayaking: named bays, capes, landing beaches, tidal/current notes
- Distances and elevation must be realistic and internally consistent
- Mix highlight days with easier/recovery days
- end_location must be a real town, village, or refuge name
- No emojis, no markdown in output

Respond ONLY with valid JSON — no markdown fences, no text outside the JSON:
{
  "adventure": {
    "title": "Short catchy title (max 8 words)",
    "description": "2-3 sentence overview of what makes this trip special",
    "region": "${slot.region}",
    "activity_type": "${slot.activity}",
    "duration_days": ${slot.duration},
    "start_date": null,
    "days": [
      {
        "day_number": 1,
        "title": "Start Location → End Location",
        "description": "What makes this day special — highlight, challenge, or scenery",
        "distance_km": <number or null>,
        "elevation_gain_m": <number or null>,
        "route_notes": "Named roads/trails, surfaces, key climbs, resupply points, safety notes",
        "end_location": "Real town/village/hut name",
        "pois": []
      }
    ]
  },
  "day_alternatives": {
    "1": {
      "routes": [
        { "title": "Easier variant name", "distance_km": <number or null>, "elevation_gain_m": <number or null>, "difficulty": "easy", "description": "Why easier and what differs", "end_location": "Town name" },
        { "title": "Harder variant name", "distance_km": <number or null>, "elevation_gain_m": <number or null>, "difficulty": "hard", "description": "What makes it harder", "end_location": "Town name" }
      ]
    }
  }
}`;
}

const ACCOMMODATION_AGENT_SYSTEM = `You are a sport-travel accommodation specialist. Given a route itinerary, suggest sport-friendly accommodation for each night.

Rules:
- Group by location — if the route stays in the same town multiple nights, create ONE stop covering all those nights
- 2 options per stop: one budget, one mid or one mid, one luxury (based on the trip's budget level)
- Prices in EUR, realistic for the region and season
- Descriptions must focus on sport-traveller benefits: bike storage, gear drying room, early breakfast, proximity to trailhead/harbour, shuttle service
- Use real accommodation names where known (rifugios, guesthouses, chain hotels)
- No emojis

Respond ONLY with valid JSON:
{
  "accommodation_stops": [
    {
      "location": "Town/village/hut name",
      "night_numbers": [1, 2],
      "notes": "Context, e.g. '2 nights — Day 2 is a rest day'",
      "options": [
        { "name": "Accommodation name", "type": "camping|hostel|hotel|guesthouse|luxury", "price_range": "budget|mid|luxury", "price_per_night_eur": <number>, "description": "Sport-traveller benefits" },
        { "name": "Second option", "type": "hotel", "price_range": "mid", "price_per_night_eur": <number>, "description": "Sport-traveller benefits" }
      ]
    }
  ]
}`;

const RESTAURANT_AGENT_SYSTEM = `You are a food specialist for sport travellers. Given a route itinerary and accommodation stops, suggest food options for each day.

Rules:
- On-route refuelling (for cycling/hiking/running): cafes, mountain huts, water stops at strategic km markers
- Evening meals: local restaurants near accommodation, cuisine typical of the region
- Real establishment names where known; otherwise describe the type and location
- Price ranges: $ (under €15), $$ (€15-30), $$$ (over €30 per person)
- Notes should mention portions, sport-friendly hours, dietary options
- No emojis

Respond ONLY with valid JSON:
{
  "restaurants": {
    "1": [
      { "name": "Cafe/restaurant name", "type": "lunch|dinner|breakfast|on_route_cafe", "cuisine": "Local|Italian|etc", "price_range": "$|$$|$$$", "location_note": "At km 45 near col summit / In town centre / etc", "notes": "Large portions, opens 7am for cyclists" }
    ]
  }
}`;

function qaAgentPrompt(slot: VacationSlot): string {
  return `You are a quality assurance editor for sport travel content. Review this adventure draft and output metadata.

Your tasks:
1. Verify the itinerary is internally consistent (distances realistic, locations geographically logical, end_locations match accommodation)
2. Extract accurate [longitude, latitude] WGS84 map coordinates for the adventure's geographic CENTRE (not start/end — the centre of where the adventure takes place)
3. Assign 3-5 descriptive tags
4. Compute average daily distance and elevation from the day data
5. Note any issues or improvements

Country: ${slot.country}
Region: ${slot.region}

Respond ONLY with valid JSON:
{
  "coords": [<longitude as decimal>, <latitude as decimal>],
  "country": "${slot.country}",
  "tags": ["tag1", "tag2", "tag3"],
  "avg_distance_km": <number or null>,
  "avg_elevation_m": <number or null>,
  "qa_notes": "Brief quality assessment — flag any inconsistencies or issues found"
}`;
}

// ─── Agent functions ──────────────────────────────────────────────────────────

const client = new Anthropic();

async function routeAgent(slot: VacationSlot): Promise<{
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
}> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 32000,
    system: routeAgentPrompt(slot),
    messages: [{ role: "user", content: `Generate the adventure for: ${slot.duration}-day ${slot.activity} in ${slot.region}` }],
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error(`Route agent returned no JSON for slot: ${slot.region}`);

  const parsed = JSON.parse(json) as {
    adventure: GeneratedAdventure;
    day_alternatives: DayAlternativesMap;
  };
  return { adventure: parsed.adventure, dayAlternatives: parsed.day_alternatives ?? {} };
}

async function accommodationAgent(slot: VacationSlot, adventure: GeneratedAdventure): Promise<AccommodationStop[]> {
  const routeSummary = adventure.days
    .map(d => `Day ${d.day_number}: ends at ${d.end_location}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: ACCOMMODATION_AGENT_SYSTEM,
    messages: [{
      role: "user",
      content: `Trip: ${adventure.title}\nBudget: ${slot.budget}\nActivity: ${slot.activity}\nRegion: ${slot.region}\n\nRoute end locations:\n${routeSummary}\n\nSuggest accommodation stops.`,
    }],
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error(`Accommodation agent returned no JSON for slot: ${slot.region}`);

  const parsed = JSON.parse(json) as { accommodation_stops: AccommodationStop[] };
  return parsed.accommodation_stops ?? [];
}

async function restaurantAgent(
  slot: VacationSlot,
  adventure: GeneratedAdventure,
  accommodationStops: AccommodationStop[],
): Promise<Record<string, unknown[]>> {
  const context = adventure.days
    .map(d => `Day ${d.day_number} (${d.title}): ends at ${d.end_location}${d.distance_km ? `, ${d.distance_km}km` : ""}`)
    .join("\n");

  const accomContext = accommodationStops
    .map(s => `Nights ${s.night_numbers.join(",")}: ${s.location}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: RESTAURANT_AGENT_SYSTEM,
    messages: [{
      role: "user",
      content: `Trip: ${adventure.title}\nActivity: ${slot.activity}\nRegion: ${slot.region}\nBudget: ${slot.budget}\n\nDaily route:\n${context}\n\nAccommodation:\n${accomContext}\n\nSuggest food options per day.`,
    }],
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return {};

  const parsed = JSON.parse(json) as { restaurants: Record<string, unknown[]> };
  return parsed.restaurants ?? {};
}

async function qaAgent(
  slot: VacationSlot,
  adventure: GeneratedAdventure,
  accommodationStops: AccommodationStop[],
): Promise<{ meta: DraftMeta; qaNotes: string }> {
  const summary = JSON.stringify({
    adventure: {
      title: adventure.title,
      days: adventure.days.map(d => ({
        day: d.day_number, title: d.title,
        end_location: d.end_location,
        distance_km: d.distance_km,
        elevation_gain_m: d.elevation_gain_m,
      })),
    },
    accommodation_stops: accommodationStops.map(s => ({
      location: s.location,
      nights: s.night_numbers,
    })),
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: qaAgentPrompt(slot),
    messages: [{ role: "user", content: summary }],
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];

  if (!json) {
    // Fallback meta with approximate coords by country
    return {
      meta: { coords: countryFallbackCoords(slot.country), country: slot.country, tags: [slot.activity, slot.level], avgDistanceKm: null, avgElevationM: null },
      qaNotes: "QA agent did not return structured JSON.",
    };
  }

  const parsed = JSON.parse(json) as {
    coords: [number, number];
    country: string;
    tags: string[];
    avg_distance_km: number | null;
    avg_elevation_m: number | null;
    qa_notes: string;
  };

  return {
    meta: {
      coords: parsed.coords,
      country: parsed.country ?? slot.country,
      tags: parsed.tags ?? [],
      avgDistanceKm: parsed.avg_distance_km ?? null,
      avgElevationM: parsed.avg_elevation_m ?? null,
    },
    qaNotes: parsed.qa_notes ?? "",
  };
}

// Approximate country centre coordinates as a fallback
function countryFallbackCoords(country: string): [number, number] {
  const COORDS: Record<string, [number, number]> = {
    France:         [2.35,  46.5],
    Italy:          [12.5,  42.5],
    Spain:          [-3.7,  40.4],
    Switzerland:    [8.2,   46.8],
    Austria:        [14.6,  47.6],
    Portugal:       [-8.2,  39.4],
    Norway:         [10.0,  62.0],
    Greece:         [22.0,  39.0],
    Scotland:       [-4.2,  56.8],
    Wales:          [-3.7,  52.4],
    England:        [-1.5,  52.4],
    Germany:        [10.5,  51.2],
    Croatia:        [15.2,  45.1],
    Slovenia:       [14.8,  46.2],
    Belgium:        [4.5,   50.5],
    Albania:        [20.2,  41.2],
    Montenegro:     [19.4,  42.9],
    Slovakia:       [19.4,  48.7],
    Bulgaria:       [25.5,  42.7],
    Netherlands:    [5.3,   52.1],
    "Czech Republic": [15.5, 49.8],
  };
  return COORDS[country] ?? [10.0, 50.0];
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Runs the 4-agent pipeline for a single vacation slot.
 * Returns a VacationDraft ready to be stored in public_adventure_drafts.
 */
export async function generatePublicVacation(slot: VacationSlot): Promise<VacationDraft> {
  const { adventure, dayAlternatives } = await routeAgent(slot);
  const accommodationStops = await accommodationAgent(slot, adventure);
  const restaurants = await restaurantAgent(slot, adventure, accommodationStops);
  const { meta, qaNotes } = await qaAgent(slot, adventure, accommodationStops);

  // Merge restaurant suggestions into day alternatives
  for (const [dayNumStr, rests] of Object.entries(restaurants)) {
    const key = dayNumStr;
    if (!dayAlternatives[key]) dayAlternatives[key] = { routes: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dayAlternatives[key] as any).restaurants = rests;
  }

  return { slot, adventure, dayAlternatives, accommodationStops, meta, qaNotes };
}
