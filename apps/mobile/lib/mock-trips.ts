import type { AdventureRow } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RestaurantStop {
  name: string;
  cuisine: string;
  coords: [number, number];
  night: number; // after which night's activity
  priceRange: "$" | "$$" | "$$$";
}

export interface Booking {
  type: "flight" | "hotel" | "train" | "activity" | "car";
  title: string;
  ref: string;
  date: string;
  price: number;
  currency: string;
}

export interface TripMeta {
  coords: [number, number];               // map camera centre
  dayCoords: Record<number, [number, number]>;  // per-day activity stop coords
  accommodation: string;
  accommodationCoords: [number, number];  // actual hotel/hut location
  pricePerNight: number;
  nights: string;
  restaurants: RestaurantStop[];
  bookings: Booking[];
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
  // ── Explore adventures (IDs match MOCK_ADVENTURES in explore/index.tsx) ──────
  {
    id: "1",
    title: "Sa Calobra Loop",
    description: "Mallorca's iconic cycling circuit — Sa Calobra, Cap Formentor, and the Tramuntana mountains.",
    region: "Balearic Islands, Spain",
    activityType: "cycling",
    durationDays: 7,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "1-d1", dayNumber: 1, title: "Palma → Sóller via Coll de Sóller", description: "Warm-up stage over the classic Coll de Sóller (496 m) through the Tramuntana foothills.", distanceKm: 45, elevationGainM: 600, routeNotes: "Ma-11 to Sóller. Well-surfaced. Light traffic in the morning.", komootTourId: null, alternatives: null },
      { id: "1-d2", dayNumber: 2, title: "Sóller → Sa Calobra & back", description: "Descend the legendary 26-hairpin Sa Calobra road to the cove, then grind back up.", distanceKm: 52, elevationGainM: 1650, routeNotes: "Ma-2141 to Sa Calobra. Descent 9.5 km at avg 7%. Return same road.", komootTourId: null, alternatives: null },
      { id: "1-d3", dayNumber: 3, title: "Puig Major Circuit", description: "Tackle the highest road in Mallorca beneath the Puig Major radar domes (862 m).", distanceKm: 78, elevationGainM: 2100, routeNotes: "Ma-10 north from Sóller. Military exclusion zone at summit — road loops around it.", komootTourId: null, alternatives: null },
      { id: "1-d4", dayNumber: 4, title: "Cap de Formentor", description: "Ride to the northernmost tip of Mallorca — dramatic cliff road with Med views.", distanceKm: 65, elevationGainM: 1400, routeNotes: "Ma-2210 from Pollença. Timed entry gate applies May–Oct (before 09:00 or after 19:00 free).", komootTourId: null, alternatives: null },
      { id: "1-d5", dayNumber: 5, title: "Pollença → Alcúdia Coast Loop", description: "Relaxed coastal stage linking medieval Pollença to the Bay of Alcúdia.", distanceKm: 55, elevationGainM: 480, routeNotes: "Flat seaside roads. Watch for tourist traffic on the seafront.", komootTourId: null, alternatives: null },
      { id: "1-d6", dayNumber: 6, title: "Lluc Monastery & Coll de Sa Batalla", description: "Classic Mallorca climb to Lluc Monastery, then Coll de Sa Batalla for panoramic views.", distanceKm: 72, elevationGainM: 1800, routeNotes: "Ma-10 to Lluc via Pollença. Resupply at Lluc monastery bar.", komootTourId: null, alternatives: null },
      { id: "1-d7", dayNumber: 7, title: "Return to Palma — Bay Ride", description: "Easy coastal roll back into Palma along the Bay of Alcúdia and Palma Bay promenade.", distanceKm: 60, elevationGainM: 320, routeNotes: "Ma-13 south. Bike path on seafront into Palma centre.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "2",
    title: "Alta Via 1",
    description: "Hut-to-hut traverse of the Dolomites on one of Europe's most iconic long-distance trails.",
    region: "Dolomites, Italy",
    activityType: "hiking",
    durationDays: 8,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "2-d1", dayNumber: 1, title: "Lago di Braies → Rifugio Biella", description: "Start at the turquoise Lago di Braies and climb steeply through pine forest to the first refuge.", distanceKm: 16, elevationGainM: 1050, routeNotes: "Trail 1 from Lago di Braies. Refuge Biella at 2327 m — book well ahead.", komootTourId: null, alternatives: null },
      { id: "2-d2", dayNumber: 2, title: "Rifugio Biella → Rifugio Fodara Vedla", description: "Traverse the high plateau of the Fanes group with sweeping limestone views.", distanceKm: 19, elevationGainM: 900, routeNotes: "Trail 7 across Fanes plateau. Gentle today — ideal for acclimatisation.", komootTourId: null, alternatives: null },
      { id: "2-d3", dayNumber: 3, title: "Fodara Vedla → Rifugio Lagazuoi", description: "Cable car option from Passo Falzarego or the steep trail up to Lagazuoi (2752 m).", distanceKm: 21, elevationGainM: 1300, routeNotes: "Trail 20. WWII tunnel system accessible from refuge — fascinating detour.", komootTourId: null, alternatives: null },
      { id: "2-d4", dayNumber: 4, title: "Lagazuoi → Rifugio Nuvolau", description: "Dramatic ridge walk past the Cinque Torri towers, one of the AV1's highlight stages.", distanceKm: 18, elevationGainM: 850, routeNotes: "Trail 443 via Cinque Torri. Nuvolau refuge (2575 m) sits on its own summit — spectacular.", komootTourId: null, alternatives: null },
      { id: "2-d5", dayNumber: 5, title: "Nuvolau → Rifugio Coldai", description: "Descend to Alleghe lake and climb through beech forest to the Civetta group.", distanceKm: 22, elevationGainM: 1100, routeNotes: "Long descent to Alleghe — knees will feel it. Resupply in Alleghe village.", komootTourId: null, alternatives: null },
      { id: "2-d6", dayNumber: 6, title: "Coldai → Rifugio Vazzolèr", description: "Traverse beneath the 1200 m northwest face of Civetta — one of the Six Great North Faces.", distanceKm: 15, elevationGainM: 750, routeNotes: "Trail 556. Short day — afternoon for exploring below the Civetta wall.", komootTourId: null, alternatives: null },
      { id: "2-d7", dayNumber: 7, title: "Vazzolèr → Rifugio Carestiato", description: "Cross high pastures and woodland with views toward the Pale di San Martino.", distanceKm: 20, elevationGainM: 980, routeNotes: "Trail 543. Mixed terrain. Carestiato hut has excellent food.", komootTourId: null, alternatives: null },
      { id: "2-d8", dayNumber: 8, title: "Carestiato → Belluno (finish)", description: "Descend from the mountains through terraced vineyards to the valley town of Belluno.", distanceKm: 18, elevationGainM: 400, routeNotes: "Trail 543 then 2 south. Bus from Belluno to Feltre / Venice for onward travel.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "3",
    title: "UTMB Course Recon",
    description: "Run the iconic 170 km UTMB loop in stages — one of trail running's ultimate bucket-list objectives.",
    region: "Mont Blanc, France",
    activityType: "trail_running",
    durationDays: 5,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "3-d1", dayNumber: 1, title: "Chamonix → Les Contamines", description: "The UTMB opening leg — out of Chamonix, over Col de Voza (1653 m) to Les Contamines.", distanceKm: 32, elevationGainM: 1300, routeNotes: "UTMB trail markers. Water at Col de Voza refuge. Run early to avoid afternoon heat.", komootTourId: null, alternatives: null },
      { id: "3-d2", dayNumber: 2, title: "Les Contamines → Courmayeur", description: "The hardest day — over Col du Bonhomme, Col de la Seigne, and into Italy.", distanceKm: 40, elevationGainM: 2500, routeNotes: "Col de la Seigne (2516 m) is the Italian border. Courmayeur has a big UTMB checkpoint — resupply options excellent.", komootTourId: null, alternatives: null },
      { id: "3-d3", dayNumber: 3, title: "Courmayeur → Champex-Lac", description: "Run the Val Ferret below the Grandes Jorasses, over Grand Col Ferret into Switzerland.", distanceKm: 38, elevationGainM: 2200, routeNotes: "Grand Col Ferret (2537 m) is the Swiss border. Trail quality excellent — mostly runnable.", komootTourId: null, alternatives: null },
      { id: "3-d4", dayNumber: 4, title: "Champex-Lac → Vallorcine", description: "Through Swiss forest and fields, over Col de la Forclaz and back into France.", distanceKm: 30, elevationGainM: 1800, routeNotes: "Col de la Forclaz (1526 m). Trient village has good café for mid-run stop.", komootTourId: null, alternatives: null },
      { id: "3-d5", dayNumber: 5, title: "Vallorcine → Chamonix (finish)", description: "The emotional finale — over Aiguillette des Posettes and descent to Chamonix.", distanceKm: 30, elevationGainM: 1500, routeNotes: "Final descent into Chamonix is along the main UTMB finish chute. Lac Blanc shortcut available for extra elevation.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "4",
    title: "Kalymnos Sport Climbing",
    description: "World-class limestone sport climbing on the Aegean island — thousands of routes from 5a to 9a.",
    region: "Aegean Islands, Greece",
    activityType: "climbing",
    durationDays: 10,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "4-d1", dayNumber: 1, title: "Arrival & Masouri warmup — Poets sector", description: "Fly to Kos, ferry to Kalymnos. Afternoon warmup on the accessible Poets sector above Masouri village.", distanceKm: null, elevationGainM: null, routeNotes: "Poets sector: 3-min walk from Masouri. Grades 5a–6c. Good for fingers-on warm-up.", komootTourId: null, alternatives: null },
      { id: "4-d2", dayNumber: 2, title: "Arhi sector", description: "Classic Kalymnos limestone on long vertical walls. Multiple 30 m pitches.", distanceKm: null, elevationGainM: null, routeNotes: "20-min walk from Masouri. Grades 6a–8a. Best light: morning.", komootTourId: null, alternatives: null },
      { id: "4-d3", dayNumber: 3, title: "Grande Grotta", description: "The most famous sector — massive cave with some of the best steep climbing in the world.", distanceKm: null, elevationGainM: null, routeNotes: "30-min walk. Grades 7a–9a. Shade all day. Bring extra draws (25+ clips on some routes).", komootTourId: null, alternatives: null },
      { id: "4-d4", dayNumber: 4, title: "Rest day — boat trip & snorkelling", description: "Active rest day — boat to nearby sea caves and snorkelling in crystal-clear Aegean water.", distanceKm: null, elevationGainM: null, routeNotes: "Boats depart from Myrties port. Half-day tours available.", komootTourId: null, alternatives: null },
      { id: "4-d5", dayNumber: 5, title: "Spartacus & Panorama sectors", description: "Two neighbouring sectors offering sustained climbing on perfect grey limestone.", distanceKm: null, elevationGainM: null, routeNotes: "Access via Emporios village road. Grades 5c–8b. Panorama has sea views.", komootTourId: null, alternatives: null },
      { id: "4-d6", dayNumber: 6, title: "Odyssey sector", description: "Long multi-pitch routes on a large south-facing wall — a day for big efforts.", distanceKm: null, elevationGainM: null, routeNotes: "40-min walk from Masouri. Grades 6b–8c. Afternoon shade from 15:00.", komootTourId: null, alternatives: null },
      { id: "4-d7", dayNumber: 7, title: "Sikati Cave", description: "Deep cave climbing in one of the world's most atmospheric crags.", distanceKm: null, elevationGainM: null, routeNotes: "Drive to Vathí then 40-min walk. Grades 6c–8c. Very overhung — forearm pump guaranteed.", komootTourId: null, alternatives: null },
      { id: "4-d8", dayNumber: 8, title: "Rest day — Telendos island", description: "Ferry to tiny Telendos island for relaxed cragging on quieter sectors.", distanceKm: null, elevationGainM: null, routeNotes: "5-min ferry from Myrties. Grades 5b–7c. Far fewer crowds than Kalymnos main.", komootTourId: null, alternatives: null },
      { id: "4-d9", dayNumber: 9, title: "Ghost Kitchen & Summer Breeze sectors", description: "Vertical crimping on sustained wall routes — a good test for the trip's final hard day.", distanceKm: null, elevationGainM: null, routeNotes: "Adjacent to Masouri — 10-min walk. Grades 6a–8b.", komootTourId: null, alternatives: null },
      { id: "4-d10", dayNumber: 10, title: "Final morning & departure", description: "Easy morning on Poets, then ferry to Kos for evening flight home.", distanceKm: null, elevationGainM: null, routeNotes: "Ferry Kalymnos → Kos at 14:30 and 17:00. Book in advance in high season.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "5",
    title: "Finale Ligure Enduro",
    description: "Loamy singletrack, stone-slab tech sections, sea views — Europe's best enduro destination.",
    region: "Ligurian Riviera, Italy",
    activityType: "mtb",
    durationDays: 5,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "5-d1", dayNumber: 1, title: "Arrival & Finale Ligure town trail", description: "Check in and warm up on the classic EWS-used Penya Blanca trail above the medieval town.", distanceKm: 25, elevationGainM: 900, routeNotes: "Shuttle from Finale Ligure to Calizzano. Penya Blanca: iconic stone slabs and loamy corners.", komootTourId: null, alternatives: null },
      { id: "5-d2", dayNumber: 2, title: "Bric Pianarella full descent", description: "Biggest vertical day — shuttle to the top for the full 1400 m Pianarella descent.", distanceKm: 35, elevationGainM: 1600, routeNotes: "Shuttle service from Ristorante del Cacciatore. Descent is technical — exposed roots and rock rolls mid-section.", komootTourId: null, alternatives: null },
      { id: "5-d3", dayNumber: 3, title: "Turchino & Manie plateau", description: "High plateau riding with sea views, followed by the technical Turchino descent.", distanceKm: 40, elevationGainM: 1500, routeNotes: "Manie plateau accessible by e-bike shuttle or full pedal. Some sections of exposed limestone slab.", komootTourId: null, alternatives: null },
      { id: "5-d4", dayNumber: 4, title: "Spotorno & Noli coastal trails", description: "Explore the lesser-known coastal trails above Spotorno with Med views all day.", distanceKm: 38, elevationGainM: 1400, routeNotes: "Trails here are quieter and more natural than Finale proper. Good for a change of pace.", komootTourId: null, alternatives: null },
      { id: "5-d5", dayNumber: 5, title: "Cipressa & last laps before departure", description: "Classic local loop on the Cipressa ridge — same road as the Milan–San Remo classic.", distanceKm: 30, elevationGainM: 900, routeNotes: "Early start recommended. Airport transfer from Genova airport (1 hr away).", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "6",
    title: "Verbier Freeride Week",
    description: "Off-piste skiing in the 4 Vallées — Mont Fort descents, Tortin chutes, glacier runs.",
    region: "Valais Alps, Switzerland",
    activityType: "skiing",
    durationDays: 6,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "6-d1", dayNumber: 1, title: "Arrival & on-piste warmup", description: "Arrive to Verbier and take a lap of the pisted terrain to get your ski legs back.", distanceKm: null, elevationGainM: 1200, routeNotes: "Mont Fort cable car gives access to 3300 m. Rent gear from Ski Service Bruchez.", komootTourId: null, alternatives: null },
      { id: "6-d2", dayNumber: 2, title: "Mont Fort North Face", description: "The iconic off-piste runs from the summit of Mont Fort (3330 m) — steep, sustained, serious.", distanceKm: null, elevationGainM: 2000, routeNotes: "Hire a guide — mandatory for first visit. Snow stability check required. Top cable car closes in high wind.", komootTourId: null, alternatives: null },
      { id: "6-d3", dayNumber: 3, title: "Tortin chutes & Chassoure couloirs", description: "The Tortin mogul field and steep Chassoure chutes — freeride terrain at its best.", distanceKm: null, elevationGainM: 1800, routeNotes: "Access via Attelas. Couloirs need minimum 50 cm base. Very exposed — check avy forecast.", komootTourId: null, alternatives: null },
      { id: "6-d4", dayNumber: 4, title: "Nendaz & Veysonnaz — valley link", description: "Link across to Nendaz and Veysonnaz for a change of terrain and quieter slopes.", distanceKm: null, elevationGainM: 1600, routeNotes: "4 Vallées pass required. Nendaz has some of the best natural snow in the region.", komootTourId: null, alternatives: null },
      { id: "6-d5", dayNumber: 5, title: "Glacier du Mont Fort", description: "Ski the glacial terrain above Lac des Vaux — high alpine powder on a good snow day.", distanceKm: null, elevationGainM: 2200, routeNotes: "Guide required for glacier. Crevasse risk — rope-up protocol in place.", komootTourId: null, alternatives: null },
      { id: "6-d6", dayNumber: 6, title: "Final laps & departure", description: "Morning laps on favourite terrain before ski return and transfer to Geneva airport.", distanceKm: null, elevationGainM: 800, routeNotes: "Geneva airport transfer 2 hrs — allow buffer. Last lift at 16:30.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "7",
    title: "Sistiana Gravel Loop",
    description: "Rolling karst plateau routes connecting the Adriatic coast to Slovenian wine country.",
    region: "Karst Plateau, Slovenia",
    activityType: "cycling",
    durationDays: 4,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "7-d1", dayNumber: 1, title: "Trieste → Lipica & Stanjel", description: "Climb from the Adriatic coast up to the Karst plateau through vineyards to the medieval village of Stanjel.", distanceKm: 60, elevationGainM: 850, routeNotes: "Mix of quiet tarmac and hard-pack gravel. Lipica stud farm worth a stop — home of the Lipizzaner horses.", komootTourId: null, alternatives: null },
      { id: "7-d2", dayNumber: 2, title: "Vipava Valley vineyards", description: "Drop into the wine-growing Vipava Valley — rolling gravel roads between family wineries.", distanceKm: 65, elevationGainM: 900, routeNotes: "Wind can be strong in the valley (Burja/Bora). Gravel roads well-maintained. Stop at Guerila winery.", komootTourId: null, alternatives: null },
      { id: "7-d3", dayNumber: 3, title: "Nanos plateau & Predjama Castle", description: "Climb to the Nanos plateau (1262 m) for expansive views, then descend to the remarkable castle-in-a-cave.", distanceKm: 70, elevationGainM: 1100, routeNotes: "Nanos climb is 15 km at 5%. Predjama Castle is a UNESCO candidate site — free entry to grounds.", komootTourId: null, alternatives: null },
      { id: "7-d4", dayNumber: 4, title: "Škocjan Caves & return to coast", description: "Morning visit to Škocjan Caves (UNESCO), then gravel descent back to the Adriatic.", distanceKm: 55, elevationGainM: 600, routeNotes: "Škocjan Caves tours run every hour — book ahead. Final descent on quiet back roads to Duino.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "8",
    title: "Peaks of the Balkans",
    description: "Remote multi-day traverse through Albania, Kosovo, and Montenegro on rugged mountain trails.",
    region: "Prokletije, Albania",
    activityType: "hiking",
    durationDays: 10,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "8-d1", dayNumber: 1, title: "Theth (Albania) → Valbona Pass", description: "Cross the dramatic Valbona Pass (1793 m) from the Albanian Alps village of Theth.", distanceKm: 18, elevationGainM: 1100, routeNotes: "Guesthouses in Theth — basic but welcoming. Guide optional but recommended for first-timers.", komootTourId: null, alternatives: null },
      { id: "8-d2", dayNumber: 2, title: "Valbona → Çerem", description: "Walk the famous Valbona Valley, one of Albania's most scenic alpine corridors.", distanceKm: 19, elevationGainM: 850, routeNotes: "Trail is well-marked. Water from streams. Çerem has a small guesthouse.", komootTourId: null, alternatives: null },
      { id: "8-d3", dayNumber: 3, title: "Çerem → Dobërdol (Kosovo border)", description: "Remote high-alpine stage with the Kosovo border crossing at Qafa e Pejës.", distanceKm: 22, elevationGainM: 1300, routeNotes: "Passport required for the Albania–Kosovo crossing. Passport control is informal but present.", komootTourId: null, alternatives: null },
      { id: "8-d4", dayNumber: 4, title: "Dobërdol → Gjeravica summit attempt", description: "Optional summit day on Gjeravica (2656 m) — Kosovo's highest peak.", distanceKm: 16, elevationGainM: 1400, routeNotes: "Summit is non-technical but remote. Snow possible until June. Return to Dobërdol guesthouse.", komootTourId: null, alternatives: null },
      { id: "8-d5", dayNumber: 5, title: "Dobërdol → Peć (Peja), Kosovo", description: "Descend to the city of Peć (Peja) — time to resupply and visit the Patriarchate monastery.", distanceKm: 20, elevationGainM: 400, routeNotes: "Peć has full services — laundry, resupply, restaurant. Hotel options available.", komootTourId: null, alternatives: null },
      { id: "8-d6", dayNumber: 6, title: "Peć → Plav (Montenegro border)", description: "Cross into Montenegro through the Prokletije wilderness — dramatic limestone scenery.", distanceKm: 24, elevationGainM: 1500, routeNotes: "Kosovo–Montenegro crossing at Qafa e Prushit. Confirm passport requirements before departure.", komootTourId: null, alternatives: null },
      { id: "8-d7", dayNumber: 7, title: "Plav → Gusinje, Montenegro", description: "Walk the shores of Lake Plav — a glacial lake set against snow-capped peaks.", distanceKm: 18, elevationGainM: 700, routeNotes: "Well-marked trail. Lake Plav is stunning at dawn. Gusinje has good guesthouses.", komootTourId: null, alternatives: null },
      { id: "8-d8", dayNumber: 8, title: "Gusinje → Vermosh (Albania)", description: "Cross back into Albania on a high ridge walk with views of all three countries.", distanceKm: 21, elevationGainM: 1200, routeNotes: "Third border crossing — verify requirements. Vermosh is the most remote village on the route.", komootTourId: null, alternatives: null },
      { id: "8-d9", dayNumber: 9, title: "Vermosh → Lepushë", description: "High ridge traverse with breathtaking views — arguably the most scenic day of the route.", distanceKm: 20, elevationGainM: 1100, routeNotes: "Exposed ridge — start early if weather unstable. Lepushë guesthouse is excellent.", komootTourId: null, alternatives: null },
      { id: "8-d10", dayNumber: 10, title: "Lepushë → Theth (finish)", description: "Final stage back to Theth — completing the full loop through three countries.", distanceKm: 19, elevationGainM: 950, routeNotes: "Descend via Qafa e Thorës. Celebratory raki at the Theth guesthouse.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "9",
    title: "Aiguilles Rouges Traverse",
    description: "Technical alpine ridge running above Chamonix with jaw-dropping views of Mont Blanc.",
    region: "French Alps, France",
    activityType: "trail_running",
    durationDays: 3,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "9-d1", dayNumber: 1, title: "Chamonix → Lac Blanc (high route)", description: "Gain altitude fast from Chamonix to the iconic Lac Blanc (2352 m) with direct views of the Mont Blanc massif.", distanceKm: 28, elevationGainM: 2000, routeNotes: "Start from Les Praz téléphérique or run from town. Trail is rocky and exposed above 2000 m. Check weather before departure.", komootTourId: null, alternatives: null },
      { id: "9-d2", dayNumber: 2, title: "Aiguilles Rouges ridge traverse", description: "The full ridge traverse from Lac Blanc to Col des Montets — technical, exposed, extraordinary.", distanceKm: 32, elevationGainM: 2200, routeNotes: "Cairned route. Hands needed in places. Snow patches likely until July. Emergency descent via Lacs des Chéserys.", komootTourId: null, alternatives: null },
      { id: "9-d3", dayNumber: 3, title: "Vallorcine → Chamonix via Posettes", description: "Final ridge run on the Aiguillette des Posettes with panoramic finish back into Chamonix.", distanceKm: 30, elevationGainM: 1500, routeNotes: "Aiguillette des Posettes (2201 m) is fully runnable. Descent is the UTMB finish route.", komootTourId: null, alternatives: null },
    ],
  },
  {
    id: "10",
    title: "Fontainebleau Bouldering",
    description: "The world's best bouldering forest — thousands of sandstone problems across all grades.",
    region: "Île-de-France, France",
    activityType: "climbing",
    durationDays: 3,
    startDate: null,
    isSaved: false,
    createdAt: "2026-01-01",
    adventure_days: [
      { id: "10-d1", dayNumber: 1, title: "Bas Cuvier & Isatis — circuit orange/blue", description: "Classic Fontainebleau sectors for intermediate climbers — perfect sandstone, variety of styles.", distanceKm: null, elevationGainM: null, routeNotes: "Train from Paris Gare de Lyon (40 min) to Fontainebleau-Avon. Bus or bike hire to forest. Coloured circuits: orange (5–6a), blue (5b–6b), red (6a–7a).", komootTourId: null, alternatives: null },
      { id: "10-d2", dayNumber: 2, title: "Rocher Canon & Cul de Chien — red/black circuit", description: "Harder sectors with longer problems on steeper walls. Cul de Chien is famous for slopers and high-balls.", distanceKm: null, elevationGainM: null, routeNotes: "Car or taxi recommended for Cul de Chien. Bring a big pad and a spotter — high-ball problems up to 5 m.", komootTourId: null, alternatives: null },
      { id: "10-d3", dayNumber: 3, title: "Cuvier Rempart & 95.2 — project day", description: "Cuvier Rempart hosts some of Font's most iconic hard problems including classic 7a and 7b benchmarks.", distanceKm: null, elevationGainM: null, routeNotes: "Morning conditions best — avoid midday heat. 95.2 sector for hard 7b+ projects. Last train back 22:00.", komootTourId: null, alternatives: null },
    ],
  },
  // ── Original mock trips ───────────────────────────────────────────────────────
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
      { id: "mock-3-d1", dayNumber: 1, title: "Les Houches to Les Contamines", description: "Start at Les Houches, ascend Col de Voza (1653 m) for first views of Mont Blanc.", distanceKm: 18, elevationGainM: 950, routeNotes: "Départ: Les Houches, Haute-Savoie, France", komootTourId: null, alternatives: null },
      { id: "mock-3-d2", dayNumber: 2, title: "Col du Bonhomme", description: "A long day over Col du Bonhomme (2329 m) and Col de la Croix du Bonhomme (2483 m).", distanceKm: 21, elevationGainM: 1450, routeNotes: "Col du Bonhomme, Beaufortain, France", komootTourId: null, alternatives: null },
      { id: "mock-3-d3", dayNumber: 3, title: "Courmayeur, Italy", description: "Cross into Italy via Col de la Seigne (2516 m) with stunning views of the Italian face of Mont Blanc.", distanceKm: 23, elevationGainM: 1200, routeNotes: "Courmayeur, Valle d'Aosta, Italy", komootTourId: null, alternatives: null },
      { id: "mock-3-d4", dayNumber: 4, title: "Rifugio Bonatti", description: "A highlight stage along Val Ferret with magnificent views of the Grandes Jorasses.", distanceKm: 17, elevationGainM: 880, routeNotes: "Rifugio Bonatti, Courmayeur, Italy", komootTourId: null, alternatives: null },
      { id: "mock-3-d5", dayNumber: 5, title: "Grand Col Ferret & Switzerland", description: "Cross into Switzerland at Grand Col Ferret (2537 m).", distanceKm: 19, elevationGainM: 950, routeNotes: "Grand Col Ferret, La Fouly, Switzerland", komootTourId: null, alternatives: null },
      { id: "mock-3-d6", dayNumber: 6, title: "Champex-Lac", description: "Gentle valley walking to the charming alpine lake village of Champex-Lac.", distanceKm: 15, elevationGainM: 620, routeNotes: "Champex-Lac, Canton of Valais, Switzerland", komootTourId: null, alternatives: null },
      { id: "mock-3-d7", dayNumber: 7, title: "Col de la Forclaz", description: "Climb to Col de la Forclaz (1526 m) and continue to Trient.", distanceKm: 16, elevationGainM: 800, routeNotes: "Col de la Forclaz, Trient, Switzerland", komootTourId: null, alternatives: null },
      { id: "mock-3-d8", dayNumber: 8, title: "Aiguillette des Posettes", description: "Re-enter France and tackle the rewarding Aiguillette des Posettes ridge.", distanceKm: 20, elevationGainM: 1100, routeNotes: "Le Tour, Chamonix-Mont-Blanc, France", komootTourId: null, alternatives: null },
      { id: "mock-3-d9", dayNumber: 9, title: "Lac Blanc", description: "The iconic Lac Blanc stage with unmatched views of the Mont Blanc massif.", distanceKm: 14, elevationGainM: 1050, routeNotes: "Réserve naturelle des Aiguilles Rouges, Chamonix", komootTourId: null, alternatives: null },
      { id: "mock-3-d10", dayNumber: 10, title: "Return to Les Houches", description: "The final descent back to Les Houches completing the full circuit.", distanceKm: 12, elevationGainM: 400, routeNotes: "Les Houches, Haute-Savoie, France", komootTourId: null, alternatives: null },
    ],
  },
];

