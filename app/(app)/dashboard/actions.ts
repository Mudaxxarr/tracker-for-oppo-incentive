"use server";

import { db, schema } from "@/lib/db/client";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { isAnyAuthenticated } from "@/lib/auth";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { getCrCaughtLoss, listCrCaughtForPeriod } from "@/lib/db/queries/cr-caught";
import { sumRebatesForPeriod, listRebatesForDealerInPeriod } from "@/lib/db/queries/rebates";
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

export interface RebateDetailRow {
  modelName: string;
  eligibleQty: number;
  rebatePerUnit: number;
}

// Defined here (not re-exported from server-only query file) so the client can import it safely
export interface CrCaughtExportRow {
  modelName: string;
  quantity: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  fineAmount: number;
}

export interface DashboardPeriodResult {
  report: IncentiveReport;
  modelSales: ModelSaleRow[];
  crLoss: { lostIncentive: number; totalUnits: number; totalFines: number; priceUnitSum: number };
  rebateTotal: number;
  rebateRows: RebateDetailRow[];
  crCaughtRows: CrCaughtExportRow[];
}

export async function getDashboardPeriodAction(
  from: string,
  to: string
): Promise<DashboardPeriodResult | null> {
  if (!(await isAnyAuthenticated())) return null;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return null;
  const constants = await getConstants();
  const [report, modelSales, crLoss, rebateTotal, rebateRowsFull, crCaughtRows] = await Promise.all([
    buildIncentiveReport({ dealerId, periodStart: from, periodEnd: to }),
    getModelSalesAction(from, to),
    getCrCaughtLoss(OWNER_TENANT_ID, dealerId, from, to, constants.basePercent),
    sumRebatesForPeriod(OWNER_TENANT_ID, dealerId, from, to),
    listRebatesForDealerInPeriod(OWNER_TENANT_ID, dealerId, from, to),
    listCrCaughtForPeriod(OWNER_TENANT_ID, dealerId, from, to),
  ]);
  const rebateRows: RebateDetailRow[] = rebateRowsFull.map((r) => ({
    modelName: r.modelName,
    eligibleQty: r.eligibleQty,
    rebatePerUnit: r.rebatePerUnit,
  }));
  return { report, modelSales, crLoss, rebateTotal, rebateRows, crCaughtRows };
}
