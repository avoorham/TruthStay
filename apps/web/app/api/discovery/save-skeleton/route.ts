import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

interface AccommodationStop {
  destination: string;
  nights: number;
  night_numbers: number[];
}

interface SkeletonDay {
  day_number: number;
  destination: string;
  title: string;
}

interface Skeleton {
  title: string;
  description?: string;
  activity_type?: string;
  duration_days: number;
  accommodation_stops: AccommodationStop[];
  days: SkeletonDay[];
}

interface RequestBody {
  skeleton: Skeleton;
  start_date?: string | null;
  region: string;
  source_entry_ids?: string[];
}

// POST /api/discovery/save-skeleton
// Persists a skeleton trip as an adventure with isSaved=true immediately.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { skeleton, start_date, region, source_entry_ids } = body;
  if (!skeleton?.title || !skeleton?.duration_days || !region) {
    return Response.json({ error: "skeleton.title, skeleton.duration_days, region required" }, { status: 400 });
  }

  const db = createAdminClient();

  const requestPrompt = `${skeleton.duration_days}-day trip to ${region}`;

  // Use the auth UUID directly as userId (matches existing adventures pattern)
  const { data: adventureRow, error: advErr } = await db
    .from("adventures")
    .insert({
      userId:       user.id,
      title:        skeleton.title,
      description:  skeleton.description ?? null,
      region,
      activityType: skeleton.activity_type ?? "other",
      durationDays: skeleton.duration_days,
      startDate:    start_date ?? null,
      requestPrompt,
      isSaved:      true,
    })
    .select("id")
    .single();

  if (advErr || !adventureRow) {
    return Response.json({ error: advErr?.message ?? "Failed to create adventure" }, { status: 500 });
  }

  const adventureId = adventureRow.id as string;

  // Insert one adventure_day per day (skeleton — all content fields null)
  const dayRows = skeleton.days.map(day => {
    const stop = skeleton.accommodation_stops.find(s => s.night_numbers.includes(day.day_number));
    return {
      adventureId,
      dayNumber:      day.day_number,
      title:          day.title,
      description:    null,
      distanceKm:     null,
      elevationGainM: null,
      routeNotes:     null,
      alternatives: {
        destination:       day.destination,
        accommodationStop: stop ? { destination: stop.destination, night_numbers: stop.night_numbers } : null,
      },
    };
  });

  const { error: daysErr } = await db.from("adventure_days").insert(dayRows);
  if (daysErr) {
    // Clean up the adventure row if day insert fails
    await db.from("adventures").delete().eq("id", adventureId);
    return Response.json({ error: daysErr.message }, { status: 500 });
  }

  // Increment save_count for source content_entries (non-critical)
  if (source_entry_ids?.length) {
    try { await db.rpc("increment_save_count", { entry_ids: source_entry_ids }); } catch { /* non-critical */ }
  }

  return Response.json({ adventureId });
}
