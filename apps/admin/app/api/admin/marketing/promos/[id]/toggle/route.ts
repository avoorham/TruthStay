import { NextRequest, NextResponse } from "next/server";
import { togglePromoCode } from "@/lib/queries/marketing";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { is_active } = await req.json();
    await togglePromoCode(id, is_active);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
