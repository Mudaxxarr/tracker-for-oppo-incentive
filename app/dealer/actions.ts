"use server";

import { redirect } from "next/navigation";
import { endDealerSession } from "@/lib/dealer-auth";

export async function logoutAction(): Promise<void> {
  await endDealerSession();
  redirect("/dealer/login");
}
