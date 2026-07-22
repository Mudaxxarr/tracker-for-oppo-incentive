"use client";

import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
import { downloadFile } from "@/lib/download-file";
import {
  FileBarChart2, FileSpreadsheet, ChevronDown, TrendingUp,
  Smartphone, Wallet, RefreshCw, ShieldAlert, Truck, Award,
  CircleCheck, CircleX, BookOpen,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { CrShiftedValueResult } from "@/lib/db/queries/purchases";
import type { RebateRow } from "@/lib/db/queries/rebates";

interface CrCaughtLoss {
  totalUnits: number;
  potentialLoss: number;
  totalFines: number;
  priceUnitSum: number;
}

export interface DownloadItem {
  label: string;
  icon: "pdf" | "xlsx";
  href: string;
  featured?: boolean;
}

// ── Primitives ──────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-[#EAEAEA] bg-white", className)}>
      {children}
    </div>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em] text-[#787774] mb-3", className)}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-[#EAEAEA]" />;
}

type TagVariant = "green" | "yellow" | "blue" | "red" | "gray";
const tagStyles: Record<TagVariant, string> = {
  green: "bg-[#EDF3EC] text-[#346538]",
  yellow: "bg-[#FBF3DB] text-[#956400]",
  blue: "bg-[#E1F3FE] text-[#1F6C9F]",
  red: "bg-[#FDEBEC] text-[#9F2F2D]",
  gray: "bg-[#F7F6F3] text-[#787774]",
};

function Tag({ children, variant = "gray", className }: { children: React.ReactNode; variant?: TagVariant; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
      tagStyles[variant],
      className
    )}>
      {children}
    </span>
  );
}

// ── Filter Bar ──────────────────────────────────────────────────
export interface FilterBarPremiumProps {
  start: string;
  end: string;
  dealers: { id: string; name: string }[];
  selected: string[];
  isPending: boolean;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onToggleDealer: (id: string) => void;
  onPreset: (label: "this" | "last") => void;
  onApply: () => void;
}

