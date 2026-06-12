"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createDealerTenantIdAction, type DealerIdFormState } from "./actions";

export function AddDealerIdForm() {
  const [state, formAction, pending] = useActionState<DealerIdFormState, FormData>(
    createDealerTenantIdAction,
    {},
  );

  return (
    <div className="space-y-2">
      <form action={formAction} className="max-w-sm space-y-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="dealer-id-name">
            Dealer ID name
          </label>
          <Input
            id="dealer-id-name"
            name="name"
            placeholder="e.g. DLR-001 or Branch A"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="dealer-shop-name">
            Shop name
          </label>
          <Input
            id="dealer-shop-name"
            name="shopName"
            placeholder="e.g. Khan Mobiles, Khanewal"
            required
            disabled={pending}
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add ID"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600 dark:text-green-400">Dealer ID added.</p>}
    </div>
  );
}
