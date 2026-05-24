import { NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { buildExcel } from "@/lib/export/report-excel";
import { buildPDF } from "@/lib/export/report-pdf";
import { buildDetailedPDF } from "@/lib/export/report-pdf-detailed";
import { buildPolicyAchievements } from "@/lib/report-utils";
import { logAudit } from "@/lib/audit";
import { db, schema } from "@/lib/db/client";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await getDealerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeDealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!activeDealerId) return NextResponse.json({ error: "No active Dealer ID" }, { status: 400 });

  const url = new URL(req.url);
  const periodStart = url.searchParams.get("periodStart");
  const periodEnd = url.searchParams.get("periodEnd");
  const fmt = (url.searchParams.get("format") ?? "pdf").toLowerCase();
  const skipNoIncentive = url.searchParams.get("skipNoIncentive") === "1";

  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "periodEnd must be on or after periodStart" }, { status: 400 });
  }

  const [dealerRow, report] = await Promise.all([
    db
      .select({ name: schema.dealerIds.name })
      .from(schema.dealerIds)
      .where(eq(schema.dealerIds.id, activeDealerId))
      .limit(1),
    buildIncentiveReport({ dealerId: activeDealerId, periodStart, periodEnd, dataTenantId: session.tenantId }),
  ]);
  const dealerName = dealerRow[0]?.name ?? activeDealerId;

  if (fmt === "detailed-pdf") {
    const policies = await buildPolicyAchievements(activeDealerId, periodStart, periodEnd, report);
    const buffer = await buildDetailedPDF(report, dealerName, policies);
    const baseName = `OPPO_Detailed_Breakup_${dealerName.replace(/\s+/g, "_")}_${periodStart}_${periodEnd}`;
    await logAudit({
      action: "report.export",
      dealerId: activeDealerId,
      entityType: "report",
      summary: `[Dealer] Exported Detailed Breakup PDF (${periodStart}→${periodEnd})`,
      payload: { format: "detailed-pdf", periodStart, periodEnd },
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  if (fmt === "pdf") {
    const policies = await buildPolicyAchievements(activeDealerId, periodStart, periodEnd, report);
    const suffix = skipNoIncentive ? "_incentive-models" : "";
    const baseName = `OPPO_Report_${dealerName.replace(/\s+/g, "_")}_${periodStart}_${periodEnd}${suffix}`;
    const buffer = await buildPDF(report, dealerName, { skipNoIncentive, policies });
    await logAudit({
      action: "report.export",
      dealerId: activeDealerId,
      entityType: "report",
      summary: `[Dealer] Exported PDF (${periodStart}→${periodEnd})${skipNoIncentive ? " [incentive only]" : ""}`,
      payload: { format: "pdf", periodStart, periodEnd, skipNoIncentive },
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  if (fmt === "xlsx") {
    const [rawActivations, rawPurchases] = await Promise.all([
      db
        .select({
          activationDate: schema.activations.activationDate,
          modelName: schema.models.name,
          imei: schema.activations.imei,
          dealerPriceSnapshot: schema.activations.dealerPriceSnapshot,
          isCrossRegion: schema.activations.isCrossRegion,
        })
        .from(schema.activations)
        .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
        .where(and(
          eq(schema.activations.tenantId, session.tenantId),
          eq(schema.activations.dealerId, activeDealerId),
          gte(schema.activations.activationDate, periodStart),
          lte(schema.activations.activationDate, periodEnd),
        ))
        .orderBy(asc(schema.activations.activationDate), asc(schema.models.name)),
      db
        .select({
          purchaseDate: schema.purchases.purchaseDate,
          modelName: schema.models.name,
          quantity: schema.purchases.quantity,
          unitDealerPrice: schema.purchases.unitDealerPrice,
          unitInvoicePrice: schema.purchases.unitInvoicePrice,
          source: schema.purchases.source,
          referenceNote: schema.purchases.referenceNote,
        })
        .from(schema.purchases)
        .innerJoin(schema.models, eq(schema.models.id, schema.purchases.modelId))
        .where(and(
          eq(schema.purchases.tenantId, session.tenantId),
          eq(schema.purchases.dealerId, activeDealerId),
          gte(schema.purchases.purchaseDate, periodStart),
          lte(schema.purchases.purchaseDate, periodEnd),
        ))
        .orderBy(asc(schema.purchases.purchaseDate), asc(schema.models.name)),
    ]);

    const suffix = skipNoIncentive ? "_incentive-models" : "";
    const baseName = `OPPO_Report_${dealerName.replace(/\s+/g, "_")}_${periodStart}_${periodEnd}${suffix}`;
    const buffer = await buildExcel(report, dealerName, { skipNoIncentive, activations: rawActivations, purchases: rawPurchases });
    await logAudit({
      action: "report.export",
      dealerId: activeDealerId,
      entityType: "report",
      summary: `[Dealer] Exported Excel (${periodStart}→${periodEnd})${skipNoIncentive ? " [incentive only]" : ""}`,
      payload: { format: "xlsx", periodStart, periodEnd, skipNoIncentive },
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format" }, { status: 400 });
}
