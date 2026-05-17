import ExcelJS from "exceljs";
import type { IncentiveReport } from "@/lib/incentive-engine";

export interface RawActivationRow {
  activationDate: string;
  modelName: string;
  imei: string | null;
  dealerPriceSnapshot: number;
  isCrossRegion: boolean;
}

export interface RawPurchaseRow {
  purchaseDate: string;
  modelName: string;
  quantity: number;
  unitDealerPrice: number;
  unitInvoicePrice: number;
  source: string;
  referenceNote: string | null;
}

const PKR = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
const fmt = (n: number) => PKR.format(n);

function applyHeaderStyle(ws: ExcelJS.Worksheet) {
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
    cell.alignment = { vertical: "middle" };
  });
  ws.getRow(1).height = 20;
}

export async function buildExcel(
  report: IncentiveReport,
  dealerName: string,
  opts?: {
    skipNoIncentive?: boolean;
    activations?: RawActivationRow[];
    purchases?: RawPurchaseRow[];
  }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OPPO ID Tracker";
  wb.created = new Date();

  const rows = opts?.skipNoIncentive ? report.rows.filter((r) => r.total > 0) : report.rows;

  // ─── 1. Summary ───
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "k", width: 36 },
    { header: "Value", key: "v", width: 32 },
  ];
  summary.addRows([
    { k: "Dealer ID", v: dealerName },
    { k: "Period start", v: report.periodStart },
    { k: "Period end", v: report.periodEnd },
    { k: "Base incentive %", v: `${report.baseIncentivePercent}%` },
    { k: "Activations (total)", v: report.totalActivations },
    { k: "Cross-region activations", v: report.totalActivationsCrossRegion },
    { k: "Regular purchases qty", v: report.totalRegularPurchaseQty },
    { k: "Cross-region purchases qty", v: report.totalCrossRegionPurchaseQty },
    { k: "Target Bonus eligible", v: report.targetBonus.eligible ? "Yes" : "No" },
    { k: "Target Bonus (actual / target)", v: `${report.targetBonus.actualQty} / ${report.targetBonus.targetQty ?? "—"}` },
    { k: "Dealer Incentive eligible", v: report.dealerIncentive.eligible ? "Yes" : "No" },
    { k: "Dealer Incentive (actual / target)", v: `${report.dealerIncentive.actualTotal} / ${report.dealerIncentive.targetTotal ?? "—"}` },
    { k: "Base % earned (PKR)", v: report.totals.basePercentEarned },
    { k: "Target Bonus earned (PKR)", v: report.totals.bonusPercentEarned },
    { k: "Activation Incentive earned (PKR)", v: report.totals.activationIncentiveEarned },
    { k: "Dealer Incentive earned (PKR)", v: report.totals.dealerIncentiveEarned },
    { k: "Stock-In earned (PKR)", v: report.totals.stockInEarned },
    { k: "", v: "" },
    { k: "GRAND TOTAL (PKR)", v: report.totals.grandTotal },
  ]);
  applyHeaderStyle(summary);
  summary.getRow(summary.rowCount).font = { bold: true };

  // ─── 2. Per Model ───
  const perModel = wb.addWorksheet("Per Model");
  perModel.columns = [
    { header: "Model", key: "model", width: 36 },
    { header: "Qty activated", key: "qty", width: 14 },
    { header: "Cross-region qty", key: "qtyCr", width: 14 },
    { header: "Stock-in regular qty", key: "siRegular", width: 16 },
    { header: "Effective stock-in qty", key: "siEff", width: 16 },
    { header: "Base % earned (PKR)", key: "base", width: 18 },
    { header: "Bonus % earned (PKR)", key: "bonus", width: 18 },
    { header: "Activation incentive (PKR)", key: "ai", width: 20 },
    { header: "Dealer incentive (PKR)", key: "di", width: 18 },
    { header: "Stock-in earned (PKR)", key: "si", width: 18 },
    { header: "Total (PKR)", key: "total", width: 16 },
  ];
  for (const r of rows) {
    perModel.addRow({
      model: r.modelName,
      qty: r.qtyActivated,
      qtyCr: r.qtyActivatedCrossRegion,
      siRegular: r.stockInRegularQty,
      siEff: r.effectiveStockInQty,
      base: r.basePercentEarned,
      bonus: r.bonusPercentEarned,
      ai: r.activationIncentiveEarned,
      di: r.dealerIncentiveEarned,
      si: r.stockInEarned,
      total: r.total,
    });
  }
  // Totals row
  perModel.addRow({
    model: "TOTAL",
    qty: rows.reduce((s, r) => s + r.qtyActivated, 0),
    qtyCr: rows.reduce((s, r) => s + r.qtyActivatedCrossRegion, 0),
    siRegular: rows.reduce((s, r) => s + r.stockInRegularQty, 0),
    siEff: rows.reduce((s, r) => s + r.effectiveStockInQty, 0),
    base: rows.reduce((s, r) => s + r.basePercentEarned, 0),
    bonus: rows.reduce((s, r) => s + r.bonusPercentEarned, 0),
    ai: rows.reduce((s, r) => s + r.activationIncentiveEarned, 0),
    di: rows.reduce((s, r) => s + r.dealerIncentiveEarned, 0),
    si: rows.reduce((s, r) => s + r.stockInEarned, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
  });
  applyHeaderStyle(perModel);
  perModel.lastRow!.font = { bold: true };
  ["F", "G", "H", "I", "J", "K"].forEach((col) => {
    perModel.getColumn(col).numFmt = "#,##0";
  });

  // ─── 3. Price sub-periods ───
  const sub = wb.addWorksheet("Price Sub-periods");
  sub.columns = [
    { header: "Model", key: "model", width: 36 },
    { header: "Dealer price (PKR)", key: "price", width: 18 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Base % subtotal (PKR)", key: "base", width: 20 },
    { header: "Bonus % subtotal (PKR)", key: "bonus", width: 20 },
  ];
  for (const r of rows) {
    for (const s of r.priceSubperiods) {
      sub.addRow({ model: r.modelName, price: s.dealerPrice, qty: s.qty, base: s.basePercentSubtotal, bonus: s.bonusPercentSubtotal });
    }
  }
  applyHeaderStyle(sub);
  ["B", "D", "E"].forEach((col) => { sub.getColumn(col).numFmt = "#,##0"; });

  // ─── 4. Activations ───
  if (opts?.activations && opts.activations.length > 0) {
    const act = wb.addWorksheet("Activations");
    act.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Model", key: "model", width: 36 },
      { header: "IMEI", key: "imei", width: 20 },
      { header: "Dealer Price (PKR)", key: "price", width: 18 },
      { header: "Cross-Region", key: "cr", width: 14 },
    ];
    for (const a of opts.activations) {
      act.addRow({ date: a.activationDate, model: a.modelName, imei: a.imei ?? "—", price: a.dealerPriceSnapshot, cr: a.isCrossRegion ? "Yes" : "" });
    }
    applyHeaderStyle(act);
    act.getColumn("D").numFmt = "#,##0";
  }

  // ─── 5. Purchases ───
  if (opts?.purchases && opts.purchases.length > 0) {
    const pur = wb.addWorksheet("Purchases");
    pur.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Model", key: "model", width: 36 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Unit Dealer Price (PKR)", key: "dealerP", width: 20 },
      { header: "Unit Invoice Price (PKR)", key: "invoiceP", width: 20 },
      { header: "Total Dealer (PKR)", key: "totalD", width: 18 },
      { header: "Source", key: "source", width: 22 },
      { header: "Note", key: "note", width: 32 },
    ];
    for (const p of opts.purchases) {
      pur.addRow({
        date: p.purchaseDate,
        model: p.modelName,
        qty: p.quantity,
        dealerP: p.unitDealerPrice,
        invoiceP: p.unitInvoicePrice,
        totalD: p.quantity * p.unitDealerPrice,
        source: p.source === "CROSS_REGION_TRANSFER_IN" ? "Cross-Region" : "Regular",
        note: p.referenceNote ?? "",
      });
    }
    applyHeaderStyle(pur);
    ["D", "E", "F"].forEach((col) => { pur.getColumn(col).numFmt = "#,##0"; });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
