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

const C = {
  black: "#111111",
  headerBg: "#1A1A2E",
  headerFg: "#FFFFFF",
  border: "#E2E8F0",
  mutedBg: "#F8FAFC",
  muted: "#64748B",
  green: "#16A34A",
  greenBg: "#F0FDF4",
  red: "#DC2626",
  redBg: "#FEF2F2",
  accent: "#2563EB",
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica", color: C.black },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  h2: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4, color: C.accent },
  meta: { color: C.muted, fontSize: 8, marginBottom: 10 },
  cardRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  card: { flex: 1, padding: 6, borderWidth: 0.5, borderColor: C.border, borderRadius: 4, backgroundColor: C.mutedBg },
  cardLabel: { fontSize: 7, color: C.muted, marginBottom: 1 },
  cardValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  cardSub: { fontSize: 7, color: C.muted, marginTop: 1 },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: C.border },
  tHead: { backgroundColor: C.headerBg },
  tHCell: { padding: "3 4", color: C.headerFg, fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  tCell: { padding: "3 4", fontSize: 8 },
  tAlt: { backgroundColor: C.mutedBg },
  tTotal: { backgroundColor: "#EFF6FF" },
  totalsRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  totalBox: { flex: 1, padding: 6, borderWidth: 0.5, borderColor: C.border, borderRadius: 4 },
  totalLabel: { fontSize: 7, color: C.muted },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  grandBox: { flex: 1.5, padding: 6, borderWidth: 1, borderColor: C.accent, borderRadius: 4, backgroundColor: "#EFF6FF" },
  grandLabel: { fontSize: 8, color: C.accent },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.accent },
  note: { marginTop: 8, fontSize: 7, color: C.muted, borderWidth: 0.5, borderColor: C.border, padding: 5, borderRadius: 3 },
  badge: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 8, fontSize: 7, fontFamily: "Helvetica-Bold" },
  badgeMet: { backgroundColor: C.greenBg, color: C.green },
  badgeNotMet: { backgroundColor: C.redBg, color: C.red },
});

const fmtPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

const POLICY_LABEL: Record<PolicyAchievementEntry["type"], string> = {
  "target-bonus": "Target Bonus",
  "stock-in": "Stock-In",
  "activation-incentive": "Activation Incentive",
  "dealer-incentive": "Dealer Incentive",
};

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

