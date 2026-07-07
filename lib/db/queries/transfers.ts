import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CROSS_REGION_STATUS, INTER_ID_STATUS, PURCHASE_SOURCE } from "@/lib/constants";
import { getPriceOnDate } from "./models";
import { getNextBillNumber } from "./purchases";

export interface CrossRegionRow {
  id: string; modelId: string; modelName: string; quantity: number;
  reportedDate: string; shiftedToIdDate: string | null; status: string;
  sourceRegionNote: string | null; fineAmount: number | null;
}

export async function listCrossRegion(tenantId: string, dealerId: string): Promise<CrossRegionRow[]> {
  return db
    .select({ id: schema.crossRegionTransfers.id, modelId: schema.crossRegionTransfers.modelId,
      modelName: schema.models.name, quantity: schema.crossRegionTransfers.quantity,
      reportedDate: schema.crossRegionTransfers.reportedDate,
      shiftedToIdDate: schema.crossRegionTransfers.shiftedToIdDate,
      status: schema.crossRegionTransfers.status,
      sourceRegionNote: schema.crossRegionTransfers.sourceRegionNote,
      fineAmount: schema.crossRegionTransfers.fineAmount })
    .from(schema.crossRegionTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.crossRegionTransfers.modelId))
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId)))
    .orderBy(desc(schema.crossRegionTransfers.reportedDate));
}

export async function countPendingCrossRegion(tenantId: string, dealerId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId), eq(schema.crossRegionTransfers.status, CROSS_REGION_STATUS.PENDING_REPORT)));
  return Number(n);
}

export async function createCrossRegion(input: {
  tenantId: string; dealerId: string; modelId: string; quantity: number;
  reportedDate: string; sourceRegionNote: string | null;
  fineAmount?: number | null; initialStatus?: string;
}) {
  const id = randomUUID();
  const { initialStatus, ...rest } = input;
  await db.insert(schema.crossRegionTransfers).values({ id, ...rest, fineAmount: rest.fineAmount ?? 0, shiftedToIdDate: null, status: initialStatus ?? CROSS_REGION_STATUS.PENDING_REPORT });
  return id;
}

