import { SupabaseClient } from "@supabase/supabase-js";

// ─── Tool input types ────────────────────────────────────────────────────────

export interface SearchPOIsInput {
  region: string;
  categories?: string[];
  activity_types?: string[];
  min_rating?: number;
  limit?: number;
}

export interface GetPOIRatingsInput {
  poi_id: string;
}

export interface SearchRoutesInput {
  region: string;
  activity_type: string;
  max_distance_km?: number;
  max_difficulty?: number;
  limit?: number;
}

export interface GetUserPreferencesInput {
  user_id: string;
}

// ─── Tool result types ───────────────────────────────────────────────────────

export interface POISummary {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  average_rating: number | null;
  review_count: number;
  activity_types: string[];
}

export interface POIRatingDetail {
  poi_id: string;
  name: string;
  category: string;
  average_rating: number | null;
  review_count: number;
  would_recommend_pct: number | null;
  top_pros: string[];
  top_cons: string[];
  attribute_averages: Record<string, number>;
  recent_reviews: Array<{
    rating: number;
    body: string | null;
    visited_at: string;
  }>;
}

export interface RouteSummary {
  stage_id: string;
  trip_title: string;
  stage_title: string;
  date: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  average_rating: number | null;
  average_difficulty: number | null;
  average_scenery: number | null;
  review_count: number;
  route_gpx_url: string | null;
}

export interface UserPreferences {
  fitness_level: string;
  preferred_activity_types: string[];
  preferred_daily_distance_km: number | null;
  preferred_daily_elevation_m: number | null;
  accommodation_preference: string;
  group_size: number;
  dietary_notes: string | null;
  other_notes: string | null;
}

// ─── Tool implementations ────────────────────────────────────────────────────

export async function searchPOIsByRegion(
  db: SupabaseClient,
  input: SearchPOIsInput
): Promise<POISummary[]> {
  const limit = input.limit ?? 20;

  let query = db
    .from("pois")
    .select(
      `
      id, name, category, lat, lng, address, website, "activityTypes",
      reviews(rating, "wouldRecommend")
    `
    )
    .ilike("address", `%${input.region}%`)
    .limit(limit);

  if (input.categories && input.categories.length > 0) {
    query = query.in("category", input.categories);
  }

  const { data, error } = await query;
  if (error) throw new Error(`searchPOIsByRegion failed: ${error.message}`);

  return (data ?? []).map((poi) => {
    const reviews: Array<{ rating: number }> = poi.reviews ?? [];
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
          reviews.length
        : null;

    return {
      id: poi.id,
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lng: poi.lng,
      address: poi.address,
      website: poi.website,
      average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      review_count: reviews.length,
      activity_types: poi.activityTypes ?? [],
    };
  });
}

