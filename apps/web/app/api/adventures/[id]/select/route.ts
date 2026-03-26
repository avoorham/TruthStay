import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Fitness level progression (in order)
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

  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse body
  let body: { day_number: number; category: "route" | "accommodation"; selected_index: number; option_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  // 1. Upsert the selection record
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

  // 2. Update user_adventure_preferences based on the selection signal
  try {
    // Fetch current preferences (may not exist yet)
    const { data: prefs } = await adminDb
      .from("user_adventure_preferences")
      .select("fitnessLevel, accommodationPreference")
      .eq("userId", user.id)
      .single();

    const currentFitness: FitnessLevel =
      (prefs?.fitnessLevel as FitnessLevel | null) ?? "intermediate";

    const updates: Record<string, unknown> = {
      userId: user.id,
      updatedAt: new Date().toISOString(),
    };

    if (body.category === "route") {
      // selected_index 0 = main (moderate), 1 = easier, 2 = harder
      if (body.selected_index === 2) {
        updates.fitnessLevel = stepFitness(currentFitness, "up");
      } else if (body.selected_index === 1) {
        updates.fitnessLevel = stepFitness(currentFitness, "down");
      }
    }

    if (body.category === "accommodation" && body.option_type) {
      // option_type comes from AccommodationAlternative.type
      const typeToPreference: Record<string, string> = {
        camping: "camping",
        hostel: "budget",
        hotel: "mid_range",
        guesthouse: "mid_range",
        luxury: "luxury",
      };
      const mapped = typeToPreference[body.option_type];
      if (mapped) updates.accommodationPreference = mapped;
    }

    if (Object.keys(updates).length > 2) {
      await adminDb.from("user_adventure_preferences").upsert(updates, {
        onConflict: '"userId"',
      });
    }
  } catch (err) {
    // Non-fatal: preference update is best-effort
    console.warn("Preference update failed:", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({ ok: true });
}
