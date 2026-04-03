import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await db
    .from("public_adventure_drafts")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    console.error("[admin/reject] DB error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
