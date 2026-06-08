"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from "./nav-config";
import type { StaffRole } from "@/lib/constants";

function SlidingNav({ items }: { items: typeof NAV_ITEMS }) {
  const pathname = usePathname();
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
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            className={cn(
              "relative z-10 flex items-center gap-2 rounded-md px-3 py-2 text-sm tracking-tight transition-colors",
              active
                ? pill
                  ? "font-medium text-primary-foreground"
                  : "bg-primary font-medium text-primary-foreground"
                : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({ staffRole }: { staffRole?: StaffRole | null }) {
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!staffRole) return true;
    return item.roles?.includes(staffRole) ?? false;
  });

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-white md:border-slate-200">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-4">
        <span className="text-sm font-semibold tracking-tight text-slate-800">Alhamd</span>
        <span className="text-[11px] font-normal text-slate-400">Sales Console</span>
      </div>
      <nav className="flex flex-col gap-2 p-3">
        {staffRole && (
          <p className="px-3 pb-1 pt-1 text-[11px] font-medium tracking-tight text-amber-600/80">
            {staffRole === "so" ? "Sales Officer" : "Accountant"}
          </p>
        )}
        <SlidingNav items={visibleItems} />
        {!staffRole && (
          <>
            <div className="my-1 border-t" />
            <p className="px-3 pb-1 text-[11px] font-medium tracking-tight text-muted-foreground/50">
              Admin
            </p>
            <SlidingNav items={ADMIN_NAV_ITEMS} />
          </>
        )}
      </nav>
    </aside>
  );
}
