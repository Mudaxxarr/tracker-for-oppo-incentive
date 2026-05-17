import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CROSS_REGION_STATUS, INTER_ID_STATUS, PURCHASE_SOURCE } from "@/lib/constants";
import { getPriceOnDate } from "./models";

// ===== Cross-Region =====

export interface CrossRegionRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  reportedDate: string;
  shiftedToIdDate: string | null;
  status: string;
  sourceRegionNote: string | null;
}

export async function listCrossRegion(dealerId: string): Promise<CrossRegionRow[]> {
  return db
    .select({
      id: schema.crossRegionTransfers.id,
      modelId: schema.crossRegionTransfers.modelId,
      modelName: schema.models.name,
      quantity: schema.crossRegionTransfers.quantity,
      reportedDate: schema.crossRegionTransfers.reportedDate,
      shiftedToIdDate: schema.crossRegionTransfers.shiftedToIdDate,
      status: schema.crossRegionTransfers.status,
      sourceRegionNote: schema.crossRegionTransfers.sourceRegionNote,
    })
    .from(schema.crossRegionTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.crossRegionTransfers.modelId))
    .where(eq(schema.crossRegionTransfers.dealerId, dealerId))
    .orderBy(desc(schema.crossRegionTransfers.reportedDate));
}

export async function countPendingCrossRegion(dealerId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.crossRegionTransfers)
    .where(
      and(
        eq(schema.crossRegionTransfers.dealerId, dealerId),
        eq(schema.crossRegionTransfers.status, CROSS_REGION_STATUS.PENDING_REPORT)
      )
    );
  return Number(n);
}

export async function createCrossRegion(input: {
  dealerId: string;
  modelId: string;
  quantity: number;
  reportedDate: string;
  sourceRegionNote: string | null;
}) {
  const id = randomUUID();
  await db.insert(schema.crossRegionTransfers).values({
    id,
    dealerId: input.dealerId,
    modelId: input.modelId,
    quantity: input.quantity,
    reportedDate: input.reportedDate,
    shiftedToIdDate: null,
    sourceRegionNote: input.sourceRegionNote,
    status: CROSS_REGION_STATUS.PENDING_REPORT,
  });
  return id;
}

export async function updateCrossRegionStatus(input: {
  id: string;
  dealerId: string;
  status: "PENDING_REPORT" | "SHIFTED_TO_MY_ID" | "REJECTED";
}) {
  // Fetch first
  const rows = await db
    .select()
    .from(schema.crossRegionTransfers)
    .where(
      and(
        eq(schema.crossRegionTransfers.id, input.id),
        eq(schema.crossRegionTransfers.dealerId, input.dealerId)
      )
    )
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Not found" };
  const transfer = rows[0];
  const today = new Date().toISOString().slice(0, 10);

  if (input.status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID) {
    if (transfer.status !== CROSS_REGION_STATUS.PENDING_REPORT) {
      return { ok: false, message: "Only pending transfers can be shifted to your ID" };
    }
    // Auto-create linked purchases at current price.
    const price = await getPriceOnDate(transfer.modelId, today);
    if (!price) return { ok: false, message: "No dealer price defined for this model" };
    await db.insert(schema.purchases).values({
      id: randomUUID(),
      dealerId: transfer.dealerId,
      modelId: transfer.modelId,
      quantity: transfer.quantity,
      unitDealerPrice: price.dealerPrice,
      unitInvoicePrice: price.invoicePrice,
      purchaseDate: today,
      source: PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN,
      referenceNote: `Cross-region: ${transfer.sourceRegionNote ?? "—"}`,
      crossRegionTransferId: transfer.id,
    });
    await db
      .update(schema.crossRegionTransfers)
      .set({ status: input.status, shiftedToIdDate: today })
      .where(eq(schema.crossRegionTransfers.id, transfer.id));
    return { ok: true, created: transfer.quantity };
  }

  await db
    .update(schema.crossRegionTransfers)
    .set({ status: input.status })
    .where(eq(schema.crossRegionTransfers.id, transfer.id));
  return { ok: true };
}

export async function deleteCrossRegion(id: string, dealerId: string) {
  // Also remove linked purchases (FK cascade is set-null on purchases, but we want full cleanup here).
  await db
    .delete(schema.purchases)
    .where(
      and(
        eq(schema.purchases.dealerId, dealerId),
        eq(schema.purchases.crossRegionTransferId, id)
      )
    );
  await db
    .delete(schema.crossRegionTransfers)
    .where(
      and(
        eq(schema.crossRegionTransfers.id, id),
        eq(schema.crossRegionTransfers.dealerId, dealerId)
      )
    );
}

// ===== Inter-ID Transfers =====

export interface InterIdRow {
  id: string;
  fromDealerId: string;
  toDealerId: string;
  modelId: string;
  modelName: string;
  quantity: number;
  transferDate: string;
  note: string | null;
  status: string;
}

