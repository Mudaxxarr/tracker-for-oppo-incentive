"use server";

import { redirect } from "next/navigation";
import { endDealerSession } from "@/lib/dealer-auth";

export async function exitAdminPreviewAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  await endDealerSession();
  redirect(tenantId ? `/admin/dealers/${tenantId}` : "/admin/dealers");
}
