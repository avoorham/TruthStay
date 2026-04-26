import { NextResponse } from "next/server";
import { getApiCosts } from "@/lib/queries/finance";

export async function GET() {
  try { return NextResponse.json(await getApiCosts()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
