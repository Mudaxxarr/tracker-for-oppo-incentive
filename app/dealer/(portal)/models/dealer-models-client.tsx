"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DealerManageModelSheet } from "./dealer-manage-sheet";
import { formatDate, formatPKR } from "@/lib/format";
import { Eye, Smartphone } from "lucide-react";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ModelPriceHistory } from "@/lib/db/schema";
import type { RebateRow } from "@/lib/db/queries/rebates";

interface Props {
  models: ModelWithCurrentPrice[];
  history: Record<string, ModelPriceHistory[]>;
  rebates: Record<string, RebateRow[]>;
}

export function DealerModelsClient({ models, history, rebates }: Props) {
  const [viewId, setViewId] = useState<string | null>(null);
  const viewing = viewId ? models.find((m) => m.id === viewId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Models &amp; Prices</h1>
        <p className="text-sm text-muted-foreground">
          Product catalog. Prices are set centrally by OPPO and apply to every dealer automatically.
        </p>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Smartphone className="size-10 text-muted-foreground" />
            <h2 className="text-base font-medium">No models yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Models are added by your account manager. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Dealer ₨</TableHead>
                    <TableHead className="text-right">Invoice ₨</TableHead>
                    <TableHead className="text-right">Price entries</TableHead>
                    <TableHead />
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((m) => {
                    const h = history[m.id] ?? [];
                    const lastChange = h[0]?.effectiveFrom;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell label="SKU" className="font-mono text-xs text-muted-foreground">
                          {m.sku ?? "—"}
                        </TableCell>
                        <TableCell label="Dealer ₨" className="text-right tabular-nums">
                          {m.dealerPrice != null ? formatPKR(m.dealerPrice) : "—"}
                        </TableCell>
                        <TableCell label="Invoice ₨" className="text-right tabular-nums">
                          {m.invoicePrice != null ? formatPKR(m.invoicePrice) : "—"}
                        </TableCell>
                        <TableCell label="Price entries" className="text-right text-xs text-muted-foreground tabular-nums">
                          {h.length}
                          {lastChange ? (
                            <span className="text-[10px]"> · last {formatDate(lastChange)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {m.isActive ? null : <Badge variant="secondary">Inactive</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View price history"
                            onClick={() => setViewId(m.id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {viewing ? (
        <DealerManageModelSheet
          model={viewing}
          history={history[viewing.id] ?? []}
          rebates={rebates[viewing.id] ?? []}
          onClose={() => setViewId(null)}
        />
      ) : null}
    </div>
  );
}
