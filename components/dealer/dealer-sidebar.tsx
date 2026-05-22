"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  BookUser,
  ShieldCheck,
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
  { href: "/dealer/customers", label: "Customers", icon: BookUser, feature: "customers" },
  { href: "/dealer/warranty", label: "Warranty", icon: ShieldCheck, feature: "warranty" },
  { href: "/dealer/activity", label: "Activity", icon: History, feature: "activity" },
  { href: "/dealer/settings", label: "Settings", icon: Settings, feature: "settings" },
  { href: "/dealer/team", label: "Team View", icon: Users, feature: "team" },
];

export const DEALER_NAV = NAV;

interface Props {
  features: DealerFeatures;
}

export function DealerSidebar({ features }: Props) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => !item.feature || isFeatureEnabled(features, item.feature));

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visible.map((item) => {
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
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="mt-auto border-t pt-2">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
