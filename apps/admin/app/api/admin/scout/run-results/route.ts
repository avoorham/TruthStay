import { NextRequest, NextResponse } from "next/server";
import { getRunResults } from "@/lib/queries/scout";

export async function GET(req: NextRequest) {
  try {
    const runId = new URL(req.url).searchParams.get("runId");
    if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    const data = await getRunResults(runId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
