import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET    /api/adventures/[id]/collaborators
// POST   /api/adventures/[id]/collaborators   body: { email: string; permission?: "editor"|"viewer" }
// PATCH  /api/adventures/[id]/collaborators   body: { userId: string; permission: "editor"|"viewer" }
// DELETE /api/adventures/[id]/collaborators   body: { userId: string }

async function resolvePublicUser(authId: string) {
  const db = createAdminClient();
  const { data } = await db.from("users").select("id").eq("authId", authId).maybeSingle();
  return data?.id as string | undefined;
}

async function assertOwner(adventureId: string, userId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("adventures")
    .select("userId")
    .eq("id", adventureId)
    .maybeSingle();
  return data?.userId === userId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Must be owner or collaborator to list
  const isOwner = await assertOwner(id, userId);
  if (!isOwner) {
    const db = createAdminClient();
    const { data: collab } = await db
      .from("adventure_collaborators")
      .select("id")
      .eq("adventureId", id)
      .eq("userId", userId)
      .maybeSingle();
    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data } = await db
    .from("adventure_collaborators")
    .select(`id, permission, "createdAt", users!userId(id, username, "displayName", "avatarUrl")`)
    .eq("adventureId", id)
    .order("createdAt", { ascending: true });

  const collaborators = (data ?? []).map((row: Record<string, unknown>) => ({
    id:          row.id,
    permission:  row.permission,
    createdAt:   row.createdAt,
    user:        row.users,
  }));

  return NextResponse.json({ collaborators });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!(await assertOwner(id, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, permission = "viewer" } = await request.json() as { email: string; permission?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const db = createAdminClient();

  // Resolve invitee by email via auth.users → public.users
  const { data: authUsers } = await db.auth.admin.listUsers();
  const inviteeAuth = authUsers?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
  if (!inviteeAuth) return NextResponse.json({ error: "No user found with that email" }, { status: 404 });

  const { data: inviteePublic } = await db
    .from("users")
    .select("id")
    .eq("authId", inviteeAuth.id)
    .maybeSingle();
  if (!inviteePublic) return NextResponse.json({ error: "User has not completed registration" }, { status: 404 });

  if (inviteePublic.id === userId) {
    return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  const { error } = await db
    .from("adventure_collaborators")
    .upsert(
      { adventureId: id, userId: inviteePublic.id, permission, invitedBy: userId },
      { onConflict: "adventureId,userId", ignoreDuplicates: false },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!(await assertOwner(id, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: targetUserId, permission } = await request.json() as { userId: string; permission: string };
  if (!targetUserId || !permission) return NextResponse.json({ error: "userId and permission required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from("adventure_collaborators")
    .update({ permission })
    .eq("adventureId", id)
    .eq("userId", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolvePublicUser(user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!(await assertOwner(id, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: targetUserId } = await request.json() as { userId: string };
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = createAdminClient();
  await db
    .from("adventure_collaborators")
    .delete()
    .eq("adventureId", id)
    .eq("userId", targetUserId);

  return NextResponse.json({ ok: true });
}