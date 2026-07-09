"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { createPurchase, deletePurchase, getPurchaseById, getStockForModel, getNextBillNumber, listPurchaseBills } from "@/lib/db/queries/purchases";
import type { BillGroup } from "@/lib/purchases/purchase-stats";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { OWNER_ALERT_TYPE, PURCHASE_SOURCE, PURCHASE_REVIEW_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";
import { getTenantById } from "@/lib/dealer-tenant";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { guardPurchaseDate } from "@/lib/date-guards";

export type PurchaseFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
};

const PurchaseSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  unitDealerPrice: z.coerce.number().nonnegative(),
  unitInvoicePrice: z.coerce.number().nonnegative(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  source: z.enum([PURCHASE_SOURCE.REGULAR, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN]),
  referenceNote: z.string().max(500).optional().nullable(),
});

export async function createDealerPurchaseAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID — create one in IDs first" };
  const tenant = await getTenantById(session.tenantId);

  const parsed = PurchaseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join(".") || "_", i.message]),
      ),
    };
  }
  const data = parsed.data;

  const dateErr = guardPurchaseDate(data.purchaseDate, tenant?.backdateDays ?? 3);
  if (dateErr) return { error: dateErr };

  // CR-2: flag large purchases for owner review
  const reviewStatus =
    tenant?.purchaseApprovalThreshold != null && data.quantity >= tenant.purchaseApprovalThreshold
      ? PURCHASE_REVIEW_STATUS.PENDING_REVIEW
      : PURCHASE_REVIEW_STATUS.ACTIVE;

  try {
    const id = await createPurchase({
      tenantId: session.tenantId,
      dealerId,
      modelId: data.modelId,
      quantity: data.quantity,
      unitDealerPrice: data.unitDealerPrice,
      unitInvoicePrice: data.unitInvoicePrice,
      purchaseDate: data.purchaseDate,
      source: data.source,
      referenceNote: data.referenceNote ?? null,
      reviewStatus,
    });

    if (reviewStatus === PURCHASE_REVIEW_STATUS.PENDING_REVIEW) {
      await createOwnerAlert({
        tenantId: session.tenantId,
        type: OWNER_ALERT_TYPE.PURCHASE_PENDING_REVIEW,
        entityType: "purchase",
        entityId: id,
        dealerId,
        message: `[HIGH ALERT] Purchase of ${data.quantity} units flagged for owner review (exceeds approval threshold)`,
      });
    }

    await logAudit({
      action: "purchase.create",
      entityType: "purchase",
      entityId: id,
      dealerId,
      summary: `[Dealer] Purchased ${data.quantity} units @ ${formatPKR(data.unitDealerPrice)} (${data.source})`,
      payload: { modelId: data.modelId, quantity: data.quantity, source: data.source, purchaseDate: data.purchaseDate },
    });

    revalidatePath("/dealer/purchases");
    revalidatePath("/dealer/dashboard");
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, data.modelId, data.purchaseDate, session.tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create purchase";
    await logAudit({ action: "purchase.create", status: "error", dealerId, summary: `[Dealer] Purchase failed: ${msg}` });
    return { error: msg };
  }
}

export async function getPriceOnDateForDealer(modelId: string, date: string): Promise<{ dealerPrice: number; invoicePrice: number } | null> {
  const session = await getDealerSession();
  if (!session || !modelId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return getPriceOnDate(OWNER_TENANT_ID, modelId, date);
}

export type BulkInvoiceState = { error?: string; ok?: boolean; inserted?: number };

const BulkLineSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitDealerPrice: z.coerce.number().nonnegative(),
  unitInvoicePrice: z.coerce.number().nonnegative(),
});

const BulkInvoiceSchema = z.object({
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  source: z.enum([PURCHASE_SOURCE.REGULAR, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN]),
  invoiceNumber: z.string().max(100).optional().default(""),
  notes: z.string().max(500).optional().default(""),
  lines: z.array(BulkLineSchema).min(1, "Add at least one line"),
});

