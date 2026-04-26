import { createAdminClient } from "@/lib/supabase/admin";

export async function getContentEntries(filters?: {
  type?: string; verified?: boolean; sourceType?: string;
}) {
  const db = createAdminClient();
  let q = db.from("content_entries").select("*").order("created_at", { ascending: false });
  if (filters?.type) q = q.eq("type", filters.type);
  if (filters?.verified !== undefined) q = q.eq("verified", filters.verified);
  if (filters?.sourceType) q = q.eq("source_type", filters.sourceType);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getContentEntry(id: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("content_entries").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function getReviewQueue() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("content_entries")
    .select("*")
    .eq("verified", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).sort(
    (a, b) => ((b.data as any)?.scoutScore ?? 0) - ((a.data as any)?.scoutScore ?? 0)
  );
}

export async function verifyEntry(id: string, verified: boolean) {
  const db = createAdminClient();
  const { error } = await db.from("content_entries").update({ verified }).eq("id", id);
  if (error) throw error;
}

export async function updateContentEntry(id: string, updates: Record<string, unknown>) {
  const db = createAdminClient();
  const { error } = await db.from("content_entries").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteContentEntry(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("content_entries").delete().eq("id", id);
  if (error) throw error;
}
