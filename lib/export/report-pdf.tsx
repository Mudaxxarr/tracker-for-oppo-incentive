import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { ensureInterFont, interFontReady } from "@/lib/export/pdf-fonts";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { RebateRow } from "@/lib/db/queries/rebates";
import type { CrCaughtExportRow } from "@/lib/db/queries/cr-caught";
import { NAVAL, type PdfTheme } from "./pdf-themes";
import { isZeroDealerIncentivePolicy, buildDealerIncentiveBreakdown } from "@/lib/report-utils";

// ─── Brand palette ────────────────────────────────────────────────────────────
function buildC(t: PdfTheme) {
  return {
    headerBg:    t.headerBg,
    headerFg:    t.headerFg,
    headerSub:   t.headerSub,
    accentBar:   t.accent,
    kpiBg:       t.kpiBg,
    kpiBorder:   t.kpiBdr,
    kpiLabel:    t.kpiLabel,
    kpiValue:    t.text,
    grandBg:     t.grandBg,
    grandFg:     t.grandFg,
    grandAccent: t.grandSub,
    tHeaderBg:   t.tHeadBg,
    tHeaderFg:   t.tHeadFg,
    tAlt:        t.tAlt,
    tBorder:     t.tBorder,
    tTotalBg:    t.tTotalBg,
    tTotalFg:    t.tTotalFg,
    green:       t.green,
    greenBg:     t.greenBg,
    greenBorder: t.greenBg,
    red:         t.red,
    redBg:       t.redBg,
    redBorder:   t.redBg,
    textPrimary: t.text,
    textMuted:   t.muted,
    textLight:   t.light,
    divider:     t.tBorder,
  };
}
let C = buildC(NAVAL);
let _fL  = "Helvetica-Oblique";
let _fR  = "Helvetica";
let _fM  = "Helvetica";
let _fSB = "Helvetica-Bold";
let _fB  = "Helvetica-Bold";
let _fEB = "Helvetica-Bold";

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
    page: {
      paddingHorizontal: 28,
      paddingTop: 0,
      paddingBottom: 20,
      fontSize: 8.5,
      fontFamily: _fR,
      color: C.textPrimary,
      backgroundColor: "#FFFFFF",
    },

    // Header — Naval: dark band; Arctic: white with light border
    headerBg: {
      backgroundColor: C.headerBg,
      marginHorizontal: -28,
      paddingHorizontal: 28,
      paddingTop: 14,
      paddingBottom: 10,
      marginBottom: 0,
      borderBottomWidth: m ? 0.75 : 0,
      borderBottomColor: m ? C.divider : "transparent",
    },
    accentBar: {
      height: m ? 0 : 3,
      backgroundColor: C.accentBar,
      marginHorizontal: -28,
      marginBottom: m ? 0 : 12,
    },
    headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    headerTitle: { fontSize: m ? 24 : 16, fontFamily: m ? _fB : _fB, color: C.headerFg, letterSpacing: m ? -0.8 : 0.3 },
    headerBrand: { fontSize: m ? 5.5 : 9, fontFamily: m ? _fM : _fB, color: m ? C.textMuted : C.headerSub, letterSpacing: m ? 3.5 : 2, marginBottom: m ? 10 : 3 },
    headerMeta: { fontSize: m ? 8 : 8, fontFamily: m ? _fL : _fR, color: m ? C.textMuted : C.headerSub, marginTop: m ? 7 : 3 },
    headerRight: { alignItems: "flex-end" },
    headerDate: { fontSize: 7.5, color: C.textLight, fontFamily: m ? _fL : _fR },

    // KPI strip — Naval: filled boxes; Arctic luxury: floating numbers, 0.5pt hairline
    kpiStrip: { flexDirection: "row", gap: m ? 16 : 5, marginTop: 12, marginBottom: m ? 18 : 12 },
    kpiBox: {
      flex: 1,
      borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? C.divider : "transparent",
      borderWidth: m ? 0 : 0.75, borderColor: C.kpiBorder, borderRadius: m ? 0 : 4,
      backgroundColor: m ? "transparent" : C.kpiBg, padding: m ? "10 0" : "6 7",
    },
    kpiLabel: { fontSize: m ? 5.5 : 6.5, color: m ? C.textLight : C.kpiLabel, fontFamily: m ? _fM : _fB, letterSpacing: m ? 2 : 0.4, marginBottom: m ? 9 : 3 },
    kpiValue: { fontSize: m ? 17 : 9.5, fontFamily: m ? _fSB : _fB, color: C.kpiValue, letterSpacing: m ? -0.3 : 0 },
    kpiSub:   { fontSize: 6.5, color: C.textLight, fontFamily: m ? _fL : _fR, marginTop: m ? 5 : 2 },

    kpiGrandBox: {
      flex: 1,
      borderTopWidth: m ? 0.5 : 2, borderTopColor: m ? C.divider : C.accentBar,
      borderWidth: m ? 0 : 1, borderColor: m ? "transparent" : C.accentBar,
      borderRadius: m ? 0 : 4,
      backgroundColor: m ? "transparent" : C.grandBg,
      padding: m ? "10 0" : "6 7",
    },
    kpiGrandLabel: { fontSize: m ? 5.5 : 6.5, color: m ? C.textLight : C.grandAccent, fontFamily: m ? _fM : _fB, letterSpacing: m ? 2 : 0.4, marginBottom: m ? 9 : 3, textAlign: "right" },
    kpiGrandValue: { fontSize: m ? 17 : 11, fontFamily: m ? _fEB : _fB, color: m ? C.textPrimary : C.grandFg, letterSpacing: m ? -0.5 : 0, textAlign: "right" },

    // Target status banner
    targetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: "6 10",
      borderRadius: m ? 0 : 4,
      borderWidth: 0.75,
      marginBottom: 12,
    },
    targetLabel:  { fontSize: 7.5, fontFamily: _fB, flex: 1 },
    targetSub:    { fontSize: 7, color: C.textMuted },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 7, fontFamily: _fB },
    badgeMet:    { backgroundColor: C.greenBg, color: C.green },
    badgeNotMet: { backgroundColor: C.redBg, color: C.red },

    // Section header
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
    sectionTitle: {
      fontSize: m ? 5.5 : 8, fontFamily: m ? _fM : _fB, color: C.textLight,
      letterSpacing: m ? 2.5 : 0.8, textTransform: "uppercase",
    },
    sectionLine: { flex: 1, borderBottomWidth: m ? 0.5 : 0.75, borderColor: C.divider },

    // Table — Naval: dark filled header; Arctic luxury: no outer box, hairline rules
    table: { borderWidth: m ? 0 : 0.75, borderColor: C.tBorder, borderRadius: m ? 0 : 3, overflow: "hidden" },
    tHeadRow: {
      flexDirection: "row",
      backgroundColor: m ? "transparent" : C.tHeaderBg,
      borderBottomWidth: m ? 0.5 : 0,
      borderBottomColor: m ? C.divider : "transparent",
      paddingTop: m ? 4 : 0,
    },
    tHCell: {
      padding: m ? "3 5" : "4 5",
      color: m ? C.textMuted : C.tHeaderFg,
      fontFamily: _fB,
      fontSize: m ? 6 : 7,
      letterSpacing: m ? 1.2 : 0.2,
    },
    tRow:  { flexDirection: "row", borderTopWidth: m ? 0.25 : 0.5, borderColor: C.tBorder },
    tAltRow: { flexDirection: "row", borderTopWidth: m ? 0.25 : 0.5, borderColor: C.tBorder, backgroundColor: m ? "transparent" : C.tAlt },
    tCell: { padding: m ? "4.5 5" : "3.5 5", fontSize: 8 },
    tCellBold: { padding: m ? "4.5 5" : "3.5 5", fontSize: 8, fontFamily: _fB },
    tTotalRow: {
      flexDirection: "row",
      borderTopWidth: m ? 0.75 : 1,
      borderColor: m ? C.textPrimary : C.accentBar,
      backgroundColor: m ? "transparent" : C.tTotalBg,
    },
    tTotalCell: {
      padding: m ? "5 5" : "4 5",
      fontSize: 8,
      fontFamily: _fB,
      color: m ? C.textPrimary : C.tTotalFg,
    },

    // Totals strip
    totalsStrip: { flexDirection: "row", gap: 5, marginTop: 10 },
    totalBox: {
      flex: 1,
      borderWidth: 0.5,
      borderColor: C.tBorder,
      borderRadius: 3,
      padding: "5 6",
      backgroundColor: "#FAFAFA",
    },
    totalLabel: { fontSize: 6.5, color: C.textMuted, marginBottom: 2 },
    totalValue: { fontSize: 8.5, fontFamily: _fB },

    // Grand total — Naval: dark navy banner; Arctic luxury: generous spacing, large number, 0.5pt rules
    grandBanner: {
      marginTop: m ? 14 : 10,
      padding: m ? "16 0" : "10 0 10 14",
      borderRadius: m ? 0 : 5,
      backgroundColor: m ? "transparent" : C.grandBg,
      borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? C.divider : "transparent",
      borderBottomWidth: m ? 0.5 : 0, borderBottomColor: m ? C.divider : "transparent",
      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    },
    grandLeft: { flex: 1 },
    grandTag: { fontSize: m ? 6 : 7.5, color: m ? C.textMuted : C.grandAccent, fontFamily: _fB, letterSpacing: m ? 1.5 : 0.5, marginBottom: m ? 8 : 4 },
    grandAmt: { fontSize: m ? 36 : 18, fontFamily: m ? _fEB : _fB, color: m ? C.textPrimary : C.grandFg, letterSpacing: m ? -1 : 0 },
    grandBreakdown: { width: 180, flexShrink: 0 },
    grandBreakItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 1.5 },
    grandBreakLabel: { fontSize: m ? 6 : 7, color: m ? C.textLight : C.grandAccent, fontFamily: m ? _fL : _fR, letterSpacing: m ? 0.2 : 0 },
    grandBreakValue: { fontSize: m ? 7 : 7, color: m ? C.textPrimary : "#FFFFFF", fontFamily: m ? _fSB : _fB, textAlign: "right" },

    // Note
    note: {
      marginTop: 8,
      padding: "5 8",
      borderRadius: m ? 0 : 3,
      borderWidth: m ? 0 : 0.5,
      borderTopWidth: m ? 0.5 : 0,
      borderColor: C.tBorder,
      backgroundColor: "transparent",
    },
    noteText: { fontSize: 7, color: C.textLight, fontFamily: m ? _fL : _fR },

    // Footer
    footerBar: {
      marginTop: 14,
      paddingTop: 8,
      borderTopWidth: m ? 0.5 : 0.75,
      borderColor: C.divider,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerText: { fontSize: 6.5, color: C.textLight, fontFamily: m ? _fL : _fR },
  });
}
let S = makeS(NAVAL);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

const today = () => new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

const POLICY_LABEL: Record<PolicyAchievementEntry["type"], string> = {
  "target-bonus": "Target Bonus",
  "stock-in": "Stock-In",
  "activation-incentive": "Activation Incentive",
  "dealer-incentive": "Dealer Incentive",
};

// ─── Components ───────────────────────────────────────────────────────────────

function DocHeader({ dealerName, periodStart, periodEnd }: { dealerName: string; periodStart: string; periodEnd: string }) {
  return (
    <>
      <View style={S.headerBg}>
        <Text style={S.headerBrand}>OPPO PAKISTAN</Text>
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Dealer Incentive Report</Text>
            <Text style={S.headerMeta}>{dealerName}  ·  Period: {periodStart}  →  {periodEnd}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerDate}>Generated: {today()}</Text>
            <Text style={[S.headerDate, { marginTop: 2 }]}>CONFIDENTIAL</Text>
          </View>
        </View>
      </View>
      <View style={S.accentBar} />
    </>
  );
}

