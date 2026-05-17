"use server";

import { revalidatePath } from "next/cache";
import { getDealerSession } from "@/lib/dealer-auth";
import { listDealerIdsForTenant, setActiveDealerIdForTenant } from "@/lib/dealer-tenant";

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
