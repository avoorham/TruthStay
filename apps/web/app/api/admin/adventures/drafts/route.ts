import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: adminRow } = await db.from("admin_users").select("role").eq("user_id", user.id).single();
  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "draft";

  const { data, error } = await db
    .from("public_adventure_drafts")
    .select("id, slot, adventure, day_alternatives, accommodation_stops, meta, qa_notes, status, created_at, approved_at, adventure_id")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/drafts] DB error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
