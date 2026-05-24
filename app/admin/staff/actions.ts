"use server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { createOwnerStaff, resetOwnerStaffPassword, toggleOwnerStaffActive, deleteOwnerStaff } from "@/lib/staff-auth";
import type { StaffRole } from "@/lib/constants";

async function requireOwner() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

type StaffFormState = { error?: string; tempPassword?: string };

export async function createStaffAction(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  await requireOwner();
  const username = (formData.get("username") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const role = (formData.get("role") as string | null) as StaffRole;
  if (!["so", "accountant"].includes(role)) return { error: "Invalid role" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  const result = await createOwnerStaff({ username, password, role });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/staff");
  return { tempPassword: result.tempPassword };
}

export async function resetStaffPasswordAction(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  await requireOwner();
  const staffId = (formData.get("staffId") as string | null) ?? "";
  const result = await resetOwnerStaffPassword(staffId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/staff");
  return { tempPassword: result.tempPassword };
}

export async function toggleStaffActiveAction(staffId: string, isActive: boolean): Promise<void> {
  await requireOwner();
  await toggleOwnerStaffActive(staffId, isActive);
  revalidatePath("/admin/staff");
}

export async function deleteStaffAction(staffId: string): Promise<void> {
  await requireOwner();
  await deleteOwnerStaff(staffId);
  revalidatePath("/admin/staff");
}
