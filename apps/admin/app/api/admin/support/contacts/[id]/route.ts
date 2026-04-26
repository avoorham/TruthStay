import { NextRequest, NextResponse } from "next/server";
import { updateContactStatus } from "@/lib/queries/support";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await req.json();
    await updateContactStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
