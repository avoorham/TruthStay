import { NextRequest } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface RequestBody {
  origin_name: string;
  destination_names: string[];
}

type TravelResult = {
  travel_seconds: number | null;
  source: "api" | "unavailable";
  reason?: string;
};

// POST /api/discovery/destination-times
// Batch driving-time lookup from one text-address origin to multiple destinations.
// One Google Distance Matrix call covers all destinations in the array.
// No coordinate cache — text addresses don't map to stable lat/lon keys.
// Falls back to { travel_seconds: null } per destination on any failure.
export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { origin_name, destination_names } = body;
  if (!origin_name || !destination_names?.length) {
    return Response.json(
      { error: "origin_name and destination_names (non-empty array) required" },
      { status: 400 },
    );
  }

  const unavailable = (reason: string): TravelResult => ({
    travel_seconds: null, source: "unavailable", reason,
  });

  if (!GOOGLE_MAPS_API_KEY) {
    return Response.json({
      results: Object.fromEntries(destination_names.map(n => [n, unavailable("api_key_missing")])),
    });
  }

  try {
    const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
      },
      body: JSON.stringify({
        origins:      [{ waypoint: { address: origin_name } }],
        destinations: destination_names.map(name => ({ waypoint: { address: name } })),
        travelMode: "DRIVE",
      }),
    });

    if (!res.ok) {
      return Response.json({
        results: Object.fromEntries(destination_names.map(n => [n, unavailable("api_error")])),
      });
    }

    const matrix = await res.json() as Array<{
      originIndex: number;
      destinationIndex: number;
      condition: string;
      duration?: string;   // Routes API returns seconds as "1140s"
    }>;

    const results: Record<string, TravelResult> = {};
    for (let i = 0; i < destination_names.length; i++) {
      const name = destination_names[i];
      if (!name) continue;
      // Use .find() — Routes API response order is not guaranteed
      const el = matrix.find(e => e.destinationIndex === i);
      results[name] = (el?.condition === "ROUTE_EXISTS" && el.duration)
        ? { travel_seconds: parseInt(el.duration.replace("s", ""), 10), source: "api" }
        : unavailable("no_route");
    }
    return Response.json({ results });
  } catch {
    return Response.json({
      results: Object.fromEntries(destination_names.map(n => [n, unavailable("network_error")])),
    });
  }
}
