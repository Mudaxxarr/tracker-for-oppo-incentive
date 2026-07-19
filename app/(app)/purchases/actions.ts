"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { db } from "@/lib/db/client";
import { createPurchase, deletePurchase, getPurchaseById, updatePurchase, getStockForModel, getStockForModelAsOf, getNextBillNumber, listPurchaseBills } from "@/lib/db/queries/purchases";
import type { BillGroup } from "@/lib/purchases/purchase-stats";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { drainRebateJobs } from "@/lib/db/queries/rebate-jobs";
import { getModelById, getPriceOnDate, updateModelPrice } from "@/lib/db/queries/models";
import { PURCHASE_SOURCE, PURCHASE_REVIEW_STATUS, OWNER_ALERT_TYPE, type PurchaseSource } from "@/lib/constants";
import { getTenantById } from "@/lib/dealer-tenant";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";
import { guardPurchaseDate } from "@/lib/date-guards";

const PurchaseSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  unitDealerPrice: z.coerce.number().nonnegative(),
  unitInvoicePrice: z.coerce.number().nonnegative(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  source: z.enum([PURCHASE_SOURCE.REGULAR, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN]),
  referenceNote: z.string().max(500).optional().nullable(),
  updateMasterPrice: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
});

export type PurchaseFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
};

export async function createPurchaseAction(
  _prev: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID — create one in IDs first" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = PurchaseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    await logAudit({
      action: "purchase.create",
      status: "error",
      summary: `Purchase rejected: ${parsed.error.issues[0].message}`,
    });
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join(".") || "_", i.message])
      ),
    };
  }
  const data = parsed.data;
  const dateErr = guardPurchaseDate(data.purchaseDate);
  if (dateErr) return { error: dateErr };

  const updateMaster =
    data.updateMasterPrice === "on" || data.updateMasterPrice === "true";

  // #8: non-owner (team/staff) large purchases need owner approval before they
  // count toward stock/incentives. Owner's own purchases are active immediately.
  const isOwner = await isAuthenticated();
  const tenant = await getTenantById(OWNER_TENANT_ID);
  const reviewStatus =
    !isOwner && tenant?.purchaseApprovalThreshold != null && data.quantity >= tenant.purchaseApprovalThreshold
      ? PURCHASE_REVIEW_STATUS.PENDING_REVIEW
      : PURCHASE_REVIEW_STATUS.ACTIVE;

  try {
    const id = await createPurchase({
      tenantId,
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
        tenantId,
        type: OWNER_ALERT_TYPE.PURCHASE_PENDING_REVIEW,
        entityType: "purchase",
        entityId: id,
        dealerId,
        message: `[HIGH ALERT] Purchase of ${data.quantity} units flagged for owner review (exceeds approval threshold)`,
      });
    }

    if (updateMaster) {
      const today = new Date().toISOString().slice(0, 10);
      const current = await getPriceOnDate(tenantId, data.modelId, today);
      if (
        !current ||
        current.dealerPrice !== data.unitDealerPrice ||
        current.invoicePrice !== data.unitInvoicePrice
      ) {
        await updateModelPrice(tenantId, {
          modelId: data.modelId,
          dealerPrice: data.unitDealerPrice,
          invoicePrice: data.unitInvoicePrice,
          effectiveFrom: today,
        });
        after(() => drainRebateJobs().catch((e) => console.error("[reprice-drain]", e)));
        await logAudit({
          action: "model.price_update",
          entityType: "model",
          entityId: data.modelId,
          summary: `Updated master dealer price to ${formatPKR(data.unitDealerPrice)}`,
          payload: { dealerPrice: data.unitDealerPrice, invoicePrice: data.unitInvoicePrice },
        });
      }
    }

    const m = await getModelById(data.modelId);
    await logAudit({
      action: "purchase.create",
      entityType: "purchase",
      entityId: id,
      summary: `Purchased ${data.quantity} × ${m?.name ?? "?"} @ ${formatPKR(data.unitDealerPrice)} (${data.source})`,
      payload: {
        modelId: data.modelId,
        quantity: data.quantity,
        unitDealerPrice: data.unitDealerPrice,
        source: data.source,
        purchaseDate: data.purchaseDate,
      },
    });

    revalidatePath("/purchases");
    revalidatePath("/dashboard");
    await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, data.purchaseDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create purchase";
    await logAudit({
      action: "purchase.create",
      status: "error",
      summary: `Purchase create failed: ${msg}`,
    });
    return { error: msg };
  }
}

