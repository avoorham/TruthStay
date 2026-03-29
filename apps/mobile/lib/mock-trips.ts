import type { AdventureRow } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripMeta {
  coords: [number, number]; // map camera centre
  dayCoords: Record<number, [number, number]>; // per-day stop coords
  accommodation: string;
  pricePerNight: number;
  nights: string;
}

// ─── Mock trip data ───────────────────────────────────────────────────────────

export const MOCK_TRIPS: AdventureRow[] = [
  {
    id: "mock-1",
    title: "Blue Mountains Discovery",
    description:
      "A stunning 3-day hiking adventure through the Blue Mountains National Park, exploring ancient sandstone plateaus, waterfalls, and Aboriginal heritage sites.",
    region: "Blue Mountains, New South Wales",
    activityType: "hiking",
    durationDays: 3,
    startDate: "2026-06-14",
    isSaved: true,
    createdAt: "2026-01-15",
    adventure_days: [
      {
        id: "mock-1-d1",
        dayNumber: 1,
        title: "Blue Mountains Heritage Centre",
        description:
          "Start at the Heritage Centre to learn about the park's geology and ecology. The trail leads to Govetts Leap lookout with dramatic valley views.",
        distanceKm: 8,
        elevationGainM: 350,
        routeNotes: "Govetts Leap Rd, Blue Mountains National Park NSW 2787",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-1-d2",
        dayNumber: 2,
        title: "Three Sisters & Echo Point",
        description:
          "The iconic Three Sisters rock formation at Echo Point, followed by the Grand Stairway descent into the Jamison Valley.",
        distanceKm: 12,
        elevationGainM: 480,
        routeNotes: "Echo Point Rd, Katoomba NSW 2780",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-1-d3",
        dayNumber: 3,
        title: "Wentworth Falls Circuit",
        description:
          "Full circuit around Wentworth Falls, passing Conservation Hut and descending to the Valley of the Waters.",
        distanceKm: 9,
        elevationGainM: 290,
        routeNotes: "Falls Rd, Wentworth Falls NSW 2782",
        komootTourId: null,
        alternatives: null,
      },
    ],
  },
  {
    id: "mock-2",
    title: "Sa Calobra Loop",
    description:
      "Mallorca's most legendary cycling route — a 26 km out-and-back to the spectacular cove of Sa Calobra, descending through 26 hairpin bends past the Puig Major.",
    region: "Balearic Islands, Spain",
    activityType: "cycling",
    durationDays: 5,
    startDate: "2026-05-10",
    isSaved: true,
    createdAt: "2026-02-01",
    adventure_days: [
      {
        id: "mock-2-d1",
        dayNumber: 1,
        title: "Arrival & Palma Old Town",
        description:
          "Arrive in Palma, check in and explore the Gothic quarter around Palma Cathedral. Easy legs shake-out ride along the promenade.",
        distanceKm: 18,
        elevationGainM: 120,
        routeNotes: "Passeig del Born, Palma de Mallorca",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-2-d2",
        dayNumber: 2,
        title: "Puig Major & Serra de Tramuntana",
        description:
          "Tackle Puig Major — the highest peak in Mallorca — through the stunning Tramuntana mountain range. A serious climbing day.",
        distanceKm: 78,
        elevationGainM: 2100,
        routeNotes: "Carretera del Puig Major, Mallorca",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-2-d3",
        dayNumber: 3,
        title: "Sa Calobra Descent",
        description:
          "The legendary Sa Calobra descent through 26 hairpin turns to the turquoise cove below, then battle back up.",
        distanceKm: 52,
        elevationGainM: 1650,
        routeNotes: "Ma-2141, Sa Calobra, Mallorca",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-2-d4",
        dayNumber: 4,
        title: "Cap de Formentor",
        description:
          "Ride to the northernmost tip of Mallorca for breathtaking cliff-top views over the Mediterranean.",
        distanceKm: 65,
        elevationGainM: 1400,
        routeNotes: "Cap de Formentor, Pollença",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-2-d5",
        dayNumber: 5,
        title: "Coastal Ride & Departure",
        description:
          "Easy coastal ride back to Palma along the Bay of Alcúdia before evening departure.",
        distanceKm: 42,
        elevationGainM: 380,
        routeNotes: "Passeig Marítim, Palma",
        komootTourId: null,
        alternatives: null,
      },
    ],
  },
  {
    id: "mock-3",
    title: "Tour du Mont Blanc",
    description:
      "The classic 170 km circuit around Mont Blanc, passing through France, Italy and Switzerland with dramatic alpine scenery on one of the world's great treks.",
    region: "Alps — France / Italy / Switzerland",
    activityType: "hiking",
    durationDays: 10,
    startDate: "2025-09-01",
    isSaved: true,
    createdAt: "2025-05-20",
    adventure_days: [
      {
        id: "mock-3-d1",
        dayNumber: 1,
        title: "Les Houches to Les Contamines",
        description:
          "Start at Les Houches, ascend Col de Voza (1653 m) for first views of Mont Blanc, then descend to Les Contamines.",
        distanceKm: 18,
        elevationGainM: 950,
        routeNotes: "Départ: Les Houches, Haute-Savoie, France",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d2",
        dayNumber: 2,
        title: "Col du Bonhomme",
        description:
          "A long day over Col du Bonhomme (2329 m) and Col de la Croix du Bonhomme (2483 m). Big views, big descent.",
        distanceKm: 21,
        elevationGainM: 1450,
        routeNotes: "Col du Bonhomme, Beaufortain, France",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d3",
        dayNumber: 3,
        title: "Courmayeur, Italy",
        description:
          "Cross into Italy via Col de la Seigne (2516 m) with stunning views of the Italian face of Mont Blanc.",
        distanceKm: 23,
        elevationGainM: 1200,
        routeNotes: "Courmayeur, Valle d'Aosta, Italy",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d4",
        dayNumber: 4,
        title: "Rifugio Bonatti",
        description:
          "A highlight stage along Val Ferret with magnificent views of the Grandes Jorasses. Night at the famous Rifugio Bonatti.",
        distanceKm: 17,
        elevationGainM: 880,
        routeNotes: "Rifugio Bonatti, Courmayeur, Italy",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d5",
        dayNumber: 5,
        title: "Grand Col Ferret & Switzerland",
        description:
          "Cross into Switzerland at Grand Col Ferret (2537 m) — the international border crossing is a milestone on the TMB.",
        distanceKm: 19,
        elevationGainM: 950,
        routeNotes: "Grand Col Ferret, La Fouly, Switzerland",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d6",
        dayNumber: 6,
        title: "Champex-Lac",
        description:
          "Gentle valley walking to the charming alpine lake village of Champex-Lac. Perfect rest and resupply day.",
        distanceKm: 15,
        elevationGainM: 620,
        routeNotes: "Champex-Lac, Canton of Valais, Switzerland",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d7",
        dayNumber: 7,
        title: "Col de la Forclaz",
        description:
          "Climb to Col de la Forclaz (1526 m) and continue to Trient. The final Swiss stage before returning to France.",
        distanceKm: 16,
        elevationGainM: 800,
        routeNotes: "Col de la Forclaz, Trient, Switzerland",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d8",
        dayNumber: 8,
        title: "Aiguillette des Posettes",
        description:
          "Re-enter France and tackle the rewarding Aiguillette des Posettes ridge for panoramic views over Chamonix.",
        distanceKm: 20,
        elevationGainM: 1100,
        routeNotes: "Le Tour, Chamonix-Mont-Blanc, France",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d9",
        dayNumber: 9,
        title: "Lac Blanc",
        description:
          "The iconic Lac Blanc stage — arguably the finest day on the TMB with its unmatched views of the Mont Blanc massif.",
        distanceKm: 14,
        elevationGainM: 1050,
        routeNotes: "Réserve naturelle des Aiguilles Rouges, Chamonix",
        komootTourId: null,
        alternatives: null,
      },
      {
        id: "mock-3-d10",
        dayNumber: 10,
        title: "Return to Les Houches",
        description:
          "The final descent back to Les Houches, completing the full circuit. Champagne views as you walk into town.",
        distanceKm: 12,
        elevationGainM: 400,
        routeNotes: "Les Houches, Haute-Savoie, France",
        komootTourId: null,
        alternatives: null,
      },
    ],
  },
];

