import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { EXTERNAL_DIRECTION, type ExternalDirection } from "@/lib/stock/external-delta";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export { EXTERNAL_DIRECTION, netExternalDelta } from "@/lib/stock/external-delta";
export type { ExternalDirection } from "@/lib/stock/external-delta";

export interface ExternalTransferRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  direction: string;
  transferDate: string;
  counterpartName: string;
  counterpartCity: string | null;
  note: string | null;
}

export async function listExternalTransfers(tenantId: string, dealerId: string): Promise<ExternalTransferRow[]> {
  return db
    .select({
      id: schema.externalTransfers.id,
      modelId: schema.externalTransfers.modelId,
      modelName: schema.models.name,
      quantity: schema.externalTransfers.quantity,
      direction: schema.externalTransfers.direction,
      transferDate: schema.externalTransfers.transferDate,
      counterpartName: schema.externalTransfers.counterpartName,
      counterpartCity: schema.externalTransfers.counterpartCity,
      note: schema.externalTransfers.note,
    })
    .from(schema.externalTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.externalTransfers.modelId))
    .where(and(eq(schema.externalTransfers.tenantId, tenantId), eq(schema.externalTransfers.dealerId, dealerId)))
    .orderBy(desc(schema.externalTransfers.transferDate));
}

/**
 * Net external stock delta per model for a dealer: `+SUM(IN) − SUM(OUT)`, keyed by modelId.
 * Every stock computation folds this in so external transfers move physical stock without
 * ever touching the incentive engine.
 */
export async function externalStockDeltaByModel(
  tenantId: string,
  dealerId: string,
  executor: Executor = db,
): Promise<Map<string, number>> {
  const rows = await executor
    .select({
      modelId: schema.externalTransfers.modelId,
      net: sql<number>`COALESCE(SUM(CASE WHEN ${schema.externalTransfers.direction} = 'IN' THEN ${schema.externalTransfers.quantity} WHEN ${schema.externalTransfers.direction} = 'OUT' THEN -${schema.externalTransfers.quantity} ELSE 0 END), 0)`,
    })
    .from(schema.externalTransfers)
    .where(and(eq(schema.externalTransfers.tenantId, tenantId), eq(schema.externalTransfers.dealerId, dealerId)))
    .groupBy(schema.externalTransfers.modelId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.modelId, Number(r.net));
  return map;
}

/** Dated external movements for one model — feeds the backdated-stock (min-forward) guard. */
export async function externalMovementsForModel(
  tenantId: string,
  dealerId: string,
  modelId: string,
  executor: Executor = db,
): Promise<{ date: string; direction: string; quantity: number }[]> {
  return executor
    .select({
      date: schema.externalTransfers.transferDate,
      direction: schema.externalTransfers.direction,
      quantity: schema.externalTransfers.quantity,
    })
    .from(schema.externalTransfers)
    .where(
      and(
        eq(schema.externalTransfers.tenantId, tenantId),
        eq(schema.externalTransfers.dealerId, dealerId),
        eq(schema.externalTransfers.modelId, modelId),
      ),
    );
}

/** Per-model net external delta on/before `asOf` — used by the as-of inventory snapshot. */
export async function externalStockDeltaByModelAsOf(
  tenantId: string,
  dealerId: string,
  asOf: string,
  executor: Executor = db,
): Promise<Map<string, number>> {
  const rows = await executor
    .select({
      modelId: schema.externalTransfers.modelId,
      net: sql<number>`COALESCE(SUM(CASE WHEN ${schema.externalTransfers.direction} = 'IN' THEN ${schema.externalTransfers.quantity} WHEN ${schema.externalTransfers.direction} = 'OUT' THEN -${schema.externalTransfers.quantity} ELSE 0 END), 0)`,
    })
    .from(schema.externalTransfers)
    .where(
      and(
        eq(schema.externalTransfers.tenantId, tenantId),
        eq(schema.externalTransfers.dealerId, dealerId),
        lte(schema.externalTransfers.transferDate, asOf),
      ),
    )
    .groupBy(schema.externalTransfers.modelId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.modelId, Number(r.net));
  return map;
}

/** Net external delta for a single model on/before `asOf` — used by the stock-out guard. */
export async function externalStockDeltaForModelAsOf(
  tenantId: string,
  dealerId: string,
  modelId: string,
  asOf: string,
  executor: Executor = db,
): Promise<number> {
  const [row] = await executor
    .select({
      net: sql<number>`COALESCE(SUM(CASE WHEN ${schema.externalTransfers.direction} = 'IN' THEN ${schema.externalTransfers.quantity} WHEN ${schema.externalTransfers.direction} = 'OUT' THEN -${schema.externalTransfers.quantity} ELSE 0 END), 0)`,
    })
    .from(schema.externalTransfers)
    .where(
      and(
        eq(schema.externalTransfers.tenantId, tenantId),
        eq(schema.externalTransfers.dealerId, dealerId),
        eq(schema.externalTransfers.modelId, modelId),
        lte(schema.externalTransfers.transferDate, asOf),
      ),
    );
  return Number(row?.net ?? 0);
}

export async function createExternalTransfer(
  input: {
    tenantId: string;
    dealerId: string;
    modelId: string;
    quantity: number;
    direction: ExternalDirection;
    transferDate: string;
    counterpartName: string;
    counterpartCity?: string | null;
    note?: string | null;
  },
  executor: Executor = db,
): Promise<string> {
  const id = randomUUID();
  await executor.insert(schema.externalTransfers).values({
    id,
    tenantId: input.tenantId,
    dealerId: input.dealerId,
    modelId: input.modelId,
    quantity: input.quantity,
    direction: input.direction,
    transferDate: input.transferDate,
    counterpartName: input.counterpartName,
    counterpartCity: input.counterpartCity ?? null,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getExternalTransfer(id: string, tenantId: string, dealerId: string) {
  const [row] = await db
    .select()
    .from(schema.externalTransfers)
    .where(and(eq(schema.externalTransfers.id, id), eq(schema.externalTransfers.tenantId, tenantId), eq(schema.externalTransfers.dealerId, dealerId)))
    .limit(1);
  return row ?? null;
}

export async function updateExternalTransfer(
  id: string,
  tenantId: string,
  dealerId: string,
  input: {
    modelId: string;
    quantity: number;
    direction: ExternalDirection;
    transferDate: string;
    counterpartName: string;
    counterpartCity?: string | null;
    note?: string | null;
  },
  executor: Executor = db,
): Promise<boolean> {
  const updated = await executor
    .update(schema.externalTransfers)
    .set({
      modelId: input.modelId,
      quantity: input.quantity,
      direction: input.direction,
      transferDate: input.transferDate,
      counterpartName: input.counterpartName,
      counterpartCity: input.counterpartCity ?? null,
      note: input.note ?? null,
    })
    .where(and(eq(schema.externalTransfers.id, id), eq(schema.externalTransfers.tenantId, tenantId), eq(schema.externalTransfers.dealerId, dealerId)))
    .returning({ id: schema.externalTransfers.id });
  return updated.length > 0;
}

export async function deleteExternalTransfer(id: string, tenantId: string, dealerId: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.externalTransfers)
    .where(and(eq(schema.externalTransfers.id, id), eq(schema.externalTransfers.tenantId, tenantId), eq(schema.externalTransfers.dealerId, dealerId)))
    .returning({ id: schema.externalTransfers.id });
  return deleted.length > 0;
}
