import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listTenantFeatureMatrix } from "@/lib/admin/dealers";
import { RolloutClient } from "./rollout-client";

export const metadata = { title: "Staged Rollout" };

export default async function AdminRolloutPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const tenants = await listTenantFeatureMatrix();
  return <RolloutClient tenants={tenants} />;
}
