import { NextRequest, NextResponse } from "next/server";
import { getAnnouncements, createAnnouncement } from "@/lib/queries/notifications";

export async function GET() {
  try { return NextResponse.json(await getAnnouncements()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await createAnnouncement(body);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
