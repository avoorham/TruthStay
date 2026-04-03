import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── TheFork webhook receiver ─────────────────────────────────────────────────
//
// TheFork POSTs reservation/customer/review events here.
// Rules:
//   1. Respond { "data": {} } + 200 IMMEDIATELY — TheFork won't retry after 200.
//   2. Process asynchronously (fire-and-forget) to avoid blocking the response.
//   3. Ignore unknown entityType/eventType for forward compatibility.

const ACK = NextResponse.json({ data: {} });

export async function POST(request: NextRequest) {
  // Validate HMAC signature — token is sent in X-Webhook-Signature header, not query param.
  // Signature format: HMAC-SHA256 hex of the raw request body using THEFORK_WEBHOOK_SECRET.
  const rawBody = await request.text();
  const sig = request.headers.get("x-webhook-signature") ?? "";
  const secret = process.env.THEFORK_WEBHOOK_SECRET ?? process.env.THEFORK_WEBHOOK_TOKEN ?? "";

  if (secret) {
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    const valid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: {
    entityType?: string;
    eventType?: string;
    uuid?: string;
    restaurantUuid?: string;
    groupUuid?: string;
  };
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return ACK; // Malformed payload — still ack to prevent retries
  }

  const { entityType, eventType, uuid } = body;

  // Process known events asynchronously
  if (entityType === "reservation" && uuid &&
      (eventType === "reservationCreated" || eventType === "reservationUpdated")) {
    void processReservationEvent(uuid);
  }
  // customer and review events: ignore for now (forward compatible)

  return ACK;
}

async function processReservationEvent(reservationUuid: string) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const tokRes = await fetch(`${appUrl}/api/thefork/token`);
    if (!tokRes.ok) throw new Error("Token fetch failed");
    const { token } = await tokRes.json() as { token?: string };
    if (!token) throw new Error("No token");

    // TODO: Replace with actual TheFork GET /reservations/{id} path once API docs received
    const res = await fetch(
      `https://api.thefork.io/manager/v1/reservations/${reservationUuid}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`TheFork GET reservation failed: ${res.status}`);

    const data = await res.json() as Record<string, unknown>;
    const db = createAdminClient();

    await db.from("restaurant_reservations").upsert({
      thefork_uuid:    reservationUuid,
      restaurant_uuid: (data.restaurantUuid as string | null) ?? null,
      guest_name:      (data.guestName as string | null) ?? null,
      datetime:        (data.datetime as string | null) ?? null,
      party_size:      (data.partySize as number | null) ?? null,
      status:          (data.status as string) ?? "unknown",
      raw:             data,
      updated_at:      new Date().toISOString(),
    }, { onConflict: "thefork_uuid" });
  } catch (err) {
    // Non-fatal — TheFork already received 200, no retry coming.
    // Log for manual review / dead-letter handling.
    console.error("[TheFork webhook] Failed to process reservation:", err instanceof Error ? err.message : String(err));
  }
}
