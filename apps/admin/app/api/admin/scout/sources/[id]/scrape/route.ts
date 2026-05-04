import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateContentSourceAfterScrape } from "@/lib/queries/scout";

const EDGE_URL = "https://hplczwepdpmtdfkijpnh.supabase.co/functions/v1/scout-locations";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbGN6d2VwZHBtdGRma2lqcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTY4NDMsImV4cCI6MjA5MDA3Mjg0M30.Hj8oIGyH04f1nEfRTXI9dBvV-BAHGAfYKNHBM8sAuV4";

export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: source, error } = await db
    .from("content_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 115_000);

  try {
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        region: source.region ?? "Europe",
        vacationType: `source_scrape:${id}`,
        sourceUrls: [source.url],
        sourceId: id,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();

    if (res.ok) {
      await updateContentSourceAfterScrape(id, data.inserted ?? 0);
    } else {
      await db.from("content_sources").update({ status: "error" }).eq("id", id);
    }

    return NextResponse.json(data, { status: res.ok ? 200 : 500 });
  } catch (err: any) {
    clearTimeout(timeout);
    await db.from("content_sources").update({ status: "error" }).eq("id", id);
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "Scrape timed out — may still be running in the background" }, { status: 504 });
    }
    return NextResponse.json({ error: err.message ?? "Failed to reach scout edge function" }, { status: 502 });
  }
}
