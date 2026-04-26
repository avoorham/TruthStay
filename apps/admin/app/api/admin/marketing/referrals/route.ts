import { NextResponse } from "next/server";
import { getReferralCodes } from "@/lib/queries/marketing";

export async function GET() {
  try { return NextResponse.json(await getReferralCodes()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
