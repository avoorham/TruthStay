import { NextResponse } from "next/server";

// ─── Server-side TheFork token cache ──────────────────────────────────────────
// TheFork requires tokens not to be re-requested before expiry (8600s).
// Cache in module scope — survives across requests on the same serverless instance.

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // unix seconds

export async function GET() {
  const now = Date.now() / 1000;

  // Return cached token if still valid (with 60s safety margin)
  if (cachedToken && now < tokenExpiresAt - 60) {
    return NextResponse.json({ token: cachedToken });
  }

  const clientId     = process.env.THEFORK_CLIENT_ID;
  const clientSecret = process.env.THEFORK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "TheFork credentials not configured" }, { status: 503 });
  }

  const res = await fetch("https://auth.thefork.io/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      audience:      "https://api.thefork.io",
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to obtain TheFork token" }, { status: 502 });
  }

  const data = await res.json() as { access_token?: string };
  if (!data.access_token) {
    return NextResponse.json({ error: "No access_token in TheFork response" }, { status: 502 });
  }

  cachedToken    = data.access_token;
  tokenExpiresAt = now + 8600;

  return NextResponse.json({ token: cachedToken });
}
