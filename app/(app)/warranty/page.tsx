import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { listAllWarrantyClaims } from "@/lib/db/queries/warranty-claims";
import { WarrantyClient } from "./warranty-client";

export const metadata = { title: "Warranty Claims" };

export default async function WarrantyPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const claims = await listAllWarrantyClaims(OWNER_TENANT_ID);
  return <WarrantyClient initialClaims={claims} />;
}
