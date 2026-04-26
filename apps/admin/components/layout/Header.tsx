import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb { label: string; href?: string }

export function Header({ crumbs, actions }: { crumbs: Crumb[]; actions?: React.ReactNode }) {
  return (
    <header className="h-14 border-b border-grey-300 bg-white flex items-center justify-between px-6 shrink-0">
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="text-grey-500" />}
            {crumb.href && i < crumbs.length - 1 ? (
              <Link href={crumb.href} className="text-grey-700 hover:text-dark transition">
                {crumb.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "text-dark font-semibold" : "text-grey-700"}>
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
