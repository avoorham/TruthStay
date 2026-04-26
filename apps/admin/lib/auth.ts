import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminRole = "super_admin" | "admin" | "content_moderator" | "analyst" | "marketer";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data: adminRecord } = await db
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminRecord) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    role: adminRecord.role as AdminRole,
  };
}

export function canAccess(role: AdminRole, resource: string): boolean {
  const matrix: Record<string, AdminRole[]> = {
    content: ["super_admin", "admin", "content_moderator"],
    users: ["super_admin", "admin"],
    analytics: ["super_admin", "admin", "analyst"],
    finance: ["super_admin", "admin", "analyst"],
    marketing: ["super_admin", "admin", "marketer"],
    partners: ["super_admin", "admin"],
    notifications: ["super_admin", "admin", "marketer", "content_moderator"],
    support: ["super_admin", "admin", "content_moderator"],
    settings: ["super_admin"],
  };
  return (matrix[resource] ?? []).includes(role);
}
