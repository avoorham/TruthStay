import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function FinanceCommissionsPage() {
  return (
    <div>
      <PageHeader
        title="Commissions"
        description="Booking commission income from partner integrations."
        actions={
          <Link href="/finance" className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={14} /> Finance overview
          </Link>
        }
      />
      <div className="border border-slate-200 rounded-lg p-16 flex flex-col items-center justify-center text-center">
        <p className="text-3xl mb-3">🤝</p>
        <h2 className="text-lg font-semibold text-dark mb-2">Commission detail view</h2>
        <p className="text-sm text-grey-500 max-w-sm">Commission breakdown by partner is available on the Revenue tab of the Finance overview.</p>
      </div>
    </div>
  );
}
