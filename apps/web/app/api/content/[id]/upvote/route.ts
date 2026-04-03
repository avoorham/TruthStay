import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: entryId } = await params;
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = createAdminClient();

  const { data, error } = await adminDb.rpc("add_content_upvote", {
    p_entry_id: entryId,
    p_user_id:  user.id,
  });

  if (error) {
    if (error.message?.includes("already_upvoted")) {
      return NextResponse.json({ error: "Already upvoted" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
