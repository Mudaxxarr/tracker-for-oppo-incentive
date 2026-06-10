"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  recordBillingPayment,
  suspendTenant,
  reactivateTenant,
  updateMonthlyFee,
} from "@/lib/admin/dealers";

export type BillingActionState = { error?: string };

const PaymentSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  monthsAdded: z.coerce.number().int().min(0).max(60),
  note: z.string().max(255).optional(),
});

const FeeSchema = z.object({
  tenantId: z.string().min(1),
  monthlyFee: z.coerce.number().min(0, "Fee cannot be negative"),
});

const TenantIdSchema = z.object({ tenantId: z.string().min(1) });

export async function recordPaymentAction(
  _prev: BillingActionState,
  fd: FormData,
): Promise<BillingActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = PaymentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { tenantId, amount, paidAt, monthsAdded, note } = parsed.data;
  await recordBillingPayment(tenantId, amount, paidAt, note ?? null, "admin", monthsAdded || null);
  redirect(`/admin/dealers/${tenantId}/billing`);
}

export async function updateMonthlyFeeAction(
  _prev: BillingActionState,
  fd: FormData,
): Promise<BillingActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = FeeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await updateMonthlyFee(parsed.data.tenantId, parsed.data.monthlyFee);
  redirect(`/admin/dealers/${parsed.data.tenantId}/billing`);
}

export async function suspendTenantAction(
  _prev: BillingActionState,
  fd: FormData,
): Promise<BillingActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = TenantIdSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Invalid tenant" };

  await suspendTenant(parsed.data.tenantId);
  redirect(`/admin/dealers/${parsed.data.tenantId}/billing`);
}

export async function reactivateTenantAction(
  _prev: BillingActionState,
  fd: FormData,
): Promise<BillingActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = TenantIdSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Invalid tenant" };

  await reactivateTenant(parsed.data.tenantId);
  redirect(`/admin/dealers/${parsed.data.tenantId}/billing`);
}
