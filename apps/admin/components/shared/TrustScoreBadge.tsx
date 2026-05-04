import { cn } from "@/lib/utils";

export function TrustScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colorClass = pct >= 70 ? "text-green-600" : pct >= 30 ? "text-amber-600" : "text-red-600";
  return (
    <span className={cn("font-mono text-sm", colorClass)}>
      {pct}%
    </span>
  );
}
