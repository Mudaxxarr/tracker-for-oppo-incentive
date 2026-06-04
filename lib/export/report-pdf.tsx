import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { RebateRow } from "@/lib/db/queries/rebates";
import type { CrCaughtExportRow } from "@/lib/db/queries/cr-caught";

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  // Header / brand
  headerBg:   "#0B1629",
  headerFg:   "#FFFFFF",
  headerSub:  "#93C5FD",
  accentBar:  "#2563EB",

  // KPI strip
  kpiBg:      "#EFF6FF",
  kpiBorder:  "#BFDBFE",
  kpiLabel:   "#1E40AF",
  kpiValue:   "#0F172A",

  // Grand total card
  grandBg:    "#1E3A5F",
  grandFg:    "#FFFFFF",
  grandAccent:"#93C5FD",

  // Tables
  tHeaderBg:  "#1E293B",
  tHeaderFg:  "#FFFFFF",
  tAlt:       "#F8FAFC",
  tBorder:    "#E2E8F0",
  tTotalBg:   "#EFF6FF",
  tTotalFg:   "#1E40AF",

  // Status
  green:      "#15803D",
  greenBg:    "#F0FDF4",
  greenBorder:"#BBF7D0",
  red:        "#B91C1C",
  redBg:      "#FFF1F2",
  redBorder:  "#FECDD3",

  // Typography
  textPrimary:"#0F172A",
  textMuted:  "#64748B",
  textLight:  "#94A3B8",
  divider:    "#E2E8F0",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 20,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: C.textPrimary,
    backgroundColor: "#FFFFFF",
  },

  // Header
  headerBg: {
    backgroundColor: C.headerBg,
    marginHorizontal: -28,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 0,
  },
  accentBar: {
    height: 3,
    backgroundColor: C.accentBar,
    marginHorizontal: -28,
    marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.headerFg, letterSpacing: 0.3 },
  headerBrand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.headerSub, letterSpacing: 2, marginBottom: 3 },
  headerMeta: { fontSize: 8, color: C.headerSub, marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 7.5, color: C.textLight, fontFamily: "Helvetica-Oblique" },

  // KPI strip
  kpiStrip: {
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
    marginBottom: 12,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: C.kpiBorder,
    borderRadius: 4,
    backgroundColor: C.kpiBg,
    padding: "6 7",
  },
  kpiLabel: { fontSize: 6.5, color: C.kpiLabel, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, marginBottom: 3 },
  kpiValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.kpiValue },
  kpiSub:   { fontSize: 6.5, color: C.textMuted, marginTop: 2 },

  kpiGrandBox: {
    flex: 1.6,
    borderWidth: 1,
    borderColor: C.accentBar,
    borderRadius: 4,
    backgroundColor: C.grandBg,
    padding: "6 7",
  },
  kpiGrandLabel: { fontSize: 6.5, color: C.grandAccent, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, marginBottom: 3 },
  kpiGrandValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.grandFg },

  // Target status banner
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: "6 10",
    borderRadius: 4,
    borderWidth: 0.75,
    marginBottom: 12,
  },
  targetLabel:  { fontSize: 7.5, fontFamily: "Helvetica-Bold", flex: 1 },
  targetSub:    { fontSize: 7, color: C.textMuted },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 7, fontFamily: "Helvetica-Bold" },
  badgeMet:    { backgroundColor: C.greenBg, color: C.green },
  badgeNotMet: { backgroundColor: C.redBg, color: C.red },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 8, fontFamily: "Helvetica-Bold", color: C.textMuted,
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  sectionLine: { flex: 1, borderBottomWidth: 0.75, borderColor: C.divider },

  // Table
  table: { borderWidth: 0.75, borderColor: C.tBorder, borderRadius: 3, overflow: "hidden" },
  tHeadRow: { flexDirection: "row", backgroundColor: C.tHeaderBg },
  tHCell: {
    padding: "4 5",
    color: C.tHeaderFg,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.2,
  },
  tRow:  { flexDirection: "row", borderTopWidth: 0.5, borderColor: C.tBorder },
  tAltRow: { flexDirection: "row", borderTopWidth: 0.5, borderColor: C.tBorder, backgroundColor: C.tAlt },
  tCell: { padding: "3.5 5", fontSize: 8 },
  tCellBold: { padding: "3.5 5", fontSize: 8, fontFamily: "Helvetica-Bold" },
  tTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.accentBar,
    backgroundColor: C.tTotalBg,
  },
  tTotalCell: {
    padding: "4 5",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.tTotalFg,
  },

  // Totals breakdown strip below table
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
  totalValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // Grand total banner
  grandBanner: {
    marginTop: 10,
    padding: "10 14",
    borderRadius: 5,
    backgroundColor: C.grandBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grandLeft: {},
  grandTag: { fontSize: 7.5, color: C.grandAccent, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 4 },
  grandAmt: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.grandFg },
  grandBreakdown: { alignItems: "flex-end" },
  grandBreakItem: { flexDirection: "row", gap: 6, marginBottom: 1.5 },
  grandBreakLabel: { fontSize: 7, color: C.grandAccent },
  grandBreakValue: { fontSize: 7, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },

  // Note
  note: {
    marginTop: 8,
    padding: "5 8",
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: C.tBorder,
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
  opts?: { skipNoIncentive?: boolean; policies?: PolicyAchievementEntry[] }
): Promise<Buffer> {
  const rows = opts?.skipNoIncentive
    ? report.rows.filter((r) => r.total > 0)
    : report.rows;

  const policies = opts?.policies ?? [];
  const tb = report.targetBonus;
  const totalPages = policies.length > 0 ? 2 : 1;

  const doc = (
    <Document>
      {/* ══ Page 1: Summary + Per-Model Table ══ */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

        <KpiStrip report={report} />

        {/* Target bonus status */}
        {tb.targetQty != null && (
          <View style={[S.targetRow, { borderColor: tb.eligible ? C.greenBorder : C.redBorder, backgroundColor: tb.eligible ? C.greenBg : C.redBg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[S.targetLabel, { color: tb.eligible ? C.green : C.red }]}>
                Target Bonus {tb.bonusPercent}%  —  {tb.eligible ? "Target Achieved" : "Target Not Reached"}
              </Text>
              <Text style={S.targetSub}>
                Purchases: {tb.actualQty} / {tb.targetQty} required
                {!tb.eligible ? `  ·  ${tb.targetQty - tb.actualQty} more needed to unlock bonus` : ""}
              </Text>
            </View>
            <View style={[S.badge, tb.eligible ? S.badgeMet : S.badgeNotMet]}>
              <Text>{tb.eligible ? "Met ✓" : "Not Met ✗"}</Text>
            </View>
          </View>
        )}

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

        {/* Grand total banner */}
        <View style={S.grandBanner}>
          <View style={S.grandLeft}>
            <Text style={S.grandTag}>TOTAL AMOUNT EXPECTED FROM OPPO</Text>
            <Text style={S.grandAmt}>{fmtPKR(report.totals.grandTotal)}</Text>
          </View>
          <View style={S.grandBreakdown}>
            {[
              { label: `Base ${report.baseIncentivePercent}%`, val: report.totals.basePercentEarned },
              { label: `Bonus ${tb.bonusPercent}%`, val: report.totals.bonusPercentEarned },
              { label: "Activation Inc.", val: report.totals.activationIncentiveEarned },
              { label: "Dealer Inc.", val: report.totals.dealerIncentiveEarned },
              { label: "Stock-In", val: report.totals.stockInEarned },
            ].filter((e) => e.val > 0).map((e) => (
              <View key={e.label} style={S.grandBreakItem}>
                <Text style={S.grandBreakLabel}>{e.label}</Text>
                <Text style={S.grandBreakValue}>{fmtPKR(e.val)}</Text>
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

      {/* ══ Page 2: Policies & Achievements ══ */}
      {policies.length > 0 && (
        <Page size="A4" orientation="landscape" style={S.page}>
          <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

          <View style={[S.sectionHeader, { marginTop: 12 }]}>
            <Text style={S.sectionTitle}>Policies &amp; Achievements</Text>
            <View style={S.sectionLine} />
          </View>

          <View style={S.table}>
            <View style={S.tHeadRow}>
              <Text style={[S.tHCell, { width: "18%" }]}>Policy Type</Text>
              <Text style={[S.tHCell, { width: "18%" }]}>Model</Text>
              <Text style={[S.tHCell, { width: "16%" }]}>Period</Text>
              <Text style={[S.tHCell, { width: "9%",  textAlign: "right" }]}>Target</Text>
              <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Rate / %</Text>
              <Text style={[S.tHCell, { width: "9%",  textAlign: "right" }]}>Actual</Text>
              <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Earned</Text>
              <Text style={[S.tHCell, { width: "6%",  textAlign: "center" }]}>Status</Text>
            </View>

            {policies.map((p, i) => {
              const RowStyle = i % 2 === 1 ? S.tAltRow : S.tRow;
              return (
                <View key={i} style={RowStyle}>
                  <Text style={[S.tCellBold, { width: "18%", fontSize: 7.5 }]}>{POLICY_LABEL[p.type]}</Text>
                  <Text style={[S.tCell,     { width: "18%" }]}>{p.modelName ?? "All models"}</Text>
                  <Text style={[S.tCell,     { width: "16%", fontSize: 7, color: C.textMuted }]}>{p.periodStart} → {p.periodEnd}</Text>
                  <Text style={[S.tCell,     { width: "9%",  textAlign: "right" }]}>{p.targetQty ?? "—"}</Text>
                  <Text style={[S.tCell,     { width: "12%", textAlign: "right" }]}>
                    {p.type === "target-bonus" ? `${p.perUnitAmount}%` : fmtPKR(p.perUnitAmount)}
                  </Text>
                  <Text style={[S.tCell,     { width: "9%",  textAlign: "right" }]}>{p.actualQty}</Text>
                  <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: C.accentBar }]}>{fmtPKR(p.earned)}</Text>
                  <View style={{ width: "6%", padding: "3.5 4", alignItems: "center", justifyContent: "center" }}>
                    <View style={[S.badge, p.eligible ? S.badgeMet : S.badgeNotMet]}>
                      <Text>{p.eligible ? "Met ✓" : "Not Met"}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            <View style={S.tTotalRow}>
              <Text style={[S.tTotalCell, { width: "18%" }]}>TOTAL ELIGIBLE</Text>
              <Text style={[S.tTotalCell, { width: "18%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "16%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "9%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "12%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "9%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "12%", textAlign: "right" }]}>
                {fmtPKR(policies.filter((p) => p.eligible).reduce((s, p) => s + p.earned, 0))}
              </Text>
              <Text style={[S.tTotalCell, { width: "6%" }]}></Text>
            </View>
          </View>

          <View style={[S.totalsStrip, { marginTop: 14 }]}>
            <View style={[S.kpiGrandBox, { flex: 2 }]}>
              <Text style={S.kpiGrandLabel}>GRAND TOTAL (ALL INCENTIVES)</Text>
              <Text style={S.kpiGrandValue}>{fmtPKR(report.totals.grandTotal)}</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={S.kpiLabel}>POLICIES MET</Text>
              <Text style={[S.kpiValue, { color: C.green }]}>{policies.filter((p) => p.eligible).length}</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={S.kpiLabel}>POLICIES NOT MET</Text>
              <Text style={[S.kpiValue, { color: C.red }]}>{policies.filter((p) => !p.eligible).length}</Text>
            </View>
          </View>

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
    crCaughtLoss?: { totalUnits: number; lostIncentive: number; totalFines: number };
    rebateTotal?: number;
  }
): Promise<Buffer> {
  const { policies = [], rebateRows = [], crCaughtRows = [], crCaughtLoss, rebateTotal = 0 } = opts ?? {};
  const tb = report.targetBonus;
  const net = report.totals.grandTotal + rebateTotal - (crCaughtLoss?.totalFines ?? 0);
  const streams = [
    { label: `Base ${report.baseIncentivePercent}%`, val: report.totals.basePercentEarned },
    { label: `Target Bonus ${tb.bonusPercent}%`, val: report.totals.bonusPercentEarned },
    { label: "Activation Incentive", val: report.totals.activationIncentiveEarned },
    { label: "Dealer Incentive", val: report.totals.dealerIncentiveEarned },
    { label: "Stock-In", val: report.totals.stockInEarned },
  ].filter((s) => s.val > 0);
  const hasDetail = rebateRows.length > 0 || crCaughtRows.length > 0;
  const tp = 1 + (hasDetail ? 1 : 0) + (policies.length > 0 ? 1 : 0);

  const PH = 24; // portrait horizontal padding
  const ph = (n: number) => -n as unknown as number; // neg margin helper

  const AH = StyleSheet.create({
    page: { paddingHorizontal: PH, paddingTop: 0, paddingBottom: 18, fontSize: 8.5, fontFamily: "Helvetica", color: C.textPrimary, backgroundColor: "#FFFFFF" },
    heroRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
    heroBox: { flex: 1, borderRadius: 5, padding: "9 10", borderWidth: 1 },
    heroLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 4 },
    heroVal: { fontSize: 14, fontFamily: "Helvetica-Bold" },
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
          <View style={[AH.heroBox, { borderColor: C.accentBar, backgroundColor: C.grandBg }]}>
            <Text style={[AH.heroLabel, { color: C.grandAccent }]}>NET RECEIVABLE</Text>
            <Text style={[AH.heroVal, { color: C.grandFg }]}>{fmtPKR(net)}</Text>
            <Text style={[AH.heroSub, { color: (crCaughtLoss?.totalFines ?? 0) > 0 ? "#FCA5A5" : C.grandAccent }]}>
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
                <Text style={[S.tCell, { width: "30%", textAlign: "right", fontFamily: "Helvetica-Bold", color: C.accentBar }]}>{fmtPKR(s.val)}</Text>
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
              Target Bonus {tb.bonusPercent}% — {tb.eligible ? "TARGET ACHIEVED ✓" : "TARGET NOT REACHED ✗"}
            </Text>
            <Text style={S.targetSub}>{tb.actualQty} / {tb.targetQty ?? "—"} units purchased{!tb.eligible && tb.targetQty ? ` · ${tb.targetQty - tb.actualQty} more needed` : ""}</Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: tb.eligible ? C.green : C.red, marginRight: 6 }}>{fmtPKR(report.totals.bonusPercentEarned)}</Text>
          <View style={[S.badge, tb.eligible ? S.badgeMet : S.badgeNotMet]}><Text>{tb.eligible ? "Met ✓" : "Not Met ✗"}</Text></View>
        </View>

        {crCaughtLoss && crCaughtLoss.totalUnits > 0 && (
          <View style={{ marginTop: 8, padding: "6 8", borderRadius: 4, borderWidth: 0.75, borderColor: C.redBorder, backgroundColor: C.redBg, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Text style={[S.targetLabel, { color: C.red }]}>CR Caught:</Text>
            <Text style={[S.targetSub, { color: C.red }]}>{crCaughtLoss.totalUnits} units</Text>
            {crCaughtLoss.totalFines > 0 && <Text style={[S.targetSub, { color: C.red }]}>· Cash Fines: {fmtPKR(crCaughtLoss.totalFines)}</Text>}
            <Text style={[S.targetSub, { color: C.red }]}>· Est. Lost Incentive: {fmtPKR(crCaughtLoss.lostIncentive)}</Text>
          </View>
        )}
        <Footer page={1} total={tp} />
      </Page>

      {/* ══ Page 2: Rebates + CR Caught Detail ══ */}
      {hasDetail && (
        <Page size="A4" style={AH.page}>
          <AnalyticsHeader sub="Detail" />
          {rebateRows.length > 0 && (
            <>
              <View style={[S.sectionHeader, { marginTop: 12 }]}>
                <Text style={S.sectionTitle}>Price-Drop Rebates</Text>
                <View style={S.sectionLine} />
                <Text style={[S.sectionTitle, { color: "#0E7490" }]}>{fmtPKR(rebateTotal)}</Text>
              </View>
              <View style={S.table}>
                <View style={S.tHeadRow}>
                  <Text style={[S.tHCell, { width: "13%" }]}>Date</Text>
                  <Text style={[S.tHCell, { width: "26%" }]}>Model</Text>
                  <Text style={[S.tHCell, { width: "17%", textAlign: "right" }]}>Old Price</Text>
                  <Text style={[S.tHCell, { width: "17%", textAlign: "right" }]}>New Price</Text>
                  <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Drop/Unit</Text>
                  <Text style={[S.tHCell, { width: "7%", textAlign: "right" }]}>Qty</Text>
                  <Text style={[S.tHCell, { width: "8%", textAlign: "right" }]}>Rebate</Text>
                </View>
                {rebateRows.map((r, i) => (
                  <View key={r.id} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                    <Text style={[S.tCell, { width: "13%", fontSize: 7, color: C.textMuted }]}>{r.rebateDate}</Text>
                    <Text style={[S.tCellBold, { width: "26%" }]}>{r.modelName}</Text>
                    <Text style={[S.tCell, { width: "17%", textAlign: "right", color: C.textMuted, fontSize: 7 }]}>{fmtPKR(r.oldDealerPrice)}</Text>
                    <Text style={[S.tCell, { width: "17%", textAlign: "right" }]}>{fmtPKR(r.newDealerPrice)}</Text>
                    <Text style={[S.tCellBold, { width: "12%", textAlign: "right", color: "#0E7490" }]}>+{fmtPKR(r.rebatePerUnit)}</Text>
                    <Text style={[S.tCell, { width: "7%", textAlign: "right" }]}>{r.eligibleQty}</Text>
                    <Text style={[S.tCellBold, { width: "8%", textAlign: "right", color: "#0E7490" }]}>{fmtPKR(r.totalRebateAmount)}</Text>
                  </View>
                ))}
                <View style={S.tTotalRow}>
                  <Text style={[S.tTotalCell, { width: "92%" }]}>TOTAL REBATES</Text>
                  <Text style={[S.tTotalCell, { width: "8%", textAlign: "right" }]}>{fmtPKR(rebateTotal)}</Text>
                </View>
              </View>
            </>
          )}
          {crCaughtRows.length > 0 && (
            <>
              <View style={[S.sectionHeader, { marginTop: rebateRows.length > 0 ? 14 : 12 }]}>
                <Text style={[S.sectionTitle, { color: C.red }]}>CR Caught — Penalty Log</Text>
                <View style={S.sectionLine} />
              </View>
              <View style={S.table}>
                <View style={S.tHeadRow}>
                  <Text style={[S.tHCell, { width: "14%" }]}>Date</Text>
                  <Text style={[S.tHCell, { width: "28%" }]}>Model</Text>
                  <Text style={[S.tHCell, { width: "8%", textAlign: "right" }]}>Qty</Text>
                  <Text style={[S.tHCell, { width: "20%", textAlign: "right" }]}>Price Snapshot</Text>
                  <Text style={[S.tHCell, { width: "15%", textAlign: "right" }]}>Cash Fine</Text>
                  <Text style={[S.tHCell, { width: "15%", textAlign: "right" }]}>Est. Lost Inc.</Text>
                </View>
                {crCaughtRows.map((r, i) => {
                  const est = r.quantity > 0 ? Math.round(r.quantity * r.dealerPriceSnapshot * (report.baseIncentivePercent / 100) * 1.25) : 0;
                  return (
                    <View key={i} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                      <Text style={[S.tCell, { width: "14%", fontSize: 7, color: C.textMuted }]}>{r.caughtDate}</Text>
                      <Text style={[S.tCellBold, { width: "28%" }]}>{r.modelName}</Text>
                      <Text style={[S.tCell, { width: "8%", textAlign: "right" }]}>{r.quantity}</Text>
                      <Text style={[S.tCell, { width: "20%", textAlign: "right" }]}>{r.dealerPriceSnapshot > 0 ? fmtPKR(r.dealerPriceSnapshot) : "—"}</Text>
                      <Text style={[S.tCell, { width: "15%", textAlign: "right", color: r.fineAmount > 0 ? C.red : C.textLight }]}>{r.fineAmount > 0 ? fmtPKR(r.fineAmount) : "—"}</Text>
                      <Text style={[S.tCell, { width: "15%", textAlign: "right", color: C.red }]}>{est > 0 ? `−${fmtPKR(est)}` : "—"}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          <Footer page={2} total={tp} />
        </Page>
      )}

      {/* ══ Last Page: Policies ══ */}
      {policies.length > 0 && (
        <Page size="A4" style={AH.page}>
          <AnalyticsHeader sub="Policies" />
          <View style={[S.sectionHeader, { marginTop: 12 }]}>
            <Text style={S.sectionTitle}>Policies &amp; Achievements</Text>
            <View style={S.sectionLine} />
            <Text style={[S.sectionTitle, { color: C.green }]}>{policies.filter(p => p.eligible).length} met · </Text>
            <Text style={[S.sectionTitle, { color: C.red }]}>{policies.filter(p => !p.eligible).length} not met</Text>
          </View>
          <View style={S.table}>
            <View style={S.tHeadRow}>
              <Text style={[S.tHCell, { width: "20%" }]}>Policy Type</Text>
              <Text style={[S.tHCell, { width: "20%" }]}>Model</Text>
              <Text style={[S.tHCell, { width: "18%" }]}>Period</Text>
              <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Target</Text>
              <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>Rate</Text>
              <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Actual</Text>
              <Text style={[S.tHCell, { width: "10%", textAlign: "center" }]}>Status</Text>
            </View>
            {policies.map((p, i) => (
              <View key={i} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                <Text style={[S.tCellBold, { width: "20%", fontSize: 7.5 }]}>{POLICY_LABEL[p.type]}</Text>
                <Text style={[S.tCell, { width: "20%" }]}>{p.modelName ?? "All models"}</Text>
                <Text style={[S.tCell, { width: "18%", fontSize: 7, color: C.textMuted }]}>{p.periodStart} → {p.periodEnd}</Text>
                <Text style={[S.tCell, { width: "10%", textAlign: "right" }]}>{p.targetQty ?? "—"}</Text>
                <Text style={[S.tCell, { width: "12%", textAlign: "right" }]}>{p.type === "target-bonus" ? `${p.perUnitAmount}%` : fmtPKR(p.perUnitAmount)}</Text>
                <Text style={[S.tCell, { width: "10%", textAlign: "right" }]}>{p.actualQty}</Text>
                <View style={{ width: "10%", padding: "3.5 4", alignItems: "center" }}>
                  <View style={[S.badge, p.eligible ? S.badgeMet : S.badgeNotMet]}><Text>{p.eligible ? "Met ✓" : "✗"}</Text></View>
                </View>
              </View>
            ))}
            <View style={S.tTotalRow}>
              <Text style={[S.tTotalCell, { width: "70%" }]}>TOTAL ELIGIBLE</Text>
              <Text style={[S.tTotalCell, { width: "20%" }]}></Text>
              <Text style={[S.tTotalCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(policies.filter(p => p.eligible).reduce((s, p) => s + p.earned, 0))}</Text>
            </View>
          </View>
          <Footer page={tp} total={tp} />
        </Page>
      )}
    </Document>
  );
  return await renderToBuffer(doc);
}
