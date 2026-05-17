"use server";

import { db, schema } from "@/lib/db/client";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { getActiveDealerId } from "@/lib/dealer";
import { isAnyAuthenticated } from "@/lib/auth";

export interface ModelSaleRow {
  modelId: string;
  modelName: string;
  qty: number;
}

export async function getModelSalesAction(
  from: string,
  to: string
): Promise<ModelSaleRow[]> {
  if (!(await isAnyAuthenticated())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];

  const rows = await db
    .select({
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(
      and(
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to)
      )
    )
    .groupBy(schema.activations.modelId, schema.models.name)
    .orderBy(asc(schema.models.name));

  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}
