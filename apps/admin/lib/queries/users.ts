import { createAdminClient } from "@/lib/supabase/admin";

export async function getUsers() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .select("*, user_subscriptions(status, plan_id, subscription_plans(name))")
    .order("created_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getUser(id: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateUserStatus(id: string, status: string) {
  const db = createAdminClient();
  const { error } = await db.from("users").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function getAdminUsers() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_users")
    .select("user_id, role, created_at");
  if (error) throw error;
  return data ?? [];
}

export async function setAdminRole(userId: string, role: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("admin_users")
    .upsert({ user_id: userId, role });
  if (error) throw error;
}

export async function removeAdminRole(userId: string) {
  const db = createAdminClient();
  const { error } = await db.from("admin_users").delete().eq("user_id", userId);
  if (error) throw error;
}
