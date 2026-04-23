import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/adventures — create a manually-authored adventure (trip wizard)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = createAdminClient();
  const { data: publicUser } = await adminDb
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();

  if (!publicUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: {
    title: string;
    region: string;
    activityType: string;
    durationDays: number;
    startDate?: string | null;
    description?: string;
    isPublic?: boolean;
    days?: Array<{
      dayNumber: number;
      title: string;
      description?: string;
      distanceKm?: number | null;
      elevationGainM?: number | null;
      cost?: number | null;
    }>;
  };

  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.title?.trim() || !body.region?.trim() || !body.activityType || !body.durationDays) {
    return NextResponse.json({ error: "title, region, activityType, durationDays required" }, { status: 400 });
  }

  const { data: adventure, error: advErr } = await adminDb
    .from("adventures")
    .insert({
      userId:        publicUser.id,
      title:         body.title.trim(),
      region:        body.region.trim(),
      activityType:  body.activityType,
      durationDays:  body.durationDays,
      startDate:     body.startDate ?? null,
      description:   body.description ?? null,
      requestPrompt: "Manual trip creation",
      isSaved:       true,
      isPublic:      body.isPublic ?? false,
    })
    .select("id")
    .single();

  if (advErr || !adventure) {
    return NextResponse.json({ error: advErr?.message ?? "Failed to create adventure" }, { status: 500 });
  }

  // Insert days if provided
  type DayInput = { dayNumber: number; title: string; description?: string; distanceKm?: number | null; elevationGainM?: number | null };
  const days: DayInput[] = body.days ?? Array.from({ length: body.durationDays }, (_, i) => ({
    dayNumber: i + 1,
    title:     `Day ${i + 1}`,
  }));

  if (days.length > 0) {
    await adminDb.from("adventure_days").insert(
      days.map(d => ({
        adventureId:    adventure.id,
        dayNumber:      d.dayNumber,
        title:          d.title || `Day ${d.dayNumber}`,
        description:    d.description ?? null,
        distanceKm:     d.distanceKm ?? null,
        elevationGainM: d.elevationGainM ?? null,
      })),
    );
  }

  return NextResponse.json({ id: adventure.id });
}

// GET /api/adventures — return saved adventures for the current user
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = createAdminClient();

  // Resolve public.users.id from the auth UUID — they are different columns.
  const { data: publicUser } = await adminDb
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();

  if (!publicUser) {
    return NextResponse.json([], { status: 200 });
  }

  const { data, error } = await adminDb
    .from("adventures")
    .select(`
      id, title, description, region, "activityType", "durationDays", "startDate", "createdAt",
      "coverImageUrl", meta,
      adventure_days(id, "dayNumber", title, description, "distanceKm", "elevationGainM", "routeNotes", "komootTourId", alternatives)
    `)
    .eq("userId", publicUser.id)
    .eq("isSaved", true)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("[adventures] DB error:", error.message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
