"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { db } from "@/lib/db/client";
import { createPurchase, updatePurchase, deletePurchase, getPurchaseById, getStockForModel, getStockForModelAsOf, getNextBillNumber, listPurchaseBills } from "@/lib/db/queries/purchases";
import type { BillGroup } from "@/lib/purchases/purchase-stats";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { OWNER_ALERT_TYPE, PURCHASE_SOURCE, PURCHASE_REVIEW_STATUS, type PurchaseSource } from "@/lib/constants";
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

  // Purchase price is the owner's central price — the submitted price is ignored.
  const central = await getPriceOnDate(OWNER_TENANT_ID, data.modelId, data.purchaseDate);
  if (!central) return { error: "No price set for this model on that date — contact owner" };
  const unitDealerPrice = central.dealerPrice;
  const unitInvoicePrice = central.invoicePrice;

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
      unitDealerPrice,
      unitInvoicePrice,
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
      summary: `[Dealer] Purchased ${data.quantity} units @ ${formatPKR(unitDealerPrice)} (${data.source})`,
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
  invoiceNumber: z.string().max(100).nullish().transform((v) => v ?? ""),
  notes: z.string().max(500).nullish().transform((v) => v ?? ""),
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
      // Purchase price is the owner's central price — submitted per-line price is ignored.
      const central = await getPriceOnDate(OWNER_TENANT_ID, line.modelId, purchaseDate);
      if (!central) throw new Error(`No price set for a model on ${purchaseDate} — contact owner`);
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
        unitDealerPrice: central.dealerPrice,
        unitInvoicePrice: central.invoicePrice,
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

/**
 * Delete an entire invoice (all lines sharing a billNumber) in one go.
 * All-or-nothing: any line with stock already activated/transferred blocks the
 * whole delete (the throw rolls back the txn) — nothing is removed.
 */
