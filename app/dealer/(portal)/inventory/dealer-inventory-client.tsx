"use client";

import {
  useEffect, useState, useTransition, useActionState, useMemo,
} from "react";
import {
  motion, useMotionValue, useTransform, animate,
  AnimatePresence,
} from "framer-motion";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Smartphone, ArrowRightCircle, Package2, TrendingDown,
  History, Search, ArrowUpDown, ShoppingCart, ArrowDownLeft,
  ArrowUpRight, Zap, LayoutGrid, List, Check, X, Clock, ShieldAlert,
  CalendarSearch,
} from "lucide-react";
import { toast } from "sonner";
import {
  dealerQuickActivateAction, dealerQuickMoveAction, dealerGetModelHistoryAction,
  dealerAcceptTransferAction, dealerRejectTransferAction, dealerGetStockAsOfAction,
  dealerCrCaughtAction, dealerGetReceiptsOnDateAction,
  type InvActionState, type StockEvent, type DayReceiptRow,
} from "./actions";
import { formatPKR, formatDate } from "@/lib/format";
import type { InventoryModelRow } from "@/lib/db/queries/inventory";
import type { PendingTransferRow } from "@/lib/db/queries/transfers";

interface DealerOption { id: string; name: string }
interface Props {
  rows: InventoryModelRow[];
  otherDealers: DealerOption[];
  hasDealer: boolean;
  pendingTransfers: PendingTransferRow[];
}
type SortKey = "name" | "qty_desc" | "qty_asc" | "value_desc";
type ViewMode = "grid" | "list";

function dominantAccent(row: InventoryModelRow) {
  const { regularQty, crossRegionQty, interIdInQty } = row;
  if (crossRegionQty >= regularQty && crossRegionQty >= interIdInQty && crossRegionQty > 0)
    return { border: "border-l-rose-500", bg: "from-rose-500/5", dot: "bg-rose-500", label: "Cross-Region" };
  if (interIdInQty >= regularQty && interIdInQty >= crossRegionQty && interIdInQty > 0)
    return { border: "border-l-blue-500", bg: "from-blue-500/5", dot: "bg-blue-500", label: "Received" };
  return { border: "border-l-slate-400", bg: "from-slate-400/5", dot: "bg-slate-400", label: "Purchase" };
}

function AnimatedCount({ value, className = "" }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const disp = useTransform(mv, (v) => Math.round(v).toLocaleString());
  const [text, setText] = useState("0");
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    const unsub = disp.on("change", setText);
    return () => { ctrl.stop(); unsub(); };
  }, [value, mv, disp]);
  return <motion.span className={className}>{text}</motion.span>;
}

