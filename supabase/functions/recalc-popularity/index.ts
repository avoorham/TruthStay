import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (_req) => {
  try {
    const { error: ceErr } = await supabase.rpc("recalc_content_entry_save_counts");
    if (ceErr) {
      console.error("[recalc-popularity] content_entries RPC error:", ceErr);
      return new Response(JSON.stringify({ error: String(ceErr) }), { status: 500 });
    }

    const { error: dcErr } = await supabase.rpc("recalc_destination_chip_save_counts");
    if (dcErr) {
      console.error("[recalc-popularity] destination_chips RPC error:", dcErr);
      return new Response(JSON.stringify({ error: String(dcErr) }), { status: 500 });
    }

    console.log("[recalc-popularity] done");
    return new Response(JSON.stringify({ updated: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[recalc-popularity] fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
