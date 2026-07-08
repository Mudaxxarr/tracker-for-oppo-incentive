"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
import { PurchaseForm } from "./purchase-form";
import { BulkInvoiceForm } from "./bulk-invoice-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseKpiCard } from "./purchase-kpi-card";
import { PurchaseTrendChart } from "./purchase-trend-chart";
import { PurchaseBillTimeline } from "./purchase-bill-timeline";
import { PurchaseTopModelsPanel } from "./purchase-top-models-panel";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { formatDate, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckSquare, Pencil, Plus, Trash2, AlertCircle, ShoppingCart, ShoppingCart as ShoppingCartKpi, AlertTriangle, Boxes, Wallet, Tag, Layers, ArrowLeftRight, Filter } from "lucide-react";
import type { PurchaseOverviewStats } from "@/lib/db/queries/purchases";
import type { BillGroup } from "@/lib/purchases/purchase-stats";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deletePurchaseAction,
  updatePurchaseAction,
  bulkDeletePurchasesAction,
  loadPurchaseBillsAction,
  type PurchaseFormState,
} from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { PurchaseRow } from "@/lib/db/queries/purchases";

interface Props {
  models: ModelWithCurrentPrice[];
  initialPurchases: PurchaseRow[];
  initialFilters: { modelId?: string; source?: string; from?: string; to?: string };
  hasDealer: boolean;
  bills: BillGroup[];
  billsTotal: number;
  billsPage: number;
  billsPageSize: number;
  overview: PurchaseOverviewStats | null;
  overviewRange: { from: string; to: string };
  lowStockCount: number;
}

