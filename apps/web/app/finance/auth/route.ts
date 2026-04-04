import { NextRequest, NextResponse } from "next/server";

/**
 * GET /finance/auth?key=SECRET
 * Validates FINANCE_SECRET_KEY and sets a session cookie, then redirects to /finance.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.FINANCE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "FINANCE_SECRET_KEY not configured" }, { status: 500 });
  }

  const key = request.nextUrl.searchParams.get("key");
  if (!key || key !== secret) {
    return NextResponse.json({ error: "Invalid key" }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/finance", request.url));
  response.cookies.set("finance_auth", secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/finance",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
