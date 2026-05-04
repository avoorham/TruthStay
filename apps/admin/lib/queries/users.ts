import { createAdminClient } from "@/lib/supabase/admin";

export async function getUsers() {
  const db = createAdminClient();

  // Pull public users with subscription info
  const { data: publicUsers, error } = await db
    .from("users")
    .select("*, user_subscriptions(status, plan_id, subscription_plans(name))")
    .order("created_date", { ascending: false });
  if (error) throw error;

  // Pull auth users to catch incomplete signups
  const { data: authData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = authData?.users ?? [];
  const publicIds = new Set((publicUsers ?? []).map((u: any) => u.id));

  const incomplete = authUsers
    .filter((au) => !publicIds.has(au.id))
    .map((au) => ({
      id: au.id,
      email: au.email ?? "",
      full_name: null,
      status: "incomplete_signup",
      created_date: au.created_at,
      user_subscriptions: [],
      content_count: 0,
    }));

  // Fetch content_entries counts per user
  const { data: contentCounts } = await db
    .from("content_entries")
    .select("created_by")
    .eq("source_type", "user");

  const countMap: Record<string, number> = {};
  for (const row of contentCounts ?? []) {
    if (row.created_by) countMap[row.created_by] = (countMap[row.created_by] ?? 0) + 1;
  }

  const enriched = (publicUsers ?? []).map((u: any) => ({
    ...u,
    content_count: countMap[u.id] ?? 0,
  }));

  return [...enriched, ...incomplete];
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

export async function getUserContributions(id: string) {
  const db = createAdminClient();

  const [contentRes, adventuresRes, postsRes] = await Promise.all([
    db.from("content_entries").select("id, name, type, verified, created_at").eq("created_by", id).eq("source_type", "user").order("created_at", { ascending: false }),
    db.from("adventures").select("id, title, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("posts").select("id, created_at").eq("user_id", id),
  ]);

  return {
    content: contentRes.data ?? [],
    adventures: adventuresRes.data ?? [],
    posts: postsRes.data ?? [],
  };
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
