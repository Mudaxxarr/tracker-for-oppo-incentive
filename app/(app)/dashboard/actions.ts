"use server";

import { db, schema } from "@/lib/db/client";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { isAnyAuthenticated } from "@/lib/auth";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { getCrCaughtLoss } from "@/lib/db/queries/cr-caught";
import { sumRebatesForPeriod } from "@/lib/db/queries/rebates";
import { getConstants } from "@/lib/settings";
import type { IncentiveReport } from "@/lib/incentive-engine/types";

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
        eq(schema.activations.tenantId, OWNER_TENANT_ID),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to)
      )
    )
    .groupBy(schema.activations.modelId, schema.models.name)
    .orderBy(asc(schema.models.name));

  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

export interface DashboardPeriodResult {
  report: IncentiveReport;
  modelSales: ModelSaleRow[];
  crLoss: { lostIncentive: number; totalUnits: number };
  rebateTotal: number;
}

export async function getDashboardPeriodAction(
  from: string,
  to: string
): Promise<DashboardPeriodResult | null> {
  if (!(await isAnyAuthenticated())) return null;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return null;
  const constants = await getConstants();
  const [report, modelSales, crLoss, rebateTotal] = await Promise.all([
    buildIncentiveReport({ dealerId, periodStart: from, periodEnd: to }),
    getModelSalesAction(from, to),
    getCrCaughtLoss(OWNER_TENANT_ID, dealerId, from, to, constants.basePercent),
    sumRebatesForPeriod(OWNER_TENANT_ID, dealerId, from, to),
  ]);
  return { report, modelSales, crLoss, rebateTotal };
}
