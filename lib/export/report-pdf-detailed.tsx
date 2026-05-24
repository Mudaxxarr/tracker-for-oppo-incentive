import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { IncentiveReport, IncentiveReportRow } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  headerBg:    "#0B1629",
  headerFg:    "#FFFFFF",
  headerSub:   "#93C5FD",
  accentBar:   "#2563EB",
  accentLight: "#EFF6FF",
  accentBorder:"#BFDBFE",

  modelHeaderBg: "#1E293B",
  modelHeaderFg: "#FFFFFF",
  modelHeaderAccent: "#7DD3FC",

  sectionBg:   "#F8FAFC",
  sectionBorder:"#E2E8F0",

  subHeadBg:   "#F1F5F9",
  subRowBorder:"#E2E8F0",

  green:       "#15803D",
  greenBg:     "#F0FDF4",
  greenBorder: "#BBF7D0",
  red:         "#B91C1C",
  redBg:       "#FFF1F2",
  redBorder:   "#FECDD3",
  amber:       "#B45309",
  amberBg:     "#FFFBEB",

  textPrimary: "#0F172A",
  textMuted:   "#64748B",
  textLight:   "#94A3B8",
  divider:     "#E2E8F0",

  grandBg:     "#0B1629",
  grandFg:     "#FFFFFF",
  grandAccent: "#93C5FD",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    paddingHorizontal: 26,
    paddingTop: 0,
    paddingBottom: 18,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: C.textPrimary,
    backgroundColor: "#FFFFFF",
  },

  // Header
  headerBg: {
    backgroundColor: C.headerBg,
    marginHorizontal: -26,
    paddingHorizontal: 26,
    paddingTop: 14,
    paddingBottom: 10,
  },
  accentBar: {
    height: 3,
    backgroundColor: C.accentBar,
    marginHorizontal: -26,
    marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerBrand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.headerSub, letterSpacing: 2, marginBottom: 3 },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.headerFg, letterSpacing: 0.3 },
  headerMeta: { fontSize: 8, color: C.headerSub, marginTop: 3 },
  headerDate: { fontSize: 7.5, color: C.textLight, fontFamily: "Helvetica-Oblique" },

  // KPI summary bar
  summaryBar: {
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: C.accentLight,
    borderWidth: 0.75,
    borderColor: C.accentBorder,
    borderRadius: 5,
    padding: 8,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 6.5, color: C.textMuted, fontFamily: "Helvetica-Bold", letterSpacing: 0.3, marginBottom: 2 },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.accentBar },
  summaryGrandItem: { flex: 1.5, alignItems: "center", borderLeftWidth: 0.75, borderColor: C.accentBorder, paddingLeft: 8 },
  summaryGrandLabel: { fontSize: 6.5, color: C.textMuted, fontFamily: "Helvetica-Bold", letterSpacing: 0.3, marginBottom: 2 },
  summaryGrandValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.headerBg },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 8, fontFamily: "Helvetica-Bold", color: C.textMuted,
    letterSpacing: 0.8,
  },
  sectionLine: { flex: 1, borderBottomWidth: 0.75, borderColor: C.divider },

  // Model block
  modelBlock: {
    marginBottom: 12,
    borderWidth: 0.75,
    borderColor: C.sectionBorder,
    borderRadius: 4,
    overflow: "hidden",
  },
  modelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.modelHeaderBg,
  },
  modelLeft: { flex: 1 },
  modelName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.modelHeaderFg },
  modelMeta: { fontSize: 7.5, color: "#94A3B8", marginTop: 2 },
  modelTotal: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.modelHeaderAccent },
  modelTotalLabel: { fontSize: 6.5, color: "#94A3B8", textAlign: "right", marginBottom: 1 },

  // Section within model block
  section: { paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 0.5, borderColor: C.sectionBorder },
  secLabel: {
    fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.textMuted,
    letterSpacing: 0.5, marginBottom: 5,
  },

  // Sub-table
  subHead: { flexDirection: "row", backgroundColor: C.subHeadBg, borderBottomWidth: 0.5, borderColor: C.subRowBorder },
  subRow:  { flexDirection: "row", borderBottomWidth: 0.3, borderColor: C.subRowBorder },
  subRowAlt: { flexDirection: "row", borderBottomWidth: 0.3, borderColor: C.subRowBorder, backgroundColor: "#FAFAFA" },
  subCell: { padding: "3 5", fontSize: 7.5 },
  subCellBold: { padding: "3 5", fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  // Calc line
  calcLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderColor: C.sectionBorder,
  },
  calcText:  { fontSize: 8, color: C.textMuted },
  calcValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.accentBar },
  calcEq:    { fontSize: 7.5, color: C.textMuted },

  // Badge
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 7, fontFamily: "Helvetica-Bold" },
  badgeMet:    { backgroundColor: C.greenBg, color: C.green },
  badgeNotMet: { backgroundColor: C.redBg, color: C.red },

  // Grand footer
  grandFooter: {
    marginTop: 14,
    padding: "12 16",
    borderRadius: 5,
    backgroundColor: C.grandBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grandLeft: {},
  grandTag: { fontSize: 8, color: C.grandAccent, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 5 },
  grandAmt: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.grandFg },
  grandBreakdown: { alignItems: "flex-end", gap: 2 },
  grandBreakRow: { flexDirection: "row", gap: 8 },
  grandBreakLabel: { fontSize: 7, color: C.grandAccent },
  grandBreakValue: { fontSize: 7, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },

  // Note
  note: {
    marginTop: 8,
    padding: "5 8",
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: C.sectionBorder,
    backgroundColor: "#FAFAFA",
  },
  noteText: { fontSize: 7, color: C.textMuted },

  // Footer
  footerBar: {
    marginTop: 14,
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderColor: C.divider,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 6.5, color: C.textLight },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

