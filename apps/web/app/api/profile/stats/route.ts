import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/profile/stats
// Returns { trips, posts, followers, following } counts for the current user.

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const [tripsRes, postsRes, followersRes, followingRes] = await Promise.all([
    db.from("adventures").select("id", { count: "exact", head: true }).eq("userId", user.id).eq("isSaved", true),
    db.from("posts").select("id", { count: "exact", head: true }).eq("userId", user.id),
    db.from("follows").select("id", { count: "exact", head: true }).eq("followingId", user.id),
    db.from("follows").select("id", { count: "exact", head: true }).eq("followerId", user.id),
  ]);

  return NextResponse.json({
    trips:     tripsRes.count    ?? 0,
    posts:     postsRes.count    ?? 0,
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  });
}
