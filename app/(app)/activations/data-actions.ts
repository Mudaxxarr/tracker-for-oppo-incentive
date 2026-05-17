"use server";

import { db, schema } from "@/lib/db/client";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { isAuthenticated } from "@/lib/auth";

export interface ModelQtyRow {
  modelId: string;
  modelName: string;
  qty: number;
}

export interface DailyModelRow {
  date: string;
  models: ModelQtyRow[];
}

/** Aggregate activations by model for a date range. */
export async function getActivationSummaryAction(
  from: string,
  to: string
): Promise<ModelQtyRow[]> {
  if (!(await isAuthenticated())) return [];
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
        eq(schema.activations.tenantId, OWNER_TENANT_ID),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to)
      )
    )
    .groupBy(schema.activations.modelId, schema.models.name)
    .orderBy(desc(sql`COUNT(*)`), asc(schema.models.name));

  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

/** Activations per day per model for the last N days (for daily-cards view). */
export async function getDailyActivationsAction(
  from: string,
  to: string
): Promise<DailyModelRow[]> {
  if (!(await isAuthenticated())) return [];
  const dealerId = await getActiveDealerId();
  if (!dealerId) return [];

  const rows = await db
    .select({
      date: schema.activations.activationDate,
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(
      and(
        eq(schema.activations.tenantId, OWNER_TENANT_ID),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to)
      )
    )
    .groupBy(
      schema.activations.activationDate,
      schema.activations.modelId,
      schema.models.name
    )
    .orderBy(desc(schema.activations.activationDate), asc(schema.models.name));

  // Group by date
  const byDate = new Map<string, ModelQtyRow[]>();
  for (const r of rows) {
    const entry = byDate.get(r.date) ?? [];
    entry.push({ modelId: r.modelId, modelName: r.modelName, qty: Number(r.qty) });
    byDate.set(r.date, entry);
  }

  return [...byDate.entries()]
    .map(([date, models]) => ({ date, models }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