function SourceBar({ row, animate: doAnimate = true }: { row: InventoryModelRow; animate?: boolean }) {
  const total = row.regularQty + row.crossRegionQty + row.interIdInQty;
  if (total === 0) return null;
  const segments = [
    { qty: row.regularQty, color: "bg-slate-400" },
    { qty: row.crossRegionQty, color: "bg-rose-500" },
    { qty: row.interIdInQty, color: "bg-blue-500" },
  ].filter((s) => s.qty > 0);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full gap-px">
      {segments.map((s, i) => (
        <motion.div
          key={i}
          className={`h-full rounded-full ${s.color}`}
          style={{ width: `${(s.qty / total) * 100}%` }}
          initial={doAnimate ? { scaleX: 0, originX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

const SOURCE_CHIP: Record<"regular" | "crossRegion" | "interId", string> = {
  regular: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  crossRegion: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  interId: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
};

function Chip({ label, qty, kind }: { label: string; qty: number; kind: keyof typeof SOURCE_CHIP }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_CHIP[kind]}`}>
      {label}: {qty}
    </span>
  );
}

const EV: Record<StockEvent["type"], { icon: React.ReactNode; color: string; ring: string; label: string; sign: "+" | "−"; isIn: boolean }> = {
  purchase: { icon: <ShoppingCart className="size-3.5" />, color: "text-emerald-600 dark:text-emerald-400", ring: "border-emerald-400", label: "Purchased", sign: "+", isIn: true },
  transfer_in: { icon: <ArrowDownLeft className="size-3.5" />, color: "text-blue-600 dark:text-blue-400", ring: "border-blue-400", label: "Received", sign: "+", isIn: true },
  transfer_out: { icon: <ArrowUpRight className="size-3.5" />, color: "text-orange-500 dark:text-orange-400", ring: "border-orange-400", label: "Moved out", sign: "−", isIn: false },
  activation: { icon: <Zap className="size-3.5" />, color: "text-rose-500 dark:text-rose-400", ring: "border-rose-400", label: "Activated", sign: "−", isIn: false },
};

function StockCard({ row, index, onActivate, onMove, onHistory, onCaught }: {
  row: InventoryModelRow; index: number;
  onActivate: (r: InventoryModelRow) => void;
  onMove: (r: InventoryModelRow) => void;
  onHistory: (r: InventoryModelRow) => void;
  onCaught: (r: InventoryModelRow) => void;
}) {
  const acc = dominantAccent(row);
  const value = row.dealerPrice ? row.totalStock * row.dealerPrice : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.02, 0.2), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg border-l-4 ${acc.border}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${acc.bg} to-transparent opacity-60`} />
      <div className="relative flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-snug tracking-tight">{row.modelName}</p>
          {value !== null && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatPKR(value)}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-xl bg-background/80 px-3 py-1.5 shadow-sm ring-1 ring-border">
          <span className="text-2xl font-bold leading-none tabular-nums text-foreground">
            <AnimatedCount value={row.totalStock} />
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">units</span>
        </div>
      </div>
      <div className="relative space-y-2 px-4 pb-3">
        <SourceBar row={row} />
        <div className="flex flex-wrap gap-1">
          {row.regularQty > 0 && <Chip label="Purchase" qty={row.regularQty} kind="regular" />}
          {row.crossRegionQty > 0 && <Chip label="Cross-Region" qty={row.crossRegionQty} kind="crossRegion" />}
          {row.interIdInQty > 0 && <Chip label="Received" qty={row.interIdInQty} kind="interId" />}
        </div>
      </div>
      <div className="relative mt-auto grid grid-cols-4 divide-x border-t bg-muted/30">
        {[
          { icon: Smartphone, label: "Activate", action: onActivate },
          { icon: ArrowRightCircle, label: "Move", action: onMove },
          { icon: History, label: "History", action: onHistory },
          { icon: ShieldAlert, label: "CR Caught", action: onCaught },
        ].map(({ icon: Icon, label, action }) => (
          <button key={label} onClick={() => action(row)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function StockListRow({ row, index, onActivate, onMove, onHistory, onCaught }: {
  row: InventoryModelRow; index: number;
  onActivate: (r: InventoryModelRow) => void;
  onMove: (r: InventoryModelRow) => void;
  onHistory: (r: InventoryModelRow) => void;
  onCaught: (r: InventoryModelRow) => void;
}) {
  const acc = dominantAccent(row);
  const value = row.dealerPrice ? row.totalStock * row.dealerPrice : null;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.15) }}
      className={`flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm border-l-4 ${acc.border}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${acc.dot}`} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.modelName}</span>
      <div className="hidden w-20 sm:block"><SourceBar row={row} animate={false} /></div>
      {value !== null && <span className="hidden tabular-nums text-xs text-muted-foreground sm:block">{formatPKR(value)}</span>}
      <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">{row.totalStock}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        {[
          { icon: Smartphone, title: "Activate", action: onActivate },
          { icon: ArrowRightCircle, title: "Move", action: onMove },
          { icon: History, title: "History", action: onHistory },
          { icon: ShieldAlert, title: "CR Caught", action: onCaught },
        ].map(({ icon: Icon, title, action }) => (
          <button key={title} title={title} onClick={() => action(row)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ActivateSheet({ row, open, onClose }: { row: InventoryModelRow | null; open: boolean; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [activationDate, setActivationDate] = useState(today);
  const [stockAsOf, setStockAsOf] = useState<number | null>(null);
  const [dateChecking, startDateCheck] = useTransition();
  const [state, action, pending] = useActionState<InvActionState, FormData>(dealerQuickActivateAction, {});

  useEffect(() => { if (open) setActivationDate(today); }, [open, today]);
  useEffect(() => {
    if (!open || !row) { setStockAsOf(null); return; }
    startDateCheck(async () => { setStockAsOf(await dealerGetStockAsOfAction(row.modelId, activationDate)); });
  }, [open, row, activationDate]);
  useEffect(() => {
    if (state.ok) { toast.success("Activated successfully"); onClose(); }
    else if (state.error) toast.error(state.error);
  }, [state, onClose]);

  const availableCount = stockAsOf ?? row?.totalStock ?? 0;
  const isDateConstrained = stockAsOf !== null && row !== null && stockAsOf < row.totalStock;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader><SheetTitle>Activate — {row?.modelName}</SheetTitle></SheetHeader>
        {row && (
          <div className="p-4">
            <div className="mb-5 rounded-xl border bg-muted/40 p-3">
              <SourceBar row={row} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.regularQty > 0 && <Chip label="Purchase" qty={row.regularQty} kind="regular" />}
                {row.crossRegionQty > 0 && <Chip label="Cross-Region" qty={row.crossRegionQty} kind="crossRegion" />}
                {row.interIdInQty > 0 && <Chip label="Received" qty={row.interIdInQty} kind="interId" />}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {dateChecking ? <span className="text-xs text-muted-foreground">Checking…</span> : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{availableCount}</span>
                      {" "}units available{isDateConstrained ? ` on ${activationDate}` : ""}
                    </span>
                    {isDateConstrained && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">date-limited</span>
                    )}
                  </>
                )}
              </div>
            </div>
            <form action={action} className="space-y-4">
              <input type="hidden" name="modelId" value={row.modelId} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Activation date</label>
                <Input name="activationDate" type="date" value={activationDate} max={today}
                  onChange={(e) => setActivationDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Quantity</label>
                <Input name="quantity" type="number" min={1} max={availableCount} defaultValue={1} required />
              </div>
              <Button type="submit" className="w-full" disabled={pending || availableCount === 0}>
                {pending ? "Activating…" : availableCount === 0 ? "No stock on this date" : "Confirm Activation"}
              </Button>
            </form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MoveSheet({ row, open, onClose, otherDealers }: {
  row: InventoryModelRow | null; open: boolean; onClose: () => void; otherDealers: DealerOption[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [toDealerId, setToDealerId] = useState("");
  const [transferDate, setTransferDate] = useState(today);
  const [stockAsOf, setStockAsOf] = useState<number | null>(null);
  const [dateChecking, startDateCheck] = useTransition();
  const [state, action, pending] = useActionState<InvActionState, FormData>(dealerQuickMoveAction, {});

  useEffect(() => { if (!open) { setToDealerId(""); setTransferDate(today); } }, [open, today]);
  useEffect(() => {
    if (!open || !row) { setStockAsOf(null); return; }
    startDateCheck(async () => { setStockAsOf(await dealerGetStockAsOfAction(row.modelId, transferDate)); });
  }, [open, row, transferDate]);
  useEffect(() => {
    if (state.ok) { toast.success("Transfer sent — awaiting destination acceptance"); onClose(); }
    else if (state.error) toast.error(state.error);
  }, [state, onClose]);

  const availableCount = stockAsOf ?? row?.totalStock ?? 0;
  const isDateConstrained = stockAsOf !== null && row !== null && stockAsOf < row.totalStock;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader><SheetTitle>Move Stock — {row?.modelName}</SheetTitle></SheetHeader>
        {row && (
          <div className="p-4">
            <div className="mb-5 rounded-xl border bg-muted/40 p-3">
              <SourceBar row={row} />
              <div className="mt-2 flex items-center gap-2">
                {dateChecking ? <span className="text-xs text-muted-foreground">Checking…</span> : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{availableCount}</span>
                      {" "}units available{isDateConstrained ? ` on ${transferDate}` : ""}
                    </span>
                    {isDateConstrained && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">date-limited</span>
                    )}
                  </>
                )}
              </div>
            </div>
            {otherDealers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other Dealer IDs to move stock to.</p>
            ) : (
              <form action={action} className="space-y-4">
                <input type="hidden" name="modelId" value={row.modelId} />
                <input type="hidden" name="toDealerId" value={toDealerId} />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Destination ID</label>
                  <Select value={toDealerId} onValueChange={(v) => typeof v === "string" && setToDealerId(v)}>
                    <SelectTrigger className="w-full">
                      <span className={toDealerId ? "" : "text-muted-foreground"}>
                        {otherDealers.find((d) => d.id === toDealerId)?.name ?? "Choose destination…"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {otherDealers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Transfer date</label>
                  <Input name="transferDate" type="date" value={transferDate} max={today}
                    onChange={(e) => setTransferDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quantity</label>
                  <Input name="quantity" type="number" min={1} max={availableCount} defaultValue={1} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Note (optional)</label>
                  <Input name="note" placeholder="Transfer note…" />
                </div>
                <p className="text-xs text-muted-foreground">The destination ID must accept before stock is added to their inventory.</p>
                <Button type="submit" className="w-full" disabled={pending || !toDealerId || availableCount === 0}>
                  {pending ? "Sending…" : availableCount === 0 ? "No stock on this date" : "Send Transfer Request"}
                </Button>
              </form>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CrCaughtSheet({ row, open, onClose }: { row: InventoryModelRow | null; open: boolean; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [state, action, pending] = useActionState<InvActionState, FormData>(dealerCrCaughtAction, {});
  useEffect(() => {
    if (state.ok) { toast.success("Marked as CR caught — removed from inventory"); onClose(); }
    else if (state.error) toast.error(state.error);
  }, [state, onClose]);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader><SheetTitle>CR Caught — {row?.modelName}</SheetTitle></SheetHeader>
        {row && (
          <div className="p-4">
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              These units were caught by a cross-region customer and will be removed from your inventory. You also lose the 4%+1% incentive on them.
            </div>
            <form action={action} className="space-y-4">
              <input type="hidden" name="modelId" value={row.modelId} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date caught</label>
                <Input name="caughtDate" type="date" defaultValue={today} max={today} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Quantity caught</label>
                <Input name="quantity" type="number" min={1} max={row.totalStock} defaultValue={1} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Note (optional)</label>
                <Input name="note" placeholder="e.g. caught at Karachi" />
              </div>
              <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
                {pending ? "Recording…" : "Record as CR Caught"}
              </Button>
            </form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HistorySheet({ row, open, onClose }: { row: InventoryModelRow | null; open: boolean; onClose: () => void }) {
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !row) { setEvents([]); return; }
    setLoading(true);
    startTransition(async () => {
      setEvents(await dealerGetModelHistoryAction(row.modelId));
      setLoading(false);
    });
  }, [open, row]);

  const currentBalance = events[0]?.runningBalance ?? 0;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>Stock History — {row?.modelName}</SheetTitle></SheetHeader>
        <div className="space-y-4 p-4">
          {!loading && events.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border bg-primary/5 px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Current balance</span>
              <span className="text-xl font-bold tabular-nums text-primary">{currentBalance} units</span>
            </div>
          )}
          {loading ? (
            <div className="space-y-3 pt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-40 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <History className="mb-2 size-8 opacity-30" />
              <p className="text-sm">No stock movements found.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/30 via-border to-transparent" />
              <div className="space-y-1">
                {events.map((e, i) => {
                  const cfg = EV[e.type];
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.025 }}
                      className="flex gap-3 pb-3"
                    >
                      <div className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-background ${cfg.color} ${cfg.ring}`}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border bg-card px-3 py-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{cfg.label}</span>
                          <span className={`text-sm font-bold tabular-nums ${cfg.isIn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                            {cfg.sign}{e.qty}
                          </span>
                        </div>
                        {e.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.note}</p>}
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{formatDate(e.date)}</span>
                          <span className="text-[11px] font-medium">
                            <span className="text-muted-foreground">Bal </span>
                            <span className="font-semibold tabular-nums">{e.runningBalance}</span>
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PendingRow({ transfer }: { transfer: PendingTransferRow }) {
  const [acceptState, acceptAction, acceptPending] = useActionState<InvActionState, FormData>(dealerAcceptTransferAction, {});
  const [rejectState, rejectAction, rejectPending] = useActionState<InvActionState, FormData>(dealerRejectTransferAction, {});

  useEffect(() => {
    if (acceptState.ok) toast.success("Transfer accepted — stock added to inventory");
    else if (acceptState.error) toast.error(acceptState.error);
  }, [acceptState]);

  useEffect(() => {
    if (rejectState.ok) toast.success("Transfer rejected");
    else if (rejectState.error) toast.error(rejectState.error);
  }, [rejectState]);

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20"
    >
      <Clock className="size-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">
          <span className="text-amber-700 dark:text-amber-400">{transfer.fromDealerName}</span>
          {" → "}
          <span className="font-semibold">{transfer.quantity} × {transfer.modelName}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(transfer.transferDate)}{transfer.note ? ` — ${transfer.note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <form action={acceptAction}>
          <input type="hidden" name="transferId" value={transfer.id} />
          <button type="submit" disabled={acceptPending || rejectPending}
            className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Accept
          </button>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="transferId" value={transfer.id} />
          <button type="submit" disabled={acceptPending || rejectPending}
            className="flex items-center gap-1 rounded-lg border border-destructive/50 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            <X className="size-3.5" /> Reject
          </button>
        </form>
      </div>
    </motion.div>
  );
}

const SOURCE_RECEIPT_LABEL: Record<DayReceiptRow["source"], { label: string; chip: string }> = {
  purchase:    { label: "Purchase",     chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  cross_region:{ label: "Cross-Region", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
  transfer_in: { label: "Transfer In",  chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
};

function ReceiptsPanel({ date }: { date: string }) {
  const [rows, setRows] = useState<DayReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!date) { setRows([]); return; }
    setLoading(true);
    startTransition(async () => {
      setRows(await dealerGetReceiptsOnDateAction(date));
      setLoading(false);
    });
  }, [date]);

  const totalUnits = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2.5 border-b bg-muted/40 px-4 py-3">
        <CalendarSearch className="size-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold">
          Received on{" "}
          <span className="text-primary">
            {new Date(date + "T00:00:00").toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </span>
        {!loading && totalUnits > 0 && (
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 px-4 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
          <Package2 className="size-4 opacity-40" />
          Nothing received on this date.
        </div>
      ) : (
        <div className="divide-y">
          {rows.map((r, i) => {
            const src = SOURCE_RECEIPT_LABEL[r.source];
            return (
              <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.modelName}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{r.qty} units</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${src.chip}`}>{src.label}</span>
                {r.note && <span className="w-full truncate text-xs text-muted-foreground pl-0.5">Note: {r.note}</span>}
              </div>
            );
          })}
          {rows.length > 1 && (
            <div className="flex items-center justify-between bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground">
              <span>{rows.length} entries</span>
              <span className="text-foreground">{totalUnits} total units received</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  const isNum = typeof value === "number";
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-none">
        {isNum ? <AnimatedCount value={value} /> : value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function DealerInventoryClient({ rows, otherDealers, hasDealer, pendingTransfers }: Props) {
  const [activateRow, setActivateRow] = useState<InventoryModelRow | null>(null);
  const [moveRow, setMoveRow] = useState<InventoryModelRow | null>(null);
  const [historyRow, setHistoryRow] = useState<InventoryModelRow | null>(null);
  const [caughtRow, setCaughtRow] = useState<InventoryModelRow | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [receiptsDate, setReceiptsDate] = useState("");

  const SORT_LABELS: Record<SortKey, string> = {
    name: "Name A–Z",
    qty_desc: "Qty: High → Low",
    qty_asc: "Qty: Low → High",
    value_desc: "Value: High → Low",
  };

  const filtered = useMemo(() => {
    let list = search.trim()
      ? rows.filter((r) => r.modelName.toLowerCase().includes(search.toLowerCase()))
      : [...rows];
    if (sortKey === "name") list.sort((a, b) => a.modelName.localeCompare(b.modelName));
    else if (sortKey === "qty_desc") list.sort((a, b) => b.totalStock - a.totalStock);
    else if (sortKey === "qty_asc") list.sort((a, b) => a.totalStock - b.totalStock);
    else if (sortKey === "value_desc") list.sort((a, b) => ((b.dealerPrice ?? 0) * b.totalStock) - ((a.dealerPrice ?? 0) * a.totalStock));
    return list;
  }, [rows, search, sortKey]);

  const totalUnits = rows.reduce((s, r) => s + r.totalStock, 0);
  const totalValue = rows.reduce((s, r) => s + (r.dealerPrice ? r.totalStock * r.dealerPrice : 0), 0);
  const totalRegular = rows.reduce((s, r) => s + r.regularQty, 0);
  const totalCrossRegion = rows.reduce((s, r) => s + r.crossRegionQty, 0);
  const totalInterIdIn = rows.reduce((s, r) => s + r.interIdInQty, 0);

  if (!hasDealer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <Package2 className="mb-3 size-10 opacity-30" />
        <p className="font-medium">No Dealer ID configured</p>
        <p className="text-sm">Create a Dealer ID first to track inventory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Current stock by model and source.</p>
        </div>
        {pendingTransfers.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <Clock className="size-3.5" />
            {pendingTransfers.length} incoming
          </span>
        )}
      </div>

      {pendingTransfers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Incoming transfers — awaiting your acceptance
          </p>
          <AnimatePresence mode="popLayout">
            {pendingTransfers.map((t) => <PendingRow key={t.id} transfer={t} />)}
          </AnimatePresence>
        </div>
      )}

      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <div className="flex flex-wrap gap-6 px-5 py-4">
            <SummaryTile label="Models" value={rows.length} />
            <div className="w-px bg-border" />
            <SummaryTile label="Total Units" value={totalUnits} />
            <div className="w-px bg-border" />
            <SummaryTile label="Stock Value" value={totalValue > 0 ? formatPKR(totalValue) : "—"} />
          </div>
          {totalUnits > 0 && (
            <div className="border-t px-5 py-3">
              <div className="mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Source composition</p>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full gap-px">
                {[
                  { qty: totalRegular, color: "bg-slate-400" },
                  { qty: totalCrossRegion, color: "bg-rose-500" },
                  { qty: totalInterIdIn, color: "bg-blue-500" },
                ].filter((s) => s.qty > 0).map((s, i) => (
                  <motion.div key={i}
                    className={`h-full rounded-full ${s.color}`}
                    style={{ width: `${(s.qty / totalUnits) * 100}%` }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {totalRegular > 0 && <span><span className="mr-1 inline-block size-1.5 rounded-full bg-slate-400 align-middle" />{totalRegular} purchase</span>}
                {totalCrossRegion > 0 && <span><span className="mr-1 inline-block size-1.5 rounded-full bg-rose-500 align-middle" />{totalCrossRegion} cross-region</span>}
                {totalInterIdIn > 0 && <span><span className="mr-1 inline-block size-1.5 rounded-full bg-blue-500 align-middle" />{totalInterIdIn} received</span>}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {rows.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search models…" className="pl-9" />
          </div>
          <Select value={sortKey} onValueChange={(v) => typeof v === "string" && setSortKey(v as SortKey)}>
            <SelectTrigger className="w-44">
              <span className="flex items-center gap-1.5 text-sm">
                <ArrowUpDown className="size-3.5 shrink-0" />
                {SORT_LABELS[sortKey]}
              </span>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex overflow-hidden rounded-lg border">
            {([["grid", LayoutGrid], ["list", List]] as const).map(([mode, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex items-center justify-center px-2.5 transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date receipts filter */}
      <div className="flex items-center gap-2">
        <CalendarSearch className="size-4 shrink-0 text-muted-foreground" />
        <label className="text-sm text-muted-foreground whitespace-nowrap">Check receipts by date:</label>
        <Input
          type="date"
          value={receiptsDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setReceiptsDate(e.target.value)}
          className="h-8 w-44 text-sm"
        />
        {receiptsDate && (
          <button onClick={() => setReceiptsDate("")} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Clear
          </button>
        )}
      </div>

      {receiptsDate && <ReceiptsPanel date={receiptsDate} />}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <TrendingDown className="mb-3 size-10 opacity-30" />
          <p className="font-medium">No stock in inventory</p>
          <p className="text-sm">Add purchases to build up your stock here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Search className="mb-3 size-8 opacity-30" />
          <p className="font-medium">No models match &quot;{search}&quot;</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((row, i) => (
              <StockCard key={row.modelId} row={row} index={i}
                onActivate={setActivateRow} onMove={setMoveRow}
                onHistory={setHistoryRow} onCaught={setCaughtRow}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((row, i) => (
              <StockListRow key={row.modelId} row={row} index={i}
                onActivate={setActivateRow} onMove={setMoveRow}
                onHistory={setHistoryRow} onCaught={setCaughtRow}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ActivateSheet row={activateRow} open={!!activateRow} onClose={() => setActivateRow(null)} />
      <MoveSheet row={moveRow} open={!!moveRow} onClose={() => setMoveRow(null)} otherDealers={otherDealers} />
      <HistorySheet row={historyRow} open={!!historyRow} onClose={() => setHistoryRow(null)} />
      <CrCaughtSheet row={caughtRow} open={!!caughtRow} onClose={() => setCaughtRow(null)} />
    </div>
  );
}
