"use server";

import { getDealerSession } from "@/lib/dealer-auth";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

const OWNER_ONLY_ERR =
  "Model prices are set by your OPPO account manager and apply to all dealers automatically. Contact your account manager to change a price.";

export type ModelFormState = { error?: string; ok?: boolean; id?: string };

// ── Model + Price management: OWNER-ONLY ─────────────────────────────────────
// Dealers can VIEW the central price catalog (read from the owner tenant) but
// cannot create/edit models or change prices. Prices are configured once by the
// admin and apply to every dealer's purchases, activations and rebates instantly.
export async function createDealerModelAction(_prev: ModelFormState, _fd: FormData): Promise<ModelFormState> {
  await requireSession();
  return { error: OWNER_ONLY_ERR };
}
export async function updateDealerModelAction(_prev: ModelFormState, _fd: FormData): Promise<ModelFormState> {
  await requireSession();
  return { error: OWNER_ONLY_ERR };
}
export async function deleteDealerModelAction(_modelId: string): Promise<{ ok: boolean; error?: string }> {
  try { await requireSession(); } catch { return { ok: false, error: "Not authenticated" }; }
  return { ok: false, error: OWNER_ONLY_ERR };
}

export async function addDealerPriceEntryAction(_prev: ModelFormState, _fd: FormData): Promise<ModelFormState> {
  await requireSession();
  return { error: OWNER_ONLY_ERR };
}
export async function updateDealerPriceEntryAction(_input: {
  modelId: string; priceId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string;
}): Promise<{ ok: boolean; error?: string }> {
  try { await requireSession(); } catch { return { ok: false, error: "Not authenticated" }; }
  return { ok: false, error: OWNER_ONLY_ERR };
}
export async function deleteDealerPriceEntryAction(_input: {
  modelId: string; priceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try { await requireSession(); } catch { return { ok: false, error: "Not authenticated" }; }
  return { ok: false, error: OWNER_ONLY_ERR };
}
