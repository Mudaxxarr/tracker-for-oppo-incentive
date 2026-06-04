"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/feature/kpi-card";
import { TrendCharts } from "@/components/feature/trend-charts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Smartphone,
  Percent,
  Award,
  Truck,
  Wallet,
  ArrowLeftRight,
  ArrowRight,
  Package,
  ShieldAlert,
  Download,
  LayoutGrid,
  BarChart2,
  List,
  AlignJustify,
  TrendingUp,
  FileText,
  Zap,
  Calendar,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { formatPKR } from "@/lib/format";
import Link from "next/link";
import type { IncentiveReport } from "@/lib/incentive-engine/types";
import { getDashboardPeriodAction, type ModelSaleRow, type RebateDetailRow, type CrCaughtExportRow } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Preset = "today" | "week" | "month" | "last-month" | "custom";
type Layout = "cards" | "charts" | "overview" | "compact" | "financial" | "performance" | "timeline" | "executive";

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

interface Props {
  dealerName: string;
  initialFrom: string;
  initialTo: string;
  initialReport: IncentiveReport;
  initialModelSales: ModelSaleRow[];
  initialCrLoss: { lostIncentive: number; totalUnits: number; totalFines: number; priceUnitSum: number };
  initialRebateTotal: number;
  initialRebateRows: RebateDetailRow[];
  stockOldestDate: Record<string, string>;
  sixMonths: MonthRow[];
  stock: StockItem[];
  movedTo: Record<string, string[]>;
  pendingCount: number;
  initialCrFineTotal: number;
  initialCrCaughtRows: CrCaughtExportRow[];
}

function presetRange(p: Preset): { from: string; to: string } {
  // PKT = UTC+5, hardcoded — matches server-side todayPKT()
  const PKT = 5 * 3600 * 1000;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayPKT = new Date(Date.now() + PKT);
  const [yr, mo] = iso(todayPKT).split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (p === "today") return { from: iso(todayPKT), to: iso(todayPKT) };
  if (p === "week") {
    const dow = todayPKT.getUTCDay();
    return { from: iso(new Date(Date.now() + PKT - dow * 86400000)), to: iso(todayPKT) };
  }
  if (p === "month") {
    return { from: `${yr}-${pad(mo)}-01`, to: iso(new Date(Date.UTC(yr, mo, 0))) };
  }
  if (p === "last-month") {
    const lm = mo === 1 ? 12 : mo - 1;
    const ly = mo === 1 ? yr - 1 : yr;
    return { from: `${ly}-${pad(lm)}-01`, to: iso(new Date(Date.UTC(yr, mo - 1, 0))) };
  }
  return { from: iso(todayPKT), to: iso(todayPKT) };
}

function periodLabel(from: string, to: string): string {
  if (from === to) return from;
  return `${from} → ${to}`;
}

const LAYOUTS: { id: Layout; icon: typeof LayoutGrid; label: string }[] = [
  { id: "cards", icon: LayoutGrid, label: "Cards" },
  { id: "charts", icon: BarChart2, label: "Charts" },
  { id: "overview", icon: List, label: "Overview" },
  { id: "compact", icon: AlignJustify, label: "Compact" },
  { id: "financial", icon: FileText, label: "Financial" },
  { id: "performance", icon: Zap, label: "Performance" },
  { id: "timeline", icon: Calendar, label: "Timeline" },
  { id: "executive", icon: Briefcase, label: "Executive" },
];