export async function getPOIRatings(
  db: SupabaseClient,
  input: GetPOIRatingsInput
): Promise<POIRatingDetail> {
  const { data: poi, error: poiError } = await db
    .from("pois")
    .select("id, name, category")
    .eq("id", input.poi_id)
    .single();

  if (poiError || !poi)
    throw new Error(`POI not found: ${input.poi_id}`);

  const { data: reviews, error: reviewError } = await db
    .from("reviews")
    .select(`rating, "wouldRecommend", pros, cons, body, "visitedAt", attributes`)
    .eq("poiId", input.poi_id)
    .order('"createdAt"', { ascending: false })
    .limit(50);

  if (reviewError)
    throw new Error(`getPOIRatings failed: ${reviewError.message}`);

  const reviewList = reviews ?? [];
  const avgRating =
    reviewList.length > 0
      ? reviewList.reduce((s: number, r) => s + r.rating, 0) /
        reviewList.length
      : null;

  const recommendCount = reviewList.filter((r) => r.wouldRecommend).length;
  const wouldRecommendPct =
    reviewList.length > 0
      ? Math.round((recommendCount / reviewList.length) * 100)
      : null;

  // Aggregate pros and cons
  const prosFreq: Record<string, number> = {};
  const consFreq: Record<string, number> = {};
  for (const r of reviewList) {
    for (const p of r.pros ?? []) prosFreq[p] = (prosFreq[p] ?? 0) + 1;
    for (const c of r.cons ?? []) consFreq[c] = (consFreq[c] ?? 0) + 1;
  }
  const topPros = Object.entries(prosFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  const topCons = Object.entries(consFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  // Average attribute scores
  const attrSums: Record<string, number> = {};
  const attrCounts: Record<string, number> = {};
  for (const r of reviewList) {
    const attrs = r.attributes ?? {};
    for (const [k, v] of Object.entries(attrs)) {
      if (typeof v === "number") {
        attrSums[k] = (attrSums[k] ?? 0) + v;
        attrCounts[k] = (attrCounts[k] ?? 0) + 1;
      }
    }
  }
  const attrAverages: Record<string, number> = {};
  for (const k of Object.keys(attrSums)) {
    const sum = attrSums[k] ?? 0;
    const count = attrCounts[k] ?? 1;
    attrAverages[k] = Math.round((sum / count) * 10) / 10;
  }

  return {
    poi_id: poi.id,
    name: poi.name,
    category: poi.category,
    average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    review_count: reviewList.length,
    would_recommend_pct: wouldRecommendPct,
    top_pros: topPros,
    top_cons: topCons,
    attribute_averages: attrAverages,
    recent_reviews: reviewList.slice(0, 3).map((r) => ({
      rating: r.rating,
      body: r.body,
      visited_at: r.visitedAt,
    })),
  };
}

export async function searchRoutesByRegion(
  db: SupabaseClient,
  input: SearchRoutesInput
): Promise<RouteSummary[]> {
  const limit = input.limit ?? 15;

  // Find stages from published trips in the region matching the activity type
  const { data, error } = await db
    .from("stages")
    .select(
      `
      id, title, date, "distanceKm", "elevationGainM", "routeGpxUrl",
      trip:trips!inner(title, region, "activityType", "isPublished"),
      stage_reviews(rating, difficulty, scenery)
    `
    )
    .eq("trip.isPublished", true)
    .eq("trip.activityType", input.activity_type)
    .ilike("trip.region", `%${input.region}%`)
    .limit(limit);

  if (error) throw new Error(`searchRoutesByRegion failed: ${error.message}`);

  return (data ?? [])
    .map((stage) => {
      const reviews: Array<{
        rating: number;
        difficulty: number | null;
        scenery: number | null;
      }> = stage.stage_reviews ?? [];

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
          : null;
      const difficulties = reviews
        .map((r) => r.difficulty)
        .filter((d): d is number => d !== null);
      const avgDifficulty =
        difficulties.length > 0
          ? difficulties.reduce((s, d) => s + d, 0) / difficulties.length
          : null;
      const sceneries = reviews
        .map((r) => r.scenery)
        .filter((s): s is number => s !== null);
      const avgScenery =
        sceneries.length > 0
          ? sceneries.reduce((s, d) => s + d, 0) / sceneries.length
          : null;

      if (
        input.max_difficulty &&
        avgDifficulty &&
        avgDifficulty > input.max_difficulty
      ) {
        return null;
      }

      if (
        input.max_distance_km &&
        stage.distanceKm &&
        stage.distanceKm > input.max_distance_km
      ) {
        return null;
      }

      return {
        stage_id: stage.id,
        trip_title: (stage.trip as unknown as { title: string } | null)?.title ?? "",
        stage_title: stage.title,
        date: stage.date,
        distance_km: stage.distanceKm,
        elevation_gain_m: stage.elevationGainM,
        average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        average_difficulty: avgDifficulty
          ? Math.round(avgDifficulty * 10) / 10
          : null,
        average_scenery: avgScenery
          ? Math.round(avgScenery * 10) / 10
          : null,
        review_count: reviews.length,
        route_gpx_url: stage.routeGpxUrl,
      };
    })
    .filter((s): s is RouteSummary => s !== null);
}

export async function getUserPreferences(
  db: SupabaseClient,
  input: GetUserPreferencesInput
): Promise<UserPreferences | null> {
  const { data, error } = await db
    .from("user_adventure_preferences")
    .select("*")
    .eq("userId", input.user_id)
    .single();

  if (error || !data) return null;

  return {
    fitness_level: data.fitnessLevel,
    preferred_activity_types: data.preferredActivityTypes ?? [],
    preferred_daily_distance_km: data.preferredDailyDistanceKm,
    preferred_daily_elevation_m: data.preferredDailyElevationM,
    accommodation_preference: data.accommodationPreference,
    group_size: data.groupSize,
    dietary_notes: data.dietaryNotes,
    other_notes: data.otherNotes,
  };
}

// ─── Tool definitions for Claude ────────────────────────────────────────────

export const ADVENTURE_TOOLS = [
  {
    name: "search_pois_by_region",
    description:
      "Search for points of interest (accommodation, restaurants, cafes, etc.) in a region. " +
      "Returns a list of POIs with average ratings. Use this to find options for accommodation, " +
      "dining spots, and highlights to include in the adventure.",
    input_schema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            "Region name to search within, e.g. 'Dolomites, Italy' or 'Mallorca'",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description:
            "POI categories to filter by: hotel, hostel, campsite, guesthouse, restaurant, cafe, bar, bike_shop, trailhead, viewpoint, other",
        },
        activity_types: {
          type: "array",
          items: { type: "string" },
          description: "Filter by activity compatibility: cycling, hiking, trail_running, skiing, etc.",
        },
        min_rating: {
          type: "number",
          description: "Minimum average rating (1-5) to filter by",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 20)",
        },
      },
      required: ["region"],
    },
  },
  {
    name: "get_poi_ratings",
    description:
      "Get detailed ratings, pros/cons, and attribute scores for a specific POI. " +
      "Use this after finding a POI with search_pois_by_region to get deeper insight before recommending it.",
    input_schema: {
      type: "object",
      properties: {
        poi_id: {
          type: "string",
          description: "The UUID of the POI to fetch ratings for",
        },
      },
      required: ["poi_id"],
    },
  },
  {
    name: "search_routes_by_region",
    description:
      "Search for rated route stages (day rides, hikes, runs) in a region. " +
      "Returns stages from published trips with community ratings for difficulty, scenery, and surface quality. " +
      "Use this to find route options for each day of the adventure.",
    input_schema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Region to search within",
        },
        activity_type: {
          type: "string",
          description: "Activity type: cycling, hiking, trail_running, skiing, snowboarding, kayaking, climbing, other",
        },
        max_distance_km: {
          type: "number",
          description: "Maximum stage distance in km",
        },
        max_difficulty: {
          type: "number",
          description: "Maximum difficulty rating (1-5)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 15)",
        },
      },
      required: ["region", "activity_type"],
    },
  },
  {
    name: "get_user_preferences",
    description:
      "Fetch the user's saved adventure preferences including fitness level, preferred distances, " +
      "accommodation preference, group size, and dietary notes. Use this at the start of generation " +
      "to personalise the adventure.",
    input_schema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "The user's UUID",
        },
      },
      required: ["user_id"],
    },
  },
] as const;
