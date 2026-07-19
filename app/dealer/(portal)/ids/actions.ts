"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDealerSession } from "@/lib/dealer-auth";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { listDealerIdsForTenant, setActiveDealerIdForTenant, getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { db, schema } from "@/lib/db/client";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import {
  createInterIdTransfer,
  listInterIdTransfers,
  acceptInterIdTransfer,
  rejectInterIdTransfer,
} from "@/lib/db/queries/transfers";
import { listStockForDealer, getStockForModelAsOf } from "@/lib/db/queries/purchases";
import { and, eq, gte, sql } from "drizzle-orm";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getDealerIdsAction() {
  const session = await requireSession();
  return listDealerIdsForTenant(session.tenantId);
}

export async function setActiveDealerAction(id: string): Promise<void> {
  const session = await requireSession();
  const all = await listDealerIdsForTenant(session.tenantId);
  if (!all.find((d) => d.id === id)) throw new Error("Invalid dealer ID.");
  await setActiveDealerIdForTenant(id);
  revalidatePath("/dealer");
}

export type DealerIdFormState = { error?: string; ok?: boolean };

export async function createDealerTenantIdAction(
  _prev: DealerIdFormState,
  fd: FormData,
): Promise<DealerIdFormState> {
  const session = await requireSession();
  const name = String(fd.get("name") ?? "").trim();
  const shopName = String(fd.get("shopName") ?? "").trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name must be 120 characters or fewer." };
  if (!shopName) return { error: "Shop name is required." };
  if (shopName.length > 120) return { error: "Shop name must be 120 characters or fewer." };

  // Locked decision: only the first Dealer ID is self-service.
  // Additional IDs require admin approval (separate subscription fee).
  const existing = await listDealerIdsForTenant(session.tenantId);
  if (existing.length > 0) {
    return { error: "Additional Dealer IDs require admin approval. Contact your OPPO account manager." };
  }

  const id = randomUUID();
  await db.insert(schema.dealerIds).values({
    id,
    tenantId: session.tenantId,
    name,
    shopName,
    note: null,
    isActive: true,
  });
  await logAudit({
    action: "dealer_id.create",
    entityType: "dealer_id",
    entityId: id,
    summary: `Created Dealer ID "${name}"`,
    dealerId: id,
  });
  revalidatePath("/dealer/ids");
  revalidatePath("/dealer");
  return { ok: true };
}

// ── Inter-ID Transfers ──────────────────────────────────────────────────────

const TransferSchema = z.object({
  fromDealerId: z.string().min(1),
  toDealerId: z.string().min(1),
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(300).optional(),
});

export async function createDealerInterIdTransferAction(
  _prev: DealerIdFormState,
  fd: FormData,
): Promise<DealerIdFormState> {
  const session = await requireSession();
  const { tenantId } = session;

  const parsed = TransferSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const d = parsed.data;
  if (d.fromDealerId === d.toDealerId) return { error: "Source and destination must be different." };

  // Validate both dealer IDs belong to this tenant
  const allIds = await listDealerIdsForTenant(tenantId);
  const fromValid = allIds.find((x) => x.id === d.fromDealerId);
  const toValid = allIds.find((x) => x.id === d.toDealerId);
  if (!fromValid || !toValid) return { error: "Invalid dealer ID." };

  let stockError: string | null = null;
  let id: string | undefined;
  await db.transaction(async (tx) => {
    // Check stock on transfer date
    const stock = await getStockForModelAsOf(tenantId, d.fromDealerId, d.modelId, d.transferDate, tx);
    if (stock < d.quantity) {
      stockError = `Only ${stock} unit(s) available as of ${d.transferDate}.`;
      return;
    }
    id = await createInterIdTransfer({
      tenantId,
      fromDealerId: d.fromDealerId,
      toDealerId: d.toDealerId,
      modelId: d.modelId,
      quantity: d.quantity,
      transferDate: d.transferDate,
      note: d.note ?? null,
    }, tx);
  });
  if (stockError) return { error: stockError };
  if (!id) return { error: "Transfer failed" };
  await logAudit({
    action: "inter_id_transfer.create",
    summary: `[Dealer] Transfer ${d.quantity} units from ${fromValid.name} → ${toValid.name}`,
    entityType: "inter_id_transfer",
    entityId: id,
    dealerId: d.fromDealerId,
  });
  revalidatePath("/dealer/ids");
  revalidatePath("/dealer/inventory");
  return { ok: true };
}

export async function acceptDealerTransferAction(transferId: string): Promise<void> {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");
  const result = await acceptInterIdTransfer(tenantId, transferId, dealerId, OWNER_TENANT_ID);
  if (!result.ok) throw new Error(result.message ?? "Failed to accept transfer.");
  await logAudit({ action: "inter_id_transfer.accept", summary: `Accepted transfer ${transferId.slice(0, 8)}`, dealerId });
  revalidatePath("/dealer/ids");
  revalidatePath("/dealer/inventory");
  revalidatePath("/dealer/dashboard");
}

export async function rejectDealerTransferAction(transferId: string): Promise<void> {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");
  const result = await rejectInterIdTransfer(tenantId, transferId, dealerId);
  if (!result.ok) throw new Error(result.message ?? "Failed to reject transfer.");
  await logAudit({ action: "inter_id_transfer.reject", summary: `Rejected transfer ${transferId.slice(0, 8)}`, dealerId });
  revalidatePath("/dealer/ids");
  revalidatePath("/dealer/inventory");
}

export async function getDealerIdStatsAction(dealerIds: string[]) {
  // SECURITY: tenantId must come from the verified session, never a caller-
  // supplied argument — this is a "use server" action and therefore directly
  // network-callable with arbitrary arguments, bypassing whatever page/session
  // check the current UI happens to perform before invoking it.
  const session = await requireSession();
  const tenantId = session.tenantId;
  if (dealerIds.length === 0) return {};
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startStr = startOfMonth.toISOString().slice(0, 10);

  const stats = await Promise.all(
    dealerIds.map(async (id) => {
      const activations = await db
        .select()
        .from(schema.activations)
        .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, id)));
      const monthly = activations.filter((a) => a.activationDate >= startStr);
      const baseFour = monthly.reduce((s, a) => s + a.dealerPriceSnapshot * 0.04, 0);
      const lastDate = activations.reduce<string | null>(
        (m, a) => (m && a.activationDate <= m ? m : a.activationDate),
        null,
      );
      return { id, phoneCount: activations.length, thisMonthBase: baseFour, lastActivity: lastDate };
    }),
  );

  return Object.fromEntries(stats.map((s) => [s.id, s]));
}
