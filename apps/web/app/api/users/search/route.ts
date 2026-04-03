import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/users/search?q=alex
// Returns up to 20 users matching the query on username or displayName.
// If q is empty/missing, returns top users by follower count (for suggestions).

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const db = createAdminClient();

  if (q.length < 2) {
    // Return top 10 users by follower count (suggested) — excluding self
    const { data, error } = await db
      .from("users")
      .select(`id, username, "displayName", "avatarUrl"`)
      .neq("id", user.id)
      .limit(10);

    if (error) {
      console.error("[users/search] DB error:", error.message);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ users: (data ?? []).map(toAuthor) });
  }

  // Search by username prefix or displayName contains
  const pattern = `%${q}%`;
  const { data, error } = await db
    .from("users")
    .select(`id, username, "displayName", "avatarUrl"`)
    .neq("id", user.id)
    .or(`username.ilike.${pattern},"displayName".ilike.${pattern}`)
    .limit(20);

  if (error) {
    console.error("[users/search] DB error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }

  return NextResponse.json({ users: (data ?? []).map(toAuthor) });
}

function toAuthor(u: { id: string; username: string; displayName: string; avatarUrl: string | null }) {
  return { id: u.id, username: u.username, display_name: u.displayName, avatar_url: u.avatarUrl };
}
