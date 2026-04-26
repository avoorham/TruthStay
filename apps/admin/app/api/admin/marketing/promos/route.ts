import { NextRequest, NextResponse } from "next/server";
import { getPromoCodes, createPromoCode } from "@/lib/queries/marketing";

export async function GET() {
  try { return NextResponse.json(await getPromoCodes()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await createPromoCode(body);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
