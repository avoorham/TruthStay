import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/profile/stats
// Returns { trips, posts, followers, following } counts for the current user.

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: me } = await db.from("users").select("id").eq("authId", user.id).maybeSingle();
  const myId = (me as { id: string } | null)?.id;

  const [tripsRes, postsRes, followersRes, followingRes] = await Promise.all([
    myId
      ? db.from("adventures").select("id", { count: "exact", head: true }).eq("userId", myId).eq("isSaved", true)
      : Promise.resolve({ count: 0 }),
    db.from("posts").select("id", { count: "exact", head: true }).eq("userId", user.id),
    myId
      ? db.from("follows").select("followerId", { count: "exact", head: true }).eq("followingId", myId)
      : Promise.resolve({ count: 0 }),
    myId
      ? db.from("follows").select("followerId", { count: "exact", head: true }).eq("followerId", myId)
      : Promise.resolve({ count: 0 }),
  ]);

  return NextResponse.json({
    trips:     tripsRes.count    ?? 0,
    posts:     postsRes.count    ?? 0,
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  });
}
