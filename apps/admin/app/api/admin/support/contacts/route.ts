import { NextResponse } from "next/server";
import { getSupportContacts } from "@/lib/queries/support";

export async function GET() {
  try { return NextResponse.json(await getSupportContacts()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
