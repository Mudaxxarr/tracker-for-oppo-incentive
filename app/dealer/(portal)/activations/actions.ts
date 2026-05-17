"use server";

import { revalidatePath } from "next/cache";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listActivations, createActivation, deleteActivation } from "@/lib/db/queries/activations";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function listDealerActivationsAction() {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { activations: [], models: [] };

  const [activations, models] = await Promise.all([
    listActivations({ tenantId, dealerId }),
    listModelsWithCurrentPrice(tenantId),
  ]);
  return { activations, models };
}

const CreateSchema = z.object({
  modelId: z.string().min(1),
  imei: z.string().min(15).max(17),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ActivationFormState = { error?: string; success?: boolean };

export async function createDealerActivationAction(
  _prev: ActivationFormState,
  formData: FormData,
): Promise<ActivationFormState> {
  const session = await requireSession();
  const { tenantId, userId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { error: "No active dealer ID selected." };

  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  try {
    await createActivation({
      tenantId,
      dealerId,
      modelId: d.modelId,
      imei: d.imei,
      activationDate: d.activationDate,
      purchaseId: null,
      isCrossRegion: false,
    });
    await logAudit({
      action: "dealer_activation_created",
      summary: `Dealer activation created: IMEI ${d.imei}`,
      payload: { tenantId, dealerId, imei: d.imei, userId },
      dealerId,
    });
  } catch (err) {
    await logAudit({
      action: "dealer_activation_error",
      summary: `Failed to create activation: ${String(err)}`,
      status: "error",
      payload: { tenantId, dealerId, error: String(err), userId },
      dealerId,
    });
    return { error: String(err) };
  }

  revalidatePath("/dealer/activations");
  return { success: true };
}

export async function deleteDealerActivationAction(id: string): Promise<void> {
  const session = await requireSession();
  const { tenantId, role, userId } = session;
  if (role === "exec") throw new Error("Exec users cannot delete activations.");

  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");

  try {
    await deleteActivation(id, dealerId, tenantId);
    await logAudit({
      action: "dealer_activation_deleted",
      summary: `Dealer activation deleted: ${id}`,
      payload: { tenantId, dealerId, id, userId },
      dealerId,
    });
  } catch (err) {
    await logAudit({
      action: "dealer_activation_delete_error",
      summary: `Failed to delete activation: ${String(err)}`,
      status: "error",
      payload: { tenantId, id, error: String(err), userId },
      dealerId,
    });
    throw new Error("Failed to delete activation", { cause: err });
  }

  revalidatePath("/dealer/activations");
}
