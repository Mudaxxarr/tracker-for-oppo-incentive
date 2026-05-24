import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface CrCaughtRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  note: string | null;
  status: string;
}

export async function listCrCaught(tenantId: string, dealerId: string): Promise<CrCaughtRow[]> {
  return db
    .select({
      id: schema.crCaught.id,
      modelId: schema.crCaught.modelId,
      modelName: schema.models.name,
      quantity: schema.crCaught.quantity,
      caughtDate: schema.crCaught.caughtDate,
      dealerPriceSnapshot: schema.crCaught.dealerPriceSnapshot,
      note: schema.crCaught.note,
      status: schema.crCaught.status,
    })
    .from(schema.crCaught)
    .innerJoin(schema.models, eq(schema.models.id, schema.crCaught.modelId))
    .where(and(eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)))
    .orderBy(desc(schema.crCaught.caughtDate));
}

export async function createCrCaught(input: {
  tenantId: string;
  dealerId: string;
  modelId: string;
  quantity: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  note: string | null;
  status?: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.crCaught).values({ id, ...input, status: input.status ?? "active" });
  return id;
}

export async function getCrCaughtLoss(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string,
  basePct: number
): Promise<{ totalUnits: number; lostIncentive: number }> {
  const rows = await db
    .select({ qty: schema.crCaught.quantity, price: schema.crCaught.dealerPriceSnapshot })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        gte(schema.crCaught.caughtDate, from),
        lte(schema.crCaught.caughtDate, to)
      )
    );
  let totalUnits = 0;
  let lostIncentive = 0;
  for (const r of rows) {
    totalUnits += r.qty;
    lostIncentive += r.qty * r.price * (basePct / 100) * 1.25;
  }
  return { totalUnits, lostIncentive: Math.round(lostIncentive) };
}

export async function getCrCaughtForStockCalc(tenantId: string, dealerId: string, modelId: string): Promise<number> {
  const [{ qty }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        eq(schema.crCaught.modelId, modelId),
        ne(schema.crCaught.status, "pending_owner_approval")
      )
    );
  return Number(qty);
}

export async function getCrCaughtAsOf(tenantId: string, dealerId: string, modelId: string, asOf: string): Promise<number> {
  const [{ qty }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        eq(schema.crCaught.modelId, modelId),
        lte(schema.crCaught.caughtDate, asOf),
        ne(schema.crCaught.status, "pending_owner_approval")
      )
    );
  return Number(qty);
}

export async function approveCrCaught(id: string): Promise<void> {
  await db.update(schema.crCaught).set({ status: "active" }).where(eq(schema.crCaught.id, id));
}

export async function rejectCrCaught(id: string): Promise<void> {
  await db.delete(schema.crCaught).where(eq(schema.crCaught.id, id));
}
