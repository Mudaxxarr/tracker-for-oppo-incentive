import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { ensureInterFont, interFontReady } from "@/lib/export/pdf-fonts";
import type { IncentiveReport, IncentiveReportRow } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { RebateRow } from "@/lib/db/queries/rebates";
import type { CrCaughtExportRow } from "@/lib/db/queries/cr-caught";
import { NAVAL, type PdfTheme } from "./pdf-themes";

// ─── Palette ──────────────────────────────────────────────────────────────────
function buildC(t: PdfTheme) {
  return {
    headerBg:  t.headerBg,
    headerSub: t.headerSub,
    accent:    t.accent,
    accentBg:  t.kpiBg,
    accentBdr: t.kpiBdr,
    text:      t.text,
    muted:     t.muted,
    light:     t.light,
    border:    t.tBorder,
    alt:       t.tAlt,
    green:     t.green,
    greenBg:   t.greenBg,
    red:       t.red,
    redBg:     t.redBg,
    grandBg:   t.grandBg,
    grandSub:  t.grandSub,
  };
}
let C = buildC(NAVAL);

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeS(theme: PdfTheme) {
  const C = buildC(theme);
  const m = theme.minimal;
  const f = m && interFontReady;
  _fL  = f ? "Inter-Light"     : "Helvetica-Oblique";
  _fR  = f ? "Inter"           : "Helvetica";
  _fM  = f ? "Inter-Medium"    : "Helvetica";
  _fSB = f ? "Inter-Semibold"  : "Helvetica-Bold";
  _fB  = f ? "Inter-Bold"      : "Helvetica-Bold";
  _fEB = f ? "Inter-ExtraBold" : "Helvetica-Bold";
  return StyleSheet.create({
    page: { paddingHorizontal: 32, paddingTop: 0, paddingBottom: 20, fontSize: 8.5, fontFamily: _fR, color: C.text, backgroundColor: "#FFFFFF" },

    // Header
    headerBg:    { backgroundColor: C.headerBg, marginHorizontal: -32, paddingHorizontal: 32, paddingTop: 14, paddingBottom: 10, borderBottomWidth: m ? 0.75 : 0, borderBottomColor: m ? C.border : "transparent" },
    accentBar:   { height: m ? 0 : 3, backgroundColor: C.accent, marginHorizontal: -32, marginBottom: m ? 0 : 12 },
    headerRow:   { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    headerBrand: { fontSize: m ? 5.5 : 9, fontFamily: m ? _fM : _fB, color: m ? C.light : C.headerSub, letterSpacing: m ? 3.5 : 2, marginBottom: m ? 10 : 3 },
    headerTitle: { fontSize: m ? 24 : 16, fontFamily: m ? _fB : _fB, color: C.headerSub === "#93C5FD" ? "#FFFFFF" : C.text, letterSpacing: m ? -0.8 : 0.3 },
    headerMeta:  { fontSize: 8, fontFamily: m ? _fL : _fR, color: m ? C.muted : C.headerSub, marginTop: m ? 7 : 3 },
    headerDate:  { fontSize: 7.5, color: C.light, fontFamily: m ? _fL : _fR, textAlign: "right" },

    // KPI strip — Arctic: flat tiles with top accent
    kpiStrip: { flexDirection: "row", gap: m ? 16 : 6, marginTop: 12, marginBottom: 14 },
    kpiBox: { flex: 1, borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? C.border : "transparent", borderWidth: m ? 0 : 0.75, borderColor: C.accentBdr, borderRadius: m ? 0 : 4, backgroundColor: m ? "transparent" : C.accentBg, padding: m ? "10 0" : "7 8" },
    kpiLabel: { fontSize: m ? 5.5 : 6, color: m ? C.light : "#1E40AF", fontFamily: m ? _fM : _fB, letterSpacing: m ? 2 : 0.4, marginBottom: m ? 9 : 3 },
    kpiValue: { fontSize: m ? 16 : 11, fontFamily: m ? _fSB : _fB, color: C.text, letterSpacing: m ? -0.3 : 0 },
    kpiSub:   { fontSize: 6.5, color: C.light, fontFamily: m ? _fL : _fR, marginTop: m ? 5 : 2 },

    // Model card — Arctic: white card head with bottom border instead of gray fill
    card:         { marginBottom: m ? 18 : 9, borderWidth: m ? 0 : 0.75, borderTopWidth: m ? 0.5 : 0, borderColor: C.border, borderRadius: m ? 0 : 4, overflow: "hidden" },
    cardHead:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: m ? 0 : 10, paddingVertical: m ? 0 : 7, paddingBottom: m ? 8 : 7, paddingTop: m ? 12 : 7, backgroundColor: m ? "transparent" : "#F1F5F9", borderBottomWidth: m ? 0.25 : 0, borderBottomColor: m ? C.border : "transparent" },
    cardModel:    { fontSize: m ? 11 : 9.5, fontFamily: m ? _fSB : _fB, color: C.text, letterSpacing: m ? -0.2 : 0 },
    cardMeta:     { fontSize: 7, color: C.light, fontFamily: m ? _fL : _fR, marginTop: m ? 4 : 2 },
    cardTotLabel: { fontSize: 6, color: C.muted, marginBottom: 2, textAlign: "right", fontFamily: _fB, letterSpacing: 0.3 },
    cardTotValue: { fontSize: 11, fontFamily: _fB, color: C.accent },

    // Calc rows — Arctic: no alternating fill
    calcRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4.5, borderTopWidth: 0.5, borderColor: C.border },
    calcAlt:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4.5, borderTopWidth: 0.5, borderColor: C.border, backgroundColor: m ? "transparent" : C.alt },
    calcLabel:  { width: "26%", fontSize: 7.5, fontFamily: _fB, color: C.text },
    calcFormula:{ flex: 1, fontSize: 7.5, color: C.muted },
    calcAmount: { width: "22%", fontSize: 8, fontFamily: _fB, color: C.text, textAlign: "right" },
    badge:      { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, fontSize: 6.5, fontFamily: _fB, marginLeft: 6 },
    badgeMet:   { backgroundColor: C.greenBg, color: C.green },
    badgeNo:    { backgroundColor: C.redBg, color: C.red },

    // Card total row — Arctic: ruled separator instead of filled
    cardTotal: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingHorizontal: m ? 0 : 10, paddingVertical: m ? 8 : 5, borderTopWidth: m ? 0.5 : 1, borderColor: m ? C.border : C.accent, backgroundColor: m ? "transparent" : C.accentBg },
    cardTotalLabel: { fontSize: 7.5, fontFamily: _fB, color: m ? C.muted : "#1E40AF" },
    cardTotalValue: { fontSize: 9, fontFamily: _fB, color: C.accent },

    // Grand banner — Arctic: double-ruled separator
    grandBanner:   { marginTop: m ? 28 : 12, padding: m ? "24 0" : "12 16", borderRadius: m ? 0 : 5, backgroundColor: m ? "transparent" : C.grandBg, borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? C.border : "transparent", borderBottomWidth: m ? 0.5 : 0, borderBottomColor: m ? C.border : "transparent", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    grandTag:      { fontSize: m ? 5.5 : 7.5, color: m ? C.light : C.grandSub, fontFamily: m ? _fM : _fB, letterSpacing: m ? 2.5 : 0.5, marginBottom: m ? 10 : 5 },
    grandAmt:      { fontSize: m ? 36 : 20, fontFamily: m ? _fEB : _fB, color: m ? C.text : "#FFFFFF", letterSpacing: m ? -1 : 0 },
    grandRight:    { alignItems: "flex-end", gap: 2, flexShrink: 0, minWidth: 148 },
    grandRightRow: { flexDirection: "row", gap: 8 },
    grandRightLbl: { fontSize: 7, color: m ? C.light : C.grandSub, fontFamily: m ? _fL : _fR, minWidth: 78 },
    grandRightVal: { fontSize: m ? 7.5 : 7, color: m ? C.text : "#FFFFFF", fontFamily: m ? _fSB : _fB, minWidth: 58, textAlign: "right" },

    // Footer
    footerBar:  { marginTop: 12, paddingTop: 8, borderTopWidth: m ? 0.5 : 0.75, borderColor: C.border, flexDirection: "row", justifyContent: "space-between" },
    footerText: { fontSize: 6.5, color: C.light, fontFamily: m ? _fL : _fR },
  });
}
let _fL  = "Helvetica-Oblique";
let _fR  = "Helvetica";
let _fM  = "Helvetica";
let _fSB = "Helvetica-Bold";
let _fB  = "Helvetica-Bold";
let _fEB = "Helvetica-Bold";
let S = makeS(NAVAL);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

