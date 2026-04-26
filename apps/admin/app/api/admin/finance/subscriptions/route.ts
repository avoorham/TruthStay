import { NextResponse } from "next/server";
import { getSubscriptions } from "@/lib/queries/finance";

export async function GET() {
  try { return NextResponse.json(await getSubscriptions()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
