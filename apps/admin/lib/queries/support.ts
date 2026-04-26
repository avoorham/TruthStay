import { createAdminClient } from "@/lib/supabase/admin";

export async function getAdventureFeedback() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("adventure_feedback")
    .select("*, adventures(title, region)")
    .order("createdAt", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getUserReports() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSupportContacts() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("support_contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateReportStatus(id: string, status: string, resolution_notes?: string) {
  const db = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (resolution_notes) updates.resolution_notes = resolution_notes;
  if (status === "resolved" || status === "dismissed") updates.resolved_at = new Date().toISOString();
  const { error } = await db.from("user_reports").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateContactStatus(id: string, status: string) {
  const db = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") updates.resolved_at = new Date().toISOString();
  const { error } = await db.from("support_contacts").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateFeedbackStatus(id: string, admin_status: string, admin_notes?: string) {
  const db = createAdminClient();
  const { error } = await db.from("adventure_feedback").update({ admin_status, admin_notes }).eq("id", id);
  if (error) throw error;
}
