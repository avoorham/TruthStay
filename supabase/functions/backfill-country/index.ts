import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient }  from "npm:@supabase/supabase-js@2";
import Anthropic         from "npm:@anthropic-ai/sdk";

const DELAY_MS                    = 100;
const PLACES_COST_PER_CALL        = 0.017;

function extractCountryFromAddressComponents(
  components: Array<{ long_name?: string; types?: string[] }> | undefined,
): string | null {
  if (!Array.isArray(components)) return null;
  const c = components.find(c => Array.isArray(c?.types) && c.types.includes("country"));
  return c?.long_name ?? null;
}

Deno.serve(async (_req) => {
  const supabaseUrl  = Deno.env.get("SUPABASE_URL")         ?? "";
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const placesKey    = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")    ?? "";

  const db        = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let updated    = 0;
  let failed     = 0;
  let placesCalls = 0;

  // ── Phase 1: entries with place_id — Place Details API ───────────────────────

  const { data: withPlaceId } = await db
    .from("content_entries")
    .select("id, name, place_id")
    .is("country", null)
    .not("place_id", "is", null) as { data: Array<{ id: string; name: string; place_id: string }> | null };

  for (const entry of (withPlaceId ?? [])) {
    try {
      const params = new URLSearchParams({
        place_id: entry.place_id,
        fields:   "address_components",
        language: "en",
        key:      placesKey,
      });
      const res    = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
      const data   = await res.json() as { result?: { address_components?: Array<{ long_name?: string; types?: string[] }> } };
      placesCalls++;
      const country = extractCountryFromAddressComponents(data.result?.address_components);
      if (country) {
        await db.from("content_entries").update({ country }).eq("id", entry.id);
        updated++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // ── Phase 2: entries without place_id — batch Claude call ────────────────────

  const { data: withoutPlaceId } = await db
    .from("content_entries")
    .select("id, name, region")
    .is("country", null)
    .is("place_id", null) as { data: Array<{ id: string; name: string; region: string | null }> | null };

  const noPlaceEntries = withoutPlaceId ?? [];

  if (noPlaceEntries.length > 0) {
    try {
      const list = noPlaceEntries
        .map((e, i) => `${i + 1}. ${e.name}${e.region ? ` (${e.region})` : ""}`)
        .join("\n");

      const msg = await anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role:    "user",
          content: `For each place below, return its country in English. Output ONLY a JSON array in input order — no prose, no markdown fences.

${list}

Return: [{"i": 1, "country": "Portugal"}, {"i": 2, "country": null}, ...]`,
        }],
      });

      const raw      = (msg.content.find(b => b.type === "text") as { text?: string })?.text ?? "";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ i: number; country: string | null }>;
        for (const item of parsed) {
          const entry = noPlaceEntries[item.i - 1];
          if (entry && item.country) {
            await db.from("content_entries").update({ country: item.country }).eq("id", entry.id);
            updated++;
          }
        }
      }
    } catch (err) {
      console.error("[backfill-country] Claude phase failed:", err);
      failed += noPlaceEntries.length;
    }
  }

  const costUsd = placesCalls * PLACES_COST_PER_CALL;

  return new Response(JSON.stringify({
    updated,
    failed,
    place_id_phase:  withPlaceId?.length ?? 0,
    claude_phase:    noPlaceEntries.length,
    places_calls:    placesCalls,
    cost_usd:        Math.round(costUsd * 10_000) / 10_000,
  }), { headers: { "Content-Type": "application/json" } });
});
