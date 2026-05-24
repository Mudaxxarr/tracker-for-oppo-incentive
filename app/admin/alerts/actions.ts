"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { markAlertRead, markAllAlertsReadGlobal } from "@/lib/db/queries/alerts";
import { approveCrCaught, rejectCrCaught } from "@/lib/db/queries/cr-caught";
import { deleteActivation, getActivationById } from "@/lib/db/queries/activations";
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
