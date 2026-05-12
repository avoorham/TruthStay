import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/discovery/place-rating?content_entry_id={id}
//
// Fetches (or serves from 30-day cache) a Google Places rating for a content_entry.
// Uses the existing `place_id` column as the Google stable identifier.
//
// Flow:
//   1. Load the content_entries row.
//   2. If google_rating_fetched_at is within 30 days → return cached values.
//   3. If place_id is known → call Places Details API.
//   4. If place_id is null → call Places Text Search to find the place, then Details.
//   5. Persist google_place_id (place_id), google_rating, google_review_count,
//      google_rating_fetched_at on the row.
//
// Cost: Google Places Text Search ~$0.017/call, Details ~$0.017/call.
// Cache: 30-day TTL prevents repeat charges for the same entry.

const CACHE_TTL_DAYS = 30;
const PLACES_BASE = "https://places.googleapis.com/v1";
const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

type EntryRow = {
  id: string;
  name: string;
  region: string;
  place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_rating_fetched_at: string | null;
};

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not set — configure it in .env.local and Vercel env vars" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const contentEntryId = searchParams.get("content_entry_id");
  if (!contentEntryId) {
    return NextResponse.json({ error: "content_entry_id required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: entry, error: fetchErr } = await db
    .from("content_entries")
    .select("id, name, region, place_id, google_rating, google_review_count, google_rating_fetched_at")
    .eq("id", contentEntryId)
    .maybeSingle();

  if (fetchErr || !entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const row = entry as EntryRow;

  // Serve from cache if fresh
  if (row.google_rating_fetched_at) {
    const fetchedAt = new Date(row.google_rating_fetched_at);
    const ageMs = Date.now() - fetchedAt.getTime();
    if (ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json({
        source: "cache",
        rating: row.google_rating,
        review_count: row.google_review_count,
        place_id: row.place_id,
      });
    }
  }

  // Fetch from Google
  let placeId = row.place_id;
  let rating: number | null = null;
  let reviewCount: number | null = null;

  try {
    if (!placeId) {
      // Text Search to find the place
      const query = `${row.name} ${row.region}`;
      const searchRes = await fetch(`${PLACES_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "places.id,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({ textQuery: query }),
      });

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        return NextResponse.json({ error: `Google Text Search failed: ${errText}` }, { status: 502 });
      }

      const searchData = await searchRes.json() as { places?: Array<{ id: string; rating?: number; userRatingCount?: number }> };
      const topPlace = searchData.places?.[0];
      if (!topPlace) {
        return NextResponse.json({ source: "google", rating: null, review_count: null, place_id: null });
      }

      placeId = topPlace.id;
      rating = topPlace.rating ?? null;
      reviewCount = topPlace.userRatingCount ?? null;
    } else {
      // Place Details for known place_id
      const detailsRes = await fetch(`${PLACES_BASE}/places/${placeId}`, {
        headers: {
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "id,rating,userRatingCount",
        },
      });

      if (!detailsRes.ok) {
        const errText = await detailsRes.text();
        return NextResponse.json({ error: `Google Place Details failed: ${errText}` }, { status: 502 });
      }

      const details = await detailsRes.json() as { id: string; rating?: number; userRatingCount?: number };
      rating = details.rating ?? null;
      reviewCount = details.userRatingCount ?? null;
    }
  } catch (e) {
    return NextResponse.json({ error: `Google API request failed: ${String(e)}` }, { status: 502 });
  }

  // Persist to DB
  await db
    .from("content_entries")
    .update({
      place_id: placeId,
      google_rating: rating,
      google_review_count: reviewCount,
      google_rating_fetched_at: new Date().toISOString(),
    })
    .eq("id", contentEntryId);

  return NextResponse.json({
    source: "google",
    rating,
    review_count: reviewCount,
    place_id: placeId,
  });
}
