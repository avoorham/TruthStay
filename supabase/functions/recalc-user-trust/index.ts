import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface EntrySignal {
  id: string;
  source_trust_score: number;
  user_trust_score: number;
  verified: boolean;
  saves: number;
  net_positive: number | null;
}

interface Interaction {
  interaction_type: string;
  interaction_weight: number;
}

async function calculateUserTrustScore(entryId: string): Promise<number> {
  const { data: interactions } = await supabase
    .from("user_interactions")
    .select("interaction_type, interaction_weight")
    .eq("content_entry_id", entryId) as { data: Interaction[] | null };

  if (!interactions || interactions.length === 0) return 0.5;

  const counts = {
    saved: 0, shared: 0, rated_up: 0, selected: 0,
    viewed: 0, replaced: 0, skipped: 0, rated_down: 0,
  };

  for (const i of interactions) {
    const k = i.interaction_type as keyof typeof counts;
    if (k in counts) counts[k]++;
  }

  const positiveWeighty = counts.saved + counts.shared + counts.rated_up + counts.selected;
  const negativeSkips   = counts.skipped + counts.rated_down;

  let userTrust = 0.5;

  if (positiveWeighty > 0) {
    const positiveBoost = Math.min(0.5, positiveWeighty * 0.05 + counts.shared * 0.05);
    userTrust += positiveBoost;
  }

  if (negativeSkips >= 5 && negativeSkips > positiveWeighty * 2) {
    const negativePenalty = Math.min(0.4, (negativeSkips - 4) * 0.05);
    userTrust -= negativePenalty;
  }

  return Math.max(0.0, Math.min(1.0, userTrust));
}

async function checkAutoPromotionThreshold(entryId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_interactions")
    .select("interaction_type, interaction_weight")
    .eq("content_entry_id", entryId) as { data: Interaction[] | null };

  if (!data) return false;

  const saves      = data.filter(i => i.interaction_type === "saved").length;
  const netPositive = data.reduce((sum, i) => sum + i.interaction_weight, 0);

  return saves >= 3 && netPositive > 5;
}

serve(async (_req) => {
  try {
    const { data: entries, error } = await supabase.rpc("select_entries_needing_trust_recalc") as {
      data: EntrySignal[] | null;
      error: unknown;
    };

    if (error) {
      console.error("[recalc] RPC error:", error);
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
    }

    const batch = entries ?? [];
    let recalculated = 0;
    let auto_promoted = 0;

    for (const entry of batch) {
      const newUserTrust  = await calculateUserTrustScore(entry.id);
      const newCombined   = 0.4 * entry.source_trust_score + 0.6 * newUserTrust;
      const shouldPromote = !entry.verified && await checkAutoPromotionThreshold(entry.id);

      const updates: Record<string, unknown> = {
        user_trust_score: newUserTrust,
        trust_score:      newCombined,
      };

      if (shouldPromote) {
        updates.verified         = true;
        updates.status           = "approved";
        updates.auto_promoted_at = new Date().toISOString();
        auto_promoted++;
        console.log(`[recalc] auto-promoted ${entry.id} (user_trust=${newUserTrust.toFixed(2)})`);
      }

      const { error: updateError } = await supabase
        .from("content_entries")
        .update(updates)
        .eq("id", entry.id);

      if (updateError) {
        console.warn(`[recalc] update failed for ${entry.id}:`, updateError);
        continue;
      }

      recalculated++;
    }

    console.log(`[recalc] done: recalculated=${recalculated} auto_promoted=${auto_promoted}`);
    return new Response(JSON.stringify({ recalculated, auto_promoted }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[recalc] fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