// ─── Per-trip metadata ────────────────────────────────────────────────────────

export const MOCK_TRIP_META: Record<string, TripMeta> = {
  "mock-1": {
    coords: [150.31, -33.68],
    dayCoords: {
      1: [150.31, -33.64],
      2: [150.32, -33.73],
      3: [150.38, -33.72],
    },
    accommodation: "Blue Mountains YHA",
    pricePerNight: 45,
    nights: "All nights",
  },
  "mock-2": {
    coords: [2.90, 39.75],
    dayCoords: {
      1: [2.65, 39.57],
      2: [2.77, 39.80],
      3: [2.80, 39.85],
      4: [3.20, 39.96],
      5: [2.65, 39.57],
    },
    accommodation: "Hotel Bon Sol, Palma",
    pricePerNight: 120,
    nights: "All nights",
  },
  "mock-3": {
    coords: [6.95, 45.83],
    dayCoords: {
      1: [6.80, 45.89],
      2: [6.72, 45.67],
      3: [6.98, 45.80],
      4: [7.07, 45.83],
      5: [7.11, 45.87],
      6: [7.15, 45.97],
      7: [7.02, 46.03],
      8: [6.92, 46.01],
      9: [6.88, 45.94],
      10: [6.80, 45.89],
    },
    accommodation: "Refuge du Col de la Croix du Bonhomme",
    pricePerNight: 35,
    nights: "All nights",
  },
};
