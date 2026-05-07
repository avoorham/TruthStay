import { NextRequest, NextResponse } from "next/server";
import { deleteContentSource, updateContentSource } from "@/lib/queries/scout";

const VALID_FOCUS_TYPES = ["accommodation", "restaurant", "activity", "route", "all"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.focus_type && !VALID_FOCUS_TYPES.includes(body.focus_type)) {
      return NextResponse.json({ error: `focus_type must be one of: ${VALID_FOCUS_TYPES.join(", ")}` }, { status: 400 });
    }
    const source = await updateContentSource(id, {
      label:      body.label,
      region:     body.region ?? null,
      seed_urls:  body.seed_urls ?? [],
      focus_type: body.focus_type ?? undefined,
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
