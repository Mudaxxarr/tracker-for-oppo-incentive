import "server-only";
import { revalidateTag } from "next/cache";
import { db, schema } from "../client";
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { reEvaluateRebatesForDealer } from "./rebates";
import { enqueueRebateJob } from "./rebate-jobs";
import { createOwnerAlert } from "./alerts";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { OWNER_ALERT_TYPE } from "@/lib/constants";

export interface ModelWithCurrentPrice {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  dealerPrice: number | null;
  invoicePrice: number | null;
  lowStockThreshold: number | null;
}

export async function listModelsWithCurrentPrice(tenantId: string): Promise<ModelWithCurrentPrice[]> {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      sku: schema.models.sku,
      isActive: schema.models.isActive,
      lowStockThreshold: schema.models.lowStockThreshold,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      invoicePrice: schema.modelPriceHistory.invoicePrice,
    })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, today))
      )
    )
    .orderBy(asc(schema.models.name));
}

export async function getModelById(id: string) {
  const rows = await db.select().from(schema.models).where(eq(schema.models.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getModelsWithThreshold(): Promise<{ id: string; name: string; lowStockThreshold: number }[]> {
  const rows = await db
    .select({ id: schema.models.id, name: schema.models.name, lowStockThreshold: schema.models.lowStockThreshold })
    .from(schema.models)
    .where(eq(schema.models.isActive, true));
  return rows
    .filter((r) => r.lowStockThreshold != null)
    .map((r) => ({ id: r.id, name: r.name, lowStockThreshold: r.lowStockThreshold! }));
}

export async function setModelLowStockThreshold(id: string, threshold: number | null): Promise<void> {
  await db.update(schema.models).set({ lowStockThreshold: threshold }).where(eq(schema.models.id, id));
}

export async function getPriceOnDate(
  tenantId: string,
  modelId: string,
  date: string
): Promise<{ dealerPrice: number; invoicePrice: number } | null> {
  const rows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, modelId),
        lte(schema.modelPriceHistory.effectiveFrom, date),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, date))
      )
    )
    .orderBy(desc(schema.modelPriceHistory.effectiveFrom))
    .limit(1);
  if (rows.length === 0) return null;
  return { dealerPrice: rows[0].dealerPrice, invoicePrice: rows[0].invoicePrice };
}

export async function listPriceHistory(tenantId: string, modelId: string) {
  return db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, tenantId), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(desc(schema.modelPriceHistory.effectiveFrom));
}

export async function createModel(
  tenantId: string,
  input: { name: string; sku: string | null; dealerPrice: number; invoicePrice: number; effectiveFrom?: string }
): Promise<string> {
  const modelId = randomUUID();
  const today = input.effectiveFrom ?? new Date().toISOString().slice(0, 10);
  await db.insert(schema.models).values({ id: modelId, name: input.name, sku: input.sku, isActive: true });
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(),
    tenantId,
    modelId,
    dealerPrice: input.dealerPrice,
    invoicePrice: input.invoicePrice,
    effectiveFrom: today,
    effectiveTo: null,
  });
  revalidateTag("models", {});
  return modelId;
}

export async function updateModelPrice(
  tenantId: string,
  input: { modelId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string }
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.modelPriceHistory)
      .set({ effectiveTo: input.effectiveFrom })
      .where(
        and(
          eq(schema.modelPriceHistory.tenantId, tenantId),
          eq(schema.modelPriceHistory.modelId, input.modelId),
          isNull(schema.modelPriceHistory.effectiveTo)
        )
      );
    const newHistoryId = randomUUID();
    await tx.insert(schema.modelPriceHistory).values({
      id: newHistoryId,
      tenantId,
      modelId: input.modelId,
      dealerPrice: input.dealerPrice,
      invoicePrice: input.invoicePrice,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
    });
  });

  await reAdjustAllDealersForPriceChange(input.modelId, input.effectiveFrom);
}

async function restitchPriceHistory(tenantId: string, modelId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.modelPriceHistory)
      .where(and(eq(schema.modelPriceHistory.tenantId, tenantId), eq(schema.modelPriceHistory.modelId, modelId)))
      .orderBy(asc(schema.modelPriceHistory.effectiveFrom));
    for (let i = 0; i < rows.length; i++) {
      const next = rows[i + 1];
      const targetEffectiveTo = next ? next.effectiveFrom : null;
      if (rows[i].effectiveTo !== targetEffectiveTo) {
        await tx
          .update(schema.modelPriceHistory)
          .set({ effectiveTo: targetEffectiveTo })
          .where(eq(schema.modelPriceHistory.id, rows[i].id));
      }
    }
  });
}

/**
 * After any price history change, update every activation's dealerPriceSnapshot
 * to match the price that was effective on its activationDate.
 * Only touches activations that fall within a known price window — activations
 * outside any price window are left unchanged.
 */
