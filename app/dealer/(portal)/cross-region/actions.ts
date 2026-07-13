"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { createCrossRegion, updateCrossRegionStatus, deleteCrossRegion } from "@/lib/db/queries/transfers";
import { getMinForwardStock } from "@/lib/db/queries/purchases";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { createCrCaught, deleteCrCaught } from "@/lib/db/queries/cr-caught";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { logAudit } from "@/lib/audit";
import { CROSS_REGION_STATUS } from "@/lib/constants";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { formatPKR } from "@/lib/format";

export type CrossRegionFormState = { error?: string; ok?: boolean };

const CreateSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sourceRegionNote: z.string().max(300).optional().nullable(),
});

const EditSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sourceRegionNote: z.string().max(300).optional().nullable(),
});

export async function createCrossRegionAction(
  _prev: CrossRegionFormState,
  formData: FormData,
): Promise<CrossRegionFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, quantity, reportedDate, sourceRegionNote } = parsed.data;
  try {
    const id = await createCrossRegion({
      tenantId: session.tenantId,
      dealerId,
      modelId,
      quantity,
      reportedDate,
      sourceRegionNote: sourceRegionNote ?? null,
    });
    await logAudit({
      action: "cross_region.create",
      dealerId,
      entityType: "cross_region_transfer",
      entityId: id,
      summary: `[Dealer] Created cross-region: qty ${quantity} on ${reportedDate}`,
    });
    revalidatePath("/dealer/cross-region");
    revalidatePath("/dealer/dashboard");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return { error: msg };
  }
}

export async function editDealerCrossRegionAction(
  _prev: CrossRegionFormState,
  fd: FormData,
): Promise<CrossRegionFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = EditSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { db, schema } = await import("@/lib/db/client");
  const { and, eq } = await import("drizzle-orm");
  const { CROSS_REGION_STATUS } = await import("@/lib/constants");

  const rows = await db
    .select()
    .from(schema.crossRegionTransfers)
    .where(
      and(
        eq(schema.crossRegionTransfers.tenantId, session.tenantId),
        eq(schema.crossRegionTransfers.id, parsed.data.id),
        eq(schema.crossRegionTransfers.dealerId, dealerId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return { error: "Not found" };
  if (rows[0].status !== CROSS_REGION_STATUS.PENDING_REPORT) {
    return { error: "Only pending transfers can be edited" };
  }

  await db
    .update(schema.crossRegionTransfers)
    .set({
      quantity: parsed.data.quantity,
      reportedDate: parsed.data.reportedDate,
      sourceRegionNote: parsed.data.sourceRegionNote ?? null,
    })
    .where(
      and(
        eq(schema.crossRegionTransfers.tenantId, session.tenantId),
        eq(schema.crossRegionTransfers.id, parsed.data.id),
      ),
    );

  await logAudit({
    action: "cross_region.edit",
    dealerId,
    entityType: "cross_region_transfer",
    entityId: parsed.data.id,
    summary: `[Dealer] Edited cross-region ${parsed.data.id.slice(0, 8)}: qty=${parsed.data.quantity}`,
  });
  revalidatePath("/dealer/cross-region");
  return { ok: true };
}

/** Dealer shifts a reported cross-region IN transfer into their own inventory.
 *  This creates the inbound purchase (stock) immediately on the reported date at
 *  the owner-configured price — no owner approval and no owner alert. Works for
 *  every dealer role. */
export async function submitCrossRegionForApprovalAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const session = await getDealerSession();
  if (!session) return { ok: false, message: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { ok: false, message: "No active Dealer ID" };

  const result = await updateCrossRegionStatus({
    id,
    tenantId: session.tenantId,
    dealerId,
    status: CROSS_REGION_STATUS.SHIFTED_TO_MY_ID,
    priceTenantId: OWNER_TENANT_ID,
  });
  if (!result.ok) return { ok: false, message: result.message };

  await logAudit({
    action: "cross_region.shifted_to_id",
    dealerId,
    entityType: "cross_region_transfer",
    entityId: id,
    summary: `[Dealer] CR ${id.slice(0, 8)} shifted to ID — stock added to inventory`,
  });
  revalidatePath("/dealer/cross-region");
  revalidatePath("/dealer/dashboard");
  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/purchases");

  // New inbound stock can change rebate eligibleQty — re-evaluate (fire-and-forget).
  if ("modelId" in result && "effectiveDate" in result && result.modelId && result.effectiveDate) {
    reEvaluateRebatesForDealer(
      OWNER_TENANT_ID, dealerId, result.modelId, result.effectiveDate, session.tenantId,
    ).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }

  return { ok: true };
}

export async function deleteDealerCrossRegionAction(id: string): Promise<void> {
  const session = await getDealerSession();
  if (!session) return;
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return;
  await deleteCrossRegion(id, session.tenantId, dealerId);
  await logAudit({
    action: "cross_region.delete",
    dealerId,
    summary: `[Dealer] CR deleted: ${id.slice(0, 8)}`,
  });
  revalidatePath("/dealer/cross-region");
  revalidatePath("/dealer/dashboard");
}

export type DealerOutwardState = { error?: string; ok?: boolean };

const DealerOutwardSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  quantity: z.coerce.number().int().positive("Enter the quantity caught"),
  fineAmount: z.coerce.number().min(0).optional(),
  caughtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional().nullable(),
});

