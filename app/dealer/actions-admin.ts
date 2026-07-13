"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { endDealerSession } from "@/lib/dealer-auth";
import { resolveManagerReturnPath } from "@/lib/admin/manager";
import { ADMIN_PREVIEW_RETURN_COOKIE } from "@/lib/constants";

export async function exitAdminPreviewAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const cookieStore = await cookies();
  const managerReturn = cookieStore.get(ADMIN_PREVIEW_RETURN_COOKIE)?.value;
  const returnTo = managerReturn
    ? resolveManagerReturnPath(managerReturn, tenantId || undefined)
    : tenantId
      ? `/admin/dealers/${tenantId}`
      : "/admin/dealers";
  await endDealerSession();
  cookieStore.delete(ADMIN_PREVIEW_RETURN_COOKIE);
  redirect(returnTo);
}
