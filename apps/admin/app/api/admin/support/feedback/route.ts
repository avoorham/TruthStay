import { NextResponse } from "next/server";
import { getAdventureFeedback } from "@/lib/queries/support";

export async function GET() {
  try { return NextResponse.json(await getAdventureFeedback()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
