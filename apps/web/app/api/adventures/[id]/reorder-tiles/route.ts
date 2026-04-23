import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/adventures/[id]/reorder-tiles
// Persists the display order of all tiles within a day.
// Body: { dayNumber: number; tileOrder: string[] }
// tileOrder elements: "route" | "accommodation" | "rest:N"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adventureId } = await params;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { dayNumber: number; tileOrder: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { dayNumber, tileOrder } = body;
  if (!dayNumber || !Array.isArray(tileOrder)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  // Verify ownership
  const { data: publicUser } = await adminDb
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();
  if (!publicUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: ownerCheck } = await adminDb
    .from("adventures")
    .select("id")
    .eq("id", adventureId)
    .eq("userId", publicUser.id)
    .maybeSingle();
  if (!ownerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch the day's alternatives
  const { data: day } = await adminDb
    .from("adventure_days")
    .select("id, alternatives")
    .eq("adventureId", adventureId)
    .eq("dayNumber" as never, dayNumber)
    .maybeSingle();
  if (!day) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const alts: Record<string, unknown> = {
    ...((day as Record<string, unknown>).alternatives as Record<string, unknown> ?? {}),
    tileOrder,
  };

  const { error } = await adminDb
    .from("adventure_days")
    .update({ alternatives: alts })
    .eq("id", (day as Record<string, unknown>).id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}