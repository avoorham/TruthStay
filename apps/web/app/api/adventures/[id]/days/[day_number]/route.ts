import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

type RouteContext = { params: Promise<{ id: string; day_number: string }> };

// DELETE /api/adventures/{id}/days/{day_number}
// Removes a day from a skeleton trip and renumbers remaining days.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: adventureId, day_number } = await params;
  const dayNumber = parseInt(day_number, 10);
  if (isNaN(dayNumber)) return Response.json({ error: "Invalid day_number" }, { status: 400 });

  const db = createAdminClient();

  type OldUserRow = { id: string };
  const OLD_USERS = "_old_users" as unknown as Parameters<typeof db.from>[0];
  const { data: oldUser } = await db
    .from(OLD_USERS)
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();

  const userId = (oldUser as OldUserRow | null)?.id ?? user.id;

  const { data: adventure, error: advErr } = await db
    .from("adventures")
    .select("id, \"durationDays\", \"userId\"")
    .eq("id", adventureId)
    .eq("userId", userId)
    .maybeSingle();

  if (advErr || !adventure) {
    return Response.json({ error: "Adventure not found or not yours" }, { status: 404 });
  }

  const adv = adventure as { id: string; durationDays: number };

  if (adv.durationDays <= 1) {
    return Response.json({ error: "Cannot remove the last day" }, { status: 400 });
  }

  const { error: delErr } = await db
    .from("adventure_days")
    .delete()
    .eq("adventureId", adventureId)
    .eq("dayNumber", dayNumber);

  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

  // Renumber days after the deleted one
  type DayIdRow = { id: string; dayNumber: number };
  const { data: laterDays } = await db
    .from("adventure_days")
    .select("id, \"dayNumber\"")
    .eq("adventureId", adventureId)
    .gt("dayNumber", dayNumber)
    .order("dayNumber", { ascending: true });

  for (const d of (laterDays ?? []) as DayIdRow[]) {
    await db
      .from("adventure_days")
      .update({ dayNumber: d.dayNumber - 1 })
      .eq("id", d.id);
  }

  await db
    .from("adventures")
    .update({ durationDays: adv.durationDays - 1 })
    .eq("id", adventureId);

  return Response.json({ ok: true, newDurationDays: adv.durationDays - 1 });
}
