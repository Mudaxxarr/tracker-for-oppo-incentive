import { getDealerSession } from "@/lib/dealer-auth";
import { redirect } from "next/navigation";
import { listActiveScripts } from "@/lib/db/queries/scripts";
import { DealerScriptsClient } from "./dealer-scripts-client";

export const metadata = { title: "Sales Scripts" };

export default async function DealerScriptsPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const scripts = await listActiveScripts();
  return <DealerScriptsClient scripts={scripts} />;
}
