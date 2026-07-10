"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DEALER_NAV } from "./dealer-sidebar";
import type { DealerFeatures } from "@/lib/dealer-features";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { MoreHorizontal, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction } from "@/app/dealer/actions";

interface Props {
  features: DealerFeatures;
}

export function DealerBottomNav({ features }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const enabled = DEALER_NAV.filter((item) => !item.feature || isFeatureEnabled(features, item.feature));
  // Five quick items in the bar (matches the admin/owner mobile nav); everything else lives behind "More".
  const primary = enabled.filter((i) => i.primaryMobile).slice(0, 5);
  const primaryHrefs = new Set(primary.map((i) => i.href));
  const more = enabled.filter((i) => !primaryHrefs.has(i.href));

  const cells = more.length > 0 ? primary.length + 1 : primary.length;
  const moreActive = more.some((i) => isActive(i.href));

  return (
    <nav
      data-tour="main-nav"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur md:hidden"
      style={{
        gridTemplateColumns: `repeat(${cells}, 1fr)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {primary.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {more.length > 0 && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="More menu"
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  moreActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="size-5" />
                <span>More</span>
              </button>
            }
          />
          <SheetContent side="right" className="flex flex-col">
            <SheetHeader>
              <SheetTitle className="text-sm font-semibold tracking-tight">More</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t px-4 py-3">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <LogOut className="size-4" />
                  Sign Out
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
