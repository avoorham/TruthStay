import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding, entryToText } from "@/lib/embeddings";
import type { CuratorConfig, SearchArea } from "./curator-configs";

// ─── Komoot types ─────────────────────────────────────────────────────────────

interface KomootTour {
  id: string;
  name: string;
  type: string;
  sport: string;
  distance: number;        // metres
  duration: number;        // seconds
  elevation_up: number;    // metres
  elevation_down: number;
  difficulty?: { grade: string };
  rating: number;          // 0–5
  _links?: {
    "tour:start_location"?: { href: string };
  };
  _embedded?: {
    "tour:start_location"?: { lat: number; lng: number };
  };
}

interface KomootResponse {
  _embedded?: {
    tours?: KomootTour[];
  };
  page?: { totalElements: number };
}

// ─── Booking.com types ────────────────────────────────────────────────────────

interface BookingHotel {
  hotel_id: number;
  hotel_name: string;
  hotel_description?: string;
  url: string;
  review_score: number;       // 0–10
  review_score_word?: string;
  min_total_price?: number;
  currency_code?: string;
  location: { latitude: number; longitude: number };
}

interface BookingResponse {
  result?: BookingHotel[];
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface CuratorResult {
  routesFound: number;
  accommodationsFound: number;
}

// ─── Komoot fetch ─────────────────────────────────────────────────────────────

async function fetchKomootTours(
  sportType: string,
  area: SearchArea,
  minRating: number,
): Promise<KomootTour[]> {
  const radiusMetres = area.radiusKm * 1000;
  const url = [
    `https://api.komoot.de/v007/tours/`,
    `?type=tour_planned`,
    `&sport_types=${encodeURIComponent(sportType)}`,
    `&page[size]=50`,
    `&center=${area.lat},${area.lng}`,
    `&radius=${radiusMetres}`,
    `&sort_field=rating`,
    `&sort_direction=desc`,
  ].join("");

  let data: KomootResponse;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TruthStay/1.0 curator-agent" },
    });
    if (!res.ok) return [];
    data = (await res.json()) as KomootResponse;
  } catch {
    return [];
  }

  const tours = data._embedded?.tours ?? [];
  return tours.filter(t => typeof t.rating === "number" && t.rating >= minRating);
}

// ─── Booking.com fetch ────────────────────────────────────────────────────────

