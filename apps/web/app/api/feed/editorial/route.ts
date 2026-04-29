import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/feed/editorial
// Returns approved editorial posts for the feed, ordered by published_at DESC.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: posts } = await db
    .from("editorial_posts")
    .select(
      "id, title, subtitle, body, hero_image_url, images, post_type, region, activity_type, target_audience, published_at, view_count, save_count, created_at",
    )
    .eq("status", "approved")
    .order("published_at", { ascending: false })
    .limit(20);

  // Increment view counts in background (fire and forget)
  if (posts?.length) {
    const ids = posts.map(p => (p as { id: string }).id);
    db.rpc("increment_editorial_views" as never, { post_ids: ids } as never).then(() => {});
  }

  return NextResponse.json({ posts: posts ?? [] });
}
