import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/adventures/[id]/move-activity
// Moves a restaurant or accommodation from one day to another.
// Body: { fromDay: number; toDay: number; activityType: "restaurant" | "accommodation"; activityIndex: number }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adventureId } = await params;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fromDay: number; toDay: number; activityType: "restaurant" | "accommodation"; activityIndex: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { fromDay, toDay, activityType, activityIndex } = body;
  if (!fromDay || !toDay || !activityType || activityIndex == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  // Verify the user owns this adventure
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

  // Fetch both days
  const { data: days, error: daysError } = await adminDb
    .from("adventure_days")
    .select("id, \"dayNumber\", alternatives")
    .eq("adventureId", adventureId)
    .in("dayNumber" as never, [fromDay, toDay]);

  if (daysError || !days) return NextResponse.json({ error: "Days not found" }, { status: 404 });

  const sourceDay = (days as Array<{ id: string; dayNumber: number; alternatives: Record<string, unknown> | null }>)
    .find(d => d.dayNumber === fromDay);
  const targetDay = (days as Array<{ id: string; dayNumber: number; alternatives: Record<string, unknown> | null }>)
    .find(d => d.dayNumber === toDay);

  if (!sourceDay || !targetDay) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const sourceAlts: Record<string, unknown> = { ...(sourceDay.alternatives ?? {}) };
  const targetAlts: Record<string, unknown> = { ...(targetDay.alternatives ?? {}) };

  if (activityType === "restaurant") {
    const restaurants = [...((sourceAlts.restaurants as unknown[]) ?? [])];
    if (activityIndex >= restaurants.length) {
      return NextResponse.json({ error: "Activity index out of range" }, { status: 400 });
    }
    const [moved] = restaurants.splice(activityIndex, 1);
    sourceAlts.restaurants = restaurants;
    targetAlts.restaurants = [...((targetAlts.restaurants as unknown[]) ?? []), moved];
  } else if (activityType === "accommodation") {
    const accomStop = sourceAlts.accommodationStop as Record<string, unknown> | null;
    const opts = [...((accomStop?.options as unknown[]) ?? [])];
    if (activityIndex >= opts.length) {
      return NextResponse.json({ error: "Activity index out of range" }, { status: 400 });
    }
    const [moved] = opts.splice(activityIndex, 1);
    sourceAlts.accommodationStop = { ...(accomStop ?? {}), options: opts };
    const targetAccom = targetAlts.accommodationStop as Record<string, unknown> | null;
    targetAlts.accommodationStop = {
      ...(targetAccom ?? {}),
      options: [moved, ...((targetAccom?.options as unknown[]) ?? [])],
    };
  }

  const [sourceResult, targetResult] = await Promise.all([
    adminDb.from("adventure_days").update({ alternatives: sourceAlts }).eq("id", sourceDay.id),
    adminDb.from("adventure_days").update({ alternatives: targetAlts }).eq("id", targetDay.id),
  ]);

  if (sourceResult.error) return NextResponse.json({ error: sourceResult.error.message }, { status: 500 });
  if (targetResult.error) return NextResponse.json({ error: targetResult.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}