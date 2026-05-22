import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  cnic: string | null;
  dealerId: string;
  dealerName: string;
  createdAt: string;
  activationCount: number;
}

export async function createCustomer(input: {
  tenantId: string;
  dealerId: string;
  name: string;
  phone: string;
  cnic?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.customers).values({
    id,
    tenantId: input.tenantId,
    dealerId: input.dealerId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    cnic: input.cnic?.trim() || null,
  });
  return id;
}

export async function getCustomerById(id: string, tenantId: string) {
  const rows = await db
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function searchCustomers(
  tenantId: string,
  dealerId: string,
  query: string,
  limit = 20
): Promise<CustomerRow[]> {
  const q = `%${query}%`;
  const rows = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      phone: schema.customers.phone,
      cnic: schema.customers.cnic,
      dealerId: schema.customers.dealerId,
      dealerName: schema.dealerIds.name,
      createdAt: schema.customers.createdAt,
      activationCount: sql<number>`COUNT(${schema.activations.id})`,
    })
    .from(schema.customers)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.customers.dealerId))
    .leftJoin(
      schema.activations,
      and(
        eq(schema.activations.customerId, schema.customers.id),
        eq(schema.activations.tenantId, tenantId),
      )
    )
    .where(
      and(
        eq(schema.customers.tenantId, tenantId),
        eq(schema.customers.dealerId, dealerId),
        or(
          ilike(schema.customers.name, q),
          ilike(schema.customers.phone, q),
          ilike(schema.customers.cnic, q),
        )
      )
    )
    .groupBy(schema.customers.id, schema.dealerIds.name)
    .orderBy(desc(schema.customers.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, activationCount: Number(r.activationCount) }));
}

export async function listCustomersForDealer(tenantId: string, dealerId: string): Promise<CustomerRow[]> {
  const rows = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      phone: schema.customers.phone,
      cnic: schema.customers.cnic,
      dealerId: schema.customers.dealerId,
      dealerName: schema.dealerIds.name,
      createdAt: schema.customers.createdAt,
      activationCount: sql<number>`COUNT(${schema.activations.id})`,
    })
    .from(schema.customers)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.customers.dealerId))
    .leftJoin(
      schema.activations,
      and(
        eq(schema.activations.customerId, schema.customers.id),
        eq(schema.activations.tenantId, tenantId),
      )
    )
    .where(and(eq(schema.customers.tenantId, tenantId), eq(schema.customers.dealerId, dealerId)))
    .groupBy(schema.customers.id, schema.dealerIds.name)
    .orderBy(desc(schema.customers.createdAt));
  return rows.map((r) => ({ ...r, activationCount: Number(r.activationCount) }));
}

export async function listCustomersForOwner(tenantId: string): Promise<CustomerRow[]> {
  const rows = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      phone: schema.customers.phone,
      cnic: schema.customers.cnic,
      dealerId: schema.customers.dealerId,
      dealerName: schema.dealerIds.name,
      createdAt: schema.customers.createdAt,
      activationCount: sql<number>`COUNT(${schema.activations.id})`,
    })
    .from(schema.customers)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.customers.dealerId))
    .leftJoin(
      schema.activations,
      and(
        eq(schema.activations.customerId, schema.customers.id),
        eq(schema.activations.tenantId, tenantId),
      )
    )
    .where(eq(schema.customers.tenantId, tenantId))
    .groupBy(schema.customers.id, schema.dealerIds.name)
    .orderBy(desc(schema.customers.createdAt));
  return rows.map((r) => ({ ...r, activationCount: Number(r.activationCount) }));
}

export async function linkActivationToCustomer(
  activationId: string,
  customerId: string | null,
  tenantId: string,
  dealerId: string
): Promise<void> {
  await db
    .update(schema.activations)
    .set({ customerId })
    .where(
      and(
        eq(schema.activations.id, activationId),
        eq(schema.activations.tenantId, tenantId),
        eq(schema.activations.dealerId, dealerId),
      )
    );
}

export interface CustomerActivation {
  id: string;
  modelName: string;
  activationDate: string;
  imei: string | null;
  dealerPriceSnapshot: number;
}

export async function getCustomerActivations(
  customerId: string,
  tenantId: string
): Promise<CustomerActivation[]> {
  return db
    .select({
      id: schema.activations.id,
      modelName: schema.models.name,
      activationDate: schema.activations.activationDate,
      imei: schema.activations.imei,
      dealerPriceSnapshot: schema.activations.dealerPriceSnapshot,
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(
      and(
        eq(schema.activations.customerId, customerId),
        eq(schema.activations.tenantId, tenantId),
      )
    )
    .orderBy(desc(schema.activations.activationDate));
}
