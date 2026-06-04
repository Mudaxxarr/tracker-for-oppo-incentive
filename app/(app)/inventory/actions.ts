"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getActiveDealerId, listDealerIds, OWNER_TENANT_ID } from "@/lib/dealer";
import { createActivation } from "@/lib/db/queries/activations";
import {
  createInterIdTransfer,
  acceptInterIdTransfer,
  rejectInterIdTransfer,
} from "@/lib/db/queries/transfers";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { getStockForModelAsOf, getMinForwardStock } from "@/lib/db/queries/purchases";
import { listInventoryForDealer, type InventoryModelRow } from "@/lib/db/queries/inventory";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { createCrCaught } from "@/lib/db/queries/cr-caught";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { OWNER_ALERT_TYPE } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { formatPKR, todayPKT } from "@/lib/format";
import { db, schema } from "@/lib/db/client";
import { and, asc, eq, sql } from "drizzle-orm";

export type InvActionState = { error?: string; ok?: boolean; pendingApproval?: boolean };

const QuickActivateSchema = z.object({
  modelId: z.string().min(1),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().int().positive(),
});

/** Returns the full inventory snapshot as of a given date (for the inventory date filter). */
export async function getInventoryAsOfAction(date: string): Promise<InventoryModelRow[]> {
  if (!(await isAnyAuthenticated())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return listInventoryForDealer(OWNER_TENANT_ID, dealerId, undefined, date);
}

export async function quickActivateAction(
  _prev: InvActionState,
  fd: FormData
): Promise<InvActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = QuickActivateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, activationDate, quantity } = parsed.data;

  if (activationDate > todayPKT()) return { error: "Activation date cannot be in the future." };

  // Forward-minimum stock guards backdating oversell across later dates.
  const stock = await getMinForwardStock(tenantId, dealerId, modelId, activationDate);
  if (stock < quantity) {
    return { error: `Only ${stock} unit(s) available from ${activationDate} onward` };
  }

  for (let i = 0; i < quantity; i++) {
    await createActivation({
      tenantId,
      dealerId,
      modelId,
      activationDate,
      imei: null,
      purchaseId: null,
      isCrossRegion: false,
    });
  }

  const m = await getModelById(modelId);
  await logAudit({
    action: "activation.quick_create",
    entityType: "activation",
    summary: `Quick activated ${quantity} × ${m?.name ?? "?"} on ${activationDate}`,
    payload: { modelId, activationDate, quantity },
  });

  revalidatePath("/inventory");
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, activationDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

const QuickMoveSchema = z.object({
  modelId: z.string().min(1),
  toDealerId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export async function quickMoveAction(
  _prev: InvActionState,
  fd: FormData
): Promise<InvActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = QuickMoveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, toDealerId, quantity, transferDate, note } = parsed.data;

  if (toDealerId === dealerId) return { error: "Source and destination must be different" };

  // Forward-minimum stock guards backdating oversell across later dates.
  const stockAsOf = await getMinForwardStock(tenantId, dealerId, modelId, transferDate);
  if (stockAsOf < quantity) {
    return {
      error: `Only ${stockAsOf} unit(s) available from ${transferDate} onward`,
    };
  }

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
      entityType: "inter_id_transfer",
      entityId: id,
      summary: `Quick move: ${quantity} × ${m?.name ?? "?"} → ${dst[0]?.name ?? toDealerId} (pending acceptance)`,
      payload: parsed.data,
    });

    revalidatePath("/inventory");
    revalidatePath("/ids");
    revalidatePath("/purchases");
    revalidatePath("/dashboard");
    // Transfer-out reduces sender stock → recompute rebates from the transfer date.
    await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, transferDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Transfer failed" };
  }
}

