import { createClient } from "@supabase/supabase-js";

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;

/**
 * Creates a typed Supabase client.
 * Pass SUPABASE_URL and SUPABASE_ANON_KEY from your environment.
 */
export function createSupabaseClient(url: string, anonKey: string) {
  return createClient(url, anonKey);
}
