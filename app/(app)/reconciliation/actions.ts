"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getStaffSession } from "@/lib/staff-auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { getDailyReconciliationRows } from "@/lib/db/queries/reconciliation";
import { createCrCaught } from "@/lib/db/queries/cr-caught";
import { createPurchase, getStockForModelAsOf } from "@/lib/db/queries/purchases";
import { getPriceOnDate, getModelById } from "@/lib/db/queries/models";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import type { ReconciliationRow } from "@/lib/db/queries/reconciliation";

export type ReconcileState = { error?: string; ok?: boolean };

async function assertAccountantOrOwner(): Promise<boolean> {
  const [ownerAuth, staffSession] = await Promise.all([isAuthenticated(), getStaffSession()]);
  return ownerAuth || (staffSession?.role === "accountant");
}

export async function getReconciliationDataAction(date: string): Promise<ReconciliationRow[]> {
  if (!(await assertAccountantOrOwner())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];
  return getDailyReconciliationRows(OWNER_TENANT_ID, dealerId, date);
}

const FlagCRSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional().nullable(),
});

export async function flagCrCaughtAction(input: {
  modelId: string;
  quantity: number;
  date: string;
  note?: string | null;
}): Promise<ReconcileState> {
  if (!(await assertAccountantOrOwner())) return { error: "Not authorized" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = FlagCRSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, quantity, date, note } = parsed.data;

  const stock = await getStockForModelAsOf(tenantId, dealerId, modelId, date);
  if (stock < quantity) return { error: `Only ${stock} unit(s) available as of ${date}` };

  const priceInfo = await getPriceOnDate(tenantId, modelId, date);
  const priceSnap = priceInfo?.dealerPrice ?? 0;
  const m = await getModelById(modelId);

  // Accountant-submitted CR caught goes directly to active (trusted back-office role)
  const id = await createCrCaught({
    tenantId, dealerId, modelId, quantity, caughtDate: date,
    dealerPriceSnapshot: priceSnap,
    note: note ?? `Reconciliation variance — ${date}`,
    status: "active",
  });

  await logAudit({
    action: "cr.caught",
    entityType: "cr_caught",
    entityId: id,
    summary: `[Reconciliation] CR Caught: ${quantity} × ${m?.name ?? "?"} on ${date} (value: ${formatPKR(quantity * priceSnap)})`,
    payload: { modelId, quantity, date },
  });

  revalidatePath("/reconciliation");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

const InwardCRSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

export async function logInwardCRAction(input: {
  modelId: string;
  quantity: number;
  date: string;
}): Promise<ReconcileState> {
  if (!(await assertAccountantOrOwner())) return { error: "Not authorized" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = InwardCRSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modelId, quantity, date } = parsed.data;

  const priceInfo = await getPriceOnDate(tenantId, modelId, date);
  const unitPrice = priceInfo?.dealerPrice ?? 0;
  const m = await getModelById(modelId);

  await createPurchase({
    tenantId, dealerId, modelId, quantity,
    unitDealerPrice: unitPrice,
    unitInvoicePrice: priceInfo?.invoicePrice ?? 0,
    purchaseDate: date,
    source: PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN,
    referenceNote: `Reconciliation: Inward CR — ${date}`,
  });

  await logAudit({
    action: "purchase.create",
    entityType: "purchase",
    summary: `[Reconciliation] Inward CR: ${quantity} × ${m?.name ?? "?"} on ${date} (value: ${formatPKR(quantity * unitPrice)})`,
    payload: { modelId, quantity, date, source: PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN },
  });

  revalidatePath("/reconciliation");
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, date).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}