const today = () => new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

// ─── Header ───────────────────────────────────────────────────────────────────
function DocHeader({ dealerName, periodStart, periodEnd }: { dealerName: string; periodStart: string; periodEnd: string }) {
  return (
    <>
      <View style={S.headerBg}>
        <Text style={S.headerBrand}>OPPO PAKISTAN</Text>
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Detailed Incentive Breakup</Text>
            <Text style={S.headerMeta}>{dealerName}  ·  {periodStart}  →  {periodEnd}</Text>
          </View>
          <View>
            <Text style={S.headerDate}>Generated: {today()}</Text>
            <Text style={[S.headerDate, { marginTop: 2 }]}>CONFIDENTIAL</Text>
          </View>
        </View>
      </View>
      <View style={S.accentBar} />
    </>
  );
}

// ─── Model Card ───────────────────────────────────────────────────────────────
type CalcRow = {
  key: string;
  label: string;
  formula: string;
  amount: number;
  showBadge?: boolean;
  eligible?: boolean;
};

function ModelCard({
  row,
  policies,
  basePercent,
  bonusPercent,
}: {
  row: IncentiveReportRow;
  policies: PolicyAchievementEntry[];
  basePercent: number;
  bonusPercent: number;
}) {
  const actPolicies = policies.filter(p => p.type === "activation-incentive" && p.modelName === row.modelName);
  const stockPolicy = policies.find(p => p.type === "stock-in" && p.modelName === row.modelName);
  const dlrPolicy   = policies.find(p => p.type === "dealer-incentive");

  // Build calc rows as data (avoids Fragment/nesting complexity in react-pdf)
  const rows: CalcRow[] = [];

  if (row.priceSubperiods.length === 1) {
    const sp = row.priceSubperiods[0];
    if (sp.basePercentSubtotal > 0)
      rows.push({ key: "base-0", label: `Base ${basePercent}%`, formula: `${sp.qty} × ${fmtPKR(sp.dealerPrice)} × ${basePercent}%`, amount: sp.basePercentSubtotal });
    if (sp.bonusPercentSubtotal > 0)
      rows.push({ key: "bonus-0", label: `Bonus ${bonusPercent}%`, formula: `${sp.qty} × ${fmtPKR(sp.dealerPrice)} × ${bonusPercent}%`, amount: sp.bonusPercentSubtotal });
  } else {
    row.priceSubperiods.forEach((sp, i) => {
      if (sp.basePercentSubtotal > 0)
        rows.push({ key: `base-${i}`, label: i === 0 ? `Base ${basePercent}%` : "", formula: `${sp.qty} units @ ${fmtPKR(sp.dealerPrice)} × ${basePercent}%`, amount: sp.basePercentSubtotal });
    });
    if (row.basePercentEarned > 0 && row.priceSubperiods.filter(s => s.basePercentSubtotal > 0).length > 1)
      rows.push({ key: "base-sub", label: "", formula: `Subtotal Base ${basePercent}%`, amount: row.basePercentEarned });

    row.priceSubperiods.forEach((sp, i) => {
      if (sp.bonusPercentSubtotal > 0)
        rows.push({ key: `bonus-${i}`, label: i === 0 ? `Bonus ${bonusPercent}%` : "", formula: `${sp.qty} units @ ${fmtPKR(sp.dealerPrice)} × ${bonusPercent}%`, amount: sp.bonusPercentSubtotal });
    });
    if (row.bonusPercentEarned > 0 && row.priceSubperiods.filter(s => s.bonusPercentSubtotal > 0).length > 1)
      rows.push({ key: "bonus-sub", label: "", formula: `Subtotal Bonus ${bonusPercent}%`, amount: row.bonusPercentEarned });
  }

  if (actPolicies.length > 0) {
    actPolicies.forEach((ap, i) => {
      const qty = ap.eligibleQty ?? ap.actualQty;
      const note = ap.targetQty != null ? `  (min. ${ap.targetQty} required — ${qty} actual)` : "";
      rows.push({ key: `act-${i}`, label: i === 0 ? "Act. Incentive" : "", formula: `${qty} × ${fmtPKR(ap.perUnitAmount)}${note}`, amount: ap.earned, showBadge: true, eligible: ap.eligible });
    });
  } else if (row.activationIncentiveEarned > 0) {
    rows.push({ key: "act", label: "Act. Incentive", formula: `${row.qtyActivated} × policy rate`, amount: row.activationIncentiveEarned });
  }

  if (row.stockInEarned > 0 || stockPolicy) {
    const rate = stockPolicy ? fmtPKR(stockPolicy.perUnitAmount) : "policy rate";
    const note = stockPolicy?.targetQty != null ? `  (min. ${stockPolicy.targetQty} required)` : "";
    rows.push({ key: "stock", label: "Stock-In", formula: `${row.effectiveStockInQty} × ${rate}${note}`, amount: row.stockInEarned, showBadge: !!stockPolicy, eligible: stockPolicy?.eligible });
  }

  if (row.dealerIncentiveEarned > 0) {
    const note = dlrPolicy ? `  (total target: ${dlrPolicy.targetQty ?? "—"} activations)` : "";
    const rate = dlrPolicy ? fmtPKR(dlrPolicy.perUnitAmount) : "policy rate";
    rows.push({ key: "dlr", label: "Dealer Inc.", formula: `${row.qtyActivated} × ${rate}${note}`, amount: row.dealerIncentiveEarned });
  }

  return (
    <View style={S.card}>
      {/* Model header */}
      <View style={S.cardHead}>
        <View>
          <Text style={S.cardModel}>{row.modelName}</Text>
          <Text style={S.cardMeta}>
            {row.qtyActivated} activation{row.qtyActivated !== 1 ? "s" : ""}
            {row.qtyActivatedCrossRegion > 0 ? `  ·  ${row.qtyActivatedCrossRegion} cross-region` : ""}
            {row.stockInRegularQty > 0 ? `  ·  ${row.stockInRegularQty} purchased` : ""}
            {row.interIdOutQty > 0 ? `  ·  ${row.interIdOutQty} transferred out` : ""}
          </Text>
        </View>
        <View>
          <Text style={S.cardTotLabel}>EARNED</Text>
          <Text style={S.cardTotValue}>{fmtPKR(row.total)}</Text>
        </View>
      </View>

      {/* Calculation rows */}
      {rows.map((cr, idx) => (
        <View key={cr.key} style={idx % 2 === 0 ? S.calcRow : S.calcAlt}>
          <Text style={S.calcLabel}>{cr.label}</Text>
          <Text style={S.calcFormula}>{cr.formula}</Text>
          <Text style={S.calcAmount}>{cr.amount > 0 ? fmtPKR(cr.amount) : "—"}</Text>
          {cr.showBadge ? (
            <View style={[S.badge, cr.eligible ? S.badgeMet : S.badgeNo]}>
              <Text>{cr.eligible ? "Met ✓" : "Not Met"}</Text>
            </View>
          ) : (
            <View style={{ width: 46 }} />
          )}
        </View>
      ))}

      {/* Model total */}
      <View style={S.cardTotal}>
        <Text style={S.cardTotalLabel}>MODEL TOTAL</Text>
        <Text style={S.cardTotalValue}>{fmtPKR(row.total)}</Text>
      </View>
    </View>
  );
}

