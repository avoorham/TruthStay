import { NextRequest, NextResponse } from "next/server";
import { deleteContentSource, updateContentSource } from "@/lib/queries/scout";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const source = await updateContentSource(id, {
      label:     body.label,
      region:    body.region ?? null,
      seed_urls: body.seed_urls ?? [],
    });
    return NextResponse.json(source);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteContentSource(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
