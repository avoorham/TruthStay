import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Extracts the numeric tour ID from any Komoot URL format:
//   https://www.komoot.com/tour/1234567890
//   https://www.komoot.com/tour/1234567890?ref=...
//   1234567890  (bare ID)
function extractKomootId(input: string): string | null {
  const trimmed = input.trim();
  // Bare numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed;
  // URL with /tour/{id}
  const match = trimmed.match(/komoot\.com\/(?:tour|smarttour)\/(\d+)/i);
  return match?.[1] ?? null;
}

// PATCH /api/adventures/[id]/days
// Body: { day_number: number, komoot_tour_id: string | null }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adventureId } = await params;

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

  let body: { day_number: number; komoot_tour_id: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve Komoot ID from URL or bare ID
  const komootTourId = body.komoot_tour_id
    ? extractKomootId(body.komoot_tour_id)
    : null;

  if (body.komoot_tour_id && !komootTourId) {
    return NextResponse.json(
      { error: "Could not extract a Komoot tour ID from that URL. Paste a link like https://www.komoot.com/tour/1234567890" },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient();

  // Verify the adventure belongs to this user
  const { data: adv } = await adminDb
    .from("adventures")
    .select("id")
    .eq("id", adventureId)
    .eq("userId", user.id)
    .single();

  if (!adv) return NextResponse.json({ error: "Adventure not found" }, { status: 404 });

  const { error } = await adminDb
    .from("adventure_days")
    .update({ komootTourId })
    .eq("adventureId", adventureId)
    .eq("dayNumber", body.day_number);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, komoot_tour_id: komootTourId });
}
