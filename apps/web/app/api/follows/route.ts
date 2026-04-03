import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/follows — returns profiles of users the current user follows

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: followRows } = await db
    .from("follows")
    .select("followingId")
    .eq("followerId", user.id);

  const followingIds = (followRows ?? []).map(
    r => (r as { followingId: string }).followingId,
  );

  if (followingIds.length === 0) return NextResponse.json({ following: [] });

  const { data: userRows } = await db
    .from("users")
    .select(`id, username, "displayName", "avatarUrl"`)
    .in("id", followingIds);

  const following = (userRows ?? []).map(u => {
    const row = u as { id: string; username: string; displayName: string; avatarUrl: string | null };
    return { id: row.id, username: row.username, display_name: row.displayName, avatar_url: row.avatarUrl };
  });

  return NextResponse.json({ following });
}
