"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getStaffSession } from "@/lib/staff-auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { db } from "@/lib/db/client";
import {
  createCrossRegion,
  deleteCrossRegion,
  updateCrossRegionStatus,
} from "@/lib/db/queries/transfers";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { getMinForwardStock } from "@/lib/db/queries/purchases";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { createCrCaught, rejectCrCaught } from "@/lib/db/queries/cr-caught";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { CROSS_REGION_STATUS, OWNER_ALERT_TYPE } from "@/lib/constants";
import { getConstants } from "@/lib/settings";
import { formatPKR } from "@/lib/format";
import { logAudit } from "@/lib/audit";

const Schema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceRegionNote: z.string().max(500).optional().nullable(),
});

export type CrFormState = { error?: string; ok?: boolean };

export async function createCrossRegionAction(
  _prev: CrFormState,
  fd: FormData
): Promise<CrFormState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  // Cross-Region is SO-only among staff (accountant handles reports/reconciliation, not CR)
  const staffSession = await getStaffSession();
  if (staffSession?.role === "accountant") return { error: "Not authorized for this role" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;
  // Physical Floor Test — CR Inward is a pure stock receipt; fines are impossible
  const rawFine = Number(fd.get("fineAmount") ?? 0);
  if (rawFine > 0) return { error: "Logic Violation: Fines cannot be applied to inward stock receipts." };

  const parsed = Schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const isOwner = await isAuthenticated();
  const id = await createCrossRegion({
    tenantId,
    dealerId,
    ...parsed.data,
    sourceRegionNote: parsed.data.sourceRegionNote ?? null,
    fineAmount: 0,
    // SO-created transfers go straight to pending owner approval
    initialStatus: isOwner ? CROSS_REGION_STATUS.PENDING_REPORT : CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL,
  });
  const m = await getModelById(parsed.data.modelId);

  if (!isOwner) {
    // Expected incentive preview (base% + bonus%) on the inbound units.
    const price = await getPriceOnDate(tenantId, parsed.data.modelId, parsed.data.reportedDate);
    const { basePercent, defaultBonusPercent } = await getConstants();
    const expected = price
      ? (parsed.data.quantity * price.dealerPrice * (basePercent + defaultBonusPercent)) / 100
      : 0;
    await createOwnerAlert({
      tenantId,
      type: OWNER_ALERT_TYPE.CR_PENDING_APPROVAL,
      entityType: "cross_region_transfer",
      entityId: id,
      dealerId,
      message: `Cross-region INWARD: ${parsed.data.quantity} × ${m?.name ?? "?"} shifting into your ID. Expected incentive ≈ ${formatPKR(expected)} (${basePercent}% + ${defaultBonusPercent}%). Approve to add to stock.`,
    });
  }

  await logAudit({
    action: "cross_region.create",
    entityType: "cross_region_transfer",
    entityId: id,
    summary: `Reported cross-region: ${parsed.data.quantity} × ${m?.name ?? "?"}${
      parsed.data.sourceRegionNote ? ` from ${parsed.data.sourceRegionNote}` : ""
    }`,
    payload: parsed.data,
  });
  revalidatePath("/cross-region");
  revalidatePath("/dashboard");
  return { ok: true };
}

// CR-1: owner approves or rejects a pending cross-region transfer
export async function updateStatusAction(
  id: string,
  status: "PENDING_REPORT" | "PENDING_OWNER_APPROVAL" | "SHIFTED_TO_MY_ID" | "REJECTED"
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAuthenticated())) return { ok: false, message: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { ok: false, message: "No active Dealer ID" };
  const result = await updateCrossRegionStatus({ id, tenantId: OWNER_TENANT_ID, dealerId, status, priceTenantId: OWNER_TENANT_ID });
  await logAudit({
    action: "cross_region.status",
    entityType: "cross_region_transfer",
    entityId: id,
    status: result.ok ? "ok" : "error",
    summary: result.ok
      ? `Cross-region ${id.slice(0, 8)} → ${status}${result.created ? ` (created ${result.created} purchase line)` : ""}`
      : `Cross-region status update failed: ${result.message}`,
    payload: { status, created: result.created },
  });
  revalidatePath("/cross-region");
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Approved CR inward adds back-dated stock → recompute rebates from its reported date
  // so a price drop after that date includes this unit (and not earlier drops).
  if (result.ok && result.modelId && result.effectiveDate) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, result.dealerId ?? dealerId, result.modelId, result.effectiveDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { ok: result.ok, message: result.message };
}

const EditSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceRegionNote: z.string().max(500).optional().nullable(),
});

export async function editCrossRegionAction(
  _prev: CrFormState,
  fd: FormData
): Promise<CrFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;
  const parsed = EditSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { db, schema } = await import("@/lib/db/client");
  const { and, eq } = await import("drizzle-orm");
  const { CROSS_REGION_STATUS } = await import("@/lib/constants");

  // Only allow editing PENDING rows
  const rows = await db
    .select()
    .from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.id, parsed.data.id), eq(schema.crossRegionTransfers.dealerId, dealerId)))
    .limit(1);
  if (rows.length === 0) return { error: "Not found" };
  if (rows[0].status !== CROSS_REGION_STATUS.PENDING_REPORT) {
    return { error: "Only pending transfers can be edited" };
  }

  // Physical Floor Test — fineAmount stays 0 on all CR Inward edits
  const rawFineEdit = Number(fd.get("fineAmount") ?? 0);
  if (rawFineEdit > 0) return { error: "Logic Violation: Fines cannot be applied to inward stock receipts." };

  await db
    .update(schema.crossRegionTransfers)
    .set({
      quantity: parsed.data.quantity,
      reportedDate: parsed.data.reportedDate,
      sourceRegionNote: parsed.data.sourceRegionNote ?? null,
      fineAmount: 0,
    })
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.id, parsed.data.id)));

  await logAudit({
    action: "cross_region.edit",
    entityType: "cross_region_transfer",
    entityId: parsed.data.id,
    summary: `Edited cross-region ${parsed.data.id.slice(0, 8)}: qty=${parsed.data.quantity}`,
    payload: parsed.data,
  });
  revalidatePath("/cross-region");
  return { ok: true };
}

