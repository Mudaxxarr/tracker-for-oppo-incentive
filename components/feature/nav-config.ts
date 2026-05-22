import {
  LayoutDashboard,
  ShoppingCart,
  Smartphone,
  ArrowLeftRight,
  ScrollText,
  FileBarChart2,
  IdCard,
  Settings,
  History,
  Package,
  Warehouse,
  Users,
  BookUser,
  ShieldCheck,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  primaryMobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primaryMobile: true },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart, primaryMobile: true },
  { href: "/activations", label: "Activations", icon: Smartphone, primaryMobile: true },
  { href: "/models", label: "Models", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/cross-region", label: "Cross-Region", icon: ArrowLeftRight },
  { href: "/policies", label: "Policies", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: FileBarChart2, primaryMobile: true },
  { href: "/ids", label: "IDs", icon: IdCard },
  { href: "/customers", label: "Customers", icon: BookUser },
  { href: "/warranty", label: "Warranty", icon: ShieldCheck },
  { href: "/scripts", label: "Scripts", icon: BookOpen },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/settings", label: "Settings", icon: Settings, primaryMobile: true },
  { href: "/team/dashboard", label: "Team View", icon: Users },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/dealers", label: "Dealers", icon: Users },
  { href: "/admin/revenue", label: "Revenue", icon: FileBarChart2 },
];

export const PRIMARY_MOBILE_NAV = NAV_ITEMS.filter((i) => i.primaryMobile).slice(0, 5);
export const SECONDARY_MOBILE_NAV = NAV_ITEMS.filter((i) => !i.primaryMobile);
