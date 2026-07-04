"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminNav } from "./admin-nav";

interface NavItem {
  href: string;
  label: string;
  badge: number | null;
}

export function AdminMobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            className="fixed right-4 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            aria-label="Open admin menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold tracking-tight">Admin Menu</SheetTitle>
        </SheetHeader>
        <AdminNav items={items} />
      </SheetContent>
    </Sheet>
  );
}
