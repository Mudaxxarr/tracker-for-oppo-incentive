"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant, listDealerIdsForTenant } from "@/lib/dealer-tenant";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { createActivation } from "@/lib/db/queries/activations";
import {
  createInterIdTransfer,
  acceptInterIdTransfer,
  rejectInterIdTransfer,
} from "@/lib/db/queries/transfers";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { getStockForModelAsOf } from "@/lib/db/queries/purchases";
import { createCrCaught } from "@/lib/db/queries/cr-caught";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";
import { db, schema } from "@/lib/db/client";
import { and, asc, eq, sql } from "drizzle-orm";

export type InvActionState = { error?: string; ok?: boolean };

export interface StockEvent {
  date: string;
  type: "purchase" | "activation" | "transfer_out" | "transfer_in";
  qty: number;
  note: string | null;
  runningBalance: number;
}

async function requireDealer() {
  const session = await getDealerSession();
  if (!session) throw new Error("Not authenticated");
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) throw new Error("No active Dealer ID");
  return { session, dealerId };
}

const QuickActivateSchema = z.object({
  modelId: z.string().min(1),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().int().positive(),
});

export async function dealerQuickActivateAction(
  _prev: InvActionState,
  fd: FormData,
): Promise<InvActionState> {
  let session, dealerId;
  try { ({ session, dealerId } = await requireDealer()); }
  catch (e) { return { error: (e as Error).message }; }

  const parsed = QuickActivateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, activationDate, quantity } = parsed.data;
  const tenantId = session.tenantId;

  const stock = await getStockForModelAsOf(tenantId, dealerId, modelId, activationDate);
  if (stock < quantity) return { error: `Only ${stock} unit(s) available as of ${activationDate}` };

  const price = await getPriceOnDate(OWNER_TENANT_ID, modelId, activationDate);
  if (!price) return { error: "No dealer price defined for this model on or before the activation date" };

  for (let i = 0; i < quantity; i++) {
    await createActivation({
      tenantId,
      dealerId,
      modelId,
      activationDate,
      imei: null,
      purchaseId: null,
      isCrossRegion: false,
      dealerPriceOverride: price.dealerPrice,
    });
  }

  const m = await getModelById(modelId);
  await logAudit({
    action: "activation.quick_create",
    dealerId,
    entityType: "activation",
    summary: `[Dealer] Quick activated ${quantity} × ${m?.name ?? "?"} on ${activationDate}`,
    payload: { modelId, activationDate, quantity },
  });

  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  return { ok: true };
}

