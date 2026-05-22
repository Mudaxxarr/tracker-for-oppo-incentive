"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import {
  createCustomer,
  searchCustomers,
  listCustomersForDealer,
  getCustomerActivations,
  linkActivationToCustomer,
} from "@/lib/db/queries/customers";
import { logAudit } from "@/lib/audit";

export type CustomerFormState = { error?: string; ok?: boolean; id?: string };

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  phone: z.string().trim().min(7, "Valid phone required").max(30),
  cnic: z.string().trim().max(20).optional().nullable(),
});

export async function createDealerCustomerAction(
  _prev: CustomerFormState,
  fd: FormData
): Promise<CustomerFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = CreateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = await createCustomer({
    tenantId: session.tenantId,
    dealerId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    cnic: parsed.data.cnic ?? null,
  });
  await logAudit({
    action: "customer.create",
    entityType: "customer",
    entityId: id,
    dealerId,
    summary: `[Dealer] Created customer "${parsed.data.name}" (${parsed.data.phone})`,
  });
  revalidatePath("/dealer/customers");
  return { ok: true, id };
}

export async function searchDealerCustomersAction(query: string) {
  const session = await getDealerSession();
  if (!session) return [];
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return [];
  return searchCustomers(session.tenantId, dealerId, query, 10);
}

export async function listDealerCustomersAction() {
  const session = await getDealerSession();
  if (!session) return [];
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return [];
  return listCustomersForDealer(session.tenantId, dealerId);
}

export async function getCustomerActivationsAction(customerId: string) {
  const session = await getDealerSession();
  if (!session) return [];
  return getCustomerActivations(customerId, session.tenantId);
}

export async function linkDealerActivationAction(
  activationId: string,
  customerId: string | null
): Promise<{ error?: string }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };
  await linkActivationToCustomer(activationId, customerId, session.tenantId, dealerId);
  revalidatePath("/dealer/customers");
  revalidatePath("/dealer/activations");
  return {};
}
