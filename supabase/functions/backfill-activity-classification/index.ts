import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.93.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

function parseJsonFromResponse(text: string): Array<{ i: number; type: string }> {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

serve(async (_req) => {
  const { data: entries, error } = await supabase
    .from("content_entries")
    .select("id, name, description, region")
    .eq("type", "activity");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return new Response(JSON.stringify({ message: "No activity entries to reclassify" }));
  }

  const prompt = `For each entry below, classify as either "activity" (sport/physical exertion) or "things_to_do" (casual/cultural).

CLASSIFICATION RULE:
- activity: requires physical exertion or sport gear (surfing, kayaking, biking, climbing, day-hiking with significant effort)
- things_to_do: casual/cultural (beaches for relaxing/viewing, viewpoints, monuments, museums, parks, lighthouses, neighborhoods, scenic spots, boardwalks)
- When ambiguous, prefer how the description primarily frames the entity

Entries to classify:
${entries.map((e, i) =>
  `${i + 1}. ${e.name}${e.region ? ` (${e.region})` : ""}: ${e.description ?? "(no description)"}`
).join("\n\n")}

Return as a JSON array matching input order:
[{"i": 1, "type": "activity"}, {"i": 2, "type": "things_to_do"}, ...]
Only valid values for "type" are "activity" and "things_to_do".
Return ONLY the JSON array, no prose.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseJsonFromResponse(responseText);

  let reclassified = 0;
  const errors: string[] = [];

  for (const item of parsed) {
    const entry = entries[item.i - 1];
    if (!entry) continue;
    if (item.type !== "activity" && item.type !== "things_to_do") continue;
    if (item.type === "activity") continue; // no change needed

    const { error: updateError } = await supabase
      .from("content_entries")
      .update({ type: item.type })
      .eq("id", entry.id);

    if (updateError) {
      errors.push(`${entry.name}: ${updateError.message}`);
    } else {
      reclassified++;
    }
  }

  return new Response(
    JSON.stringify({
      total_processed: entries.length,
      reclassified,
      remained_activity: entries.length - reclassified,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
