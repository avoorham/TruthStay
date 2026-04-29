import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/editorial?status=pending_review
export async function GET(request: NextRequest) {
  const db = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending_review";

  const { data, error } = await db
    .from("editorial_posts")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

// POST /api/admin/editorial — create new post
export async function POST(request: NextRequest) {
  const db = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.post_type)
    return NextResponse.json({ error: "title and post_type required" }, { status: 400 });

  const { data, error } = await db
    .from("editorial_posts")
    .insert({
      title:           body.title,
      subtitle:        body.subtitle ?? null,
      body:            body.body ?? null,
      hero_image_url:  body.hero_image_url ?? null,
      images:          body.images ?? [],
      post_type:       body.post_type,
      content_entry_ids: body.content_entry_ids ?? [],
      region:          body.region ?? null,
      activity_type:   body.activity_type ?? null,
      vacation_type:   body.vacation_type ?? null,
      target_audience: body.target_audience ?? { type: "all_users" },
      status:          "draft",
      generated_by:    "admin",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data }, { status: 201 });
}
