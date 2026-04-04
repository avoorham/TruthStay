import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { OPERATIONAL_COSTS, CURRENT_MONTHLY_FIXED_EUR, SCALE_MONTHLY_FIXED_EUR, BREAK_EVEN_CURRENT, BREAK_EVEN_SCALE } from "@/lib/finance/business-models";

// GET /api/finance/metrics — live dashboard metrics (admin only)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: adminRow } = await db
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    adventuresTotal,
    adventuresThisMonth,
    adventuresPublic,
    adventuresSaved,
    feedbackTotal,
    usersResult,
  ] = await Promise.all([
    db.from("adventures").select("*", { count: "exact", head: true }),
    db.from("adventures").select("*", { count: "exact", head: true }).gte("createdAt", startOfMonth.toISOString()),
    db.from("adventures").select("*", { count: "exact", head: true }).eq("isPublic", true),
    db.from("adventures").select("*", { count: "exact", head: true }).eq("isSaved", true),
    db.from("adventure_feedback").select("*", { count: "exact", head: true }),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  return NextResponse.json({
    users: {
      total: usersResult.data?.users?.length ?? 0,
    },
    adventures: {
      total:      adventuresTotal.count      ?? 0,
      thisMonth:  adventuresThisMonth.count  ?? 0,
      public:     adventuresPublic.count     ?? 0,
      saved:      adventuresSaved.count      ?? 0,
    },
    feedback: {
      total: feedbackTotal.count ?? 0,
    },
    costs: {
      items:              OPERATIONAL_COSTS,
      monthlyFixedEUR:    CURRENT_MONTHLY_FIXED_EUR,
      monthlyAtScaleEUR:  SCALE_MONTHLY_FIXED_EUR,
      breakEvenCurrent:   BREAK_EVEN_CURRENT,
      breakEvenScale:     BREAK_EVEN_SCALE,
    },
    revenue: {
      mrrEUR: 0,
      arrEUR: 0,
      proSubscribers: 0,
    },
  });
}
