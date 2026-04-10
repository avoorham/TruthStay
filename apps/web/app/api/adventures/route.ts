import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

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
