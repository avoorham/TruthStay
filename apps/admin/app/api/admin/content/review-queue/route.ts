import { NextResponse } from "next/server";
import { getReviewQueue } from "@/lib/queries/content";

export async function GET() {
  try {
    const data = await getReviewQueue();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