function percentChangeSafe(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function PurchasesClient({ models, initialPurchases, initialFilters, hasDealer, bills, billsTotal, billsPageSize, overview, overviewRange, lowStockCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"records" | "overview">("overview");
  const [mobileTab, setMobileTab] = useState<"daily" | "overview">("daily");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [editId, setEditId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [, startTransition] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    setSelected(new Set());
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    router.replace(`/purchases${search.size ? `?${search}` : ""}`);
  };

  const loadMoreBills = (page: number) =>
    loadPurchaseBillsAction({
      modelId: filters.modelId,
      source: filters.source,
      from: overviewRange.from,
      to: overviewRange.to,
      page,
      pageSize: billsPageSize,
    });

  const handleDelete = (id: string, modelName: string) => {
    setPendingDelete({ id, label: modelName });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const res = await deletePurchaseAction(id);
      if (res.error) { toast.error(res.error); return; }
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      toast.success("Purchase deleted");
      router.refresh();
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    setPendingBulkDelete(true);
  };

  const confirmBulkDelete = () => {
    const ids = [...selected];
    setPendingBulkDelete(false);
    startTransition(async () => {
      const { deleted, blocked } = await bulkDeletePurchasesAction(ids);
      setSelected(new Set());
      if (blocked && blocked.length > 0) {
        toast.error(
          deleted > 0
            ? `${deleted} deleted. ${blocked.length} couldn't be deleted — units already activated.`
            : `Cannot delete — all selected purchases have activated units.`
        );
      } else {
        toast.success(`${deleted} purchase(s) deleted`);
      }
      router.refresh();
    });
  };

  const allIds = initialPurchases.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onEditDone = () => { setEditId(null); router.refresh(); };

  return (
    <div className="space-y-6">
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <Trash2 className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-semibold">Delete Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-medium text-foreground">{pendingDelete?.label}</span> purchase record permanently? Rows with activated units cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              <Trash2 className="size-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBulkDelete} onOpenChange={(o) => { if (!o) setPendingBulkDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <Trash2 className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-semibold">
              Delete {selected.size} Purchase{selected.size > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Rows with activated units will be skipped automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete}>
              <Trash2 className="size-4" />
              Delete {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Stock arriving at your dealer ID. 4% only triggers on activation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["records", "overview"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {v === "records" ? "Records" : "Overview"}
              </button>
            ))}
          </div>
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
            <SheetHeader>
              <SheetTitle>Add Purchase</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <Tabs defaultValue="single">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">Single line</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk invoice</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="pt-3">
                  <PurchaseForm
                    models={models}
                    onSuccess={() => {
                      setOpen(false);
                      toast.success("Purchase added");
                      router.refresh();
                    }}
                  />
                </TabsContent>
                <TabsContent value="bulk" className="pt-3">
                  <BulkInvoiceForm
                    models={models}
                    onSuccess={() => {
                      setOpen(false);
                      router.refresh();
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      <div className="md:hidden">
        <div className="mb-3 flex rounded-lg border overflow-hidden text-xs">
          {(["daily", "overview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={`flex-1 px-3 py-2 transition-colors ${
                mobileTab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "daily" ? "Daily Purchase" : "Overview"}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {formatDate(overviewRange.from)} – {formatDate(overviewRange.to)}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowMobileFilters((v) => !v)}>
            <Filter className="size-3.5" /> Filter
          </Button>
        </div>

        {showMobileFilters ? (
          <Card className="mb-4">
            <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Models</span>
                <Select
                  value={filters.modelId ?? "all"}
                  onValueChange={(v) => updateFilter("modelId", typeof v === "string" && v !== "all" ? v : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
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
            </CardContent>
          </Card>
        ) : null}

        {mobileTab === "daily" && overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <PurchaseKpiCard icon={ShoppingCartKpi} label="Total Purchases" value={String(overview.current.billCount)} />
              <PurchaseKpiCard icon={Boxes} label="Total Quantity" value={String(overview.current.totalQty)} />
              <PurchaseKpiCard icon={Wallet} label="Total Amount" value={formatPKR(overview.current.totalAmount)} />
              <PurchaseKpiCard icon={Tag} label="Avg. Price" value={formatPKR(overview.current.avgPricePerUnit)} />
            </div>
            <PurchaseBillTimeline initialBills={bills} total={billsTotal} loadMore={loadMoreBills} />
          </div>
        ) : null}

        {mobileTab === "overview" && overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <PurchaseKpiCard icon={ShoppingCartKpi} label="Bills" value={String(overview.current.billCount)} />
              <PurchaseKpiCard icon={Boxes} label="Quantity" value={String(overview.current.totalQty)} />
              <PurchaseKpiCard icon={Wallet} label="Amount" value={formatPKR(overview.current.totalAmount)} />
              <PurchaseKpiCard icon={Tag} label="Avg. Price / Unit" value={formatPKR(overview.current.avgPricePerUnit)} />
              <PurchaseKpiCard icon={Layers} label="Models" value={String(overview.current.uniqueModels)} />
              <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region" value={String(overview.current.crossRegionQty)} />
            </div>

            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Amount</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatPKR(overview.current.totalAmount)}</p>
                </div>
                <span className="grid size-9 place-items-center rounded-full bg-white/15">
                  <ShoppingCartKpi className="size-4" />
                </span>
              </div>
              <PurchaseTrendChart
                data={overview.current.dailySeries}
                dataKey="amount"
                variant="sparkline"
                color="var(--primary-foreground)"
                dotStroke="var(--primary)"
                valueFormatter={(v) => formatPKR(v)}
                className="mt-3"
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-sm font-medium">QTY Over Days</p>
              <PurchaseTrendChart data={overview.current.dailySeries} dataKey="qty" valueFormatter={(v) => String(v)} />
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Highlights</p>
              <dl className="divide-y">
                <div className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">Highest Bill</dt>
                  <dd className="font-medium tabular-nums">{overview.current.highestBill ? formatPKR(overview.current.highestBill.amount) : "—"}</dd>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">Lowest Bill</dt>
                  <dd className="font-medium tabular-nums">{overview.current.lowestBill ? formatPKR(overview.current.lowestBill.amount) : "—"}</dd>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">Top Model (Qty)</dt>
                  <dd className="font-medium">{overview.current.topModels[0] ? `${overview.current.topModels[0].modelName} · ${overview.current.topModels[0].qty}` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">Low Stock Risk</dt>
                  <dd className={cn("font-medium", lowStockCount > 0 && "text-destructive")}>{lowStockCount} Model{lowStockCount === 1 ? "" : "s"}</dd>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">Purchase Growth %</dt>
                  <dd className={cn("font-medium tabular-nums", (overview.growthPercent ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                    {overview.growthPercent != null ? `${overview.growthPercent}%` : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Top Models by Quantity</p>
              <PurchaseTopModelsPanel models={overview.current.topModels} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden md:block">
      {!hasDealer ? (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <AlertCircle className="size-5 text-amber-500" />
            <CardTitle>No active Dealer ID</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create a Dealer ID first on the IDs page.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Models</span>
              <Select
                value={filters.modelId ?? "all"}
                onValueChange={(v) =>
                  updateFilter("modelId", typeof v === "string" && v !== "all" ? v : undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
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
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => updateFilter("from", e.target.value || undefined)}
                aria-label="From date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">To date</span>
              <Input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => updateFilter("to", e.target.value || undefined)}
                aria-label="To date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {view === "overview" && overview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <PurchaseKpiCard icon={ShoppingCartKpi} label="Bills" value={String(overview.current.billCount)} deltaPercent={percentChangeSafe(overview.current.billCount, overview.previous.billCount)} deltaLabel={`vs ${formatDate(overview.previousLabel.from)}`} />
            <PurchaseKpiCard icon={Boxes} label="Quantity" value={String(overview.current.totalQty)} deltaPercent={percentChangeSafe(overview.current.totalQty, overview.previous.totalQty)} />
            <PurchaseKpiCard icon={Wallet} label="Amount" value={formatPKR(overview.current.totalAmount)} deltaPercent={overview.growthPercent} />
            <PurchaseKpiCard icon={Tag} label="Avg. Price / Unit" value={formatPKR(overview.current.avgPricePerUnit)} />
            <PurchaseKpiCard icon={Layers} label="Models" value={String(overview.current.uniqueModels)} />
            <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region Qty" value={String(overview.current.crossRegionQty)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
              <p className="mb-2 text-sm font-medium">Purchases Over Time (Amount)</p>
              <PurchaseTrendChart data={overview.current.dailySeries} dataKey="amount" valueFormatter={(v) => formatPKR(v)} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Top Models by Quantity</p>
              <PurchaseTopModelsPanel models={overview.current.topModels} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <PurchaseKpiCard icon={Boxes} label="Avg Qty / Bill" value={overview.current.avgQtyPerBill.toFixed(1)} />
            <PurchaseKpiCard icon={Wallet} label="Avg Amount / Bill" value={formatPKR(overview.current.avgAmountPerBill)} />
            <PurchaseKpiCard icon={Wallet} label="Highest Bill" value={overview.current.highestBill ? formatPKR(overview.current.highestBill.amount) : "—"} />
            <PurchaseKpiCard icon={Wallet} label="Lowest Bill" value={overview.current.lowestBill ? formatPKR(overview.current.lowestBill.amount) : "—"} />
            <PurchaseKpiCard icon={Layers} label="Models This Range" value={String(overview.current.uniqueModels)} />
            <PurchaseKpiCard icon={AlertTriangle} label="Low Stock Risk" value={`${lowStockCount} Model${lowStockCount === 1 ? "" : "s"}`} danger={lowStockCount > 0} />
          </div>

          <PurchaseBillTimeline initialBills={bills} total={billsTotal} loadMore={loadMoreBills} />
        </div>
      ) : null}

      {view === "records" ? (
      <Card>
        {someSelected && (
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 bg-muted/50">
            <span className="text-sm font-medium">
              <CheckSquare className="mr-1.5 inline size-4 text-primary" />
              {selected.size} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={handleBulkDelete}>
                <Trash2 className="size-3.5" /> Delete selected
              </Button>
            </div>
          </div>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Dealer ₨</TableHead>
                  <TableHead className="text-right">Total ₨</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState icon={ShoppingCart} title="No purchases yet for this dealer ID." description="Add a purchase to begin tracking stock." />
                    </TableCell>
                  </TableRow>
                ) : (
                  initialPurchases.map((p) => {
                    if (editId === p.id) {
                      return (
                        <EditPurchaseRow
                          key={p.id}
                          row={p}
                          onDone={onEditDone}
                          onCancel={() => setEditId(null)}
                        />
                      );
                    }
                    return (
                      <TableRow
                        key={p.id}
                        data-selected={selected.has(p.id)}
                        className="data-[selected=true]:bg-primary/5"
                      >
                        <TableCell className="pl-4">
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer rounded border-border accent-primary"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            aria-label="Select row"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{p.modelName}</TableCell>
                        <TableCell label="Qty" className="text-right"><DataValue value={p.quantity} /></TableCell>
                        <TableCell label="Unit ₨" className="text-right">
                          <DataValue value={p.unitDealerPrice} format="currency" />
                        </TableCell>
                        <TableCell label="Total ₨" className="text-right">
                          <DataValue value={p.unitDealerPrice * p.quantity} format="currency" />
                        </TableCell>
                        <TableCell label="Date">{formatDate(p.purchaseDate)}</TableCell>
                        <TableCell label="Source">
                          {p.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? (
                            <StatusBadge status="neutral" label="Cross-Region" />
                          ) : (
                            <StatusBadge status="confirmed" label="Regular" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit"
                              onClick={() => setEditId(p.id)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => handleDelete(p.id, p.modelName)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      ) : null}
      </div>
    </div>
  );
}

function EditPurchaseRow({
  row,
  onDone,
  onCancel,
}: {
  row: PurchaseRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PurchaseFormState, FormData>(
    updatePurchaseAction,
    {}
  );
  const [qty, setQty] = useState(String(row.quantity));
  const [dealerPrice, setDealerPrice] = useState(String(row.unitDealerPrice));
  const [invoicePrice, setInvoicePrice] = useState(String(row.unitInvoicePrice));
  const [purchaseDate, setPurchaseDate] = useState(row.purchaseDate);
  const [source, setSource] = useState(row.source);

  useEffect(() => {
    if (state.ok) { toast.success("Purchase updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={8} className="p-2">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <span className="min-w-[80px] text-sm font-medium">{row.modelName}</span>
          <Input
            name="quantity"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            className="w-20"
            placeholder="Qty"
          />
          <Input
            name="unitDealerPrice"
            type="number"
            step="any"
            min={0}
            value={dealerPrice}
            onChange={(e) => setDealerPrice(e.target.value)}
            required
            className="w-28"
            placeholder="Dealer ₨"
          />
          <Input
            name="unitInvoicePrice"
            type="number"
            step="any"
            min={0}
            value={invoicePrice}
            onChange={(e) => setInvoicePrice(e.target.value)}
            required
            className="w-28"
            placeholder="Invoice ₨"
          />
          <Input
            name="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
            className="w-36"
          />
          <select
            name="source"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value={PURCHASE_SOURCE.REGULAR}>Regular</option>
            <option value={PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN}>Cross-Region</option>
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
