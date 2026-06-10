import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDealerSession } from "@/lib/dealer-auth";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { createActivation } from "@/lib/db/queries/activations";
import { createPurchase, getStockForModelAsOf } from "@/lib/db/queries/purchases";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { db, schema } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { QueuedItem } from "@/lib/offline-queue";

export async function POST(req: Request) {
  let item: QueuedItem;
  try {
    item = (await req.json()) as QueuedItem;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Derive role and tenant from session — never trust item.role or item.tenantId from client
  let effectiveRole: "owner" | "admin" | "exec";
  let trustedTenantId: string;

  if (item.portal === "owner") {
    if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauth" }, { status: 401 });
    effectiveRole = "owner";
    trustedTenantId = OWNER_TENANT_ID;
  } else {
    const session = await getDealerSession();
    if (!session) return NextResponse.json({ error: "Unauth" }, { status: 401 });
    effectiveRole = session.role as "admin" | "exec";
    trustedTenantId = session.tenantId;
  }

  // Verify item.dealerId belongs to the authenticated tenant — prevents IDOR
  const dealerCheck = await db
    .select({ id: schema.dealerIds.id })
    .from(schema.dealerIds)
    .where(and(eq(schema.dealerIds.id, item.dealerId), eq(schema.dealerIds.tenantId, trustedTenantId)))
    .limit(1);
  if (!dealerCheck.length) return NextResponse.json({ error: "Invalid dealer" }, { status: 403 });
  const trustedDealerId = item.dealerId;

  // Verify modelId exists — models are global (no tenantId) but must exist
  const modelCheck = await db
    .select({ id: schema.models.id })
    .from(schema.models)
    .where(eq(schema.models.id, item.modelId))
    .limit(1);
  if (!modelCheck.length) return NextResponse.json({ error: "Invalid model" }, { status: 403 });

  // Look up dealer business name for alert messages
  const tenantRows = await db
    .select({ businessName: schema.dealerTenants.businessName })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, trustedTenantId))
    .limit(1);
  const dealerName = tenantRows[0]?.businessName ?? trustedTenantId;

  const isExec = effectiveRole === "exec";

  if (item.type === "activation") {
    if (isExec) {
      await createOwnerAlert({
        tenantId: OWNER_TENANT_ID,
        type: "offline_activation_pending",
        entityType: "offline_activation",
        entityId: randomUUID(),
        dealerId: trustedDealerId,
        message: `Offline activation — ${dealerName} · ${item.modelName} × ${item.quantity} on ${item.activationDate}`,
        payload: JSON.stringify(item),
      });
    } else {
      // Direct post for admin/owner
      try {
        const stock = await getStockForModelAsOf(
          trustedTenantId, trustedDealerId, item.modelId, item.activationDate,
        );
        if (stock < item.quantity) throw new Error(`Insufficient stock (${stock} available, ${item.quantity} requested)`);
        for (let i = 0; i < item.quantity; i++) {
          await createActivation({
            tenantId: trustedTenantId,
            dealerId: trustedDealerId,
            modelId: item.modelId,
            activationDate: item.activationDate,
            imei: item.quantity === 1 && item.imei ? item.imei : null,
            purchaseId: null,
            isCrossRegion: item.isCrossRegion,
          });
        }
        reEvaluateRebatesForDealer(OWNER_TENANT_ID, trustedDealerId, item.modelId, item.activationDate).catch(
          (e: unknown) => console.error("[rebate-reeval]", e),
        );
      } catch (err) {
        await createOwnerAlert({
          tenantId: OWNER_TENANT_ID,
          type: "offline_conflict",
          entityType: "offline_activation",
          entityId: randomUUID(),
          dealerId: trustedDealerId,
          message: `Offline activation conflict — ${item.modelName} × ${item.quantity} (${dealerName}, ${item.activationDate}): ${err instanceof Error ? err.message : "failed"}`,
          payload: JSON.stringify(item),
        });
      }
    }
  } else if (item.type === "purchase") {
    if (isExec) {
      await createOwnerAlert({
        tenantId: OWNER_TENANT_ID,
        type: "offline_purchase_pending",
        entityType: "offline_purchase",
        entityId: randomUUID(),
        dealerId: trustedDealerId,
        message: `Offline purchase — ${dealerName} · ${item.modelName} × ${item.quantity} on ${item.purchaseDate}`,
        payload: JSON.stringify(item),
      });
    } else {
      try {
        await createPurchase({
          tenantId: trustedTenantId,
          dealerId: trustedDealerId,
          modelId: item.modelId,
          quantity: item.quantity,
          purchaseDate: item.purchaseDate,
          unitDealerPrice: item.unitDealerPrice,
          unitInvoicePrice: item.unitInvoicePrice,
          source: item.source as Parameters<typeof createPurchase>[0]["source"],
          referenceNote: item.referenceNote ?? null,
        });
        reEvaluateRebatesForDealer(OWNER_TENANT_ID, trustedDealerId, item.modelId, item.purchaseDate).catch(
          (e: unknown) => console.error("[rebate-reeval]", e),
        );
      } catch (err) {
        await createOwnerAlert({
          tenantId: OWNER_TENANT_ID,
          type: "offline_conflict",
          entityType: "offline_purchase",
          entityId: randomUUID(),
          dealerId: trustedDealerId,
          message: `Offline purchase conflict — ${item.modelName} × ${item.quantity} (${dealerName}, ${item.purchaseDate}): ${err instanceof Error ? err.message : "failed"}`,
          payload: JSON.stringify(item),
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