function KpiStrip({ report }: { report: IncentiveReport }) {
  const tb = report.targetBonus;
  return (
    <View style={S.kpiStrip}>
      <View style={S.kpiBox}>
        <Text style={S.kpiLabel}>TOTAL ACTIVATIONS</Text>
        <Text style={S.kpiValue}>{report.totalActivations}</Text>
        {report.totalActivationsCrossRegion > 0 && (
          <Text style={S.kpiSub}>{report.totalActivationsCrossRegion} cross-region</Text>
        )}
      </View>
      <View style={S.kpiBox}>
        <Text style={S.kpiLabel}>BASE {report.baseIncentivePercent}%</Text>
        <Text style={S.kpiValue}>{fmtPKR(report.totals.basePercentEarned)}</Text>
      </View>
      <View style={S.kpiBox}>
        <Text style={S.kpiLabel}>TARGET BONUS {tb.bonusPercent}%</Text>
        <Text style={S.kpiValue}>{report.totals.bonusPercentEarned > 0 ? fmtPKR(report.totals.bonusPercentEarned) : "—"}</Text>
        <Text style={S.kpiSub}>{tb.eligible ? "Target met ✓" : `${tb.actualQty}/${tb.targetQty ?? "—"} purchased`}</Text>
      </View>
      <View style={S.kpiBox}>
        <Text style={S.kpiLabel}>ACTIVATION INC.</Text>
        <Text style={S.kpiValue}>{report.totals.activationIncentiveEarned > 0 ? fmtPKR(report.totals.activationIncentiveEarned) : "—"}</Text>
      </View>
      <View style={S.kpiBox}>
        <Text style={S.kpiLabel}>DEALER INC.</Text>
        <Text style={S.kpiValue}>{report.totals.dealerIncentiveEarned > 0 ? fmtPKR(report.totals.dealerIncentiveEarned) : "—"}</Text>
      </View>
      <View style={S.kpiBox}>
        <Text style={S.kpiLabel}>STOCK-IN</Text>
        <Text style={S.kpiValue}>{report.totals.stockInEarned > 0 ? fmtPKR(report.totals.stockInEarned) : "—"}</Text>
      </View>
      <View style={S.kpiGrandBox}>
        <Text style={S.kpiGrandLabel}>GRAND TOTAL (OPPO PAYOUT)</Text>
        <Text style={S.kpiGrandValue}>{fmtPKR(report.totals.grandTotal)}</Text>
      </View>
    </View>
  );
}

