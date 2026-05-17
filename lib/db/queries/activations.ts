import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getPriceOnDate } from "./models";

export interface ActivationRow {
  id: string;
  modelId: string;
  modelName: string;
  imei: string | null;
  activationDate: string;
  dealerPriceSnapshot: number;
  isCrossRegion: boolean;
  purchaseId: string | null;
}

export async function listActivations(filters: {
  dealerId: string;
  modelId?: string;
  from?: string;
  to?: string;
}): Promise<ActivationRow[]> {
  const where = [eq(schema.activations.dealerId, filters.dealerId)];
  if (filters.modelId) where.push(eq(schema.activations.modelId, filters.modelId));
  if (filters.from) where.push(gte(schema.activations.activationDate, filters.from));
  if (filters.to) where.push(lte(schema.activations.activationDate, filters.to));

  const rows = await db
    .select({
      id: schema.activations.id,
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      imei: schema.activations.imei,
      activationDate: schema.activations.activationDate,
      dealerPriceSnapshot: schema.activations.dealerPriceSnapshot,
      isCrossRegion: schema.activations.isCrossRegion,
      purchaseId: schema.activations.purchaseId,
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(and(...where))
    .orderBy(desc(schema.activations.activationDate), asc(schema.models.name));
  return rows;
}

export async function createActivation(input: {
  dealerId: string;
  modelId: string;
  activationDate: string;
  imei: string | null;
  purchaseId: string | null;
  isCrossRegion: boolean;
  /** When omitted, the engine snapshots the dealer price effective on activationDate. */
  dealerPriceOverride?: number;
}): Promise<{ id: string; pricedAt: number; isCrossRegion: boolean }> {
  const id = randomUUID();
  let snapshot = input.dealerPriceOverride;
  if (snapshot == null) {
    const price = await getPriceOnDate(input.modelId, input.activationDate);
    if (!price) {
      throw new Error("No dealer price defined for this model on or before the activation date");
    }
    snapshot = price.dealerPrice;
  }
  // Auto-flag isCrossRegion when linked to a CROSS_REGION_TRANSFER_IN purchase.
  // The user-provided value is honored otherwise (e.g., for direct entries).
  let isCrossRegion = input.isCrossRegion;
  if (input.purchaseId) {
    const linked = await db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, input.purchaseId))
      .limit(1);
    if (linked.length > 0 && linked[0].source === "CROSS_REGION_TRANSFER_IN") {
      isCrossRegion = true;
    }
  }
  await db.insert(schema.activations).values({
    id,
    dealerId: input.dealerId,
    modelId: input.modelId,
    activationDate: input.activationDate,
    imei: input.imei,
    purchaseId: input.purchaseId,
    isCrossRegion,
    dealerPriceSnapshot: snapshot,
  });
  return { id, pricedAt: snapshot, isCrossRegion };
}

export async function deleteActivation(id: string, dealerId: string): Promise<void> {
  await db
    .delete(schema.activations)
    .where(and(eq(schema.activations.id, id), eq(schema.activations.dealerId, dealerId)));
}

