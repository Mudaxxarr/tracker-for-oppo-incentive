"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
import type { IncentiveReport } from "@/lib/incentive-engine/types";
import type { ModelSaleRow } from "@/app/(app)/dashboard/actions";

interface StockItem {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  quantity: number;
}

interface MonthRow {
  label: string;
  total: number;
  activations: number;
}

export interface DashboardMinimalViewProps {
  dealerName: string;
  label: string;
  netReceivable: number;
  report: IncentiveReport;
  rebateTotal: number;
  totalActualFines: number;
  lostMargin: number;
  crLoss: { potentialLoss: number; totalUnits: number; totalFines: number; priceUnitSum: number };
  pendingCount: number;
  stock: StockItem[];
  modelSales: ModelSaleRow[];
  sixMonths: MonthRow[];
  stockOldestDate: Record<string, string>;
}

// ─── Animation primitives ─────────────────────────────────────────────────────

// Wraps any block in a slide-up + fade-in entrance, triggered by `mounted`
function Appear({
  children,
  delay = 0,
  mounted,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  mounted: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0px)" : "translateY(16px)",
        transition: `opacity 650ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 650ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Animated progress bar — grows from 0 to `pct` after mount
function ABar({
  pct,
  color = "#111111",
  mounted,
  delay = 0,
  thick = false,
}: {
  pct: number;
  color?: string;
  mounted: boolean;
  delay?: number;
  thick?: boolean;
}) {
  return (
    <div className={cn("rounded-full bg-[#EAEAEA] overflow-hidden", thick ? "h-1.5" : "h-1")}>
      <div
        className="h-full rounded-full"
        style={{
          width: mounted ? `${Math.max(pct, 1)}%` : "0%",
          backgroundColor: color,
          transition: `width 900ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        }}
      />
    </div>
  );
}

// SVG circular progress ring — animates stroke-dashoffset on mount
function ProgressRing({
  pct,
  eligible,
  mounted,
}: {
  pct: number;
  eligible: boolean;
  mounted: boolean;
}) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="shrink-0 -rotate-90">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#EAEAEA" strokeWidth={3} />
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke={eligible ? "#346538" : "#AAAAAA"}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={mounted ? circ - filled : circ}
        style={{ transition: "stroke-dashoffset 1000ms cubic-bezier(0.16,1,0.3,1) 350ms" }}
      />
    </svg>
  );
}

// ─── UI primitives ────────────────────────────────────────────────────────────

const MCard = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "bg-white rounded-xl border border-[#EAEAEA] p-5 flex flex-col",
      "transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:-translate-y-px",
      className
    )}
  >
    {children}
  </div>
);

const Eyebrow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em] text-[#787774] mb-3", className)}>
    {children}
  </p>
);

