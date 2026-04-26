import { NextResponse } from "next/server";
import { getAnalyticsOverview } from "@/lib/queries/analytics";

export async function GET() {
  try {
    const data = await getAnalyticsOverview();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
