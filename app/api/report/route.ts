import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { getDealerIdById, OWNER_TENANT_ID } from "@/lib/dealer";
import { buildExcel } from "@/lib/export/report-excel";
import { buildPDF } from "@/lib/export/report-pdf";
import { buildDetailedPDF } from "@/lib/export/report-pdf-detailed";
import { buildPolicyAchievements } from "@/lib/report-utils";
import { logAudit } from "@/lib/audit";
import { db, schema } from "@/lib/db/client";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dealerId = url.searchParams.get("dealerId");
  const periodStart = url.searchParams.get("periodStart");
  const periodEnd = url.searchParams.get("periodEnd");
  const fmt = (url.searchParams.get("format") ?? "pdf").toLowerCase();
  const skipNoIncentive = url.searchParams.get("skipNoIncentive") === "1";

  if (!dealerId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
    return NextResponse.json({ error: "Invalid date format — expected YYYY-MM-DD" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "periodEnd must be on or after periodStart" }, { status: 400 });
  }

  const dealer = await getDealerIdById(dealerId);
  if (!dealer) return NextResponse.json({ error: "Unknown Dealer ID" }, { status: 404 });

  const report = await buildIncentiveReport({ dealerId, periodStart, periodEnd });

  if (fmt === "detailed-pdf") {
    const policies = await buildPolicyAchievements(dealerId, periodStart, periodEnd, report);
    const buffer = await buildDetailedPDF(report, dealer.name, policies);
    const baseName = `OPPO_Detailed_Breakup_${dealer.name.replace(/\s+/g, "_")}_${periodStart}_${periodEnd}`;
    await logAudit({
      action: "report.export",
      entityType: "report",
      summary: `Exported Detailed Breakup PDF for ${dealer.name} (${periodStart}→${periodEnd})`,
      payload: { format: "detailed-pdf", periodStart, periodEnd },
      dealerId,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  if (fmt === "pdf") {
    const policies = await buildPolicyAchievements(dealerId, periodStart, periodEnd, report);
    const suffix = skipNoIncentive ? "_incentive-models" : "";
    const baseName = `OPPO_Report_${dealer.name.replace(/\s+/g, "_")}_${periodStart}_${periodEnd}${suffix}`;
    const buffer = await buildPDF(report, dealer.name, { skipNoIncentive, policies });
    await logAudit({
      action: "report.export",
      entityType: "report",
      summary: `Exported PDF for ${dealer.name} (${periodStart}→${periodEnd})${skipNoIncentive ? " [incentive only]" : ""}`,
      payload: { format: "pdf", periodStart, periodEnd, skipNoIncentive },
      dealerId,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  if (fmt === "xlsx" || fmt === "excel" || fmt === "activations" || fmt === "purchases") {
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
          eq(schema.activations.tenantId, OWNER_TENANT_ID),
          eq(schema.activations.dealerId, dealerId),
          gte(schema.activations.activationDate, periodStart),
          lte(schema.activations.activationDate, periodEnd)
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
          eq(schema.purchases.tenantId, OWNER_TENANT_ID),
          eq(schema.purchases.dealerId, dealerId),
          gte(schema.purchases.purchaseDate, periodStart),
          lte(schema.purchases.purchaseDate, periodEnd)
        ))
        .orderBy(asc(schema.purchases.purchaseDate), asc(schema.models.name)),
    ]);

    const suffix = skipNoIncentive ? "_incentive-models" : "";
    const baseName = `OPPO_Report_${dealer.name.replace(/\s+/g, "_")}_${periodStart}_${periodEnd}${suffix}`;
    const buffer = await buildExcel(report, dealer.name, { skipNoIncentive, activations: rawActivations, purchases: rawPurchases });

    await logAudit({
      action: "report.export",
      entityType: "report",
      summary: `Exported Excel for ${dealer.name} (${periodStart}→${periodEnd})${skipNoIncentive ? " [incentive only]" : ""}`,
      payload: { format: "xlsx", periodStart, periodEnd, skipNoIncentive },
      dealerId,
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
