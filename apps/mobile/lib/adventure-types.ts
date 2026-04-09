// Mirrors apps/web/lib/agent/adventure-agent.ts types

export interface AdventureDayPlan {
  day_number: number;
  title: string;
  description: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  route_notes: string;
  end_location: string;
  pois: unknown[];
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

export interface RouteAlternative {
  title: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  difficulty: "easy" | "moderate" | "hard";
  description: string;
  end_location: string;
}

export interface DayAlternatives {
  routes: RouteAlternative[];
}

export type DayAlternativesMap = Record<string, DayAlternatives>;

export interface AccommodationOption {
  name: string;
  type: "camping" | "hostel" | "hotel" | "guesthouse" | "luxury";
  price_range: "budget" | "mid" | "luxury";
  price_per_night_eur: number | null;
  description: string;
}

export interface AccommodationStop {
  location: string;
  night_numbers: number[];
  notes: string;
  options: AccommodationOption[];
}

// ─── Rich option tiles ────────────────────────────────────────────────────────

export type RichOptionCategory = "route" | "accommodation" | "restaurant";

export interface RichOption {
  title: string;
  subtitle?: string;
  description?: string;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  difficulty?: "easy" | "moderate" | "hard";
  accommodation_type?: "camping" | "hostel" | "hotel" | "guesthouse" | "luxury";
  price_per_night_eur?: number | null;
  price_range?: string;
  image_seed?: string;
  komoot_url?: string;
  // Restaurant-specific
  website_url?: string;
  thefork_url?: string;
  thefork_restaurant_id?: string;
  accepts_reservations?: boolean;
  cuisine?: string;
  google_maps_url?: string;
}

export interface RichOptionsMsg {
  id: string;
  kind: "rich_options";
  text: string;
  category: RichOptionCategory;
  options: RichOption[];
  footer_options?: string[];
}