const QuickMoveSchema = z.object({
  modelId: z.string().min(1),
  toDealerId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export async function dealerQuickMoveAction(
  _prev: InvActionState,
  fd: FormData,
): Promise<InvActionState> {
  let session, dealerId;
  try { ({ session, dealerId } = await requireDealer()); }
  catch (e) { return { error: (e as Error).message }; }

  const parsed = QuickMoveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, toDealerId, quantity, transferDate, note } = parsed.data;
  const tenantId = session.tenantId;

  if (toDealerId === dealerId) return { error: "Source and destination must be different" };

  const stockAsOf = await getStockForModelAsOf(tenantId, dealerId, modelId, transferDate);
  if (stockAsOf < quantity) return { error: `Only ${stockAsOf} unit(s) available as of ${transferDate}` };

  try {
    const id = await createInterIdTransfer({
      tenantId,
      fromDealerId: dealerId,
      toDealerId,
      modelId,
      quantity,
      transferDate,
      note: note ?? null,
    });

    const [m, dst] = await Promise.all([
      getModelById(modelId),
      db.select().from(schema.dealerIds).where(eq(schema.dealerIds.id, toDealerId)).limit(1),
    ]);

    await logAudit({
      action: "inter_id.transfer",
      dealerId,
      entityType: "inter_id_transfer",
      entityId: id,
      summary: `[Dealer] Quick move: ${quantity} × ${m?.name ?? "?"} → ${dst[0]?.name ?? toDealerId} (pending acceptance)`,
      payload: parsed.data,
    });

    revalidatePath("/dealer/inventory");
    revalidatePath("/dealer/ids");
    revalidatePath("/dealer/purchases");
    revalidatePath("/dealer/dashboard");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Transfer failed" };
  }
}

export async function dealerAcceptTransferAction(
  _prev: InvActionState,
  fd: FormData,
): Promise<InvActionState> {
  let session, dealerId;
  try { ({ session, dealerId } = await requireDealer()); }
  catch (e) { return { error: (e as Error).message }; }

  const id = fd.get("transferId") as string;
  if (!id) return { error: "Missing transfer ID" };

  const result = await acceptInterIdTransfer(session.tenantId, id, dealerId);
  if (!result.ok) return { error: result.message ?? "Failed to accept" };

  await logAudit({
    action: "inter_id.accepted",
    dealerId,
    entityType: "inter_id_transfer",
    entityId: id,
    summary: `[Dealer] Accepted incoming inter-ID transfer ${id.slice(0, 8)}`,
  });

  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/dashboard");
  return { ok: true };
}

export async function dealerRejectTransferAction(
  _prev: InvActionState,
  fd: FormData,
): Promise<InvActionState> {
  let session, dealerId;
  try { ({ session, dealerId } = await requireDealer()); }
  catch (e) { return { error: (e as Error).message }; }

  const id = fd.get("transferId") as string;
  if (!id) return { error: "Missing transfer ID" };

  const result = await rejectInterIdTransfer(session.tenantId, id, dealerId);
  if (!result.ok) return { error: result.message ?? "Failed to reject" };

  await logAudit({
    action: "inter_id.rejected",
    dealerId,
    entityType: "inter_id_transfer",
    entityId: id,
    summary: `[Dealer] Rejected incoming inter-ID transfer ${id.slice(0, 8)}`,
  });

  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/ids");
  revalidatePath("/dealer/dashboard");
  return { ok: true };
}

export async function dealerGetStockAsOfAction(modelId: string, date: string): Promise<number> {
  const session = await getDealerSession();
  if (!session) return 0;
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return 0;
  return getStockForModelAsOf(session.tenantId, dealerId, modelId, date);
}

const CrCaughtSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  caughtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export async function dealerCrCaughtAction(
  _prev: InvActionState,
  fd: FormData,
): Promise<InvActionState> {
  let session, dealerId;
  try { ({ session, dealerId } = await requireDealer()); }
  catch (e) { return { error: (e as Error).message }; }

  const parsed = CrCaughtSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, quantity, caughtDate, note } = parsed.data;
  const tenantId = session.tenantId;

  const stock = await getStockForModelAsOf(tenantId, dealerId, modelId, caughtDate);
  if (stock < quantity) return { error: `Only ${stock} unit(s) available as of ${caughtDate}` };

  const priceInfo = await getPriceOnDate(OWNER_TENANT_ID, modelId, caughtDate);
  const priceSnap = priceInfo?.dealerPrice ?? 0;

  await createCrCaught({ tenantId, dealerId, modelId, quantity, caughtDate, dealerPriceSnapshot: priceSnap, note: note ?? null });

  const m = await getModelById(modelId);
  await logAudit({
    action: "cr.caught",
    dealerId,
    entityType: "cr_caught",
    summary: `[Dealer] CR Caught: ${quantity} × ${m?.name ?? "?"} on ${caughtDate} (lost ${formatPKR(quantity * priceSnap * 0.05)})`,
    payload: { modelId, quantity, caughtDate },
  });

  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/dashboard");
  return { ok: true };
}

export interface DayReceiptRow {
  modelId: string;
  modelName: string;
  qty: number;
  source: "purchase" | "cross_region" | "transfer_in";
  note: string | null;
}

