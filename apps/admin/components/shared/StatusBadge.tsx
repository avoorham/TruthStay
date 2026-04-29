import { cn } from "@/lib/utils";

type Variant = "green" | "teal" | "blue" | "yellow" | "red" | "grey" | "purple";

const VARIANT_MAP: Record<string, Variant> = {
  // Verified / active / success states
  true: "green", verified: "green", active: "green", completed: "green",
  approved: "green", confirmed: "green", paid: "green", sent: "green",
  delivered: "green", resolved: "green", opened: "green",
  // Running / info states
  running: "teal", onboarding: "teal",
  // Warning / pending
  pending: "yellow", draft: "yellow", scheduled: "yellow", trialing: "yellow",
  acknowledged: "yellow", investigating: "yellow", new: "yellow",
  in_progress: "yellow", waiting_on_user: "yellow",
  // Error / bad states
  false: "red", failed: "red", cancelled: "red", rejected: "red",
  banned: "red", past_due: "red", terminated: "red", flagged: "red",
  dismissed: "red", wont_fix: "red",
  // Neutral
  agent: "blue", user: "purple", admin: "purple",
  prospect: "grey", paused: "grey", closed: "grey", low: "grey",
  // Content types
  route: "blue", accommodation: "green", restaurant: "yellow",
};

const DOT_COLOR: Record<Variant, string> = {
  green:  "bg-green-600",
  teal:   "bg-teal",
  blue:   "bg-blue",
  yellow: "bg-warning",
  red:    "bg-danger",
  grey:   "bg-grey-500",
  purple: "bg-purple-500",
};

const PILL_STYLE: Record<Variant, string> = {
  green:  "bg-green-light text-green-dark",
  teal:   "bg-teal-light text-teal-dark",
  blue:   "bg-blue-light text-blue-dark",
  yellow: "bg-warning-light text-warning",
  red:    "bg-danger-light text-danger",
  grey:   "bg-grey-100 text-grey-700",
  purple: "bg-lavender text-charcoal",
};

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

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
      PILL_STYLE[variant]
    )}>
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_COLOR[variant])} />}
      {display}
    </span>
  );
}
