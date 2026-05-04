import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function FinanceCostsPage() {
  return (
    <div>
      <PageHeader
        title="API Costs"
        description="AI and infrastructure cost breakdown by provider and model."
        actions={
          <Link href="/finance" className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-grey-700 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={14} /> Finance overview
          </Link>
        }
      />
      <div className="border border-slate-200 rounded-lg p-16 flex flex-col items-center justify-center text-center">
        <p className="text-3xl mb-3">⚡</p>
        <h2 className="text-lg font-semibold text-dark mb-2">Infrastructure costs are in the CFO</h2>
        <p className="text-sm text-grey-500 max-w-sm mb-5">Detailed infrastructure and API cost tracking, including usage meters, is in the CFO Command Centre under Infrastructure.</p>
        <Link href="/agents/cfo" className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors">
          CFO Command Centre <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
