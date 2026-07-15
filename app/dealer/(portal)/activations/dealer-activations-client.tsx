"use client";

import { useMemo, useState, useTransition } from "react";
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
import { DealerActivationForm } from "./dealer-activation-form";
import { DealerBulkActivationForm } from "./dealer-bulk-activation-form";
import { SyncIndicator } from "@/components/dealer/sync-indicator";
import { PurchaseKpiCard } from "@/app/(app)/purchases/purchase-kpi-card";
import { PurchaseTrendChart } from "@/app/(app)/purchases/purchase-trend-chart";
import { PurchaseTopModelsPanel } from "@/app/(app)/purchases/purchase-top-models-panel";
import { ActivationTimeline } from "@/app/(app)/activations/activation-timeline";
import { formatDate, formatPKR, maskImei } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CheckSquare, Smartphone, Wallet, Target, TrendingUp, Layers, ArrowLeftRight, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { deleteDealerActivationAction, bulkDeleteDealerActivationsAction } from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ActivationRow, ActivationOverviewStats } from "@/lib/db/queries/activations";
import type { StockRow } from "@/lib/db/queries/purchases";

type CrFilter = "all" | "regular" | "cross";

interface Props {
  models: ModelWithCurrentPrice[];
  stock: StockRow[];
  initialActivations: ActivationRow[];
  initialFilters: { modelId?: string; from?: string; to?: string };
  hasDealer: boolean;
  dealerId: string | null;
  tenantId: string;
  role: "admin" | "exec";
  canBulk: boolean;
  canBulkDelete: boolean;
  canOverview: boolean;
  overview: ActivationOverviewStats | null;
  overviewRange: { from: string; to: string };
  basePercent: number;
}

