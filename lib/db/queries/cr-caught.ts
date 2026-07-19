import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, gte, lt, lte, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CrCaughtRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  fineAmount: number | null;
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
      fineAmount: schema.crCaught.fineAmount,
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
  fineAmount?: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  note: string | null;
  status?: string;
  createdByUserId?: string | null;
}, executor: Executor = db): Promise<string> {
  const id = randomUUID();
  await executor.insert(schema.crCaught).values({ id, ...input, fineAmount: input.fineAmount ?? 0, status: input.status ?? "active" });
  return id;
}

export async function getCrCaughtLoss(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string,
  basePct: number
): Promise<{ totalUnits: number; priceUnitSum: number; lostIncentive: number; totalFines: number }> {
  const rows = await db
    .select({ qty: schema.crCaught.quantity, price: schema.crCaught.dealerPriceSnapshot, fine: schema.crCaught.fineAmount })
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
  let priceUnitSum = 0;
  let totalFines = 0;
  for (const r of rows) {
    totalUnits += r.qty;
    priceUnitSum += r.qty * r.price;
    totalFines += r.fine ?? 0;
  }
  // lostIncentive kept for backward compat (informational only — not a ledger deduction)
  const lostIncentive = Math.round(priceUnitSum * (basePct / 100) * 1.25);
  return { totalUnits, priceUnitSum: Math.round(priceUnitSum), lostIncentive, totalFines: Math.round(totalFines) };
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

export async function getCrCaughtAsOf(tenantId: string, dealerId: string, modelId: string, asOf: string, executor: Executor = db): Promise<number> {
  const [{ qty }] = await executor
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

/** Closing stock of CR-caught units strictly before `beforeDate` — used for rebate eligibility. */
export async function getCrCaughtBefore(tenantId: string, dealerId: string, modelId: string, beforeDate: string): Promise<number> {
  const [{ qty }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        eq(schema.crCaught.modelId, modelId),
        lt(schema.crCaught.caughtDate, beforeDate),
        ne(schema.crCaught.status, "pending_owner_approval")
      )
    );
  return Number(qty);
}

export interface CrCaughtExportRow {
  modelName: string;
  quantity: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  fineAmount: number;
}

export async function listCrCaughtForPeriod(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string
): Promise<CrCaughtExportRow[]> {
  const rows = await db
    .select({
      modelName: schema.models.name,
      quantity: schema.crCaught.quantity,
      caughtDate: schema.crCaught.caughtDate,
      dealerPriceSnapshot: schema.crCaught.dealerPriceSnapshot,
      fineAmount: schema.crCaught.fineAmount,
    })
    .from(schema.crCaught)
    .innerJoin(schema.models, eq(schema.models.id, schema.crCaught.modelId))
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        gte(schema.crCaught.caughtDate, from),
        lte(schema.crCaught.caughtDate, to),
        ne(schema.crCaught.status, "pending_owner_approval")
      )
    )
    .orderBy(desc(schema.crCaught.caughtDate));
  return rows.map((r) => ({ ...r, fineAmount: r.fineAmount ?? 0 }));
}

export type CrCaughtRef = { tenantId: string; dealerId: string; modelId: string; caughtDate: string } | null;

async function crCaughtRef(id: string): Promise<CrCaughtRef> {
  const rows = await db
    .select({ tenantId: schema.crCaught.tenantId, dealerId: schema.crCaught.dealerId, modelId: schema.crCaught.modelId, caughtDate: schema.crCaught.caughtDate })
    .from(schema.crCaught).where(eq(schema.crCaught.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Flips a pending CR-caught to active. Returns the affected row ref so callers can reconcile rebates. */
export async function approveCrCaught(id: string): Promise<CrCaughtRef> {
  const ref = await crCaughtRef(id);
  await db.update(schema.crCaught).set({ status: "active" }).where(eq(schema.crCaught.id, id));
  return ref;
}

/** Removes a CR-caught entry (restores stock). Returns the affected row ref so callers can reconcile rebates. */
export async function rejectCrCaught(id: string): Promise<CrCaughtRef> {
  const ref = await crCaughtRef(id);
  await db.delete(schema.crCaught).where(eq(schema.crCaught.id, id));
  return ref;
}

/** Dealer-scoped delete (undo): removes a CR-caught entry only if it belongs to
 *  this tenant+dealer, restoring stock. Returns the ref for rebate reconciliation. */
export async function deleteCrCaught(id: string, tenantId: string, dealerId: string): Promise<CrCaughtRef> {
  const ref = await crCaughtRef(id);
  if (!ref || ref.tenantId !== tenantId || ref.dealerId !== dealerId) return null;
  await db.delete(schema.crCaught).where(
    and(eq(schema.crCaught.id, id), eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)),
  );
  return ref;
}
