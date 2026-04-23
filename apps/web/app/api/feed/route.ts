import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/feed?cursor=<iso_date>&limit=20
// Returns mixed feed items (adventures + posts) from users the current user follows.
// Each item includes likeCount, commentCount, isLiked, isBookmarked for the current user.
// If following nobody → returns { items: [], empty: true }

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { searchParams } = new URL(request.url);
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const cursor = searchParams.get("cursor"); // ISO date — return items older than this

  // 1. Resolve public users.id from auth UUID
  const { data: meRow } = await db
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();
  const myPublicId = (meRow as { id: string } | null)?.id;

  // 2. Get followed user IDs
  const { data: followRows } = await db
    .from("follows")
    .select("followingId")
    .eq("followerId", myPublicId ?? user.id);

  const followingIds = (followRows ?? []).map(
    r => (r as { followingId: string }).followingId,
  );

  if (followingIds.length === 0) {
    return NextResponse.json({ items: [], empty: true });
  }

  // 3. Fetch public adventures from followed users
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

  // 4. Fetch posts from followed users
  let postQ = db
    .from("posts")
    .select(`id, "userId", body, "mediaUrls", "adventureId", "dayNumber", "createdAt"`)
    .in("userId", followingIds)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (cursor) postQ = postQ.lt("createdAt", cursor);
  const { data: postRows } = await postQ;

  // 5. Look up author profiles from users table
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

  // 6. Fetch social counts for adventures and posts in parallel
  const advIds  = (advRows  ?? []).map(a => (a as Record<string, unknown>).id as string);
  const postIds = (postRows ?? []).map(p => (p as Record<string, unknown>).id as string);

  const [
    advLikeCounts, advBookmarksByMe, advCommentCounts,
    postLikeCounts, postLikesByMe, postCommentCounts,
  ] = await Promise.all([
    advIds.length  ? db.from("adventure_likes").select("adventureId").in("adventureId", advIds) : { data: [] },
    advIds.length && myPublicId ? db.from("adventure_bookmarks").select("adventureId").eq("userId", myPublicId).in("adventureId", advIds) : { data: [] },
    advIds.length  ? db.from("adventure_comments").select("adventureId").in("adventureId", advIds) : { data: [] },
    postIds.length ? db.from("post_likes").select("postId").in("postId", postIds) : { data: [] },
    postIds.length && myPublicId ? db.from("post_likes").select("postId").eq("userId", myPublicId).in("postId", postIds) : { data: [] },
    postIds.length ? db.from("comments").select("postId").in("postId", postIds) : { data: [] },
  ]);

  // Tally counts
  const advLikeCountMap    = new Map<string, number>();
  const advCommentCountMap = new Map<string, number>();
  const advBookmarkedByMe  = new Set<string>();
  const postLikeCountMap   = new Map<string, number>();
  const postCommentCountMap = new Map<string, number>();
  const postLikedByMe      = new Set<string>();

  // Also track adventure likes by current user separately
  if (myPublicId && advIds.length) {
    const { data: myAdvLikes } = await db
      .from("adventure_likes")
      .select("adventureId")
      .eq("userId", myPublicId)
      .in("adventureId", advIds);
    (myAdvLikes ?? []).forEach(r => advBookmarkedByMe.add((r as { adventureId: string }).adventureId));
  }
  // Reuse advBookmarksByMe for bookmarked set
  (advBookmarksByMe.data ?? []).forEach(r => advBookmarkedByMe.add((r as { adventureId: string }).adventureId));

  (advLikeCounts.data ?? []).forEach(r => {
    const id = (r as { adventureId: string }).adventureId;
    advLikeCountMap.set(id, (advLikeCountMap.get(id) ?? 0) + 1);
  });
  (advCommentCounts.data ?? []).forEach(r => {
    const id = (r as { adventureId: string }).adventureId;
    advCommentCountMap.set(id, (advCommentCountMap.get(id) ?? 0) + 1);
  });
  (postLikeCounts.data ?? []).forEach(r => {
    const id = (r as { postId: string }).postId;
    postLikeCountMap.set(id, (postLikeCountMap.get(id) ?? 0) + 1);
  });
  (postCommentCounts.data ?? []).forEach(r => {
    const id = (r as { postId: string }).postId;
    postCommentCountMap.set(id, (postCommentCountMap.get(id) ?? 0) + 1);
  });
  (postLikesByMe.data ?? []).forEach(r => postLikedByMe.add((r as { postId: string }).postId));

  // 7. Build typed feed items with social data
  const adventureItems = (advRows ?? []).map(adv => {
    const a = adv as Record<string, unknown>;
    const id = a.id as string;
    return {
      type: "adventure" as const,
      adventure: a,
      author: author(a.userId as string),
      created_at: a.createdAt as string,
      likeCount:    advLikeCountMap.get(id) ?? 0,
      commentCount: advCommentCountMap.get(id) ?? 0,
      isLiked:      advBookmarkedByMe.has(id),
      isBookmarked: (advBookmarksByMe.data ?? []).some(r => (r as { adventureId: string }).adventureId === id),
    };
  });

  const postItems = (postRows ?? []).map(post => {
    const p = post as Record<string, unknown>;
    const id = p.id as string;
    return {
      type: "post" as const,
      post: p,
      author: author(p.userId as string),
      created_at: p.createdAt as string,
      likeCount:    postLikeCountMap.get(id) ?? 0,
      commentCount: postCommentCountMap.get(id) ?? 0,
      isLiked:      postLikedByMe.has(id),
      isBookmarked: false,
    };
  });

  // 8. Merge, sort by recency, paginate
  const items = [...adventureItems, ...postItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return NextResponse.json({ items, empty: false });
}
