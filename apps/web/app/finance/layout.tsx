import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const secret = process.env.FINANCE_SECRET_KEY;
  if (!secret) redirect("/");

  const cookieStore = await cookies();
  const auth = cookieStore.get("finance_auth");

  if (!auth || auth.value !== secret) redirect("/");

  return <>{children}</>;
}
