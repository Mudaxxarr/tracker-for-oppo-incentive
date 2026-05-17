"use client";

import { useActionState, use } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { renewTenantAction, type RenewState } from "./actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RenewPage({ params }: Props) {
  const { id } = use(params);
  const [state, formAction, pending] = useActionState<RenewState, FormData>(
    renewTenantAction,
    {},
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Renew Subscription</h1>
      <form action={formAction} className="max-w-sm">
        <input type="hidden" name="tenantId" value={id} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extend by months</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="months">
                Months to add
              </label>
              <Input
                id="months"
                name="months"
                type="number"
                min={1}
                max={60}
                defaultValue={12}
                disabled={pending}
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Renewing…" : "Renew"}
            </Button>
            <Link href={`/admin/dealers/${id}`} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