const Tag = ({
  variant,
  children,
  className,
}: {
  variant: "green" | "yellow" | "blue" | "red" | "gray";
  children: React.ReactNode;
  className?: string;
}) => {
  const styles: Record<string, string> = {
    green: "bg-[#EDF3EC] text-[#346538]",
    yellow: "bg-[#FBF3DB] text-[#956400]",
    blue: "bg-[#E1F3FE] text-[#1F6C9F]",
    red: "bg-[#FDEBEC] text-[#9F2F2D]",
    gray: "bg-[#F7F6F3] text-[#787774]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardMinimalView({
  dealerName,
  label,
  netReceivable,
  report,
  rebateTotal,
  totalActualFines,
  lostMargin,
  crLoss,
  pendingCount,
  stock,
  modelSales,
  sixMonths,
  stockOldestDate,
}: DashboardMinimalViewProps) {
  // Two-phase mount: paint invisible first, then flip to trigger CSS transitions
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Derived values
  const tb = report.targetBonus;
  const progressPct = tb.targetQty != null ? Math.min(100, (tb.actualQty / tb.targetQty) * 100) : 0;
  const grossTotal = report.totals.grandTotal + rebateTotal;

  const incentiveRows = report.rows
    .filter((r) => r.total > 0 || r.stockInEarned > 0)
    .sort((a, b) => b.qtyActivated - a.qtyActivated);
  const leaderRows = incentiveRows.slice(0, 6);
  const maxActivated = Math.max(...leaderRows.map((r) => r.qtyActivated), 1);

  const topStockModels = [...stock].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const maxStockQty = Math.max(...topStockModels.map((s) => s.quantity), 1);
  const totalStock = stock.reduce((s, st) => s + st.quantity, 0);
  const stockValue = stock.reduce((s, st) => s + (st.dealerPrice ?? 0) * st.quantity, 0);

  const today = new Date();
  const msPerDay = 86_400_000;
  let agedUnits = 0;
  for (const s of stock) {
    const oldest = stockOldestDate[s.modelId];
    if (oldest && Math.floor((today.getTime() - new Date(oldest).getTime()) / msPerDay) > 30)
      agedUnits += s.quantity;
  }

  const earningStreams = [
    { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned, color: "#346538" },
    { label: `Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, color: "#956400" },
    { label: "Stock-In", value: report.totals.stockInEarned, color: "#1F6C9F" },
    { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "#346538" },
    { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "#956400" },
    { label: "Rebates", value: rebateTotal, color: "#1F6C9F" },
  ].filter((s) => s.value > 0);

  const maxSixMonth = Math.max(...sixMonths.map((m) => m.total), 1);

  return (
    <div className="space-y-4">

      {/* ── SECTION 1: Hero — Net Receivable ─────────────────────────────── */}
      <Appear mounted={mounted} delay={0}>
        <div className="bg-white rounded-xl border border-[#EAEAEA] overflow-hidden relative">
          {/* Subtle warm ambient glow behind the hero number */}
          <div
            className="absolute top-0 left-0 w-72 h-72 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at 30% 40%, rgba(237,243,236,0.55) 0%, transparent 65%)",
            }}
          />

          <div className="relative p-6 sm:p-8">
            <div className="sm:grid sm:grid-cols-[2fr_1fr] sm:gap-10 sm:items-start">

              {/* Left: hero number */}
              <div>
                <Eyebrow className="mb-2">Net Receivable · {dealerName}</Eyebrow>
                <div
                  className="text-[2.6rem] sm:text-[3.75rem] font-black tracking-[-0.04em] text-[#111111] leading-none tabular-nums"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "scale(1)" : "scale(0.96)",
                    transition: "opacity 700ms cubic-bezier(0.16,1,0.3,1) 80ms, transform 700ms cubic-bezier(0.16,1,0.3,1) 80ms",
                  }}
                >
                  {formatPKR(netReceivable)}
                </div>
                <p className="text-[12px] text-[#787774] mt-2">{label}</p>
                <div
                  className="flex flex-wrap gap-2 mt-4"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transition: "opacity 500ms ease 300ms",
                  }}
                >
                  <Tag variant={report.totalActivations > 0 ? "green" : "gray"}>
                    {report.totalActivations} activations
                  </Tag>
                  {rebateTotal > 0 && <Tag variant="blue">+{formatPKR(rebateTotal)} rebates</Tag>}
                  {totalActualFines > 0 && <Tag variant="red">−{formatPKR(totalActualFines)} fines</Tag>}
                </div>
              </div>

              {/* Right: earning streams with animated bars */}
              <div className="mt-6 sm:mt-0 space-y-2.5">
                {earningStreams.map((s, i) => {
                  const pct = grossTotal > 0 ? (s.value / grossTotal) * 100 : 0;
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-[#787774] truncate">{s.label}</span>
                        <span className="text-[11px] font-semibold tabular-nums text-[#111111] ml-2 shrink-0">
                          {formatPKR(s.value)}
                        </span>
                      </div>
                      <ABar pct={pct} color={s.color} mounted={mounted} delay={120 + i * 80} />
                    </div>
                  );
                })}
                {earningStreams.length > 0 && (
                  <div className="flex items-center justify-between pt-2.5 border-t border-[#EAEAEA]">
                    <span className="text-[11px] font-semibold text-[#111111]">Gross Total</span>
                    <span className="text-[12px] font-black tabular-nums text-[#111111]">
                      {formatPKR(grossTotal)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ledger strip */}
          <div className="border-t border-[#EAEAEA] px-6 sm:px-8 py-3 flex flex-wrap gap-x-6 gap-y-1.5 bg-[#F7F6F3]">
            {[
              { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned },
              { label: `Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned },
              { label: "Stock-In", value: report.totals.stockInEarned },
              {
                label: "Incentives",
                value: report.totals.activationIncentiveEarned + report.totals.dealerIncentiveEarned,
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#787774]">{item.label}</span>
                <span className="text-[10px] font-bold tabular-nums text-[#111111]">
                  {formatPKR(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Appear>

      {/* ── SECTION 2: Bento row — Activations | Target Bonus | Stock ──── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Activations */}
        <Appear mounted={mounted} delay={80}>
          <MCard className="h-full">
            <Eyebrow>Activations</Eyebrow>
            <div
              className="text-[2.75rem] font-black tracking-[-0.04em] text-[#111111] leading-none tabular-nums"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1) 180ms, transform 600ms cubic-bezier(0.16,1,0.3,1) 180ms",
              }}
            >
              {report.totalActivations}
            </div>
            <p className="text-[11px] text-[#787774] mt-1">
              {report.totalActivations - report.totalActivationsCrossRegion} regular ·{" "}
              {report.totalActivationsCrossRegion} cross-region
            </p>
            {modelSales[0] && (
              <div className="mt-auto pt-4">
                <div className="flex items-center justify-between rounded-lg border border-[#EAEAEA] px-3 py-2 transition-colors hover:bg-[#F7F6F3]">
                  <span className="text-[10px] text-[#787774] shrink-0">Top model</span>
                  <span className="text-[11px] font-semibold text-[#111111] truncate mx-2">
                    {modelSales[0].modelName}
                  </span>
                  <Tag variant="green" className="shrink-0">{modelSales[0].qty}</Tag>
                </div>
              </div>
            )}
          </MCard>
        </Appear>

        {/* Target Bonus with progress ring */}
        <Appear mounted={mounted} delay={140}>
          <MCard className={cn("h-full", tb.eligible ? "ring-1 ring-[#EDF3EC]" : "")}>
            <Eyebrow>Target Bonus</Eyebrow>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-[2.25rem] font-black tracking-[-0.04em] leading-none tabular-nums",
                    tb.eligible ? "text-[#346538]" : "text-[#111111]"
                  )}
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1) 220ms, transform 600ms cubic-bezier(0.16,1,0.3,1) 220ms",
                  }}
                >
                  {formatPKR(report.totals.bonusPercentEarned)}
                </div>
                <p className="text-[11px] text-[#787774] mt-1">{tb.bonusPercent}% bonus rate</p>
              </div>
              <ProgressRing pct={progressPct} eligible={tb.eligible} mounted={mounted} />
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-[10px] text-[#787774]">
                <span>{tb.actualQty} purchased</span>
                <span>target: {tb.targetQty ?? "—"}</span>
              </div>
              {tb.targetQty != null && (
                <ABar pct={progressPct} color={tb.eligible ? "#346538" : "#AAAAAA"} mounted={mounted} delay={300} thick />
              )}
            </div>
            <div className="mt-3">
              <Tag variant={tb.eligible ? "green" : "gray"}>
                {tb.eligible ? "Target Met" : `${Math.round(progressPct)}% to goal`}
              </Tag>
            </div>
          </MCard>
        </Appear>

        {/* Stock */}
        <Appear mounted={mounted} delay={200}>
          <MCard className="h-full">
            <div className="flex items-start justify-between mb-3">
              <Eyebrow className="mb-0">Stock</Eyebrow>
              {agedUnits > 0 && <Tag variant="yellow">{agedUnits} aged &gt;30d</Tag>}
            </div>
            <div
              className="text-[2.75rem] font-black tracking-[-0.04em] text-[#111111] leading-none tabular-nums"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1) 260ms, transform 600ms cubic-bezier(0.16,1,0.3,1) 260ms",
              }}
            >
              {totalStock}
            </div>
            <p className="text-[11px] text-[#787774] mt-1">{formatPKR(stockValue)} stock value</p>
            <div className="mt-4 space-y-2.5">
              {topStockModels.slice(0, 4).map((s, i) => (
                <div key={s.modelId} className="flex items-center gap-2">
                  <span className="w-16 text-[10px] text-[#787774] truncate">{s.modelName}</span>
                  <div className="flex-1">
                    <ABar
                      pct={(s.quantity / maxStockQty) * 100}
                      color="#1F6C9F"
                      mounted={mounted}
                      delay={280 + i * 60}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#111111] w-5 text-right tabular-nums">
                    {s.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-3 border-t border-[#EAEAEA]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#787774]">Potential @ 4%</span>
                <span className="text-[10px] font-bold tabular-nums text-[#1F6C9F]">
                  {formatPKR(Math.round(stockValue * 0.04))}
                </span>
              </div>
            </div>
          </MCard>
        </Appear>
      </div>

      {/* ── SECTION 3: Leaderboard (2fr) | CR Monitor (1fr) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">

        {/* Model Leaderboard */}
        <Appear mounted={mounted} delay={180}>
          <MCard className="h-full">
            <Eyebrow>Model Leaderboard</Eyebrow>
            {leaderRows.length === 0 ? (
              <p className="text-[12px] text-[#787774]">No activations this period.</p>
            ) : (
              <div className="divide-y divide-[#F0F0EE]">
                {leaderRows.map((row, i) => (
                  <div key={row.modelId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-[10px] font-bold text-[#CCCCCC] w-4 shrink-0 tabular-nums">{i + 1}</span>
                    <span className="w-28 text-[11px] font-medium text-[#111111] truncate shrink-0">
                      {row.modelName}
                    </span>
                    <div className="flex-1">
                      <ABar
                        pct={(row.qtyActivated / maxActivated) * 100}
                        color="#111111"
                        mounted={mounted}
                        delay={260 + i * 70}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-[#111111] tabular-nums w-6 text-right shrink-0">
                      {row.qtyActivated}
                    </span>
                    <span className="text-[10px] text-[#787774] tabular-nums w-20 text-right shrink-0 hidden sm:block">
                      {formatPKR(row.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </MCard>
        </Appear>

        {/* CR Monitor */}
        <Appear mounted={mounted} delay={240}>
          <MCard
            className={cn(
              "h-full",
              totalActualFines > 0
                ? "ring-1 ring-[#FDEBEC]"
                : crLoss.totalUnits > 0
                ? "ring-1 ring-[#FBF3DB]"
                : ""
            )}
          >
            <Eyebrow>CR Monitor</Eyebrow>

            {crLoss.totalUnits === 0 && totalActualFines === 0 ? (
              <div className="flex items-center gap-2.5 py-2">
                <div
                  className="h-2 w-2 rounded-full bg-[#346538]"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "scale(1)" : "scale(0)",
                    transition: "opacity 400ms ease 300ms, transform 400ms cubic-bezier(0.34,1.56,0.64,1) 300ms",
                  }}
                />
                <span className="text-[13px] font-semibold text-[#346538]">No CR risk</span>
              </div>
            ) : (
              <div className="space-y-3">
                {crLoss.totalUnits > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#787774]">Units caught</span>
                    <Tag variant={crLoss.totalUnits > 3 ? "red" : "yellow"}>{crLoss.totalUnits}</Tag>
                  </div>
                )}
                {totalActualFines > 0 && (
                  <div className="rounded-lg border border-[#FDEBEC] bg-[#FDEBEC]/40 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-[#9F2F2D]">Fines Deducted</span>
                      <span className="text-[13px] font-black tabular-nums text-[#9F2F2D]">
                        {formatPKR(totalActualFines)}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#9F2F2D]/70 mt-0.5">Deducted from Net Receivable</p>
                  </div>
                )}
                {lostMargin > 0 && (
                  <div className="rounded-lg border border-[#FBF3DB] bg-[#FBF3DB]/40 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-[#956400]">Opportunity Cost</span>
                      <span className="text-[13px] font-black tabular-nums text-[#956400]">
                        {formatPKR(lostMargin)}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#956400]/70 mt-0.5">Informational — not deducted</p>
                  </div>
                )}
              </div>
            )}

            {pendingCount > 0 && (
              <div className="mt-auto pt-4">
                <Tag variant="yellow">{pendingCount} pending transfers</Tag>
              </div>
            )}
          </MCard>
        </Appear>
      </div>

      {/* ── SECTION 4: 6-Month History ───────────────────────────────────── */}
      {sixMonths.length > 0 && (
        <Appear mounted={mounted} delay={280}>
          <MCard>
            <Eyebrow>6-Month History</Eyebrow>
            <div className="grid grid-cols-6 gap-3 sm:gap-4">
              {sixMonths.map((m, i) => {
                const barPct = (m.total / maxSixMonth) * 100;
                return (
                  <div key={m.label} className="flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
                      <div
                        className="w-full rounded-sm bg-[#111111]"
                        style={{
                          height: mounted ? `${Math.max(barPct, 4)}%` : "0%",
                          transition: `height 800ms cubic-bezier(0.16,1,0.3,1) ${360 + i * 70}ms`,
                        }}
                      />
                    </div>
                    <span
                      className="text-[9px] font-medium text-[#787774] text-center"
                      style={{
                        opacity: mounted ? 1 : 0,
                        transition: `opacity 400ms ease ${480 + i * 60}ms`,
                      }}
                    >
                      {m.label}
                    </span>
                    <span
                      className="text-[10px] font-bold tabular-nums text-[#111111] text-center"
                      style={{
                        opacity: mounted ? 1 : 0,
                        transition: `opacity 400ms ease ${520 + i * 60}ms`,
                      }}
                    >
                      {m.activations}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#EAEAEA]">
              <span className="text-[10px] text-[#787774]">activations per month</span>
              <span className="text-[10px] font-semibold text-[#111111] tabular-nums">
                {sixMonths.reduce((s, m) => s + m.activations, 0)} total
              </span>
            </div>
          </MCard>
        </Appear>
      )}

    </div>
  );
}
