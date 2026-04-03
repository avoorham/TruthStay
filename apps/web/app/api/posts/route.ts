import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/posts
// Body: { adventure_id?: string; day_number?: number; caption: string; media_urls: string[] }
// media_urls must be already-uploaded Supabase Storage public URLs.

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    adventure_id?: string;
    day_number?: number;
    caption?: string;
    media_urls?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.caption && (!body.media_urls || body.media_urls.length === 0)) {
    return NextResponse.json(
      { error: "caption or media_urls is required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("posts")
    .insert({
      userId:      user.id,
      body:        body.caption ?? "",
      mediaUrls:   body.media_urls ?? [],
      adventureId: body.adventure_id ?? null,
      dayNumber:   body.day_number ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[posts] DB error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
