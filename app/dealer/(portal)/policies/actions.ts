"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { getModelById } from "@/lib/db/queries/models";
import * as Q from "@/lib/db/queries/policies";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";

export type PolicyFormState = { error?: string; ok?: boolean };

async function ctx() {
  const session = await getDealerSession();
  if (!session) return null;
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return null;
  return { dealerId, tenantId: session.tenantId };
}

const Period = {
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};

const TargetBonusSchema = z.object({
  periodStart: Period.start, periodEnd: Period.end,
  targetActivationsQty: z.coerce.number().int().positive(),
  bonusPercent: z.coerce.number().nonnegative(),
});
const StockInSchema = z.object({
  modelId: z.string().min(1), periodStart: Period.start, periodEnd: Period.end,
  perUnitAmount: z.coerce.number().nonnegative(), minQty: z.coerce.number().int().positive(),
});
const ActivationIncentiveSchema = z.object({
  modelId: z.string().min(1), periodStart: Period.start, periodEnd: Period.end,
  perUnitAmount: z.coerce.number().nonnegative(), targetQty: z.coerce.number().int().positive(),
});
const DealerIncentiveSchema = z.object({
  modelId: z.string().optional().nullable(), periodStart: Period.start, periodEnd: Period.end,
  targetTotalActivations: z.coerce.number().int().positive(), perUnitAmount: z.coerce.number().nonnegative(),
});

function revalidate() {
  revalidatePath("/dealer/policies");
  revalidatePath("/dealer/dashboard");
}

export async function createTargetBonusAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = TargetBonusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart) return { error: "End date must be on/after start date" };
  const id = await Q.createTargetBonusPolicy({ tenantId: c.tenantId, dealerId: c.dealerId, ...parsed.data });
  await logAudit({ action: "policy.target_bonus.create", dealerId: c.dealerId, entityType: "target_bonus_policy", entityId: id,
    summary: `[Dealer] Target Bonus: ${parsed.data.bonusPercent}% if ${parsed.data.targetActivationsQty} phones (${parsed.data.periodStart} → ${parsed.data.periodEnd})`, payload: parsed.data });
  revalidate(); return { ok: true };
}

export async function createStockInAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = StockInSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart) return { error: "End date must be on/after start date" };
  const id = await Q.createStockInPolicy({ tenantId: c.tenantId, dealerId: c.dealerId, modelId: parsed.data.modelId,
    periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, perUnitAmount: parsed.data.perUnitAmount, minQty: parsed.data.minQty });
  const m = await getModelById(parsed.data.modelId);
  await logAudit({ action: "policy.stock_in.create", dealerId: c.dealerId, entityType: "stock_in_policy", entityId: id,
    summary: `[Dealer] Stock-In ${m?.name ?? "?"}: ${formatPKR(parsed.data.perUnitAmount)}/unit (${parsed.data.periodStart} → ${parsed.data.periodEnd})`, payload: parsed.data });
  revalidate(); return { ok: true };
}

export async function createActivationIncentiveAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = ActivationIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart) return { error: "End date must be on/after start date" };
  const id = await Q.createActivationIncentivePolicy({ tenantId: c.tenantId, dealerId: c.dealerId, modelId: parsed.data.modelId,
    periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, perUnitAmount: parsed.data.perUnitAmount, targetQty: parsed.data.targetQty });
  const m = await getModelById(parsed.data.modelId);
  await logAudit({ action: "policy.activation_incentive.create", dealerId: c.dealerId, entityType: "activation_incentive_policy", entityId: id,
    summary: `[Dealer] Activation Incentive ${m?.name ?? "?"}: ${formatPKR(parsed.data.perUnitAmount)}/unit (${parsed.data.periodStart} → ${parsed.data.periodEnd})`, payload: parsed.data });
  revalidate(); return { ok: true };
}

export async function createDealerIncentiveAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = DealerIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.periodEnd < parsed.data.periodStart) return { error: "End date must be on/after start date" };
  const modelName = parsed.data.modelId ? (await getModelById(parsed.data.modelId))?.name : null;
  const id = await Q.createDealerIncentivePolicy({ tenantId: c.tenantId, dealerId: c.dealerId, modelId: parsed.data.modelId ?? null,
    periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, targetTotalActivations: parsed.data.targetTotalActivations, perUnitAmount: parsed.data.perUnitAmount });
  await logAudit({ action: "policy.dealer_incentive.create", dealerId: c.dealerId, entityType: "dealer_incentive_policy", entityId: id,
    summary: `[Dealer] Dealer Incentive${modelName ? ` (${modelName})` : ""}: ${formatPKR(parsed.data.perUnitAmount)}/unit if ${parsed.data.targetTotalActivations} phones (${parsed.data.periodStart} → ${parsed.data.periodEnd})`, payload: parsed.data });
  revalidate(); return { ok: true };
}

export async function updateTargetBonusAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = TargetBonusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateTargetBonusPolicy(id, c.tenantId, c.dealerId, parsed.data);
  revalidate(); return { ok: true };
}

export async function updateStockInAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = StockInSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateStockInPolicy(id, c.tenantId, c.dealerId, { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, perUnitAmount: parsed.data.perUnitAmount, minQty: parsed.data.minQty ?? null });
  revalidate(); return { ok: true };
}

export async function updateActivationIncentiveAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = ActivationIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateActivationIncentivePolicy(id, c.tenantId, c.dealerId, { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, perUnitAmount: parsed.data.perUnitAmount, targetQty: parsed.data.targetQty ?? null });
  revalidate(); return { ok: true };
}

export async function updateDealerIncentiveAction(_prev: PolicyFormState, fd: FormData): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated" };
  const id = fd.get("id") as string;
  const parsed = DealerIncentiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await Q.updateDealerIncentivePolicy(id, c.tenantId, c.dealerId, { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, targetTotalActivations: parsed.data.targetTotalActivations, perUnitAmount: parsed.data.perUnitAmount });
  revalidate(); return { ok: true };
}

export async function deletePolicyAction(
  type: "target-bonus" | "stock-in" | "activation-incentive" | "dealer-incentive",
  id: string,
): Promise<void> {
  const c = await ctx();
  if (!c) return;
  switch (type) {
    case "target-bonus": await Q.deleteTargetBonusPolicy(id, c.tenantId, c.dealerId); break;
    case "stock-in": await Q.deleteStockInPolicy(id, c.tenantId, c.dealerId); break;
    case "activation-incentive": await Q.deleteActivationIncentivePolicy(id, c.tenantId, c.dealerId); break;
    case "dealer-incentive": await Q.deleteDealerIncentivePolicy(id, c.tenantId, c.dealerId); break;
  }
  await logAudit({ action: `policy.${type.replace(/-/g, "_")}.delete`, dealerId: c.dealerId, entityType: type.replace(/-/g, "_") + "_policy", entityId: id,
    summary: `[Dealer] Deleted ${type} policy ${id.slice(0, 8)}` });
  revalidate();
}
