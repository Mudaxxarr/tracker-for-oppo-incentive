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

export function TeamBottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${TEAM_NAV.length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TEAM_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              isActive(item.href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
