"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate, formatPKR } from "@/lib/format";
import { Info } from "lucide-react";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ModelPriceHistory } from "@/lib/db/schema";
import type { RebateRow } from "@/lib/db/queries/rebates";

interface Props {
  model: ModelWithCurrentPrice;
  history: ModelPriceHistory[];
  rebates: RebateRow[];
  onClose: () => void;
}

export function DealerManageModelSheet({ model, history, rebates, onClose }: Props) {
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" key={model.id}>
        <SheetHeader>
          <SheetTitle>{model.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 p-4">
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Prices are set centrally by your OPPO account manager and apply to every dealer
              automatically. This is a read-only view of the official price timeline for this model.
            </p>
          </div>

          {/* Price history (read-only) */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Price history</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No price entries yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Dealer ₨</TableHead>
                      <TableHead className="text-right">Invoice ₨</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs">{formatDate(h.effectiveFrom)}</TableCell>
                        <TableCell label="To" className="text-xs">
                          {h.effectiveTo ? formatDate(h.effectiveTo) : <span className="text-emerald-600">current</span>}
                        </TableCell>
                        <TableCell label="Dealer ₨" className="text-right tabular-nums">{formatPKR(h.dealerPrice)}</TableCell>
                        <TableCell label="Invoice ₨" className="text-right tabular-nums">{formatPKR(h.invoicePrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {rebates.length > 0 && (
            <>
              <hr />
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Rebate history</h3>
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated when the dealer price dropped. Adjusted into your ledger.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Old ₨</TableHead>
                        <TableHead className="text-right">New ₨</TableHead>
                        <TableHead className="text-right">Per unit</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right font-semibold">Total ₨</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rebates.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{formatDate(r.rebateDate)}</TableCell>
                          <TableCell label="Old ₨" className="text-right tabular-nums text-xs">{formatPKR(r.oldDealerPrice)}</TableCell>
                          <TableCell label="New ₨" className="text-right tabular-nums text-xs">{formatPKR(r.newDealerPrice)}</TableCell>
                          <TableCell label="Per unit" className="text-right tabular-nums text-xs text-amber-600">−{formatPKR(r.rebatePerUnit)}</TableCell>
                          <TableCell label="Qty" className="text-right tabular-nums text-xs">{r.eligibleQty}</TableCell>
                          <TableCell label="Total ₨" className="text-right tabular-nums text-xs font-semibold text-emerald-600">{formatPKR(r.totalRebateAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Grand total:{" "}
                  <span className="font-semibold text-emerald-700">
                    {formatPKR(rebates.reduce((s, r) => s + r.totalRebateAmount, 0))}
                  </span>
                </p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
