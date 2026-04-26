import { NextRequest, NextResponse } from "next/server";
import { updateReportStatus } from "@/lib/queries/support";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status, resolution_notes } = await req.json();
    await updateReportStatus(id, status, resolution_notes);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
