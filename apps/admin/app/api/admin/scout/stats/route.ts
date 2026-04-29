import { NextResponse } from "next/server";
import { getContentStats } from "@/lib/queries/scout";

export async function GET() {
  try {
    const data = await getContentStats();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