export async function loadPurchaseBillsAction(params: {
  modelId?: string;
  source?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}): Promise<BillGroup[]> {
  if (!(await isAnyAuthenticated())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];
  // Source is always Regular on this page (no cross-region in the timeline).
  const source =
    params.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN
      ? PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN
      : PURCHASE_SOURCE.REGULAR;
  const { bills } = await listPurchaseBills({
    tenantId: OWNER_TENANT_ID,
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

export async function getPriceOnDateAction(
  modelId: string,
  date: string
): Promise<{ dealerPrice: number; invoicePrice: number } | null> {
  if (!(await isAnyAuthenticated())) return null;
  if (!modelId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return getPriceOnDate(OWNER_TENANT_ID, modelId, date);
}

const BulkLineSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitDealerPrice: z.coerce.number().nonnegative(),
  unitInvoicePrice: z.coerce.number().nonnegative(),
});

const BulkInvoiceSchema = z.object({
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  source: z.enum([PURCHASE_SOURCE.REGULAR, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN]),
  invoiceNumber: z.string().trim().max(120).optional().default(""),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(BulkLineSchema).min(1, "Add at least one line"),
});

export type BulkInvoiceState = {
  error?: string;
  ok?: boolean;
  inserted?: number;
};

export async function createBulkInvoiceAction(
  _prev: BulkInvoiceState,
  formData: FormData
): Promise<BulkInvoiceState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Malformed bulk invoice payload" };
  }
  const parsed = BulkInvoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { purchaseDate, source, invoiceNumber, notes, lines } = parsed.data;
  const bulkDateErr = guardPurchaseDate(purchaseDate);
  if (bulkDateErr) return { error: bulkDateErr };

  // #8: non-owner large lines need owner approval before counting.
  const isOwner = await isAuthenticated();
  const tenant = await getTenantById(OWNER_TENANT_ID);
  const threshold = !isOwner && tenant?.purchaseApprovalThreshold != null ? tenant.purchaseApprovalThreshold : null;

  let inserted = 0;
  const pendingAlerts: { id: string; quantity: number }[] = [];
  try {
    // All-or-nothing: a failed line must not leave a half-recorded invoice.
    await db.transaction(async (tx) => {
      const billNumber = await getNextBillNumber(tenantId, dealerId, purchaseDate, tx);
      for (const line of lines) {
        const ref = [invoiceNumber ? `Inv #${invoiceNumber}` : null, notes || null].filter(Boolean).join(" — ") || null;
        const isPending = threshold != null && line.quantity >= threshold;
        const id = await createPurchase({
          tenantId,
          dealerId,
          modelId: line.modelId,
          quantity: line.quantity,
          unitDealerPrice: line.unitDealerPrice,
          unitInvoicePrice: line.unitInvoicePrice,
          purchaseDate,
          source,
          referenceNote: ref,
          billNumber,
          reviewStatus: isPending ? PURCHASE_REVIEW_STATUS.PENDING_REVIEW : PURCHASE_REVIEW_STATUS.ACTIVE,
        }, tx);
        if (isPending) pendingAlerts.push({ id, quantity: line.quantity });
        inserted += 1;
      }
    });
    for (const pa of pendingAlerts) {
      await createOwnerAlert({
        tenantId,
        type: OWNER_ALERT_TYPE.PURCHASE_PENDING_REVIEW,
        entityType: "purchase",
        entityId: pa.id,
        dealerId,
        message: `[HIGH ALERT] Purchase of ${pa.quantity} units flagged for owner review (exceeds approval threshold)`,
      });
    }
    await logAudit({
      action: "purchase.bulk_invoice",
      summary: `Recorded bulk invoice${invoiceNumber ? ` ${invoiceNumber}` : ""}: ${inserted} line(s) on ${purchaseDate}`,
      payload: { invoiceNumber, purchaseDate, source, lineCount: inserted },
    });
    revalidatePath("/purchases");
    revalidatePath("/dashboard");
    const uniqueModels = [...new Set(lines.map((l) => l.modelId))];
    for (const modelId of uniqueModels) {
      await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, purchaseDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    }
    return { ok: true, inserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record invoice";
    await logAudit({
      action: "purchase.bulk_invoice",
      status: "error",
      summary: `Bulk invoice failed: ${msg}`,
    });
    return { error: msg };
  }
}

const UpdatePurchaseSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  unitDealerPrice: z.coerce.number().nonnegative(),
  unitInvoicePrice: z.coerce.number().nonnegative(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  source: z.enum([PURCHASE_SOURCE.REGULAR, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN]),
});

