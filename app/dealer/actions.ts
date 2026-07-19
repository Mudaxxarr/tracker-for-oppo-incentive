"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { endDealerSession, getDealerSession } from "@/lib/dealer-auth";
import { listDealerIdsForTenant, setActiveDealerIdForTenant } from "@/lib/dealer-tenant";

export async function logoutAction(): Promise<void> {
  await endDealerSession();
  redirect("/dealer/login");
}

/** Switch the dealer's active Dealer ID (used by the multi-ID top-bar switcher).
 *  Scoped to the caller's tenant — an id outside it is silently ignored. */
export async function switchActiveDealerIdAction(id: string): Promise<void> {
  const session = await getDealerSession();
  if (!session) return;
  const ids = await listDealerIdsForTenant(session.tenantId);
  if (!ids.some((d) => d.id === id)) return;
  await setActiveDealerIdForTenant(id);
  revalidatePath("/", "layout");
}