// ─── Rebate Card ──────────────────────────────────────────────────────────────
function RebateCard({ rows, total }: { rows: RebateRow[]; total: number }) {
  return (
    <View style={[S.card, { borderColor: "#0891B2" }]}>
      <View style={[S.cardHead, { backgroundColor: "#ECFEFF", borderBottomWidth: 0.5, borderBottomColor: "#BAE6FD" }]}>
        <View>
          <Text style={[S.cardModel, { color: "#0E7490" }]}>Price-Drop Rebates</Text>
          <Text style={S.cardMeta}>OPPO owes you — {rows.length} price-drop event{rows.length !== 1 ? "s" : ""}</Text>
        </View>
        <View>
          <Text style={S.cardTotLabel}>RECEIVABLE</Text>
          <Text style={[S.cardTotValue, { color: "#0E7490" }]}>{fmtPKR(total)}</Text>
        </View>
      </View>
      {rows.map((r, idx) => (
        <View key={r.id} style={idx % 2 === 0 ? S.calcRow : S.calcAlt}>
          <Text style={{ width: "13%", fontSize: 7, color: C.light, fontFamily: _fL }}>{r.rebateDate}</Text>
          <Text style={{ width: "27%", fontSize: 8, fontFamily: _fB }}>{r.modelName}</Text>
          <Text style={{ flex: 1, fontSize: 7, color: C.muted }}>
            {fmtPKR(r.oldDealerPrice)} → {fmtPKR(r.newDealerPrice)}  ·  drop {fmtPKR(r.rebatePerUnit)}/unit  ·  {r.eligibleQty} units
          </Text>
          <Text style={{ width: "22%", fontSize: 8, fontFamily: _fB, textAlign: "right", color: "#0E7490" }}>
            +{fmtPKR(r.totalRebateAmount)}
          </Text>
        </View>
      ))}
      <View style={[S.cardTotal, { borderTopColor: "#0891B2" }]}>
        <Text style={[S.cardTotalLabel, { color: "#0E7490" }]}>TOTAL REBATES RECEIVABLE</Text>
        <Text style={[S.cardTotalValue, { color: "#0E7490" }]}>{fmtPKR(total)}</Text>
      </View>
    </View>
  );
}

