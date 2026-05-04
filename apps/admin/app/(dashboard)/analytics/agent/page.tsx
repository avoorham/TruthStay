import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function AnalyticsAgentPage() {
  return (
    <div>
      <PageHeader title="Agent Runs" description="Performance and run history across all autonomous agents." />
      <div className="border border-slate-200 rounded-lg p-16 flex flex-col items-center justify-center text-center">
        <p className="text-3xl mb-3">🤖</p>
        <h2 className="text-lg font-semibold text-dark mb-2">View in Agent Operations</h2>
        <p className="text-sm text-grey-500 max-w-sm mb-5">Detailed agent run analytics and spend data are available in the Agent Operations module.</p>
        <Link href="/agents" className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors">
          Go to Agent Operations <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
