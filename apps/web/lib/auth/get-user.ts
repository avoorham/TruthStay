import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the authenticated user from either:
 * 1. Authorization: Bearer <token>  (mobile app)
 * 2. Supabase session cookie         (web app)
 */
export async function getAuthUser(request: NextRequest): Promise<User | null> {
  // 1. Bearer token (mobile)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const adminDb = createAdminClient();
    const { data: { user } } = await adminDb.auth.getUser(token);
    return user ?? null;
  }

  // 2. Cookie-based session (web)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
