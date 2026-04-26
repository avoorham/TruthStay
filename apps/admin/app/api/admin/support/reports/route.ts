import { NextResponse } from "next/server";
import { getUserReports } from "@/lib/queries/support";

export async function GET() {
  try { return NextResponse.json(await getUserReports()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
