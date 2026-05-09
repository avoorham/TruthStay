import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";

type RouteContext = { params: Promise<{ id: string; day_number: string }> };

// POST /api/adventures/{id}/days/{day_number}/content
// Adds a content_entry to a specific day via adventure_content_links.
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: adventureId, day_number } = await params;
  const dayNumber = parseInt(day_number, 10);
  if (isNaN(dayNumber)) return Response.json({ error: "Invalid day_number" }, { status: 400 });

  let body: { content_entry_id: string; role: string };
  try { body = await request.json() as { content_entry_id: string; role: string }; }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { content_entry_id, role } = body;
  if (!content_entry_id || !role) {
    return Response.json({ error: "content_entry_id and role required" }, { status: 400 });
  }

  const validRoles = ["highlight", "accommodation", "meal", "activity"];
  if (!validRoles.includes(role)) {
    return Response.json({ error: `role must be one of: ${validRoles.join(", ")}` }, { status: 400 });
  }

  const db = createAdminClient();

  type OldUserRow = { id: string };
  const { data: oldUser } = await db
    .from("users")
    .select("id")
    .eq("authId", user.id)
    .maybeSingle();

  const userId = (oldUser as OldUserRow | null)?.id ?? user.id;

  const { data: adventure, error: advErr } = await db
    .from("adventures")
    .select("id, \"userId\"")
    .eq("id", adventureId)
    .eq("userId", userId)
    .maybeSingle();

  if (advErr || !adventure) {
    return Response.json({ error: "Adventure not found or not yours" }, { status: 404 });
  }

  const { error: linkErr } = await db
    .from("adventure_content_links")
    .insert({
      adventure_id: adventureId,
      content_entry_id,
      day_number: dayNumber,
      role,
      was_selected: true,
      was_replaced: false,
    });

  if (linkErr) {
    return Response.json({ error: linkErr.message }, { status: 500 });
  }

  // Increment save_count (non-critical)
  try {
    await db.rpc("increment_save_count", { entry_ids: [content_entry_id] });
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
}
