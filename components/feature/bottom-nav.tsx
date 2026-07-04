"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { NAV_ITEMS, PRIMARY_MOBILE_NAV, SECONDARY_MOBILE_NAV } from "./nav-config";
import type { StaffRole } from "@/lib/constants";
import { DealerSwitcher, type DealerOption } from "./dealer-switcher";
import { ThemeToggle } from "./theme-toggle";
import { LockButton } from "./lock-button";

export function BottomNav({
  staffRole,
  dealers,
  activeDealerId,
}: {
  staffRole?: StaffRole | null;
  dealers?: DealerOption[];
  activeDealerId?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
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
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-slate-400"
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
            )}
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button className="relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-400" />
          }
        >
          <Menu className="size-5" />
          <span>More</span>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold tracking-tight">More</SheetTitle>
          </SheetHeader>
          {dealers && dealers.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 pb-4">
              <DealerSwitcher options={dealers} activeId={activeDealerId ?? null} />
              <div className="flex items-center justify-between">
                <ThemeToggle />
                <LockButton />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1 overflow-y-auto p-4">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
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
