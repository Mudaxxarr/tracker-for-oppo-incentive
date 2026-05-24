"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  addDealerTeamMember,
  resetDealerUserPassword,
  toggleDealerTeamMemberActive,
  deleteDealerTeamMember,
} from "@/lib/admin/dealers";

async function requireOwner() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

type AddState = { error?: string; tempPassword?: string; email?: string };

export async function addTeamMemberAction(_prev: AddState, formData: FormData): Promise<AddState> {
  await requireOwner();
  const tenantId = String(formData.get("tenantId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 6) return { error: "Email and password (min 6 chars) are required" };
  const result = await addDealerTeamMember(tenantId, email, password);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/admin/dealers/${tenantId}/team`);
  return { tempPassword: result.tempPassword, email };
}

export async function resetTeamMemberPasswordAction(userId: string, tenantId: string): Promise<{ tempPassword: string; email: string }> {
  await requireOwner();
  const result = await resetDealerUserPassword(userId);
  revalidatePath(`/admin/dealers/${tenantId}/team`);
  return result;
}

export async function toggleTeamMemberActiveAction(userId: string, isActive: boolean, tenantId: string): Promise<void> {
  await requireOwner();
  await toggleDealerTeamMemberActive(userId, isActive);
  revalidatePath(`/admin/dealers/${tenantId}/team`);
}

export async function deleteTeamMemberAction(
  userId: string,
  tenantId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireOwner();
  const result = await deleteDealerTeamMember(userId, tenantId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/admin/dealers/${tenantId}/team`);
  return { ok: true };
}
