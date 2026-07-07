"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPKR } from "@/lib/format";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { groupBillsByDate, type BillGroup } from "@/lib/purchases/purchase-stats";

interface Props {
  bills: BillGroup[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PurchaseBillTimeline({ bills, total, page, pageSize, onPageChange }: Props) {
  const dateGroups = groupBillsByDate(bills);
  const [openBill, setOpenBill] = useState<string | null>(bills[0]?.billNumber ?? null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  if (bills.length === 0) {
    return <EmptyState icon={ShoppingCart} title="No purchases in this range." description="Try a wider date range or clear filters." />;
  }

  return (
    <div className="space-y-4">
      {dateGroups.map((group) => (
        <div key={group.date} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formatDate(group.date)}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {group.bills.length} bill{group.bills.length === 1 ? "" : "s"} · {group.totalQty} units · {formatPKR(group.totalAmount)}
            </span>
          </div>

          {group.bills.map((bill) => {
            const open = openBill === bill.billNumber;
            return (
              <div key={bill.billNumber} className="overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setOpenBill(open ? null : bill.billNumber)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-3 text-left"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">Bill No. {bill.billNumber}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{bill.modelCount} Model{bill.modelCount === 1 ? "" : "s"}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Total Qty: {bill.totalQty}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-medium tabular-nums">{formatPKR(bill.totalAmount)}</span>
                  </div>
                  {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="overflow-x-auto border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-28"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bill.lines.map((line, i) => (
                          <TableRow key={`${bill.billNumber}-${line.modelId}-${i}`}>
                            <TableCell className="font-medium">{line.modelName}</TableCell>
                            <TableCell label="Quantity" className="text-right tabular-nums">{line.quantity}</TableCell>
                            <TableCell label="Unit Price" className="text-right tabular-nums">{formatPKR(line.unitDealerPrice)}</TableCell>
                            <TableCell label="Amount" className="text-right font-medium tabular-nums">{formatPKR(line.amount)}</TableCell>
                            <TableCell className="text-right">
                              {line.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? <StatusBadge status="neutral" label="Cross-Region" /> : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-muted-foreground">
        <span>Showing {rangeStart} to {rangeEnd} of {total} entries</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, i, arr) => (
              <span key={p} className="flex items-center">
                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={cn("min-w-8 rounded-md px-2 py-1 text-xs", p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {p}
                </button>
              </span>
            ))}
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
