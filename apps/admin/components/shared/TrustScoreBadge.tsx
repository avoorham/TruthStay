import { cn } from "@/lib/utils";

export function TrustScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "bg-green" : pct >= 40 ? "bg-warning" : "bg-danger";
  const textColor = pct >= 70 ? "text-green-dark" : pct >= 40 ? "text-warning" : "text-danger";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-grey-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs font-mono font-semibold w-8 text-right", textColor)}>
        {pct}%
      </span>
    </div>
  );
}