export function DealerActivationsClient({
  models,
  stock,
  initialActivations,
  initialFilters,
  hasDealer,
  dealerId,
  tenantId,
  role,
  canBulk,
  canBulkDelete,
  canOverview,
  overview,
  overviewRange,
  basePercent,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"records" | "overview">("overview");
  const [mobileTab, setMobileTab] = useState<"daily" | "overview">("daily");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [crFilter, setCrFilter] = useState<CrFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSyncing, startTransition] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    setSelected(new Set());
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) search.set(k, v); });
    router.replace(`/dealer/activations${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    if (!confirm(`Delete this ${modelName} activation? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteDealerActivationAction(id);
        setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
        toast.success("Activation deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} activation(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const { deleted } = await bulkDeleteDealerActivationsAction(ids);
        setSelected(new Set());
        toast.success(`${deleted} activation(s) deleted`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const recordRows = useMemo(
    () => initialActivations.filter((a) => (crFilter === "all" ? true : crFilter === "cross" ? a.isCrossRegion : !a.isCrossRegion)),
    [initialActivations, crFilter]
  );
  const allIds = recordRows.map((a) => a.id);
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

  const cur = overview?.current;
  const trendData = (cur?.dailySeries ?? []).map((p) => ({ date: p.date, amount: 0, qty: p.count }));
  const topModels = (cur?.topModels ?? []).map((m) => ({ modelId: m.modelId, modelName: m.modelName, qty: m.count }));
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = overview?.timeline.find((g) => g.date === today)?.count ?? 0;
  const quietestDay = cur && cur.dailySeries.length > 0 ? cur.dailySeries.reduce((min, p) => (p.count < min.count ? p : min)) : null;

  const kpis = {
    total: String(cur?.totalActivations ?? 0),
    incentive: overview ? formatPKR(overview.totalIncentiveEarned) : "—",
    target: overview && overview.targetProgress.percent != null ? `${overview.targetProgress.percent}%` : "—",
    sellThrough: overview && overview.sellThrough.percent != null ? `${overview.sellThrough.percent}%` : "—",
    models: String(cur?.uniqueModels ?? 0),
    crossRegion: String(cur?.crossRegionCount ?? 0),
  };

  const renderOverview = (compact: boolean) => {
    if (!overview || !cur) {
      return <EmptyState icon={Smartphone} title="No activation data yet." description="Add an activation to see the overview." />;
    }
    return (
      <div className="space-y-4">
        <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6")}>
          <PurchaseKpiCard icon={Smartphone} label="Total Activations" value={kpis.total} deltaPercent={overview.growthPercent} />
          <PurchaseKpiCard icon={Wallet} label="Incentive Earned" value={kpis.incentive} />
          <PurchaseKpiCard icon={Target} label="Target Progress" value={kpis.target} />
          <PurchaseKpiCard icon={TrendingUp} label="Sell-through" value={kpis.sellThrough} />
          <PurchaseKpiCard icon={Layers} label="Unique Models" value={kpis.models} />
          <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region" value={kpis.crossRegion} />
        </div>

        {compact ? (
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-80">Today&apos;s Activations</p>
                <p className="text-2xl font-semibold tabular-nums">{todayCount}</p>
                <p className="mt-1 text-xs opacity-80">This period: {cur.totalActivations}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-white/15"><Smartphone className="size-4" /></span>
            </div>
            <PurchaseTrendChart data={trendData} dataKey="qty" variant="sparkline" color="var(--primary-foreground)" dotStroke="var(--primary)" valueFormatter={(v) => String(v)} className="mt-3" />
          </div>
        ) : null}

        <div className={cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-3")}>
          <div className={cn("rounded-xl border border-border bg-card p-4", !compact && "xl:col-span-2")}>
            <p className="mb-2 text-sm font-medium">Daily Activations</p>
            <PurchaseTrendChart data={trendData} dataKey="qty" valueFormatter={(v) => String(v)} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Top Models by Activation</p>
            <PurchaseTopModelsPanel models={topModels} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Highlights</p>
          <dl className="divide-y">
            <HighlightRow label="Best Selling Model" value={cur.topModels[0] ? `${cur.topModels[0].modelName} · ${cur.topModels[0].count}` : "—"} />
            <HighlightRow label="Busiest Day" value={cur.busiestDay ? `${formatDate(cur.busiestDay.date)} · ${cur.busiestDay.count}` : "—"} />
            <HighlightRow label="Quietest Day" value={quietestDay ? `${formatDate(quietestDay.date)} · ${quietestDay.count}` : "—"} />
            <HighlightRow label="Avg / Active Day" value={cur.avgPerActiveDay > 0 ? cur.avgPerActiveDay.toFixed(1) : "—"} />
            <HighlightRow label="Cross-Region Share" value={`${cur.crossRegionPercent}%`} />
            <HighlightRow label="Target" value={overview.targetProgress.targetQty != null ? `${overview.targetProgress.actualQty} / ${overview.targetProgress.targetQty}` : "No target set"} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Activation Timeline</p>
          <ActivationTimeline groups={overview.timeline} />
        </div>
      </div>
    );
  };

  const filterControls = (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Models</span>
        <Select value={filters.modelId ?? "all"} onValueChange={(v) => updateFilter("modelId", typeof v === "string" && v !== "all" ? v : undefined)}>
          <SelectTrigger><SelectValue placeholder="All models" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Source</span>
        <Select value={crFilter} onValueChange={(v) => typeof v === "string" && setCrFilter(v as CrFilter)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="cross">Cross-Region</SelectItem>
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

  const recordsTable = (
    <Card>
      {canBulkDelete && someSelected && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 bg-muted/50">
          <span className="text-sm font-medium"><CheckSquare className="mr-1.5 inline size-4 text-primary" />{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
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
                {canBulkDelete && (
                  <TableHead className="w-10 pl-4">
                    <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                )}
                <TableHead>Model</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Dealer ₨</TableHead>
                <TableHead className="text-right">Incentive ₨</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canBulkDelete ? 8 : 7}>
                    <EmptyState icon={Smartphone} title="No activations to show." description="Add an activation or adjust the filters." />
                  </TableCell>
                </TableRow>
              ) : recordRows.map((a) => (
                <TableRow key={a.id} data-selected={selected.has(a.id)} className="data-[selected=true]:bg-primary/5">
                  {canBulkDelete && (
                    <TableCell className="pl-4">
                      <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} aria-label="Select row" />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{a.modelName}</TableCell>
                  <TableCell label="IMEI" className="font-mono text-xs">{maskImei(a.imei)}</TableCell>
                  <TableCell label="Date">{formatDate(a.activationDate)}</TableCell>
                  <TableCell label="Dealer ₨" className="text-right"><DataValue value={a.dealerPriceSnapshot} format="currency" /></TableCell>
                  <TableCell label="Incentive ₨" className="text-right"><DataValue value={Math.round(a.dealerPriceSnapshot * basePercent / 100)} format="currency" /></TableCell>
                  <TableCell label="Source">
                    {a.isCrossRegion ? <StatusBadge status="neutral" label="Cross-Region" /> : <StatusBadge status="confirmed" label="Regular" />}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => handleDelete(a.id, a.modelName)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const addButton = hasDealer && stock.length > 0 ? (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button><Plus className="size-4" />Add Activation</Button>} />
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Add Activation</SheetTitle></SheetHeader>
        <div className="p-4">
          <Tabs defaultValue="single">
            <TabsList className={cn("grid w-full", canBulk ? "grid-cols-2" : "grid-cols-1")}>
              <TabsTrigger value="single">Single</TabsTrigger>
              {canBulk && <TabsTrigger value="bulk">Bulk by Date</TabsTrigger>}
            </TabsList>
            <TabsContent value="single" className="pt-3">
              <DealerActivationForm stock={stock} dealerId={dealerId ?? ""} tenantId={tenantId} role={role} onSuccess={() => { setOpen(false); startTransition(() => router.refresh()); }} />
            </TabsContent>
            {canBulk && (
              <TabsContent value="bulk" className="pt-3">
                <DealerBulkActivationForm stock={stock} onSuccess={() => { setOpen(false); startTransition(() => router.refresh()); }} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  ) : null;

  // KPI cards + activation timeline — the aligned "records" experience shown to
  // every dealer. The deep Overview analytics (charts, top models, growth,
  // highlights) is the paid `act_overview` add-on and stays behind canOverview.
  const kpiCards = (compact: boolean) =>
    overview && cur ? (
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6")}>
        <PurchaseKpiCard icon={Smartphone} label="Total Activations" value={kpis.total} />
        <PurchaseKpiCard icon={Wallet} label="Incentive Earned" value={kpis.incentive} />
        <PurchaseKpiCard icon={Target} label="Target Progress" value={kpis.target} />
        <PurchaseKpiCard icon={TrendingUp} label="Sell-through" value={kpis.sellThrough} />
        {!compact && <PurchaseKpiCard icon={Layers} label="Unique Models" value={kpis.models} />}
        {!compact && <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region" value={kpis.crossRegion} />}
      </div>
    ) : null;

  if (!canOverview) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Activations</h1>
            <p className="text-sm text-muted-foreground">Each row locks the dealer price effective on activation date.</p>
          </div>
          <div className="flex items-center gap-2">
            {isSyncing ? <SyncIndicator /> : null}
            {addButton}
          </div>
        </div>

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
          <DealerActivationDayList rows={recordRows} onDelete={handleDelete} />
        </div>

        {/* ── DESKTOP ── */}
        <div className="hidden md:block space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-1 gap-3 sm:grid-cols-4">{filterControls}</div></CardContent>
          </Card>
          {kpiCards(false)}
          <DealerActivationDayList rows={recordRows} onDelete={handleDelete} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Activations</h1>
          <p className="text-sm text-muted-foreground">Each row locks the dealer price effective on activation date.</p>
        </div>
        <div className="flex items-center gap-2">
          {isSyncing ? <SyncIndicator /> : null}
          <div className="hidden md:flex rounded-lg border overflow-hidden text-xs">
            {(["overview", "records"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {v === "overview" ? "Overview" : "Records"}
              </button>
            ))}
          </div>
          {addButton}
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <div className="mb-3 flex rounded-lg border overflow-hidden text-xs">
          {(["daily", "overview"] as const).map((t) => (
            <button key={t} onClick={() => setMobileTab(t)} className={`flex-1 px-3 py-2 transition-colors ${mobileTab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
              {t === "daily" ? "Daily" : "Overview"}
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
          <Card className="mb-4"><CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">{filterControls}</CardContent></Card>
        ) : null}

        {mobileTab === "daily" ? (
          <div className="space-y-4">
            {overview && cur ? (
              <div className="grid grid-cols-2 gap-3">
                <PurchaseKpiCard icon={Smartphone} label="Total Activations" value={kpis.total} />
                <PurchaseKpiCard icon={Wallet} label="Incentive Earned" value={kpis.incentive} />
                <PurchaseKpiCard icon={Target} label="Target Progress" value={kpis.target} />
                <PurchaseKpiCard icon={TrendingUp} label="Sell-through" value={kpis.sellThrough} />
              </div>
            ) : null}
            <ActivationTimeline groups={overview?.timeline ?? []} />
          </div>
        ) : null}

        {mobileTab === "overview" ? renderOverview(true) : null}
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:block space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent><div className="grid grid-cols-1 gap-3 sm:grid-cols-4">{filterControls}</div></CardContent>
        </Card>

        {view === "overview" ? renderOverview(false) : recordsTable}
      </div>
    </div>
  );
}

function HighlightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={value}>{value}</dd>
    </div>
  );
}

/** Day-wise list of individual activations (small cards). Tap a date to reveal
 *  each activated unit with a delete control. Activations aren't editable — a unit
 *  is deleted and re-added. */
function DealerActivationDayList({ rows, onDelete }: {
  rows: ActivationRow[];
  onDelete: (id: string, modelName: string) => void;
}) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const groups = useMemo(() => {
    const byDate = new Map<string, ActivationRow[]>();
    for (const a of rows) {
      const arr = byDate.get(a.activationDate);
      if (arr) arr.push(a);
      else byDate.set(a.activationDate, [a]);
    }
    return [...byDate.entries()]
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [rows]);

  if (rows.length === 0) {
    return <EmptyState icon={Smartphone} title="No activations to show." description="Add an activation or adjust the filters." />;
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const open = openDate === g.date;
        const crCount = g.items.filter((a) => a.isCrossRegion).length;
        return (
          <div key={g.date} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setOpenDate(open ? null : g.date)}
              className="flex w-full flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-3 text-left"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold">{formatDate(g.date)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{g.items.length} activation{g.items.length === 1 ? "" : "s"}</span>
                {crCount > 0 ? (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <StatusBadge status="neutral" label={`${crCount} CR`} />
                  </>
                ) : null}
              </div>
              {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
            </button>
            {open && (
              <div className="divide-y border-t bg-background">
                {g.items.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {a.modelName}
                        {a.isCrossRegion ? <StatusBadge status="neutral" label="CR" className="ml-1.5 align-middle" /> : null}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{maskImei(a.imei)}</div>
                    </div>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatPKR(a.dealerPriceSnapshot)}</span>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => onDelete(a.id, a.modelName)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