/** Dealer reports stock that left their ID cross-region (outward / caught).
 *  Self-managed — deducts the stock from inventory immediately (no owner approval
 *  and no owner alert). Quantity must be > 0; guarded against over-deduction. */
export async function dealerCrOutwardAction(
  _prev: DealerOutwardState,
  fd: FormData,
): Promise<DealerOutwardState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = session.tenantId;

  const parsed = DealerOutwardSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, quantity, fineAmount, caughtDate, note } = parsed.data;

  const stock = await getMinForwardStock(tenantId, dealerId, modelId, caughtDate);
  if (stock < quantity) return { error: `Only ${stock} unit(s) in stock from ${caughtDate} onward` };

  // Prices are owner-configured (single source of truth) — snapshot from OWNER_TENANT_ID.
  const priceInfo = await getPriceOnDate(OWNER_TENANT_ID, modelId, caughtDate);
  const priceSnap = priceInfo?.dealerPrice ?? 0;

  const m = await getModelById(modelId);
  const id = await createCrCaught({
    tenantId,
    dealerId,
    modelId,
    quantity,
    fineAmount: fineAmount ?? 0,
    caughtDate,
    dealerPriceSnapshot: priceSnap,
    note: note ?? null,
    status: "active", // deducts stock immediately — no owner approval
    createdByUserId: session.userId,
  });

  await logAudit({
    action: "cr_caught.create",
    entityType: "cr_caught",
    entityId: id,
    dealerId,
    summary: `[Dealer] CR outward: ${quantity} × ${m?.name ?? "?"} on ${caughtDate} — stock deducted`,
  });

  revalidatePath("/dealer/cross-region");
  revalidatePath("/dealer/dashboard");
  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/purchases");

  // Stock dropped — re-evaluate rebate eligibility (fire-and-forget).
  reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, caughtDate, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));

  return { ok: true };
}

const DealerCashFineSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  fineAmount: z.coerce.number().positive("Fine amount must be > 0"),
  caughtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional().nullable(),
});

/** Dealer logs a pure cash fine (no stock movement) — mirrors the owner's
 *  inventory "Log fine" option. Recorded as a zero-quantity CR-caught so it only
 *  reduces this dealer's own net payout; directly active, dealer-scoped. */
export async function dealerCashFineAction(
  _prev: DealerOutwardState,
  fd: FormData,
): Promise<DealerOutwardState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = session.tenantId;

  const parsed = DealerCashFineSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, fineAmount, caughtDate, note } = parsed.data;

  const m = await getModelById(modelId);
  const id = await createCrCaught({
    tenantId,
    dealerId,
    modelId,
    quantity: 0,
    fineAmount,
    caughtDate,
    dealerPriceSnapshot: 0,
    note: note ?? null,
    status: "active",
    createdByUserId: session.userId,
  });

  await logAudit({
    action: "cr.cash_fine",
    entityType: "cr_caught",
    entityId: id,
    dealerId,
    summary: `[Dealer] Cash fine recorded: ${formatPKR(fineAmount)} for ${m?.name ?? "?"} on ${caughtDate}`,
  });

  revalidatePath("/dealer/cross-region");
  revalidatePath("/dealer/dashboard");
  return { ok: true };
}

/** Undo a CR-OUT entry — deletes it and restores the stock. Dealer-scoped. */
export async function dealerDeleteCrOutwardAction(id: string): Promise<{ error?: string }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = session.tenantId;

  const ref = await deleteCrCaught(id, tenantId, dealerId);
  if (!ref) return { error: "Entry not found" };

  await logAudit({
    action: "cr_caught.delete",
    entityType: "cr_caught",
    entityId: id,
    dealerId,
    summary: `[Dealer] CR outward undone ${id.slice(0, 8)} — stock restored`,
  });
  revalidatePath("/dealer/cross-region");
  revalidatePath("/dealer/dashboard");
  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/purchases");
  reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, ref.modelId, ref.caughtDate, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return {};
}
