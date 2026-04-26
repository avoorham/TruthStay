"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText, Users, BarChart2, DollarSign, Megaphone,
  Handshake, Bell, HeadphonesIcon, Settings, LogOut,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavGroup {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string }[];
}

const NAV: NavGroup[] = [
  {
    label: "Content",
    icon: FileText,
    children: [
      { label: "All Entries", href: "/content" },
      { label: "Review Queue", href: "/content/review-queue" },
    ],
  },
  { label: "Users", icon: Users, href: "/users" },
  {
    label: "Analytics",
    icon: BarChart2,
    children: [
      { label: "Overview", href: "/analytics" },
      { label: "Regions", href: "/analytics/regions" },
      { label: "Agent Runs", href: "/analytics/agent" },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    children: [
      { label: "Revenue", href: "/finance" },
      { label: "Subscriptions", href: "/finance/subscriptions" },
      { label: "Commissions", href: "/finance/commissions" },
      { label: "API Costs", href: "/finance/costs" },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    children: [
      { label: "Growth Metrics", href: "/marketing/growth" },
      { label: "Referrals", href: "/marketing/referrals" },
      { label: "Promo Codes", href: "/marketing/promos" },
      { label: "Campaigns", href: "/marketing/campaigns" },
    ],
  },
  {
    label: "Partners",
    icon: Handshake,
    children: [
      { label: "All Partners", href: "/partners" },
      { label: "Performance", href: "/partners/performance" },
    ],
  },
  {
    label: "Notifications",
    icon: Bell,
    children: [
      { label: "Send", href: "/notifications/send" },
      { label: "Templates", href: "/notifications/templates" },
      { label: "Announcements", href: "/notifications/announcements" },
      { label: "History", href: "/notifications/history" },
    ],
  },
  {
    label: "Support",
    icon: HeadphonesIcon,
    children: [
      { label: "Feedback", href: "/support/feedback" },
      { label: "Reports", href: "/support/reports" },
      { label: "Flagged", href: "/support/flagged" },
      { label: "Contacts", href: "/support/contacts" },
    ],
  },
  { label: "Settings", icon: Settings, href: "/settings" },
];

function NavItem({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const isActive = group.href
    ? pathname === group.href || (group.href !== "/" && pathname.startsWith(group.href))
    : group.children?.some((c) => pathname.startsWith(c.href)) ?? false;

  const [open, setOpen] = useState(isActive);
  const Icon = group.icon;

  if (!group.children) {
    return (
      <Link
        href={group.href!}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
          isActive
            ? "bg-blue/15 text-white"
            : "text-white/60 hover:text-white hover:bg-white/5"
        )}
      >
        <Icon size={16} className={isActive ? "text-blue" : ""} />
        {group.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
          isActive
            ? "text-white"
            : "text-white/60 hover:text-white hover:bg-white/5"
        )}
      >
        <Icon size={16} className={isActive ? "text-blue" : ""} />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="ml-7 mt-0.5 space-y-0.5">
          {group.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block px-3 py-1.5 rounded-lg text-xs transition",
                  childActive
                    ? "text-white bg-white/8 font-medium"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-60 shrink-0 bg-navy flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/8">
        <svg width="28" height="36" viewBox="0 0 56 72" fill="none">
          <rect x="6" y="18" width="44" height="14" rx="7" fill="#2ECDA7"/>
          <rect x="20" y="2" width="16" height="62" rx="8" fill="#0A7AFF"/>
          <rect x="20" y="18" width="16" height="14" fill="#5BC8D6" opacity="0.65"/>
        </svg>
        <div>
          <span className="font-display text-base font-bold text-white tracking-tight block">truthstay</span>
          <span className="text-white/40 text-[10px] font-medium tracking-widest uppercase">Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((group) => (
          <NavItem key={group.label} group={group} />
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/8">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue/20 flex items-center justify-center shrink-0">
            <span className="text-blue text-xs font-bold">
              {userEmail[0]?.toUpperCase()}
            </span>
          </div>
          <span className="text-white/70 text-xs truncate flex-1">{userEmail}</span>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
