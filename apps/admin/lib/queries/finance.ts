import { createAdminClient } from "@/lib/supabase/admin";

export async function getSubscriptionPlans() {
  const db = createAdminClient();
  const { data, error } = await db.from("subscription_plans").select("*").eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

export async function getSubscriptions() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_subscriptions")
    .select("*, subscription_plans(name, price_monthly), users(email, full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCommissions() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("booking_commissions")
    .select("*, booking_partners(name)")
    .order("booked_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getApiCosts() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("api_cost_log")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCostBudgets() {
  const db = createAdminClient();
  const { data, error } = await db.from("cost_budgets").select("*").eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}
