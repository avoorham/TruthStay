import { cn } from "@/lib/utils";

type Variant = "green" | "teal" | "blue" | "yellow" | "red" | "grey" | "purple";

const VARIANT_MAP: Record<string, Variant> = {
  true: "green", verified: "green", active: "green", completed: "green",
  approved: "green", confirmed: "green", paid: "green", sent: "green",
  delivered: "green", resolved: "green", opened: "green",
  running: "teal", onboarding: "teal",
  pending: "yellow", draft: "yellow", scheduled: "yellow", trialing: "yellow",
  acknowledged: "yellow", investigating: "yellow", new: "yellow",
  in_progress: "yellow", waiting_on_user: "yellow",
  false: "red", failed: "red", cancelled: "red", rejected: "red",
  banned: "red", past_due: "red", terminated: "red", flagged: "red",
  dismissed: "red", wont_fix: "red",
  agent: "blue", user: "purple", admin: "purple",
  prospect: "grey", paused: "grey", closed: "grey", low: "grey",
  route: "blue", accommodation: "green", restaurant: "yellow",
};

const DOT_COLOR: Record<Variant, string> = {
  green:  "bg-green-500",
  teal:   "bg-teal-500",
  blue:   "bg-blue-500",
  yellow: "bg-amber-500",
  red:    "bg-red-500",
  grey:   "bg-slate-400",
  purple: "bg-purple-500",
};

// Content/source types rendered as subtle slate pills (no dot)
const PILL_KEYS = new Set([
  "route", "accommodation", "restaurant", "poi",
  "agent", "user", "admin",
]);

export function StatusBadge({
  value,
  label,
  dot = true,
}: {
  value: string | boolean;
  label?: string;
  dot?: boolean;
}) {
  const key     = String(value).toLowerCase();
  const variant = VARIANT_MAP[key] ?? "grey";
  const display = label ?? String(value).replace(/_/g, " ");

  if (PILL_KEYS.has(key)) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-medium capitalize">
        {display}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 capitalize">
      {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", DOT_COLOR[variant])} />}
      {display}
    </span>
  );
}