export async function sumCrFinesForPeriod(tenantId: string, dealerId: string, from: string, to: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.crossRegionTransfers.fineAmount}), 0)` })
    .from(schema.crossRegionTransfers)
    .where(and(
      eq(schema.crossRegionTransfers.tenantId, tenantId),
      eq(schema.crossRegionTransfers.dealerId, dealerId),
      gte(schema.crossRegionTransfers.reportedDate, from),
      lte(schema.crossRegionTransfers.reportedDate, to),
      sql`${schema.crossRegionTransfers.status} != 'REJECTED'`,
    ));
  return Number(total);
}

export async function submitCrossRegionForApproval(input: {
  id: string; tenantId: string; dealerId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const rows = await db.select().from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, input.id), eq(schema.crossRegionTransfers.tenantId, input.tenantId), eq(schema.crossRegionTransfers.dealerId, input.dealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Not found" };
  if (rows[0].status !== CROSS_REGION_STATUS.PENDING_REPORT) return { ok: false, message: "Only pending transfers can be submitted for approval" };
  await db.update(schema.crossRegionTransfers)
    .set({ status: CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL })
    .where(eq(schema.crossRegionTransfers.id, input.id));
  return { ok: true };
}

// Owner-only: approve (PENDING_OWNER_APPROVAL → SHIFTED_TO_MY_ID) or reject
export async function getCrossRegionById(id: string, tenantId: string) {
  const rows = await db.select().from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, id), eq(schema.crossRegionTransfers.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateCrossRegionStatus(input: {
  id: string; tenantId: string; dealerId: string; status: "PENDING_REPORT" | "PENDING_OWNER_APPROVAL" | "SHIFTED_TO_MY_ID" | "REJECTED";
  priceTenantId?: string;
}) {
  const rows = await db.select().from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, input.id), eq(schema.crossRegionTransfers.tenantId, input.tenantId), eq(schema.crossRegionTransfers.dealerId, input.dealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Not found" };
  const transfer = rows[0];

  if (input.status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID) {
    const approvable = [CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL, CROSS_REGION_STATUS.PENDING_REPORT];
    if (!approvable.includes(transfer.status as typeof approvable[number])) {
      return { ok: false, message: "Transfer must be pending or awaiting approval before it can be approved" };
    }
    // Stock lands on the date the units were reported as received, not the approval
    // date — so stock-in policies for that date count it correctly.
    const effectiveDate = transfer.reportedDate;
    const price = await getPriceOnDate(input.priceTenantId ?? input.tenantId, transfer.modelId, effectiveDate);
    if (!price) return { ok: false, message: "No dealer price defined for this model" };
    // Wrap purchase creation + status update atomically so a crash between the two
    // writes cannot leave stock credited with the transfer still showing pending.
    await db.transaction(async (tx) => {
      const billNumber = await getNextBillNumber(input.tenantId, transfer.dealerId, effectiveDate, tx);
      await tx.insert(schema.purchases).values({
        id: randomUUID(), tenantId: input.tenantId, dealerId: transfer.dealerId,
        modelId: transfer.modelId, quantity: transfer.quantity,
        unitDealerPrice: price.dealerPrice, unitInvoicePrice: price.invoicePrice,
        purchaseDate: effectiveDate, source: PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN,
        referenceNote: `Cross-region: ${transfer.sourceRegionNote ?? "—"}`,
        billNumber,
        crossRegionTransferId: transfer.id,
      });
      await tx.update(schema.crossRegionTransfers).set({ status: input.status, shiftedToIdDate: effectiveDate }).where(eq(schema.crossRegionTransfers.id, transfer.id));
    });
    return { ok: true, created: transfer.quantity, modelId: transfer.modelId, dealerId: transfer.dealerId, effectiveDate };
  }

  await db.update(schema.crossRegionTransfers).set({ status: input.status }).where(eq(schema.crossRegionTransfers.id, transfer.id));
  return { ok: true };
}

export async function deleteCrossRegion(id: string, tenantId: string, dealerId: string): Promise<{ modelId: string; reportedDate: string } | null> {
  const rows = await db
    .select({ modelId: schema.crossRegionTransfers.modelId, reportedDate: schema.crossRegionTransfers.reportedDate })
    .from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, id), eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId)))
    .limit(1);
  await db.delete(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.crossRegionTransferId, id)));
  await db.delete(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, id), eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId)));
  return rows[0] ?? null;
}

export interface InterIdRow {
  id: string; fromDealerId: string; toDealerId: string; modelId: string;
  modelName: string; quantity: number; transferDate: string; note: string | null; status: string;
}

export interface PendingTransferRow {
  id: string; fromDealerId: string; fromDealerName: string; modelId: string;
  modelName: string; quantity: number; transferDate: string; note: string | null;
}

export async function listInterIdTransfers(tenantId: string, dealerId: string): Promise<InterIdRow[]> {
  return db
    .select({ id: schema.interIdTransfers.id, fromDealerId: schema.interIdTransfers.fromDealerId,
      toDealerId: schema.interIdTransfers.toDealerId, modelId: schema.interIdTransfers.modelId,
      modelName: schema.models.name, quantity: schema.interIdTransfers.quantity,
      transferDate: schema.interIdTransfers.transferDate, note: schema.interIdTransfers.note,
      status: schema.interIdTransfers.status })
    .from(schema.interIdTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
    .where(and(eq(schema.interIdTransfers.tenantId, tenantId), or(eq(schema.interIdTransfers.fromDealerId, dealerId), eq(schema.interIdTransfers.toDealerId, dealerId))))
    .orderBy(desc(schema.interIdTransfers.transferDate));
}

export async function listPendingInbound(tenantId: string, toDealerId: string): Promise<PendingTransferRow[]> {
  return db
    .select({ id: schema.interIdTransfers.id, fromDealerId: schema.interIdTransfers.fromDealerId,
      fromDealerName: schema.dealerIds.name, modelId: schema.interIdTransfers.modelId,
      modelName: schema.models.name, quantity: schema.interIdTransfers.quantity,
      transferDate: schema.interIdTransfers.transferDate, note: schema.interIdTransfers.note })
    .from(schema.interIdTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.interIdTransfers.fromDealerId))
    .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, toDealerId), eq(schema.interIdTransfers.status, INTER_ID_STATUS.PENDING)))
    .orderBy(desc(schema.interIdTransfers.transferDate));
}

export async function createInterIdTransfer(input: {
  tenantId: string; fromDealerId: string; toDealerId: string; modelId: string;
  quantity: number; transferDate: string; note: string | null;
}) {
  if (input.fromDealerId === input.toDealerId) throw new Error("Source and destination must be different dealer IDs");
  const id = randomUUID();
  await db.insert(schema.interIdTransfers).values({ id, ...input, status: INTER_ID_STATUS.PENDING });
  return id;
}

export async function acceptInterIdTransfer(tenantId: string, id: string, toDealerId: string): Promise<{ ok: boolean; message?: string }> {
  const rows = await db.select().from(schema.interIdTransfers)
    .where(and(eq(schema.interIdTransfers.id, id), eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, toDealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Transfer not found" };
  const transfer = rows[0];
  if (transfer.status !== INTER_ID_STATUS.PENDING) return { ok: false, message: "Transfer is not pending" };
  const price = await getPriceOnDate(tenantId, transfer.modelId, transfer.transferDate);
  if (!price) return { ok: false, message: "No dealer price defined for this model on the transfer date" };
  const billNumber = await getNextBillNumber(tenantId, toDealerId, transfer.transferDate);
  await db.insert(schema.purchases).values({
    id: randomUUID(), tenantId, dealerId: toDealerId, modelId: transfer.modelId,
    quantity: transfer.quantity, unitDealerPrice: price.dealerPrice, unitInvoicePrice: price.invoicePrice,
    purchaseDate: transfer.transferDate, source: PURCHASE_SOURCE.REGULAR,
    referenceNote: `Inter-ID transfer in (${id.slice(0, 8)})`,
    billNumber,
  });
  await db.update(schema.interIdTransfers).set({ status: INTER_ID_STATUS.ACCEPTED }).where(eq(schema.interIdTransfers.id, id));
  return { ok: true };
}

export async function rejectInterIdTransfer(tenantId: string, id: string, toDealerId: string): Promise<{ ok: boolean; message?: string }> {
  const rows = await db.select().from(schema.interIdTransfers)
    .where(and(eq(schema.interIdTransfers.id, id), eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, toDealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Transfer not found" };
  if (rows[0].status !== INTER_ID_STATUS.PENDING) return { ok: false, message: "Transfer is not pending" };
  await db.update(schema.interIdTransfers).set({ status: INTER_ID_STATUS.REJECTED }).where(eq(schema.interIdTransfers.id, id));
  return { ok: true };
}
