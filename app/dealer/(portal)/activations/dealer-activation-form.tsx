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
import { createDealerActivationAction, type ActivationFormState } from "./actions";
import { formatPKR } from "@/lib/format";
import { toast } from "sonner";
import { addToQueue } from "@/lib/offline-queue";
import type { StockRow } from "@/lib/db/queries/purchases";
import { HelpTip } from "@/components/dealer/help-tip";

interface Props {
  stock: StockRow[];
  dealerId: string;
  tenantId: string;
  role: "admin" | "exec";
  onSuccess?: () => void;
}

export function DealerActivationForm({ stock, dealerId, tenantId, role, onSuccess }: Props) {
  const [state, action, pending] = useActionState<ActivationFormState, FormData>(
    createDealerActivationAction,
    {},
  );
  const [modelId, setModelId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const today = new Date().toISOString().slice(0, 10);

  const selected = useMemo(
    () => (modelId ? stock.find((s) => s.modelId === modelId) : undefined),
    [stock, modelId],
  );
  const qtyNum = Math.max(1, Number(quantity) || 1);
  const overStock = !!selected && qtyNum > selected.quantity;

  useEffect(() => {
    if (state.ok) {
      const n = state.inserted ?? 1;
      toast.success(
        n === 1
          ? `Activation added — snapshot at ${formatPKR(state.pricedAt ?? 0)}`
          : `Activated ${n} units — snapshot at ${formatPKR(state.pricedAt ?? 0)}`,
      );
      setModelId("");
      setQuantity("1");
      onSuccess?.();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!navigator.onLine) {
      const fd = new FormData(e.currentTarget);
      await addToQueue({
        type: "activation",
        portal: "dealer",
        role,
        tenantId,
        dealerId,
        modelId,
        modelName: selected?.modelName ?? modelId,
        quantity: Math.max(1, Number(fd.get("quantity")) || 1),
        activationDate: String(fd.get("activationDate") ?? today),
        imei: String(fd.get("imei") || "").trim() || undefined,
        isCrossRegion: fd.get("isCrossRegion") === "on",
        stockSnapshot: selected?.quantity ?? 0,
        dealerPrice: selected?.dealerPrice ?? 0,
      });
      window.dispatchEvent(new Event("offlineQueueUpdated"));
      toast.success(`Saved offline — will sync when connected`);
      setModelId("");
      setQuantity("1");
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
                      {s.dealerPrice != null ? ` · ${formatPKR(s.dealerPrice)}` : ""}
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
          <Input name="activationDate" type="date" defaultValue={today} max={today} required />
        </div>
      </div>

      {qtyNum === 1 ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">IMEI (optional)</label>
          <Input name="imei" inputMode="numeric" maxLength={16} placeholder="14–16 digit IMEI" />
        </div>
      ) : null}

      {selected ? (
        <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          Price snapshot will use the dealer price effective on the activation date — currently{" "}
          <strong className="text-foreground">{formatPKR(selected.dealerPrice ?? 0)}</strong>.
        </p>
      ) : null}

      {overStock ? (
        <p className="text-xs text-destructive">
          Only {selected?.quantity} in stock — reduce quantity or record a purchase first.
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isCrossRegion" value="on" className="size-4" />
        <span className="inline-flex items-center gap-1">
          Cross-region (sold outside your area) <HelpTip term="cr-exposure" />
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={pending || !modelId || overStock}>
        {pending ? "Saving…" : qtyNum > 1 ? `Save ${qtyNum} Activations` : "Save Activation"}
      </Button>
    </form>
  );
}
