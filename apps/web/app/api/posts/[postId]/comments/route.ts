import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET  /api/posts/[postId]/comments
// POST /api/posts/[postId]/comments  body: { body }

async function resolvePublicUser(authId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("users")
    .select("id, username, \"displayName\", \"avatarUrl\"")
    .eq("authId", authId)
    .maybeSingle();
  return data as { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const db = createAdminClient();

  const { data, error } = await db
    .from("comments")
    .select(`id, body, "createdAt", userId, users(username, "displayName", "avatarUrl")`)
    .eq("postId", postId)
    .order("createdAt", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comments = (data ?? []).map((c: Record<string, unknown>) => {
    const u = (c.users as Record<string, unknown> | null) ?? {};
    return {
      id:        c.id,
      body:      c.body,
      createdAt: c.createdAt,
      author: {
        username:    u.username ?? "traveller",
        displayName: u.displayName ?? "TruthStay User",
        avatarUrl:   u.avatarUrl ?? null,
      },
    };
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicUser = await resolvePublicUser(user.id);
  if (!publicUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { body } = await request.json() as { body: string };
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("comments")
    .insert({ postId, userId: publicUser.id, body: body.trim() })
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