import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  change?: number;
  icon?: React.ElementType;
  accent?: "teal" | "blue" | "green" | "blend";
  mono?: boolean;
}

export function KPICard({ label, value, sub, change, icon: Icon, mono = false }: KPICardProps) {
  const hasChange = change !== undefined;
  const up = (change ?? 0) > 0;
  const neutral = change === 0;

  return (
    <div className="border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
      </div>
      <p className={cn(
        "text-2xl font-normal text-slate-900",
        mono && "font-mono"
      )}>
        {value}
      </p>
      {(sub || hasChange) && (
        <div className="flex items-center gap-2 mt-1">
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
          {hasChange && (
            <span className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              neutral ? "text-slate-500" : up ? "text-green-600" : "text-red-600"
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
