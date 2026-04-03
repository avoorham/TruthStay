import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/thefork/book
// Body: { restaurant_id, datetime, party_size, guest_name, guest_phone, guest_email, special_requests? }
//
// Proxies to TheFork B2B reservations endpoint.
// NOTE: Exact endpoint path is a placeholder — update once TheFork API docs are received.

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    restaurant_id: string;
    datetime: string;
    party_size: number;
    guest_name: string;
    guest_phone: string;
    guest_email: string;
    special_requests?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.restaurant_id || !body.datetime || !body.party_size || !body.guest_name) {
    return NextResponse.json({ error: "restaurant_id, datetime, party_size and guest_name are required" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const tokRes = await fetch(`${appUrl}/api/thefork/token`);
  if (!tokRes.ok) return NextResponse.json({ error: "Could not obtain TheFork token" }, { status: 503 });
  const { token } = await tokRes.json() as { token?: string };
  if (!token) return NextResponse.json({ error: "No token" }, { status: 503 });

  // TODO: Replace path with actual TheFork reservations endpoint once API docs received
  const tfRes = await fetch("https://api.thefork.io/manager/v1/reservations", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      restaurantId:    body.restaurant_id,
      datetime:        body.datetime,
      partySize:       body.party_size,
      guestName:       body.guest_name,
      guestPhone:      body.guest_phone,
      guestEmail:      body.guest_email,
      specialRequests: body.special_requests ?? "",
    }),
  });

  const data = await tfRes.json();
  return NextResponse.json(data, { status: tfRes.status });
}
