"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataValue } from "@/components/ui/data-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealerPurchaseForm } from "./dealer-purchase-form";
import { DealerBulkInvoiceForm } from "./dealer-bulk-invoice-form";
import { PurchaseKpiCard } from "@/app/(app)/purchases/purchase-kpi-card";
import { PurchaseTrendChart } from "@/app/(app)/purchases/purchase-trend-chart";
import { PurchaseBillTimeline } from "@/app/(app)/purchases/purchase-bill-timeline";
import { PurchaseTopModelsPanel } from "@/app/(app)/purchases/purchase-top-models-panel";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatDate, formatPKR } from "@/lib/format";
import { Plus, Trash2, AlertCircle, ShoppingCart, ShoppingCart as ShoppingCartKpi, Boxes, Wallet, Tag, Layers, ArrowLeftRight, Filter } from "lucide-react";
import { deleteDealerPurchaseAction, loadDealerPurchaseBillsAction } from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { PurchaseRow, PurchaseOverviewStats } from "@/lib/db/queries/purchases";
import type { BillGroup } from "@/lib/purchases/purchase-stats";

interface Props {
  models: ModelWithCurrentPrice[];
  initialPurchases: PurchaseRow[];
  initialFilters: { modelId?: string; source?: string; from?: string; to?: string };
  hasDealer: boolean;
  dealerId: string | null;
  tenantId: string;
  role: "admin" | "exec";
  backdateDays: number;
  canBulk: boolean;
  canOverview: boolean;
  bills: BillGroup[];
  billsTotal: number;
  billsPageSize: number;
  overview: PurchaseOverviewStats | null;
  overviewRange: { from: string; to: string };
}

