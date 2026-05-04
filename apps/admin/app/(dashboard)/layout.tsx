import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar userEmail={user.email} />
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <div className="max-w-7xl mx-auto px-8 py-6 w-full flex-1 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
