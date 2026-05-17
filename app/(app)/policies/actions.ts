"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { getModelById } from "@/lib/db/queries/models";
import * as Q from "@/lib/db/queries/policies";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";

const Period = {
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};

const TargetBonusSchema = z.object({
  periodStart: Period.start,
  periodEnd: Period.end,
  targetActivationsQty: z.coerce.number().int().positive(),
  bonusPercent: z.coerce.number().nonnegative(),
});

const StockInSchema = z.object({
  modelId: z.string().min(1),
  periodStart: Period.start,
  periodEnd: Period.end,
  perUnitAmount: z.coerce.number().nonnegative(),
  minQty: z.coerce.number().int().positive(),
});

const ActivationIncentiveSchema = z.object({
  modelId: z.string().min(1),
  periodStart: Period.start,
  periodEnd: Period.end,
  perUnitAmount: z.coerce.number().nonnegative(),
  targetQty: z.coerce.number().int().positive(),
});

const DealerIncentiveSchema = z.object({
  modelId: z.string().optional().nullable(),
  periodStart: Period.start,
  periodEnd: Period.end,
  targetTotalActivations: z.coerce.number().int().positive(),
  perUnitAmount: z.coerce.number().nonnegative(),
});

export type PolicyFormState = { error?: string; ok?: boolean };

async function ctx() {
  if (!(await isAuthenticated())) return null;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return null;
  return { dealerId, tenantId: OWNER_TENANT_ID };
}

export async function createTargetBonusAction(
  _prev: PolicyFormState,
  fd: FormData
): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = TargetBonusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart)
    return { error: "End date must be on/after start date" };
  const id = await Q.createTargetBonusPolicy({ tenantId: c.tenantId, dealerId: c.dealerId, ...parsed.data });
  await logAudit({
    action: "policy.target_bonus.create",
    entityType: "target_bonus_policy",
    entityId: id,
    summary: `Target Bonus: ${parsed.data.bonusPercent}% if ${parsed.data.targetActivationsQty} phones (${parsed.data.periodStart} → ${parsed.data.periodEnd})`,
    payload: parsed.data,
  });
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createStockInAction(
  _prev: PolicyFormState,
  fd: FormData
): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = StockInSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart)
    return { error: "End date must be on/after start date" };
  const id = await Q.createStockInPolicy({
    tenantId: c.tenantId,
    dealerId: c.dealerId,
    modelId: parsed.data.modelId,
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    perUnitAmount: parsed.data.perUnitAmount,
    minQty: parsed.data.minQty,
  });
  const m = await getModelById(parsed.data.modelId);
  await logAudit({
    action: "policy.stock_in.create",
    entityType: "stock_in_policy",
    entityId: id,
    summary: `Stock-In ${m?.name ?? "?"}: ${formatPKR(parsed.data.perUnitAmount)}/unit${
      parsed.data.minQty ? ` (min ${parsed.data.minQty})` : ""
    } (${parsed.data.periodStart} → ${parsed.data.periodEnd})`,
    payload: parsed.data,
  });
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createActivationIncentiveAction(
  _prev: PolicyFormState,
  fd: FormData
): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = ActivationIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart)
    return { error: "End date must be on/after start date" };
  const id = await Q.createActivationIncentivePolicy({
    tenantId: c.tenantId,
    dealerId: c.dealerId,
    modelId: parsed.data.modelId,
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    perUnitAmount: parsed.data.perUnitAmount,
    targetQty: parsed.data.targetQty,
  });
  const m = await getModelById(parsed.data.modelId);
  await logAudit({
    action: "policy.activation_incentive.create",
    entityType: "activation_incentive_policy",
    entityId: id,
    summary: `Activation Incentive ${m?.name ?? "?"}: ${formatPKR(parsed.data.perUnitAmount)}/unit${
      parsed.data.targetQty ? ` (target ${parsed.data.targetQty})` : ""
    } (${parsed.data.periodStart} → ${parsed.data.periodEnd})`,
    payload: parsed.data,
  });
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createDealerIncentiveAction(
  _prev: PolicyFormState,
  fd: FormData
): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = DealerIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart)
    return { error: "End date must be on/after start date" };
  const modelName = parsed.data.modelId ? (await getModelById(parsed.data.modelId))?.name : null;
  const id = await Q.createDealerIncentivePolicy({
    tenantId: c.tenantId,
    dealerId: c.dealerId,
    modelId: parsed.data.modelId ?? null,
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    targetTotalActivations: parsed.data.targetTotalActivations,
    perUnitAmount: parsed.data.perUnitAmount,
  });
  await logAudit({
    action: "policy.dealer_incentive.create",
    entityType: "dealer_incentive_policy",
    entityId: id,
    summary: `Dealer Incentive${modelName ? ` (${modelName})` : ""}: ${formatPKR(parsed.data.perUnitAmount)}/unit if ${parsed.data.targetTotalActivations} phones (${parsed.data.periodStart} → ${parsed.data.periodEnd})`,
    payload: parsed.data,
  });
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTargetBonusAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = TargetBonusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateTargetBonusPolicy(id, c.tenantId, c.dealerId, parsed.data);
  revalidatePath("/policies"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateStockInAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = StockInSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateStockInPolicy(id, c.tenantId, c.dealerId, { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, perUnitAmount: parsed.data.perUnitAmount, minQty: parsed.data.minQty ?? null });
  revalidatePath("/policies"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateActivationIncentiveAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = ActivationIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateActivationIncentivePolicy(id, c.tenantId, c.dealerId, { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, perUnitAmount: parsed.data.perUnitAmount, targetQty: parsed.data.targetQty ?? null });
  revalidatePath("/policies"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDealerIncentiveAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = DealerIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateDealerIncentivePolicy(id, c.tenantId, c.dealerId, { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, targetTotalActivations: parsed.data.targetTotalActivations, perUnitAmount: parsed.data.perUnitAmount });
  revalidatePath("/policies"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePolicyAction(
  type: "target-bonus" | "stock-in" | "activation-incentive" | "dealer-incentive",
  id: string
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  switch (type) {
    case "target-bonus":
      await Q.deleteTargetBonusPolicy(id, c.tenantId, c.dealerId);
      break;
    case "stock-in":
      await Q.deleteStockInPolicy(id, c.tenantId, c.dealerId);
      break;
    case "activation-incentive":
      await Q.deleteActivationIncentivePolicy(id, c.tenantId, c.dealerId);
      break;
    case "dealer-incentive":
      await Q.deleteDealerIncentivePolicy(id, c.tenantId, c.dealerId);
      break;
  }
  await logAudit({
    action: `policy.${type.replace(/-/g, "_")}.delete`,
    entityType: type.replace(/-/g, "_") + "_policy",
    entityId: id,
    summary: `Deleted ${type} policy ${id.slice(0, 8)}`,
  });
  revalidatePath("/policies");
  revalidatePath("/dashboard");
}