export async function deleteDealerInvoiceAction(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  if (!ids.length) return { error: "No invoice lines to delete" };

  const deletedPurchases: { modelId: string; purchaseDate: string }[] = [];
  try {
    await db.transaction(async (tx) => {
      for (const id of ids) {
        const purchase = await getPurchaseById(id, dealerId, session.tenantId);
        if (!purchase) continue;
        const stock = await getStockForModel(session.tenantId, dealerId, purchase.modelId, tx);
        if (stock < purchase.quantity) {
          const m = await getModelById(purchase.modelId);
          throw new Error(`Cannot delete invoice — ${purchase.quantity - stock} unit(s) of ${m?.name ?? "a model"} already activated or transferred out`);
        }
        await deletePurchase(id, dealerId, session.tenantId, tx);
        deletedPurchases.push({ modelId: purchase.modelId, purchaseDate: purchase.purchaseDate });
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete invoice" };
  }

  await logAudit({
    action: "purchase.invoice_delete",
    dealerId,
    summary: `[Dealer] Deleted entire invoice: ${deletedPurchases.length} line(s)`,
    payload: { ids },
  });
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/dashboard");
  const byModel = new Map<string, string>();
  for (const { modelId, purchaseDate } of deletedPurchases) {
    const existing = byModel.get(modelId);
    if (!existing || purchaseDate < existing) byModel.set(modelId, purchaseDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate, session.tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { deleted: deletedPurchases.length };
}

/**
 * Move an entire invoice (all lines sharing a billNumber) to a new date in one go.
 * Atomic + all-or-nothing. Same forward-move guard as per-line edits (aggregated
 * per model). Each line is re-priced to the owner's central price for the new date.
 */
export async function updateDealerInvoiceDateAction(ids: string[], newDate: string): Promise<{ error?: string; updated?: number }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  if (!ids.length) return { error: "No invoice lines to edit" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { error: "Invalid date" };
  const tenant = await getTenantById(session.tenantId);
  const dateErr = guardPurchaseDate(newDate, tenant?.backdateDays ?? 3);
  if (dateErr) return { error: dateErr };

  const affected: { modelId: string; from: string }[] = [];
  try {
    await db.transaction(async (tx) => {
      const lines = [];
      for (const id of ids) {
        const p = await getPurchaseById(id, dealerId, session.tenantId);
        if (p) lines.push(p);
      }
      const forwardQtyByModel = new Map<string, number>();
      for (const p of lines) {
        if (newDate > p.purchaseDate) forwardQtyByModel.set(p.modelId, (forwardQtyByModel.get(p.modelId) ?? 0) + p.quantity);
      }
      for (const [modelId, qty] of forwardQtyByModel) {
        const stockAtNewDate = await getStockForModelAsOf(session.tenantId, dealerId, modelId, newDate, tx);
        if (stockAtNewDate - qty < 0) {
          const m = await getModelById(modelId);
          throw new Error(`Cannot move invoice to ${newDate} — activations for ${m?.name ?? "a model"} would become unbacked`);
        }
      }
      for (const p of lines) {
        const central = await getPriceOnDate(OWNER_TENANT_ID, p.modelId, newDate);
        if (!central) {
          const m = await getModelById(p.modelId);
          throw new Error(`No price set for ${m?.name ?? "a model"} on ${newDate} — contact owner`);
        }
        await updatePurchase(p.id, dealerId, session.tenantId, {
          quantity: p.quantity,
          unitDealerPrice: central.dealerPrice,
          unitInvoicePrice: central.invoicePrice,
          purchaseDate: newDate,
          source: p.source as PurchaseSource,
        }, tx);
        affected.push({ modelId: p.modelId, from: p.purchaseDate });
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to edit invoice" };
  }

  await logAudit({
    action: "purchase.invoice_edit",
    dealerId,
    summary: `[Dealer] Moved invoice (${affected.length} line(s)) to ${newDate}`,
    payload: { ids, newDate },
  });
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/dashboard");
  const byModel = new Map<string, string>();
  for (const a of affected) {
    const earliest = a.from < newDate ? a.from : newDate;
    const cur = byModel.get(a.modelId);
    if (!cur || earliest < cur) byModel.set(a.modelId, earliest);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate, session.tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { updated: affected.length };
}

const EditPurchaseSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  unitDealerPrice: z.coerce.number().nonnegative(),
  unitInvoicePrice: z.coerce.number().nonnegative(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional(),
});

/** Edit a single purchase line (qty + date). Price stays the owner's central
 *  price for the effective date; source is unchanged. */
export async function editDealerPurchaseAction(input: {
  id: string; quantity: number; unitDealerPrice: number; unitInvoicePrice: number; purchaseDate?: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = EditPurchaseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, quantity } = parsed.data;

  const purchase = await getPurchaseById(id, dealerId, session.tenantId);
  if (!purchase) return { error: "Purchase not found" };

  const newDate = parsed.data.purchaseDate ?? purchase.purchaseDate;
  if (newDate !== purchase.purchaseDate) {
    const tenant = await getTenantById(session.tenantId);
    const dateErr = guardPurchaseDate(newDate, tenant?.backdateDays ?? 3);
    if (dateErr) return { error: dateErr };
    // Moving the date forward must not leave activations in the gap unbacked.
    if (newDate > purchase.purchaseDate) {
      const stockAtNewDate = await getStockForModelAsOf(session.tenantId, dealerId, purchase.modelId, newDate);
      if (stockAtNewDate - purchase.quantity < 0) {
        const m = await getModelById(purchase.modelId);
        return { error: `Cannot move date forward — activations between ${purchase.purchaseDate} and ${newDate} would become unbacked for ${m?.name ?? "this model"}` };
      }
    }
  }

  // Purchase price is the owner's central price for the effective date — submitted price is ignored.
  const central = await getPriceOnDate(OWNER_TENANT_ID, purchase.modelId, newDate);
  if (!central) return { error: "No price set for this model on that date — contact owner" };
  const unitDealerPrice = central.dealerPrice;
  const unitInvoicePrice = central.invoicePrice;

  // Reducing quantity: make sure enough free stock exists to remove the difference.
  if (quantity < purchase.quantity) {
    const stock = await getStockForModel(session.tenantId, dealerId, purchase.modelId);
    const reduceBy = purchase.quantity - quantity;
    if (stock < reduceBy) {
      const m = await getModelById(purchase.modelId);
      return { error: `Cannot reduce by ${reduceBy} — only ${stock} free unit(s) of ${m?.name ?? "this model"} (rest already activated/transferred).` };
    }
  }

  await updatePurchase(id, dealerId, session.tenantId, {
    quantity,
    unitDealerPrice,
    unitInvoicePrice,
    purchaseDate: newDate,
    source: purchase.source as PurchaseSource,
  });

  await logAudit({
    action: "purchase.edit",
    entityType: "purchase",
    entityId: id,
    dealerId,
    summary: `[Dealer] Edited purchase ${id.slice(0, 8)}: qty ${purchase.quantity}→${quantity}, date ${purchase.purchaseDate}→${newDate} @ ${formatPKR(unitDealerPrice)}`,
  });
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/dashboard");
  const triggerDate = newDate < purchase.purchaseDate ? newDate : purchase.purchaseDate;
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, purchase.modelId, triggerDate, session.tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
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