export async function createDealerBulkPurchasesAction(
  _prev: BulkInvoiceState,
  formData: FormData,
): Promise<BulkInvoiceState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenant = await getTenantById(session.tenantId);

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Malformed bulk invoice payload" };
  }

  const parsed = BulkInvoiceSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { purchaseDate, source, invoiceNumber, notes, lines } = parsed.data;

  const bulkDateErr = guardPurchaseDate(purchaseDate, tenant?.backdateDays ?? 3);
  if (bulkDateErr) return { error: bulkDateErr };

  const billNumber = await getNextBillNumber(session.tenantId, dealerId, purchaseDate);
  let inserted = 0;
  try {
    for (const line of lines) {
      const ref = notes ? `Inv #${invoiceNumber} — ${notes}` : `Inv #${invoiceNumber}`;
      // CR-2: flag lines exceeding approval threshold
      const reviewStatus =
        tenant?.purchaseApprovalThreshold != null && line.quantity >= tenant.purchaseApprovalThreshold
          ? PURCHASE_REVIEW_STATUS.PENDING_REVIEW
          : PURCHASE_REVIEW_STATUS.ACTIVE;
      const purchaseId = await createPurchase({
        tenantId: session.tenantId,
        dealerId,
        modelId: line.modelId,
        quantity: line.quantity,
        unitDealerPrice: line.unitDealerPrice,
        unitInvoicePrice: line.unitInvoicePrice,
        purchaseDate,
        source,
        referenceNote: ref,
        billNumber,
        reviewStatus,
      });
      if (reviewStatus === PURCHASE_REVIEW_STATUS.PENDING_REVIEW) {
        await createOwnerAlert({
          tenantId: session.tenantId,
          type: OWNER_ALERT_TYPE.PURCHASE_PENDING_REVIEW,
          entityType: "purchase",
          entityId: purchaseId,
          dealerId,
          message: `[HIGH ALERT] Bulk invoice line of ${line.quantity} units flagged for owner review`,
        });
      }
      inserted++;
    }
    await logAudit({
      action: "purchase.bulk_invoice",
      dealerId,
      summary: `[Dealer] Invoice ${invoiceNumber}: ${inserted} line(s) on ${purchaseDate}`,
      payload: { invoiceNumber, purchaseDate, source, lineCount: inserted },
    });
    revalidatePath("/dealer/purchases");
    revalidatePath("/dealer/dashboard");
    const uniqueModels = [...new Set(lines.map((l) => l.modelId))];
    for (const modelId of uniqueModels) {
      await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, purchaseDate, session.tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
    }
    return { ok: true, inserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record invoice";
    return { error: msg };
  }
}

export async function deleteDealerPurchaseAction(id: string): Promise<{ error?: string }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const purchase = await getPurchaseById(id, dealerId, session.tenantId);
  if (!purchase) return { error: "Purchase not found" };

  const stock = await getStockForModel(session.tenantId, dealerId, purchase.modelId);
  if (stock < purchase.quantity) {
    const m = await getModelById(purchase.modelId);
    const consumed = purchase.quantity - stock;
    return { error: `Cannot delete — ${consumed} of ${purchase.quantity} unit(s) of ${m?.name ?? "this model"} have already been activated or transferred out` };
  }

  await deletePurchase(id, dealerId, session.tenantId);
  await logAudit({
    action: "purchase.delete",
    entityType: "purchase",
    entityId: id,
    dealerId,
    summary: `[Dealer] Deleted purchase ${id.slice(0, 8)}`,
  });
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/dashboard");
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, purchase.modelId, purchase.purchaseDate, session.tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return {};
}

export async function loadDealerPurchaseBillsAction(params: {
  modelId?: string;
  source?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}): Promise<BillGroup[]> {
  const session = await getDealerSession();
  if (!session) return [];
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return [];
  const source =
    params.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN
      ? PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN
      : PURCHASE_SOURCE.REGULAR;
  const { bills } = await listPurchaseBills({
    tenantId: session.tenantId,
    dealerId,
    modelId: params.modelId || undefined,
    source,
    from: params.from || undefined,
    to: params.to || undefined,
    page: Math.max(1, params.page),
    pageSize: params.pageSize,
  });
  return bills;
}
