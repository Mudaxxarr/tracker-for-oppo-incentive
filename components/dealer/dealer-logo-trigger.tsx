"use client";

import { useRef, useState } from "react";
import { Activity, LayoutDashboard, Users, Settings2, X } from "lucide-react";
import Link from "next/link";

interface Props {
  isAdmin?: boolean;
}

export function DealerLogoTrigger({ isAdmin }: Props) {
  const clicksRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (!isAdmin) return;
    clicksRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clicksRef.current >= 3) {
      clicksRef.current = 0;
      setOpen(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      clicksRef.current = 0;
    }, 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="shrink-0 text-primary focus:outline-none"
        aria-label="Home"
      >
        <Activity className="size-5" />
      </button>

      {isAdmin && open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 sm:items-center sm:pb-0">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* panel */}
          <div className="relative z-10 w-72 rounded-xl border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold text-muted-foreground">Admin Access</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-col py-1">
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent"
              >
                <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" />
                Admin Panel
              </Link>
              <Link
                href="/admin/dealers"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent"
              >
                <Users className="size-4 shrink-0 text-muted-foreground" />
                Manage Dealers
              </Link>
              <Link
                href="/admin/dealers/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent"
              >
                <Settings2 className="size-4 shrink-0 text-muted-foreground" />
                Create New Dealer
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