export async function buildPDF(
  report: IncentiveReport,
  dealerName: string,
  opts?: { skipNoIncentive?: boolean; policies?: PolicyAchievementEntry[] }
): Promise<Buffer> {
  const rows = opts?.skipNoIncentive
    ? report.rows.filter((r) => r.total > 0)
    : report.rows;

  const policies = opts?.policies ?? [];

  const doc = (
    <Document>
      {/* ── Page 1: Summary + Per-Model Table ── */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.h1}>OPPO Dealer Incentive Report</Text>
        <Text style={styles.meta}>
          {dealerName}{"  ·  "}{report.periodStart}  →  {report.periodEnd}
          {opts?.skipNoIncentive ? "  ·  Incentive models only" : ""}
        </Text>

        <View style={styles.cardRow}>
          <SummaryCard label="Activations" value={report.totalActivations.toString()} sub={`${report.totalActivationsCrossRegion} cross-region`} />
          <SummaryCard label={`${report.targetBonus.bonusPercent ?? 1}% Bonus (on activations)`} value={report.targetBonus.eligible ? "Met ✓" : "Not met"} sub={`Purchased: ${report.targetBonus.actualQty} / ${report.targetBonus.targetQty ?? "—"}`} />
          <SummaryCard label="Dealer Incentive" value={report.dealerIncentive.eligible ? "Met ✓" : "Not met"} sub={`${report.dealerIncentive.actualTotal} / ${report.dealerIncentive.targetTotal ?? "—"}`} />
          <SummaryCard label="Base %" value={fmtPKR(report.totals.basePercentEarned)} />
          <SummaryCard label="Target Bonus" value={fmtPKR(report.totals.bonusPercentEarned)} />
          <SummaryCard label="Activation Incentive" value={fmtPKR(report.totals.activationIncentiveEarned)} />
          <SummaryCard label="Dealer Incentive" value={fmtPKR(report.totals.dealerIncentiveEarned)} />
          <SummaryCard label="Stock-In" value={fmtPKR(report.totals.stockInEarned)} />
        </View>

        <Text style={styles.h2}>Per Model Breakdown</Text>
        <View style={[styles.tRow, styles.tHead]}>
          <Text style={[styles.tHCell, { width: "22%" }]}>Model</Text>
          <Text style={[styles.tHCell, { width: "6%", textAlign: "right" }]}>Qty</Text>
          <Text style={[styles.tHCell, { width: "6%", textAlign: "right" }]}>CR</Text>
          <Text style={[styles.tHCell, { width: "14%", textAlign: "right" }]}>Old / New Price Split</Text>
          <Text style={[styles.tHCell, { width: "10%", textAlign: "right" }]}>Base %</Text>
          <Text style={[styles.tHCell, { width: "10%", textAlign: "right" }]}>Bonus %</Text>
          <Text style={[styles.tHCell, { width: "10%", textAlign: "right" }]}>Act. Inc.</Text>
          <Text style={[styles.tHCell, { width: "10%", textAlign: "right" }]}>Dlr. Inc.</Text>
          <Text style={[styles.tHCell, { width: "8%", textAlign: "right" }]}>Stock-In</Text>
          <Text style={[styles.tHCell, { width: "10%", textAlign: "right" }]}>Total</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.modelId} style={[styles.tRow, i % 2 === 1 ? styles.tAlt : {}]}>
            <Text style={[styles.tCell, { width: "22%" }]}>{r.modelName}</Text>
            <Text style={[styles.tCell, { width: "6%", textAlign: "right" }]}>{r.qtyActivated}</Text>
            <Text style={[styles.tCell, { width: "6%", textAlign: "right" }]}>{r.qtyActivatedCrossRegion > 0 ? r.qtyActivatedCrossRegion : ""}</Text>
            <Text style={[styles.tCell, { width: "14%", textAlign: "right", fontSize: 7 }]}>
              {r.priceSubperiods.map((s) => `${s.qty}@${fmtPKR(s.dealerPrice)}`).join("  ")}
            </Text>
            <Text style={[styles.tCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(r.basePercentEarned)}</Text>
            <Text style={[styles.tCell, { width: "10%", textAlign: "right" }]}>{fmtPKR(r.bonusPercentEarned)}</Text>
            <Text style={[styles.tCell, { width: "10%", textAlign: "right" }]}>{r.activationIncentiveEarned > 0 ? fmtPKR(r.activationIncentiveEarned) : "—"}</Text>
            <Text style={[styles.tCell, { width: "10%", textAlign: "right" }]}>{r.dealerIncentiveEarned > 0 ? fmtPKR(r.dealerIncentiveEarned) : "—"}</Text>
            <Text style={[styles.tCell, { width: "8%", textAlign: "right" }]}>{r.stockInEarned > 0 ? fmtPKR(r.stockInEarned) : "—"}</Text>
            <Text style={[styles.tCell, { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(r.total)}</Text>
          </View>
        ))}
        <View style={[styles.tRow, styles.tTotal]}>
          <Text style={[styles.tCell, { width: "22%", fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
          <Text style={[styles.tCell, { width: "6%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{rows.reduce((s, r) => s + r.qtyActivated, 0)}</Text>
          <Text style={[styles.tCell, { width: "6%", textAlign: "right" }]}></Text>
          <Text style={[styles.tCell, { width: "14%", textAlign: "right" }]}></Text>
          <Text style={[styles.tCell, { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(rows.reduce((s, r) => s + r.basePercentEarned, 0))}</Text>
          <Text style={[styles.tCell, { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(rows.reduce((s, r) => s + r.bonusPercentEarned, 0))}</Text>
          <Text style={[styles.tCell, { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(rows.reduce((s, r) => s + r.activationIncentiveEarned, 0))}</Text>
          <Text style={[styles.tCell, { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(rows.reduce((s, r) => s + r.dealerIncentiveEarned, 0))}</Text>
          <Text style={[styles.tCell, { width: "8%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(rows.reduce((s, r) => s + r.stockInEarned, 0))}</Text>
          <Text style={[styles.tCell, { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmtPKR(rows.reduce((s, r) => s + r.total, 0))}</Text>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.grandBox}>
            <Text style={styles.grandLabel}>Grand Total (engine)</Text>
            <Text style={styles.grandValue}>{fmtPKR(report.totals.grandTotal)}</Text>
          </View>
          <View style={styles.totalBox}><Text style={styles.totalLabel}>Base %</Text><Text style={styles.totalValue}>{fmtPKR(report.totals.basePercentEarned)}</Text></View>
          <View style={styles.totalBox}><Text style={styles.totalLabel}>Bonus %</Text><Text style={styles.totalValue}>{fmtPKR(report.totals.bonusPercentEarned)}</Text></View>
          <View style={styles.totalBox}><Text style={styles.totalLabel}>Activation Incentive</Text><Text style={styles.totalValue}>{fmtPKR(report.totals.activationIncentiveEarned)}</Text></View>
          <View style={styles.totalBox}><Text style={styles.totalLabel}>Dealer Incentive</Text><Text style={styles.totalValue}>{fmtPKR(report.totals.dealerIncentiveEarned)}</Text></View>
          <View style={styles.totalBox}><Text style={styles.totalLabel}>Stock-In</Text><Text style={styles.totalValue}>{fmtPKR(report.totals.stockInEarned)}</Text></View>
        </View>

        {report.totalActivationsCrossRegion > 0 ? (
          <Text style={styles.note}>
            Cross-region note: {report.totalActivationsCrossRegion} phones were cross-region.
            They earn base %, bonus %, activation incentive and dealer incentive but are excluded from stock-in.
          </Text>
        ) : null}
      </Page>

      {/* ── Page 2: Policies & Achievements ── */}
      {policies.length > 0 && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.h1}>Policies &amp; Achievements</Text>
          <Text style={styles.meta}>
            {dealerName}{"  ·  "}{report.periodStart}  →  {report.periodEnd}
          </Text>

          <View style={[styles.tRow, styles.tHead]}>
            <Text style={[styles.tHCell, { width: "18%" }]}>Type</Text>
            <Text style={[styles.tHCell, { width: "18%" }]}>Model</Text>
            <Text style={[styles.tHCell, { width: "16%" }]}>Period</Text>
            <Text style={[styles.tHCell, { width: "8%", textAlign: "right" }]}>Target</Text>
            <Text style={[styles.tHCell, { width: "12%", textAlign: "right" }]}>Rate / %</Text>
            <Text style={[styles.tHCell, { width: "8%", textAlign: "right" }]}>Actual</Text>
            <Text style={[styles.tHCell, { width: "12%", textAlign: "right" }]}>Earned</Text>
            <Text style={[styles.tHCell, { width: "8%", textAlign: "center" }]}>Status</Text>
          </View>

          {policies.map((p, i) => (
            <View key={i} style={[styles.tRow, i % 2 === 1 ? styles.tAlt : {}]}>
              <Text style={[styles.tCell, { width: "18%", fontFamily: "Helvetica-Bold", fontSize: 7.5 }]}>
                {POLICY_LABEL[p.type]}
              </Text>
              <Text style={[styles.tCell, { width: "18%" }]}>{p.modelName ?? "All models"}</Text>
              <Text style={[styles.tCell, { width: "16%", fontSize: 7, color: C.muted }]}>
                {p.periodStart} → {p.periodEnd}
              </Text>
              <Text style={[styles.tCell, { width: "8%", textAlign: "right" }]}>{p.targetQty ?? "—"}</Text>
              <Text style={[styles.tCell, { width: "12%", textAlign: "right" }]}>
                {p.type === "target-bonus" ? `${p.perUnitAmount}%` : fmtPKR(p.perUnitAmount)}
              </Text>
              <Text style={[styles.tCell, { width: "8%", textAlign: "right" }]}>{p.actualQty}</Text>
              <Text style={[styles.tCell, { width: "12%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {fmtPKR(p.earned)}
              </Text>
              <View style={[{ width: "8%", padding: "3 4", alignItems: "center", justifyContent: "center" }]}>
                <Text style={[styles.badge, p.eligible ? styles.badgeMet : styles.badgeNotMet]}>
                  {p.eligible ? "Met ✓" : "Not Met ✗"}
                </Text>
              </View>
            </View>
          ))}

          {/* Policy totals footer */}
          <View style={[styles.tRow, styles.tTotal, { marginTop: 2 }]}>
            <Text style={[styles.tCell, { width: "18%", fontFamily: "Helvetica-Bold" }]}>TOTAL EARNED</Text>
            <Text style={[styles.tCell, { width: "18%" }]}></Text>
            <Text style={[styles.tCell, { width: "16%" }]}></Text>
            <Text style={[styles.tCell, { width: "8%" }]}></Text>
            <Text style={[styles.tCell, { width: "12%" }]}></Text>
            <Text style={[styles.tCell, { width: "8%" }]}></Text>
            <Text style={[styles.tCell, { width: "12%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
              {fmtPKR(policies.filter((p) => p.eligible).reduce((s, p) => s + p.earned, 0))}
            </Text>
            <Text style={[styles.tCell, { width: "8%" }]}></Text>
          </View>

          <View style={[styles.totalsRow, { marginTop: 10 }]}>
            <View style={styles.grandBox}>
              <Text style={styles.grandLabel}>Grand Total (all incentives)</Text>
              <Text style={styles.grandValue}>{fmtPKR(report.totals.grandTotal)}</Text>
            </View>
            {[
              { label: "Met policies", value: policies.filter((p) => p.eligible).length },
              { label: "Not met policies", value: policies.filter((p) => !p.eligible).length },
            ].map(({ label, value }) => (
              <View key={label} style={styles.totalBox}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text style={styles.totalValue}>{value}</Text>
              </View>
            ))}
          </View>
        </Page>
      )}
    </Document>
  );

  return await renderToBuffer(doc);
}
