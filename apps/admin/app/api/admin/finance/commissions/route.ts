import { NextResponse } from "next/server";
import { getCommissions } from "@/lib/queries/finance";

export async function GET() {
  try { return NextResponse.json(await getCommissions()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