// ─── Per-trip metadata ────────────────────────────────────────────────────────

export const MOCK_TRIP_META: Record<string, TripMeta> = {
  // ── Explore adventures ───────────────────────────────────────────────────────
  "1": {
    coords: [2.89, 39.74],
    dayCoords: { 1: [2.72, 39.77], 2: [2.80, 39.85], 3: [2.77, 39.81], 4: [3.13, 39.96], 5: [3.09, 39.87], 6: [2.89, 39.83], 7: [2.65, 39.57] },
    accommodation: "Various hotels, Mallorca", accommodationCoords: [2.65, 39.57],
    pricePerNight: 110, nights: "All 7 nights",
    restaurants: [
      { name: "Simply Fosh", cuisine: "Mediterranean", coords: [2.648, 39.571], night: 1, priceRange: "$$$" },
      { name: "Ca Na Toneta", cuisine: "Mallorcan", coords: [2.889, 39.793], night: 3, priceRange: "$$" },
    ],
    bookings: [],
  },
  "2": {
    coords: [12.10, 46.52],
    dayCoords: { 1: [12.09, 46.69], 2: [12.00, 46.61], 3: [11.98, 46.52], 4: [12.02, 46.49], 5: [12.13, 46.41], 6: [12.22, 46.37], 7: [12.27, 46.30], 8: [12.22, 46.14] },
    accommodation: "Mountain refuges, Dolomites", accommodationCoords: [12.09, 46.69],
    pricePerNight: 45, nights: "Rifugios all 8 nights",
    restaurants: [
      { name: "Rifugio Lagazuoi", cuisine: "Italian mountain", coords: [11.98, 46.52], night: 3, priceRange: "$" },
      { name: "Rifugio Nuvolau", cuisine: "Italian mountain", coords: [12.02, 46.49], night: 4, priceRange: "$" },
    ],
    bookings: [],
  },
  "3": {
    coords: [6.90, 45.87],
    dayCoords: { 1: [6.73, 45.82], 2: [7.00, 45.80], 3: [7.12, 45.87], 4: [7.02, 45.97], 5: [6.87, 45.92] },
    accommodation: "Chamonix hotels", accommodationCoords: [6.87, 45.92],
    pricePerNight: 120, nights: "All 5 nights in Chamonix",
    restaurants: [
      { name: "MBC Micro Brasserie", cuisine: "Burgers & beer", coords: [6.869, 45.924], night: 1, priceRange: "$$" },
    ],
    bookings: [],
  },
  "4": {
    coords: [26.98, 37.05],
    dayCoords: { 1: [26.98, 37.05], 2: [26.97, 37.06], 3: [26.96, 37.04], 4: [26.98, 37.03], 5: [26.99, 37.07], 6: [26.97, 37.05], 7: [26.95, 37.06], 8: [27.12, 37.10], 9: [26.98, 37.06], 10: [26.98, 37.05] },
    accommodation: "Studios, Masouri village", accommodationCoords: [26.984, 37.057],
    pricePerNight: 50, nights: "All 10 nights",
    restaurants: [
      { name: "Drakos Taverna", cuisine: "Greek", coords: [26.982, 37.056], night: 1, priceRange: "$" },
      { name: "To Kyma", cuisine: "Seafood", coords: [26.986, 37.055], night: 5, priceRange: "$$" },
    ],
    bookings: [],
  },
  "5": {
    coords: [8.34, 44.17],
    dayCoords: { 1: [8.34, 44.17], 2: [8.33, 44.19], 3: [8.31, 44.21], 4: [8.46, 44.14], 5: [8.34, 44.17] },
    accommodation: "Hotel Florenz, Finale Ligure", accommodationCoords: [8.340, 44.168],
    pricePerNight: 80, nights: "All 5 nights",
    restaurants: [
      { name: "Osteria dei Cento Fiori", cuisine: "Italian", coords: [8.341, 44.170], night: 1, priceRange: "$$" },
    ],
    bookings: [],
  },
  "6": {
    coords: [7.23, 46.10],
    dayCoords: { 1: [7.23, 46.10], 2: [7.21, 46.09], 3: [7.25, 46.08], 4: [7.32, 46.14], 5: [7.22, 46.11], 6: [7.23, 46.10] },
    accommodation: "Chalet hotel, Verbier", accommodationCoords: [7.228, 46.096],
    pricePerNight: 280, nights: "All 6 nights",
    restaurants: [
      { name: "La Grange", cuisine: "Swiss Alpine", coords: [7.229, 46.097], night: 1, priceRange: "$$$" },
      { name: "Le Fer à Cheval", cuisine: "Fondue", coords: [7.227, 46.095], night: 3, priceRange: "$$" },
    ],
    bookings: [],
  },
  "7": {
    coords: [13.85, 45.77],
    dayCoords: { 1: [13.61, 45.71], 2: [13.85, 45.84], 3: [14.19, 45.82], 4: [13.97, 45.69] },
    accommodation: "Agriturismo, Karst plateau", accommodationCoords: [13.85, 45.78],
    pricePerNight: 65, nights: "All 4 nights",
    restaurants: [
      { name: "Osmiza Zidarič", cuisine: "Karst wine & food", coords: [13.86, 45.80], night: 1, priceRange: "$" },
    ],
    bookings: [],
  },
  "8": {
    coords: [20.05, 42.46],
    dayCoords: { 1: [19.82, 42.38], 2: [19.92, 42.42], 3: [20.07, 42.47], 4: [20.10, 42.51], 5: [20.28, 42.66], 6: [20.12, 42.58], 7: [19.92, 42.57], 8: [19.82, 42.51], 9: [19.74, 42.44], 10: [19.82, 42.38] },
    accommodation: "Local guesthouses", accommodationCoords: [19.82, 42.38],
    pricePerNight: 25, nights: "Guesthouses all nights",
    restaurants: [
      { name: "Theth guesthouse", cuisine: "Albanian", coords: [19.82, 42.38], night: 1, priceRange: "$" },
    ],
    bookings: [],
  },
  "9": {
    coords: [6.88, 45.95],
    dayCoords: { 1: [6.87, 45.92], 2: [6.82, 45.98], 3: [6.93, 46.01] },
    accommodation: "Hotel Alpina, Chamonix", accommodationCoords: [6.869, 45.924],
    pricePerNight: 130, nights: "All 3 nights",
    restaurants: [
      { name: "Le Passon", cuisine: "Savoyard", coords: [6.870, 45.925], night: 1, priceRange: "$$" },
    ],
    bookings: [],
  },
  "10": {
    coords: [2.67, 48.40],
    dayCoords: { 1: [2.63, 48.42], 2: [2.71, 48.39], 3: [2.66, 48.41] },
    accommodation: "Hôtel de Londres, Fontainebleau", accommodationCoords: [2.702, 48.402],
    pricePerNight: 95, nights: "All 3 nights",
    restaurants: [
      { name: "L'Axel", cuisine: "French bistro", coords: [2.701, 48.403], night: 1, priceRange: "$$" },
    ],
    bookings: [],
  },
  // ── Original mock trips ───────────────────────────────────────────────────────
  "mock-1": {
    coords: [150.31, -33.68],
    dayCoords: {
      1: [150.31, -33.64],
      2: [150.32, -33.73],
      3: [150.38, -33.72],
    },
    accommodation: "Blue Mountains YHA",
    accommodationCoords: [150.312, -33.715],
    pricePerNight: 45,
    nights: "All 3 nights",
    restaurants: [
      { name: "Silk's Brasserie", cuisine: "Modern Australian", coords: [150.335, -33.718], night: 1, priceRange: "$$" },
      { name: "Arco Dining", cuisine: "Contemporary", coords: [150.314, -33.729], night: 2, priceRange: "$$" },
      { name: "Conservation Hut Café", cuisine: "Café", coords: [150.375, -33.718], night: 3, priceRange: "$" },
    ],
    bookings: [
      { type: "train", title: "Sydney Central → Katoomba", ref: "NSW-8821", date: "14 Jun 2026", price: 22, currency: "AUD" },
      { type: "hotel", title: "Blue Mountains YHA — 3 nights", ref: "BM-YHA-442", date: "14–17 Jun 2026", price: 135, currency: "AUD" },
      { type: "activity", title: "Heritage Centre Guided Walk", ref: "HWC-009", date: "14 Jun 2026", price: 0, currency: "AUD" },
      { type: "train", title: "Katoomba → Sydney Central", ref: "NSW-8934", date: "17 Jun 2026", price: 22, currency: "AUD" },
    ],
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
    accommodationCoords: [2.628, 39.553],
    pricePerNight: 120,
    nights: "All 5 nights",
    restaurants: [
      { name: "Simply Fosh", cuisine: "Mediterranean Fine Dining", coords: [2.648, 39.571], night: 1, priceRange: "$$$" },
      { name: "Ca Na Toneta", cuisine: "Traditional Mallorcan", coords: [2.889, 39.793], night: 2, priceRange: "$$" },
      { name: "Es Canto", cuisine: "Seafood", coords: [2.795, 39.796], night: 3, priceRange: "$$" },
      { name: "Stay", cuisine: "International", coords: [3.083, 39.905], night: 4, priceRange: "$$$" },
    ],
    bookings: [
      { type: "flight", title: "London LGW → Palma PMI", ref: "VY1234", date: "10 May 2026", price: 180, currency: "EUR" },
      { type: "hotel", title: "Hotel Bon Sol — 5 nights", ref: "BS-202605", date: "10–15 May 2026", price: 600, currency: "EUR" },
      { type: "car", title: "Bike rental — Trek Émonda SL6", ref: "BIKE-ML-88", date: "10 May 2026", price: 125, currency: "EUR" },
      { type: "flight", title: "Palma PMI → London LGW", ref: "VY5678", date: "15 May 2026", price: 165, currency: "EUR" },
    ],
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
    accommodationCoords: [6.735, 45.674],
    pricePerNight: 35,
    nights: "Refuges booked for all nights",
    restaurants: [
      { name: "Refuge Nant Borrant", cuisine: "Mountain Hut", coords: [6.752, 45.731], night: 1, priceRange: "$" },
      { name: "Rifugio Bertone", cuisine: "Italian Mountain", coords: [6.970, 45.793], night: 3, priceRange: "$" },
      { name: "Rifugio Bonatti", cuisine: "Italian Mountain", coords: [7.072, 45.832], night: 4, priceRange: "$" },
      { name: "Auberge La Boerne", cuisine: "Swiss", coords: [7.125, 45.876], night: 5, priceRange: "$$" },
    ],
    bookings: [
      { type: "flight", title: "London LHR → Geneva GVA", ref: "LX1234", date: "1 Sep 2025", price: 210, currency: "CHF" },
      { type: "train", title: "Geneva → Les Houches (via Chamonix)", ref: "SNCF-7731", date: "1 Sep 2025", price: 42, currency: "EUR" },
      { type: "hotel", title: "Refuge bookings — 10 nights", ref: "TMB-REF-2025", date: "1–11 Sep 2025", price: 350, currency: "EUR" },
      { type: "train", title: "Les Houches → Geneva", ref: "SNCF-8820", date: "11 Sep 2025", price: 42, currency: "EUR" },
      { type: "flight", title: "Geneva GVA → London LHR", ref: "LX5678", date: "11 Sep 2025", price: 195, currency: "CHF" },
    ],
  },
};
