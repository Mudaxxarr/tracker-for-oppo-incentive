import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, isNull, lte, gt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface ModelWithCurrentPrice {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  dealerPrice: number | null;
  invoicePrice: number | null;
}

export async function listModelsWithCurrentPrice(): Promise<ModelWithCurrentPrice[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      sku: schema.models.sku,
      isActive: schema.models.isActive,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      invoicePrice: schema.modelPriceHistory.invoicePrice,
    })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(
          isNull(schema.modelPriceHistory.effectiveTo),
          gt(schema.modelPriceHistory.effectiveTo, today)
        )
      )
    )
    .orderBy(asc(schema.models.name));
  return rows;
}

export async function getModelById(id: string) {
  const rows = await db
    .select()
    .from(schema.models)
    .where(eq(schema.models.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Find dealer price effective on the given date.  Returns null if none. */
export async function getPriceOnDate(
  modelId: string,
  date: string
): Promise<{ dealerPrice: number; invoicePrice: number } | null> {
  const rows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.modelId, modelId),
        lte(schema.modelPriceHistory.effectiveFrom, date),
        or(
          isNull(schema.modelPriceHistory.effectiveTo),
          gt(schema.modelPriceHistory.effectiveTo, date)
        )
      )
    )
    .orderBy(desc(schema.modelPriceHistory.effectiveFrom))
    .limit(1);
  if (rows.length === 0) return null;
  return { dealerPrice: rows[0].dealerPrice, invoicePrice: rows[0].invoicePrice };
}

export async function listPriceHistory(modelId: string) {
  return db
    .select()
    .from(schema.modelPriceHistory)
    .where(eq(schema.modelPriceHistory.modelId, modelId))
    .orderBy(desc(schema.modelPriceHistory.effectiveFrom));
}

export async function createModel(input: {
  name: string;
  sku: string | null;
  dealerPrice: number;
  invoicePrice: number;
  effectiveFrom?: string;
}): Promise<string> {
  const modelId = randomUUID();
  const today = input.effectiveFrom ?? new Date().toISOString().slice(0, 10);
  await db.insert(schema.models).values({
    id: modelId,
    name: input.name,
    sku: input.sku,
    isActive: true,
  });
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(),
    modelId,
    dealerPrice: input.dealerPrice,
    invoicePrice: input.invoicePrice,
    effectiveFrom: today,
    effectiveTo: null,
  });
  return modelId;
}

/**
 * Insert a new price-history row, closing the previous open row's `effective_to`.
 * Idempotent for same-day re-runs (will close any older row whose end is null).
 */
export async function updateModelPrice(input: {
  modelId: string;
  dealerPrice: number;
  invoicePrice: number;
  effectiveFrom: string;
}): Promise<void> {
  // Close any currently-open row for this model.
  await db
    .update(schema.modelPriceHistory)
    .set({ effectiveTo: input.effectiveFrom })
    .where(
      and(
        eq(schema.modelPriceHistory.modelId, input.modelId),
        isNull(schema.modelPriceHistory.effectiveTo)
      )
    );
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(),
    modelId: input.modelId,
    dealerPrice: input.dealerPrice,
    invoicePrice: input.invoicePrice,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
  });
}

/** Re-stitch the price-history timeline for a model so that rows are sorted by
 *  `effective_from` and each row's `effective_to` is set to the next row's
 *  `effective_from` (or NULL for the latest). Call this after inserting or
 *  deleting a price-history row at an arbitrary date. */
async function restitchPriceHistory(modelId: string): Promise<void> {
  const rows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(eq(schema.modelPriceHistory.modelId, modelId))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));
  for (let i = 0; i < rows.length; i++) {
    const next = rows[i + 1];
    const targetEffectiveTo = next ? next.effectiveFrom : null;
    if (rows[i].effectiveTo !== targetEffectiveTo) {
      await db
        .update(schema.modelPriceHistory)
        .set({ effectiveTo: targetEffectiveTo })
        .where(eq(schema.modelPriceHistory.id, rows[i].id));
    }
  }
}

/** Insert a price-history entry on an arbitrary date and re-stitch the timeline. */
export async function addPriceEntry(input: {
  modelId: string;
  dealerPrice: number;
  invoicePrice: number;
  effectiveFrom: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.modelPriceHistory).values({
    id,
    modelId: input.modelId,
    dealerPrice: input.dealerPrice,
    invoicePrice: input.invoicePrice,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null, // restitch will fix
  });
  await restitchPriceHistory(input.modelId);
  return id;
}

/** Update a single price-history row's prices and/or effective_from date,
 *  then re-stitch the timeline so all `effective_to` values are correct. */
export async function updatePriceEntry(input: {
  modelId: string;
  priceId: string;
  dealerPrice: number;
  invoicePrice: number;
  effectiveFrom: string;
}): Promise<void> {
  await db
    .update(schema.modelPriceHistory)
    .set({
      dealerPrice: input.dealerPrice,
      invoicePrice: input.invoicePrice,
      effectiveFrom: input.effectiveFrom,
    })
    .where(
      and(
        eq(schema.modelPriceHistory.id, input.priceId),
        eq(schema.modelPriceHistory.modelId, input.modelId)
      )
    );
  await restitchPriceHistory(input.modelId);
}

/** Remove a single price-history row and re-stitch the timeline. */
export async function deletePriceEntry(input: {
  modelId: string;
  priceId: string;
}): Promise<void> {
  await db
    .delete(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.id, input.priceId),
        eq(schema.modelPriceHistory.modelId, input.modelId)
      )
    );
  await restitchPriceHistory(input.modelId);
}

/** Edit a model's name + SKU + active flag. */
export async function updateModel(input: {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
}): Promise<void> {
  await db
    .update(schema.models)
    .set({ name: input.name, sku: input.sku, isActive: input.isActive })
    .where(eq(schema.models.id, input.id));
}

/** Delete a model only when nothing references it. Returns reason for refusal. */
export async function deleteModel(modelId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Refuse if there are purchases or activations referencing it.
  const [{ purchaseCount }] = await db
    .select({ purchaseCount: sql<number>`COUNT(*)` })
    .from(schema.purchases)
    .where(eq(schema.purchases.modelId, modelId));
  if (Number(purchaseCount) > 0) {
    return { ok: false, reason: `${Number(purchaseCount)} purchase(s) still reference this model — delete them first` };
  }
  const [{ activationCount }] = await db
    .select({ activationCount: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(eq(schema.activations.modelId, modelId));
  if (Number(activationCount) > 0) {
    return { ok: false, reason: `${Number(activationCount)} activation(s) still reference this model — delete them first` };
  }
  // Safe to delete; price history cascades.
  await db.delete(schema.models).where(eq(schema.models.id, modelId));
  return { ok: true };
}
