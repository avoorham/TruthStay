"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText, Users, BarChart2, DollarSign, Megaphone,
  Handshake, Bell, HeadphonesIcon, Settings, LogOut,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Bot,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ─── Nav structure ─────────────────────────────────────────────────────────────

interface NavChild { label: string; href: string }
interface NavGroup  { label: string; icon: React.ElementType; href?: string; children?: NavChild[] }
interface NavSection { section: string; items: NavGroup[] }

const NAV_SECTIONS: NavSection[] = [
  {
    section: "PLATFORM",
    items: [
      {
        label: "Content", icon: FileText,
        children: [
          { label: "All Entries",   href: "/content" },
          { label: "Review Queue",  href: "/content/review-queue" },
        ],
      },
      { label: "Users", icon: Users, href: "/users" },
    ],
  },
  {
    section: "INSIGHTS",
    items: [
      {
        label: "Analytics", icon: BarChart2,
        children: [
          { label: "Overview",    href: "/analytics" },
          { label: "Regions",     href: "/analytics/regions" },
          { label: "Agent Runs",  href: "/analytics/agent" },
        ],
      },
      {
        label: "Finance", icon: DollarSign,
        children: [
          { label: "Revenue",        href: "/finance" },
          { label: "Subscriptions",  href: "/finance/subscriptions" },
          { label: "Commissions",    href: "/finance/commissions" },
          { label: "API Costs",      href: "/finance/costs" },
        ],
      },
    ],
  },
  {
    section: "GROWTH",
    items: [
      {
        label: "Marketing", icon: Megaphone,
        children: [
          { label: "Overview",        href: "/marketing" },
          { label: "Editorial Posts", href: "/marketing/editorial" },
          { label: "Campaigns",       href: "/marketing/campaigns" },
          { label: "Social",          href: "/marketing/social" },
          { label: "Referrals",       href: "/marketing/referrals" },
          { label: "Growth",          href: "/marketing/growth" },
          { label: "Agent Activity",  href: "/marketing/agent" },
        ],
      },
      {
        label: "Partners", icon: Handshake,
        children: [
          { label: "All Partners", href: "/partners" },
          { label: "Performance",  href: "/partners/performance" },
        ],
      },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      {
        label: "Agents", icon: Bot,
        children: [
          { label: "Overview",        href: "/agents" },
          { label: "CFO",             href: "/agents/cfo" },
          { label: "Location Scout",  href: "/agents/location-scout" },
          { label: "Scout Rubric",    href: "/agents/rubric" },
          { label: "Marketing",       href: "/agents/marketing" },
          { label: "Pricing",         href: "/agents/pricing" },
        ],
      },
      {
        label: "Notifications", icon: Bell,
        children: [
          { label: "Send",           href: "/notifications/send" },
          { label: "Templates",      href: "/notifications/templates" },
          { label: "Announcements",  href: "/notifications/announcements" },
          { label: "History",        href: "/notifications/history" },
        ],
      },
      {
        label: "Support", icon: HeadphonesIcon,
        children: [
          { label: "Feedback",  href: "/support/feedback" },
          { label: "Reports",   href: "/support/reports" },
          { label: "Flagged",   href: "/support/flagged" },
          { label: "Contacts",  href: "/support/contacts" },
        ],
      },
    ],
  },
];

