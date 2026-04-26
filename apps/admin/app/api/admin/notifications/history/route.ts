import { NextResponse } from "next/server";
import { getNotificationHistory } from "@/lib/queries/notifications";

export async function GET() {
  try { return NextResponse.json(await getNotificationHistory()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
