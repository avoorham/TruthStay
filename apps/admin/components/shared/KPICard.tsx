import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  change?: number; // percentage, positive=up
  icon?: React.ElementType;
  accent?: "blue" | "green" | "blend";
}

export function KPICard({ label, value, sub, change, icon: Icon, accent = "blue" }: KPICardProps) {
  const accentClass = {
    blue: "bg-blue-light text-blue",
    green: "bg-green-light text-green-dark",
    blend: "bg-blend/15 text-blend",
  }[accent];

  const hasChange = change !== undefined;
  const up = (change ?? 0) > 0;
  const neutral = change === 0;

  return (
    <div className="bg-white rounded-xl border border-grey-300 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-grey-700 uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", accentClass)}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="font-display text-2xl font-bold text-dark tracking-tight">{value}</p>
      {(sub || hasChange) && (
        <div className="flex items-center gap-2 mt-1.5">
          {sub && <p className="text-xs text-grey-500">{sub}</p>}
          {hasChange && (
            <span className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              neutral ? "text-grey-500" : up ? "text-green-dark" : "text-danger"
            )}>
              {neutral ? <Minus size={12}/> : up ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
              {Math.abs(change!).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
