import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/feed/like  body: { type: "adventure"|"post", id: string }
// DELETE /api/feed/like  body: { type: "adventure"|"post", id: string }

async function resolvePublicUser(authId: string) {
  const db = createAdminClient();
  const { data } = await db.from("users").select("id").eq("authId", authId).maybeSingle();
  return data?.id as string | undefined;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { type, id } = await request.json() as { type: string; id: string };
  if (!type || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });

  const db = createAdminClient();

  if (type === "adventure") {
    const { error } = await db
      .from("adventure_likes")
      .upsert({ userId, adventureId: id }, { onConflict: "userId,adventureId", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (type === "post") {
    const { error } = await db
      .from("post_likes")
      .upsert({ userId, postId: id }, { onConflict: '"userId","postId"', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "type must be adventure or post" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { type, id } = await request.json() as { type: string; id: string };
  if (!type || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });

  const db = createAdminClient();

  if (type === "adventure") {
    await db.from("adventure_likes").delete().eq("userId", userId).eq("adventureId", id);
  } else if (type === "post") {
    await db.from("post_likes").delete().eq("userId", userId).eq("postId", id);
  } else {
    return NextResponse.json({ error: "type must be adventure or post" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}