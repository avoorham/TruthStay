import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/admin/editorial/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "title", "subtitle", "body", "hero_image_url", "images",
    "post_type", "content_entry_ids", "region", "activity_type",
    "vacation_type", "target_audience", "status", "review_notes",
    "published_at",
  ] as const;
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Auto-set published_at when approving
  if (body.status === "approved" && !body.published_at) {
    updates.published_at = new Date().toISOString();
    updates.reviewed_at  = new Date().toISOString();
  }

  const { data, error } = await db
    .from("editorial_posts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// DELETE /api/admin/editorial/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from("editorial_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
