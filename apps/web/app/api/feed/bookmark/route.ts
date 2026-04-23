import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET    /api/feed/bookmark            — list bookmarked adventures for current user
// POST   /api/feed/bookmark   body: { adventureId: string }
// DELETE /api/feed/bookmark   body: { adventureId: string }

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: publicUser } = await db.from("users").select("id").eq("authId", user.id).maybeSingle();
  if (!publicUser) return NextResponse.json({ bookmarks: [] });

  const { data } = await db
    .from("adventure_bookmarks")
    .select(`adventureId, adventures(id, title, region, "activityType", "durationDays", "coverImageUrl", level, rating)`)
    .eq("userId", (publicUser as { id: string }).id)
    .order("createdAt", { ascending: false })
    .limit(50);

  const bookmarks = (data ?? []).map((row: Record<string, unknown>) => {
    const adv = row.adventures as Record<string, unknown> | null;
    return adv ?? null;
  }).filter(Boolean);

  return NextResponse.json({ bookmarks });
}

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

  const { adventureId } = await request.json() as { adventureId: string };
  if (!adventureId) return NextResponse.json({ error: "adventureId required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from("adventure_bookmarks")
    .upsert({ userId, adventureId }, { onConflict: "userId,adventureId", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { adventureId } = await request.json() as { adventureId: string };
  if (!adventureId) return NextResponse.json({ error: "adventureId required" }, { status: 400 });

  const db = createAdminClient();
  await db.from("adventure_bookmarks").delete().eq("userId", userId).eq("adventureId", adventureId);
  return NextResponse.json({ ok: true });
}