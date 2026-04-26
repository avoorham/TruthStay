import { createAdminClient } from "@/lib/supabase/admin";

export async function getReferralCodes() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("referral_codes")
    .select("*, referral_conversions(id, status)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPromoCodes() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCampaigns() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPromoCode(promo: {
  code: string; description?: string; discount_type: string;
  discount_value: number; applies_to?: string; max_redemptions?: number;
  valid_until?: string;
}) {
  const db = createAdminClient();
  const { error } = await db.from("promo_codes").insert(promo);
  if (error) throw error;
}

export async function togglePromoCode(id: string, is_active: boolean) {
  const db = createAdminClient();
  const { error } = await db.from("promo_codes").update({ is_active }).eq("id", id);
  if (error) throw error;
}

export async function createCampaign(campaign: {
  name: string; subject: string; body_html?: string; body_text?: string;
  segment_query?: object; scheduled_at?: string;
}) {
  const db = createAdminClient();
  const { error } = await db.from("email_campaigns").insert(campaign);
  if (error) throw error;
}
