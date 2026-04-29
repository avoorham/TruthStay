import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  change?: number; // percentage, positive=up
  icon?: React.ElementType;
  accent?: "teal" | "blue" | "green" | "blend";
  mono?: boolean; // render value in monospace (financial figures)
}

export function KPICard({ label, value, sub, change, icon: Icon, accent = "teal", mono = false }: KPICardProps) {
  const accentClass = {
    teal:  "bg-teal-light text-teal-dark",
    blue:  "bg-blue-light text-blue",
    green: "bg-green-light text-green-dark",
    blend: "bg-blend/15 text-blend",
  }[accent];

  const hasChange = change !== undefined;
  const up = (change ?? 0) > 0;
  const neutral = change === 0;

  return (
    <div className="bg-white rounded-2xl border border-grey-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-grey-500">{label}</p>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", accentClass)}>
            <Icon size={17} />
          </div>
        )}
      </div>
      <p className={cn(
        "text-3xl font-bold tracking-tight text-dark",
        mono && "font-mono"
      )}>
        {value}
      </p>
      {(sub || hasChange) && (
        <div className="flex items-center gap-2 mt-1.5">
          {sub && <p className="text-xs text-grey-500">{sub}</p>}
          {hasChange && (
            <span className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
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
