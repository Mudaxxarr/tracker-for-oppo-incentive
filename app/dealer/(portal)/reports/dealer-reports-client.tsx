"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/format";
import { FileBarChart2, FileSpreadsheet, ChevronDown, Lock, Check } from "lucide-react";
import { DEALER_ADDONS, type DealerAddonKey } from "@/lib/dealer-addons";
import { HelpTip } from "@/components/dealer/help-tip";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";

interface AddonState {
  detailedPdf: boolean;
  excel: boolean;
  incentivePdf: boolean;
}

interface Props {
  dealerName: string;
  initialStart: string;
  initialEnd: string;
  report: IncentiveReport | null;
  policies: PolicyAchievementEntry[];
  hasDealer: boolean;
  addons: AddonState;
}

function getMonthRange(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export function DealerReportsClient({ dealerName, initialStart, initialEnd, report, policies, hasDealer, addons }: Props) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [discrepancy, setDiscrepancy] = useState("");

  const apply = () => {
    const sp = new URLSearchParams({ periodStart: start, periodEnd: end });
    router.replace(`/dealer/reports?${sp.toString()}`);
  };

  const setPreset = (label: "this" | "last") => {
    const { start: s, end: e } = getMonthRange(label === "this" ? 0 : -1);
    setStart(s);
    setEnd(e);
  };

  const exportLink = (format: string, skipNoIncentive = false) => {
    const sp = new URLSearchParams({ periodStart: start, periodEnd: end, format });
    if (skipNoIncentive) sp.set("skipNoIncentive", "1");
    return `/api/dealer/report?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Full incentive breakdown. Compare against OPPO&apos;s ledger.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">End</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreset("this")}>This month</Button>
            <Button variant="outline" size="sm" onClick={() => setPreset("last")}>Last month</Button>
            <div className="ml-auto">
              <Button onClick={apply}>Generate</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasDealer && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active Dealer ID — create one in IDs first.
          </CardContent>
        </Card>
      )}

      {hasDealer && report && (
        <ReportSection
          dealerName={dealerName}
          report={report}
          policies={policies}
          discrepancy={discrepancy}
          onDiscrepancy={setDiscrepancy}
          downloads={[
            { label: "PDF Report", icon: "pdf" as const, href: exportLink("pdf") },
            ...(addons.incentivePdf
              ? [{ label: "PDF (Incentive models)", icon: "pdf" as const, href: exportLink("pdf", true) }]
              : []),
            addons.detailedPdf
              ? { label: "Detailed Breakup PDF", icon: "pdf" as const, href: exportLink("detailed-pdf") }
              : { label: "Detailed Breakup PDF", icon: "pdf" as const, href: "#addons", addonKey: "addon_detailed_pdf" as const },
            ...(addons.excel
              ? [
                  { label: "Excel (Full)", icon: "xlsx" as const, href: exportLink("xlsx") },
                  { label: "Excel (Incentive models)", icon: "xlsx" as const, href: exportLink("xlsx", true) },
                ]
              : [{ label: "Excel Exports", icon: "xlsx" as const, href: "#addons", addonKey: "addon_excel" as const }]),
          ]}
        />
      )}

      {hasDealer && report && (!addons.detailedPdf || !addons.excel) && (
        <AddonUpsell addons={addons} grandTotal={report.totals.grandTotal} />
      )}
    </div>
  );
}

interface DownloadItem { label: string; icon: "pdf" | "xlsx"; href: string; addonKey?: DealerAddonKey; }

function ReportSection({
  dealerName, report, policies, discrepancy, onDiscrepancy, downloads,
}: {
  dealerName: string;
  report: IncentiveReport;
  policies: PolicyAchievementEntry[];
  discrepancy: string;
  onDiscrepancy: (v: string) => void;
  downloads: DownloadItem[];
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const oppoLedger = Number(discrepancy.replace(/[^\d.-]/g, "")) || 0;
  const delta = oppoLedger - report.totals.grandTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{dealerName}</span>
          <div className="relative">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDropOpen((o) => !o)}>
              <FileBarChart2 className="size-4" />
              Download
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
            {dropOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border bg-popover py-1 shadow-lg">
                  {downloads.map((d) =>
                    d.addonKey ? (
                      <a key={d.label} href="#addons"
                        onClick={() => setDropOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                        <Lock className="size-3.5 shrink-0" />
                        <span className="flex-1">{d.label}</span>
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium">Add-on</span>
                      </a>
                    ) : (
                      <a key={d.href} href={d.href} target="_blank" rel="noreferrer"
                        onClick={() => setDropOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                        {d.icon === "pdf"
                          ? <FileBarChart2 className="size-3.5 shrink-0 text-rose-500" />
                          : <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600" />}
                        {d.label}
                      </a>
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Stat label="Activations" value={report.totalActivations.toString()} />
          <Stat label="4% earned" value={formatPKR(report.totals.basePercentEarned)} />
          <Stat
            label={`${report.targetBonus.bonusPercent}% Bonus`}
            value={formatPKR(report.totals.bonusPercentEarned)}
            sub={
              report.targetBonus.eligible
                ? `Purchase target met ✓ (${report.targetBonus.actualQty} purchased)`
                : `${report.targetBonus.actualQty}/${report.targetBonus.targetQty ?? "—"} purchased — not met`
            }
          />
          <Stat
            label={<span className="inline-flex items-center gap-1">Activation bonus <HelpTip term="activation-incentive" /></span>}
            value={formatPKR(report.totals.activationIncentiveEarned)}
          />
          <Stat
            label={<span className="inline-flex items-center gap-1">Dealer bonus <HelpTip term="dealer-incentive" /></span>}
            value={formatPKR(report.totals.dealerIncentiveEarned)}
          />
          <Stat
            label={<span className="inline-flex items-center gap-1">Stock bonus <HelpTip term="stock-in-incentive" /></span>}
            value={formatPKR(report.totals.stockInEarned)}
          />
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Grand total (engine)</div>
          <div className="text-2xl font-semibold tabular-nums">{formatPKR(report.totals.grandTotal)}</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">OPPO ledger says (PKR)</label>
              <Input type="number" placeholder="paste OPPO's amount here…" value={discrepancy} onChange={(e) => onDiscrepancy(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Delta (OPPO − engine)</label>
              <div className={
                delta === 0
                  ? "rounded-md border px-3 py-2 text-sm tabular-nums"
                  : delta < 0
                    ? "rounded-md border bg-destructive/10 px-3 py-2 text-sm font-medium tabular-nums text-destructive"
                    : "rounded-md border bg-emerald-500/10 px-3 py-2 text-sm font-medium tabular-nums text-emerald-600"
              }>
                {discrepancy ? formatPKR(delta) : "—"}
                {discrepancy && delta < 0 ? " under-credited" : ""}
                {discrepancy && delta > 0 ? " over-credited" : ""}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Per model</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Old / New price split</TableHead>
                  <TableHead className="text-right">4%</TableHead>
                  <TableHead className="text-right">1%</TableHead>
                  <TableHead className="text-right">Activation bonus</TableHead>
                  <TableHead className="text-right">Dealer</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">Stock bonus <HelpTip term="stock-in-incentive" /></span>
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((r) => (
                    <TableRow key={r.modelId}>
                      <TableCell className="font-medium">{r.modelName}</TableCell>
                      <TableCell label="Qty" className="text-right tabular-nums">
                        {r.qtyActivated}
                        {r.qtyActivatedCrossRegion > 0 && (
                          <Badge variant="secondary" className="ml-2">{r.qtyActivatedCrossRegion} CR</Badge>
                        )}
                      </TableCell>
                      <TableCell label="Price split" className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {r.priceSubperiods.map((s, i) => (
                          <span key={i} className="ml-1 tabular-nums">{s.qty}@{formatPKR(s.dealerPrice)}</span>
                        ))}
                      </TableCell>
                      <TableCell label="4%" className="text-right tabular-nums">{formatPKR(r.basePercentEarned)}</TableCell>
                      <TableCell label="1%" className="text-right tabular-nums">{formatPKR(r.bonusPercentEarned)}</TableCell>
                      <TableCell label="Activation bonus" className="text-right tabular-nums">{formatPKR(r.activationIncentiveEarned)}</TableCell>
                      <TableCell label="Dealer" className="text-right tabular-nums">{formatPKR(r.dealerIncentiveEarned)}</TableCell>
                      <TableCell label="Stock bonus" className="text-right tabular-nums">{formatPKR(r.stockInEarned)}</TableCell>
                      <TableCell label="Total" className="text-right font-medium tabular-nums">{formatPKR(r.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {report.totalActivationsCrossRegion > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong>Cross-region note:</strong> {report.totalActivationsCrossRegion} phones were cross-region.
            They earn 4% / 1% / activation / dealer incentive but are excluded from stock-in.
          </div>
        )}

        {policies.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Policies &amp; Achievements</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Per unit / %</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium capitalize">{p.type.replace(/-/g, " ")}</TableCell>
                      <TableCell label="Model" className="text-xs">{p.modelName ?? <span className="text-muted-foreground">All models</span>}</TableCell>
                      <TableCell label="Period" className="whitespace-nowrap text-xs text-muted-foreground">{p.periodStart} → {p.periodEnd}</TableCell>
                      <TableCell label="Target" className="text-right tabular-nums text-xs">{p.targetQty ?? "—"}</TableCell>
                      <TableCell label="Per unit / %" className="text-right tabular-nums text-xs">
                        {p.type === "target-bonus" ? `${p.perUnitAmount}%` : formatPKR(p.perUnitAmount)}
                      </TableCell>
                      <TableCell label="Actual" className="text-right tabular-nums text-xs">{p.actualQty}</TableCell>
                      <TableCell label="Earned" className="text-right tabular-nums text-xs font-medium">{formatPKR(p.earned)}</TableCell>
                      <TableCell className="text-right">
                        {p.eligible
                          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Met ✓</span>
                          : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">Not Met ✗</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ADDON_REQUEST_LS_KEY = "oppo_addon_requests";

function AddonUpsell({ addons, grandTotal }: { addons: AddonState; grandTotal: number }) {
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADDON_REQUEST_LS_KEY);
      if (raw) setRequested(JSON.parse(raw) as Record<string, boolean>);
    } catch { /* ignore */ }
  }, []);

  const request = async (key: DealerAddonKey) => {
    setPending(key);
    try {
      const res = await fetch("/api/dealer/addon-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon: key }),
      });
      if (res.ok) {
        const next = { ...requested, [key]: true };
        setRequested(next);
        try { localStorage.setItem(ADDON_REQUEST_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
    } finally {
      setPending(null);
    }
  };

  const locked = DEALER_ADDONS.filter((a) =>
    a.key === "addon_detailed_pdf" ? !addons.detailedPdf : !addons.excel,
  );
  if (locked.length === 0) return null;

  return (
    <Card id="addons" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">Available add-ons</CardTitle>
        <p className="text-sm text-muted-foreground">
          These reports are already computed for your account every period. They just are not being delivered to you yet.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {locked.map((a) => (
          <div key={a.key} className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Lock className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{a.label}</span>
              <Badge variant="secondary" className="ml-auto tabular-nums">
                PKR {a.monthlyPrice}/month
              </Badge>
            </div>
            <div className="space-y-3 px-4 py-3">
              <div
                aria-hidden
                className="select-none rounded-md bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground [mask-image:linear-gradient(180deg,black_30%,transparent)]"
              >
                {a.preview.map((line) => (
                  <div key={line} className="whitespace-pre">{line}</div>
                ))}
              </div>
              <p className="max-w-prose text-sm text-muted-foreground">{a.tagline}</p>
              {grandTotal > 0 && a.key === "addon_detailed_pdf" && (
                <p className="text-xs text-muted-foreground">
                  Your engine total this period is <span className="font-medium tabular-nums">{formatPKR(grandTotal)}</span>.
                  This PDF shows exactly how every rupee of it was earned, line by line.
                </p>
              )}
              <div className="flex items-center gap-3">
                {requested[a.key] ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <Check className="size-4" /> Requested. Your administrator has been notified.
                  </span>
                ) : (
                  <>
                    <Button size="sm" disabled={pending === a.key} onClick={() => request(a.key)}>
                      {pending === a.key ? "Sending request…" : "Request activation"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Added to your monthly subscription once enabled.
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: ReactNode; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
