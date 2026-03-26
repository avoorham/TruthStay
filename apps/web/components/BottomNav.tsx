"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Sparkles, Map, User } from "lucide-react";

const navItems = [
  { icon: Home, label: "Feed", path: "/feed" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Sparkles, label: "Discover", path: "/discover" },
  { icon: Map, label: "My Trips", path: "/mytrips" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#dadccb] flex justify-around items-center h-16 max-w-[390px] mx-auto z-50">
      {navItems.map(({ icon: Icon, label, path }) => (
        <Link
          key={path}
          href={path}
          className={`flex flex-col items-center justify-center gap-1 ${
            isActive(path) ? "text-black" : "text-[#717182]"
          }`}
        >
          <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 1.5} />
          <span className="text-xs">{label}</span>
        </Link>
      ))}
    </div>
  );
}
