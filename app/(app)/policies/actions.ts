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

/** Blank means "no cap" — an empty form field must become null, not 0. */
const OptionalCap = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().positive().nullable()
);

const TargetBonusSchema = z.object({
  periodStart: Period.start,
  periodEnd: Period.end,
  targetActivationsQty: z.coerce.number().int().positive(),
  bonusPercent: z.coerce.number().nonnegative(),
  bonusCapQty: OptionalCap,
});

const StockInSchema = z.object({
  modelId: z.string().min(1),
  periodStart: Period.start,
  periodEnd: Period.end,
  perUnitAmount: z.coerce.number().nonnegative(),
  minQty: z.coerce.number().int().positive(),
});

const CombinedStockInSchema = z.object({
  periodStart: Period.start,
  periodEnd: Period.end,
  targetQty: z.coerce.number().int().min(1, "Target must be ≥ 1"),
  models: z.array(z.object({
    modelId: z.string().min(1, "Model required"),
    perUnitAmount: z.coerce.number().min(0, "Rate must be ≥ 0"),
  })).min(1, "Add at least one model"),
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
  const overlap = await Q.findOverlappingStockInPolicy(c.tenantId, c.dealerId, parsed.data.modelId, parsed.data.periodStart, parsed.data.periodEnd);
  if (overlap)
    return { error: `A stock-in policy for this model already covers ${overlap.periodStart} → ${overlap.periodEnd}. Overlapping periods are not allowed.` };
  const combinedClash = await Q.findStockInOverlapForModels(c.tenantId, c.dealerId, [parsed.data.modelId], parsed.data.periodStart, parsed.data.periodEnd);
  if (combinedClash)
    return { error: `"${combinedClash}" is already in a combined stock-in policy overlapping ${parsed.data.periodStart} → ${parsed.data.periodEnd}. Overlapping periods are not allowed.` };
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

export async function createCombinedStockInAction(
  input: z.infer<typeof CombinedStockInSchema>
): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = CombinedStockInSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { periodStart, periodEnd, targetQty, models } = parsed.data;
  if (periodEnd < periodStart) return { error: "End date must be on/after start date" };
  const modelIds = models.map((m) => m.modelId);
  if (new Set(modelIds).size !== modelIds.length) return { error: "Each model can appear only once" };
  // Safety guard: none of these models may already be in an overlapping stock-in
  // policy (per-model OR combined) — enforces the no-overlap invariant.
  const clash = await Q.findStockInOverlapForModels(c.tenantId, c.dealerId, modelIds, periodStart, periodEnd);
  if (clash)
    return { error: `"${clash}" already has a stock-in policy overlapping ${periodStart} → ${periodEnd}. Overlapping periods are not allowed.` };
  const id = await Q.createCombinedStockInPolicy({ tenantId: c.tenantId, dealerId: c.dealerId, periodStart, periodEnd, targetQty, models });
  await logAudit({
    action: "policy.combined_stock_in.create",
    entityType: "combined_stock_in_policy",
    entityId: id,
    summary: `Combined Stock-In: target ${targetQty} across ${models.length} model(s) (${periodStart} → ${periodEnd})`,
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

const BulkDealerIncentiveSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetTotalActivations: z.coerce.number().int().min(1, "Target must be ≥ 1"),
  rows: z.array(z.object({
    modelId: z.string().min(1, "Model required"),
    perUnitAmount: z.coerce.number().min(0, "Rate must be ≥ 0"),
  })).min(1, "Add at least one model"),
});

export async function bulkCreateDealerIncentivesAction(
  input: z.infer<typeof BulkDealerIncentiveSchema>
): Promise<PolicyFormState> {
  const c = await ctx();
  if (!c) return { error: "Not authenticated or no active Dealer ID" };
  const parsed = BulkDealerIncentiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { periodStart, periodEnd, targetTotalActivations, rows } = parsed.data;
  if (periodEnd < periodStart) return { error: "End date must be on/after start date" };

  for (const row of rows) {
    const id = await Q.createDealerIncentivePolicy({
      tenantId: c.tenantId,
      dealerId: c.dealerId,
      modelId: row.modelId,
      periodStart,
      periodEnd,
      targetTotalActivations,
      perUnitAmount: row.perUnitAmount,
    });
    await logAudit({
      action: "policy.dealer_incentive.create",
      entityType: "dealer_incentive_policy",
      entityId: id,
      summary: `Dealer Incentive (${row.modelId}): ${formatPKR(row.perUnitAmount)}/unit if ${targetTotalActivations} total (${periodStart} → ${periodEnd})`,
      payload: { ...row, periodStart, periodEnd, targetTotalActivations },
    });
  }
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
  const overlap = await Q.findOverlappingStockInPolicy(c.tenantId, c.dealerId, parsed.data.modelId, parsed.data.periodStart, parsed.data.periodEnd, id);
  if (overlap)
    return { error: `A stock-in policy for this model already covers ${overlap.periodStart} → ${overlap.periodEnd}. Overlapping periods are not allowed.` };
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
  type: "target-bonus" | "stock-in" | "combined-stock-in" | "activation-incentive" | "dealer-incentive",
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
    case "combined-stock-in":
      await Q.deleteCombinedStockInPolicy(id, c.tenantId, c.dealerId);
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
