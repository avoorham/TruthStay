import { NextRequest } from "next/server";

// POST /api/discovery/scout-region
// Fires a background Scout run for an unknown destination.
// Returns immediately — the scout runs async.
export async function POST(request: NextRequest) {
  let body: { region: string };
  try { body = await request.json() as { region: string }; }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { region } = body;
  if (!region?.trim()) return Response.json({ error: "region required" }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    fetch(`${supabaseUrl}/functions/v1/scout-locations`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        region:       region.trim(),
        vacationType: "mixed",
        contentTypes: ["accommodation", "restaurant", "activity"],
        maxResults:   10,
        depth:        "standard",
      }),
    }).catch(() => {}); // fire and forget
  }

  return Response.json({ ok: true, region: region.trim() });
}