async function fetchBookingHotels(
  area: SearchArea,
  minScore: number,
): Promise<BookingHotel[]> {
  const apiKey = process.env.BOOKING_API_KEY;
  if (!apiKey) return [];

  // Booking.com Demand API v2.9 — searchHotels
  const params = new URLSearchParams({
    latitude:     String(area.lat),
    longitude:    String(area.lng),
    radius:       String(area.radiusKm),
    units:        "km",
    review_score: String(minScore),
    rows:         "25",
    order_by:     "review_score",
  });

  let data: BookingResponse;
  try {
    const res = await fetch(
      `https://distribution-xml.booking.com/2.9/json/searchHotels?${params}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!res.ok) return [];
    data = (await res.json()) as BookingResponse;
  } catch {
    return [];
  }

  return (data.result ?? []).filter(
    h => typeof h.review_score === "number" && h.review_score >= minScore,
  );
}

// ─── Claude enrichment ────────────────────────────────────────────────────────

const anthropic = new Anthropic();

async function enrichRouteWithClaude(
  tour: KomootTour,
  config: CuratorConfig,
  areaName: string,
): Promise<string> {
  const prompt = `You are a sport-travel content writer for TruthStay, a sport-first adventure platform.

Write a 2–3 sentence description of this ${config.activityType} route for an athlete planning a trip to ${config.region}. Focus on what makes it special: terrain, highlights, difficulty, and why it earns a ${tour.rating}/5 rating. Be specific and concrete. No emojis. No marketing fluff.

Route data:
- Name: ${tour.name}
- Area: ${areaName}
- Distance: ${tour.distance ? `${(tour.distance / 1000).toFixed(1)} km` : "unknown"}
- Elevation gain: ${tour.elevation_up ? `${tour.elevation_up} m` : "unknown"}
- Duration: ${tour.duration ? `${Math.round(tour.duration / 60)} min` : "unknown"}
- Difficulty: ${tour.difficulty?.grade ?? "not rated"}
- Rating: ${tour.rating}/5

Write only the description, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content.find(b => b.type === "text");
    return block?.type === "text" ? block.text.trim() : tour.name;
  } catch {
    return tour.name;
  }
}

// ─── Main curator agent ───────────────────────────────────────────────────────

export async function runCuratorAgent(config: CuratorConfig): Promise<CuratorResult> {
  const db = createAdminClient();
  const affiliateId = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID ?? "";
  let routesFound = 0;
  let accommodationsFound = 0;

  for (const area of config.searchAreas) {
    // ── Routes: Komoot ────────────────────────────────────────────────────────
    const tours = await fetchKomootTours(config.komootSportType, area, config.minKomootRating);
    const topTours = tours.slice(0, Math.ceil(config.targetRouteCount / config.searchAreas.length));

    for (const tour of topTours) {
      const description = await enrichRouteWithClaude(tour, config, area.name);

      const entryData = {
        komootTourId:    tour.id,
        komootUrl:       `https://www.komoot.com/tour/${tour.id}`,
        distanceKm:      tour.distance ? tour.distance / 1000 : null,
        elevationGainM:  tour.elevation_up ?? null,
        durationMinutes: tour.duration ? Math.round(tour.duration / 60) : null,
        difficulty:      tour.difficulty?.grade ?? null,
        externalRating:  tour.rating,
        area:            area.name,
      };

      const contentInput = {
        type:          "route" as const,
        name:          tour.name,
        region:        config.region,
        activity_type: config.activityType,
        description,
        data:          entryData,
      };

      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(entryToText(contentInput));
      } catch { /* non-fatal */ }

      await db.from("content_entries").upsert(
        {
          type:          contentInput.type,
          name:          contentInput.name,
          region:        contentInput.region,
          activity_type: contentInput.activity_type,
          description:   contentInput.description,
          data:          entryData,
          verified:      true,
          upvotes:       1,
          embedding:     embedding ? `[${embedding.join(",")}]` : null,
        },
        { onConflict: "name,region,activity_type" },
      );

      routesFound++;
    }

    // ── Accommodations: Booking.com ───────────────────────────────────────────
    const hotels = await fetchBookingHotels(area, config.minBookingScore);
    const topHotels = hotels.slice(0, Math.ceil(config.targetAccomCount / config.searchAreas.length));

    for (const hotel of topHotels) {
      const bookingUrl = affiliateId
        ? `https://www.booking.com/hotel/${hotel.url}?aid=${affiliateId}`
        : `https://www.booking.com/hotel/${hotel.url}`;

      const accomData = {
        bookingId:        hotel.hotel_id,
        lat:              hotel.location.latitude,
        lng:              hotel.location.longitude,
        reviewScore:      hotel.review_score,
        reviewScoreWord:  hotel.review_score_word ?? null,
        priceFrom:        hotel.min_total_price ?? null,
        currency:         hotel.currency_code ?? "EUR",
        bookingUrl,
        area:             area.name,
      };

      const accomInput = {
        type:          "accommodation" as const,
        name:          hotel.hotel_name,
        region:        config.region,
        activity_type: config.activityType,
        description:   hotel.hotel_description ?? null,
        data:          accomData,
      };

      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(entryToText(accomInput));
      } catch { /* non-fatal */ }

      await db.from("content_entries").upsert(
        {
          type:          accomInput.type,
          name:          accomInput.name,
          region:        accomInput.region,
          activity_type: accomInput.activity_type,
          description:   accomInput.description,
          data:          accomData,
          verified:      true,
          upvotes:       1,
          embedding:     embedding ? `[${embedding.join(",")}]` : null,
        },
        { onConflict: "name,region" },
      );

      accommodationsFound++;
    }
  }

  return { routesFound, accommodationsFound };
}
