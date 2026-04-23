import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET  /api/adventures/comments?adventureId=<id>
// POST /api/adventures/comments  body: { adventureId, body }

async function resolvePublicUser(authId: string) {
  const db = createAdminClient();
  const { data } = await db.from("users").select("id, username, \"displayName\", \"avatarUrl\"").eq("authId", authId).maybeSingle();
  return data as { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adventureId = searchParams.get("adventureId");
  if (!adventureId) return NextResponse.json({ error: "adventureId required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("adventure_comments")
    .select(`id, body, "createdAt", userId, users(username, "displayName", "avatarUrl")`)
    .eq("adventureId", adventureId)
    .order("createdAt", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comments = (data ?? []).map((c: Record<string, unknown>) => {
    const u = (c.users as Record<string, unknown> | null) ?? {};
    return {
      id:          c.id,
      body:        c.body,
      createdAt:   c.createdAt,
      author: {
        username:    u.username ?? "traveller",
        displayName: u.displayName ?? "TruthStay User",
        avatarUrl:   u.avatarUrl ?? null,
      },
    };
  });

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicUser = await resolvePublicUser(user.id);
  if (!publicUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { adventureId, body } = await request.json() as { adventureId: string; body: string };
  if (!adventureId || !body?.trim()) {
    return NextResponse.json({ error: "adventureId and body required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("adventure_comments")
    .insert({ adventureId, userId: publicUser.id, body: body.trim() })
    .select("id, body, \"createdAt\"")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id:        data.id,
    body:      data.body,
    createdAt: data.createdAt,
    author: {
      username:    publicUser.username,
      displayName: publicUser.displayName,
      avatarUrl:   publicUser.avatarUrl,
    },
  });
}