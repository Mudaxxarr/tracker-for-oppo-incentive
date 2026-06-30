"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Smartphone,
  ShoppingCart,
  Warehouse,
  IdCard,
  Package,
  ArrowLeftRight,
  ScrollText,
  FileBarChart2,
  Settings,
  Users,
  History,
  LogOut,
  Receipt,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { logoutAction } from "@/app/dealer/actions";
import type { DealerFeatureKey, DealerFeatures } from "@/lib/dealer-features";
import { isFeatureEnabled } from "@/lib/dealer-features";

const NAV: {
  href: string;
  label: string;
  icon: React.ElementType;
  feature?: DealerFeatureKey;
  primaryMobile?: boolean;
}[] = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard, primaryMobile: true },
  { href: "/dealer/activations", label: "Activations", icon: Smartphone, feature: "activations", primaryMobile: true },
  { href: "/dealer/purchases", label: "Purchases", icon: ShoppingCart, feature: "purchases", primaryMobile: true },
  { href: "/dealer/models", label: "Models", icon: Package, feature: "models" },
  { href: "/dealer/inventory", label: "Inventory", icon: Warehouse, feature: "inventory" },
  { href: "/dealer/cross-region", label: "Cross-Region", icon: ArrowLeftRight, feature: "cross_region" },
  { href: "/dealer/policies", label: "Policies", icon: ScrollText, feature: "policies" },
  { href: "/dealer/reports", label: "Reports", icon: FileBarChart2, feature: "reports", primaryMobile: true },
  { href: "/dealer/ids", label: "IDs", icon: IdCard, feature: "ids", primaryMobile: true },
  { href: "/dealer/pos", label: "Sell", icon: Receipt, feature: "pos", primaryMobile: true },
  { href: "/dealer/activity", label: "Activity", icon: History, feature: "activity" },
  { href: "/dealer/settings", label: "Settings", icon: Settings, feature: "settings" },
  { href: "/dealer/billing", label: "Billing", icon: CreditCard },
  { href: "/dealer/team", label: "Team View", icon: Users, feature: "team" },
  { href: "/dealer/whats-new", label: "What's New", icon: Sparkles },
];

export const DEALER_NAV = NAV;

interface SlidingNavProps {
  items: typeof NAV;
  pathname: string;
}

function SlidingNav({ items, pathname }: SlidingNavProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const activeEl = root.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeEl) { setPill(null); return; }
    const rootTop = root.getBoundingClientRect().top;
    const { top, height } = activeEl.getBoundingClientRect();
    setPill({ top: top - rootTop, height });
  }, [pathname]);

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      {pill && (
        <div
          aria-hidden
          className="absolute inset-x-0 rounded-md bg-primary transition-[top,height] duration-[220ms] ease-out pointer-events-none"
          style={{ top: pill.top, height: pill.height }}
        />
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            className={cn(
              "relative z-10 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? pill
                  ? "font-medium text-primary-foreground"
                  : "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

interface Props {
  features: DealerFeatures;
}

export function DealerSidebar({ features }: Props) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => !item.feature || isFeatureEnabled(features, item.feature));

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-sidebar">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <SlidingNav items={visible} pathname={pathname} />
        <div className="mt-auto border-t pt-2">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" />
              Sign Out
            </button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