export interface PendingTransferRow {
  id: string;
  fromDealerId: string;
  fromDealerName: string;
  modelId: string;
  modelName: string;
  quantity: number;
  transferDate: string;
  note: string | null;
}

export async function listInterIdTransfers(dealerId: string): Promise<InterIdRow[]> {
  return db
    .select({
      id: schema.interIdTransfers.id,
      fromDealerId: schema.interIdTransfers.fromDealerId,
      toDealerId: schema.interIdTransfers.toDealerId,
      modelId: schema.interIdTransfers.modelId,
      modelName: schema.models.name,
      quantity: schema.interIdTransfers.quantity,
      transferDate: schema.interIdTransfers.transferDate,
      note: schema.interIdTransfers.note,
      status: schema.interIdTransfers.status,
    })
    .from(schema.interIdTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
    .where(
      or(
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.toDealerId, dealerId)
      )
    )
    .orderBy(desc(schema.interIdTransfers.transferDate));
}

/** Pending inbound transfers that need the destination dealer to accept or reject. */
export async function listPendingInbound(toDealerId: string): Promise<PendingTransferRow[]> {
  return db
    .select({
      id: schema.interIdTransfers.id,
      fromDealerId: schema.interIdTransfers.fromDealerId,
      fromDealerName: schema.dealerIds.name,
      modelId: schema.interIdTransfers.modelId,
      modelName: schema.models.name,
      quantity: schema.interIdTransfers.quantity,
      transferDate: schema.interIdTransfers.transferDate,
      note: schema.interIdTransfers.note,
    })
    .from(schema.interIdTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.interIdTransfers.fromDealerId))
    .where(
      and(
        eq(schema.interIdTransfers.toDealerId, toDealerId),
        eq(schema.interIdTransfers.status, INTER_ID_STATUS.PENDING)
      )
    )
    .orderBy(desc(schema.interIdTransfers.transferDate));
}

/**
 * Create an inter-ID transfer in PENDING state.
 * No purchase row is created yet — that only happens on acceptance.
 */
export async function createInterIdTransfer(input: {
  fromDealerId: string;
  toDealerId: string;
  modelId: string;
  quantity: number;
  transferDate: string;
  note: string | null;
}) {
  if (input.fromDealerId === input.toDealerId) {
    throw new Error("Source and destination must be different dealer IDs");
  }
  const id = randomUUID();
  await db.insert(schema.interIdTransfers).values({
    id,
    fromDealerId: input.fromDealerId,
    toDealerId: input.toDealerId,
    modelId: input.modelId,
    quantity: input.quantity,
    transferDate: input.transferDate,
    note: input.note,
    status: INTER_ID_STATUS.PENDING,
  });
  return id;
}

/**
 * Destination dealer accepts the transfer.
 * Creates the purchase row for the destination and marks the transfer ACCEPTED.
 */
export async function acceptInterIdTransfer(
  id: string,
  toDealerId: string
): Promise<{ ok: boolean; message?: string }> {
  const rows = await db
    .select()
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.id, id),
        eq(schema.interIdTransfers.toDealerId, toDealerId)
      )
    )
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Transfer not found" };
  const transfer = rows[0];
  if (transfer.status !== INTER_ID_STATUS.PENDING) {
    return { ok: false, message: "Transfer is not pending" };
  }

  const price = await getPriceOnDate(transfer.modelId, transfer.transferDate);
  if (!price) {
    return { ok: false, message: "No dealer price defined for this model on the transfer date" };
  }

  await db.insert(schema.purchases).values({
    id: randomUUID(),
    dealerId: toDealerId,
    modelId: transfer.modelId,
    quantity: transfer.quantity,
    unitDealerPrice: price.dealerPrice,
    unitInvoicePrice: price.invoicePrice,
    purchaseDate: transfer.transferDate,
    source: PURCHASE_SOURCE.REGULAR,
    referenceNote: `Inter-ID transfer in (${id.slice(0, 8)})`,
  });

  await db
    .update(schema.interIdTransfers)
    .set({ status: INTER_ID_STATUS.ACCEPTED })
    .where(eq(schema.interIdTransfers.id, id));

  return { ok: true };
}

/**
 * Destination dealer rejects the transfer.
 * No purchase row is created; the source's stock is restored.
 */
export async function rejectInterIdTransfer(
  id: string,
  toDealerId: string
): Promise<{ ok: boolean; message?: string }> {
  const rows = await db
    .select()
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.id, id),
        eq(schema.interIdTransfers.toDealerId, toDealerId)
      )
    )
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Transfer not found" };
  const transfer = rows[0];
  if (transfer.status !== INTER_ID_STATUS.PENDING) {
    return { ok: false, message: "Transfer is not pending" };
  }

  await db
    .update(schema.interIdTransfers)
    .set({ status: INTER_ID_STATUS.REJECTED })
    .where(eq(schema.interIdTransfers.id, id));

  return { ok: true };
}
