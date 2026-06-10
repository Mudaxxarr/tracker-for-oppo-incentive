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
import { createActivationAction, type ActivationFormState } from "./actions";
import { getPriceOnDateAction } from "./data-actions";
import { formatPKR } from "@/lib/format";
import { toast } from "sonner";
import { addToQueue } from "@/lib/offline-queue";
import type { StockRow } from "@/lib/db/queries/purchases";

interface Props {
  stock: StockRow[];
  dealerId: string;
  tenantId: string;
  onSuccess?: () => void;
}

export function ActivationForm({ stock, dealerId, tenantId, onSuccess }: Props) {
  const [state, action, pending] = useActionState<ActivationFormState, FormData>(
    createActivationAction,
    {}
  );
  const today = new Date().toISOString().slice(0, 10);
  const [modelId, setModelId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [activationDate, setActivationDate] = useState<string>(today);
  const [resolvedPrice, setResolvedPrice] = useState<number | null>(null);

  const selected = useMemo(
    () => (modelId ? stock.find((s) => s.modelId === modelId) : undefined),
    [stock, modelId]
  );
  const qtyNum = Math.max(1, Number(quantity) || 1);
  const overStock = !!selected && qtyNum > selected.quantity;

  // Whenever model or date changes, fetch the price effective on that date.
  useEffect(() => {
    if (!modelId || !activationDate) {
      setResolvedPrice(null);
      return;
    }
    let cancelled = false;
    getPriceOnDateAction(modelId, activationDate).then((p) => {
      if (!cancelled) setResolvedPrice(p?.dealerPrice ?? null);
    });
    return () => { cancelled = true; };
  }, [modelId, activationDate]);

  useEffect(() => {
    if (state.ok) {
      const n = state.inserted ?? 1;
      toast.success(
        n === 1
          ? `Activation added — snapshot at ${formatPKR(state.pricedAt ?? 0)}`
          : `Activated ${n} units — snapshot at ${formatPKR(state.pricedAt ?? 0)}`
      );
      setModelId("");
      setQuantity("1");
      setActivationDate(today);
      setResolvedPrice(null);
      onSuccess?.();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess, today]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!navigator.onLine) {
      const fd = new FormData(e.currentTarget);
      await addToQueue({
        type: "activation",
        portal: "owner",
        role: "owner",
        tenantId,
        dealerId,
        modelId,
        modelName: selected?.modelName ?? modelId,
        quantity: Math.max(1, Number(fd.get("quantity")) || 1),
        activationDate: String(fd.get("activationDate") ?? activationDate),
        imei: String(fd.get("imei") || "").trim() || undefined,
        isCrossRegion: fd.get("isCrossRegion") === "on",
        stockSnapshot: selected?.quantity ?? 0,
        dealerPrice: resolvedPrice ?? 0,
      });
      window.dispatchEvent(new Event("offlineQueueUpdated"));
      toast.success("Saved offline — will sync when connected");
      setModelId("");
      setQuantity("1");
      setActivationDate(today);
      setResolvedPrice(null);
      onSuccess?.();
      return;
    }
    action(new FormData(e.currentTarget));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="modelId" value={modelId} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Model (in stock)</label>
        <Select value={modelId} onValueChange={(v) => typeof v === "string" && setModelId(v)}>
          <SelectTrigger className="w-full">
            <span className={selected ? "" : "text-muted-foreground"}>
              {selected?.modelName ?? "Choose model…"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {stock.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No stock available — record a purchase first.
              </div>
            ) : (
              stock.map((s) => (
                <SelectItem key={s.modelId} value={s.modelId}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{s.modelName}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.quantity} in stock
                    </span>
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quantity</label>
          <Input
            name="quantity"
            type="number"
            min={1}
            max={selected?.quantity ?? undefined}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Activation date</label>
          <Input
            name="activationDate"
            type="date"
            value={activationDate}
            max={today}
            onChange={(e) => setActivationDate(e.target.value)}
            required
          />
        </div>
      </div>

      {qtyNum === 1 ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">IMEI (optional)</label>
          <Input name="imei" inputMode="numeric" maxLength={16} placeholder="14–16 digit IMEI" />
        </div>
      ) : null}

      {selected ? (
        resolvedPrice !== null ? (
          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Price on <strong className="text-foreground">{activationDate}</strong>:
            {" "}<strong className="text-foreground">{formatPKR(resolvedPrice)}</strong>
            {" "}— this will be snapshotted on the activation.
          </p>
        ) : (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            No dealer price defined for this model on {activationDate}. Add a price entry in
            Models first.
          </p>
        )
      ) : null}

      {overStock ? (
        <p className="text-xs text-destructive">
          Only {selected?.quantity} in stock — reduce quantity or record a purchase first.
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isCrossRegion" value="on" className="size-4" />
        <span>This phone arrived via cross-region transfer</span>
      </label>

      <Button
        type="submit"
        className="w-full"
        disabled={pending || !modelId || overStock || resolvedPrice === null}
      >
        {pending ? "Saving…" : qtyNum > 1 ? `Save ${qtyNum} Activations` : "Save Activation"}
      </Button>
    </form>
  );
}
