import { NextRequest, NextResponse } from "next/server";

// 308 Permanent Redirect — preserves POST method so any cached callers keep working.
// New canonical path is /api/admin/scout/run.
export async function POST(req: NextRequest) {
  return NextResponse.redirect(
    new URL("/api/admin/scout/run", req.nextUrl.origin),
    308,
  );
}
