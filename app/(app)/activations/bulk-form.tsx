"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  bulkCreateActivationsByDateAction,
  type ActivationFormState,
} from "./actions";
import { getPriceOnDateAction } from "./data-actions";
import { formatPKR } from "@/lib/format";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { StockRow } from "@/lib/db/queries/purchases";

interface Props {
  stock: StockRow[];
  onSuccess?: () => void;
}

interface Row {
  key: number;
  modelId: string;
  qty: string;
  isCrossRegion: boolean;
}

function emptyRow(key: number): Row {
  return { key, modelId: "", qty: "", isCrossRegion: false };
}

export function BulkActivationForm({ stock, onSuccess }: Props) {
  const [state, action, pending] = useActionState<ActivationFormState, FormData>(
    bulkCreateActivationsByDateAction,
    {}
  );
  const today = new Date().toISOString().slice(0, 10);
  const [activationDate, setActivationDate] = useState<string>(today);
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  // modelId → dealer price effective on activationDate (null = no price defined)
  const [prices, setPrices] = useState<Map<string, number | null>>(new Map());

  const nextKey = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.key), 0) + 1,
    [rows]
  );

  const usedModelIds = useMemo(
    () => new Set(rows.map((r) => r.modelId).filter(Boolean)),
    [rows]
  );

  const stockById = useMemo(() => {
    const m = new Map<string, StockRow>();
    for (const s of stock) m.set(s.modelId, s);
    return m;
  }, [stock]);

  // When date changes, re-resolve prices for every already-selected model.
  useEffect(() => {
    const selectedIds = rows.map((r) => r.modelId).filter(Boolean);
    if (selectedIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      selectedIds.map((id) =>
        getPriceOnDateAction(id, activationDate).then(
          (p) => [id, p?.dealerPrice ?? null] as const
        )
      )
    ).then((entries) => {
      if (!cancelled)
        setPrices((prev) => {
          const next = new Map(prev);
          for (const [id, price] of entries) next.set(id, price);
          return next;
        });
    });
    return () => { cancelled = true; };
  }, [activationDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch price for a newly selected model on the current date.
  const resolveModelPrice = (modelId: string) => {
    if (!modelId) return;
    let cancelled = false;
    getPriceOnDateAction(modelId, activationDate).then((p) => {
      if (!cancelled)
        setPrices((prev) => new Map(prev).set(modelId, p?.dealerPrice ?? null));
    });
    return () => { cancelled = true; };
  };

  useEffect(() => {
    if (state.ok) {
      toast.success(
        `Activated ${state.inserted ?? 0} unit(s) — total ${formatPKR(state.pricedAt ?? 0)}`
      );
      queueMicrotask(() => setRows([emptyRow(0)]));
      setPrices(new Map());
      onSuccess?.();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r));
      const last = next[next.length - 1];
      const lastFilled = !!last.modelId && Number(last.qty) > 0;
      const hasAvailableModels = stock.some(
        (s) => !next.some((r) => r.modelId === s.modelId)
      );
      if (lastFilled && hasAvailableModels) {
        next.push(emptyRow(nextKey));
      }
      return next;
    });
  };

  const removeRow = (key: number) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      if (next.length === 0) next.push(emptyRow(0));
      return next;
    });
  };

  const submittableRows = rows
    .map((r) => ({
      modelId: r.modelId,
      quantity: Number(r.qty),
      isCrossRegion: r.isCrossRegion,
    }))
    .filter((r) => r.modelId && Number.isFinite(r.quantity) && r.quantity > 0);

  const totalUnits = submittableRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalValue = submittableRows.reduce((sum, r) => {
    const p = prices.get(r.modelId);
    return sum + (p ?? 0) * r.quantity;
  }, 0);

  const overStockRow = rows.find((r) => {
    if (!r.modelId) return false;
    const q = Number(r.qty);
    if (!Number.isFinite(q) || q <= 0) return false;
    const s = stockById.get(r.modelId);
    return !!s && q > s.quantity;
  });

  // Block submit if any selected model has no price on the chosen date.
  const missingPriceRow = submittableRows.find(
    (r) => prices.get(r.modelId) === null
  );

  const canSubmit =
    !pending && submittableRows.length > 0 && !overStockRow && !missingPriceRow && !!activationDate;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="activationDate" value={activationDate} />
      <input type="hidden" name="rows" value={JSON.stringify(submittableRows)} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Activation date</label>
        <Input
          type="date"
          value={activationDate}
          max={today}
          onChange={(e) => setActivationDate(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Prices are resolved per model from the price history on this date.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Models</label>
        {stock.length === 0 ? (
          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            No stock available — record a purchase first.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const selected = row.modelId ? stockById.get(row.modelId) : undefined;
              const q = Number(row.qty);
              const isOver = !!selected && Number.isFinite(q) && q > selected.quantity;
              const resolvedPrice = row.modelId ? prices.get(row.modelId) : undefined;
              const options = stock.filter(
                (s) => s.modelId === row.modelId || !usedModelIds.has(s.modelId)
              );
              return (
                <div
                  key={row.key}
                  className="flex items-start gap-2 rounded-md border bg-card/40 p-2"
                >
                  <div className="flex-1 space-y-1">
                    <Select
                      value={row.modelId}
                      onValueChange={(v) => {
                        if (typeof v !== "string") return;
                        updateRow(row.key, { modelId: v });
                        resolveModelPrice(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <span className={selected ? "" : "text-muted-foreground"}>
                          {selected?.modelName ?? "Choose model…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((s) => (
                          <SelectItem key={s.modelId} value={s.modelId}>
                            <span className="flex w-full items-center justify-between gap-3">
                              <span>{s.modelName}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {s.quantity} in stock
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {row.modelId ? (
                      <>
                        {resolvedPrice !== undefined ? (
                          resolvedPrice !== null ? (
                            <p className="px-1 text-xs text-muted-foreground">
                              Price on {activationDate}:{" "}
                              <strong className="text-foreground">{formatPKR(resolvedPrice)}</strong>
                            </p>
                          ) : (
                            <p className="px-1 text-xs text-destructive">
                              No price defined on this date — add a price entry in Models.
                            </p>
                          )
                        ) : (
                          <p className="px-1 text-xs text-muted-foreground animate-pulse">
                            Looking up price…
                          </p>
                        )}
                        <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-3.5"
                            checked={row.isCrossRegion}
                            onChange={(e) =>
                              updateRow(row.key, { isCrossRegion: e.target.checked })
                            }
                          />
                          <span>Cross-region transfer</span>
                        </label>
                      </>
                    ) : null}
                  </div>

                  {row.modelId ? (
                    <div className="w-24 space-y-1">
                      <Input
                        type="number"
                        min={1}
                        max={selected?.quantity ?? undefined}
                        placeholder="Qty"
                        value={row.qty}
                        onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                        aria-invalid={isOver || undefined}
                      />
                      {isOver ? (
                        <p className="text-[10px] text-destructive">
                          Max {selected?.quantity}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove row"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1 && !row.modelId}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {submittableRows.length > 0 ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {totalUnits} unit(s) across {submittableRows.length} model(s)
          </span>
          <span className="tabular-nums font-medium">{formatPKR(totalValue)}</span>
        </div>
      ) : null}

      {missingPriceRow ? (
        <p className="text-xs text-destructive">
          One or more models have no price defined on {activationDate}. Add price entries in
          Models first.
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {pending
          ? "Saving…"
          : totalUnits > 0
            ? `Save ${totalUnits} Activation${totalUnits === 1 ? "" : "s"}`
            : "Save Activations"}
      </Button>
    </form>
  );
}
