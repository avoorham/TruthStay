import { createAdminClient } from "@/lib/supabase/admin";

export async function getPartners() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("booking_partners")
    .select("*, booking_commissions(commission_amount, status)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPartner(id: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("booking_partners")
    .select("*, booking_commissions(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPartner(partner: {
  name: string; type: string; contact_name?: string; contact_email?: string;
  website?: string; region?: string; commission_rate: number;
  contract_start_date?: string; contract_end_date?: string;
}) {
  const db = createAdminClient();
  const { error } = await db.from("booking_partners").insert(partner);
  if (error) throw error;
}

export async function updatePartner(id: string, updates: Record<string, unknown>) {
  const db = createAdminClient();
  const { error } = await db.from("booking_partners").update(updates).eq("id", id);
  if (error) throw error;
}