export async function dealerGetReceiptsOnDateAction(date: string): Promise<DayReceiptRow[]> {
  const session = await getDealerSession();
  if (!session) return [];
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return [];
  const tenantId = session.tenantId;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(date)) return [];

  const [purchases, transfers] = await Promise.all([
    db
      .select({
        modelId: schema.purchases.modelId,
        modelName: schema.models.name,
        qty: schema.purchases.quantity,
        source: schema.purchases.source,
        note: schema.purchases.referenceNote,
      })
      .from(schema.purchases)
      .innerJoin(schema.models, eq(schema.models.id, schema.purchases.modelId))
      .where(
        and(
          eq(schema.purchases.tenantId, tenantId),
          eq(schema.purchases.dealerId, dealerId),
          eq(schema.purchases.purchaseDate, date),
        ),
      ),
    db
      .select({
        modelId: schema.interIdTransfers.modelId,
        modelName: schema.models.name,
        qty: schema.interIdTransfers.quantity,
        note: schema.interIdTransfers.note,
      })
      .from(schema.interIdTransfers)
      .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
      .where(
        and(
          eq(schema.interIdTransfers.tenantId, tenantId),
          eq(schema.interIdTransfers.toDealerId, dealerId),
          eq(schema.interIdTransfers.transferDate, date),
          eq(schema.interIdTransfers.status, "ACCEPTED"),
        ),
      ),
  ]);

  const result: DayReceiptRow[] = [];
  for (const p of purchases) {
    result.push({
      modelId: p.modelId,
      modelName: p.modelName,
      qty: p.qty,
      source: p.source === "CROSS_REGION_TRANSFER_IN" ? "cross_region" : "purchase",
      note: p.note ?? null,
    });
  }
  for (const t of transfers) {
    result.push({ modelId: t.modelId, modelName: t.modelName, qty: t.qty, source: "transfer_in", note: t.note ?? null });
  }
  return result;
}

export async function dealerGetModelHistoryAction(modelId: string): Promise<StockEvent[]> {
  const session = await getDealerSession();
  if (!session) return [];
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return [];
  const tenantId = session.tenantId;

  const allDealers = await listDealerIdsForTenant(tenantId);
  const dealerName = (id: string) => allDealers.find((d) => d.id === id)?.name ?? id.slice(0, 8);

  const [purchases, activations, transfersOut, transfersIn] = await Promise.all([
    db.select({ date: schema.purchases.purchaseDate, qty: schema.purchases.quantity, source: schema.purchases.source, note: schema.purchases.referenceNote })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId)))
      .orderBy(asc(schema.purchases.purchaseDate)),
    db.select({ date: schema.activations.activationDate, qty: sql<number>`COUNT(*)`.as("qty") })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId)))
      .groupBy(schema.activations.activationDate)
      .orderBy(asc(schema.activations.activationDate)),
    db.select({ date: schema.interIdTransfers.transferDate, qty: schema.interIdTransfers.quantity, toDealerId: schema.interIdTransfers.toDealerId, note: schema.interIdTransfers.note, status: schema.interIdTransfers.status })
      .from(schema.interIdTransfers)
      .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.fromDealerId, dealerId), eq(schema.interIdTransfers.modelId, modelId)))
      .orderBy(asc(schema.interIdTransfers.transferDate)),
    db.select({ date: schema.interIdTransfers.transferDate, qty: schema.interIdTransfers.quantity, fromDealerId: schema.interIdTransfers.fromDealerId, note: schema.interIdTransfers.note })
      .from(schema.interIdTransfers)
      .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, dealerId), eq(schema.interIdTransfers.modelId, modelId), eq(schema.interIdTransfers.status, "ACCEPTED")))
      .orderBy(asc(schema.interIdTransfers.transferDate)),
  ]);

  const raw: Omit<StockEvent, "runningBalance">[] = [];

  for (const p of purchases) {
    if (p.note?.startsWith("Inter-ID transfer in")) continue;
    raw.push({
      date: p.date, type: "purchase", qty: p.qty,
      note: p.source === "CROSS_REGION_TRANSFER_IN" ? `Cross-region: ${p.note ?? "—"}` : (p.note ?? null),
    });
  }
  for (const a of activations) {
    raw.push({ date: a.date, type: "activation", qty: Number(a.qty), note: null });
  }
  for (const t of transfersOut) {
    if (t.status === "REJECTED") continue;
    raw.push({ date: t.date, type: "transfer_out", qty: t.qty, note: `To: ${dealerName(t.toDealerId)}${t.status === "PENDING" ? " (pending)" : ""}${t.note ? ` — ${t.note}` : ""}` });
  }
  for (const t of transfersIn) {
    raw.push({ date: t.date, type: "transfer_in", qty: t.qty, note: `From: ${dealerName(t.fromDealerId)}${t.note ? ` — ${t.note}` : ""}` });
  }

  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let balance = 0;
  return raw.map((e) => {
    if (e.type === "purchase" || e.type === "transfer_in") balance += e.qty;
    else balance -= e.qty;
    return { ...e, runningBalance: balance };
  }).reverse();
}