async function syncActivationSnapshots(tenantId: string, modelId: string): Promise<void> {
  const priceHistory = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, tenantId), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  for (const price of priceHistory) {
    const baseCondition = and(
      eq(schema.activations.tenantId, tenantId),
      eq(schema.activations.modelId, modelId),
      gte(schema.activations.activationDate, price.effectiveFrom)
    );
    const condition =
      price.effectiveTo !== null
        ? and(baseCondition, lt(schema.activations.activationDate, price.effectiveTo))
        : baseCondition;
    await db
      .update(schema.activations)
      .set({ dealerPriceSnapshot: price.dealerPrice })
      .where(condition);
  }
}

/** Sync all models' activation snapshots in one pass — call from the manual "Sync Prices" action. */
export async function syncAllActivationSnapshots(tenantId: string): Promise<{ modelsProcessed: number }> {
  const models = await db
    .selectDistinct({ modelId: schema.modelPriceHistory.modelId })
    .from(schema.modelPriceHistory)
    .where(eq(schema.modelPriceHistory.tenantId, tenantId));
  for (const { modelId } of models) {
    await syncActivationSnapshots(tenantId, modelId);
  }
  return { modelsProcessed: models.length };
}

/**
 * Re-price EVERY tenant's activations of this model to the owner's central
 * price-on-date. Central price is identical for all dealers, so this is a
 * set-based UPDATE per price window (no per-dealer loop, no tenant filter).
 * Activations outside any owner price window are left unchanged.
 */
export async function syncActivationSnapshotsAllTenants(modelId: string): Promise<void> {
  const windows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, OWNER_TENANT_ID), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  for (const w of windows) {
    const base = and(eq(schema.activations.modelId, modelId), gte(schema.activations.activationDate, w.effectiveFrom));
    const cond = w.effectiveTo !== null ? and(base, lt(schema.activations.activationDate, w.effectiveTo)) : base;
    await db.update(schema.activations).set({ dealerPriceSnapshot: w.dealerPrice }).where(cond);
  }
}

/**
 * Re-price EVERY tenant's purchases of this model to the owner's central
 * price-on-date (both dealer and invoice price). Same set-based approach.
 */
export async function syncPurchaseSnapshotsAllTenants(modelId: string): Promise<void> {
  const windows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, OWNER_TENANT_ID), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  for (const w of windows) {
    const base = and(eq(schema.purchases.modelId, modelId), gte(schema.purchases.purchaseDate, w.effectiveFrom));
    const cond = w.effectiveTo !== null ? and(base, lt(schema.purchases.purchaseDate, w.effectiveTo)) : base;
    await db
      .update(schema.purchases)
      .set({ unitDealerPrice: w.dealerPrice, unitInvoicePrice: w.invoicePrice })
      .where(cond);
  }
}

/**
 * Called after any owner price change. Re-prices all tenants' activations and
 * purchases (set-based), recomputes rebates for the owner's own dealers inline
 * (instant in owner portal), and enqueues a background job for every other
 * dealer. Never throws out to the caller — a follow-up failure must not roll
 * back the committed price write.
 */
export async function reAdjustAllDealersForPriceChange(modelId: string, fromDate: string): Promise<void> {
  let repriceFailed = false;
  try {
    await syncActivationSnapshotsAllTenants(modelId);
    await syncPurchaseSnapshotsAllTenants(modelId);
  } catch (e) {
    repriceFailed = true;
    console.error("[reAdjust-reprice]", modelId, fromDate, e);
  }

  try {
    const ownerDealers = await db
      .select({ id: schema.dealerIds.id })
      .from(schema.dealerIds)
      .where(eq(schema.dealerIds.tenantId, OWNER_TENANT_ID));

    // Each dealer's rebate recompute is independent - run concurrently in
    // small chunks (not one unbounded Promise.all) so this doesn't try to
    // claim more connections than the pool has (max 20, lib/db/client.ts).
    const CONCURRENCY = 8;
    for (let i = 0; i < ownerDealers.length; i += CONCURRENCY) {
      const chunk = ownerDealers.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map((d) =>
          reEvaluateRebatesForDealer(OWNER_TENANT_ID, d.id, modelId, fromDate).catch((e) =>
            console.error("[reAdjust-owner]", d.id, e)
          )
        )
      );
    }
  } catch (e) {
    console.error("[reAdjust-owner-dealers]", modelId, fromDate, e);
  }

  // Always enqueue the background job for every other-tenant dealer, even if a
  // step above failed — drainRebateJobs is the only retry path they have, and a
  // repricing failure must not also cost them their one chance at a recompute.
  try {
    await enqueueRebateJob(modelId, fromDate);
  } catch (e) {
    console.error("[reAdjust-enqueue]", modelId, fromDate, e);
  }

  if (repriceFailed) {
    await createOwnerAlert({
      tenantId: OWNER_TENANT_ID,
      type: OWNER_ALERT_TYPE.REPRICE_FAILED,
      entityType: "model",
      entityId: modelId,
      dealerId: null,
      message: `Repricing failed for a price change effective ${fromDate}. Some dealers' activations/purchases may still show the old price — check server logs, then re-save the price entry to retry.`,
    }).catch((e) => console.error("[reAdjust-alert]", e));
  }
}

