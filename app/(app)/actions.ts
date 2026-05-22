"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDealerIdById, setActiveDealerId } from "@/lib/dealer";
import { endSession, isAuthenticated } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function switchDealerAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  const dealer = await getDealerIdById(id);
  if (!dealer) return;
  await setActiveDealerId(id);
  await logAudit({
    action: "dealer.switch",
    entityType: "dealer_id",
    entityId: id,
    summary: `Switched active dealer ID to ${dealer.name}`,
    dealerId: id,
  });
  revalidatePath("/", "layout");
}

export async function lockAction(): Promise<void> {
  await logAudit({ action: "auth.logout", summary: "Admin signed out" });
  await endSession();
  redirect("/login");
}
