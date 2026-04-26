import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-grey-50">
      <Sidebar userEmail={user.email} />
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
