import { NextRequest, NextResponse } from "next/server";
import { toggleAnnouncement } from "@/lib/queries/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { is_active } = await req.json();
    await toggleAnnouncement(id, is_active);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
