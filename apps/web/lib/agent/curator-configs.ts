export type SearchArea = {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
};

export type CuratorConfig = {
  activityType: string;     // matches ActivityType enum: cycling|hiking|trail_running|skiing|snowboarding|kayaking|climbing
  region: string;           // region label used in the app
  komootSportType: string;  // Komoot API sport_types param
  searchAreas: SearchArea[];
  minKomootRating: number;  // 4.5
  minBookingScore: number;  // 9.0 (Booking.com uses a 10-point scale)
  targetRouteCount: number;
  targetAccomCount: number;
};

export const CURATOR_CONFIGS: CuratorConfig[] = [
  // ── Europe ──────────────────────────────────────────────────────────────────
  {
    activityType: "hiking", region: "Europe", komootSportType: "hike",
    searchAreas: [
      { name: "Swiss Alps",    lat: 46.5,  lng: 9.5,   radiusKm: 150 },
      { name: "Pyrenees",      lat: 42.7,  lng: 0.5,   radiusKm: 200 },
      { name: "Dolomites",     lat: 46.4,  lng: 11.9,  radiusKm: 100 },
      { name: "Scandinavia",   lat: 61.0,  lng: 8.0,   radiusKm: 300 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 25, targetAccomCount: 20,
  },
  {
    activityType: "cycling", region: "Europe", komootSportType: "racebike",
    searchAreas: [
      { name: "French Alps",   lat: 45.5,  lng: 6.5,   radiusKm: 150 },
      { name: "Mallorca",      lat: 39.7,  lng: 2.9,   radiusKm: 50  },
      { name: "Tuscany",       lat: 43.5,  lng: 11.1,  radiusKm: 100 },
      { name: "Pyrenees",      lat: 42.7,  lng: 0.5,   radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 20, targetAccomCount: 15,
  },
  {
    activityType: "trail_running", region: "Europe", komootSportType: "jogging",
    searchAreas: [
      { name: "Chamonix",      lat: 45.9,  lng: 6.9,   radiusKm: 50  },
      { name: "Pyrenees",      lat: 42.7,  lng: 0.5,   radiusKm: 200 },
      { name: "Dolomites",     lat: 46.4,  lng: 11.9,  radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "skiing", region: "Europe", komootSportType: "skitour",
    searchAreas: [
      { name: "Swiss Alps",    lat: 46.5,  lng: 9.5,   radiusKm: 150 },
      { name: "Austrian Alps", lat: 47.1,  lng: 11.5,  radiusKm: 150 },
      { name: "Pyrenees",      lat: 42.7,  lng: 0.5,   radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "snowboarding", region: "Europe", komootSportType: "skitour",
    searchAreas: [
      { name: "French Alps",   lat: 45.5,  lng: 6.5,   radiusKm: 150 },
      { name: "Swiss Alps",    lat: 46.5,  lng: 9.5,   radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 10,
  },
  {
    activityType: "kayaking", region: "Europe", komootSportType: "kayaking",
    searchAreas: [
      { name: "Norway fjords", lat: 61.0,  lng: 6.0,   radiusKm: 200 },
      { name: "Adriatic",      lat: 44.0,  lng: 15.5,  radiusKm: 200 },
      { name: "Scotland",      lat: 57.5,  lng: -5.0,  radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 10,
  },
  {
    activityType: "climbing", region: "Europe", komootSportType: "climbing",
    searchAreas: [
      { name: "Dolomites",     lat: 46.4,  lng: 11.9,  radiusKm: 80  },
      { name: "Kalymnos",      lat: 37.0,  lng: 26.9,  radiusKm: 30  },
      { name: "Arco",          lat: 45.9,  lng: 10.9,  radiusKm: 30  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },

  // ── North America ────────────────────────────────────────────────────────────
  {
    activityType: "hiking", region: "North America", komootSportType: "hike",
    searchAreas: [
      { name: "Rockies Colorado",   lat: 39.5,  lng: -106.0, radiusKm: 150 },
      { name: "Pacific Northwest",  lat: 47.8,  lng: -121.5, radiusKm: 150 },
      { name: "Appalachians",       lat: 36.0,  lng: -83.0,  radiusKm: 200 },
      { name: "Canadian Rockies",   lat: 51.5,  lng: -116.5, radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 20, targetAccomCount: 15,
  },
  {
    activityType: "cycling", region: "North America", komootSportType: "racebike",
    searchAreas: [
      { name: "California Coast",   lat: 36.5,  lng: -121.9, radiusKm: 150 },
      { name: "Vermont",            lat: 44.0,  lng: -72.7,  radiusKm: 100 },
      { name: "Colorado Rockies",   lat: 39.5,  lng: -106.0, radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "trail_running", region: "North America", komootSportType: "jogging",
    searchAreas: [
      { name: "Colorado",           lat: 39.5,  lng: -106.0, radiusKm: 150 },
      { name: "Pacific Crest",      lat: 37.5,  lng: -119.5, radiusKm: 200 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 12, targetAccomCount: 10,
  },
  {
    activityType: "skiing", region: "North America", komootSportType: "skitour",
    searchAreas: [
      { name: "Wasatch Utah",       lat: 40.7,  lng: -111.5, radiusKm: 80  },
      { name: "Sierra Nevada",      lat: 38.5,  lng: -119.8, radiusKm: 150 },
      { name: "BC Canada",          lat: 50.0,  lng: -122.5, radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 12, targetAccomCount: 10,
  },
  {
    activityType: "snowboarding", region: "North America", komootSportType: "skitour",
    searchAreas: [
      { name: "Whistler BC",        lat: 50.1,  lng: -122.9, radiusKm: 50  },
      { name: "Colorado Rockies",   lat: 39.5,  lng: -106.0, radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "kayaking", region: "North America", komootSportType: "kayaking",
    searchAreas: [
      { name: "Pacific Northwest",  lat: 48.5,  lng: -123.0, radiusKm: 150 },
      { name: "Great Lakes",        lat: 46.0,  lng: -84.0,  radiusKm: 200 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "climbing", region: "North America", komootSportType: "climbing",
    searchAreas: [
      { name: "Yosemite",           lat: 37.7,  lng: -119.5, radiusKm: 50  },
      { name: "Red Rock Nevada",    lat: 36.1,  lng: -115.4, radiusKm: 50  },
      { name: "Squamish BC",        lat: 49.7,  lng: -123.1, radiusKm: 30  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },

  // ── Asia ─────────────────────────────────────────────────────────────────────
  {
    activityType: "hiking", region: "Asia", komootSportType: "hike",
    searchAreas: [
      { name: "Nepal Himalayas",    lat: 27.9,  lng: 86.7,   radiusKm: 200 },
      { name: "Japan Alps",         lat: 36.3,  lng: 137.6,  radiusKm: 150 },
      { name: "Kyrgyzstan Tian Shan", lat: 42.0, lng: 74.5,  radiusKm: 200 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "cycling", region: "Asia", komootSportType: "racebike",
    searchAreas: [
      { name: "Japan",              lat: 35.5,  lng: 136.0,  radiusKm: 300 },
      { name: "Karakoram Highway",  lat: 36.0,  lng: 74.0,   radiusKm: 200 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 12, targetAccomCount: 10,
  },
  {
    activityType: "trail_running", region: "Asia", komootSportType: "jogging",
    searchAreas: [
      { name: "Hong Kong trails",   lat: 22.3,  lng: 114.2,  radiusKm: 30  },
      { name: "Japan mountains",    lat: 36.3,  lng: 137.6,  radiusKm: 200 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "skiing", region: "Asia", komootSportType: "skitour",
    searchAreas: [
      { name: "Hokkaido Japan",     lat: 43.0,  lng: 142.5,  radiusKm: 150 },
      { name: "Kashmir India",      lat: 34.2,  lng: 74.8,   radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "snowboarding", region: "Asia", komootSportType: "skitour",
    searchAreas: [
      { name: "Niseko Japan",       lat: 42.8,  lng: 140.7,  radiusKm: 50  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 8,
  },
  {
    activityType: "kayaking", region: "Asia", komootSportType: "kayaking",
    searchAreas: [
      { name: "Ha Long Bay",        lat: 20.9,  lng: 107.1,  radiusKm: 80  },
      { name: "Philippines",        lat: 10.6,  lng: 119.5,  radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 8,
  },
  {
    activityType: "climbing", region: "Asia", komootSportType: "climbing",
    searchAreas: [
      { name: "Krabi Thailand",     lat: 8.1,   lng: 98.8,   radiusKm: 50  },
      { name: "Yangshuo China",     lat: 24.8,  lng: 110.5,  radiusKm: 30  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 8,
  },

  // ── South America ────────────────────────────────────────────────────────────
  {
    activityType: "hiking", region: "South America", komootSportType: "hike",
    searchAreas: [
      { name: "Patagonia",          lat: -50.0, lng: -73.0,  radiusKm: 200 },
      { name: "Inca Trail Peru",    lat: -13.2, lng: -72.5,  radiusKm: 100 },
      { name: "Bolivian Andes",     lat: -16.5, lng: -68.0,  radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "cycling", region: "South America", komootSportType: "racebike",
    searchAreas: [
      { name: "Colombia Andes",     lat: 5.5,   lng: -75.0,  radiusKm: 150 },
      { name: "Lake Titicaca",      lat: -15.5, lng: -69.5,  radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 12, targetAccomCount: 10,
  },
  {
    activityType: "trail_running", region: "South America", komootSportType: "jogging",
    searchAreas: [
      { name: "Patagonia",          lat: -50.0, lng: -73.0,  radiusKm: 200 },
      { name: "Andes Colombia",     lat: 5.5,   lng: -75.0,  radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "skiing", region: "South America", komootSportType: "skitour",
    searchAreas: [
      { name: "Bariloche Argentina", lat: -41.1, lng: -71.3, radiusKm: 100 },
      { name: "Portillo Chile",      lat: -32.8, lng: -70.1, radiusKm: 50  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "snowboarding", region: "South America", komootSportType: "skitour",
    searchAreas: [
      { name: "Valle Nevado Chile", lat: -33.4, lng: -70.3,  radiusKm: 50  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 6,
  },
  {
    activityType: "kayaking", region: "South America", komootSportType: "kayaking",
    searchAreas: [
      { name: "Patagonia fjords",   lat: -46.0, lng: -73.5,  radiusKm: 200 },
      { name: "Amazon tributaries", lat: -3.0,  lng: -60.0,  radiusKm: 200 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 8,
  },
  {
    activityType: "climbing", region: "South America", komootSportType: "climbing",
    searchAreas: [
      { name: "Torres del Paine",   lat: -50.9, lng: -73.4,  radiusKm: 50  },
      { name: "El Chorro Argentina", lat: -28.7, lng: -66.0, radiusKm: 50  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 6,
  },

  // ── Africa ───────────────────────────────────────────────────────────────────
  {
    activityType: "hiking", region: "Africa", komootSportType: "hike",
    searchAreas: [
      { name: "Atlas Mountains",    lat: 31.5,  lng: -7.5,   radiusKm: 150 },
      { name: "Kilimanjaro",        lat: -3.1,  lng: 37.3,   radiusKm: 50  },
      { name: "Cape Peninsula",     lat: -34.2, lng: 18.4,   radiusKm: 50  },
      { name: "Drakensberg",        lat: -29.5, lng: 29.3,   radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "cycling", region: "Africa", komootSportType: "racebike",
    searchAreas: [
      { name: "Cape Town",          lat: -33.9, lng: 18.5,   radiusKm: 80  },
      { name: "Atlas Mountains",    lat: 31.5,  lng: -7.5,   radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "trail_running", region: "Africa", komootSportType: "jogging",
    searchAreas: [
      { name: "Cape Town",          lat: -33.9, lng: 18.5,   radiusKm: 80  },
      { name: "Drakensberg",        lat: -29.5, lng: 29.3,   radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 6,
  },
  {
    activityType: "skiing", region: "Africa", komootSportType: "skitour",
    searchAreas: [
      { name: "Atlas Mountains",    lat: 31.5,  lng: -7.5,   radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 5, targetAccomCount: 5,
  },
  {
    activityType: "snowboarding", region: "Africa", komootSportType: "skitour",
    searchAreas: [
      { name: "Atlas Mountains",    lat: 31.5,  lng: -7.5,   radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 4, targetAccomCount: 4,
  },
  {
    activityType: "kayaking", region: "Africa", komootSportType: "kayaking",
    searchAreas: [
      { name: "Okavango Delta",     lat: -18.8, lng: 22.5,   radiusKm: 100 },
      { name: "Cape coast",         lat: -34.2, lng: 18.4,   radiusKm: 80  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 6, targetAccomCount: 6,
  },
  {
    activityType: "climbing", region: "Africa", komootSportType: "climbing",
    searchAreas: [
      { name: "Rocklands SA",       lat: -32.4, lng: 19.0,   radiusKm: 50  },
      { name: "Mount Kenya",        lat: -0.2,  lng: 37.3,   radiusKm: 30  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 6, targetAccomCount: 6,
  },

  // ── Oceania ──────────────────────────────────────────────────────────────────
  {
    activityType: "hiking", region: "Oceania", komootSportType: "hike",
    searchAreas: [
      { name: "NZ Southern Alps",   lat: -43.7, lng: 170.1,  radiusKm: 150 },
      { name: "NZ Fiordland",       lat: -45.2, lng: 168.0,  radiusKm: 100 },
      { name: "Australian Alps",    lat: -36.5, lng: 148.3,  radiusKm: 150 },
      { name: "Tasmania",           lat: -42.0, lng: 146.3,  radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 15, targetAccomCount: 12,
  },
  {
    activityType: "cycling", region: "Oceania", komootSportType: "racebike",
    searchAreas: [
      { name: "NZ South Island",    lat: -43.7, lng: 170.1,  radiusKm: 200 },
      { name: "Victoria Australia", lat: -37.5, lng: 144.8,  radiusKm: 150 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "trail_running", region: "Oceania", komootSportType: "jogging",
    searchAreas: [
      { name: "NZ South Island",    lat: -43.7, lng: 170.1,  radiusKm: 200 },
      { name: "Blue Mountains AU",  lat: -33.6, lng: 150.3,  radiusKm: 50  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 10, targetAccomCount: 8,
  },
  {
    activityType: "skiing", region: "Oceania", komootSportType: "skitour",
    searchAreas: [
      { name: "NZ Queenstown",      lat: -45.0, lng: 168.7,  radiusKm: 100 },
      { name: "Snowy Mountains AU", lat: -36.5, lng: 148.3,  radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 8,
  },
  {
    activityType: "snowboarding", region: "Oceania", komootSportType: "skitour",
    searchAreas: [
      { name: "NZ Queenstown",      lat: -45.0, lng: 168.7,  radiusKm: 100 },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 6, targetAccomCount: 6,
  },
  {
    activityType: "kayaking", region: "Oceania", komootSportType: "kayaking",
    searchAreas: [
      { name: "NZ Marlborough",     lat: -41.5, lng: 174.0,  radiusKm: 80  },
      { name: "Whitsundays AU",     lat: -20.3, lng: 148.9,  radiusKm: 80  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 8,
  },
  {
    activityType: "climbing", region: "Oceania", komootSportType: "climbing",
    searchAreas: [
      { name: "NZ Wanaka",          lat: -44.7, lng: 169.1,  radiusKm: 50  },
      { name: "Grampians AU",       lat: -37.1, lng: 142.5,  radiusKm: 50  },
    ],
    minKomootRating: 4.5, minBookingScore: 9.0, targetRouteCount: 8, targetAccomCount: 6,
  },
];

/** Look up a config by activityType + region. Returns undefined if not found. */
export function getCuratorConfig(activityType: string, region: string): CuratorConfig | undefined {
  return CURATOR_CONFIGS.find(
    c => c.activityType === activityType && c.region === region,
  );
}

/** All unique regions present in the configs. */
export const CURATOR_REGIONS = [...new Set(CURATOR_CONFIGS.map(c => c.region))];

/** All unique activity types present in the configs. */
export const CURATOR_ACTIVITY_TYPES = [...new Set(CURATOR_CONFIGS.map(c => c.activityType))];
