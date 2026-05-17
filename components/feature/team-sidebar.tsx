"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Smartphone, Warehouse, ArrowLeftRight } from "lucide-react";

const TEAM_NAV = [
  { href: "/team/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/team/activations", label: "Activations", icon: Smartphone },
  { href: "/team/inventory", label: "Inventory", icon: Warehouse },
  { href: "/team/cross-region", label: "Cross-Region", icon: ArrowLeftRight },
];

export function TeamSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
      <nav className="flex flex-col gap-1 p-3">
        {TEAM_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
