"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { markAlertRead, markAllAlertsReadGlobal, getAlertById } from "@/lib/db/queries/alerts";
import { approveCrCaught, rejectCrCaught } from "@/lib/db/queries/cr-caught";
import { createActivation, deleteActivation, getActivationById } from "@/lib/db/queries/activations";
import { createPurchase, approvePurchaseReview, rejectPurchaseReview } from "@/lib/db/queries/purchases";
import { updateCrossRegionStatus, getCrossRegionById } from "@/lib/db/queries/transfers";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { CROSS_REGION_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import type { QueuedActivation, QueuedPurchase } from "@/lib/offline-queue";

export async function markAlertReadAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  await markAlertRead(id, OWNER_TENANT_ID);
  revalidatePath("/admin/alerts");
}

export async function markAllReadAction(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  await markAllAlertsReadGlobal();
  revalidatePath("/admin/alerts");
}

export async function approveCrCaughtAction(alertId: string, crCaughtId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const ref = await approveCrCaught(crCaughtId);
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "cr.caught_approved", entityType: "cr_caught", entityId: crCaughtId, summary: `Approved CR-caught record ${crCaughtId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Approving deducts stock → recompute rebates.
  if (ref) await reEvaluateRebatesForDealer(ref.tenantId, ref.dealerId, ref.modelId, ref.caughtDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

export async function rejectCrCaughtAction(alertId: string, crCaughtId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const ref = await rejectCrCaught(crCaughtId);
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "cr.caught_rejected", entityType: "cr_caught", entityId: crCaughtId, summary: `Rejected CR-caught record ${crCaughtId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // Removing restores stock → recompute rebates.
  if (ref) await reEvaluateRebatesForDealer(ref.tenantId, ref.dealerId, ref.modelId, ref.caughtDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

export async function approvePurchaseReviewAction(alertId: string, purchaseId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const p = await approvePurchaseReview(purchaseId, OWNER_TENANT_ID);
  if (!p) return { error: "Purchase not found (may already be approved)" };
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "purchase.review_approved", entityType: "purchase", entityId: purchaseId, summary: `Owner approved large purchase ${purchaseId.slice(0, 8)} — now counts toward stock & incentives` });
  revalidatePath("/admin/alerts");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  // Approved purchase now adds stock → rebate eligibility may shift.
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, p.dealerId, p.modelId, p.purchaseDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

export async function rejectPurchaseReviewAction(alertId: string, purchaseId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const p = await rejectPurchaseReview(purchaseId, OWNER_TENANT_ID);
  if (!p) return { error: "Purchase not found (may already be removed)" };
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "purchase.review_rejected", entityType: "purchase", entityId: purchaseId, summary: `Owner rejected large purchase ${purchaseId.slice(0, 8)} — removed` });
  revalidatePath("/admin/alerts");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function approveCrInwardAction(alertId: string, transferId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  // Derive dealerId from the transfer row server-side — never trust the client.
  const transfer = await getCrossRegionById(transferId, OWNER_TENANT_ID);
  if (!transfer) return { error: "Transfer not found" };
  const result = await updateCrossRegionStatus({
    id: transferId, tenantId: OWNER_TENANT_ID, dealerId: transfer.dealerId,
    status: CROSS_REGION_STATUS.SHIFTED_TO_MY_ID, priceTenantId: OWNER_TENANT_ID,
  });
  if (!result.ok) return { error: result.message ?? "Approval failed" };
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "cross_region.approved", entityType: "cross_region_transfer", entityId: transferId, summary: `Owner approved CR inward ${transferId.slice(0, 8)} — shifted into ID` });
  revalidatePath("/admin/alerts");
  revalidatePath("/cross-region");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  // New back-dated stock may make it eligible for an earlier price-drop rebate → recompute.
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, transfer.dealerId, transfer.modelId, transfer.reportedDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true };
}

export async function rejectCrInwardAction(alertId: string, transferId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const transfer = await getCrossRegionById(transferId, OWNER_TENANT_ID);
  if (!transfer) return { error: "Transfer not found" };
  const result = await updateCrossRegionStatus({
    id: transferId, tenantId: OWNER_TENANT_ID, dealerId: transfer.dealerId, status: CROSS_REGION_STATUS.REJECTED,
  });
  if (!result.ok) return { error: result.message ?? "Rejection failed" };
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "cross_region.rejected", entityType: "cross_region_transfer", entityId: transferId, summary: `Owner rejected CR inward ${transferId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/cross-region");
  return { ok: true };
}

export async function approveActivationDeletionAction(alertId: string, activationId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const activation = await getActivationById(activationId, dealerId, OWNER_TENANT_ID);
  if (!activation) return { error: "Activation not found (may have already been deleted)" };
  await deleteActivation(activationId, dealerId, OWNER_TENANT_ID);
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "activation.delete_approved", entityType: "activation", entityId: activationId, summary: `Owner approved deletion of activation ${activationId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function approveOfflineActivationAction(alertId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const alert = await getAlertById(alertId, OWNER_TENANT_ID);
  if (!alert?.payload) return { error: "Alert not found or missing data" };
  const item = JSON.parse(alert.payload) as QueuedActivation;
  try {
    for (let i = 0; i < item.quantity; i++) {
      await createActivation({
        tenantId: item.tenantId,
        dealerId: item.dealerId,
        modelId: item.modelId,
        activationDate: item.activationDate,
        imei: item.quantity === 1 && item.imei ? item.imei : null,
        purchaseId: null,
        isCrossRegion: item.isCrossRegion,
      });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Activation failed" };
  }
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "offline_activation.approved", entityType: "offline_activation", entityId: alertId, summary: `Approved offline activation: ${item.modelName} × ${item.quantity}` });
  reEvaluateRebatesForDealer(OWNER_TENANT_ID, item.dealerId, item.modelId, item.activationDate).catch(
    (e: unknown) => console.error("[rebate-reeval]", e),
  );
  revalidatePath("/admin/alerts");
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function approveOfflinePurchaseAction(alertId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const alert = await getAlertById(alertId, OWNER_TENANT_ID);
  if (!alert?.payload) return { error: "Alert not found or missing data" };
  const item = JSON.parse(alert.payload) as QueuedPurchase;
  try {
    await createPurchase({
      tenantId: item.tenantId,
      dealerId: item.dealerId,
      modelId: item.modelId,
      quantity: item.quantity,
      purchaseDate: item.purchaseDate,
      unitDealerPrice: item.unitDealerPrice,
      unitInvoicePrice: item.unitInvoicePrice,
      source: item.source as Parameters<typeof createPurchase>[0]["source"],
      referenceNote: item.referenceNote ?? null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Purchase creation failed" };
  }
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "offline_purchase.approved", entityType: "offline_purchase", entityId: alertId, summary: `Approved offline purchase: ${item.modelName} × ${item.quantity}` });
  reEvaluateRebatesForDealer(OWNER_TENANT_ID, item.dealerId, item.modelId, item.purchaseDate).catch(
    (e: unknown) => console.error("[rebate-reeval]", e),
  );
  revalidatePath("/admin/alerts");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectOfflineItemAction(alertId: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  await markAlertRead(alertId, OWNER_TENANT_ID);
  await logAudit({ action: "offline_item.rejected", entityType: "offline_item", entityId: alertId, summary: `Owner rejected offline queued item` });
  revalidatePath("/admin/alerts");
}