// ── CR Outward (Penalties) ───────────────────────────────────────────────────

export type OutwardState = { error?: string; ok?: boolean; pendingApproval?: boolean };

const OutwardSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
  fineAmount: z.coerce.number().min(0).optional(),
  caughtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
}).refine((d) => d.quantity > 0 || (d.fineAmount ?? 0) > 0, {
  message: "Enter a quantity caught or a fine amount (or both)",
});

export async function crOutwardAction(
  _prev: OutwardState,
  fd: FormData
): Promise<OutwardState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  // Cross-Region is SO-only among staff (accountant handles reports/reconciliation, not CR)
  const staffSession = await getStaffSession();
  if (staffSession?.role === "accountant") return { error: "Not authorized for this role" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = OutwardSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, quantity, fineAmount, caughtDate, note } = parsed.data;

  const isOwner = await isAuthenticated();

  // Cash-only fines are owner-only
  if (quantity === 0 && !isOwner) return { error: "Only the owner can log cash-only fines" };

  const priceInfo = quantity > 0 ? await getPriceOnDate(tenantId, modelId, caughtDate) : null;
  const priceSnap = priceInfo?.dealerPrice ?? 0;
  const status = isOwner ? "active" : "pending_owner_approval";

  let stockError: string | null = null;
  let id: string | undefined;
  await db.transaction(async (tx) => {
    if (quantity > 0) {
      const stock = await getMinForwardStock(tenantId, dealerId, modelId, caughtDate, tx);
      if (stock < quantity) {
        stockError = `Only ${stock} unit(s) in stock from ${caughtDate} onward`;
        return;
      }
    }
    id = await createCrCaught({
      tenantId, dealerId, modelId,
      quantity, fineAmount: fineAmount ?? 0,
      caughtDate, dealerPriceSnapshot: priceSnap,
      note: note ?? null, status,
    }, tx);
  });
  if (stockError) return { error: stockError };
  if (!id) return { error: "Failed to record CR-caught" };
  const m = await getModelById(modelId);

  if (!isOwner && quantity > 0) {
    await createOwnerAlert({
      tenantId,
      type: OWNER_ALERT_TYPE.CR_CAUGHT_PENDING_APPROVAL,
      entityType: "cr_caught",
      entityId: id,
      dealerId,
      message: `⚠ Cross-region OUTWARD: ${quantity} × ${m?.name ?? "?"} leaving your ID on ${caughtDate}. Investigate why before approving — approval deducts this stock.`,
    });
  }

  await logAudit({
    action: quantity === 0 ? "cr.cash_fine" : "cr.caught",
    entityType: "cr_caught",
    entityId: id,
    summary: `CR Outward${!isOwner ? " (pending)" : ""}: qty=${quantity} fine=${fineAmount ?? 0} model=${m?.name ?? "?"}`,
    payload: { modelId, quantity, fineAmount, caughtDate, status },
  });

  revalidatePath("/cross-region");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Owner-created CR-caught deducts stock immediately → recompute rebates.
  if (quantity > 0) await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, caughtDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true, pendingApproval: !isOwner };
}

export async function deleteCrCaughtAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { ok: false, error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { ok: false, error: "No active Dealer ID" };
  const ref = await rejectCrCaught(id);
  await logAudit({
    action: "cr.caught.delete",
    entityType: "cr_caught",
    entityId: id,
    summary: `Deleted CR-caught entry ${id.slice(0, 8)} — stock restored`,
  });
  revalidatePath("/cross-region");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Restoring stock changes closing stock → recompute rebates.
  if (ref) await reEvaluateRebatesForDealer(ref.tenantId, ref.dealerId, ref.modelId, ref.caughtDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

export async function approveCrCaughtAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { ok: false, error: "Not authenticated" };
  const { approveCrCaught } = await import("@/lib/db/queries/cr-caught");
  const ref = await approveCrCaught(id);
  await logAudit({
    action: "cr.caught.approve",
    entityType: "cr_caught",
    entityId: id,
    summary: `Approved CR-caught entry ${id.slice(0, 8)} — now active`,
  });
  revalidatePath("/cross-region");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Approving deducts stock → recompute rebates.
  if (ref) await reEvaluateRebatesForDealer(ref.tenantId, ref.dealerId, ref.modelId, ref.caughtDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

export async function deleteCrossRegionAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return;
  const info = await deleteCrossRegion(id, OWNER_TENANT_ID, dealerId);
  await logAudit({
    action: "cross_region.delete",
    entityType: "cross_region_transfer",
    entityId: id,
    summary: `Deleted cross-region ${id.slice(0, 8)} and its linked purchases`,
  });
  revalidatePath("/cross-region");
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Removing CR stock changes closing stock → recompute rebates from its reported date.
  if (info) await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, info.modelId, info.reportedDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
}
