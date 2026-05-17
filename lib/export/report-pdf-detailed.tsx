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

const C = {
  black: "#111111",
  headerBg: "#1A1A2E",
  headerFg: "#FFFFFF",
  border: "#E2E8F0",
  sectionBg: "#F1F5F9",
  mutedBg: "#F8FAFC",
  muted: "#64748B",
  green: "#16A34A",
  greenBg: "#F0FDF4",
  greenBorder: "#86EFAC",
  red: "#DC2626",
  redBg: "#FEF2F2",
  accent: "#2563EB",
  accentBg: "#EFF6FF",
  amber: "#D97706",
  amberBg: "#FFFBEB",
};

const S = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica", color: C.black },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  h2: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.muted, letterSpacing: 0.8 },
  meta: { color: C.muted, fontSize: 8, marginBottom: 14 },

  // Summary bar at top
  summaryBar: { flexDirection: "row", gap: 5, marginBottom: 14, padding: 8, backgroundColor: C.accentBg, borderRadius: 6, borderWidth: 0.5, borderColor: C.accent },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 7, color: C.muted, marginBottom: 1 },
  summaryValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.accent },

  // Model block
  modelBlock: { marginBottom: 14, borderWidth: 0.75, borderColor: C.border, borderRadius: 5, overflow: "hidden" },
  modelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "7 10", backgroundColor: C.headerBg },
  modelName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.headerFg },
  modelTotal: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#93C5FD" },
  modelMeta: { fontSize: 7.5, color: "#CBD5E1", marginTop: 1 },

  // Section inside model block
  section: { padding: "6 10" },
  sectionLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 },
  divider: { borderBottomWidth: 0.5, borderColor: C.border, marginBottom: 6 },

  // Sub-table rows
  subRow: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.3, borderColor: C.border },
  subHead: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.8, borderColor: C.border, backgroundColor: C.sectionBg },
  subCell: { fontSize: 7.5 },
  subCellBold: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  // Calculation line
  calcLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, paddingTop: 4, borderTopWidth: 0.5, borderColor: C.border },
  calcText: { fontSize: 8 },
  calcValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.accent },
  calcEq: { fontSize: 8, color: C.muted },

  // Badge
  badge: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 8, fontSize: 7, fontFamily: "Helvetica-Bold" },
  badgeMet: { backgroundColor: C.greenBg, color: C.green },
  badgeNotMet: { backgroundColor: C.redBg, color: C.red },

  // Footer
  grandFooter: { marginTop: 8, padding: 10, borderWidth: 1, borderColor: C.accent, borderRadius: 6, backgroundColor: C.accentBg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grandLabel: { fontSize: 10, color: C.accent, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.accent },

  note: { marginTop: 8, fontSize: 7, color: C.muted, borderWidth: 0.5, borderColor: C.border, padding: 5, borderRadius: 3 },
});

const fmtPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

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
  const actPolicy = policies.find((p) => p.type === "activation-incentive" && p.modelName === row.modelName);
  const stockPolicy = policies.find((p) => p.type === "stock-in" && p.modelName === row.modelName);
  const dlrPolicy = policies.find((p) => p.type === "dealer-incentive");

  return (
    <View style={S.modelBlock}>
      {/* Header */}
      <View style={S.modelHeader}>
        <View>
          <Text style={S.modelName}>{row.modelName}</Text>
          <Text style={S.modelMeta}>
            {row.qtyActivated} activations
            {row.qtyActivatedCrossRegion > 0 ? `  (${row.qtyActivatedCrossRegion} cross-region)` : ""}
          </Text>
        </View>
        <Text style={S.modelTotal}>{fmtPKR(row.total)}</Text>
      </View>

      {/* ── 4% Base + 1% Bonus Breakdown ── */}
      {row.priceSubperiods.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionLabel}>Base {basePercent}% + Bonus {bonusPercent}% Breakdown</Text>
          <View style={S.subHead}>
            <Text style={[S.subCell, { width: "20%" }]}>Qty</Text>
            <Text style={[S.subCell, { width: "30%" }]}>Price</Text>
            <Text style={[S.subCell, { width: "25%", textAlign: "right" }]}>Base {basePercent}%</Text>
            <Text style={[S.subCell, { width: "25%", textAlign: "right" }]}>Bonus {bonusPercent}%</Text>
          </View>
          {row.priceSubperiods.map((s, i) => (
            <View key={i} style={S.subRow}>
              <Text style={[S.subCell, { width: "20%" }]}>{s.qty} units</Text>
              <Text style={[S.subCell, { width: "30%" }]}>{fmtPKR(s.dealerPrice)}</Text>
              <Text style={[S.subCell, { width: "25%", textAlign: "right" }]}>{fmtPKR(s.basePercentSubtotal)}</Text>
              <Text style={[S.subCell, { width: "25%", textAlign: "right" }]}>{fmtPKR(s.bonusPercentSubtotal)}</Text>
            </View>
          ))}
          {row.priceSubperiods.length > 1 && (
            <View style={[S.subRow, { backgroundColor: C.sectionBg }]}>
              <Text style={[S.subCellBold, { width: "20%" }]}>Subtotal</Text>
              <Text style={[S.subCell, { width: "30%" }]}></Text>
              <Text style={[S.subCellBold, { width: "25%", textAlign: "right" }]}>{fmtPKR(row.basePercentEarned)}</Text>
              <Text style={[S.subCellBold, { width: "25%", textAlign: "right" }]}>{fmtPKR(row.bonusPercentEarned)}</Text>
            </View>
          )}
          <View style={S.calcLine}>
            <Text style={S.calcText}>Combined base + bonus:  </Text>
            <Text style={S.calcValue}>{fmtPKR(row.basePercentEarned + row.bonusPercentEarned)}</Text>
          </View>
        </View>
      )}

      {/* ── Activation Incentive ── */}
      {(row.activationIncentiveEarned > 0 || actPolicy) && (
        <View style={[S.section, { borderTopWidth: 0.5, borderColor: C.border }]}>
          <Text style={S.sectionLabel}>Activation Incentive</Text>
          {actPolicy ? (
            <>
              <View style={S.subHead}>
                <Text style={[S.subCell, { width: "25%" }]}>Activated</Text>
                <Text style={[S.subCell, { width: "25%" }]}>Target</Text>
                <Text style={[S.subCell, { width: "25%" }]}>Rate / unit</Text>
                <Text style={[S.subCell, { width: "25%", textAlign: "right" }]}>Earned</Text>
              </View>
              <View style={S.subRow}>
                <Text style={[S.subCell, { width: "25%" }]}>{actPolicy.actualQty} units</Text>
                <Text style={[S.subCell, { width: "25%" }]}>
                  {actPolicy.targetQty != null ? `≥ ${actPolicy.targetQty}` : "—"}
                </Text>
                <Text style={[S.subCell, { width: "25%" }]}>{fmtPKR(actPolicy.perUnitAmount)}</Text>
                <Text style={[S.subCellBold, { width: "25%", textAlign: "right" }]}>{fmtPKR(actPolicy.earned)}</Text>
              </View>
              <View style={S.calcLine}>
                <Text style={S.calcEq}>
                  {actPolicy.actualQty} × {fmtPKR(actPolicy.perUnitAmount)}  =
                </Text>
                <Text style={S.calcValue}>{fmtPKR(actPolicy.earned)}</Text>
                <View style={[S.badge, actPolicy.eligible ? S.badgeMet : S.badgeNotMet]}>
                  <Text>{actPolicy.eligible ? "Met ✓" : "Not Met ✗"}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={S.calcLine}>
              <Text style={S.calcText}>Earned:  </Text>
              <Text style={S.calcValue}>{fmtPKR(row.activationIncentiveEarned)}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Stock-In ── */}
      {(row.stockInEarned > 0 || stockPolicy) && (
        <View style={[S.section, { borderTopWidth: 0.5, borderColor: C.border }]}>
          <Text style={S.sectionLabel}>Stock-In</Text>
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
            <Text style={[S.subCell, { width: "22%" }]}>{row.interIdOutQty > 0 ? `−${row.interIdOutQty}` : "0"}</Text>
            <Text style={[S.subCellBold, { width: "22%" }]}>{row.effectiveStockInQty}</Text>
            <Text style={[S.subCellBold, { width: "12%", textAlign: "right" }]}>{fmtPKR(row.stockInEarned)}</Text>
          </View>
          {stockPolicy && (
            <View style={S.calcLine}>
              <Text style={S.calcEq}>
                {row.effectiveStockInQty} effective units × {fmtPKR(stockPolicy.perUnitAmount)}
                {stockPolicy.targetQty != null ? `  (min target: ${stockPolicy.targetQty})` : ""}  =
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
        <View style={[S.section, { borderTopWidth: 0.5, borderColor: C.border }]}>
          <Text style={S.sectionLabel}>Dealer Incentive (Global Target)</Text>
          {dlrPolicy && (
            <View style={S.subRow}>
              <Text style={[S.subCell, { width: "40%" }]}>
                Target: {dlrPolicy.targetQty ?? "—"} total activations  |  Actual: {dlrPolicy.actualQty}
              </Text>
              <Text style={[S.subCell, { width: "30%" }]}>Rate: {fmtPKR(dlrPolicy.perUnitAmount)}/unit</Text>
              <Text style={[S.subCellBold, { width: "30%", textAlign: "right" }]}>{fmtPKR(row.dealerIncentiveEarned)}</Text>
            </View>
          )}
          {!dlrPolicy && (
            <View style={S.calcLine}>
              <Text style={S.calcText}>Allocated:  </Text>
              <Text style={S.calcValue}>{fmtPKR(row.dealerIncentiveEarned)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export async function buildDetailedPDF(
  report: IncentiveReport,
  dealerName: string,
  policies: PolicyAchievementEntry[]
): Promise<Buffer> {
  const rows = report.rows.filter((r) => r.total > 0 || r.qtyActivated > 0);
  const bonusPercent = report.targetBonus.bonusPercent ?? 1;

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        <Text style={S.h1}>Detailed Incentive Breakup Report</Text>
        <Text style={S.meta}>
          {dealerName}{"  ·  "}{report.periodStart}  →  {report.periodEnd}
          {"  ·  Generated: "}{new Date().toLocaleDateString("en-PK")}
        </Text>

        {/* Summary bar */}
        <View style={S.summaryBar}>
          {[
            { label: "Total Activations", value: report.totalActivations.toString() },
            { label: `Base ${report.baseIncentivePercent}%`, value: fmtPKR(report.totals.basePercentEarned) },
            { label: `Bonus ${bonusPercent}%`, value: fmtPKR(report.totals.bonusPercentEarned) },
            { label: "Activation Incentive", value: fmtPKR(report.totals.activationIncentiveEarned) },
            { label: "Dealer Incentive", value: fmtPKR(report.totals.dealerIncentiveEarned) },
            { label: "Stock-In", value: fmtPKR(report.totals.stockInEarned) },
            { label: "GRAND TOTAL", value: fmtPKR(report.totals.grandTotal) },
          ].map(({ label, value }) => (
            <View key={label} style={S.summaryItem}>
              <Text style={S.summaryLabel}>{label}</Text>
              <Text style={S.summaryValue}>{value}</Text>
            </View>
          ))}
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
          <Text style={{ color: C.muted, textAlign: "center", marginTop: 40 }}>
            No activations in this period.
          </Text>
        )}

        {/* Grand total footer */}
        <View style={S.grandFooter}>
          <Text style={S.grandLabel}>Grand Total</Text>
          <Text style={S.grandValue}>{fmtPKR(report.totals.grandTotal)}</Text>
        </View>

        {report.totalActivationsCrossRegion > 0 && (
          <Text style={S.note}>
            Cross-region note: {report.totalActivationsCrossRegion} phones were cross-region.
            They earn base %, bonus %, activation incentive and dealer incentive but are excluded from stock-in.
          </Text>
        )}
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