/** Lightweight model-sales chart with date filtering — used by the team dashboard. */
export function DashboardAnalytics({
  initialRows,
  initialFrom,
  initialTo,
}: {
  initialRows: ModelSaleRow[];
  initialFrom: string;
  initialTo: string;
}) {
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [rows, setRows] = useState<ModelSaleRow[]>(initialRows);
  const [pending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      const data = await getDashboardPeriodAction(f, t);
      if (data) setRows(data.modelSales);
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = presetRange(p);
      setFrom(f);
      setTo(t);
      load(f, t);
    }
  };

  const total = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="size-4" />
            Model-wise Sales
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {(["month", "last-month", "week", "today", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  preset === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p === "month" ? "This Month" : p === "last-month" ? "Last Month" : p === "week" ? "This Week" : p === "today" ? "Today" : "Custom"}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-32 text-xs" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-32 text-xs" />
                <Button size="sm" className="h-7 text-xs" onClick={() => load(from, to)}>Apply</Button>
              </div>
            )}
            {pending && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No activations in this period.</div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const pct = total > 0 ? (r.qty / total) * 100 : 0;
              return (
                <div key={r.modelId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-36 shrink-0 text-sm font-medium truncate">{r.modelName}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold tabular-nums">{r.qty} sold</div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground border-t">
              <span>{rows.length} model(s)</span>
              <span className="font-semibold text-foreground tabular-nums">{total} total</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Policy Progress Card ────────────────────────────────────────────────────
type PolicyStatus = "overachieved" | "met" | "earned" | "in-progress";
type PolicyEntry = { id: string; label: string; sub: string; rawPct: number; color: string; status: PolicyStatus };

function PolicyProgressCard({ report, rebateTotal }: { report: IncentiveReport; rebateTotal: number }) {
  const tb = report.targetBonus;

  const entries: PolicyEntry[] = [];

  // Base incentive — active on any activation
  entries.push({
    id: "base",
    label: `Base ${report.baseIncentivePercent}% Incentive`,
    sub: `${report.totalActivations} activation${report.totalActivations !== 1 ? "s" : ""} this period`,
    rawPct: report.totalActivations > 0 ? 100 : 5,
    color: "#818cf8",
    status: report.totalActivations > 0 ? "earned" : "in-progress",
  });

  // Target Bonus — has a real numeric target
  if (tb.targetQty != null && tb.targetQty > 0) {
    const rawPct = (tb.actualQty / tb.targetQty) * 100;
    entries.push({
      id: "bonus",
      label: `Target Bonus ${tb.bonusPercent}%`,
      sub: rawPct > 100
        ? `${tb.actualQty} / ${tb.targetQty} units — ${Math.round(rawPct)}% / Overachieved`
        : `${tb.actualQty} / ${tb.targetQty} units`,
      rawPct,
      color: rawPct > 100 ? "#f59e0b" : tb.eligible ? "#10b981" : "#94a3b8",
      status: rawPct > 100 ? "overachieved" : tb.eligible ? "met" : "in-progress",
    });
  }

  // Stock-In Incentive
  if (report.totals.stockInEarned > 0) {
    const totalStocked = report.rows.reduce((s, r) => s + r.stockInRegularQty, 0);
    entries.push({
      id: "stockin",
      label: "Stock-In Incentive",
      sub: `${totalStocked} unit${totalStocked !== 1 ? "s" : ""} stocked`,
      rawPct: 100,
      color: "#10b981",
      status: "earned",
    });
  }

  // Dealer Incentives — group by shared target so bulk-created per-model policies show as ONE bar
  const diSeen = new Set<number>();
  report.dealerIncentives.filter((di) => di.targetTotal > 0).forEach((di) => {
    if (diSeen.has(di.targetTotal)) return;
    diSeen.add(di.targetTotal);
    const rawPct = (di.actualTotal / di.targetTotal) * 100;
    entries.push({
      id: `di-${di.targetTotal}`,
      label: "Dealer Incentive",
      sub: rawPct > 100
        ? `${di.actualTotal} / ${di.targetTotal} activations — ${Math.round(rawPct)}% / Overachieved`
        : `${di.actualTotal} / ${di.targetTotal} activations`,
      rawPct,
      color: rawPct > 100 ? "#f59e0b" : di.eligible ? "#10b981" : "#94a3b8",
      status: rawPct > 100 ? "overachieved" : di.eligible ? "met" : "in-progress",
    });
  });

  // Activation Incentive (per-model)
  if (report.totals.activationIncentiveEarned > 0) {
    entries.push({
      id: "ai",
      label: "Activation Incentive",
      sub: "Per-model bonus — active",
      rawPct: 100,
      color: "#f59e0b",
      status: "earned",
    });
  }

  // Price-Drop Rebates
  if (rebateTotal > 0) {
    entries.push({
      id: "rebates",
      label: "Price-Drop Rebates",
      sub: "Unsold stock at drop date",
      rawPct: 100,
      color: "#06b6d4",
      status: "earned",
    });
  }

  // Sort: in-progress (closest to 100% first), then met/overachieved/earned
  const sorted = [...entries].sort((a, b) => {
    if (a.status === "in-progress" && b.status !== "in-progress") return -1;
    if (a.status !== "in-progress" && b.status === "in-progress") return 1;
    if (a.status === "in-progress" && b.status === "in-progress") return b.rawPct - a.rawPct;
    return 0;
  });

  const STATUS_BADGE: Record<PolicyStatus, { cls: string; text: string }> = {
    overachieved: { cls: "bg-amber-100 text-amber-700 ring-1 ring-amber-300", text: "Overachieved" },
    met:          { cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300", text: "✓ Met" },
    earned:       { cls: "bg-slate-100 text-slate-500", text: "Earned" },
    "in-progress":{ cls: "bg-slate-50 text-slate-400", text: `${Math.round(Math.min(99, entries.find(e => e.status === "in-progress")?.rawPct ?? 0))}%` },
  };

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-5">
        <Award className="size-3.5" /> Policy Tracker
      </p>
      <div className="flex-1 space-y-4">
        {sorted.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">No active policies this period.</div>
        ) : (
          sorted.map((p) => {
            const clampedPct = Math.min(100, p.rawPct);
            const badge = p.status === "in-progress"
              ? { cls: "bg-slate-50 text-slate-400", text: `${Math.round(p.rawPct)}%` }
              : STATUS_BADGE[p.status];
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-800 truncate">{p.label}</p>
                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">{p.sub}</p>
                <div className="relative h-2 overflow-hidden rounded-full" style={{ backgroundColor: `${p.color}22` }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(clampedPct, 3)}%`, backgroundColor: p.color }}
                  />
                  <div
                    className="bar-glow absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${Math.max(clampedPct, 3)}%`, backgroundColor: p.color, filter: "blur(5px)" }}
                  />
                  {p.status === "in-progress" && (
                    <div
                      className="bar-shimmer absolute inset-y-0 w-8 opacity-60"
                      style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)" }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export function DashboardClient({
  dealerName,
  initialFrom,
  initialTo,
  initialReport,
  initialModelSales,
  initialCrLoss,
  initialRebateTotal,
  initialRebateRows,
  stockOldestDate,
  sixMonths,
  stock,
  movedTo,
  pendingCount,
  initialCrFineTotal,
  initialCrCaughtRows,
}: Props) {
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [layout, setLayout] = useState<Layout>("cards");
  const [report, setReport] = useState<IncentiveReport>(initialReport);
  const [modelSales, setModelSales] = useState<ModelSaleRow[]>(initialModelSales);
  const [crLoss, setCrLoss] = useState(initialCrLoss);
  const [rebateTotal, setRebateTotal] = useState(initialRebateTotal);
  const [rebateRows, setRebateRows] = useState<RebateDetailRow[]>(initialRebateRows);
  const [crCaughtRows, setCrCaughtRows] = useState<CrCaughtExportRow[]>(initialCrCaughtRows);
  const [pending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      const data = await getDashboardPeriodAction(f, t);
      if (data) {
        setReport(data.report);
        setModelSales(data.modelSales);
        setCrLoss(data.crLoss);
        setRebateTotal(data.rebateTotal);
        setRebateRows(data.rebateRows);
        setCrCaughtRows(data.crCaughtRows);
      }
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = presetRange(p);
      setFrom(f);
      setTo(t);
      load(f, t);
    }
  };

  const applyCustom = () => load(from, to);

  // Derived from current report state
  const tb = report.targetBonus;
  // Ledger: only CR Outward (cr_caught) fines are real deductions — CR Inward has no fines
  const totalActualFines = crLoss.totalFines;
  const netReceivable = report.totals.grandTotal + rebateTotal - totalActualFines;
  const lostMargin = Math.round(crLoss.priceUnitSum * (report.baseIncentivePercent + tb.bonusPercent) / 100);
  const modelsWithIncentive = new Set(
    report.rows.filter((r) => r.total > 0 || r.stockInEarned > 0).map((r) => r.modelId)
  );
  const incentiveRows = report.rows
    .filter((r) => r.total > 0 || r.stockInEarned > 0)
    .sort((a, b) => b.qtyActivated - a.qtyActivated);
  const totalModelSales = modelSales.reduce((s, r) => s + r.qty, 0);
  const label = periodLabel(from, to);

  const downloadCSV = () => {
    const pkr = (n: number) => `"${formatPKR(Math.round(n))}"`;
    const neg = (n: number) => (n > 0 ? `-${Math.round(n)}` : "0");
    const grossReceivable = report.totals.grandTotal + rebateTotal;
    const shiftedRows = crCaughtRows.filter((r) => r.quantity > 0);
    const combinedRate = report.baseIncentivePercent + tb.bonusPercent;

    const lines: string[] = [
      // ── Header ──────────────────────────────────────────────────────────────
      `FINANCIAL RECONCILIATION REPORT — ${dealerName}`,
      `Period: ${from} to ${to}`,
      `Generated: ${new Date().toLocaleDateString("en-PK")}`,
      `Target: ${tb.actualQty} / ${tb.targetQty ?? "—"} units | ${tb.eligible ? "TARGET MET" : "Target not met"}`,
      "NOTE: Net Receivable = (Total Incentives + Rebates) - Cash Fines only. Opportunity Cost is informational.",
      "",

      // ── Section 1: Net Receivable Ledger ────────────────────────────────────
      "=== SECTION 1: NET RECEIVABLE LEDGER ===",
      "Line Item,Amount (PKR)",
      `Base Incentive (${report.baseIncentivePercent}%),${pkr(report.totals.basePercentEarned)}`,
      `Target Bonus (${tb.bonusPercent}%),${pkr(report.totals.bonusPercentEarned)}`,
      `Stock-In Incentive,${pkr(report.totals.stockInEarned)}`,
      `Activation Incentive,${pkr(report.totals.activationIncentiveEarned)}`,
      `Dealer Incentive,${pkr(report.totals.dealerIncentiveEarned)}`,
      `--- Gross Incentives ---,${pkr(report.totals.grandTotal)}`,
      ...(rebateTotal > 0 ? [`Price-Drop Rebates (owed by OPPO),+${pkr(rebateTotal)}`] : []),
      `--- Gross Receivable ---,${pkr(grossReceivable)}`,
      ...(crLoss.totalFines > 0
        ? [`CR Penalty Fines — CR Outward (DEDUCTED),${neg(crLoss.totalFines)}`]
        : []),
      `=== NET RECEIVABLE FROM OPPO ===,${pkr(netReceivable)}`,
      "",

      // ── Section 2: Incentive Breakdown ──────────────────────────────────────
      "=== SECTION 2: INCENTIVE BREAKDOWN BY MODEL ===",
      "Model,Units Activated,Base Earned (PKR),Bonus Earned (PKR),Stock-In Earned (PKR),Total (PKR)",
      ...incentiveRows.map(
        (r) =>
          `"${r.modelName}",${r.qtyActivated},${pkr(r.basePercentEarned)},${pkr(r.bonusPercentEarned)},${pkr(r.stockInEarned)},${pkr(r.total)}`
      ),
      `TOTAL,${report.totalActivations},,,,${pkr(report.totals.grandTotal)}`,
      "",

      // ── Section 3: Model Sales ───────────────────────────────────────────────
      "=== SECTION 3: MODEL SALES ===",
      "Model,Units Sold,Share %",
      ...modelSales.map((r) => {
        const pct = totalModelSales > 0 ? ((r.qty / totalModelSales) * 100).toFixed(1) : "0.0";
        return `"${r.modelName}",${r.qty},${pct}%`;
      }),
      `TOTAL,${totalModelSales},100%`,
      "",

      // ── Section 4: Current Stock ─────────────────────────────────────────────
      "=== SECTION 4: CURRENT STOCK ===",
      "Model,Quantity,Dealer Price (PKR)",
      ...stock.map(
        (s) => `"${s.modelName}",${s.quantity},${s.dealerPrice != null ? pkr(s.dealerPrice) : "N/A"}`
      ),
      "",

      // ── Section 5: Opportunity Cost (Shifted Stock) ──────────────────────────
      "============================================================",
      "EXPECTED LOSS: SHIFTED STOCK (NON-ACTIVE)",
      "============================================================",
      "INFORMATIONAL ONLY — NOT DEDUCTED FROM NET RECEIVABLE",
      `These figures represent the estimated margin lost on units caught cross-region.`,
      `Calculation: Qty x Dealer Price x ${combinedRate}% (${report.baseIncentivePercent}% base + ${tb.bonusPercent}% bonus)`,
      "",
      ...(shiftedRows.length === 0
        ? ["No cross-region caught units recorded for this period."]
        : [
            "Date,Model,Qty Shifted,Dealer Price (PKR),Est. Margin Lost (PKR),Direct Fine (PKR)",
            ...shiftedRows.map((r) => {
              const margin = Math.round(r.quantity * r.dealerPriceSnapshot * combinedRate / 100);
              return `${r.caughtDate},"${r.modelName}",${r.quantity},${pkr(r.dealerPriceSnapshot)},${pkr(margin)},${r.fineAmount > 0 ? neg(r.fineAmount) : "0"}`;
            }),
            `TOTAL MARGIN LOST (Informational),,${shiftedRows.reduce((s, r) => s + r.quantity, 0)},,"${formatPKR(lostMargin)}",`,
          ]),
    ];

    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${dealerName.replace(/\s+/g, "-")}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Shared section renderers ──────────────────────────────────────────────

  const kpiCards = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <KpiCard
        label="Active phones"
        value={report.totalActivations}
        icon={<Smartphone className="size-4" />}
      />
      <KpiCard
        label={`${report.baseIncentivePercent}% earned`}
        value={report.totals.basePercentEarned}
        format="currency"
        icon={<Percent className="size-4" />}
      />
      <KpiCard
        label={`Target bonus ${tb.bonusPercent}%`}
        value={report.totals.bonusPercentEarned}
        format="currency"
        icon={<Award className="size-4" />}
        highlightZero
        progress={tb.targetQty != null ? { current: tb.actualQty, target: tb.targetQty } : undefined}
        helper={
          tb.eligible
            ? "Purchase target met ✓"
            : `${tb.actualQty}/${tb.targetQty ?? "—"} purchased`
        }
      />
      <KpiCard
        label="Stock-In earned"
        value={report.totals.stockInEarned}
        format="currency"
        icon={<Truck className="size-4" />}
      />
      <KpiCard
        label="Total from OPPO"
        value={report.totals.grandTotal}
        format="currency"
        icon={<Wallet className="size-4" />}
      />
      <KpiCard
        label="Rebates receivable"
        value={rebateTotal}
        format="currency"
        icon={<RefreshCw className="size-4" />}
        helper={rebateTotal > 0 ? "Price-drop rebates" : "No rebates this period"}
      />
      <KpiCard
        label="CR Caught Loss"
        value={crLoss.lostIncentive}
        format="currency"
        icon={<ShieldAlert className="size-4" />}
        highlightZero
        helper={
          crLoss.totalUnits > 0
            ? `${crLoss.totalUnits} units caught`
            : "No catches this period"
        }
      />
    </div>
  );

  const stockSection = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="size-4" />
          Current Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {stock.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No stock on hand.</div>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {stock.map((s) => {
              const moved = movedTo[s.modelId];
              const hasIncentive = modelsWithIncentive.has(s.modelId);
              return (
                <div key={s.modelId} className="flex flex-col gap-1 bg-card p-3">
                  <span className="text-xs font-medium leading-tight truncate">{s.modelName}</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {s.quantity}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {s.dealerPrice != null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatPKR(s.dealerPrice)}
                      </span>
                    )}
                    {moved && (
                      <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                        <ArrowRight className="size-2.5" />
                        {moved.join(", ")}
                      </span>
                    )}
                    {!hasIncentive && (
                      <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">
                        no incentive
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const incentiveSection =
    incentiveRows.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incentive models — {label}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {incentiveRows.map((row) => (
              <div key={row.modelId} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{row.modelName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.qtyActivated} activated · {row.stockInRegularQty} stocked
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums">{formatPKR(row.total)}</div>
                  <div className="text-xs text-muted-foreground">
                    {report.baseIncentivePercent}% {formatPKR(row.basePercentEarned)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ) : null;

  const modelSalesSection = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="size-4" />
          Model-wise Sales
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {modelSales.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No activations in this period.
          </div>
        ) : (
          <div className="divide-y">
            {modelSales.map((r) => {
              const pct = totalModelSales > 0 ? (r.qty / totalModelSales) * 100 : 0;
              return (
                <div key={r.modelId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-36 shrink-0 text-sm font-medium truncate">{r.modelName}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold tabular-nums">
                    {r.qty} sold
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground border-t">
              <span>{modelSales.length} model(s)</span>
              <span className="font-semibold text-foreground tabular-nums">
                {totalModelSales} total
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Layout renderers ──────────────────────────────────────────────────────

  const renderCards = () => {
    const totalStock = stock.reduce((s, st) => s + st.quantity, 0);
    const stockValue = stock.reduce((s, st) => s + (st.dealerPrice ?? 0) * st.quantity, 0);
    const topModel = modelSales[0];
    const crRegular = report.totalActivations - report.totalActivationsCrossRegion;
    const crRatio =
      report.totalActivations > 0
        ? (report.totalActivationsCrossRegion / report.totalActivations) * 100
        : 0;

    const earningsStreams = [
      { label: `Base ${report.baseIncentivePercent}%`, amount: report.totals.basePercentEarned },
      { label: `Bonus ${tb.bonusPercent}%`, amount: report.totals.bonusPercentEarned },
      { label: "Stock-In", amount: report.totals.stockInEarned },
      { label: "Activation Incentive", amount: report.totals.activationIncentiveEarned },
      { label: "Dealer Incentive", amount: report.totals.dealerIncentiveEarned },
      { label: "Price-Drop Rebates", amount: rebateTotal },
    ].filter((s) => s.amount > 0);
    const topStockModels = [...stock].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const maxStockQty = Math.max(...topStockModels.map((s) => s.quantity), 1);
    const progressPct = tb.targetQty != null ? Math.min(100, (tb.actualQty / tb.targetQty) * 100) : 0;
    const leaderRows = incentiveRows.slice(0, 6);
    const maxActivated = Math.max(...leaderRows.map((r) => r.qtyActivated), 1);


    // D5 stock aging
    const today = new Date();
    const msPerDay = 86_400_000;
    let agedUnits = 0;
    for (const s of stock) {
      const oldest = stockOldestDate[s.modelId];
      if (oldest && Math.floor((today.getTime() - new Date(oldest).getTime()) / msPerDay) > 30) agedUnits += s.quantity;
    }

    const CARD ="bg-white rounded-2xl border border-slate-100/80 shadow-[0_4px_32px_-6px_rgba(0,0,0,0.10),0_2px_8px_-2px_rgba(0,0,0,0.05)] ring-1 ring-slate-900/[0.04] p-6 flex flex-col";

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans antialiased text-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">

          {/* LEFT: Policy Tracker — hidden on mobile, sticky left column on desktop */}
          <div className="hidden md:block md:sticky md:top-4">
            <div className={`${CARD}`}>
              <PolicyProgressCard report={report} rebateTotal={rebateTotal} />
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Net Receivable</span>
                  <span className="text-sm font-black tabular-nums font-mono text-slate-900">{formatPKR(netReceivable)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Main dashboard */}
          <div className="flex flex-col gap-6">

          {/* Hero: Net Receivable */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-700/40 shadow-[0_20px_80px_-12px_rgba(4,120,87,0.55),0_8px_24px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.09)] p-6 flex flex-col" style={{ background: "linear-gradient(145deg,#020617 0%,#022c22 20%,#065f46 55%,#0d1117 100%)" }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.32)_0%,transparent_60%)] pointer-events-none" />
          <div className="absolute -top-20 -right-20 size-80 rounded-full bg-emerald-400/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 size-64 rounded-full bg-emerald-800/25 blur-2xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-400/90 via-emerald-300/40 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-0.5 flex pointer-events-none">
            {earningsStreams.map((s, i) => {
              const pct = report.totals.grandTotal > 0 ? (s.amount / report.totals.grandTotal) * 100 : 0;
              const colors = ["#818cf8","#10b981","#059669","#34d399","#6ee7b7","#a7f3d0"];
              return <div key={i} style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />;
            })}
          </div>
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80 flex items-center gap-2">
                <Wallet className="size-3.5" /> Net Receivable from OPPO
              </p>
              <span className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold tabular-nums ${
                totalActualFines > 0
                  ? "bg-rose-900/40 text-rose-300 ring-1 ring-rose-700/50"
                  : "bg-white/5 text-slate-500"
              }`}>
                <ShieldAlert className="size-3" />
                {totalActualFines > 0 ? `−${formatPKR(totalActualFines)}` : "0"} fines deducted
              </span>
            </div>
            <div className="flex items-start gap-8 flex-1">
                <div className="flex-1 min-w-0 space-y-5">
                  <div>
                    <div className="text-5xl font-black tracking-tighter text-emerald-400 font-mono leading-none">
                      {formatPKR(netReceivable)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="live-dot size-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Live</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs text-slate-400">{label}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned, color: "#818cf8" },
                      { label: `Target Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, color: "#10b981" },
                      { label: "Stock-In Earned", value: report.totals.stockInEarned, color: "#059669" },
                      { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "#34d399" },
                      { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "#6ee7b7" },
                      { label: "Price-Drop Rebates", value: rebateTotal, color: "#a7f3d0" },
                      ...(crLoss.totalFines > 0 ? [{ label: "CR Penalty Fines", value: -crLoss.totalFines, color: "#e11d48" }] : []),
                    ].filter((s) => s.value !== 0).map((s) => {
                      const totalBase = report.totals.grandTotal + rebateTotal;
                      const pct = totalBase > 0 ? (Math.abs(s.value) / totalBase) * 100 : 0;
                      // D4 — drill-down rows per stream
                      type DrillRow = { model: string; qty: number; perUnit: number };
                      let drillRows: DrillRow[] = [];
                      if (s.label.startsWith("Base")) {
                        drillRows = report.rows.filter((r) => r.basePercentEarned > 0).map((r) => ({
                          model: r.modelName, qty: r.qtyActivated, perUnit: r.qtyActivated > 0 ? r.basePercentEarned / r.qtyActivated : 0,
                        }));
                      } else if (s.label.startsWith("Stock-In")) {
                        drillRows = report.rows.filter((r) => r.stockInEarned > 0).map((r) => ({
                          model: r.modelName, qty: r.effectiveStockInQty, perUnit: r.effectiveStockInQty > 0 ? r.stockInEarned / r.effectiveStockInQty : 0,
                        }));
                      } else if (s.label.startsWith("Activation")) {
                        drillRows = report.rows.filter((r) => r.activationIncentiveEarned > 0).map((r) => ({
                          model: r.modelName, qty: r.qtyActivated, perUnit: r.qtyActivated > 0 ? r.activationIncentiveEarned / r.qtyActivated : 0,
                        }));
                      } else if (s.label.startsWith("Price-Drop")) {
                        drillRows = rebateRows.map((r) => ({
                          model: r.modelName, qty: r.eligibleQty, perUnit: r.rebatePerUnit,
                        }));
                      }
                      const hasDetail = drillRows.length > 0;
                      return (
                        <div key={s.label} className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <div className="w-36 shrink-0 text-[11px] text-slate-400 truncate">{s.label}</div>
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden w-full">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: s.color }}
                            />
                          </div>
                          {hasDetail ? (
                            <Dialog>
                              <DialogTrigger className="w-24 text-right text-[11px] font-semibold tabular-nums text-slate-100 underline decoration-dotted hover:text-emerald-400 transition-colors">
                                {formatPKR(s.value)}
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader>
                                  <DialogTitle className="text-sm">{s.label}</DialogTitle>
                                </DialogHeader>
                                <div className="mt-2 divide-y rounded-xl border border-slate-100 text-xs">
                                  <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-50 font-semibold text-slate-500 uppercase tracking-wide text-[10px] rounded-t-xl">
                                    <span>Model</span><span className="text-center">Qty</span><span className="text-right">Per Unit</span>
                                  </div>
                                  {drillRows.map((dr, j) => (
                                    <div key={j} className="grid grid-cols-3 gap-2 px-3 py-2.5">
                                      <span className="truncate font-medium text-slate-900">{dr.model}</span>
                                      <span className="text-center tabular-nums text-slate-700">{dr.qty}</span>
                                      <span className="text-right tabular-nums text-slate-900 font-semibold">{formatPKR(dr.perUnit)}</span>
                                    </div>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <div className="w-24 text-right text-[11px] font-semibold tabular-nums text-slate-100">
                              {formatPKR(s.value)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-[11px] text-slate-400">Gross (incentives + rebates)</span>
                      <span className="text-[11px] tabular-nums font-semibold text-white">
                        {formatPKR(report.totals.grandTotal + rebateTotal)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Right: donut chart */}
                <div className="relative shrink-0 hidden sm:flex items-center justify-center" style={{ width: 128, height: 128 }}>
                  <PieChart width={128} height={128}>
                    <Pie
                      data={earningsStreams.length > 0 ? earningsStreams : [{ label: "None", amount: 1 }]}
                      cx={64}
                      cy={64}
                      innerRadius={38}
                      outerRadius={58}
                      dataKey="amount"
                      strokeWidth={2}
                      stroke="#ffffff"
                    >
                      {(earningsStreams.length > 0 ? earningsStreams : [{ label: "None", amount: 1 }]).map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={
                            earningsStreams.length === 0
                              ? "#f1f5f9"
                              : (["#818cf8","#10b981","#059669","#34d399","#6ee7b7","#a7f3d0"])[idx % 6]
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[10px] font-medium text-slate-400">earned</div>
                    <div className="text-[11px] font-bold text-white leading-tight">
                      {report.totals.grandTotal > 0
                        ? `${((report.totals.basePercentEarned / report.totals.grandTotal) * 100).toFixed(0)}% base`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>{/* /Hero */}

        {/* ROW 2: Core Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="col-span-1">
          <div className={`${CARD} h-full`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6">
              <Smartphone className="size-3.5" /> Activation Performance
            </p>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-4xl font-bold tracking-tight text-slate-900">{report.totalActivations}</div>
                <div className="text-xs text-slate-500 mt-0.5">total activations</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-xl font-bold tracking-tight text-slate-900">{crRegular}</div>
                  <div className="text-[10px] text-slate-500">Regular</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-xl font-bold tracking-tight text-slate-700">{report.totalActivationsCrossRegion}</div>
                  <div className="text-[10px] text-slate-500">Cross-Region</div>
                </div>
              </div>
              {topModel && (
                <div className="rounded-xl border border-slate-100 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 shrink-0">Top model</span>
                  <span className="text-[11px] font-semibold text-slate-900 truncate">{topModel.modelName}</span>
                  <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700 shrink-0">{topModel.qty}</Badge>
                </div>
              )}
              {crRatio > 0 && (
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-slate-500 shrink-0">CR ratio</div>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden w-full">
                    <div className="h-full rounded-full bg-slate-800" style={{ width: `${crRatio}%` }} />
                  </div>
                  <div className="text-[10px] font-semibold text-slate-900 shrink-0">{crRatio.toFixed(1)}%</div>
                </div>
              )}
            </div>
          </div>
          </div>{/* /col-span-1 Activation */}

          <div className="col-span-1">
          <div className={`${CARD} h-full`}>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Package className="size-3.5" /> Stock Intelligence
              </p>
              {agedUnits > 0 && (
                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  ⚠️ {agedUnits} &gt;30d
                </span>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-3xl font-bold tracking-tight text-slate-900">{totalStock}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">units on hand</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <div className="text-xs font-bold tracking-tight text-slate-900 leading-tight">{formatPKR(stockValue)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">stock value</div>
                </div>
              </div>
              <div className="space-y-2">
                {topStockModels.map((s) => {
                  const pct = (s.quantity / maxStockQty) * 100;
                  const oldest = stockOldestDate[s.modelId];
                  const ageDays = oldest ? Math.floor((today.getTime() - new Date(oldest).getTime()) / msPerDay) : 0;
                  return (
                    <div key={s.modelId} className="flex items-center gap-2">
                      <div className="w-20 text-[11px] truncate text-slate-500">{s.modelName}</div>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden w-full">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-6 text-right text-[11px] font-bold text-slate-900">{s.quantity}</div>
                      {ageDays > 30 && <span className="text-[9px] text-amber-500" title={`Oldest: ${oldest}`}>⚠️</span>}
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-500 text-right">{stock.length} model(s) total</div>
            </div>
          </div>
          </div>{/* /col-span-1 Stock */}

          <div className="col-span-1">
          <div className={`${CARD} h-full ${tb.eligible ? "ring-1 ring-emerald-200" : ""}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6">
              <Award className="size-3.5" /> Target Bonus
            </p>
            <div className="flex-1 space-y-4">
              <div>
                <div className={`text-4xl font-bold tracking-tight ${tb.eligible ? "text-emerald-600" : "text-slate-900"}`}>
                  {formatPKR(report.totals.bonusPercentEarned)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{tb.bonusPercent}% bonus</div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{tb.actualQty} purchased</span>
                  <span>target: {tb.targetQty ?? "—"}</span>
                </div>
                {tb.targetQty != null && (
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full transition-all ${tb.eligible ? "bg-emerald-500" : "bg-slate-300"}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
                <div className="text-center pt-1">
                  <Badge
                    variant={tb.eligible ? "default" : "secondary"}
                    className={`text-[11px] ${tb.eligible ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {tb.eligible ? "✓ Target Met" : `${progressPct.toFixed(0)}% to goal`}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          </div>{/* /col-span-1 Target Bonus */}

          {/* CR Risk Monitor — moved down */}
          <div className="col-span-1">
          <div className={`${CARD} h-full ${totalActualFines > 0 ? "ring-1 ring-rose-200" : crLoss.totalUnits > 0 ? "ring-1 ring-amber-200" : ""}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-3">
              <ShieldAlert className="size-3.5" /> CR Monitor
            </p>
            <div className="flex-1 space-y-2.5">
              {/* Units caught pill */}
              {crLoss.totalUnits > 0 && (
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${crLoss.totalUnits > 3 ? "bg-rose-500" : "bg-amber-400"}`} />
                  <span className="text-sm font-semibold text-slate-700">{crLoss.totalUnits} unit{crLoss.totalUnits !== 1 ? "s" : ""} caught</span>
                </div>
              )}
              {crLoss.totalUnits === 0 && totalActualFines === 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0 bg-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600">No CR risk</span>
                </div>
              )}

              {/* BLOCK 1: Actual fines deducted (red) */}
              {totalActualFines > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700">Fines Deducted</span>
                    <span className="text-sm font-black text-rose-700 font-mono tabular-nums">{formatPKR(totalActualFines)}</span>
                  </div>
                  {crLoss.totalFines > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-rose-600/80">
                      <span>Penalty fines (CR Outward)</span><span className="font-mono">{formatPKR(crLoss.totalFines)}</span>
                    </div>
                  )}
                  <p className="text-[9px] text-rose-500 leading-tight pt-0.5">Deducted from Net Receivable</p>
                </div>
              )}

              {/* BLOCK 2: Opportunity cost (amber, informational) */}
              {lostMargin > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Opportunity Cost</span>
                    <span className="text-sm font-black text-amber-700 font-mono tabular-nums">{formatPKR(lostMargin)}</span>
                  </div>
                  <p className="text-[9px] text-amber-600/80 leading-tight">Margin lost on {crLoss.totalUnits} caught unit{crLoss.totalUnits !== 1 ? "s" : ""} ({report.baseIncentivePercent + tb.bonusPercent}% rate). Not deducted from Net Receivable.</p>
                </div>
              )}

              {pendingCount > 0 && (
                <Link href="/cross-region">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between hover:bg-amber-100 transition-colors cursor-pointer">
                    <span className="text-[10px] font-medium text-amber-700">Pending transfers</span>
                    <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">{pendingCount}</Badge>
                  </div>
                </Link>
              )}
            </div>
          </div>
          </div>{/* /col-span-1 CR Monitor */}
        </div>{/* /ROW 2 */}

        {/* ROW 3: Execution Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="col-span-1">
          <div className={`${CARD} h-full`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6">
              <List className="size-3.5" /> Model Leaderboard
            </p>
            <div className="flex-1 space-y-3">
              {leaderRows.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-6">No activations this period</div>
              ) : (
                leaderRows.map((row, i) => {
                  const pct = (row.qtyActivated / maxActivated) * 100;
                  return (
                    <div key={row.modelId} className="flex items-center gap-3">
                      <div className="w-4 text-[10px] font-bold text-slate-400 shrink-0">{i + 1}</div>
                      <div className="w-24 text-[11px] font-medium text-slate-900 truncate shrink-0">{row.modelName}</div>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden w-full">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-6 text-right text-[11px] font-bold text-slate-900 shrink-0">{row.qtyActivated}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </div>{/* /col-span-1 Leaderboard */}

          {/* Inventory Worth — new card */}
          <div className="col-span-1">
          <div className={`${CARD} h-full`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6">
              <Package className="size-3.5" /> Inventory Worth
            </p>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-3xl font-black tracking-tight text-slate-900 font-mono">{formatPKR(stockValue)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{totalStock} units · unactivated stock</div>
              </div>
              <div className="space-y-2.5">
                <div className="rounded-xl bg-emerald-50 p-3.5 flex items-center justify-between ring-1 ring-emerald-100">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">4% Rate</div>
                    <div className="text-[10px] text-emerald-600/70 mt-0.5">Base incentive potential</div>
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">{formatPKR(Math.round(stockValue * 0.04))}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 flex items-center justify-between ring-1 ring-slate-100">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-700">1% Rate</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Dealer incentive potential</div>
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">{formatPKR(Math.round(stockValue * 0.01))}</div>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 text-center">Potential earnings if all {totalStock} units are activated</p>
            </div>
          </div>
          </div>{/* /col-span-1 Inventory Worth */}
        </div>{/* /ROW 3 */}

          </div>{/* /RIGHT flex-col */}

        </div>{/* /grid */}
      </div>
    );
  };

  const renderCharts = () => (
    <div className="space-y-6">
      {/* Slim KPI strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Phones", value: report.totalActivations, currency: false },
          { label: `${report.baseIncentivePercent}% earned`, value: report.totals.basePercentEarned, currency: true },
          { label: `Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, currency: true },
          { label: "Stock-In", value: report.totals.stockInEarned, currency: true },
          { label: "Total", value: report.totals.grandTotal, currency: true },
          { label: "Rebates", value: rebateTotal, currency: true },
          { label: "CR Loss", value: crLoss.lostIncentive, currency: true },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-[10px] text-muted-foreground truncate">{k.label}</div>
            <div className="text-sm font-semibold tabular-nums truncate">
              {k.currency ? formatPKR(k.value) : k.value.toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
      <TrendCharts data={sixMonths} />
      {modelSalesSection}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {(
                [
                  ["Active Phones", report.totalActivations.toLocaleString(), false],
                  [`Base Incentive (${report.baseIncentivePercent}%)`, formatPKR(report.totals.basePercentEarned), false],
                  [`Target Bonus (${tb.bonusPercent}%)`, formatPKR(report.totals.bonusPercentEarned), false],
                  ["Stock-In Earned", formatPKR(report.totals.stockInEarned), false],
                  ["Activation Incentive", formatPKR(report.totals.activationIncentiveEarned), false],
                  ["Dealer Incentive", formatPKR(report.totals.dealerIncentiveEarned), false],
                  ["Total from OPPO", formatPKR(report.totals.grandTotal), false],
                  ["Price-Drop Rebates", formatPKR(rebateTotal), true],
                  ["CR Caught Loss", formatPKR(crLoss.lostIncentive), false],
                ] as [string, string, boolean][]
              ).map(([k, v, highlight]) => (
                <div key={k} className="flex justify-between px-4 py-2.5">
                  <span className={highlight ? "text-cyan-700 dark:text-cyan-400 font-medium" : "text-muted-foreground"}>{k}</span>
                  <span className={`font-medium tabular-nums ${highlight ? "text-cyan-700 dark:text-cyan-400" : ""}`}>{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Target Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">{tb.actualQty}</div>
              <div className="text-sm text-muted-foreground">
                of {tb.targetQty ?? "—"} purchased
              </div>
            </div>
            {tb.targetQty != null && (
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (tb.actualQty / tb.targetQty) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {tb.eligible ? "✓ Purchase target met" : "Purchase target not yet met"}
            </p>
            {crLoss.totalUnits > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">CR Caught Loss</div>
                <div className="text-lg font-semibold">{crLoss.totalUnits} units</div>
                <div className="text-xs text-muted-foreground">
                  {formatPKR(crLoss.lostIncentive)} est. loss
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {incentiveSection}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stockSection}
        {modelSalesSection}
      </div>
    </div>
  );

  const renderCompact = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Active phones"
          value={report.totalActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label={`${report.baseIncentivePercent}% earned`}
          value={report.totals.basePercentEarned}
          format="currency"
          icon={<Percent className="size-4" />}
        />
        <KpiCard
          label={`Target ${tb.bonusPercent}%`}
          value={report.totals.bonusPercentEarned}
          format="currency"
          icon={<Award className="size-4" />}
          highlightZero
          progress={tb.targetQty != null ? { current: tb.actualQty, target: tb.targetQty } : undefined}
          helper={tb.eligible ? "Target met ✓" : `${tb.actualQty}/${tb.targetQty ?? "—"}`}
        />
        <KpiCard
          label="Stock-In"
          value={report.totals.stockInEarned}
          format="currency"
          icon={<Truck className="size-4" />}
        />
        <KpiCard
          label="Total"
          value={report.totals.grandTotal}
          format="currency"
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Rebates"
          value={rebateTotal}
          format="currency"
          icon={<RefreshCw className="size-4" />}
          helper={rebateTotal > 0 ? "Price-drop rebates" : "No rebates"}
        />
        <KpiCard
          label="CR Loss"
          value={crLoss.lostIncentive}
          format="currency"
          icon={<ShieldAlert className="size-4" />}
          highlightZero
          helper={crLoss.totalUnits > 0 ? `${crLoss.totalUnits} caught` : "No catches"}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Incentive Models
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {incentiveRows.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-muted-foreground">
                No incentive earned this period.
              </div>
            ) : (
              <div className="divide-y">
                {incentiveRows.map((row) => (
                  <div key={row.modelId} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <div className="text-xs font-medium">{row.modelName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.qtyActivated} act · {row.stockInRegularQty} stk
                      </div>
                    </div>
                    <div className="text-xs font-semibold tabular-nums">
                      {formatPKR(row.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Current Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stock.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-muted-foreground">No stock on hand.</div>
            ) : (
              <div className="divide-y">
                {stock.map((s) => (
                  <div key={s.modelId} className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-medium truncate">{s.modelName}</span>
                    <span className="text-sm font-bold tabular-nums">{s.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {modelSalesSection}
    </div>
  );

  // ── Financial layout ────────────────────────────────────────────────────────
  const renderFinancial = () => {
    const streams = [
      { label: `Base Incentive (${report.baseIncentivePercent}%)`, amount: report.totals.basePercentEarned, note: `${report.totalActivations} activations` },
      { label: `Target Bonus (${tb.bonusPercent}%)`, amount: report.totals.bonusPercentEarned, note: tb.eligible ? "Target met" : "Target not met" },
      { label: "Stock-In Earned", amount: report.totals.stockInEarned, note: `${report.rows.reduce((s, r) => s + r.stockInRegularQty, 0)} units stocked` },
      { label: "Activation Incentive", amount: report.totals.activationIncentiveEarned, note: "Per-activation bonus" },
      { label: "Dealer Incentive", amount: report.totals.dealerIncentiveEarned, note: "Dealer program bonus" },
    ].filter((s) => s.amount > 0);
    const netTotal = report.totals.grandTotal + rebateTotal - totalActualFines;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Income statement */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4" /> Income Statement — {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-4 py-2 bg-muted/40 border-b">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Gross Earnings</div>
              </div>
              {streams.map((s) => (
                <div key={s.label} className="flex items-center justify-between px-6 py-2.5 border-b last:border-b-0">
                  <div>
                    <div className="text-sm">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.note}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatPKR(s.amount)}</div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t-2">
                <div className="font-semibold text-sm">Gross Total</div>
                <div className="font-bold tabular-nums">{formatPKR(report.totals.grandTotal)}</div>
              </div>
              {rebateTotal > 0 && (
                <>
                  <div className="px-4 py-2 bg-cyan-50/60 dark:bg-cyan-950/20 border-t border-b border-cyan-200 dark:border-cyan-800">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">Receivables (Owed by OPPO)</div>
                  </div>
                  <div className="flex items-center justify-between px-6 py-2.5 border-b bg-cyan-50/40 dark:bg-cyan-950/10">
                    <div>
                      <div className="text-sm text-cyan-700 dark:text-cyan-400">Price-Drop Rebates</div>
                      <div className="text-[10px] text-muted-foreground">Stock on hand × price reduction</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-cyan-700 dark:text-cyan-400">
                      +{formatPKR(rebateTotal)}
                    </div>
                  </div>
                </>
              )}
              {totalActualFines > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/40 border-t border-b">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deductions (Cash Fines)</div>
                  </div>
                  {crLoss.totalFines > 0 && (
                    <div className="flex items-center justify-between px-6 py-2.5 border-b">
                      <div>
                        <div className="text-sm text-red-600 dark:text-red-400">CR Penalty Fines</div>
                        <div className="text-[10px] text-muted-foreground">Cash fines on CR Outward (caught units)</div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">−{formatPKR(crLoss.totalFines)}</div>
                    </div>
                  )}
                </>
              )}
              {lostMargin > 0 && (
                <>
                  <div className="px-4 py-2 bg-amber-50/60 dark:bg-amber-950/20 border-t border-b border-amber-200">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Opportunity Cost (Informational)</div>
                  </div>
                  <div className="flex items-center justify-between px-6 py-2.5 border-b bg-amber-50/30">
                    <div>
                      <div className="text-sm text-amber-700">Lost Margin on CR Caught</div>
                      <div className="text-[10px] text-muted-foreground">{crLoss.totalUnits} units × {report.baseIncentivePercent + tb.bonusPercent}% — not deducted from Net Receivable</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-amber-700">{formatPKR(lostMargin)}</div>
                  </div>
                </>
              )}
              {(rebateTotal > 0 || totalActualFines > 0) && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t-2">
                  <div className="font-semibold text-sm">Net Receivable from OPPO</div>
                  <div className="font-bold tabular-nums text-primary">{formatPKR(netTotal)}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side: target + activations */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">Target Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-4xl font-bold tabular-nums">{tb.actualQty}</div>
                  <div className="text-xs text-muted-foreground">of {tb.targetQty ?? "—"} units</div>
                </div>
                {tb.targetQty != null && (
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${tb.eligible ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, (tb.actualQty / tb.targetQty) * 100)}%` }}
                    />
                  </div>
                )}
                <div className="text-center">
                  <Badge variant={tb.eligible ? "default" : "secondary"} className={tb.eligible ? "bg-green-500 text-white" : ""}>
                    {tb.eligible ? "✓ Target Met" : "In Progress"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">Activations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tabular-nums text-center">{report.totalActivations}</div>
                {report.totalActivationsCrossRegion > 0 && (
                  <div className="text-xs text-muted-foreground text-center mt-1">
                    {report.totalActivationsCrossRegion} cross-region
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Model earnings table */}
        {incentiveRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Model Earnings Detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-muted/30 border-b text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <div className="col-span-2">Model</div>
                <div className="text-center">Activated</div>
                <div className="text-center">Stocked</div>
                <div className="text-right">Earned</div>
              </div>
              {incentiveRows.map((row) => (
                <div key={row.modelId} className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b last:border-b-0 text-sm">
                  <div className="col-span-2 font-medium truncate">{row.modelName}</div>
                  <div className="text-center tabular-nums">{row.qtyActivated}</div>
                  <div className="text-center tabular-nums">{row.stockInRegularQty}</div>
                  <div className="text-right font-semibold tabular-nums">{formatPKR(row.total)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Performance layout ───────────────────────────────────────────────────────
  const renderPerformance = () => {
    const totalStockVal = stock.reduce((s, st) => s + (st.dealerPrice ?? 0) * st.quantity, 0);
    const totalStockUnits = stock.reduce((s, st) => s + st.quantity, 0);
    const progPct = tb.targetQty != null ? Math.min(100, (tb.actualQty / tb.targetQty) * 100) : 0;

    return (
      <div className="space-y-4">
        {/* 4 hero blocks */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Grand Total Incentive</div>
              <div className="text-5xl font-black tabular-nums text-primary mt-2 leading-none">{formatPKR(report.totals.grandTotal)}</div>
              <div className="text-xs text-muted-foreground mt-2">{label}</div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Activations</div>
              <div className="text-5xl font-black tabular-nums mt-2 leading-none">{report.totalActivations}</div>
              <div className="text-xs text-muted-foreground mt-2">
                {report.totalActivationsCrossRegion} cross-region · {report.totalActivations - report.totalActivationsCrossRegion} regular
              </div>
            </CardContent>
          </Card>
          <Card className={`relative overflow-hidden ${tb.eligible ? "border-green-500/40" : ""}`}>
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Target Bonus Progress</div>
              <div className={`text-5xl font-black tabular-nums mt-2 leading-none ${tb.eligible ? "text-green-600 dark:text-green-400" : ""}`}>
                {tb.targetQty != null ? `${progPct.toFixed(0)}%` : "—"}
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${tb.eligible ? "bg-green-500" : "bg-primary"}`} style={{ width: `${progPct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">{tb.actualQty} / {tb.targetQty ?? "—"} purchased · {formatPKR(report.totals.bonusPercentEarned)} earned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Stock Portfolio Value</div>
              <div className="text-3xl font-black tabular-nums mt-2 leading-none">{formatPKR(totalStockVal)}</div>
              <div className="text-xs text-muted-foreground mt-2">{totalStockUnits} units · {stock.length} model(s)</div>
            </CardContent>
          </Card>
        </div>

        {/* Model performance bars */}
        {modelSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Smartphone className="size-4" /> Activation Performance by Model
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {modelSales.slice(0, 8).map((r, i) => {
                const pct = totalModelSales > 0 ? (r.qty / totalModelSales) * 100 : 0;
                return (
                  <div key={r.modelId} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                    <div className="w-5 text-sm font-bold text-muted-foreground shrink-0">{i + 1}</div>
                    <div className="w-36 text-sm font-medium truncate shrink-0">{r.modelName}</div>
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="w-10 text-right text-sm font-bold tabular-nums shrink-0">{r.qty}</div>
                    <div className="w-12 text-right text-xs text-muted-foreground shrink-0">{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Timeline layout ──────────────────────────────────────────────────────────
  const renderTimeline = () => {
    if (sixMonths.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">No monthly data available.</CardContent>
        </Card>
      );
    }

    const maxMonthTotal = Math.max(...sixMonths.map((m) => m.total), 1);
    const totalEarned = sixMonths.reduce((s, m) => s + m.total, 0);
    const avgMonthly = totalEarned / sixMonths.length;
    const bestMonthObj = sixMonths.reduce(
      (best, m) => (m.total > best.total ? m : best),
      sixMonths[0]
    );

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">6-Month Total</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatPKR(totalEarned)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Monthly Average</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatPKR(avgMonthly)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Best Month</div>
            <div className="text-xl font-bold mt-1">{bestMonthObj.label}</div>
            <div className="text-xs text-muted-foreground">{formatPKR(bestMonthObj.total)}</div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="size-4" /> Month-by-Month Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {[...sixMonths].reverse().map((m) => {
              const pct = (m.total / maxMonthTotal) * 100;
              const isBest = m.label === bestMonthObj.label;
              const isAboveAvg = m.total >= avgMonthly;
              return (
                <div key={m.label} className={`border-b last:border-b-0 ${isBest ? "bg-primary/4" : ""}`}>
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="w-20 shrink-0">
                      <div className="text-sm font-semibold">{m.label}</div>
                      {isBest && (
                        <Badge className="text-[9px] px-1.5 py-0 mt-0.5 bg-primary">Best</Badge>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="h-5 rounded-md bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all ${isBest ? "bg-primary" : "bg-primary/40"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-32 text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums">{formatPKR(m.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{m.activations} activations</div>
                    </div>
                    <div className="w-14 text-right shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] ${isAboveAvg ? "bg-green-500/15 text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                      >
                        {isAboveAvg ? "↑ avg" : "↓ avg"}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ── Executive layout ─────────────────────────────────────────────────────────
  const renderExecutive = () => {
    const totalStockUnits = stock.reduce((s, st) => s + st.quantity, 0);

    return (
      <div className="space-y-4">
        {/* Hero banner */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-primary/14 via-primary/6 to-transparent">
          <div className="absolute -top-8 -right-8 size-48 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">{dealerName}</div>
                <div className="text-5xl font-black tabular-nums text-primary mt-1 leading-none">
                  {formatPKR(report.totals.grandTotal)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">Total incentive earned · {label}</div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                <Badge
                  variant={tb.eligible ? "default" : "secondary"}
                  className={`text-sm px-4 py-1.5 ${tb.eligible ? "bg-green-500 hover:bg-green-500/90 text-white" : ""}`}
                >
                  {tb.eligible ? "✓ Purchase Target Met" : "Target Not Yet Met"}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {report.totalActivations} activations · {totalStockUnits} units in stock
                </div>
                {crLoss.totalUnits > 0 && (
                  <div className="text-xs text-red-500 font-medium">{crLoss.totalUnits} cross-region unit(s) caught</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key metrics strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Base Incentive", value: formatPKR(report.totals.basePercentEarned), sub: `${report.baseIncentivePercent}% rate`, variant: "default" as const },
            { label: "Target Bonus", value: formatPKR(report.totals.bonusPercentEarned), sub: `${tb.bonusPercent}% bonus rate`, variant: "default" as const },
            { label: "Stock-In Earned", value: formatPKR(report.totals.stockInEarned), sub: "Inventory incentive", variant: "default" as const },
            { label: "Rebates Receivable", value: formatPKR(rebateTotal), sub: "Price-drop rebates from OPPO", variant: "rebate" as const },
            { label: "Opp. Cost (CR)", value: formatPKR(lostMargin), sub: `${crLoss.totalUnits} unit(s) caught · not deducted`, variant: "danger" as const },
          ].map((k) => (
            <Card
              key={k.label}
              className={`p-4 ${k.variant === "danger" ? "border-red-500/30" : k.variant === "rebate" ? "border-cyan-500/30 bg-cyan-50/40 dark:bg-cyan-950/10" : ""}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-bold tabular-nums mt-1 ${k.variant === "danger" ? "text-red-600 dark:text-red-400" : k.variant === "rebate" ? "text-cyan-700 dark:text-cyan-400" : ""}`}>
                {k.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Model performance + stock */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activated Models — {label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {modelSales.length === 0 ? (
                <div className="px-4 pb-4 text-xs text-muted-foreground">No activations this period.</div>
              ) : (
                modelSales.slice(0, 7).map((r, i) => {
                  const pct = totalModelSales > 0 ? (r.qty / totalModelSales) * 100 : 0;
                  return (
                    <div key={r.modelId} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0">
                      <div className="w-4 text-xs text-muted-foreground font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 text-sm truncate">{r.modelName}</div>
                      <div className="w-20 shrink-0">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-sm font-bold tabular-nums w-8 text-right shrink-0">{r.qty}</div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Stock on Hand</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stock.length === 0 ? (
                <div className="px-4 pb-4 text-xs text-muted-foreground">No stock.</div>
              ) : (
                stock.slice(0, 7).map((s) => (
                  <div key={s.modelId} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0">
                    <div className="text-sm truncate">{s.modelName}</div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.dealerPrice != null && (
                        <div className="text-xs text-muted-foreground tabular-nums">{formatPKR(s.dealerPrice)}</div>
                      )}
                      <div className="text-sm font-bold tabular-nums w-8 text-right">{s.quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const layoutContent = {
    cards: renderCards,
    charts: renderCharts,
    overview: renderOverview,
    compact: renderCompact,
    financial: renderFinancial,
    performance: renderPerformance,
    timeline: renderTimeline,
    executive: renderExecutive,
  }[layout]();

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{dealerName}</strong> — {label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Link href="/cross-region">
              <Badge variant="outline" className="gap-1">
                <ArrowLeftRight className="size-3" />
                {pendingCount} pending cross-region
              </Badge>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Controls: date filter + layout switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-2">
          {(["month", "last-month", "week", "today", "custom"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                preset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p === "month"
                ? "This Month"
                : p === "last-month"
                ? "Last Month"
                : p === "week"
                ? "This Week"
                : p === "today"
                ? "Today"
                : "Custom"}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <Button size="sm" className="h-7 text-xs" onClick={applyCustom}>
                Apply
              </Button>
            </div>
          )}
          {pending && (
            <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
          )}
        </div>

        {/* Layout switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border p-1">
          {LAYOUTS.map(({ id, icon: Icon, label: lbl }) => (
            <button
              key={id}
              onClick={() => setLayout(id)}
              title={lbl}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                layout === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{lbl}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard content ── */}
      <div className={pending ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
        {layoutContent}
      </div>
    </div>
  );
}
