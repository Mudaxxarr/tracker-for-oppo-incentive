"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { addPriceEntry, updatePriceEntry, deletePriceEntry, syncAllActivationSnapshots } from "@/lib/db/queries/models";
import { logAudit } from "@/lib/audit";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

const OWNER_ONLY_ERR = "Model management is owner-only. Contact your OPPO account manager.";

export type ModelFormState = { error?: string; ok?: boolean; id?: string };

// ---------- Model CRUD: OWNER-ONLY ----------
export async function createDealerModelAction(_prev: ModelFormState, _fd: FormData): Promise<ModelFormState> {
  await requireSession(); return { error: OWNER_ONLY_ERR };
}
export async function updateDealerModelAction(_prev: ModelFormState, _fd: FormData): Promise<ModelFormState> {
  await requireSession(); return { error: OWNER_ONLY_ERR };
}
export async function deleteDealerModelAction(_modelId: string): Promise<{ ok: boolean; error?: string }> {
  try { await requireSession(); } catch { return { ok: false, error: "Not authenticated" }; }
  return { ok: false, error: OWNER_ONLY_ERR };
}

// ---------- Price management: dealer-scoped (writes to session.tenantId) ----------
const AddPriceSchema = z.object({
  modelId: z.string().min(1),
  dealerPrice: z.coerce.number().nonnegative(),
  invoicePrice: z.coerce.number().nonnegative(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addDealerPriceEntryAction(
  _prev: ModelFormState,
  fd: FormData,
): Promise<ModelFormState> {
  let session;
  try { session = await requireSession(); } catch (e) { return { error: (e as Error).message }; }
  if (session.role !== "admin") return { error: "Only dealer admin can manage prices." };

  const parsed = AddPriceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, dealerPrice, invoicePrice, effectiveFrom } = parsed.data;
  const id = await addPriceEntry(session.tenantId, { modelId, dealerPrice, invoicePrice, effectiveFrom });

  await logAudit({
    action: "model_price.add",
    summary: `[Dealer] Price set: model ${modelId} → ${dealerPrice} from ${effectiveFrom}`,
    payload: { modelId, dealerPrice, invoicePrice, effectiveFrom },
  });
  revalidatePath("/dealer/models");
  return { ok: true, id };
}

export async function updateDealerPriceEntryAction(input: {
  modelId: string; priceId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string;
}): Promise<{ ok: boolean; error?: string }> {
  let session;
  try { session = await requireSession(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  if (session.role !== "admin") return { ok: false, error: "Only dealer admin can manage prices." };

  const parsed = z.object({
    modelId: z.string().min(1),
    priceId: z.string().min(1),
    dealerPrice: z.coerce.number().nonnegative(),
    invoicePrice: z.coerce.number().nonnegative(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await updatePriceEntry(session.tenantId, parsed.data);
  await logAudit({ action: "model_price.update", summary: `[Dealer] Price entry ${input.priceId.slice(0, 8)} updated`, payload: input });
  revalidatePath("/dealer/models");
  return { ok: true };
}

export async function deleteDealerPriceEntryAction(input: {
  modelId: string; priceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  let session;
  try { session = await requireSession(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  if (session.role !== "admin") return { ok: false, error: "Only dealer admin can manage prices." };

  const result = await deletePriceEntry(session.tenantId, input);
  if (!result.ok) return { ok: false, error: result.reason };

  await logAudit({ action: "model_price.delete", summary: `[Dealer] Price entry ${input.priceId.slice(0, 8)} removed`, payload: input });
  revalidatePath("/dealer/models");
  return { ok: true };
}

export async function syncDealerActivationPricesAction(): Promise<{ ok: boolean; modelsProcessed?: number; error?: string }> {
  let session;
  try { session = await requireSession(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  if (session.role !== "admin") return { ok: false, error: "Only dealer admin can sync prices." };

  const result = await syncAllActivationSnapshots(session.tenantId);
  revalidatePath("/dealer/models");
  return { ok: true, modelsProcessed: result.modelsProcessed };
}
