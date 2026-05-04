import { PageHeader } from "@/components/shared/PageHeader";

export default function AnalyticsRegionsPage() {
  return (
    <div>
      <PageHeader title="Regions" description="Geographic breakdown of users, adventures, and engagement by region." />
      <div className="border border-slate-200 rounded-lg p-16 flex flex-col items-center justify-center text-center">
        <p className="text-3xl mb-3">🗺️</p>
        <h2 className="text-lg font-semibold text-dark mb-2">Coming soon</h2>
        <p className="text-sm text-grey-500 max-w-sm">Regional analytics will appear here once enough location data has been collected.</p>
      </div>
    </div>
  );
}
