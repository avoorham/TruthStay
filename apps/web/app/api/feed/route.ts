import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/feed?cursor=<iso_date>&limit=20
// Returns mixed feed items (adventures + posts) from users the current user follows.
// If following nobody → returns { items: [], empty: true }

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(request.url);
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const cursor = searchParams.get("cursor"); // ISO date — return items older than this

  // 1. Get followed user IDs
  const { data: followRows } = await db
    .from("follows")
    .select("followingId")
    .eq("followerId", user.id);

  const followingIds = (followRows ?? []).map(
    r => (r as { followingId: string }).followingId,
  );

  if (followingIds.length === 0) {
    return NextResponse.json({ items: [], empty: true });
  }

  // 2. Fetch public adventures from followed users
  let advQ = db
    .from("adventures")
    .select(`
      id, title, description, region, "activityType", "durationDays", "createdAt",
      level, "coverImageUrl", "userId",
      adventure_days(id, "dayNumber", title)
    `)
    .in("userId", followingIds)
    .eq("isPublic", true)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (cursor) advQ = advQ.lt("createdAt", cursor);
  const { data: advRows } = await advQ;

  // 3. Fetch posts from followed users
  let postQ = db
    .from("posts")
    .select(`id, "userId", body, "mediaUrls", "adventureId", "dayNumber", "createdAt"`)
    .in("userId", followingIds)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (cursor) postQ = postQ.lt("createdAt", cursor);
  const { data: postRows } = await postQ;

  // 4. Look up author profiles from users table
  const { data: userRows } = await db
    .from("users")
    .select(`id, username, "displayName", "avatarUrl"`)
    .in("id", followingIds);

  const userMap = new Map(
    (userRows ?? []).map(u => {
      const row = u as { id: string; username: string; displayName: string; avatarUrl: string | null };
      return [row.id, { id: row.id, username: row.username, display_name: row.displayName, avatar_url: row.avatarUrl }];
    }),
  );

  function author(userId: string) {
    return userMap.get(userId) ?? { id: userId, username: "traveller", display_name: "TruthStay User", avatar_url: null };
  }

  // 5. Build typed feed items
  const adventureItems = (advRows ?? []).map(adv => {
    const a = adv as Record<string, unknown>;
    return { type: "adventure" as const, adventure: a, author: author(a.userId as string), created_at: a.createdAt as string };
  });

  const postItems = (postRows ?? []).map(post => {
    const p = post as Record<string, unknown>;
    return { type: "post" as const, post: p, author: author(p.userId as string), created_at: p.createdAt as string };
  });

  // 6. Merge, sort by recency, paginate
  const items = [...adventureItems, ...postItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return NextResponse.json({ items, empty: false });
}
