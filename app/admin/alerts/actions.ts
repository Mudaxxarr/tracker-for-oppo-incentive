"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { markAlertRead, markAllAlertsReadGlobal } from "@/lib/db/queries/alerts";
import { approveCrCaught, rejectCrCaught } from "@/lib/db/queries/cr-caught";
import { deleteActivation, getActivationById } from "@/lib/db/queries/activations";
import { approvePurchaseReview, rejectPurchaseReview } from "@/lib/db/queries/purchases";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { logAudit } from "@/lib/audit";

export async function markAlertReadAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  await markAlertRead(id);
  revalidatePath("/admin/alerts");
}

export async function markAllReadAction(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  await markAllAlertsReadGlobal();
  revalidatePath("/admin/alerts");
}

export async function approveCrCaughtAction(alertId: string, crCaughtId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  await approveCrCaught(crCaughtId);
  await markAlertRead(alertId);
  await logAudit({ action: "cr.caught_approved", entityType: "cr_caught", entityId: crCaughtId, summary: `Approved CR-caught record ${crCaughtId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectCrCaughtAction(alertId: string, crCaughtId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  await rejectCrCaught(crCaughtId);
  await markAlertRead(alertId);
  await logAudit({ action: "cr.caught_rejected", entityType: "cr_caught", entityId: crCaughtId, summary: `Rejected CR-caught record ${crCaughtId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/inventory");
  return { ok: true };
}

export async function approvePurchaseReviewAction(alertId: string, purchaseId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const p = await approvePurchaseReview(purchaseId, OWNER_TENANT_ID);
  if (!p) return { error: "Purchase not found (may already be approved)" };
  await markAlertRead(alertId);
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
  await markAlertRead(alertId);
  await logAudit({ action: "purchase.review_rejected", entityType: "purchase", entityId: purchaseId, summary: `Owner rejected large purchase ${purchaseId.slice(0, 8)} — removed` });
  revalidatePath("/admin/alerts");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function approveActivationDeletionAction(alertId: string, activationId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const activation = await getActivationById(activationId, dealerId, OWNER_TENANT_ID);
  if (!activation) return { error: "Activation not found (may have already been deleted)" };
  await deleteActivation(activationId, dealerId, OWNER_TENANT_ID);
  await markAlertRead(alertId);
  await logAudit({ action: "activation.delete_approved", entityType: "activation", entityId: activationId, summary: `Owner approved deletion of activation ${activationId.slice(0, 8)}` });
  revalidatePath("/admin/alerts");
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  return { ok: true };
}
