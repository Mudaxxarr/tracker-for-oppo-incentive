import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listOwnerStaff } from "@/lib/staff-auth";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export default async function StaffManagementPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const rawStaff = await listOwnerStaff();
  const staff = rawStaff.map((s) => ({
    ...s,
    createdAt: String(s.createdAt),
  }));
  return <StaffClient staff={staff} />;
}
