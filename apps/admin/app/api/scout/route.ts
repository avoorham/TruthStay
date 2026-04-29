import { NextRequest, NextResponse } from "next/server";

const EDGE_URL = "https://hplczwepdpmtdfkijpnh.supabase.co/functions/v1/scout-locations";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbGN6d2VwZHBtdGRma2lqcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTY4NDMsImV4cCI6MjA5MDA3Mjg0M30.Hj8oIGyH04f1nEfRTXI9dBvV-BAHGAfYKNHBM8sAuV4";

// Allow up to 120 seconds on Vercel (ignored locally, no-op on other hosts)
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 500 });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "Scout timed out after 120 s — the run may still be completing in the background" },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to reach scout edge function" },
      { status: 502 },
    );
  }
}
