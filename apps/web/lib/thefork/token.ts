// ─── Server-side TheFork token cache ─────────────────────────────────────────
//
// This module is the ONLY place the TheFork bearer token is obtained or stored.
// It must never be exported to clients or exposed via an HTTP endpoint.
//
// TheFork requires tokens not to be re-requested before expiry (~8600s).
// Cache in module scope — survives across requests on the same serverless instance.

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // unix seconds

/**
 * Returns a valid TheFork bearer token, refreshing if needed.
 * Call this from server-side route handlers only — never expose the token to clients.
 */
export async function getTheForkToken(): Promise<string> {
  const now = Date.now() / 1000;

  if (cachedToken && now < tokenExpiresAt - 60) {
    return cachedToken;
  }

  const clientId     = process.env.THEFORK_CLIENT_ID;
  const clientSecret = process.env.THEFORK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TheFork credentials not configured");
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
    throw new Error(`TheFork token request failed: ${res.status}`);
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("No access_token in TheFork response");
  }

  cachedToken    = data.access_token;
  tokenExpiresAt = now + (data.expires_in ?? 8600);

  return cachedToken;
}
