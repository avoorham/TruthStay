import { NextRequest, NextResponse } from "next/server";
import { getContentSources, addContentSource } from "@/lib/queries/scout";

export async function GET() {
  try {
    return NextResponse.json(await getContentSources());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.url || !body.type || !body.label) {
      return NextResponse.json({ error: "url, type, and label are required" }, { status: 400 });
    }
    const source = await addContentSource(body);
    return NextResponse.json(source, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
