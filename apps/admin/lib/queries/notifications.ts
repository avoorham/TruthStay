import { createAdminClient } from "@/lib/supabase/admin";

export async function getTemplates() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("notification_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAnnouncements() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getNotificationHistory() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("notification_sends")
    .select("*, notification_templates(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function createAnnouncement(ann: {
  title: string; body: string; link_url?: string; link_text?: string;
  priority?: string; ends_at?: string; dismissible?: boolean;
}) {
  const db = createAdminClient();
  const { error } = await db.from("announcements").insert(ann);
  if (error) throw error;
}

export async function toggleAnnouncement(id: string, is_active: boolean) {
  const db = createAdminClient();
  const { error } = await db.from("announcements").update({ is_active }).eq("id", id);
  if (error) throw error;
}
