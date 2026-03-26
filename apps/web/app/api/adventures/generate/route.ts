import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateAdventure,
  saveAdventure,
  type GenerateAdventureInput,
} from "@/lib/agent/adventure-agent";

export async function POST(request: NextRequest) {
  // 1. Authenticate the user
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate request body
  let body: Partial<GenerateAdventureInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.region || !body.activityType || !body.durationDays) {
    return NextResponse.json(
      { error: "region, activityType, and durationDays are required" },
      { status: 400 }
    );
  }

  if (body.durationDays < 1 || body.durationDays > 21) {
    return NextResponse.json(
      { error: "durationDays must be between 1 and 21" },
      { status: 400 }
    );
  }

  const input: GenerateAdventureInput = {
    userId: user.id,
    region: body.region,
    activityType: body.activityType,
    durationDays: body.durationDays,
    startDate: body.startDate,
    additionalNotes: body.additionalNotes,
  };

  // 3. Build request prompt for logging
  const requestPrompt = [
    `${input.durationDays}-day ${input.activityType} adventure in ${input.region}`,
    input.startDate ? `starting ${input.startDate}` : null,
    input.additionalNotes ? `Notes: ${input.additionalNotes}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // 4. Run the agent (uses admin client for DB queries — bypasses RLS)
  const adminDb = createAdminClient();

  try {
    const adventure = await generateAdventure(adminDb, input);
    const adventureId = await saveAdventure(adminDb, user.id, requestPrompt, adventure);

    return NextResponse.json({
      adventure_id: adventureId,
      adventure,
    });
  } catch (err) {
    console.error("Adventure generation failed:", err);
    return NextResponse.json(
      {
        error: "Adventure generation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
