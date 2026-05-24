"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { NAV_ITEMS, PRIMARY_MOBILE_NAV, SECONDARY_MOBILE_NAV } from "./nav-config";
import type { StaffRole } from "@/lib/constants";

export function BottomNav({ staffRole }: { staffRole?: StaffRole | null }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const filterItem = (item: (typeof NAV_ITEMS)[0]) => {
    if (!staffRole) return true;
    return item.roles?.includes(staffRole) ?? false;
  };

  const primaryItems = PRIMARY_MOBILE_NAV.filter(filterItem).slice(0, 5);
  const secondaryItems = SECONDARY_MOBILE_NAV.filter(filterItem);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primaryItems.map((item) => {
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
      <Sheet>
        <SheetTrigger
          render={
            <button className="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground" />
          }
        >
          <Menu className="size-5" />
          <span>More</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 p-4">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-card px-3 py-4 text-xs font-medium hover:bg-muted"
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
