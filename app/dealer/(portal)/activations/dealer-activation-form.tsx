"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createDealerActivationAction, type ActivationFormState } from "./actions";

interface Props {
  models: { id: string; name: string }[];
}

export function DealerActivationForm({ models }: Props) {
  const [state, formAction, pending] = useActionState<ActivationFormState, FormData>(
    createDealerActivationAction,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Add Activation</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="modelId">Model</label>
          <select
            id="modelId"
            name="modelId"
            required
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="imei">IMEI</label>
          <Input
            id="imei"
            name="imei"
            minLength={15}
            maxLength={17}
            required
            disabled={pending}
            placeholder="359123456789012"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="activationDate">Date</label>
          <Input
            id="activationDate"
            name="activationDate"
            type="date"
            defaultValue={today}
            required
            disabled={pending}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">Activation saved.</p>
      )}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Add Activation"}
      </Button>
    </form>
  );
}
