import { NextRequest, NextResponse } from "next/server";
import { getPartners, createPartner } from "@/lib/queries/partners";

export async function GET() {
  try { return NextResponse.json(await getPartners()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await createPartner(body);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
