import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { BottomNav } from "../../components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto relative">
      {children}
      <BottomNav />
    </div>
  );
}
