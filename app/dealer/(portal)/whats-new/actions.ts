"use server";

import { getDealerSession } from "@/lib/dealer-auth";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { getPreview, type PreviewKey } from "@/lib/dealer-previews";
import { redirect } from "next/navigation";

export async function requestPurchaseAction(formData: FormData): Promise<void> {
  const session = await getDealerSession();
  if (!session) throw new Error("Not authenticated");

  const key = formData.get("key") as PreviewKey;
  const preview = getPreview(key);
  if (!preview) throw new Error("Unknown feature");

  await createOwnerAlert({
    tenantId: session.tenantId,
    type: "addon_purchase_request",
    entityType: "dealer_tenant",
    entityId: session.tenantId,
    dealerId: null,
    message: `Purchase request: ${preview.label}${preview.monthlyPrice ? ` (Rs ${preview.monthlyPrice}/mo)` : ""}`,
    payload: JSON.stringify({ key, label: preview.label, monthlyPrice: preview.monthlyPrice }),
  });

  redirect("/dealer/whats-new");
}
