import { NextRequest, NextResponse } from "next/server";
import { getContentEntries } from "@/lib/queries/content";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filters: { type?: string; verified?: boolean; sourceType?: string } = {};
    if (searchParams.get("type")) filters.type = searchParams.get("type")!;
    if (searchParams.get("source_type")) filters.sourceType = searchParams.get("source_type")!;
    const v = searchParams.get("verified");
    if (v === "true") filters.verified = true;
    if (v === "false") filters.verified = false;
    const data = await getContentEntries(filters);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