function Footer({ page, total }: { page: number; total: number }) {
  return (
    <View style={S.footerBar}>
      <Text style={S.footerText}>OPPO Pakistan · Dealer Incentive Report · Confidential</Text>
      <Text style={S.footerText}>Page {page} of {total}  ·  Generated {today()}</Text>
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function buildPDF(
  report: IncentiveReport,
  dealerName: string,
  opts?: {
    skipNoIncentive?: boolean;
    policies?: PolicyAchievementEntry[];
    rebateRows?: RebateRow[];
    rebateTotal?: number;
    crCaughtRows?: CrCaughtExportRow[];
    crCaughtLoss?: { totalUnits: number; potentialLoss: number; totalFines: number };
  },
  theme: PdfTheme = NAVAL
): Promise<Buffer> {
  ensureInterFont(); C = buildC(theme); S = makeS(theme);
  const rows = opts?.skipNoIncentive
    ? report.rows.filter((r) => r.total > 0)
    : report.rows;

  const policies = opts?.policies ?? [];
  const shownPolicies = policies.filter((p) => !isZeroDealerIncentivePolicy(p));
  // Dealer Incentive = one policy (total-activation based) + engine's per-model split.
  const diBreakdown = buildDealerIncentiveBreakdown(report);
  const diPolicy = shownPolicies.find((p) => p.type === "dealer-incentive");
  const nonDiPolicies = shownPolicies.filter((p) => p.type !== "dealer-incentive");
  const rebateRows = opts?.rebateRows ?? [];
  const rebateTotal = opts?.rebateTotal ?? 0;
  const crCaughtRows = opts?.crCaughtRows ?? [];
  const crCaughtLoss = opts?.crCaughtLoss;
  const netReceivable = report.totals.grandTotal + rebateTotal - (crCaughtLoss?.totalFines ?? 0);
  const tb = report.targetBonus;
  const hasPage2 = shownPolicies.length > 0 || rebateRows.length > 0 || (crCaughtLoss?.totalUnits ?? 0) > 0;
  const totalPages = hasPage2 ? 2 : 1;

  const doc = (
    <Document>
      {/* ══ Page 1: Summary + Per-Model Table ══ */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

        <KpiStrip report={report} />

        {/* Per-model table */}
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>Per Model Incentive Breakdown</Text>
          <View style={S.sectionLine} />
          {opts?.skipNoIncentive && <Text style={[S.sectionTitle, { color: C.accentBar }]}>Incentive Models Only</Text>}
        </View>

        <View style={S.table}>
          <View style={S.tHeadRow}>
            <Text style={[S.tHCell, { width: "23%" }]}>Model</Text>
            <Text style={[S.tHCell, { width: "5%",  textAlign: "right" }]}>Qty</Text>
            <Text style={[S.tHCell, { width: "5%",  textAlign: "right" }]}>CR</Text>
            <Text style={[S.tHCell, { width: "14%", textAlign: "right" }]}>Price Split</Text>
            <Text style={[S.tHCell, { width: "11%", textAlign: "right" }]}>Base {report.baseIncentivePercent}%</Text>
            <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Bonus {tb.bonusPercent}%</Text>
            <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Act. Inc.</Text>
            <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Dlr. Inc.</Text>
            <Text style={[S.tHCell, { width: "7%",  textAlign: "right" }]}>Stock-In</Text>
            <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Total</Text>
          </View>

          {rows.map((r, i) => {
            const RowStyle = i % 2 === 1 ? S.tAltRow : S.tRow;
            return (
              <View key={r.modelId} style={RowStyle}>
                <Text style={[S.tCell, { width: "23%" }]}>{r.modelName}</Text>
                <Text style={[S.tCell, { width: "5%",  textAlign: "right" }]}>{r.qtyActivated}</Text>
                <Text style={[S.tCell, { width: "5%",  textAlign: "right", color: r.qtyActivatedCrossRegion > 0 ? C.red : C.textLight }]}>
                  {r.qtyActivatedCrossRegion > 0 ? r.qtyActivatedCrossRegion : "—"}
                </Text>
                <Text style={[S.tCell, { width: "14%", textAlign: "right", fontSize: 7, color: C.textMuted }]}>
                  {r.priceSubperiods.map((s) => `${s.qty}@${fmtPKR(s.dealerPrice)}`).join("  ")}
                </Text>
                <Text style={[S.tCellBold, { width: "11%", textAlign: "right" }]}>{fmtPKR(r.basePercentEarned)}</Text>
                <Text style={[S.tCell, { width: "10%", textAlign: "right" }]}>
                  {r.bonusPercentEarned > 0 ? fmtPKR(r.bonusPercentEarned) : "—"}
                </Text>
                <Text style={[S.tCell, { width: "10%", textAlign: "right" }]}>
                  {r.activationIncentiveEarned > 0 ? fmtPKR(r.activationIncentiveEarned) : "—"}
                </Text>
                <Text style={[S.tCell, { width: "10%", textAlign: "right" }]}>
                  {r.dealerIncentiveEarned > 0 ? fmtPKR(r.dealerIncentiveEarned) : "—"}
                </Text>
                <Text style={[S.tCell, { width: "7%",  textAlign: "right" }]}>
                  {r.stockInEarned > 0 ? fmtPKR(r.stockInEarned) : "—"}
                </Text>
                <Text style={[S.tCellBold, { width: "10%", textAlign: "right", color: C.accentBar }]}>
                  {fmtPKR(r.total)}
                </Text>
              </View>
            );
          })}

          {/* Totals row */}
          <View style={S.tTotalRow}>
            <Text style={[S.tTotalCell, { width: "23%" }]}>TOTAL</Text>
            <Text style={[S.tTotalCell, { width: "5%",  textAlign: "right" }]}>{rows.reduce((s, r) => s + r.qtyActivated, 0)}</Text>
            <Text style={[S.tTotalCell, { width: "5%",  textAlign: "right" }]}></Text>
            <Text style={[S.tTotalCell, { width: "14%", textAlign: "right" }]}></Text>
            <Text style={[S.tTotalCell, { width: "11%", textAlign: "right" }]}>{fmtPKR(rows.reduce((s, r) => s + r.basePercentEarned, 0))}</Text>
            <Text style={[S.tTotalCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(rows.reduce((s, r) => s + r.bonusPercentEarned, 0))}</Text>
            <Text style={[S.tTotalCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(rows.reduce((s, r) => s + r.activationIncentiveEarned, 0))}</Text>
            <Text style={[S.tTotalCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(rows.reduce((s, r) => s + r.dealerIncentiveEarned, 0))}</Text>
            <Text style={[S.tTotalCell, { width: "7%",  textAlign: "right" }]}>{fmtPKR(rows.reduce((s, r) => s + r.stockInEarned, 0))}</Text>
            <Text style={[S.tTotalCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(rows.reduce((s, r) => s + r.total, 0))}</Text>
          </View>
        </View>

        {/* Net Receivable / Grand total banner */}
        <View style={S.grandBanner}>
          <View style={S.grandLeft}>
            <Text style={S.grandTag}>
              {(rebateTotal > 0 || (crCaughtLoss?.totalFines ?? 0) > 0) ? "NET RECEIVABLE FROM OPPO" : "TOTAL AMOUNT EXPECTED FROM OPPO"}
            </Text>
            <Text style={S.grandAmt}>{fmtPKR(netReceivable)}</Text>
            {(rebateTotal > 0 || (crCaughtLoss?.totalFines ?? 0) > 0) && (
              <Text style={[S.grandBreakLabel, { marginTop: 4, fontSize: 7 }]}>
                {`Incentives: ${fmtPKR(report.totals.grandTotal)}`}
                {rebateTotal > 0 ? `  +  Rebates: ${fmtPKR(rebateTotal)}` : ""}
                {(crCaughtLoss?.totalFines ?? 0) > 0 ? `  −  Fines: ${fmtPKR(crCaughtLoss!.totalFines)}` : ""}
              </Text>
            )}
          </View>
          <View style={S.grandBreakdown}>
            {[
              { label: `Base ${report.baseIncentivePercent}%`, val: report.totals.basePercentEarned },
              { label: `Bonus ${tb.bonusPercent}%`, val: report.totals.bonusPercentEarned },
              { label: "Activation Inc.", val: report.totals.activationIncentiveEarned },
              { label: "Dealer Inc.", val: report.totals.dealerIncentiveEarned },
              { label: "Stock-In", val: report.totals.stockInEarned },
              ...(rebateTotal > 0 ? [{ label: "+ Rebates", val: rebateTotal }] : []),
              ...((crCaughtLoss?.totalFines ?? 0) > 0 ? [{ label: "− Fines", val: crCaughtLoss!.totalFines, neg: true }] : []),
            ].filter((e) => e.val > 0).map((e) => (
              <View key={e.label} style={S.grandBreakItem}>
                <Text style={S.grandBreakLabel}>{e.label}</Text>
                <Text style={[S.grandBreakValue, (e as {neg?: boolean}).neg ? { color: "#FCA5A5" } : {}]}>
                  {(e as {neg?: boolean}).neg ? `-${fmtPKR(e.val)}` : fmtPKR(e.val)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {report.totalActivationsCrossRegion > 0 && (
          <View style={S.note}>
            <Text style={S.noteText}>
              Cross-region note: {report.totalActivationsCrossRegion} phones were activated as cross-region. They earn base %, bonus %, activation incentive and dealer incentive but are excluded from stock-in incentive calculations.
            </Text>
          </View>
        )}

        <Footer page={1} total={totalPages} />
      </Page>

      {/* ══ Page 2: Rebates · CR Caught · Policies ══ */}
      {hasPage2 && (
        <Page size="A4" orientation="landscape" style={S.page}>
          <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

          {/* ── Price-Drop Rebates ── */}
          {rebateRows.length > 0 && (
            <>
              <View style={[S.sectionHeader, { marginTop: 12 }]}>
                <Text style={[S.sectionTitle, { color: "#0E7490" }]}>Price-Drop Rebates — OPPO Owes You</Text>
                <View style={S.sectionLine} />
                <Text style={[S.sectionTitle, { color: "#0E7490" }]}>{fmtPKR(rebateTotal)}</Text>
              </View>
              <View style={S.table}>
                <View style={S.tHeadRow}>
                  <Text style={[S.tHCell, { width: "12%" }]}>Date</Text>
                  <Text style={[S.tHCell, { width: "26%" }]}>Model</Text>
                  <Text style={[S.tHCell, { width: "16%", textAlign: "right" }]}>Old Price</Text>
                  <Text style={[S.tHCell, { width: "16%", textAlign: "right" }]}>New Price</Text>
                  <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Drop/Unit</Text>
                  <Text style={[S.tHCell, { width: "8%",  textAlign: "right" }]}>Qty</Text>
                  <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Rebate</Text>
                </View>
                {rebateRows.map((r, i) => (
                  <View key={r.id} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                    <Text style={[S.tCell, { width: "12%", fontSize: 7, color: C.textMuted }]}>{r.rebateDate}</Text>
                    <Text style={[S.tCellBold, { width: "26%" }]}>{r.modelName}</Text>
                    <Text style={[S.tCell, { width: "16%", textAlign: "right", color: C.textMuted, fontSize: 7 }]}>{fmtPKR(r.oldDealerPrice)}</Text>
                    <Text style={[S.tCell, { width: "16%", textAlign: "right" }]}>{fmtPKR(r.newDealerPrice)}</Text>
                    <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: "#0E7490" }]}>+{fmtPKR(r.rebatePerUnit)}</Text>
                    <Text style={[S.tCell, { width: "8%",  textAlign: "right" }]}>{r.eligibleQty}</Text>
                    <Text style={[S.tCellBold, { width: "10%", textAlign: "right", color: "#0E7490" }]}>{fmtPKR(r.totalRebateAmount)}</Text>
                  </View>
                ))}
                <View style={S.tTotalRow}>
                  <Text style={[S.tTotalCell, { width: "90%" }]}>TOTAL REBATES RECEIVABLE</Text>
                  <Text style={[S.tTotalCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(rebateTotal)}</Text>
                </View>
              </View>
            </>
          )}

          {/* ── CR Caught ── */}
          {(crCaughtLoss?.totalUnits ?? 0) > 0 && (
            <View style={{ marginTop: rebateRows.length > 0 ? 10 : 12, padding: "7 10", borderRadius: 4, borderWidth: 0.75, borderColor: C.redBorder, backgroundColor: C.redBg, flexDirection: "row", gap: 20 }}>
              <View>
                <Text style={[S.targetLabel, { color: C.red }]}>CR Caught — Penalty</Text>
                <Text style={[S.targetSub, { color: C.red }]}>{crCaughtLoss!.totalUnits} unit{crCaughtLoss!.totalUnits > 1 ? "s" : ""} caught</Text>
              </View>
              {crCaughtLoss!.totalFines > 0 && (
                <View>
                  <Text style={[S.targetSub, { color: C.red }]}>Cash Fines</Text>
                  <Text style={[S.targetLabel, { color: C.red }]}>{fmtPKR(crCaughtLoss!.totalFines)}</Text>
                </View>
              )}
              <View>
                <Text style={[S.targetSub, { color: C.red }]}>Potential incentive loss (est.)</Text>
                <Text style={[S.targetLabel, { color: C.red }]}>{fmtPKR(crCaughtLoss!.potentialLoss)}</Text>
              </View>
            </View>
          )}

          {/* ── Policies & Achievements ── */}
          {shownPolicies.length > 0 && (
            <>
              <View style={[S.sectionHeader, { marginTop: (rebateRows.length > 0 || (crCaughtLoss?.totalUnits ?? 0) > 0) ? 10 : 12 }]}>
                <Text style={S.sectionTitle}>Policies &amp; Achievements</Text>
                <View style={S.sectionLine} />
                <Text style={[S.sectionTitle, { color: C.green }]}>{shownPolicies.filter((p) => p.eligible).length} met</Text>
                <Text style={S.sectionTitle}> · </Text>
                <Text style={[S.sectionTitle, { color: C.red }]}>{shownPolicies.filter((p) => !p.eligible).length} not met</Text>
              </View>
              <View style={S.table}>
                <View style={S.tHeadRow}>
                  <Text style={[S.tHCell, { width: "18%" }]}>Policy Type</Text>
                  <Text style={[S.tHCell, { width: "18%" }]}>Model</Text>
                  <Text style={[S.tHCell, { width: "16%" }]}>Period</Text>
                  <Text style={[S.tHCell, { width: "9%",  textAlign: "right" }]}>Target</Text>
                  <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Rate / %</Text>
                  <Text style={[S.tHCell, { width: "9%",  textAlign: "right" }]}>Actual</Text>
                  <Text style={[S.tHCell, { width: "6%",  textAlign: "center" }]}>Status</Text>
                  <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Earned</Text>
                </View>
                {nonDiPolicies.map((p, i) => (
                  <View key={i} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                    <Text style={[S.tCellBold, { width: "18%", fontSize: 7.5 }]}>{POLICY_LABEL[p.type]}</Text>
                    <Text style={[S.tCell,     { width: "18%" }]}>{p.modelName ?? "All models"}</Text>
                    <Text style={[S.tCell,     { width: "16%", fontSize: 7, color: C.textMuted }]}>{p.periodStart} → {p.periodEnd}</Text>
                    <Text style={[S.tCell,     { width: "9%",  textAlign: "right" }]}>{p.targetQty ?? "—"}</Text>
                    <Text style={[S.tCell,     { width: "12%", textAlign: "right" }]}>
                      {p.type === "target-bonus" ? `${p.perUnitAmount}%` : fmtPKR(p.perUnitAmount)}
                    </Text>
                    <Text style={[S.tCell,     { width: "9%",  textAlign: "right" }]}>{p.actualQty}</Text>
                    <View style={{ width: "6%", padding: "3.5 4", alignItems: "center", justifyContent: "center" }}>
                      <View style={[S.badge, p.eligible ? S.badgeMet : S.badgeNotMet]}>
                        <Text>{p.eligible ? "Met ✓" : "Not Met"}</Text>
                      </View>
                    </View>
                    <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: p.eligible ? C.green : C.textMuted }]}>{fmtPKR(p.earned)}</Text>
                  </View>
                ))}

                {/* Dealer Incentive — single policy (total-activation based) + model-wise split */}
                {diBreakdown && diPolicy && (
                  <>
                    <View style={nonDiPolicies.length % 2 === 1 ? S.tAltRow : S.tRow}>
                      <Text style={[S.tCellBold, { width: "18%", fontSize: 7.5 }]}>{POLICY_LABEL["dealer-incentive"]}</Text>
                      <Text style={[S.tCell,     { width: "18%" }]}>All models</Text>
                      <Text style={[S.tCell,     { width: "16%", fontSize: 7, color: C.textMuted }]}>{diPolicy.periodStart} → {diPolicy.periodEnd}</Text>
                      <Text style={[S.tCell,     { width: "9%",  textAlign: "right" }]}>{diBreakdown.targetTotal}</Text>
                      <Text style={[S.tCell,     { width: "12%", textAlign: "right" }]}>{diBreakdown.perUnit != null ? fmtPKR(diBreakdown.perUnit) : "—"}</Text>
                      <Text style={[S.tCell,     { width: "9%",  textAlign: "right" }]}>{diBreakdown.actualTotal}</Text>
                      <View style={{ width: "6%", padding: "3.5 4", alignItems: "center", justifyContent: "center" }}>
                        <View style={[S.badge, diBreakdown.eligible ? S.badgeMet : S.badgeNotMet]}>
                          <Text>{diBreakdown.eligible ? "Met ✓" : "Not Met"}</Text>
                        </View>
                      </View>
                      <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: diBreakdown.eligible ? C.green : C.textMuted }]}>{fmtPKR(diBreakdown.totalEarned)}</Text>
                    </View>
                    {diBreakdown.eligible && diBreakdown.models.map((m) => (
                      <View key={m.modelId} style={S.tRow}>
                        <Text style={[S.tCell, { width: "18%" }]}></Text>
                        <Text style={[S.tCell, { width: "18%", fontSize: 7, color: C.textMuted, paddingLeft: 8 }]}>{m.modelName}</Text>
                        <Text style={[S.tCell, { width: "16%", fontSize: 7, color: C.textMuted }]}>-</Text>
                        <Text style={[S.tCell, { width: "9%",  fontSize: 7, color: C.textMuted, textAlign: "right" }]}>-</Text>
                        <Text style={[S.tCell, { width: "12%", fontSize: 7, color: C.textMuted, textAlign: "right" }]}>{m.perUnit ? fmtPKR(m.perUnit) : "—"}</Text>
                        <Text style={[S.tCell, { width: "9%",  fontSize: 7, color: C.textMuted, textAlign: "right" }]}>{m.qty}</Text>
                        <Text style={{ width: "6%" }}></Text>
                        <Text style={[S.tCellBold, { width: "12%", fontSize: 7.5, color: C.textMuted, textAlign: "right" }]}>{fmtPKR(m.amount)}</Text>
                      </View>
                    ))}
                  </>
                )}
                <View style={S.tTotalRow}>
                  <Text style={[S.tTotalCell, { width: "88%" }]}>NET RECEIVABLE</Text>
                  <Text style={[S.tTotalCell, { width: "12%", textAlign: "right" }]}>{fmtPKR(netReceivable)}</Text>
                </View>
              </View>
            </>
          )}

          <Footer page={2} total={totalPages} />
        </Page>
      )}
    </Document>
  );

  return await renderToBuffer(doc);
}

// ─── Analytics PDF ────────────────────────────────────────────────────────────
export async function buildAnalyticsPDF(
  report: IncentiveReport,
  dealerName: string,
  opts?: {
    policies?: PolicyAchievementEntry[];
    rebateRows?: RebateRow[];
    crCaughtRows?: CrCaughtExportRow[];
    crCaughtLoss?: { totalUnits: number; potentialLoss: number; totalFines: number };
    rebateTotal?: number;
  },
  theme: PdfTheme = NAVAL
): Promise<Buffer> {
  ensureInterFont(); C = buildC(theme); S = makeS(theme);
  const { policies = [], rebateRows = [], crCaughtRows = [], crCaughtLoss, rebateTotal = 0 } = opts ?? {};
  // Dealer Incentive renders as ONE consolidated policy + activated-model split,
  // identical to the Dealer Incentive Report page 2 (never the raw per-model dump).
  const shownPolicies = policies.filter((p) => !isZeroDealerIncentivePolicy(p));
  const diBreakdown = buildDealerIncentiveBreakdown(report);
  const diPolicy = shownPolicies.find((p) => p.type === "dealer-incentive");
  const nonDiPolicies = shownPolicies.filter((p) => p.type !== "dealer-incentive");
  const tb = report.targetBonus;
  const net = report.totals.grandTotal + rebateTotal - (crCaughtLoss?.totalFines ?? 0);
  const streams = [
    { label: `Base ${report.baseIncentivePercent}%`, val: report.totals.basePercentEarned },
    { label: `Target Bonus ${tb.bonusPercent}%`, val: report.totals.bonusPercentEarned },
    { label: "Activation Incentive", val: report.totals.activationIncentiveEarned },
    { label: "Dealer Incentive", val: report.totals.dealerIncentiveEarned },
    { label: "Stock-In", val: report.totals.stockInEarned },
  ].filter((s) => s.val > 0);
  const hasModelRows = report.rows.filter(r => r.total > 0).length > 0;
  const tp = 1 + (hasModelRows ? 1 : 0) + (shownPolicies.length > 0 ? 1 : 0) + 1;

  const PH = 24; // portrait horizontal padding
  const ph = (n: number) => -n as unknown as number; // neg margin helper

  const AH = StyleSheet.create({
    page: { paddingHorizontal: PH, paddingTop: 0, paddingBottom: 18, fontSize: 8.5, fontFamily: _fR, color: C.textPrimary, backgroundColor: "#FFFFFF" },
    heroRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
    heroBox: { flex: 1, borderRadius: 5, padding: "9 10", borderWidth: 1 },
    heroLabel: { fontSize: 6.5, fontFamily: _fB, letterSpacing: 0.5, marginBottom: 4 },
    heroVal: { fontSize: 14, fontFamily: _fB },
    heroSub: { fontSize: 6.5, marginTop: 3 },
  });

  const AnalyticsHeader = ({ sub }: { sub?: string }) => (
    <>
      <View style={[S.headerBg, { marginHorizontal: ph(PH) }]}>
        <Text style={S.headerBrand}>OPPO PAKISTAN</Text>
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Dealer Analytics Report{sub ? ` — ${sub}` : ""}</Text>
            <Text style={S.headerMeta}>{dealerName} · {report.periodStart} → {report.periodEnd}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerDate}>Generated: {today()}</Text>
            <Text style={[S.headerDate, { marginTop: 2 }]}>CONFIDENTIAL</Text>
          </View>
        </View>
      </View>
      <View style={[S.accentBar, { marginHorizontal: ph(PH) }]} />
    </>
  );

  const doc = (
    <Document>
      {/* ══ Page 1: Financial Overview ══ */}
      <Page size="A4" style={AH.page}>
        <AnalyticsHeader />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 10 }}>
          <Text style={[S.sectionTitle, { color: C.accentBar }]}>FINANCIAL ANALYTICS OVERVIEW</Text>
          <View style={S.sectionLine} />
          <Text style={S.sectionTitle}>{report.totalActivations} ACTIVATIONS</Text>
        </View>

        {/* 3 Hero Boxes */}
        <View style={AH.heroRow}>
          <View style={[AH.heroBox, { borderColor: C.kpiBorder, backgroundColor: C.kpiBg }]}>
            <Text style={[AH.heroLabel, { color: C.kpiLabel }]}>GROSS FROM OPPO</Text>
            <Text style={[AH.heroVal, { color: C.accentBar }]}>{fmtPKR(report.totals.grandTotal)}</Text>
            <Text style={[AH.heroSub, { color: C.textMuted }]}>{report.totalActivations} activations · {report.rows.filter(r => r.total > 0).length} models</Text>
          </View>
          <View style={[AH.heroBox, { borderColor: rebateTotal > 0 ? "#0891B2" : C.tBorder, backgroundColor: rebateTotal > 0 ? "#ECFEFF" : "#FAFAFA" }]}>
            <Text style={[AH.heroLabel, { color: rebateTotal > 0 ? "#0E7490" : C.textMuted }]}>REBATES RECEIVABLE</Text>
            <Text style={[AH.heroVal, { color: rebateTotal > 0 ? "#0E7490" : C.textLight }]}>{rebateTotal > 0 ? fmtPKR(rebateTotal) : "—"}</Text>
            <Text style={[AH.heroSub, { color: C.textMuted }]}>{rebateRows.length > 0 ? `${rebateRows.length} price-drop event${rebateRows.length !== 1 ? "s" : ""}` : "No price drops this period"}</Text>
          </View>
          <View style={[AH.heroBox, theme.minimal
            ? { borderColor: C.textPrimary, borderTopWidth: 2, backgroundColor: "transparent" }
            : { borderColor: C.accentBar, backgroundColor: C.grandBg }]}>
            <Text style={[AH.heroLabel, { color: theme.minimal ? C.textMuted : C.grandAccent }]}>NET RECEIVABLE</Text>
            <Text style={[AH.heroVal, { color: theme.minimal ? C.textPrimary : C.grandFg }]}>{fmtPKR(net)}</Text>
            <Text style={[AH.heroSub, { color: (crCaughtLoss?.totalFines ?? 0) > 0 ? (theme.minimal ? C.red : "#FCA5A5") : (theme.minimal ? C.textMuted : C.grandAccent) }]}>
              {(crCaughtLoss?.totalFines ?? 0) > 0 ? `After −${fmtPKR(crCaughtLoss!.totalFines)} fines` : rebateTotal > 0 ? "Incentive + rebates" : "Total incentive"}
            </Text>
          </View>
        </View>

        {/* Income Streams Table */}
        <View style={[S.sectionHeader, { marginBottom: 5 }]}>
          <Text style={S.sectionTitle}>Income Streams Breakdown</Text>
          <View style={S.sectionLine} />
        </View>
        <View style={S.table}>
          <View style={S.tHeadRow}>
            <Text style={[S.tHCell, { width: "40%" }]}>Stream</Text>
            <Text style={[S.tHCell, { width: "30%", textAlign: "right" }]}>Earned (PKR)</Text>
            <Text style={[S.tHCell, { width: "18%", textAlign: "right" }]}>% of Gross</Text>
            <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Models</Text>
          </View>
          {streams.map((s, i) => {
            const pct = report.totals.grandTotal > 0 ? (s.val / report.totals.grandTotal) * 100 : 0;
            const mc = s.label.includes("Stock") ? report.rows.filter(r => r.stockInEarned > 0).length
              : s.label.includes("Activation") ? report.rows.filter(r => r.activationIncentiveEarned > 0).length
              : s.label.includes("Dealer") ? report.rows.filter(r => r.dealerIncentiveEarned > 0).length
              : report.rows.filter(r => r.basePercentEarned > 0).length;
            return (
              <View key={s.label} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                <Text style={[S.tCellBold, { width: "40%" }]}>{s.label}</Text>
                <Text style={[S.tCell, { width: "30%", textAlign: "right", fontFamily: _fB, color: C.accentBar }]}>{fmtPKR(s.val)}</Text>
                <Text style={[S.tCell, { width: "18%", textAlign: "right" }]}>{pct.toFixed(1)}%</Text>
                <Text style={[S.tCell, { width: "12%", textAlign: "right", color: C.textMuted }]}>{mc}</Text>
              </View>
            );
          })}
          <View style={S.tTotalRow}>
            <Text style={[S.tTotalCell, { width: "40%" }]}>GRAND TOTAL</Text>
            <Text style={[S.tTotalCell, { width: "30%", textAlign: "right" }]}>{fmtPKR(report.totals.grandTotal)}</Text>
            <Text style={[S.tTotalCell, { width: "18%", textAlign: "right" }]}>100.0%</Text>
            <Text style={[S.tTotalCell, { width: "12%" }]}></Text>
          </View>
        </View>

        {/* Target Bonus */}
        <View style={[S.targetRow, { marginTop: 10, borderColor: tb.eligible ? C.greenBorder : C.redBorder, backgroundColor: tb.eligible ? C.greenBg : C.redBg }]}>
          <View style={{ flex: 1 }}>
            <Text style={[S.targetLabel, { color: tb.eligible ? C.green : C.red }]}>
              Target Bonus {tb.bonusPercent}%
            </Text>
            <Text style={S.targetSub}>
              {tb.actualQty} / {tb.targetQty ?? "—"} units purchased
              {!tb.eligible && tb.targetQty ? ` · need ${tb.targetQty - tb.actualQty} more` : ""}
              {tb.eligible ? " · TARGET ACHIEVED ✓" : " · NOT REACHED ✗"}
            </Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: _fSB, color: tb.eligible ? C.green : C.red, marginRight: 6, minWidth: 72, textAlign: "right" }}>{fmtPKR(report.totals.bonusPercentEarned)}</Text>
          <View style={[S.badge, tb.eligible ? S.badgeMet : S.badgeNotMet]}><Text>{tb.eligible ? "Met ✓" : "✗"}</Text></View>
        </View>

        {crCaughtLoss && crCaughtLoss.totalUnits > 0 && (
          <View style={{ marginTop: 8, padding: "6 8", borderRadius: 4, borderWidth: 0.75, borderColor: C.redBorder, backgroundColor: C.redBg, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Text style={[S.targetLabel, { color: C.red }]}>CR Caught:</Text>
            <Text style={[S.targetSub, { color: C.red }]}>{crCaughtLoss.totalUnits} units</Text>
            {crCaughtLoss.totalFines > 0 && <Text style={[S.targetSub, { color: C.red }]}>· Cash Fines: {fmtPKR(crCaughtLoss.totalFines)}</Text>}
            <Text style={[S.targetSub, { color: C.red }]}>· Potential incentive loss (est.): {fmtPKR(crCaughtLoss.potentialLoss)}</Text>
          </View>
        )}
        <Footer page={1} total={tp} />
      </Page>

      {/* ══ Page 2: Per-Model Breakdown + Rebates/CR Detail ══ */}
      {hasModelRows && (
        <Page size="A4" style={AH.page}>
          <AnalyticsHeader sub="Per-Model Breakdown" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 8 }}>
            <Text style={[S.sectionTitle, { color: C.accentBar }]}>PER-MODEL INCENTIVE BREAKDOWN</Text>
            <View style={S.sectionLine} />
            <Text style={S.sectionTitle}>{report.rows.filter(r => r.total > 0).length} MODELS</Text>
          </View>
          <View style={S.table}>
            <View style={S.tHeadRow}>
              <Text style={[S.tHCell, { width: "26%" }]}>Model</Text>
              <Text style={[S.tHCell, { width: "6%",  textAlign: "right" }]}>Qty</Text>
              <Text style={[S.tHCell, { width: "5%",  textAlign: "right" }]}>CR</Text>
              <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Base {report.baseIncentivePercent}%</Text>
              <Text style={[S.tHCell, { width: "11%", textAlign: "right" }]}>Bonus {tb.bonusPercent}%</Text>
              <Text style={[S.tHCell, { width: "11%", textAlign: "right" }]}>Act. Inc.</Text>
              <Text style={[S.tHCell, { width: "11%", textAlign: "right" }]}>Dealer Inc.</Text>
              <Text style={[S.tHCell, { width: "8%",  textAlign: "right" }]}>Stock-In</Text>
              <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Total</Text>
            </View>
            {report.rows.filter(r => r.total > 0).map((r, i) => (
              <View key={r.modelId} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                {/* Model + price-split sub-line (editorial primary/secondary stack) */}
                <View style={{ width: "26%", padding: theme.minimal ? "4.5 5" : "3.5 5" }}>
                  <Text style={{ fontSize: 8, fontFamily: _fSB, color: C.textPrimary }}>{r.modelName}</Text>
                  <Text style={{ fontSize: 6.5, color: C.textLight, fontFamily: _fR, marginTop: 1.5 }}>
                    {r.priceSubperiods.map((s) => `${s.qty} @ ${fmtPKR(s.dealerPrice)}`).join("   ·   ")}
                  </Text>
                </View>
                <Text style={[S.tCell,     { width: "6%",  textAlign: "right" }]}>{r.qtyActivated}</Text>
                <Text style={[S.tCell,     { width: "5%",  textAlign: "right", color: r.qtyActivatedCrossRegion > 0 ? C.red : C.textLight }]}>
                  {r.qtyActivatedCrossRegion > 0 ? r.qtyActivatedCrossRegion : "—"}
                </Text>
                <Text style={[S.tCellBold, { width: "12%", textAlign: "right" }]}>{fmtPKR(r.basePercentEarned)}</Text>
                <Text style={[S.tCell,     { width: "11%", textAlign: "right", color: r.bonusPercentEarned > 0 ? C.textPrimary : C.textLight }]}>{r.bonusPercentEarned > 0 ? fmtPKR(r.bonusPercentEarned) : "—"}</Text>
                <Text style={[S.tCell,     { width: "11%", textAlign: "right", color: r.activationIncentiveEarned > 0 ? C.textPrimary : C.textLight }]}>{r.activationIncentiveEarned > 0 ? fmtPKR(r.activationIncentiveEarned) : "—"}</Text>
                <Text style={[S.tCell,     { width: "11%", textAlign: "right", color: r.dealerIncentiveEarned > 0 ? C.textPrimary : C.textLight }]}>{r.dealerIncentiveEarned > 0 ? fmtPKR(r.dealerIncentiveEarned) : "—"}</Text>
                <Text style={[S.tCell,     { width: "8%",  textAlign: "right", color: r.stockInEarned > 0 ? C.textPrimary : C.textLight }]}>{r.stockInEarned > 0 ? fmtPKR(r.stockInEarned) : "—"}</Text>
                <Text style={[S.tCellBold, { width: "10%", textAlign: "right", color: C.accentBar }]}>{fmtPKR(r.total)}</Text>
              </View>
            ))}
            <View style={S.tTotalRow}>
              <Text style={[S.tTotalCell, { width: "26%" }]}>TOTAL</Text>
              <Text style={[S.tTotalCell, { width: "6%",  textAlign: "right" }]}>{report.rows.reduce((s, r) => s + r.qtyActivated, 0)}</Text>
              <Text style={[S.tTotalCell, { width: "5%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "12%", textAlign: "right" }]}>{fmtPKR(report.totals.basePercentEarned)}</Text>
              <Text style={[S.tTotalCell, { width: "11%", textAlign: "right" }]}>{fmtPKR(report.totals.bonusPercentEarned)}</Text>
              <Text style={[S.tTotalCell, { width: "11%", textAlign: "right" }]}>{fmtPKR(report.totals.activationIncentiveEarned)}</Text>
              <Text style={[S.tTotalCell, { width: "11%", textAlign: "right" }]}>{fmtPKR(report.totals.dealerIncentiveEarned)}</Text>
              <Text style={[S.tTotalCell, { width: "8%",  textAlign: "right" }]}>{fmtPKR(report.totals.stockInEarned)}</Text>
              <Text style={[S.tTotalCell, { width: "10%", textAlign: "right", color: C.accentBar }]}>{fmtPKR(report.totals.grandTotal)}</Text>
            </View>
          </View>

          {/* Rebates section */}
          {rebateRows.length > 0 && (
            <>
              <View style={[S.sectionHeader, { marginTop: 14 }]}>
                <Text style={[S.sectionTitle, { color: "#0E7490" }]}>Price-Drop Rebates</Text>
                <View style={S.sectionLine} />
                <Text style={[S.sectionTitle, { color: "#0E7490" }]}>{fmtPKR(rebateTotal)}</Text>
              </View>
              <View style={S.table}>
                <View style={S.tHeadRow}>
                  <Text style={[S.tHCell, { width: "13%" }]}>Date</Text>
                  <Text style={[S.tHCell, { width: "28%" }]}>Model</Text>
                  <Text style={[S.tHCell, { width: "17%", textAlign: "right" }]}>Old Price</Text>
                  <Text style={[S.tHCell, { width: "17%", textAlign: "right" }]}>New Price</Text>
                  <Text style={[S.tHCell, { width: "11%", textAlign: "right" }]}>Drop/Unit</Text>
                  <Text style={[S.tHCell, { width: "7%",  textAlign: "right" }]}>Qty</Text>
                  <Text style={[S.tHCell, { width: "7%",  textAlign: "right" }]}>Rebate</Text>
                </View>
                {rebateRows.map((r, i) => (
                  <View key={r.id} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                    <Text style={[S.tCell, { width: "13%", fontSize: 7, color: C.textMuted }]}>{r.rebateDate}</Text>
                    <Text style={[S.tCellBold, { width: "28%" }]}>{r.modelName}</Text>
                    <Text style={[S.tCell, { width: "17%", textAlign: "right", color: C.textMuted, fontSize: 7 }]}>{fmtPKR(r.oldDealerPrice)}</Text>
                    <Text style={[S.tCell, { width: "17%", textAlign: "right" }]}>{fmtPKR(r.newDealerPrice)}</Text>
                    <Text style={[S.tCellBold, { width: "11%", textAlign: "right", color: "#0E7490" }]}>+{fmtPKR(r.rebatePerUnit)}</Text>
                    <Text style={[S.tCell, { width: "7%",  textAlign: "right" }]}>{r.eligibleQty}</Text>
                    <Text style={[S.tCellBold, { width: "7%",  textAlign: "right", color: "#0E7490" }]}>{fmtPKR(r.totalRebateAmount)}</Text>
                  </View>
                ))}
                <View style={S.tTotalRow}>
                  <Text style={[S.tTotalCell, { width: "93%", color: "#0E7490" }]}>TOTAL REBATES</Text>
                  <Text style={[S.tTotalCell, { width: "7%", textAlign: "right", color: "#0E7490" }]}>{fmtPKR(rebateTotal)}</Text>
                </View>
              </View>
            </>
          )}

          {/* CR Caught / Fines section */}
          {crCaughtRows.length > 0 && (
            <>
              <View style={[S.sectionHeader, { marginTop: 14 }]}>
                <Text style={[S.sectionTitle, { color: C.red }]}>CR Caught — Penalty Log</Text>
                <View style={S.sectionLine} />
                {(crCaughtLoss?.totalFines ?? 0) > 0 && (
                  <Text style={[S.sectionTitle, { color: C.red }]}>−{fmtPKR(crCaughtLoss!.totalFines)}</Text>
                )}
              </View>
              <View style={S.table}>
                <View style={S.tHeadRow}>
                  <Text style={[S.tHCell, { width: "14%" }]}>Date</Text>
                  <Text style={[S.tHCell, { width: "30%" }]}>Model</Text>
                  <Text style={[S.tHCell, { width: "8%",  textAlign: "right" }]}>Qty</Text>
                  <Text style={[S.tHCell, { width: "21%", textAlign: "right" }]}>Price Snapshot</Text>
                  <Text style={[S.tHCell, { width: "14%", textAlign: "right" }]}>Cash Fine</Text>
                  <Text style={[S.tHCell, { width: "13%", textAlign: "right" }]}>Potential loss</Text>
                </View>
                {crCaughtRows.map((r, i) => {
                  // Summed from the engine's own per-row components, so this column always
                  // adds up to the reported total and respects which policy gates were met.
                  const est = report.potentialLoss.components
                    .filter((c) => c.crCaughtId === r.id)
                    .reduce((s, c) => s + c.amount, 0);
                  return (
                    <View key={i} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                      <Text style={[S.tCell, { width: "14%", fontSize: 7, color: C.textMuted }]}>{r.caughtDate}</Text>
                      <Text style={[S.tCellBold, { width: "30%" }]}>{r.modelName}</Text>
                      <Text style={[S.tCell, { width: "8%",  textAlign: "right" }]}>{r.quantity}</Text>
                      <Text style={[S.tCell, { width: "21%", textAlign: "right" }]}>{r.dealerPriceSnapshot > 0 ? fmtPKR(r.dealerPriceSnapshot) : "—"}</Text>
                      <Text style={[S.tCell, { width: "14%", textAlign: "right", color: r.fineAmount > 0 ? C.red : C.textLight }]}>{r.fineAmount > 0 ? `−${fmtPKR(r.fineAmount)}` : "—"}</Text>
                      <Text style={[S.tCell, { width: "13%", textAlign: "right", color: C.red }]}>{est > 0 ? `−${fmtPKR(est)}` : "—"}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <View style={[S.grandBanner, { marginTop: 12 }]}>
            <View style={S.grandLeft}>
              <Text style={S.grandTag}>{(rebateTotal > 0 || (crCaughtLoss?.totalFines ?? 0) > 0) ? "NET RECEIVABLE FROM OPPO" : "GRAND TOTAL INCENTIVES"}</Text>
              <Text style={S.grandAmt}>{fmtPKR(net)}</Text>
            </View>
            <View style={S.grandBreakdown}>
              {[
                { label: "Incentives", val: report.totals.grandTotal },
                ...(rebateTotal > 0 ? [{ label: "+ Rebates", val: rebateTotal }] : []),
                ...((crCaughtLoss?.totalFines ?? 0) > 0 ? [{ label: "− Fines", val: crCaughtLoss!.totalFines, neg: true }] : []),
              ].map((e) => (
                <View key={e.label} style={S.grandBreakItem}>
                  <Text style={[S.grandBreakLabel, { color: (e as {neg?:boolean}).neg ? C.red : "#0E7490" }]}>{e.label}</Text>
                  <Text style={[S.grandBreakValue, (e as {neg?:boolean}).neg ? { color: C.red } : {}]}>
                    {(e as {neg?:boolean}).neg ? `−${fmtPKR(e.val)}` : fmtPKR(e.val)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Footer page={2} total={tp} />
        </Page>
      )}


      {/* ══ Last Page: Policies ══ */}
      {shownPolicies.length > 0 && (
        <Page size="A4" style={AH.page}>
          <AnalyticsHeader sub="Policies" />
          <View style={[S.sectionHeader, { marginTop: 12 }]}>
            <Text style={S.sectionTitle}>Policies &amp; Achievements</Text>
            <View style={S.sectionLine} />
            <Text style={[S.sectionTitle, { color: C.green }]}>{shownPolicies.filter(p => p.eligible).length} met · </Text>
            <Text style={[S.sectionTitle, { color: C.red }]}>{shownPolicies.filter(p => !p.eligible).length} not met</Text>
          </View>
          <View style={S.table}>
            <View style={S.tHeadRow}>
              <Text style={[S.tHCell, { width: "18%" }]}>Policy Type</Text>
              <Text style={[S.tHCell, { width: "18%" }]}>Model</Text>
              <Text style={[S.tHCell, { width: "16%" }]}>Period</Text>
              <Text style={[S.tHCell, { width: "9%",  textAlign: "right" }]}>Target</Text>
              <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Rate / %</Text>
              <Text style={[S.tHCell, { width: "9%",  textAlign: "right" }]}>Actual</Text>
              <Text style={[S.tHCell, { width: "6%",  textAlign: "center" }]}>Status</Text>
              <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Earned</Text>
            </View>
            {nonDiPolicies.map((p, i) => (
              <View key={i} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                <Text style={[S.tCellBold, { width: "18%", fontSize: 7.5 }]}>{POLICY_LABEL[p.type]}</Text>
                <Text style={[S.tCell, { width: "18%" }]}>{p.modelName ?? "All models"}</Text>
                <Text style={[S.tCell, { width: "16%", fontSize: 7, color: C.textMuted }]}>{p.periodStart} → {p.periodEnd}</Text>
                <Text style={[S.tCell, { width: "9%",  textAlign: "right" }]}>{p.targetQty ?? "—"}</Text>
                <Text style={[S.tCell, { width: "12%", textAlign: "right" }]}>{p.type === "target-bonus" ? `${p.perUnitAmount}%` : fmtPKR(p.perUnitAmount)}</Text>
                <Text style={[S.tCell, { width: "9%",  textAlign: "right" }]}>{p.actualQty}</Text>
                <View style={{ width: "6%", padding: "3.5 4", alignItems: "center", justifyContent: "center" }}>
                  <View style={[S.badge, p.eligible ? S.badgeMet : S.badgeNotMet]}><Text>{p.eligible ? "Met ✓" : "✗"}</Text></View>
                </View>
                <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: p.eligible ? C.green : C.textMuted }]}>{fmtPKR(p.earned)}</Text>
              </View>
            ))}

            {/* Dealer Incentive — single policy (total-activation based) + activated-model split */}
            {diBreakdown && diPolicy && (
              <>
                <View style={nonDiPolicies.length % 2 === 1 ? S.tAltRow : S.tRow}>
                  <Text style={[S.tCellBold, { width: "18%", fontSize: 7.5 }]}>{POLICY_LABEL["dealer-incentive"]}</Text>
                  <Text style={[S.tCell, { width: "18%" }]}>All models</Text>
                  <Text style={[S.tCell, { width: "16%", fontSize: 7, color: C.textMuted }]}>{diPolicy.periodStart} → {diPolicy.periodEnd}</Text>
                  <Text style={[S.tCell, { width: "9%",  textAlign: "right" }]}>{diBreakdown.targetTotal}</Text>
                  <Text style={[S.tCell, { width: "12%", textAlign: "right" }]}>{diBreakdown.perUnit != null ? fmtPKR(diBreakdown.perUnit) : "—"}</Text>
                  <Text style={[S.tCell, { width: "9%",  textAlign: "right" }]}>{diBreakdown.actualTotal}</Text>
                  <View style={{ width: "6%", padding: "3.5 4", alignItems: "center", justifyContent: "center" }}>
                    <View style={[S.badge, diBreakdown.eligible ? S.badgeMet : S.badgeNotMet]}><Text>{diBreakdown.eligible ? "Met ✓" : "✗"}</Text></View>
                  </View>
                  <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: diBreakdown.eligible ? C.green : C.textMuted }]}>{fmtPKR(diBreakdown.totalEarned)}</Text>
                </View>
                {diBreakdown.eligible && diBreakdown.models.map((m) => (
                  <View key={m.modelId} style={S.tRow}>
                    <Text style={[S.tCell, { width: "18%" }]}></Text>
                    <Text style={[S.tCell, { width: "18%", fontSize: 7, color: C.textMuted, paddingLeft: 8 }]}>{m.modelName}</Text>
                    <Text style={[S.tCell, { width: "16%", fontSize: 7, color: C.textMuted }]}>-</Text>
                    <Text style={[S.tCell, { width: "9%",  fontSize: 7, color: C.textMuted, textAlign: "right" }]}>-</Text>
                    <Text style={[S.tCell, { width: "12%", fontSize: 7, color: C.textMuted, textAlign: "right" }]}>{m.perUnit ? fmtPKR(m.perUnit) : "—"}</Text>
                    <Text style={[S.tCell, { width: "9%",  fontSize: 7, color: C.textMuted, textAlign: "right" }]}>{m.qty}</Text>
                    <Text style={{ width: "6%" }}></Text>
                    <Text style={[S.tCellBold, { width: "12%", fontSize: 7.5, color: C.textMuted, textAlign: "right" }]}>{fmtPKR(m.amount)}</Text>
                  </View>
                ))}
              </>
            )}
            <View style={S.tTotalRow}>
              <Text style={[S.tTotalCell, { width: "88%" }]}>TOTAL ELIGIBLE</Text>
              <Text style={[S.tTotalCell, { width: "12%", textAlign: "right" }]}>{fmtPKR(shownPolicies.filter(p => p.eligible).reduce((s, p) => s + p.earned, 0))}</Text>
            </View>
          </View>
          <Footer page={tp - 1} total={tp} />
        </Page>
      )}

      {/* ══ Final Page: Period Summary ══ */}
      <Page size="A4" style={AH.page}>
        <AnalyticsHeader sub="Period Summary" />

        {/* Hero net receivable banner */}
        <View style={{ marginTop: 10, marginBottom: 10, padding: theme.minimal ? "10 0" : "11 14", borderRadius: theme.minimal ? 0 : 5, backgroundColor: theme.minimal ? "transparent" : C.grandBg, borderTopWidth: theme.minimal ? 2 : 0, borderTopColor: theme.minimal ? C.textPrimary : "transparent", borderBottomWidth: theme.minimal ? 1 : 0, borderBottomColor: theme.minimal ? C.divider : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 6.5, color: theme.minimal ? C.textMuted : C.grandAccent, fontFamily: _fB, letterSpacing: 0.5, marginBottom: 4 }}>NET RECEIVABLE FROM OPPO — FINAL TOTAL</Text>
            <Text style={{ fontSize: 22, fontFamily: _fB, color: theme.minimal ? C.textPrimary : "#FFFFFF" }}>{fmtPKR(net)}</Text>
            <Text style={{ fontSize: 7, color: theme.minimal ? C.textMuted : C.grandAccent, marginTop: 4 }}>{dealerName}  ·  {report.periodStart} → {report.periodEnd}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 6.5, color: theme.minimal ? C.textMuted : C.grandAccent, fontFamily: _fB, marginBottom: 4 }}>PERIOD AT A GLANCE</Text>
            <Text style={{ fontSize: 10, color: theme.minimal ? C.textPrimary : "#FFFFFF", fontFamily: _fB }}>{report.totalActivations} Activations</Text>
            <Text style={{ fontSize: 7, color: theme.minimal ? C.textMuted : C.grandAccent, marginTop: 2 }}>
              {report.rows.filter(r => r.total > 0).length} Models  ·  {shownPolicies.filter(p => p.eligible).length}/{shownPolicies.length} Policies Met
            </Text>
          </View>
        </View>

        {/* KPI Grid — Row 1: Activity metrics */}
        <View style={{ flexDirection: "row", gap: 5, marginBottom: 5 }}>
          {[
            { label: "TOTAL ACTIVATIONS",  val: String(report.totalActivations),  sub: report.totalActivationsCrossRegion > 0 ? `${report.totalActivationsCrossRegion} cross-region` : "All standard" },
            { label: "MODELS ACTIVE",       val: String(report.rows.filter(r => r.total > 0).length), sub: `of ${report.rows.length} total models` },
            { label: "TARGET BONUS",        val: tb.eligible ? "ACHIEVED ✓" : "NOT MET ✗",           sub: `${tb.actualQty} / ${tb.targetQty ?? "—"} units`, color: tb.eligible ? C.green : C.red },
            { label: "POLICIES MET",        val: `${shownPolicies.filter(p => p.eligible).length} / ${shownPolicies.length}`, sub: shownPolicies.filter(p => !p.eligible).length > 0 ? `${shownPolicies.filter(p => !p.eligible).length} missed` : shownPolicies.length > 0 ? "All achieved!" : "No policies", color: shownPolicies.length > 0 && shownPolicies.every(p => p.eligible) ? C.green : undefined },
          ].map(k => (
            <View key={k.label} style={{ flex: 1, borderWidth: 0.75, borderColor: C.divider, borderRadius: 4, backgroundColor: "#FAFAFA", padding: "7 8" }}>
              <Text style={{ fontSize: 6, color: C.textMuted, fontFamily: _fB, letterSpacing: 0.4, marginBottom: 3 }}>{k.label}</Text>
              <Text style={{ fontSize: 11, fontFamily: _fB, color: k.color ?? C.textPrimary }}>{k.val}</Text>
              {k.sub ? <Text style={{ fontSize: 6.5, color: C.textMuted, marginTop: 2 }}>{k.sub}</Text> : null}
            </View>
          ))}
        </View>

        {/* KPI Grid — Row 2: Financial metrics */}
        <View style={{ flexDirection: "row", gap: 5, marginBottom: 12 }}>
          {[
            { label: "GROSS INCENTIVE",      val: fmtPKR(report.totals.grandTotal),                                           color: C.accentBar,   bg: C.kpiBg,  border: C.kpiBorder },
            { label: "+ PRICE-DROP REBATES", val: rebateTotal > 0 ? fmtPKR(rebateTotal) : "—",                               color: rebateTotal > 0 ? "#0E7490" : C.textLight },
            { label: "− CR FINES",           val: (crCaughtLoss?.totalFines ?? 0) > 0 ? fmtPKR(crCaughtLoss!.totalFines) : "—", color: (crCaughtLoss?.totalFines ?? 0) > 0 ? C.red : C.textLight },
            { label: "= NET RECEIVABLE",     val: fmtPKR(net),                                                                color: C.accentBar,   bg: C.kpiBg,  border: C.accentBar },
          ].map(k => (
            <View key={k.label} style={{ flex: 1, borderWidth: 0.75, borderColor: (k as {border?: string}).border ?? C.divider, borderRadius: 4, backgroundColor: (k as {bg?: string}).bg ?? "#FAFAFA", padding: "7 8" }}>
              <Text style={{ fontSize: 6, color: C.textMuted, fontFamily: _fB, letterSpacing: 0.4, marginBottom: 3 }}>{k.label}</Text>
              <Text style={{ fontSize: 11, fontFamily: _fB, color: k.color }}>{k.val}</Text>
            </View>
          ))}
        </View>

        {/* Income streams visual bar breakdown */}
        <View style={[S.sectionHeader, { marginBottom: 6 }]}>
          <Text style={S.sectionTitle}>INCOME STREAM BREAKDOWN</Text>
          <View style={S.sectionLine} />
          <Text style={S.sectionTitle}>{fmtPKR(report.totals.grandTotal)}</Text>
        </View>
        {streams.map((s, i) => {
          const pct = report.totals.grandTotal > 0 ? (s.val / report.totals.grandTotal) * 100 : 0;
          const barColors = [C.accentBar, "#7C3AED", "#0E7490", "#059669", "#D97706"];
          return (
            <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <Text style={{ width: "32%", fontSize: 7.5, fontFamily: _fB, color: C.textPrimary }}>{s.label}</Text>
              <View style={{ flex: 1, height: 10, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                <View style={{ width: `${pct}%` as unknown as number, height: 10, backgroundColor: barColors[i] ?? C.accentBar, borderRadius: 3 }} />
              </View>
              <Text style={{ width: "22%", fontSize: 7.5, fontFamily: _fB, color: barColors[i] ?? C.accentBar, textAlign: "right" }}>{fmtPKR(s.val)}</Text>
              <Text style={{ width: "7%", fontSize: 7, color: C.textMuted, textAlign: "right" }}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}

        {/* Two-column: Top Models + Financial Waterfall */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>

          {/* Top 5 Models */}
          <View style={{ flex: 1 }}>
            <View style={[S.sectionHeader, { marginBottom: 5 }]}>
              <Text style={S.sectionTitle}>TOP MODELS BY EARNINGS</Text>
              <View style={S.sectionLine} />
            </View>
            <View style={{ borderWidth: 0.75, borderColor: C.divider, borderRadius: 3, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", backgroundColor: theme.minimal ? "transparent" : "#1E293B", padding: "4 6", borderBottomWidth: theme.minimal ? 1.5 : 0, borderBottomColor: theme.minimal ? C.textPrimary : "transparent" }}>
                <Text style={{ flex: 2, fontSize: 7, color: theme.minimal ? C.textMuted : "#FFFFFF", fontFamily: _fB, letterSpacing: theme.minimal ? 0.5 : 0 }}>Model</Text>
                <Text style={{ width: "15%", fontSize: 7, color: theme.minimal ? C.textMuted : "#FFFFFF", fontFamily: _fB, textAlign: "right" }}>Qty</Text>
                <Text style={{ width: "35%", fontSize: 7, color: theme.minimal ? C.textMuted : "#FFFFFF", fontFamily: _fB, textAlign: "right" }}>Earned</Text>
              </View>
              {[...report.rows]
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
                .map((r, i) => (
                  <View key={r.modelId} style={{ flexDirection: "row", padding: "4 6", borderTopWidth: 0.5, borderColor: C.divider, backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                    <Text style={{ flex: 2, fontSize: 7.5 }}>{r.modelName}</Text>
                    <Text style={{ width: "15%", fontSize: 7.5, textAlign: "right", color: C.textMuted }}>{r.qtyActivated}</Text>
                    <Text style={{ width: "35%", fontSize: 7.5, fontFamily: _fB, color: C.accentBar, textAlign: "right" }}>{fmtPKR(r.total)}</Text>
                  </View>
                ))}
            </View>
          </View>

          {/* Financial Waterfall */}
          <View style={{ flex: 1 }}>
            <View style={[S.sectionHeader, { marginBottom: 5 }]}>
              <Text style={S.sectionTitle}>FINANCIAL WATERFALL</Text>
              <View style={S.sectionLine} />
            </View>
            <View style={{ borderWidth: 0.75, borderColor: C.divider, borderRadius: 3, overflow: "hidden" }}>
              {[
                { label: "Gross Incentives",    val: report.totals.grandTotal,       sign: "",  color: C.accentBar },
                ...(rebateTotal > 0 ? [{ label: "Price-Drop Rebates", val: rebateTotal, sign: "+", color: "#0E7490" }] : []),
                ...((crCaughtLoss?.totalFines ?? 0) > 0 ? [{ label: "CR Fines (Deducted)", val: crCaughtLoss!.totalFines, sign: "−", color: C.red }] : []),
              ].map((e, i) => (
                <View key={e.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "5 8", borderBottomWidth: 0.5, borderColor: C.divider, backgroundColor: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                  <Text style={{ fontSize: 7.5, color: C.textMuted }}>{e.sign ? `${e.sign}  ` : "   "}{e.label}</Text>
                  <Text style={{ fontSize: 7.5, fontFamily: _fB, color: e.color }}>{e.sign === "−" ? `−${fmtPKR(e.val)}` : fmtPKR(e.val)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "7 8", backgroundColor: theme.minimal ? "transparent" : C.grandBg, borderTopWidth: theme.minimal ? 1.5 : 0, borderTopColor: theme.minimal ? C.textPrimary : "transparent" }}>
                <Text style={{ fontSize: 8, fontFamily: _fB, color: theme.minimal ? C.textMuted : C.grandAccent }}>= NET RECEIVABLE</Text>
                <Text style={{ fontSize: 9, fontFamily: _fB, color: theme.minimal ? C.textPrimary : "#FFFFFF" }}>{fmtPKR(net)}</Text>
              </View>
            </View>
          </View>
        </View>

        <Footer page={tp} total={tp} />
      </Page>
    </Document>
  );
  return await renderToBuffer(doc);
}

// ─── Brief / Dealer Statement PDF ────────────────────────────────────────────
export async function buildBriefPDF(
  report: IncentiveReport,
  dealerName: string,
  opts?: {
    policies?: PolicyAchievementEntry[];
    rebateRows?: RebateRow[];
    rebateTotal?: number;
    crCaughtLoss?: { totalUnits: number; potentialLoss: number; totalFines: number };
  },
  theme: PdfTheme = NAVAL
): Promise<Buffer> {
  ensureInterFont(); C = buildC(theme); S = makeS(theme);
  const { policies = [], rebateRows = [], rebateTotal = 0, crCaughtLoss } = opts ?? {};
  // Dealer Incentive = one policy (total-activation based) + engine's per-model split.
  const diBreakdown = buildDealerIncentiveBreakdown(report);
  const diPolicy = policies.find((p) => p.type === "dealer-incentive" && !isZeroDealerIncentivePolicy(p));
  const tb = report.targetBonus;
  const net = report.totals.grandTotal + rebateTotal - (crCaughtLoss?.totalFines ?? 0);
  const totalStocked = report.rows.reduce((s, r) => s + r.stockInRegularQty, 0);

  const BS = StyleSheet.create({
    page: { paddingHorizontal: 36, paddingTop: 0, paddingBottom: 24, fontSize: 9, fontFamily: _fR, color: C.textPrimary, backgroundColor: "#FFFFFF" },

    // Net receivable hero — Naval: dark banner; Arctic: ruled section
    netBox: { marginTop: 14, marginBottom: 14, padding: theme.minimal ? "14 0" : "14 0 14 18", borderRadius: theme.minimal ? 0 : 6, backgroundColor: theme.minimal ? "transparent" : C.grandBg, borderTopWidth: theme.minimal ? 2 : 0, borderTopColor: theme.minimal ? C.textPrimary : "transparent", borderBottomWidth: theme.minimal ? 1 : 0, borderBottomColor: theme.minimal ? C.divider : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    netLabel: { fontSize: 8, color: theme.minimal ? C.textMuted : C.grandAccent, fontFamily: theme.minimal ? _fR : _fB, letterSpacing: 0.5, marginBottom: 6 },
    netAmount: { fontSize: 26, fontFamily: _fB, color: theme.minimal ? C.textPrimary : "#FFFFFF" },
    netSub: { fontSize: 7.5, color: theme.minimal ? C.textMuted : C.grandAccent, marginTop: 4 },
    netRight: { width: 170, flexShrink: 0, gap: 3 },
    netRightLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    netRightLabel: { fontSize: 7.5, color: theme.minimal ? C.textMuted : C.grandAccent },
    netRightValue: { fontSize: 7.5, color: theme.minimal ? C.textPrimary : "#FFFFFF", fontFamily: _fB, textAlign: "right" },

    // Statement rows — both row types are identical except background so columns never shift
    stmtSection: { marginBottom: 14 },
    stmtTitle: { fontSize: 7, fontFamily: _fB, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 },
    stmtDivider: { borderBottomWidth: 0.25, borderColor: C.divider, marginBottom: 5 },
    stmtRow:    { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 0.25, borderColor: C.divider },
    stmtRowAlt: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 0.25, borderColor: C.divider },
    stmtInfo: { width: "70%", paddingRight: 10 },
    stmtLabel: { fontSize: 8.5, color: C.textPrimary },
    stmtSub: { fontSize: 7, color: C.textMuted, marginTop: 2 },
    stmtValue:      { width: "30%", fontSize: 8.5, fontFamily: _fB, textAlign: "right" },
    stmtValueMuted: { width: "30%", fontSize: 8.5, color: C.textMuted, textAlign: "right" },
    stmtValueGreen: { width: "30%", fontSize: 8.5, fontFamily: _fB, color: C.green, textAlign: "right" },
    stmtValueRed:   { width: "30%", fontSize: 8.5, fontFamily: _fB, color: C.red, textAlign: "right" },
    stmtValueCyan:  { width: "30%", fontSize: 8.5, fontFamily: _fB, color: "#0E7490", textAlign: "right" },
    stmtTotal:      { flexDirection: "row", alignItems: "center", paddingVertical: theme.minimal ? 7 : 5, paddingHorizontal: 0, marginTop: theme.minimal ? 6 : 0, backgroundColor: theme.minimal ? "transparent" : C.tTotalBg, borderRadius: theme.minimal ? 0 : 3 },
    stmtTotalLabel: { width: "70%", fontSize: 9, fontFamily: _fB, color: theme.minimal ? C.textPrimary : C.tTotalFg, paddingLeft: theme.minimal ? 0 : 5 },
    stmtTotalValue: { width: "30%", fontSize: 9, fontFamily: _fB, color: theme.minimal ? C.textPrimary : C.tTotalFg, textAlign: "right", paddingRight: 0 },

    // Policy checklist
    policyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 3, borderBottomWidth: 0.25, borderColor: C.divider },
    policyBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, fontSize: 7, fontFamily: _fB, marginTop: 1 },
    policyInfo: { flex: 1 },
    policyLabel: { fontSize: 8.5, fontFamily: _fB },
    policySub: { fontSize: 7, color: C.textMuted, marginTop: 1 },
    policyEarned: { fontSize: 9, fontFamily: _fB, textAlign: "right", flexShrink: 0, paddingLeft: 8 },

    // Dealer-incentive model-wise split (nested under the single DI policy row)
    diSubRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2, paddingLeft: 26 },
    diSubLabel: { fontSize: 7.5, color: C.textPrimary, flexShrink: 0 },
    diSubMeta: { fontSize: 7, color: C.textMuted, flex: 1, paddingLeft: 8 },
    diSubAmt: { fontSize: 7.5, fontFamily: _fB, color: C.textPrimary, textAlign: "right", flexShrink: 0, paddingLeft: 8 },

    // KPI strip
    kpiRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
    kpiBox: { flex: 1, borderWidth: 0.5, borderColor: C.kpiBorder, borderRadius: 4, backgroundColor: theme.minimal ? "transparent" : C.kpiBg, padding: "6 8" },
    kpiLabel: { fontSize: 6.5, color: C.kpiLabel, fontFamily: _fB, letterSpacing: 0.4, marginBottom: 3 },
    kpiValue: { fontSize: 10, fontFamily: _fB, color: C.kpiValue },
    kpiSub: { fontSize: 6.5, color: C.textMuted, marginTop: 1.5 },
  });

  const earned = [
    { label: `Base ${report.baseIncentivePercent}% Incentive`, val: report.totals.basePercentEarned, sub: `${report.totalActivations} activations × dealer price × ${report.baseIncentivePercent}%` },
    { label: `Target Bonus ${tb.bonusPercent}%`, val: report.totals.bonusPercentEarned, sub: tb.eligible ? `Target met — ${tb.actualQty}/${tb.targetQty ?? "—"} purchased ✓` : `Not reached — ${tb.actualQty}${tb.targetQty ? `/${tb.targetQty}` : ""} purchased`, notMet: !tb.eligible && report.totals.bonusPercentEarned === 0 },
    { label: "Activation Incentive", val: report.totals.activationIncentiveEarned, sub: `Per-unit bonus on qualifying activations` },
    { label: "Dealer Incentive", val: report.totals.dealerIncentiveEarned, sub: `Volume-based incentive` },
    { label: "Stock-In Earned", val: report.totals.stockInEarned, sub: `${totalStocked} unit${totalStocked !== 1 ? "s" : ""} stocked × policy rate` },
  ].filter((e) => e.val > 0 || e.notMet);

  const doc = (
    <Document>
      <Page size="A4" style={BS.page}>
        {/* Header */}
        <View style={[S.headerBg, { marginHorizontal: -36 }]}>
          <Text style={S.headerBrand}>OPPO PAKISTAN</Text>
          <View style={S.headerRow}>
            <View>
              <Text style={S.headerTitle}>Dealer Statement</Text>
              <Text style={S.headerMeta}>{dealerName}  ·  {report.periodStart}  →  {report.periodEnd}</Text>
            </View>
            <View style={S.headerRight}>
              <Text style={S.headerDate}>Generated: {today()}</Text>
              <Text style={[S.headerDate, { marginTop: 2 }]}>CONFIDENTIAL</Text>
            </View>
          </View>
        </View>
        <View style={[S.accentBar, { marginHorizontal: -36 }]} />

        {/* KPI strip */}
        <View style={BS.kpiRow}>
          <View style={BS.kpiBox}>
            <Text style={BS.kpiLabel}>TOTAL ACTIVATIONS</Text>
            <Text style={BS.kpiValue}>{report.totalActivations}</Text>
            {report.totalActivationsCrossRegion > 0 && <Text style={BS.kpiSub}>{report.totalActivationsCrossRegion} cross-region</Text>}
          </View>
          <View style={BS.kpiBox}>
            <Text style={BS.kpiLabel}>UNITS STOCKED</Text>
            <Text style={BS.kpiValue}>{totalStocked}</Text>
            {report.totalCrossRegionPurchaseQty > 0 && <Text style={BS.kpiSub}>{report.totalCrossRegionPurchaseQty} CR transfers</Text>}
          </View>
          <View style={BS.kpiBox}>
            <Text style={BS.kpiLabel}>MODELS ACTIVE</Text>
            <Text style={BS.kpiValue}>{report.rows.filter(r => r.total > 0).length}</Text>
            <Text style={BS.kpiSub}>{report.rows.length} total models</Text>
          </View>
          <View style={BS.kpiBox}>
            <Text style={BS.kpiLabel}>POLICIES</Text>
            <Text style={[BS.kpiValue, { color: C.green }]}>{policies.filter(p => p.eligible).length} met</Text>
            {policies.filter(p => !p.eligible).length > 0 && <Text style={BS.kpiSub}>{policies.filter(p => !p.eligible).length} not met</Text>}
          </View>
        </View>

        {/* Net Receivable hero box */}
        <View style={BS.netBox}>
          <View style={{ flex: 1 }}>
            <Text style={BS.netLabel}>TOTAL NET RECEIVABLE FROM OPPO</Text>
            <Text style={BS.netAmount}>{fmtPKR(net)}</Text>
            <Text style={BS.netSub}>
              {rebateTotal > 0 && crCaughtLoss?.totalFines
                ? `Incentives ${fmtPKR(report.totals.grandTotal)}  +  Rebates ${fmtPKR(rebateTotal)}  −  Fines ${fmtPKR(crCaughtLoss.totalFines)}`
                : rebateTotal > 0
                ? `Incentives ${fmtPKR(report.totals.grandTotal)}  +  Rebates ${fmtPKR(rebateTotal)}`
                : (crCaughtLoss?.totalFines ?? 0) > 0
                ? `Incentives ${fmtPKR(report.totals.grandTotal)}  −  Fines ${fmtPKR(crCaughtLoss!.totalFines)}`
                : "Total incentives earned this period"}
            </Text>
          </View>
          <View style={BS.netRight}>
            {[
              { l: `Base ${report.baseIncentivePercent}%`, v: report.totals.basePercentEarned },
              { l: `Bonus ${tb.bonusPercent}%`, v: report.totals.bonusPercentEarned },
              { l: "Act. Inc.", v: report.totals.activationIncentiveEarned },
              { l: "Dlr. Inc.", v: report.totals.dealerIncentiveEarned },
              { l: "Stock-In", v: report.totals.stockInEarned },
              ...(rebateTotal > 0 ? [{ l: "+ Rebates", v: rebateTotal }] : []),
            ].filter(e => e.v > 0).map(e => (
              <View key={e.l} style={BS.netRightLine}>
                <Text style={BS.netRightLabel}>{e.l}</Text>
                <Text style={BS.netRightValue}>{fmtPKR(e.v)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Earnings statement */}
        <View style={BS.stmtSection}>
          <Text style={BS.stmtTitle}>Earnings Breakdown</Text>
          <View style={BS.stmtDivider} />
          {earned.map((e, i) => (
            <View key={e.label} style={BS.stmtRow}>
              <View style={BS.stmtInfo}>
                <Text style={[BS.stmtLabel, e.notMet ? { color: C.textMuted } : {}]}>{e.label}</Text>
                {e.sub ? <Text style={BS.stmtSub}>{e.sub}</Text> : null}
              </View>
              <Text style={e.notMet ? BS.stmtValueMuted : BS.stmtValue}>{e.notMet ? "Not Earned" : fmtPKR(e.val)}</Text>
            </View>
          ))}
          <View style={BS.stmtTotal}>
            <Text style={BS.stmtTotalLabel}>Gross Incentives (OPPO Owes)</Text>
            <Text style={BS.stmtTotalValue}>{fmtPKR(report.totals.grandTotal)}</Text>
          </View>

          {/* Rebates */}
          {rebateTotal > 0 && (
            <View style={[BS.stmtRow, { marginTop: 6 }]}>
              <View style={BS.stmtInfo}>
                <Text style={[BS.stmtLabel, { color: "#0E7490", fontFamily: _fB }]}>+ Price-Drop Rebates (OPPO Owes)</Text>
                <Text style={BS.stmtSub}>{rebateRows.length} price-drop event{rebateRows.length !== 1 ? "s" : ""} — stock held at time of drop</Text>
              </View>
              <Text style={BS.stmtValueCyan}>{fmtPKR(rebateTotal)}</Text>
            </View>
          )}

          {/* CR Fines */}
          {(crCaughtLoss?.totalFines ?? 0) > 0 && (
            <View style={BS.stmtRow}>
              <View style={BS.stmtInfo}>
                <Text style={[BS.stmtLabel, { color: C.red, fontFamily: _fB }]}>− CR Caught Cash Fines (Deducted)</Text>
                <Text style={BS.stmtSub}>{crCaughtLoss!.totalUnits} unit{crCaughtLoss!.totalUnits !== 1 ? "s" : ""} caught cross-region</Text>
              </View>
              <Text style={BS.stmtValueRed}>−{fmtPKR(crCaughtLoss!.totalFines)}</Text>
            </View>
          )}

          <View style={[BS.stmtTotal, theme.minimal
            ? { borderTopWidth: 2, borderTopColor: C.textPrimary, padding: "8 0" }
            : { backgroundColor: C.grandBg, padding: "8 0 8 10" }]}>
            <Text style={[BS.stmtTotalLabel, { color: theme.minimal ? C.textPrimary : "#FFFFFF", fontSize: 10 }]}>NET RECEIVABLE FROM OPPO</Text>
            <Text style={[BS.stmtTotalValue, { color: theme.minimal ? C.textPrimary : "#FFFFFF", fontSize: 11 }]}>{fmtPKR(net)}</Text>
          </View>
        </View>

        {/* Policy checklist */}
        {policies.length > 0 && (
          <View style={BS.stmtSection}>
            <Text style={[BS.stmtTitle, { marginTop: 6 }]}>Policy Status</Text>
            <View style={BS.stmtDivider} />
            {policies
              .filter(p => p.type !== "dealer-incentive")
              .filter(p => p.actualQty > 0)
              .map((p, i) => (
              <View key={i} style={BS.policyRow}>
                <View style={[BS.policyBadge, p.eligible ? S.badgeMet : S.badgeNotMet]}>
                  <Text>{p.eligible ? "Met ✓" : "✗"}</Text>
                </View>
                <View style={BS.policyInfo}>
                  <Text style={BS.policyLabel}>
                    {POLICY_LABEL[p.type]}{p.modelName ? ` — ${p.modelName}` : ""}
                  </Text>
                  <Text style={BS.policySub}>
                    {p.periodStart} → {p.periodEnd}
                    {p.targetQty != null ? `  ·  ${p.actualQty} / ${p.targetQty} ${p.eligible ? "✓" : `(need ${p.targetQty - p.actualQty} more)`}` : ""}
                    {p.type !== "target-bonus" ? `  ·  ${fmtPKR(p.perUnitAmount)}/unit` : `  ·  ${p.perUnitAmount}% rate`}
                  </Text>
                </View>
                <Text style={[BS.policyEarned, { color: p.eligible ? C.green : C.textMuted }]}>
                  {p.eligible ? fmtPKR(p.earned) : "—"}
                </Text>
              </View>
            ))}

            {/* Dealer Incentive — single policy (total-activation based) + model-wise split */}
            {diBreakdown && diPolicy && (
              <View>
                <View style={BS.policyRow}>
                  <View style={[BS.policyBadge, diBreakdown.eligible ? S.badgeMet : S.badgeNotMet]}>
                    <Text>{diBreakdown.eligible ? "Met ✓" : "✗"}</Text>
                  </View>
                  <View style={BS.policyInfo}>
                    <Text style={BS.policyLabel}>{POLICY_LABEL["dealer-incentive"]}</Text>
                    <Text style={BS.policySub}>
                      {diPolicy.periodStart} → {diPolicy.periodEnd}
                      {`  ·  ${diBreakdown.actualTotal} / ${diBreakdown.targetTotal} activations ${diBreakdown.eligible ? "✓" : `(need ${Math.max(0, diBreakdown.targetTotal - diBreakdown.actualTotal)} more)`}`}
                      {diBreakdown.perUnit != null ? `  ·  ${fmtPKR(diBreakdown.perUnit)}/unit` : ""}
                    </Text>
                  </View>
                  <Text style={[BS.policyEarned, { color: diBreakdown.eligible ? C.green : C.textMuted }]}>
                    {diBreakdown.eligible ? fmtPKR(diBreakdown.totalEarned) : "—"}
                  </Text>
                </View>
                {diBreakdown.eligible && diBreakdown.models.map((m) => (
                  <View key={m.modelId} style={BS.diSubRow}>
                    <Text style={BS.diSubLabel}>{m.modelName}</Text>
                    <Text style={BS.diSubMeta}>{m.qty} act{m.qty !== 1 ? "s" : ""}{m.perUnit ? ` × ${fmtPKR(m.perUnit)}` : ""}</Text>
                    <Text style={BS.diSubAmt}>{fmtPKR(m.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Closing net total — always visible at end of report regardless of page count */}
        <View style={[BS.stmtTotal, { marginTop: 14 }, theme.minimal
          ? { borderTopWidth: 1.5, borderTopColor: C.textPrimary, padding: "10 0", backgroundColor: "transparent" }
          : { backgroundColor: C.grandBg, padding: "8 10" }]}>
          <Text style={[BS.stmtTotalLabel, { color: theme.minimal ? C.textPrimary : "#FFFFFF", fontSize: 9 }]}>NET RECEIVABLE FROM OPPO</Text>
          <Text style={[BS.stmtTotalValue, { color: theme.minimal ? C.textPrimary : "#FFFFFF", fontSize: 10 }]}>{fmtPKR(net)}</Text>
        </View>

        <View style={S.footerBar}>
          <Text style={S.footerText}>OPPO Pakistan · Dealer Statement · Confidential</Text>
          <Text style={S.footerText}>Generated {today()}</Text>
        </View>
      </Page>
    </Document>
  );
  return await renderToBuffer(doc);
}
