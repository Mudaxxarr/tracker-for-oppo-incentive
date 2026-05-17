"use server";

import { redirect } from "next/navigation";
import { endTeamSession } from "@/lib/auth";

export async function lockTeamAction(): Promise<void> {
  await endTeamSession();
  redirect("/team/unlock");
}
