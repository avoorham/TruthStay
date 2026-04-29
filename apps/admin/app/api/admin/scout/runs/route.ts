import { NextResponse } from "next/server";
import { getAgentRuns } from "@/lib/queries/scout";

export async function GET() {
  try {
    const data = await getAgentRuns(50);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