export async function updatePurchaseAction(
  _prev: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = UpdatePurchaseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await getPurchaseById(data.id, dealerId, OWNER_TENANT_ID);
  if (!existing) return { error: "Purchase not found" };

  const updateDateErr = guardPurchaseDate(data.purchaseDate);
  if (updateDateErr) return { error: updateDateErr };

  // S-2: quantity reduced — check the reduction doesn't push stock negative
  if (data.quantity < existing.quantity) {
    const reduction = existing.quantity - data.quantity;
    const stock = await getStockForModel(OWNER_TENANT_ID, dealerId, existing.modelId);
    if (stock < reduction) {
      const m = await getModelById(existing.modelId);
      return { error: `Cannot reduce quantity by ${reduction} — only ${stock} unit(s) of ${m?.name ?? "this model"} remain in stock` };
    }
  }

  // S-3: date moved forward — check no activation in the gap becomes unbacked
  if (data.purchaseDate > existing.purchaseDate) {
    const stockAtNewDate = await getStockForModelAsOf(OWNER_TENANT_ID, dealerId, existing.modelId, data.purchaseDate);
    // After move, stock between old and new date drops by purchase.quantity
    if (stockAtNewDate - existing.quantity < 0) {
      const m = await getModelById(existing.modelId);
      return { error: `Cannot move purchase date forward — activations between ${existing.purchaseDate} and ${data.purchaseDate} would become unbacked for ${m?.name ?? "this model"}` };
    }
  }

  try {
    await updatePurchase(data.id, dealerId, OWNER_TENANT_ID, {
      quantity: data.quantity,
      unitDealerPrice: data.unitDealerPrice,
      unitInvoicePrice: data.unitInvoicePrice,
      purchaseDate: data.purchaseDate,
      source: data.source,
    });
    await logAudit({
      action: "purchase.update",
      entityType: "purchase",
      entityId: data.id,
      summary: `Updated purchase ${data.id.slice(0, 8)}: qty=${data.quantity}, ${formatPKR(data.unitDealerPrice)}, date=${data.purchaseDate}`,
    });
    const triggerDate = data.purchaseDate < existing.purchaseDate ? data.purchaseDate : existing.purchaseDate;
    revalidatePath("/purchases");
    revalidatePath("/dashboard");
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, existing.modelId, triggerDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update purchase";
    return { error: msg };
  }
}

