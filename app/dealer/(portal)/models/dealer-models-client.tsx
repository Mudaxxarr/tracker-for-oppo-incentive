"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DealerManageModelSheet } from "./dealer-manage-sheet";
import { syncDealerActivationPricesAction } from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { RefreshCw, Settings2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ModelPriceHistory } from "@/lib/db/schema";
import type { RebateRow } from "@/lib/db/queries/rebates";

interface Props {
  models: ModelWithCurrentPrice[];
  history: Record<string, ModelPriceHistory[]>;
  rebates: Record<string, RebateRow[]>;
  role: "admin" | "exec";
}

export function DealerModelsClient({ models, history, rebates, role }: Props) {
  const router = useRouter();
  const [manageId, setManageId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [, startTransition] = useTransition();

  const onSyncPrices = () => {
    setSyncing(true);
    startTransition(async () => {
      const r = await syncDealerActivationPricesAction();
      setSyncing(false);
      if (r.ok) {
        toast.success(`Prices synced — ${r.modelsProcessed} model(s) processed`);
        router.refresh();
      } else {
        toast.error(r.error ?? "Sync failed");
      }
    });
  };

  const managed = manageId ? models.find((m) => m.id === manageId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Models & Prices</h1>
          <p className="text-sm text-muted-foreground">
            Product catalog. Prices you set here apply to your dealer account only.
          </p>
        </div>
        {role === "admin" && (
          <Button variant="outline" onClick={onSyncPrices} disabled={syncing}>
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Prices"}
          </Button>
        )}
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
                    {role === "admin" && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((m) => {
                    const h = history[m.id] ?? [];
                    const lastChange = h[0]?.effectiveFrom;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {m.sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.dealerPrice != null ? formatPKR(m.dealerPrice) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.invoicePrice != null ? formatPKR(m.invoicePrice) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {h.length}
                          {lastChange ? (
                            <span className="text-[10px]"> · last {formatDate(lastChange)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {m.isActive ? null : <Badge variant="secondary">Inactive</Badge>}
                        </TableCell>
                        {role === "admin" && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Manage"
                              onClick={() => setManageId(m.id)}
                            >
                              <Settings2 className="size-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {managed ? (
        <DealerManageModelSheet
          model={managed}
          history={history[managed.id] ?? []}
          rebates={rebates[managed.id] ?? []}
          onClose={() => setManageId(null)}
        />
      ) : null}
    </div>
  );
}
