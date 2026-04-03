import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST   /api/follows/[userId] — follow a user
// DELETE /api/follows/[userId] — unfollow a user

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("follows")
    .upsert(
      { followerId: user.id, followingId: userId },
      { onConflict: "followerId,followingId" },
    );

  if (error) {
    console.error("[follows] upsert error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
  return NextResponse.json({ followed: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const db = createAdminClient();
  const { error } = await db
    .from("follows")
    .delete()
    .eq("followerId", user.id)
    .eq("followingId", userId);

  if (error) {
    console.error("[follows] delete error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
  return NextResponse.json({ unfollowed: true });
}
