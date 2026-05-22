"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import {
  createCustomer,
  getCustomerById,
  linkActivationToCustomer,
  searchCustomers,
} from "@/lib/db/queries/customers";
import { logAudit } from "@/lib/audit";

export type CustomerFormState = { error?: string; ok?: boolean; id?: string };

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  phone: z.string().trim().min(7, "Valid phone required").max(30),
  cnic: z.string().trim().max(20).optional().nullable(),
});

export async function createCustomerAction(
  _prev: CustomerFormState,
  fd: FormData
): Promise<CustomerFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = CreateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = await createCustomer({
    tenantId: OWNER_TENANT_ID,
    dealerId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    cnic: parsed.data.cnic ?? null,
  });
  await logAudit({
    action: "customer.create",
    entityType: "customer",
    entityId: id,
    summary: `Created customer "${parsed.data.name}" (${parsed.data.phone})`,
  });
  revalidatePath("/customers");
  return { ok: true, id };
}

export async function linkActivationAction(
  activationId: string,
  customerId: string | null
): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  await linkActivationToCustomer(activationId, customerId, OWNER_TENANT_ID, dealerId);
  revalidatePath("/customers");
  revalidatePath("/activations");
  return {};
}

export async function searchCustomersAction(query: string) {
  if (!(await isAuthenticated())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];
  return searchCustomers(OWNER_TENANT_ID, dealerId, query);
}
