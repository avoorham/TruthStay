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
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", origin_name);
    url.searchParams.set("destinations", destination_names.join("|"));
    url.searchParams.set("mode", "driving");
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const res = await fetch(url.toString());
    const json = await res.json() as {
      status: string;
      rows?: Array<{
        elements?: Array<{ status: string; duration?: { value: number } }>;
      }>;
    };

    if (json.status !== "OK" || !json.rows?.[0]?.elements) {
      return Response.json({
        results: Object.fromEntries(destination_names.map(n => [n, unavailable("api_error")])),
      });
    }

    const elements = json.rows[0].elements ?? [];
    const results: Record<string, TravelResult> = {};
    for (let i = 0; i < destination_names.length; i++) {
      const name = destination_names[i];
      if (!name) continue;
      const el = elements[i];
      results[name] = (el?.status === "OK" && el.duration?.value)
        ? { travel_seconds: el.duration.value, source: "api" }
        : unavailable("no_route");
    }
    return Response.json({ results });
  } catch {
    return Response.json({
      results: Object.fromEntries(destination_names.map(n => [n, unavailable("network_error")])),
    });
  }
}
