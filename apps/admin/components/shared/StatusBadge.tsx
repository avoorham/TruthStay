import { cn } from "@/lib/utils";

type Variant = "green" | "blue" | "yellow" | "red" | "grey" | "purple";

const VARIANT_MAP: Record<string, Variant> = {
  // Verified / active / success states
  true: "green", verified: "green", active: "green", completed: "green",
  approved: "green", confirmed: "green", paid: "green", sent: "green",
  delivered: "green", resolved: "green", opened: "green", running: "blue",
  // Warning / pending
  pending: "yellow", draft: "yellow", scheduled: "yellow", trialing: "yellow",
  acknowledged: "yellow", investigating: "yellow", new: "yellow",
  in_progress: "yellow", waiting_on_user: "yellow",
  // Error / bad states
  false: "red", failed: "red", cancelled: "red", rejected: "red",
  banned: "red", past_due: "red", terminated: "red", flagged: "red",
  dismissed: "red", wont_fix: "red",
  // Neutral
  agent: "blue", user: "purple", admin: "purple", onboarding: "blue",
  prospect: "grey", paused: "grey", closed: "grey", low: "grey",
  // Types
  route: "blue", accommodation: "green", restaurant: "yellow",
};

const STYLE: Record<Variant, string> = {
  green: "bg-green-light text-green-dark",
  blue:  "bg-blue-light text-blue-dark",
  yellow:"bg-warning-light text-warning",
  red:   "bg-danger-light text-danger",
  grey:  "bg-grey-100 text-grey-700",
  purple:"bg-lavender text-charcoal",
};

export function StatusBadge({ value, label }: { value: string | boolean; label?: string }) {
  const key = String(value).toLowerCase();
  const variant = VARIANT_MAP[key] ?? "grey";
  const display = label ?? String(value).replace(/_/g, " ");
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize", STYLE[variant])}>
      {display}
    </span>
  );
}
