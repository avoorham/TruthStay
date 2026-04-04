import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const db = createAdminClient();
  const { data: adminRow } = await db
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminRow) redirect("/");

  return <>{children}</>;
}
