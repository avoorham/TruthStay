import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

const FITNESS_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
type FitnessLevel = (typeof FITNESS_LEVELS)[number];

function stepFitness(current: FitnessLevel, direction: "up" | "down"): FitnessLevel {
  const idx = FITNESS_LEVELS.indexOf(current);
  if (direction === "up") return FITNESS_LEVELS[Math.min(idx + 1, FITNESS_LEVELS.length - 1)] ?? current;
  return FITNESS_LEVELS[Math.max(idx - 1, 0)] ?? current;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adventureId } = await params;

  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { day_number: number; category: "route" | "accommodation"; selected_index: number; option_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  const { error: selError } = await adminDb.from("adventure_selections").upsert(
    {
      userId: user.id,
      adventureId,
      dayNumber: body.day_number,
      category: body.category,
      selectedIndex: body.selected_index,
    },
    { onConflict: '"userId","adventureId","dayNumber",category' }
  );

  if (selError) {
    console.warn("Selection save failed:", selError.message);
  }

  try {
    const { data: prefs } = await adminDb
      .from("user_adventure_preferences")
      .select("fitnessLevel, accommodationPreference")
      .eq("userId", user.id)
      .single();

    const currentFitness: FitnessLevel = (prefs?.fitnessLevel as FitnessLevel | null) ?? "intermediate";
    const updates: Record<string, unknown> = { userId: user.id, updatedAt: new Date().toISOString() };

    if (body.category === "route") {
      if (body.selected_index === 2) updates.fitnessLevel = stepFitness(currentFitness, "up");
      else if (body.selected_index === 1) updates.fitnessLevel = stepFitness(currentFitness, "down");
    }

    if (body.category === "accommodation" && body.option_type) {
      const typeToPreference: Record<string, string> = {
        camping: "camping", hostel: "budget", hotel: "mid_range", guesthouse: "mid_range", luxury: "luxury",
      };
      const mapped = typeToPreference[body.option_type];
      if (mapped) updates.accommodationPreference = mapped;
    }

    if (Object.keys(updates).length > 2) {
      await adminDb.from("user_adventure_preferences").upsert(updates, { onConflict: '"userId"' });
    }
  } catch (err) {
    console.warn("Preference update failed:", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({ ok: true });
}