const today = () => new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

// ─── Shared header ────────────────────────────────────────────────────────────
function DocHeader({ dealerName, periodStart, periodEnd }: { dealerName: string; periodStart: string; periodEnd: string }) {
  return (
    <>
      <View style={S.headerBg}>
        <Text style={S.headerBrand}>OPPO PAKISTAN</Text>
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Detailed Incentive Breakup</Text>
            <Text style={S.headerMeta}>{dealerName}  ·  Period: {periodStart}  →  {periodEnd}</Text>
          </View>
          <View>
            <Text style={[S.headerDate, { textAlign: "right" }]}>Generated: {today()}</Text>
            <Text style={[S.headerDate, { textAlign: "right", marginTop: 2 }]}>CONFIDENTIAL</Text>
          </View>
        </View>
      </View>
      <View style={S.accentBar} />
    </>
  );
}

// ─── Per-model section ────────────────────────────────────────────────────────
function ModelSection({
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
  const actPolicy  = policies.find((p) => p.type === "activation-incentive" && p.modelName === row.modelName);
  const stockPolicy = policies.find((p) => p.type === "stock-in"             && p.modelName === row.modelName);
  const dlrPolicy  = policies.find((p) => p.type === "dealer-incentive");

  return (
    <View style={S.modelBlock}>
      {/* Model header bar */}
      <View style={S.modelHeader}>
        <View style={S.modelLeft}>
          <Text style={S.modelName}>{row.modelName}</Text>
          <Text style={S.modelMeta}>
            {row.qtyActivated} activation{row.qtyActivated !== 1 ? "s" : ""}
            {row.qtyActivatedCrossRegion > 0 ? `  ·  ${row.qtyActivatedCrossRegion} cross-region` : ""}
            {row.stockInRegularQty > 0 ? `  ·  ${row.stockInRegularQty} purchased` : ""}
          </Text>
        </View>
        <View>
          <Text style={S.modelTotalLabel}>TOTAL EARNED</Text>
          <Text style={S.modelTotal}>{fmtPKR(row.total)}</Text>
        </View>
      </View>

      {/* ── Base % + Bonus % breakdown ── */}
      {row.priceSubperiods.length > 0 && (
        <View style={S.section}>
          <Text style={S.secLabel}>Base {basePercent}%  +  Bonus {bonusPercent}%  Breakdown</Text>
          <View style={S.subHead}>
            <Text style={[S.subCell, { width: "18%" }]}>Qty</Text>
            <Text style={[S.subCell, { width: "28%" }]}>Dealer Price</Text>
            <Text style={[S.subCell, { width: "27%", textAlign: "right" }]}>Base {basePercent}%</Text>
            <Text style={[S.subCell, { width: "27%", textAlign: "right" }]}>Bonus {bonusPercent}%</Text>
          </View>
          {row.priceSubperiods.map((s, i) => (
            <View key={i} style={i % 2 === 1 ? S.subRowAlt : S.subRow}>
              <Text style={[S.subCell, { width: "18%" }]}>{s.qty} units</Text>
              <Text style={[S.subCell, { width: "28%" }]}>{fmtPKR(s.dealerPrice)}</Text>
              <Text style={[S.subCell, { width: "27%", textAlign: "right" }]}>{fmtPKR(s.basePercentSubtotal)}</Text>
              <Text style={[S.subCell, { width: "27%", textAlign: "right" }]}>{fmtPKR(s.bonusPercentSubtotal)}</Text>
            </View>
          ))}
          {row.priceSubperiods.length > 1 && (
            <View style={[S.subRow, { backgroundColor: C.subHeadBg }]}>
              <Text style={[S.subCellBold, { width: "18%" }]}>Subtotal</Text>
              <Text style={[S.subCell, { width: "28%" }]}></Text>
              <Text style={[S.subCellBold, { width: "27%", textAlign: "right" }]}>{fmtPKR(row.basePercentEarned)}</Text>
              <Text style={[S.subCellBold, { width: "27%", textAlign: "right" }]}>{fmtPKR(row.bonusPercentEarned)}</Text>
            </View>
          )}
          <View style={S.calcLine}>
            <Text style={S.calcText}>Combined base + bonus: </Text>
            <Text style={S.calcValue}>{fmtPKR(row.basePercentEarned + row.bonusPercentEarned)}</Text>
            <Text style={[S.calcEq, { marginLeft: 6 }]}>
              ({basePercent}% base + {bonusPercent}% bonus on {fmtPKR(row.priceSubperiods[0]?.dealerPrice ?? 0)} dealer price)
            </Text>
          </View>
        </View>
      )}

      {/* ── Activation Incentive ── */}
      {(row.activationIncentiveEarned > 0 || actPolicy) && (
        <View style={S.section}>
          <Text style={S.secLabel}>Activation Incentive</Text>
          {actPolicy ? (
            <>
              <View style={S.subHead}>
                <Text style={[S.subCell, { width: "25%" }]}>Activated Qty</Text>
                <Text style={[S.subCell, { width: "25%" }]}>Minimum Target</Text>
                <Text style={[S.subCell, { width: "25%" }]}>Rate per Unit</Text>
                <Text style={[S.subCell, { width: "25%", textAlign: "right" }]}>Earned</Text>
              </View>
              <View style={S.subRow}>
                <Text style={[S.subCell, { width: "25%" }]}>{actPolicy.actualQty} units</Text>
                <Text style={[S.subCell, { width: "25%" }]}>{actPolicy.targetQty != null ? `≥ ${actPolicy.targetQty}` : "No minimum"}</Text>
                <Text style={[S.subCell, { width: "25%" }]}>{fmtPKR(actPolicy.perUnitAmount)}</Text>
                <Text style={[S.subCellBold, { width: "25%", textAlign: "right" }]}>{fmtPKR(actPolicy.earned)}</Text>
              </View>
              <View style={S.calcLine}>
                <Text style={S.calcEq}>{actPolicy.actualQty} units × {fmtPKR(actPolicy.perUnitAmount)}  =</Text>
                <Text style={S.calcValue}>{fmtPKR(actPolicy.earned)}</Text>
                <View style={[S.badge, actPolicy.eligible ? S.badgeMet : S.badgeNotMet]}>
                  <Text>{actPolicy.eligible ? "Met ✓" : "Not Met ✗"}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={S.calcLine}>
              <Text style={S.calcText}>Earned: </Text>
              <Text style={S.calcValue}>{fmtPKR(row.activationIncentiveEarned)}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Stock-In ── */}
      {(row.stockInEarned > 0 || stockPolicy) && (
        <View style={S.section}>
          <Text style={S.secLabel}>Stock-In Incentive</Text>
          <View style={S.subHead}>
            <Text style={[S.subCell, { width: "22%" }]}>Regular Purchased</Text>
            <Text style={[S.subCell, { width: "22%" }]}>Cross-Region In</Text>
            <Text style={[S.subCell, { width: "22%" }]}>Inter-ID Out</Text>
            <Text style={[S.subCell, { width: "22%" }]}>Effective Qty</Text>
            <Text style={[S.subCell, { width: "12%", textAlign: "right" }]}>Earned</Text>
          </View>
          <View style={S.subRow}>
            <Text style={[S.subCell, { width: "22%" }]}>{row.stockInRegularQty}</Text>
            <Text style={[S.subCell, { width: "22%" }]}>{row.stockInCrossRegionQty}</Text>
            <Text style={[S.subCell, { width: "22%", color: row.interIdOutQty > 0 ? C.red : C.textMuted }]}>
              {row.interIdOutQty > 0 ? `−${row.interIdOutQty}` : "0"}
            </Text>
            <Text style={[S.subCellBold, { width: "22%" }]}>{row.effectiveStockInQty}</Text>
            <Text style={[S.subCellBold, { width: "12%", textAlign: "right", color: C.accentBar }]}>{fmtPKR(row.stockInEarned)}</Text>
          </View>
          {stockPolicy && (
            <View style={S.calcLine}>
              <Text style={S.calcEq}>
                {row.effectiveStockInQty} units × {fmtPKR(stockPolicy.perUnitAmount)}
                {stockPolicy.targetQty != null ? `  (min: ${stockPolicy.targetQty})` : ""}  =
              </Text>
              <Text style={S.calcValue}>{fmtPKR(row.stockInEarned)}</Text>
              <View style={[S.badge, stockPolicy.eligible ? S.badgeMet : S.badgeNotMet]}>
                <Text>{stockPolicy.eligible ? "Met ✓" : "Not Met ✗"}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Dealer Incentive ── */}
      {row.dealerIncentiveEarned > 0 && (
        <View style={S.section}>
          <Text style={S.secLabel}>Dealer Incentive  —  Global Activation Target</Text>
          {dlrPolicy && (
            <View style={S.subRow}>
              <Text style={[S.subCell, { width: "40%" }]}>
                Target: {dlrPolicy.targetQty ?? "—"} total activations  ·  Actual: {dlrPolicy.actualQty}
              </Text>
              <Text style={[S.subCell, { width: "30%" }]}>Rate: {fmtPKR(dlrPolicy.perUnitAmount)} / unit</Text>
              <Text style={[S.subCellBold, { width: "30%", textAlign: "right", color: C.accentBar }]}>{fmtPKR(row.dealerIncentiveEarned)}</Text>
            </View>
          )}
          {!dlrPolicy && (
            <View style={S.calcLine}>
              <Text style={S.calcText}>Allocated: </Text>
              <Text style={S.calcValue}>{fmtPKR(row.dealerIncentiveEarned)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function buildDetailedPDF(
  report: IncentiveReport,
  dealerName: string,
  policies: PolicyAchievementEntry[]
): Promise<Buffer> {
  const rows = report.rows.filter((r) => r.total > 0 || r.qtyActivated > 0);
  const bonusPercent = report.targetBonus.bonusPercent ?? 1;
  const tb = report.targetBonus;

  const nonZeroBreakdown = [
    { label: `Base ${report.baseIncentivePercent}%`, val: report.totals.basePercentEarned },
    { label: `Bonus ${bonusPercent}%`,                val: report.totals.bonusPercentEarned },
    { label: "Activation Inc.",                       val: report.totals.activationIncentiveEarned },
    { label: "Dealer Inc.",                           val: report.totals.dealerIncentiveEarned },
    { label: "Stock-In",                              val: report.totals.stockInEarned },
  ].filter((e) => e.val > 0);

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

        {/* Summary bar */}
        <View style={S.summaryBar}>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>TOTAL ACTIVATIONS</Text>
            <Text style={S.summaryValue}>{report.totalActivations}</Text>
          </View>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>BASE {report.baseIncentivePercent}%</Text>
            <Text style={S.summaryValue}>{fmtPKR(report.totals.basePercentEarned)}</Text>
          </View>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>TARGET BONUS {bonusPercent}%</Text>
            <Text style={[S.summaryValue, { color: tb.eligible ? C.green : C.textMuted }]}>
              {report.totals.bonusPercentEarned > 0 ? fmtPKR(report.totals.bonusPercentEarned) : "—"}
            </Text>
          </View>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>ACTIVATION INC.</Text>
            <Text style={S.summaryValue}>
              {report.totals.activationIncentiveEarned > 0 ? fmtPKR(report.totals.activationIncentiveEarned) : "—"}
            </Text>
          </View>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>DEALER INC.</Text>
            <Text style={S.summaryValue}>
              {report.totals.dealerIncentiveEarned > 0 ? fmtPKR(report.totals.dealerIncentiveEarned) : "—"}
            </Text>
          </View>
          <View style={S.summaryItem}>
            <Text style={S.summaryLabel}>STOCK-IN</Text>
            <Text style={S.summaryValue}>
              {report.totals.stockInEarned > 0 ? fmtPKR(report.totals.stockInEarned) : "—"}
            </Text>
          </View>
          <View style={S.summaryGrandItem}>
            <Text style={S.summaryGrandLabel}>GRAND TOTAL</Text>
            <Text style={S.summaryGrandValue}>{fmtPKR(report.totals.grandTotal)}</Text>
          </View>
        </View>

        {/* Per-model section header */}
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>Per Model Detailed Breakup</Text>
          <View style={S.sectionLine} />
          <Text style={[S.sectionTitle, { color: C.accentBar }]}>{rows.length} model{rows.length !== 1 ? "s" : ""}</Text>
        </View>

        {rows.map((r) => (
          <ModelSection
            key={r.modelId}
            row={r}
            policies={policies}
            basePercent={report.baseIncentivePercent}
            bonusPercent={bonusPercent}
          />
        ))}

        {rows.length === 0 && (
          <View style={[S.note, { marginTop: 20, padding: 16 }]}>
            <Text style={[S.noteText, { textAlign: "center", fontSize: 9 }]}>No activations in this period.</Text>
          </View>
        )}

        {/* Grand total footer */}
        <View style={S.grandFooter}>
          <View style={S.grandLeft}>
            <Text style={S.grandTag}>TOTAL AMOUNT EXPECTED FROM OPPO</Text>
            <Text style={S.grandAmt}>{fmtPKR(report.totals.grandTotal)}</Text>
            <Text style={[S.footerText, { color: C.grandAccent, marginTop: 4 }]}>
              {dealerName}  ·  {report.periodStart} → {report.periodEnd}
            </Text>
          </View>
          {nonZeroBreakdown.length > 0 && (
            <View style={S.grandBreakdown}>
              {nonZeroBreakdown.map((e) => (
                <View key={e.label} style={S.grandBreakRow}>
                  <Text style={S.grandBreakLabel}>{e.label}</Text>
                  <Text style={S.grandBreakValue}>{fmtPKR(e.val)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {report.totalActivationsCrossRegion > 0 && (
          <View style={S.note}>
            <Text style={S.noteText}>
              Cross-region: {report.totalActivationsCrossRegion} phones were cross-region activations. They earn base %, bonus %, activation and dealer incentive but are excluded from stock-in calculations.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={S.footerBar}>
          <Text style={S.footerText}>OPPO Pakistan · Detailed Incentive Breakup · Confidential</Text>
          <Text style={S.footerText}>Generated: {today()}</Text>
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
