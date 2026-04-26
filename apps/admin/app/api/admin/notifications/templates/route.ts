import { NextResponse } from "next/server";
import { getTemplates } from "@/lib/queries/notifications";

export async function GET() {
  try { return NextResponse.json(await getTemplates()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