// ─── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  group, collapsed,
}: { group: NavGroup; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = group.href
    ? pathname === group.href || pathname.startsWith(group.href + "/")
    : group.children?.some(c => pathname === c.href || pathname.startsWith(c.href + "/")) ?? false;

  const [open, setOpen] = useState(isActive);
  const Icon = group.icon;

  if (!group.children) {
    return (
      <Link
        href={group.href!}
        title={collapsed ? group.label : undefined}
        className={cn(
          "flex items-center py-2 px-3 rounded-md text-sm transition-colors relative group mb-1",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-slate-800 text-white border-l-2 border-teal-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        )}
      >
        <Icon size={16} className={cn("shrink-0", isActive ? "opacity-100" : "opacity-70", !collapsed && "mr-3")} />
        {!collapsed && <span className="font-medium">{group.label}</span>}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg border border-white/10">
            {group.label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => { if (!collapsed) setOpen(o => !o); }}
        title={collapsed ? group.label : undefined}
        className={cn(
          "w-full flex items-center py-2 px-3 rounded-md text-sm transition-colors relative group",
          collapsed && "justify-center px-0",
          isActive
            ? "text-white"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        )}
      >
        <Icon size={16} className={cn("shrink-0", isActive ? "opacity-100 text-teal-400" : "opacity-70", !collapsed && "mr-3")} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left font-medium">{group.label}</span>
            <ChevronDown
              size={13}
              className={cn("text-slate-500 transition-transform", open && "rotate-180")}
            />
          </>
        )}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg border border-white/10">
            {group.label}
          </span>
        )}
      </button>

      {open && !collapsed && (
        <div className="mt-0.5 ml-6 space-y-0.5 border-l border-white/8 pl-3">
          {group.children.map(child => {
            const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block py-1.5 px-2 rounded-md text-xs transition-colors",
                  childActive
                    ? "text-white font-medium bg-slate-800/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
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

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [collapsed, setCollapsed] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "shrink-0 bg-navy flex flex-col h-screen sticky top-0 overflow-y-auto overflow-x-hidden transition-all duration-200",
        collapsed ? "w-[56px]" : "w-60"
      )}
    >
      {/* ── Logo / brand ── */}
      <div className={cn(
        "flex items-center gap-2.5 border-b border-white/8 shrink-0",
        collapsed ? "px-0 py-4 justify-center" : "px-4 py-4"
      )}>
        <svg width="24" height="30" viewBox="0 0 56 72" fill="none" className="shrink-0">
          <rect x="6" y="18" width="44" height="14" rx="7" fill="#2ECDA7"/>
          <rect x="20" y="2" width="16" height="62" rx="8" fill="#0A7AFF"/>
          <rect x="20" y="18" width="16" height="14" fill="#5BC8D6" opacity="0.65"/>
        </svg>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-display text-sm font-bold text-white tracking-tight block leading-none">truthstay</span>
            <span className="text-slate-500 text-[10px] font-medium tracking-widest uppercase">Admin</span>
          </div>
        )}
      </div>

      {/* ── Account chip ── */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/4 border border-white/6">
            <div className="w-5 h-5 rounded-full bg-teal-400/20 flex items-center justify-center shrink-0">
              <span className="text-teal-400 text-[10px] font-bold leading-none">
                {userEmail[0]?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-white/60 text-xs truncate block">{userEmail}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Nav sections ── */}
      <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.section} className={si > 0 ? "mt-8" : ""}>
            {!collapsed && (
              <p className="text-[11px] font-medium tracking-widest uppercase text-slate-500 mb-2 px-3 select-none">
                {section.section}
              </p>
            )}
            {collapsed && si > 0 && (
              <div className="border-t border-white/8 mb-3 mt-1" />
            )}
            <div>
              {section.items.map(group => (
                <NavItem key={group.label} group={group} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className={cn("shrink-0 border-t border-white/8 py-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center py-2 px-3 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors group relative mb-1",
            collapsed && "justify-center px-0"
          )}
        >
          <Settings size={16} className={cn("shrink-0 opacity-70", !collapsed && "mr-3")} />
          {!collapsed && <span>Settings</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg border border-white/10">
              Settings
            </span>
          )}
        </Link>

        <button
          onClick={signOut}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "w-full flex items-center py-2 px-3 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors group relative mb-1",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut size={16} className={cn("shrink-0 opacity-70", !collapsed && "mr-3")} />
          {!collapsed && <span>Sign out</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg border border-white/10">
              Sign out
            </span>
          )}
        </button>

        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "w-full flex items-center py-2 px-3 rounded-md text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed
            ? <PanelLeftOpen  size={16} className="shrink-0 opacity-70" />
            : <PanelLeftClose size={16} className={cn("shrink-0 opacity-70", "mr-3")} />}
          {!collapsed && <span>Collapse menu</span>}
        </button>
      </div>
    </aside>
  );
}