export async function acceptTransferAction(
  _prev: InvActionState,
  fd: FormData
): Promise<InvActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };

  const id = fd.get("transferId") as string;
  if (!id) return { error: "Missing transfer ID" };

  const result = await acceptInterIdTransfer(OWNER_TENANT_ID, id, dealerId);
  if (!result.ok) return { error: result.message ?? "Failed to accept" };

  await logAudit({
    action: "inter_id.accepted",
    entityType: "inter_id_transfer",
    entityId: id,
    summary: `Accepted incoming inter-ID transfer ${id.slice(0, 8)}`,
    payload: { transferId: id },
  });

  revalidatePath("/inventory");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectTransferAction(
  _prev: InvActionState,
  fd: FormData
): Promise<InvActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };

  const id = fd.get("transferId") as string;
  if (!id) return { error: "Missing transfer ID" };

  const result = await rejectInterIdTransfer(OWNER_TENANT_ID, id, dealerId);
  if (!result.ok) return { error: result.message ?? "Failed to reject" };

  await logAudit({
    action: "inter_id.rejected",
    entityType: "inter_id_transfer",
    entityId: id,
    summary: `Rejected incoming inter-ID transfer ${id.slice(0, 8)}`,
    payload: { transferId: id },
  });

  revalidatePath("/inventory");
  revalidatePath("/ids");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Returns stock available for a model as of a given date (for client-side UI feedback). */
export async function getStockAsOfAction(modelId: string, date: string): Promise<number> {
  if (!(await isAuthenticated())) return 0;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return 0;
  return getStockForModelAsOf(OWNER_TENANT_ID, dealerId, modelId, date);
}

// ---- CR Caught ----

const CrCaughtSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  fineAmount: z.coerce.number().min(0).optional(),
  caughtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export async function crCaughtAction(
  _prev: InvActionState,
  fd: FormData
): Promise<InvActionState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = CrCaughtSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, quantity, fineAmount, caughtDate, note } = parsed.data;

  const stock = await getMinForwardStock(tenantId, dealerId, modelId, caughtDate);
  if (stock < quantity) return { error: `Only ${stock} unit(s) available from ${caughtDate} onward` };

  const priceInfo = await getPriceOnDate(tenantId, modelId, caughtDate);
  const priceSnap = priceInfo?.dealerPrice ?? 0;

  const isOwner = await isAuthenticated();
  // SO-submitted CR-caught requires owner approval before stock is deducted
  const status = isOwner ? "active" : "pending_owner_approval";

  const id = await createCrCaught({ tenantId, dealerId, modelId, quantity, fineAmount: fineAmount ?? 0, caughtDate, dealerPriceSnapshot: priceSnap, note: note ?? null, status });
  const m = await getModelById(modelId);

  if (!isOwner) {
    await createOwnerAlert({
      tenantId,
      type: OWNER_ALERT_TYPE.CR_CAUGHT_PENDING_APPROVAL,
      entityType: "cr_caught",
      entityId: id,
      dealerId,
      message: `SO reported CR-caught: ${quantity} × ${m?.name ?? "?"} on ${caughtDate} (value: ${formatPKR(quantity * priceSnap)}) — approve to deduct from stock.`,
    });
  }

  await logAudit({
    action: "cr.caught",
    entityType: "cr_caught",
    summary: `CR Caught${isOwner ? "" : " (pending approval)"}: ${quantity} × ${m?.name ?? "?"} on ${caughtDate}`,
    payload: { modelId, quantity, caughtDate, status },
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Owner-created CR-caught deducts stock immediately → recompute rebates.
  if (isOwner && quantity > 0) await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, caughtDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true, pendingApproval: !isOwner };
}

