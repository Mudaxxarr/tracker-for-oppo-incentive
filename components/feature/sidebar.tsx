"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from "./nav-config";
import type { StaffRole } from "@/lib/constants";

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  );
}

export function Sidebar({ staffRole }: { staffRole?: StaffRole | null }) {
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!staffRole) return true; // owner sees all
    return item.roles?.includes(staffRole) ?? false;
  });

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
      <nav className="flex flex-col gap-1 p-3">
        {staffRole && (
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
            {staffRole === "so" ? "Sales Officer" : "Accountant"}
          </p>
        )}
        {visibleItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}

        {!staffRole && (
          <>
            <div className="my-2 border-t" />
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Admin
            </p>
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
