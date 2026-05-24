"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DEALER_NAV } from "./dealer-sidebar";
import type { DealerFeatures } from "@/lib/dealer-features";
import { isFeatureEnabled } from "@/lib/dealer-features";

interface Props {
  features: DealerFeatures;
}

export function DealerBottomNav({ features }: Props) {
  const pathname = usePathname();

  // Show only primaryMobile items that are also feature-enabled
  const visible = DEALER_NAV.filter(
    (item) =>
      item.primaryMobile &&
      (!item.feature || isFeatureEnabled(features, item.feature)),
  ).slice(0, 5);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur md:hidden"
      style={{
        gridTemplateColumns: `repeat(${visible.length}, 1fr)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {visible.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </nav>
  );
}
