"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatPKR } from "@/lib/format";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { groupBillsByDate, type BillGroup } from "@/lib/purchases/purchase-stats";

interface Props {
  initialBills: BillGroup[];
  total: number;
  /** Fetches the next page of bills (server action). Appended to the list. */
  loadMore: (page: number) => Promise<BillGroup[]>;
}

export function PurchaseBillTimeline({ initialBills, total, loadMore }: Props) {
  const [bills, setBills] = useState(initialBills);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // All dates collapsed by default — tap a date to reveal its bills.
  const [openDate, setOpenDate] = useState<string | null>(null);

  // Reset during render (not an effect) when the server sends a fresh first
  // page — filters/range changed, or a purchase was added/removed.
  const [seenInitial, setSeenInitial] = useState(initialBills);
  if (seenInitial !== initialBills) {
    setSeenInitial(initialBills);
    setBills(initialBills);
    setPage(1);
    setOpenDate(null);
  }

  const dateGroups = groupBillsByDate(bills);
  const hasMore = bills.length < total;

  const onLoadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const next = await loadMore(page + 1);
      setBills((b) => [...b, ...next]);
      setPage((p) => p + 1);
    } finally {
      setLoading(false);
    }
  };

  if (bills.length === 0) {
    return <EmptyState icon={ShoppingCart} title="No purchases in this range." description="Try a wider date range or clear filters." />;
  }

  return (
    <div className="space-y-3">
      {dateGroups.map((group) => {
        const open = openDate === group.date;
        return (
          <div key={group.date} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setOpenDate(open ? null : group.date)}
              className="flex w-full flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-3 text-left"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold">{formatDate(group.date)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{group.bills.length} invoice{group.bills.length === 1 ? "" : "s"}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{group.totalQty} units</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium tabular-nums">{formatPKR(group.totalAmount)}</span>
              </div>
              {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
            </button>

            {open && (
              <div className="grid grid-cols-1 gap-2 border-t bg-background p-2 sm:grid-cols-2">
                {group.bills.map((bill) => (
                  <div key={bill.billNumber} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">Bill No. {bill.billNumber}</span>
                      <span className="text-muted-foreground">{bill.modelCount} model{bill.modelCount === 1 ? "" : "s"}</span>
                    </div>
                    <div className="space-y-1.5">
                      {bill.lines.map((line, i) => (
                        <div key={`${bill.billNumber}-${line.modelId}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate">
                            {line.modelName}
                            {line.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? (
                              <StatusBadge status="neutral" label="CR" className="ml-1.5 align-middle" />
                            ) : null}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{line.quantity} × {formatPKR(line.unitDealerPrice)}</span>
                          <span className="w-20 shrink-0 text-right font-medium tabular-nums">{formatPKR(line.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t pt-1.5 text-xs font-medium">
                      <span className="text-muted-foreground">Total</span>
                      <span className="tabular-nums">{formatPKR(bill.totalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {hasMore ? (
        <div className="pt-1">
          <Button variant="outline" size="sm" className="w-full" disabled={loading} onClick={onLoadMore}>
            {loading ? "Loading…" : "Load older dates"}
          </Button>
        </div>
      ) : (
        <p className="pt-1 text-center text-xs text-muted-foreground">Showing all {total} bill{total === 1 ? "" : "s"} in this range</p>
      )}
    </div>
  );
}