export async function addPriceEntry(
  tenantId: string,
  input: { modelId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string }
): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.modelPriceHistory).values({ id, tenantId, ...input, effectiveTo: null });
  await restitchPriceHistory(tenantId, input.modelId);
  await reAdjustAllDealersForPriceChange(input.modelId, input.effectiveFrom);
  return id;
}

export async function updatePriceEntry(
  tenantId: string,
  input: { modelId: string; priceId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string }
): Promise<void> {
  await db
    .update(schema.modelPriceHistory)
    .set({ dealerPrice: input.dealerPrice, invoicePrice: input.invoicePrice, effectiveFrom: input.effectiveFrom })
    .where(and(eq(schema.modelPriceHistory.id, input.priceId), eq(schema.modelPriceHistory.tenantId, tenantId)));
  await restitchPriceHistory(tenantId, input.modelId);
  await reAdjustAllDealersForPriceChange(input.modelId, input.effectiveFrom);
}

export async function deletePriceEntry(
  tenantId: string,
  input: { modelId: string; priceId: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const entryRows = await db
    .select({ effectiveTo: schema.modelPriceHistory.effectiveTo, effectiveFrom: schema.modelPriceHistory.effectiveFrom })
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.id, input.priceId), eq(schema.modelPriceHistory.tenantId, tenantId)))
    .limit(1);
  if (entryRows.length === 0) return { ok: false, reason: "Price entry not found" };
  if (entryRows[0].effectiveTo !== null) {
    return { ok: false, reason: "Sirf current (active) price entry delete ho sakti hai. Purani entries sirf edit ki ja sakti hain." };
  }
  await db
    .delete(schema.rebates)
    // One owner price-history row anchors rebate rows in every dealer tenant.
    // Remove all of those rows before deleting the shared price event.
    .where(eq(schema.rebates.priceHistoryId, input.priceId));
  await db
    .delete(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.id, input.priceId), eq(schema.modelPriceHistory.tenantId, tenantId)));
  await restitchPriceHistory(tenantId, input.modelId);
  await reAdjustAllDealersForPriceChange(input.modelId, entryRows[0].effectiveFrom);
  return { ok: true };
}

export async function updateModel(input: {
  id: string; name: string; sku: string | null; isActive: boolean;
}): Promise<void> {
  await db.update(schema.models).set({ name: input.name, sku: input.sku, isActive: input.isActive }).where(eq(schema.models.id, input.id));
  revalidateTag("models", {});
}

/**
 * Copy owner's current (effectiveTo=null) price entries into a newly created tenant.
 * Called once at dealer creation so the dealer starts with the current catalog prices.
 * Skips any model that already has a price entry for this tenant (idempotent).
 */
export async function seedDealerPricesFromOwner(
  ownerTenantId: string,
  newTenantId: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all active owner price entries
  const ownerPrices = await db
    .select({
      modelId: schema.modelPriceHistory.modelId,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      invoicePrice: schema.modelPriceHistory.invoicePrice,
    })
    .from(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.tenantId, ownerTenantId),
        isNull(schema.modelPriceHistory.effectiveTo),
      ),
    );

  if (ownerPrices.length === 0) return;

  // Find which models the dealer already has entries for (skip those)
  const existingModelIds = new Set(
    (
      await db
        .select({ modelId: schema.modelPriceHistory.modelId })
        .from(schema.modelPriceHistory)
        .where(eq(schema.modelPriceHistory.tenantId, newTenantId))
    ).map((r) => r.modelId),
  );

  const toInsert = ownerPrices
    .filter((p) => !existingModelIds.has(p.modelId))
    .map((p) => ({
      id: randomUUID(),
      tenantId: newTenantId,
      modelId: p.modelId,
      dealerPrice: p.dealerPrice,
      invoicePrice: p.invoicePrice,
      effectiveFrom: today,
      effectiveTo: null as string | null,
    }));

  if (toInsert.length > 0) {
    await db.insert(schema.modelPriceHistory).values(toInsert);
  }
}

export async function deleteModel(modelId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ purchaseCount }] = await db
    .select({ purchaseCount: sql<number>`COUNT(*)` })
    .from(schema.purchases)
    .where(eq(schema.purchases.modelId, modelId));
  if (Number(purchaseCount) > 0) return { ok: false, reason: `${Number(purchaseCount)} purchase(s) still reference this model` };
  const [{ activationCount }] = await db
    .select({ activationCount: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(eq(schema.activations.modelId, modelId));
  if (Number(activationCount) > 0) return { ok: false, reason: `${Number(activationCount)} activation(s) still reference this model` };
  await db.delete(schema.models).where(eq(schema.models.id, modelId));
  revalidateTag("models", {});
  return { ok: true };
}