const CashFineSchema = z.object({
  modelId: z.string().min(1),
  fineAmount: z.coerce.number().positive(),
  caughtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export async function cashFineAction(
  _prev: InvActionState,
  fd: FormData
): Promise<InvActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = CashFineSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, fineAmount, caughtDate, note } = parsed.data;

  const m = await getModelById(modelId);
  const id = await createCrCaught({ tenantId, dealerId, modelId, quantity: 0, fineAmount, caughtDate, dealerPriceSnapshot: 0, note: note ?? null, status: "active" });

  await logAudit({
    action: "cr.cash_fine",
    entityType: "cr_caught",
    entityId: id,
    summary: `Cash fine recorded: ${formatPKR(fineAmount)} for ${m?.name ?? "?"} on ${caughtDate}`,
    payload: { modelId, fineAmount, caughtDate },
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---- History ----

export interface StockEvent {
  date: string;
  type: "purchase" | "activation" | "transfer_out" | "transfer_in";
  qty: number;         // always positive; sign implied by type
  note: string | null;
  runningBalance: number;
}

export async function getModelHistoryAction(modelId: string): Promise<StockEvent[]> {
  if (!(await isAuthenticated())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];
  const tenantId = OWNER_TENANT_ID;

  const dealers = await listDealerIds();
  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? id.slice(0, 8);

  // Purchases (inbound)
  const purchases = await db
    .select({
      date: schema.purchases.purchaseDate,
      qty: schema.purchases.quantity,
      source: schema.purchases.source,
      note: schema.purchases.referenceNote,
    })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId)))
    .orderBy(asc(schema.purchases.purchaseDate));

  // Activations (outbound)
  const activations = await db
    .select({
      date: schema.activations.activationDate,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId)))
    .groupBy(schema.activations.activationDate)
    .orderBy(asc(schema.activations.activationDate));

  // Inter-ID outbound (PENDING + ACCEPTED; exclude REJECTED)
  const transfersOut = await db
    .select({
      date: schema.interIdTransfers.transferDate,
      qty: schema.interIdTransfers.quantity,
      toDealerId: schema.interIdTransfers.toDealerId,
      note: schema.interIdTransfers.note,
      status: schema.interIdTransfers.status,
    })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId)
      )
    )
    .orderBy(asc(schema.interIdTransfers.transferDate));

  // Inter-ID inbound (ACCEPTED only)
  const transfersIn = await db
    .select({
      date: schema.interIdTransfers.transferDate,
      qty: schema.interIdTransfers.quantity,
      fromDealerId: schema.interIdTransfers.fromDealerId,
      note: schema.interIdTransfers.note,
    })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.toDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        eq(schema.interIdTransfers.status, "ACCEPTED")
      )
    )
    .orderBy(asc(schema.interIdTransfers.transferDate));

  // Build raw events (without running balance first)
  const raw: Omit<StockEvent, "runningBalance">[] = [];

  for (const p of purchases) {
    // Skip inter-ID in purchase rows — they appear as transfer_in events directly
    if (p.note?.startsWith("Inter-ID transfer in")) continue;
    raw.push({
      date: p.date,
      type: "purchase",
      qty: p.qty,
      note: p.source === "CROSS_REGION_TRANSFER_IN"
        ? `Cross-region: ${p.note ?? "—"}`
        : (p.note ?? null),
    });
  }

  for (const a of activations) {
    raw.push({ date: a.date, type: "activation", qty: Number(a.qty), note: null });
  }

  for (const t of transfersOut) {
    if (t.status === "REJECTED") continue;
    raw.push({
      date: t.date,
      type: "transfer_out",
      qty: t.qty,
      note: `To: ${dealerName(t.toDealerId)}${t.status === "PENDING" ? " (pending)" : ""}${t.note ? ` — ${t.note}` : ""}`,
    });
  }

  for (const t of transfersIn) {
    raw.push({
      date: t.date,
      type: "transfer_in",
      qty: t.qty,
      note: `From: ${dealerName(t.fromDealerId)}${t.note ? ` — ${t.note}` : ""}`,
    });
  }

  // Sort by date asc, then compute running balance
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let balance = 0;
  return raw.map((e) => {
    if (e.type === "purchase" || e.type === "transfer_in") balance += e.qty;
    else balance -= e.qty;
    return { ...e, runningBalance: balance };
  }).reverse(); // newest first for display
}
