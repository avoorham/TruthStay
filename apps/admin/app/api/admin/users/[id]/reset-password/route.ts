import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/queries/users";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser(id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const db = createAdminClient();
    const { error } = await db.auth.admin.generateLink({
      type: "recovery",
      email: user.email,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
