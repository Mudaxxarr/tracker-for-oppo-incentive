"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface BulkDealerIncentiveInput {
  periodStart: string;
  periodEnd: string;
  targetTotalActivations: number;
  rows: { modelId: string; perUnitAmount: number }[];
}

export type BulkDealerIncentiveAction = (
  input: BulkDealerIncentiveInput,
) => Promise<{ error?: string; ok?: boolean }>;

/**
 * Combined dealer incentive: one period and one shared activation target across
 * models, each model carrying its own rate (audit finding #8).
 *
 * The engine already supports this shape — `targetTotalActivations` is a global
 * threshold counting every activation, while each policy's `modelId` restricts
 * which activations earn its rate — so this writes N ordinary per-model policies
 * that share a target rather than needing a new table.
 *
 * Shared by the owner and dealer portals; each passes its own server action so
 * the two stay behaviourally identical without duplicating the form.
 */
export function BulkDealerIncentiveForm({
  models,
  action,
  defaultStart,
  defaultEnd,
  onSuccess,
}: {
  models: { id: string; name: string }[];
  action: BulkDealerIncentiveAction;
  defaultStart: string;
  defaultEnd: string;
  onSuccess?: () => void;
}) {
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [target, setTarget] = useState("");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rows = models
      .filter((m) => rates[m.id] && Number(rates[m.id]) > 0)
      .map((m) => ({ modelId: m.id, perUnitAmount: Number(rates[m.id]) }));
    if (!rows.length) { toast.error("Enter at least one model rate"); return; }
    if (!target || Number(target) < 1) { toast.error("Enter a valid overall target"); return; }
    setPending(true);
    startTransition(async () => {
      const res = await action({
        periodStart,
        periodEnd,
        targetTotalActivations: Number(target),
        rows,
      });
      setPending(false);
      if (res.ok) { setRates({}); setTarget(""); onSuccess?.(); }
      else toast.error(res.error ?? "Failed");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period start</label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period end</label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 dark:border-amber-800/50 dark:bg-amber-950/20">
        <label className="text-xs font-medium text-amber-700 dark:text-amber-400">Overall Activation Target</label>
        <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
          Once total activations across all models reach this number, every model below earns its rate.
        </p>
        <Input type="number" min={1} placeholder="e.g. 100" value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-[140px]" required />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Per-model rate — leave blank to skip a model</p>
        <div className="rounded-lg border divide-y">
          {models.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <Input
                type="number" step="any" min={0} placeholder="₨ per unit"
                value={rates[m.id] ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, [m.id]: e.target.value }))}
                className="w-32 text-right"
              />
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save Dealer Incentives"}
      </Button>
    </form>
  );
}