export async function bulkDeletePurchasesAction(ids: string[]): Promise<{ deleted: number; blocked?: string[] }> {
  if (!(await isAuthenticated())) return { deleted: 0 };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { deleted: 0 };
  let deleted = 0;
  const blocked: string[] = [];
  const deletedPurchases: { modelId: string; purchaseDate: string }[] = [];
  await db.transaction(async (tx) => {
    for (const id of ids) {
      const purchase = await getPurchaseById(id, dealerId, OWNER_TENANT_ID);
      if (!purchase) continue;
      const stock = await getStockForModel(OWNER_TENANT_ID, dealerId, purchase.modelId, tx);
      if (stock < purchase.quantity) {
        blocked.push(id);
        continue;
      }
      await deletePurchase(id, dealerId, OWNER_TENANT_ID, tx);
      deletedPurchases.push({ modelId: purchase.modelId, purchaseDate: purchase.purchaseDate });
      deleted++;
    }
  });
  if (blocked.length > 0) {
    await logAudit({
      action: "purchase.bulk_delete",
      status: "error",
      summary: `Bulk delete: ${deleted} deleted, ${blocked.length} blocked (consumed stock)`,
      payload: { ids, blocked },
    });
    return { deleted, blocked };
  }
  await logAudit({
    action: "purchase.bulk_delete",
    summary: `Bulk deleted ${deleted} purchase(s)`,
    payload: { ids },
  });
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  // Fire rebate re-eval at the earliest date per model
  const byModel = new Map<string, string>();
  for (const { modelId, purchaseDate } of deletedPurchases) {
    const existing = byModel.get(modelId);
    if (!existing || purchaseDate < existing) byModel.set(modelId, purchaseDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { deleted };
}

/**
 * Delete an entire invoice (all purchase lines sharing a billNumber) in one go.
 * All-or-nothing: if ANY line's stock is already activated/transferred out, the
 * whole delete is blocked and nothing is removed (the throw rolls back the txn).
 */
export async function deleteInvoiceAction(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  if (!ids.length) return { error: "No invoice lines to delete" };

  const deletedPurchases: { modelId: string; purchaseDate: string }[] = [];
  try {
    await db.transaction(async (tx) => {
      for (const id of ids) {
        const purchase = await getPurchaseById(id, dealerId, OWNER_TENANT_ID);
        if (!purchase) continue;
        // Cumulative within the txn: each delete lowers stock, so the guard sees
        // prior deletes of the same model in this invoice.
        const stock = await getStockForModel(OWNER_TENANT_ID, dealerId, purchase.modelId, tx);
        if (stock < purchase.quantity) {
          const m = await getModelById(purchase.modelId);
          throw new Error(`Cannot delete invoice — ${purchase.quantity - stock} unit(s) of ${m?.name ?? "a model"} already activated or transferred out`);
        }
        await deletePurchase(id, dealerId, OWNER_TENANT_ID, tx);
        deletedPurchases.push({ modelId: purchase.modelId, purchaseDate: purchase.purchaseDate });
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete invoice" };
  }

  await logAudit({
    action: "purchase.invoice_delete",
    summary: `Deleted entire invoice: ${deletedPurchases.length} line(s)`,
    payload: { ids },
  });
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  const byModel = new Map<string, string>();
  for (const { modelId, purchaseDate } of deletedPurchases) {
    const existing = byModel.get(modelId);
    if (!existing || purchaseDate < existing) byModel.set(modelId, purchaseDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { deleted: deletedPurchases.length };
}

/**
 * Move an entire invoice (all lines sharing a billNumber) to a new date in one go.
 * Atomic + all-or-nothing: the same forward-move guard as per-line edits, but
 * aggregated per model (all lines shift together), and rolled back on any conflict.
 * Quantities, prices and source are preserved — only the date changes.
 */
export async function updateInvoiceDateAction(ids: string[], newDate: string): Promise<{ error?: string; updated?: number }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  if (!ids.length) return { error: "No invoice lines to edit" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { error: "Invalid date" };
  const dateErr = guardPurchaseDate(newDate);
  if (dateErr) return { error: dateErr };

  const affected: { modelId: string; from: string }[] = [];
  try {
    await db.transaction(async (tx) => {
      const lines = [];
      for (const id of ids) {
        const p = await getPurchaseById(id, dealerId, OWNER_TENANT_ID);
        if (p) lines.push(p);
      }
      // Forward-move guard, aggregated per model: moving all lines to a later date
      // must not strand activations that fell between the old and new date.
      const forwardQtyByModel = new Map<string, number>();
      for (const p of lines) {
        if (newDate > p.purchaseDate) forwardQtyByModel.set(p.modelId, (forwardQtyByModel.get(p.modelId) ?? 0) + p.quantity);
      }
      for (const [modelId, qty] of forwardQtyByModel) {
        const stockAtNewDate = await getStockForModelAsOf(OWNER_TENANT_ID, dealerId, modelId, newDate, tx);
        if (stockAtNewDate - qty < 0) {
          const m = await getModelById(modelId);
          throw new Error(`Cannot move invoice to ${newDate} — activations for ${m?.name ?? "a model"} would become unbacked`);
        }
      }
      for (const p of lines) {
        await updatePurchase(p.id, dealerId, OWNER_TENANT_ID, {
          quantity: p.quantity,
          unitDealerPrice: p.unitDealerPrice,
          unitInvoicePrice: p.unitInvoicePrice,
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
    summary: `Moved invoice (${affected.length} line(s)) to ${newDate}`,
    payload: { ids, newDate },
  });
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  const byModel = new Map<string, string>();
  for (const a of affected) {
    const earliest = a.from < newDate ? a.from : newDate;
    const cur = byModel.get(a.modelId);
    if (!cur || earliest < cur) byModel.set(a.modelId, earliest);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { updated: affected.length };
}

export async function deletePurchaseAction(id: string): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const purchase = await getPurchaseById(id, dealerId, OWNER_TENANT_ID);
  if (!purchase) return { error: "Purchase not found" };
  const stock = await getStockForModel(OWNER_TENANT_ID, dealerId, purchase.modelId);
  if (stock < purchase.quantity) {
    const m = await getModelById(purchase.modelId);
    const consumed = purchase.quantity - stock;
    return { error: `Cannot delete — ${consumed} of ${purchase.quantity} unit(s) of ${m?.name ?? "this model"} have already been activated or transferred out` };
  }
  await deletePurchase(id, dealerId, OWNER_TENANT_ID);
  await logAudit({
    action: "purchase.delete",
    entityType: "purchase",
    entityId: id,
    summary: `Deleted purchase ${id.slice(0, 8)}`,
  });
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, purchase.modelId, purchase.purchaseDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return {};
}