export function FilterBarPremium({
  start, end, dealers, selected, isPending,
  onStartChange, onEndChange, onToggleDealer, onPreset, onApply,
}: FilterBarPremiumProps) {
  return (
    <Card>
      <div className="px-5 py-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#787774]">Start</label>
          <input
            type="date"
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
            className="rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-3 py-2 text-sm text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none transition-colors duration-150"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#787774]">End</label>
          <input
            type="date"
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
            className="rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-3 py-2 text-sm text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none transition-colors duration-150"
          />
        </div>
        <div className="inline-flex items-center rounded-md border border-[#EAEAEA] overflow-hidden">
          {(["this", "last"] as const).map((p, i) => (
            <button
              key={p}
              onClick={() => onPreset(p)}
              className={cn(
                "px-3 py-2 text-xs font-medium text-[#787774] hover:bg-[#F7F6F3] hover:text-[#111111] transition-colors duration-150",
                i === 0 && "border-r border-[#EAEAEA]"
              )}
            >
              {p === "this" ? "This Month" : "Last Month"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={onApply}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-[6px] bg-[#111111] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
          >
            {isPending
              ? <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.5} />
              : "Generate"}
          </button>
        </div>
      </div>
      <Divider />
      <div className="px-5 py-3 flex flex-wrap gap-1.5">
        {dealers.map((d) => (
          <button
            key={d.id}
            onClick={() => onToggleDealer(d.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
              selected.includes(d.id)
                ? "bg-[#111111] text-white"
                : "border border-[#EAEAEA] text-[#787774] hover:border-[#AAAAAA] hover:text-[#111111]"
            )}
          >
            {d.name}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Report Section ──────────────────────────────────────────────
export interface ReportSectionPremiumProps {
  dealerName: string;
  report: IncentiveReport;
  policies: PolicyAchievementEntry[];
  crCaughtLoss: CrCaughtLoss;
  crShiftedValue: CrShiftedValueResult;
  rebateTotal: number;
  rebateRows: RebateRow[];
  discrepancy: string;
  onDiscrepancy: (v: string) => void;
  downloads: DownloadItem[];
  pdfTheme: "naval" | "arctic";
  onThemeChange: (t: "naval" | "arctic") => void;
}

export function ReportSectionPremium({
  dealerName, report, policies, crCaughtLoss, crShiftedValue,
  rebateTotal, rebateRows, discrepancy, onDiscrepancy,
  downloads, pdfTheme, onThemeChange,
}: ReportSectionPremiumProps) {
  const tb = report.targetBonus;
  const oppoLedger = Number(discrepancy.replace(/[^\d.-]/g, "")) || 0;
  const delta = oppoLedger - report.totals.grandTotal;
  const netReceivable = report.totals.grandTotal + rebateTotal - crCaughtLoss.totalFines;
  const totalStockedUnits = report.rows.reduce((s, r) => s + r.stockInRegularQty, 0);
  const bonusPct = tb.targetQty != null && tb.targetQty > 0
    ? Math.min(100, (tb.actualQty / tb.targetQty) * 100) : null;

  const earningStreams = [
    { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned, color: "#6D28D9" },
    { label: `Target Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, color: "#1D4ED8" },
    { label: "Stock-In Earned", value: report.totals.stockInEarned, color: "#047857" },
    { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "#B45309" },
    { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "#B91C1C" },
  ].filter((s) => s.value > 0);

  return (
    <Card className="overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 border-b border-[#EAEAEA]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#787774] mb-1">Dealer Report</p>
          <h2 className="text-2xl font-black tracking-[-0.02em] text-[#111111] leading-tight">{dealerName}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Tag variant="green">{report.totalActivations} activations</Tag>
            <Tag variant="gray">{totalStockedUnits} stocked</Tag>
            {report.totalActivationsCrossRegion > 0 && (
              <Tag variant="blue">{report.totalActivationsCrossRegion} cross-region</Tag>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-[#EAEAEA] bg-white px-3.5 py-2 text-xs font-medium text-[#2F3437] hover:bg-[#F7F6F3] transition-colors duration-150 outline-none">
            <FileBarChart2 className="size-3.5 text-[#787774]" strokeWidth={1.5} />
            Download
            <ChevronDown className="size-3 text-[#787774]" strokeWidth={1.5} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-2 flex items-center gap-2">
              <span className="text-[11px] text-[#787774] shrink-0">Theme</span>
              <div className="inline-flex items-center rounded-md border border-[#EAEAEA] overflow-hidden text-xs">
                {(["naval", "arctic"] as const).map((t, i) => (
                  <button key={t} onClick={() => onThemeChange(t)}
                    className={cn("px-2.5 py-1 font-medium capitalize transition-colors duration-150",
                      i === 0 && "border-r border-[#EAEAEA]",
                      pdfTheme === t ? "bg-[#111111] text-white" : "text-[#787774] hover:bg-[#F7F6F3]"
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-[#787774]">PDF</DropdownMenuLabel>
              {downloads.filter((d) => d.icon === "pdf").map((d) => (
                <DropdownMenuItem key={d.href} onClick={() => downloadFile(d.href)} className={d.featured ? "font-semibold" : ""}>
                  {d.featured
                    ? <BookOpen className="size-3.5 text-[#1F6C9F]" strokeWidth={1.5} />
                    : <FileBarChart2 className="size-3.5 text-[#9F2F2D]" strokeWidth={1.5} />}
                  {d.label}
                  {d.featured && <Tag variant="blue" className="ml-auto">New</Tag>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-[#787774]">Excel</DropdownMenuLabel>
              {downloads.filter((d) => d.icon === "xlsx").map((d) => (
                <DropdownMenuItem key={d.href} onClick={() => downloadFile(d.href)}>
                  <FileSpreadsheet className="size-3.5 text-[#346538]" strokeWidth={1.5} />
                  {d.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-5 space-y-4">

        {/* ── KPI Bento — asymmetric 2fr 1fr 1fr ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">

          {/* Gross — wide card */}
          <Card className="p-5">
            <Eyebrow>Gross from OPPO</Eyebrow>
            <p className="text-[2.75rem] font-black tracking-[-0.04em] text-[#111111] leading-none tabular-nums">
              {formatPKR(report.totals.grandTotal)}
            </p>
            {earningStreams.length > 0 && (
              <div className="mt-4 flex h-[3px] overflow-hidden rounded-full gap-px">
                {earningStreams.map((s, i) => (
                  <div key={i} style={{ width: `${(s.value / report.totals.grandTotal) * 100}%`, backgroundColor: s.color }} />
                ))}
              </div>
            )}
            {earningStreams.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {earningStreams.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1 text-[10px] text-[#787774]">
                    <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Rebates */}
          <Card className="p-5">
            <Eyebrow>Rebates</Eyebrow>
            <p className={cn("text-[2rem] font-black tracking-[-0.04em] leading-none tabular-nums",
              rebateTotal > 0 ? "text-[#1F6C9F]" : "text-[#EAEAEA]"
            )}>
              {rebateTotal > 0 ? formatPKR(rebateTotal) : "—"}
            </p>
            <div className="mt-3">
              {rebateTotal > 0
                ? <Tag variant="blue">{rebateRows.length} price-drop{rebateRows.length > 1 ? "s" : ""}</Tag>
                : <Tag variant="gray">No price drops</Tag>
              }
            </div>
          </Card>

          {/* Net Receivable */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow className="mb-0">Net Receivable</Eyebrow>
              <Tag variant="green">Net</Tag>
            </div>
            <p className="text-[2rem] font-black tracking-[-0.04em] text-[#346538] leading-none tabular-nums">
              {formatPKR(netReceivable)}
            </p>
            {(rebateTotal > 0 || crCaughtLoss.totalFines > 0) && (
              <div className="mt-3 space-y-1 text-[11px] tabular-nums text-[#787774]">
                <div className="flex justify-between"><span>Incentives</span><span>{formatPKR(report.totals.grandTotal)}</span></div>
                {rebateTotal > 0 && <div className="flex justify-between text-[#1F6C9F]"><span>+ Rebates</span><span>{formatPKR(rebateTotal)}</span></div>}
                {crCaughtLoss.totalFines > 0 && <div className="flex justify-between text-[#9F2F2D]"><span>− CR Fines</span><span>−{formatPKR(crCaughtLoss.totalFines)}</span></div>}
              </div>
            )}
          </Card>
        </div>

        {/* ── Income Streams + Target Bonus — bento split ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 items-start">

          {/* Income Streams */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <Eyebrow>Income Streams Breakdown</Eyebrow>
            </div>
            {earningStreams.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-[#787774]">No earnings this period.</div>
            ) : (
              <>
                <div className="divide-y divide-[#EAEAEA]">
                  {earningStreams.map((s) => {
                    const pct = report.totals.grandTotal > 0 ? (s.value / report.totals.grandTotal) * 100 : 0;
                    return (
                      <div key={s.label} className="flex items-center gap-4 px-5 py-3">
                        <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="w-40 shrink-0 text-sm text-[#2F3437] truncate">{s.label}</span>
                        <div className="flex-1 h-1 rounded-full bg-[#EAEAEA] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ width: `${pct}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="w-7 text-right text-[11px] text-[#787774] shrink-0">{pct.toFixed(0)}%</span>
                        <span className="w-28 text-right text-sm font-semibold tabular-nums text-[#111111] shrink-0">
                          {formatPKR(s.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-5 py-3 bg-[#F7F6F3] border-t border-[#EAEAEA]">
                  <span className="text-xs text-[#787774]">Grand Total (engine)</span>
                  <span className="text-sm font-black tabular-nums text-[#111111]">{formatPKR(report.totals.grandTotal)}</span>
                </div>
              </>
            )}
          </Card>

          {/* Target Bonus */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-3">
              <Eyebrow className="mb-0">Target Bonus</Eyebrow>
              <Tag variant={tb.eligible ? "green" : "yellow"}>
                {tb.eligible ? "Achieved" : "Not Yet"}
              </Tag>
            </div>
            <p className={cn("text-[2rem] font-black tracking-[-0.04em] leading-none tabular-nums",
              tb.eligible ? "text-[#346538]" : "text-[#EAEAEA]"
            )}>
              {formatPKR(report.totals.bonusPercentEarned)}
            </p>
            <p className="mt-2 text-xs text-[#787774]">
              {tb.actualQty} / {tb.targetQty ?? "—"} units · {tb.bonusPercent}% rate
            </p>
            {!tb.eligible && tb.targetQty != null && (
              <p className="text-xs text-[#956400] mt-0.5">{tb.targetQty - tb.actualQty} more needed</p>
            )}
            {bonusPct !== null && (
              <div className="mt-4 h-1.5 rounded-full bg-[#EAEAEA] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${bonusPct}%`, backgroundColor: tb.eligible ? "#346538" : "#B45309" }} />
              </div>
            )}
          </Card>
        </div>

        {/* ── Reconciliation ── */}
        <Card className="p-5">
          <Eyebrow>Reconcile with OPPO Ledger</Eyebrow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
            <div>
              <p className="text-[11px] text-[#787774] mb-1.5">Our calculation</p>
              <div className="rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-4 py-2.5 text-sm font-semibold tabular-nums text-[#111111]">
                {formatPKR(report.totals.grandTotal)}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-[#787774] mb-1.5">OPPO ledger says (PKR)</p>
              <Input
                type="number"
                placeholder="Paste OPPO's amount…"
                value={discrepancy}
                onChange={(e) => onDiscrepancy(e.target.value)}
                className="border-[#EAEAEA] rounded-md focus-visible:ring-0 focus-visible:border-[#111111] text-[#111111]"
              />
            </div>
            <div>
              <p className="text-[11px] text-[#787774] mb-1.5">Delta</p>
              <div className={cn("rounded-md border px-4 py-2.5 text-sm font-semibold tabular-nums",
                !discrepancy ? "border-[#EAEAEA] text-[#EAEAEA]"
                : delta === 0 ? "border-[#EAEAEA] bg-[#EDF3EC] text-[#346538]"
                : delta < 0 ? "border-[#EAEAEA] bg-[#FDEBEC] text-[#9F2F2D]"
                : "border-[#EAEAEA] bg-[#EDF3EC] text-[#346538]"
              )}>
                {discrepancy
                  ? `${delta >= 0 ? "+" : ""}${formatPKR(delta)}${delta < 0 ? " under-credited" : delta > 0 ? " over-credited" : " — matches"}`
                  : "—"}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Per-Model Table ── */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <Eyebrow>Per-Model Breakdown</Eyebrow>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[#EAEAEA] bg-[#F7F6F3]">
                  {[
                    ["Model", "left"],
                    ["Activated", "right"],
                    ["Price Split", "right"],
                    [`${report.baseIncentivePercent}%`, "right"],
                    [`${tb.bonusPercent}%`, "right"],
                    ["Act.", "right"],
                    ["Dealer", "right"],
                    ["Stock-In", "right"],
                    ["Total", "right"],
                  ].map(([h, a]) => (
                    <th key={h} className={cn(
                      "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#787774] whitespace-nowrap font-normal",
                      a === "right" && "text-right"
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#787774]">No data for this period.</td>
                  </tr>
                ) : report.rows.map((r) => (
                  <tr key={r.modelId}
                    className={cn("transition-colors duration-150 hover:bg-[#F7F6F3]", r.total === 0 && "opacity-40")}>
                    <td className="px-4 py-3 font-semibold text-[#111111] whitespace-nowrap">{r.modelName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#2F3437]">
                      {r.qtyActivated}
                      {r.qtyActivatedCrossRegion > 0 && (
                        <Tag variant="blue" className="ml-1.5">{r.qtyActivatedCrossRegion} CR</Tag>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-[#787774] tabular-nums">
                      {r.priceSubperiods.map((s, i) => <span key={i} className="ml-1">{s.qty}@{formatPKR(s.dealerPrice)}</span>)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#787774]">{formatPKR(r.basePercentEarned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#787774]">{formatPKR(r.bonusPercentEarned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#787774]">{formatPKR(r.activationIncentiveEarned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#787774]">{formatPKR(r.dealerIncentiveEarned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#787774]">{formatPKR(r.stockInEarned)}</td>
                    <td className="px-4 py-3 text-right font-black tabular-nums text-[#111111]">{formatPKR(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.totalActivationsCrossRegion > 0 && (
            <p className="px-5 py-3 text-[11px] text-[#787774] border-t border-[#EAEAEA]">
              {report.totalActivationsCrossRegion} cross-region phone{report.totalActivationsCrossRegion > 1 ? "s" : ""} earn base%/bonus%/activation/dealer incentive but are excluded from stock-in.
            </p>
          )}
        </Card>

        {/* ── Rebates ── */}
        {rebateRows.length > 0 && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAEAEA]">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-3.5 text-[#1F6C9F]" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-[#111111]">Price-Drop Rebates</span>
                <Tag variant="blue">OPPO Owes You</Tag>
              </div>
              <span className="text-sm font-black tabular-nums text-[#1F6C9F]">{formatPKR(rebateTotal)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EAEAEA] bg-[#F7F6F3]">
                    {["Date", "Model", "Dealer", "Old Price", "New Price", "−/Unit", "Stock", "Rebate"].map((h, i) => (
                      <th key={h} className={cn("px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#787774] font-normal", i > 2 && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {rebateRows.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F7F6F3] transition-colors duration-150">
                      <td className="px-4 py-2.5 text-xs text-[#787774] whitespace-nowrap">{r.rebateDate}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#111111]">{r.modelName}</td>
                      <td className="px-4 py-2.5 text-xs text-[#787774]">{r.dealerName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#AAAAAA] line-through">{formatPKR(r.oldDealerPrice)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#787774]">{formatPKR(r.newDealerPrice)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-[#1F6C9F]">+{formatPKR(r.rebatePerUnit)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#2F3437]">{r.eligibleQty}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-black text-[#1F6C9F]">{formatPKR(r.totalRebateAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#EAEAEA] bg-[#F7F6F3]">
                    <td colSpan={7} className="px-4 py-3 text-right text-xs font-semibold text-[#787774]">Total Rebate Receivable</td>
                    <td className="px-4 py-3 text-right tabular-nums font-black text-[#1F6C9F]">{formatPKR(rebateTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── CR-Caught ── */}
        {crCaughtLoss.totalUnits > 0 && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAEAEA]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-3.5 text-[#9F2F2D]" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-[#111111]">CR-Caught Loss</span>
              </div>
              <Tag variant="red">{crCaughtLoss.totalUnits} unit{crCaughtLoss.totalUnits > 1 ? "s" : ""} caught</Tag>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-[#EAEAEA]">
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#787774] mb-2">Units Caught</p>
                <p className="text-3xl font-black tabular-nums text-[#9F2F2D]">{crCaughtLoss.totalUnits}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#787774] mb-2">Potential incentive loss (est.)</p>
                <p className="text-2xl font-black tabular-nums text-[#9F2F2D]">{formatPKR(crCaughtLoss.potentialLoss)}</p>
                <p className="text-[10px] text-[#787774] mt-1">base % + bonus + incentives earned by met policies</p>
              </div>
              {crCaughtLoss.totalFines > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#787774] mb-2">Cash Fines</p>
                  <p className="text-2xl font-black tabular-nums text-[#9F2F2D]">{formatPKR(crCaughtLoss.totalFines)}</p>
                  <p className="text-[10px] text-[#787774] mt-1">direct penalty deduction</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── CR-Shifted ── */}
        {crShiftedValue.totalUnits > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <Eyebrow>CR-Shifted Stock Received</Eyebrow>
                <Tag variant="gray">{crShiftedValue.totalUnits} units · {formatPKR(crShiftedValue.totalValue)}</Tag>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-[#EAEAEA] bg-[#F7F6F3]">
                    {["Model", "Units", "Dealer Price", "Value"].map((h, i) => (
                      <th key={h} className={cn("px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#787774] font-normal", i > 0 && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {crShiftedValue.byModel.map((m) => (
                    <tr key={m.modelId} className="hover:bg-[#F7F6F3] transition-colors duration-150">
                      <td className="px-4 py-3 font-semibold text-[#111111]">{m.modelName}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#2F3437]">{m.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#787774]">{formatPKR(m.dealerPrice)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#111111]">{formatPKR(m.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Policies ── */}
        {policies.length > 0 && (
          <div>
            <Eyebrow>Policies &amp; Achievements</Eyebrow>
            <div className="divide-y divide-[#EAEAEA] rounded-xl border border-[#EAEAEA] overflow-hidden bg-white">
              {policies.map((p, i) => {
                const progPct = p.targetQty != null && p.targetQty > 0
                  ? Math.min(100, (p.actualQty / p.targetQty) * 100) : null;
                return (
                  <div key={i} className="px-5 py-4 hover:bg-[#F7F6F3] transition-colors duration-150">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {p.eligible
                            ? <CircleCheck className="size-3.5 text-[#346538] shrink-0" strokeWidth={1.5} />
                            : <CircleX className="size-3.5 text-[#EAEAEA] shrink-0" strokeWidth={1.5} />}
                          <span className="text-sm font-semibold text-[#111111] capitalize">{p.type.replace(/-/g, " ")}</span>
                          {p.modelName && <Tag variant="gray">{p.modelName}</Tag>}
                          {p.eligible && <Tag variant="green">Earned</Tag>}
                        </div>
                        <p className="text-[11px] text-[#787774] pl-5">
                          {p.periodStart} → {p.periodEnd}
                          {p.targetQty != null && ` · ${p.actualQty}/${p.targetQty}${p.eligible ? "" : ` (${p.targetQty - p.actualQty} more needed)`}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-base font-black tabular-nums", p.eligible ? "text-[#346538]" : "text-[#EAEAEA]")}>
                          {formatPKR(p.earned)}
                        </p>
                        <p className="text-[10px] text-[#787774]">
                          {p.type === "target-bonus" ? `${p.perUnitAmount}% rate` : `${formatPKR(p.perUnitAmount)}/unit`}
                        </p>
                      </div>
                    </div>
                    {progPct !== null && (
                      <div className="mt-3 h-1 rounded-full bg-[#EAEAEA] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{ width: `${progPct}%`, backgroundColor: p.eligible ? "#346538" : "#B45309" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}
