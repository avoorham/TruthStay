import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/feed/stories
// Returns story circles for the current user, grouped by group_key.
// Unviewed circles come first, then sorted by recency.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const now = new Date().toISOString();

  // Query by both auth UUID and email since different triggers use different identifiers
  const identifiers = [user.id, ...(user.email ? [user.email] : [])];

  const { data: stories } = await db
    .from("feed_stories")
    .select("*")
    .in("target_user_id", identifiers)
    .eq("is_dismissed", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("is_viewed", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  type Story = {
    id: string;
    group_key: string;
    group_label: string | null;
    group_thumbnail_url: string | null;
    is_viewed: boolean;
    created_at: string;
    story_type: string;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    image_url: string | null;
    metadata: Record<string, unknown>;
    context_tag: string | null;
    context_trip_id: string | null;
    content_entry_id: string | null;
    activity_post_id: string | null;
    adventure_id: string | null;
    is_saved: boolean;
    expires_at: string | null;
  };

  const circles = new Map<string, {
    group_key: string;
    label: string | null;
    thumbnail_url: string | null;
    has_unviewed: boolean;
    stories: Story[];
  }>();

  for (const story of (stories ?? []) as Story[]) {
    if (!circles.has(story.group_key)) {
      circles.set(story.group_key, {
        group_key:     story.group_key,
        label:         story.group_label,
        thumbnail_url: story.group_thumbnail_url,
        has_unviewed:  false,
        stories:       [],
      });
    }
    const circle = circles.get(story.group_key)!;
    circle.stories.push(story);
    if (!story.is_viewed) circle.has_unviewed = true;
  }

  const sortedCircles = Array.from(circles.values()).sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) return a.has_unviewed ? -1 : 1;
    const aDate = a.stories[0]?.created_at ?? "";
    const bDate = b.stories[0]?.created_at ?? "";
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return NextResponse.json({ circles: sortedCircles });
}

// PATCH /api/feed/stories — mark a story as viewed
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storyId } = await request.json().catch(() => ({})) as { storyId?: string };
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const db = createAdminClient();
  await db
    .from("feed_stories")
    .update({ is_viewed: true, viewed_at: new Date().toISOString() })
    .eq("id", storyId);

  return NextResponse.json({ ok: true });
}

// DELETE /api/feed/stories — dismiss a story
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storyId } = await request.json().catch(() => ({})) as { storyId?: string };
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const db = createAdminClient();
  await db
    .from("feed_stories")
    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
    .eq("id", storyId);

  return NextResponse.json({ ok: true });
}
