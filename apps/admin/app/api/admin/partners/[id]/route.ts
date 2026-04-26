import { NextRequest, NextResponse } from "next/server";
import { getPartner, updatePartner } from "@/lib/queries/partners";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json(await getPartner(id)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await updatePartner(id, body);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
