import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAllScripts } from "@/lib/db/queries/scripts";
import { ScriptsClient } from "./scripts-client";

export const metadata = { title: "Sales Scripts" };

export default async function ScriptsPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const scripts = await listAllScripts();
  return <ScriptsClient initialScripts={scripts} />;
}
