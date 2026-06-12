"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  recordPaymentAction,
  updateMonthlyFeeAction,
  suspendTenantAction,
  reactivateTenantAction,
  toggleAddonAction,
  type BillingActionState,
} from "./actions";
import { DEALER_ADDONS } from "@/lib/dealer-addons";
import type { TenantDetail, BillingEventRow } from "@/lib/admin/dealers";
import { differenceInDays, parseISO, format } from "date-fns";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "grace") return "secondary";
  return "destructive";
}

function daysLabel(expiresAt: string): string {
  const d = differenceInDays(parseISO(expiresAt), new Date());
  if (d > 0) return `${d} days remaining`;
  return `expired ${Math.abs(d)} days ago`;
}

interface Props {
  tenant: TenantDetail;
  events: BillingEventRow[];
}

export function BillingClient({ tenant, events }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [payState, payAction, payPending] = useActionState<BillingActionState, FormData>(
    recordPaymentAction,
    {},
  );
  const [feeState, feeAction, feePending] = useActionState<BillingActionState, FormData>(
    updateMonthlyFeeAction,
    {},
  );
  const [suspendState, suspendAction, suspendPending] = useActionState<BillingActionState, FormData>(
    suspendTenantAction,
    {},
  );
  const [reactState, reactAction, reactPending] = useActionState<BillingActionState, FormData>(
    reactivateTenantAction,
    {},
  );
  const [addonState, addonAction, addonPending] = useActionState<BillingActionState, FormData>(
    toggleAddonAction,
    {},
  );

  const isSuspended = tenant.status === "suspended";
  const featureMap = tenant.features as Record<string, boolean | undefined>;
  const addonsTotal = DEALER_ADDONS.reduce(
    (sum, a) => sum + (featureMap[a.key] === true ? a.monthlyPrice : 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.businessName}</h1>
          <p className="text-sm text-muted-foreground">{tenant.ownerEmail}</p>
        </div>
        <Link
          href={`/admin/dealers/${tenant.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Back
        </Link>
      </div>

      {/* Plan status */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <Badge variant={statusVariant(tenant.status)}>{tenant.status}</Badge>
        <span className="text-sm text-muted-foreground">
          Expires {tenant.expiresAt} &middot; {daysLabel(tenant.expiresAt)}
        </span>
        <span className="text-sm text-muted-foreground">
          &middot; Plan: {tenant.planMonths}m
        </span>
        {tenant.monthlyFee != null && (
          <span className="text-sm font-medium">
            &middot; PKR {tenant.monthlyFee.toLocaleString()}/mo
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Record payment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={payAction} className="space-y-3">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="amount">
                  Amount (PKR)
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min={1}
                  placeholder="e.g. 5000"
                  disabled={payPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="paidAt">
                  Payment date
                </label>
                <Input
                  id="paidAt"
                  name="paidAt"
                  type="date"
                  defaultValue={today}
                  disabled={payPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="monthsAdded">
                  Extend plan by (months, 0 = payment only)
                </label>
                <Input
                  id="monthsAdded"
                  name="monthsAdded"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={1}
                  disabled={payPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="note">
                  Note (optional)
                </label>
                <Input
                  id="note"
                  name="note"
                  placeholder="e.g. Cash payment received"
                  disabled={payPending}
                />
              </div>
              {payState.error && (
                <p className="text-sm text-destructive">{payState.error}</p>
              )}
              <Button type="submit" disabled={payPending}>
                {payPending ? "Saving…" : "Record payment"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Monthly fee + suspend */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Fee</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={feeAction} className="flex gap-2">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <Input
                  name="monthlyFee"
                  type="number"
                  min={0}
                  placeholder="PKR"
                  defaultValue={tenant.monthlyFee ?? ""}
                  disabled={feePending}
                />
                <Button type="submit" variant="outline" disabled={feePending}>
                  {feePending ? "Saving…" : "Save"}
                </Button>
              </form>
              {feeState.error && (
                <p className="mt-1 text-sm text-destructive">{feeState.error}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isSuspended ? (
                <form action={reactAction}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={reactPending}
                    className="w-full"
                  >
                    {reactPending ? "Reactivating…" : "Reactivate account"}
                  </Button>
                  {reactState.error && (
                    <p className="mt-1 text-sm text-destructive">{reactState.error}</p>
                  )}
                </form>
              ) : (
                <form action={suspendAction}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={suspendPending}
                    className="w-full"
                  >
                    {suspendPending ? "Suspending…" : "Suspend account"}
                  </Button>
                  {suspendState.error && (
                    <p className="mt-1 text-sm text-destructive">{suspendState.error}</p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add-ons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add-ons</CardTitle>
          <p className="text-sm text-muted-foreground">
            Per-feature upsells. Enabling one unlocks it in the dealer portal; remember to update the monthly fee above.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {DEALER_ADDONS.map((a) => {
            const enabled = featureMap[a.key] === true;
            return (
              <div
                key={a.key}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    PKR {a.monthlyPrice.toLocaleString()}/month
                  </p>
                </div>
                {enabled && <Badge>enabled</Badge>}
                <form action={addonAction}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="addonKey" value={a.key} />
                  <input type="hidden" name="enable" value={enabled ? "false" : "true"} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={enabled ? "outline" : "default"}
                    disabled={addonPending}
                  >
                    {enabled ? "Disable" : "Enable"}
                  </Button>
                </form>
              </div>
            );
          })}
          {addonState.error && (
            <p className="text-sm text-destructive">{addonState.error}</p>
          )}
          {addonsTotal > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              Active add-ons total: <span className="font-medium">PKR {addonsTotal.toLocaleString()}/month</span>
              {tenant.monthlyFee != null && (
                <> · suggested fee: PKR {(tenant.monthlyFee + addonsTotal).toLocaleString()} if base fee excludes add-ons</>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Payment History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    PKR {e.amount.toLocaleString()}
                    {e.monthsAdded ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        +{e.monthsAdded}m
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(e.paidAt), "d MMM yyyy")}
                    {e.note ? ` · ${e.note}` : ""}
                    {e.recordedBy ? ` · by ${e.recordedBy}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