// ─── CR Caught Card ───────────────────────────────────────────────────────────
function CrCaughtCard({
  rows,
  loss,
}: {
  rows: CrCaughtExportRow[];
  loss: { totalUnits: number; lostIncentive: number; totalFines: number };
}) {
  return (
    <View style={[S.card, { borderColor: "#FCA5A5" }]}>
      <View style={[S.cardHead, { backgroundColor: "#FEF2F2", borderBottomWidth: 0.5, borderBottomColor: "#FCA5A5" }]}>
        <View>
          <Text style={[S.cardModel, { color: "#B91C1C" }]}>CR Caught — Cash Penalty</Text>
          <Text style={S.cardMeta}>
            {loss.totalUnits} unit{loss.totalUnits !== 1 ? "s" : ""} caught cross-region
            {loss.lostIncentive > 0 ? `  ·  est. lost incentive: ${fmtPKR(loss.lostIncentive)}` : ""}
          </Text>
        </View>
        <View>
          <Text style={S.cardTotLabel}>CASH FINES</Text>
          <Text style={[S.cardTotValue, { color: "#B91C1C" }]}>{fmtPKR(loss.totalFines)}</Text>
        </View>
      </View>
      {rows.map((r, idx) => (
        <View key={idx} style={idx % 2 === 0 ? S.calcRow : S.calcAlt}>
          <Text style={{ width: "13%", fontSize: 7, color: C.light, fontFamily: _fL }}>{r.caughtDate}</Text>
          <Text style={{ width: "27%", fontSize: 8, fontFamily: _fB }}>{r.modelName}</Text>
          <Text style={{ flex: 1, fontSize: 7, color: C.muted }}>
            {r.quantity} unit{r.quantity !== 1 ? "s" : ""}
            {r.dealerPriceSnapshot > 0 ? `  ·  price: ${fmtPKR(r.dealerPriceSnapshot)}` : ""}
          </Text>
          <Text style={{ width: "22%", fontSize: 8, fontFamily: _fB, textAlign: "right", color: "#B91C1C" }}>
            {r.fineAmount > 0 ? `−${fmtPKR(r.fineAmount)}` : "—"}
          </Text>
        </View>
      ))}
      <View style={[S.cardTotal, { borderTopColor: "#B91C1C" }]}>
        <Text style={[S.cardTotalLabel, { color: "#B91C1C" }]}>TOTAL CASH FINES</Text>
        <Text style={[S.cardTotalValue, { color: "#B91C1C" }]}>{fmtPKR(loss.totalFines)}</Text>
      </View>
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function buildDetailedPDF(
  report: IncentiveReport,
  dealerName: string,
  policies: PolicyAchievementEntry[],
  theme: PdfTheme = NAVAL,
  opts?: {
    rebateRows?: RebateRow[];
    rebateTotal?: number;
    crCaughtRows?: CrCaughtExportRow[];
    crCaughtLoss?: { totalUnits: number; lostIncentive: number; totalFines: number };
  }
): Promise<Buffer> {
  ensureInterFont(); C = buildC(theme); S = makeS(theme);
  const rows = report.rows.filter(r => r.total > 0 && r.qtyActivated > 0);
  const bonusPercent = report.targetBonus.bonusPercent ?? 1;
  const tb = report.targetBonus;
  const rebateRows   = opts?.rebateRows   ?? [];
  const rebateTotal  = opts?.rebateTotal  ?? 0;
  const crCaughtRows = opts?.crCaughtRows ?? [];
  const crCaughtLoss = opts?.crCaughtLoss;
  const netReceivable = report.totals.grandTotal + rebateTotal - (crCaughtLoss?.totalFines ?? 0);
  const hasAdj = rebateRows.length > 0 || (crCaughtLoss?.totalUnits ?? 0) > 0;

  const nonZero: Array<{ label: string; val: number; neg?: boolean }> = [
    { label: `Base ${report.baseIncentivePercent}%`, val: report.totals.basePercentEarned },
    { label: `Bonus ${bonusPercent}%`,               val: report.totals.bonusPercentEarned },
    { label: "Activation Inc.",                      val: report.totals.activationIncentiveEarned },
    { label: "Dealer Inc.",                          val: report.totals.dealerIncentiveEarned },
    { label: "Stock-In",                             val: report.totals.stockInEarned },
    ...(rebateTotal > 0 ? [{ label: "+ Rebates", val: rebateTotal }] : []),
    ...((crCaughtLoss?.totalFines ?? 0) > 0 ? [{ label: "− Fines", val: crCaughtLoss!.totalFines, neg: true }] : []),
  ].filter(e => e.val > 0);

  const doc = (
    <Document>
      <Page size="A4" style={S.page}>
        <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

        {/* KPI Strip */}
        <View style={S.kpiStrip}>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>TOTAL ACTIVATIONS</Text>
            <Text style={S.kpiValue}>{report.totalActivations}</Text>
            {report.totalActivationsCrossRegion > 0 && <Text style={S.kpiSub}>{report.totalActivationsCrossRegion} cross-region</Text>}
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>MODELS WITH INCENTIVE</Text>
            <Text style={S.kpiValue}>{rows.length}</Text>
            <Text style={S.kpiSub}>of {report.rows.length} total</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>TARGET BONUS {bonusPercent}%</Text>
            <Text style={[S.kpiValue, { color: tb.eligible ? C.green : C.red }]}>
              {tb.eligible ? "Achieved ✓" : "Not Met ✗"}
            </Text>
            <Text style={S.kpiSub}>{tb.actualQty} / {tb.targetQty ?? "—"} units purchased</Text>
          </View>
          <View style={[S.kpiBox, { flex: 1.3, borderColor: C.accent }]}>
            <Text style={S.kpiLabel}>GRAND TOTAL (OPPO PAYOUT)</Text>
            <Text style={[S.kpiValue, { fontSize: 12, color: C.accent }]}>{fmtPKR(report.totals.grandTotal)}</Text>
          </View>
        </View>

        {/* Per-model cards — only models with non-zero incentive */}
        {rows.map(r => (
          <ModelCard
            key={r.modelId}
            row={r}
            policies={policies}
            basePercent={report.baseIncentivePercent}
            bonusPercent={bonusPercent}
          />
        ))}

        {rows.length === 0 && (
          <View style={{ marginTop: 20, padding: 16, borderWidth: 0.5, borderColor: C.border, borderRadius: 4, backgroundColor: C.alt }}>
            <Text style={{ textAlign: "center", fontSize: 9, color: C.muted }}>No activations in this period.</Text>
          </View>
        )}

        {/* Adjustment cards */}
        {rebateRows.length > 0 && <RebateCard rows={rebateRows} total={rebateTotal} />}
        {(crCaughtLoss?.totalUnits ?? 0) > 0 && crCaughtRows.length > 0 && (
          <CrCaughtCard rows={crCaughtRows} loss={crCaughtLoss!} />
        )}

        {/* Grand footer */}
        <View style={S.grandBanner}>
          <View style={{ flex: 1 }}>
            <Text style={S.grandTag}>
              {hasAdj ? "NET RECEIVABLE FROM OPPO" : "TOTAL AMOUNT EXPECTED FROM OPPO"}
            </Text>
            <Text style={S.grandAmt}>{fmtPKR(netReceivable)}</Text>
            <Text style={[S.footerText, { color: C.grandSub, marginTop: 3 }]}>{dealerName}  ·  {report.periodStart} → {report.periodEnd}</Text>
          </View>
          {nonZero.length > 0 && (
            <View style={S.grandRight}>
              {nonZero.map(e => (
                <View key={e.label} style={S.grandRightRow}>
                  <Text style={S.grandRightLbl}>{e.label}</Text>
                  <Text style={[S.grandRightVal, e.neg ? { color: C.red } : {}]}>
                    {e.neg ? `−${fmtPKR(e.val)}` : fmtPKR(e.val)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {report.totalActivationsCrossRegion > 0 && (
          <View style={{ marginTop: 8, padding: "5 8", borderRadius: 3, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.alt }}>
            <Text style={S.footerText}>
              Cross-region: {report.totalActivationsCrossRegion} activations earn base %, bonus %, activation and dealer incentive — excluded from stock-in calculations.
            </Text>
          </View>
        )}

        <View style={S.footerBar}>
          <Text style={S.footerText}>OPPO Pakistan  ·  Detailed Incentive Breakup  ·  Confidential</Text>
          <Text style={S.footerText}>Generated: {today()}</Text>
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
