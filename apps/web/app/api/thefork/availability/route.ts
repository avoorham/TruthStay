import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTheForkToken } from "@/lib/thefork/token";

// GET /api/thefork/availability?restaurant_id=X&date=YYYY-MM-DD&party_size=N
//
// Proxies to TheFork B2B availability endpoint.
// NOTE: Exact endpoint path is a placeholder — update once TheFork API docs are received.

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurant_id");
  const date         = searchParams.get("date");
  const partySize    = searchParams.get("party_size") ?? "2";

  if (!restaurantId || !date) {
    return NextResponse.json({ error: "restaurant_id and date are required" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getTheForkToken();
  } catch {
    return NextResponse.json({ error: "Could not obtain TheFork token" }, { status: 503 });
  }

  // TODO: Replace path with actual TheFork availability endpoint once API docs received
  const tfRes = await fetch(
    `https://api.thefork.io/manager/v1/restaurants/${restaurantId}/availability?date=${date}&partySize=${partySize}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const data = await tfRes.json();
  return NextResponse.json(data, { status: tfRes.status });
}