function percentChangeSafe(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function DealerPurchasesClient({
  models,
  initialPurchases,
  initialFilters,
  hasDealer,
  dealerId,
  tenantId,
  role,
  backdateDays,
  canBulk,
  canOverview,
  bills,
  billsTotal,
  billsPageSize,
  overview,
  overviewRange,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"records" | "overview">("overview");
  const [mobileTab, setMobileTab] = useState<"daily" | "overview">("daily");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [, startTransition] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) search.set(k, v); });
    router.replace(`/dealer/purchases${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    if (!confirm(`Delete this ${modelName} purchase row? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteDealerPurchaseAction(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Purchase deleted");
      router.refresh();
    });
  };

  const loadMoreBills = (page: number) =>
    loadDealerPurchaseBillsAction({
      modelId: filters.modelId,
      source: filters.source,
      from: overviewRange.from,
      to: overviewRange.to,
      page,
      pageSize: billsPageSize,
    });

  const cur = overview?.current;

  const filterControls = (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Models</span>
        <Select
          value={filters.modelId ?? "all"}
          onValueChange={(v) => updateFilter("modelId", typeof v === "string" && v !== "all" ? v : undefined)}
        >
          <SelectTrigger><SelectValue placeholder="All models" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{m.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{m.dealerPrice != null ? formatPKR(m.dealerPrice) : "no price"}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">From date</span>
        <Input type="date" value={filters.from ?? ""} onChange={(e) => updateFilter("from", e.target.value || undefined)} aria-label="From date" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">To date</span>
        <Input type="date" value={filters.to ?? ""} onChange={(e) => updateFilter("to", e.target.value || undefined)} aria-label="To date" />
      </div>
    </>
  );

  const renderOverview = (compact: boolean) => {
    if (!overview || !cur) {
      return <EmptyState icon={ShoppingCart} title="No purchase data yet." description="Add a purchase to see the overview." />;
    }
    return (
      <div className="space-y-4">
        <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6")}>
          <PurchaseKpiCard icon={ShoppingCartKpi} label="Bills" value={String(cur.billCount)} deltaPercent={percentChangeSafe(cur.billCount, overview.previous.billCount)} />
          <PurchaseKpiCard icon={Boxes} label="Quantity" value={String(cur.totalQty)} deltaPercent={percentChangeSafe(cur.totalQty, overview.previous.totalQty)} />
          <PurchaseKpiCard icon={Wallet} label="Amount" value={formatPKR(cur.totalAmount)} deltaPercent={overview.growthPercent} />
          <PurchaseKpiCard icon={Tag} label="Avg. Price / Unit" value={formatPKR(cur.avgPricePerUnit)} />
          <PurchaseKpiCard icon={Layers} label="Models" value={String(cur.uniqueModels)} />
          <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region" value={String(cur.crossRegionQty)} />
        </div>

        {compact ? (
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-80">Total Amount</p>
                <p className="text-2xl font-semibold tabular-nums">{formatPKR(cur.totalAmount)}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-white/15"><ShoppingCartKpi className="size-4" /></span>
            </div>
            <PurchaseTrendChart data={cur.dailySeries} dataKey="amount" variant="sparkline" color="var(--primary-foreground)" dotStroke="var(--primary)" valueFormatter={(v) => formatPKR(v)} className="mt-3" />
          </div>
        ) : null}

        <div className={cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-3")}>
          <div className={cn("rounded-xl border border-border bg-card p-4", !compact && "xl:col-span-2")}>
            <p className="mb-2 text-sm font-medium">{compact ? "QTY Over Days" : "Purchases Over Time (Amount)"}</p>
            <PurchaseTrendChart data={cur.dailySeries} dataKey={compact ? "qty" : "amount"} valueFormatter={(v) => (compact ? String(v) : formatPKR(v))} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Top Models by Quantity</p>
            <PurchaseTopModelsPanel models={cur.topModels} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Highlights</p>
          <dl className="divide-y">
            <div className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted-foreground">Highest Bill</dt>
              <dd className="font-medium tabular-nums">{cur.highestBill ? formatPKR(cur.highestBill.amount) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted-foreground">Lowest Bill</dt>
              <dd className="font-medium tabular-nums">{cur.lowestBill ? formatPKR(cur.lowestBill.amount) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted-foreground">Avg Qty / Bill</dt>
              <dd className="font-medium tabular-nums">{cur.avgQtyPerBill.toFixed(1)}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted-foreground">Top Model (Qty)</dt>
              <dd className="font-medium">{cur.topModels[0] ? `${cur.topModels[0].modelName} · ${cur.topModels[0].qty}` : "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted-foreground">Purchase Growth %</dt>
              <dd className={cn("font-medium tabular-nums", (overview.growthPercent ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {overview.growthPercent != null ? `${overview.growthPercent}%` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <PurchaseBillTimeline initialBills={bills} total={billsTotal} loadMore={loadMoreBills} />
      </div>
    );
  };

  const recordsTable = (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Dealer ₨</TableHead>
                <TableHead className="text-right">Total ₨</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState icon={ShoppingCart} title="No purchases yet for this dealer ID." description="Add a purchase to begin tracking stock." />
                  </TableCell>
                </TableRow>
              ) : (
                initialPurchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.modelName}</TableCell>
                    <TableCell label="Qty" className="text-right"><DataValue value={p.quantity} /></TableCell>
                    <TableCell label="Unit ₨" className="text-right"><DataValue value={p.unitDealerPrice} format="currency" /></TableCell>
                    <TableCell label="Total ₨" className="text-right"><DataValue value={p.unitDealerPrice * p.quantity} format="currency" /></TableCell>
                    <TableCell label="Date">{formatDate(p.purchaseDate)}</TableCell>
                    <TableCell label="Source">
                      {p.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? (
                        <StatusBadge status="neutral" label="Cross-Region" />
                      ) : (
                        <StatusBadge status="confirmed" label="Regular" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => handleDelete(p.id, p.modelName)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const addButton = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button disabled={!hasDealer || models.length === 0}>
            <Plus className="size-4" />
            Add Purchase
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>Add Purchase</SheetTitle></SheetHeader>
        <div className="p-4">
          <Tabs defaultValue="single">
            <TabsList className={cn("grid w-full", canBulk ? "grid-cols-2" : "grid-cols-1")}>
              <TabsTrigger value="single">Single line</TabsTrigger>
              {canBulk && <TabsTrigger value="bulk">Bulk invoice</TabsTrigger>}
            </TabsList>
            <TabsContent value="single" className="pt-3">
              <DealerPurchaseForm models={models} dealerId={dealerId ?? ""} tenantId={tenantId} role={role} backdateDays={backdateDays} onSuccess={() => { setOpen(false); toast.success("Purchase added"); router.refresh(); }} />
            </TabsContent>
            {canBulk && (
              <TabsContent value="bulk" className="pt-3">
                <DealerBulkInvoiceForm models={models} onSuccess={() => { setOpen(false); router.refresh(); }} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );

  // KPI cards + day-wise bill timeline — the aligned "records" experience shown
  // to every dealer. The deep Overview analytics (charts, top models, growth,
  // highlights) is the paid `pur_overview` add-on and stays behind canOverview.
  const kpiCards = (compact: boolean) =>
    overview && cur ? (
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6")}>
        <PurchaseKpiCard icon={ShoppingCartKpi} label="Total Purchases" value={String(cur.billCount)} />
        <PurchaseKpiCard icon={Boxes} label="Total Quantity" value={String(cur.totalQty)} />
        <PurchaseKpiCard icon={Wallet} label="Total Amount" value={formatPKR(cur.totalAmount)} />
        <PurchaseKpiCard icon={Tag} label="Avg. Price / Unit" value={formatPKR(cur.avgPricePerUnit)} />
        {!compact && <PurchaseKpiCard icon={Layers} label="Models" value={String(cur.uniqueModels)} />}
        {!compact && <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region" value={String(cur.crossRegionQty)} />}
      </div>
    ) : null;

  if (!canOverview) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">Stock arriving at your dealer ID. 4% only triggers on activation.</p>
          </div>
          {addButton}
        </div>

        {!hasDealer ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              <CardTitle>No active Dealer ID</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Create a Dealer ID first on the IDs page.</CardContent>
          </Card>
        ) : null}

        {/* ── MOBILE ── */}
        <div className="md:hidden space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{formatDate(overviewRange.from)} – {formatDate(overviewRange.to)}</p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowMobileFilters((v) => !v)}>
              <Filter className="size-3.5" /> Filter
            </Button>
          </div>
          {showMobileFilters ? (
            <Card><CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">{filterControls}</CardContent></Card>
          ) : null}
          {kpiCards(true)}
          <PurchaseBillTimeline initialBills={bills} total={billsTotal} loadMore={loadMoreBills} />
        </div>

        {/* ── DESKTOP ── */}
        <div className="hidden md:block space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{filterControls}</div></CardContent>
          </Card>
          {kpiCards(false)}
          <PurchaseBillTimeline initialBills={bills} total={billsTotal} loadMore={loadMoreBills} />
          {recordsTable}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">Stock arriving at your dealer ID. 4% only triggers on activation.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex rounded-lg border overflow-hidden text-xs">
            {(["overview", "records"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {v === "overview" ? "Overview" : "Records"}
              </button>
            ))}
          </div>
          {addButton}
        </div>
      </div>

      {!hasDealer ? (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <AlertCircle className="size-5 text-amber-500" />
            <CardTitle>No active Dealer ID</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Create a Dealer ID first on the IDs page.</CardContent>
        </Card>
      ) : null}

      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <div className="mb-3 flex rounded-lg border overflow-hidden text-xs">
          {(["daily", "overview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={`flex-1 px-3 py-2 transition-colors ${mobileTab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              {t === "daily" ? "Daily Purchase" : "Overview"}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{formatDate(overviewRange.from)} – {formatDate(overviewRange.to)}</p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowMobileFilters((v) => !v)}>
            <Filter className="size-3.5" /> Filter
          </Button>
        </div>

        {showMobileFilters ? (
          <Card className="mb-4">
            <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">{filterControls}</CardContent>
          </Card>
        ) : null}

        {mobileTab === "daily" && overview && cur ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <PurchaseKpiCard icon={ShoppingCartKpi} label="Total Purchases" value={String(cur.billCount)} />
              <PurchaseKpiCard icon={Boxes} label="Total Quantity" value={String(cur.totalQty)} />
              <PurchaseKpiCard icon={Wallet} label="Total Amount" value={formatPKR(cur.totalAmount)} />
              <PurchaseKpiCard icon={Tag} label="Avg. Price" value={formatPKR(cur.avgPricePerUnit)} />
            </div>
            <PurchaseBillTimeline initialBills={bills} total={billsTotal} loadMore={loadMoreBills} />
          </div>
        ) : null}

        {mobileTab === "overview" ? renderOverview(true) : null}
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:block space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{filterControls}</div>
          </CardContent>
        </Card>

        {view === "overview" ? renderOverview(false) : recordsTable}
      </div>
    </div>
  );
}
