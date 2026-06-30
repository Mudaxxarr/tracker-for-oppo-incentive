"use client";

import Link from "next/link";
import { Bell, Clock } from "lucide-react";
import { formatPKR } from "@/lib/format";

interface HeroData {
  active: number;
  mrr: number;
  collectedThisMonth: number;
  expiringIn7: number;
  expiringSoon: number;
  grace: number;
  suspended: number;
  total: number;
  unreadAlerts: number;
}

export function AdminDashboardHero({ data }: { data: HeroData }) {
  return (
    <>
      <style>{`
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.08; transform: scale(1.18); }
        }
        @keyframes float-hero {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow-sweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hero-ring-1 { animation: ring-pulse 3.5s ease-in-out infinite; }
        .hero-ring-2 { animation: ring-pulse 3.5s ease-in-out infinite 1.2s; }
        .hero-ring-3 { animation: ring-pulse 3.5s ease-in-out infinite 2.4s; }
        .hero-float  { animation: float-hero 4.5s ease-in-out infinite; }
        .hero-slide-1 { animation: slide-up 0.5s ease-out 0.05s both; }
        .hero-slide-2 { animation: slide-up 0.5s ease-out 0.18s both; }
        .hero-slide-3 { animation: slide-up 0.5s ease-out 0.30s both; }
        .hero-glow {
          background: linear-gradient(135deg,
            hsl(var(--primary)/0.18) 0%,
            hsl(var(--primary)/0.06) 45%,
            hsl(var(--primary)/0.12) 100%
          );
          background-size: 200% 200%;
          animation: glow-sweep 8s ease infinite;
        }
      `}</style>

      <div className="rounded-2xl border hero-glow overflow-hidden relative min-h-[200px]">
        {/* Decorative animated rings — top-right corner */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full border-2 border-primary/20 hero-ring-1" />
        <div className="pointer-events-none absolute -right-10 -top-10 size-52 rounded-full border border-primary/25 hero-ring-2" />
        <div className="pointer-events-none absolute -right-2 -top-2 size-36 rounded-full border border-primary/30 hero-ring-3" />

        {/* Small decorative dots */}
        <div className="pointer-events-none absolute left-4 bottom-4 size-1.5 rounded-full bg-primary/30" />
        <div className="pointer-events-none absolute left-8 bottom-7 size-1 rounded-full bg-primary/20" />
        <div className="pointer-events-none absolute left-6 bottom-10 size-1 rounded-full bg-primary/15" />

        <div className="relative px-6 pt-6 pb-5">
          {/* Top row: main metric + right-side cards */}
          <div className="flex items-start justify-between gap-4">
            {/* Hero number */}
            <div className="hero-slide-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Active Dealers
              </p>
              <div className="hero-float inline-block mt-1">
                <p className="text-7xl font-black tabular-nums text-primary leading-none">
                  {data.active}
                </p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                of <span className="font-semibold text-foreground">{data.total}</span> total accounts
              </p>
            </div>

            {/* Right mini-cards */}
            <div className="hero-slide-2 flex flex-col gap-2 shrink-0">
              <div className="rounded-xl border bg-background/60 backdrop-blur-sm px-3.5 py-2.5 text-right min-w-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">MRR</p>
                <p className="text-base font-bold tabular-nums text-primary mt-0.5">{formatPKR(data.mrr)}</p>
              </div>
              <div className="rounded-xl border bg-background/60 backdrop-blur-sm px-3.5 py-2.5 text-right min-w-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Collected</p>
                <p className="text-base font-bold tabular-nums mt-0.5">{formatPKR(data.collectedThisMonth)}</p>
              </div>
            </div>
          </div>

          {/* Status pills */}
          <div className="hero-slide-3 mt-5 flex flex-wrap gap-2">
            {data.expiringIn7 > 0 && (
              <Link
                href="/admin/dealers"
                className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 cursor-pointer"
              >
                <Clock className="size-3" />
                {data.expiringIn7} expiring in 7d
              </Link>
            )}
            {data.expiringSoon > data.expiringIn7 && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600">
                <Clock className="size-3" />
                {data.expiringSoon} expiring in 30d
              </span>
            )}
            {data.grace > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-600">
                {data.grace} in grace
              </span>
            )}
            {data.suspended > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
                {data.suspended} suspended
              </span>
            )}
            {data.unreadAlerts > 0 && (
              <Link
                href="/admin/alerts"
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 cursor-pointer"
              >
                <Bell className="size-3" />
                {data.unreadAlerts} new alert{data.unreadAlerts !== 1 ? "s" : ""}
              </Link>
            )}
            {data.expiringIn7 === 0 && data.expiringSoon === 0 && data.grace === 0 && data.unreadAlerts === 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
                All accounts healthy
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
