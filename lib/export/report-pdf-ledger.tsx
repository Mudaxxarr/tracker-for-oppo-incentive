import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { ensureInterFont, interFontReady, playfairFontReady } from "@/lib/export/pdf-fonts";
import type { IncentiveReport, IncentiveReportRow } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { RebateRow } from "@/lib/db/queries/rebates";
import type { CrCaughtExportRow } from "@/lib/db/queries/cr-caught";
import { NAVAL, type PdfTheme } from "./pdf-themes";

const fmtPKR = (n: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

const today = () => new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

// Weight ladder — Arctic uses Inter 300→800; Naval falls back to Helvetica
let _fL  = "Helvetica-Oblique";  // Light  (300) — meta, captions, secondary
let _fR  = "Helvetica";          // Regular (400) — body, table cells
let _fM  = "Helvetica";          // Medium  (500) — labels, table headers
let _fSB = "Helvetica-Bold";     // Semibold (600) — KPI values, model names
let _fB  = "Helvetica-Bold";     // Bold    (700) — headings, totals
let _fEB = "Helvetica-Bold";     // ExtraBold (800) — hero number

// ─── Styles (theme-driven) ────────────────────────────────────────────────────
function makeStyles(t: PdfTheme) {
  const m = t.minimal; // true = Arctic luxury
  const f = m && interFontReady;
  _fL  = f ? "Inter-Light"     : "Helvetica-Oblique";
  _fR  = f ? "Inter"           : "Helvetica";
  _fM  = f ? "Inter-Medium"    : "Helvetica";
  _fSB = f ? "Inter-Semibold"  : "Helvetica-Bold";
  _fB  = f ? "Inter-Bold"      : "Helvetica-Bold";
  _fEB = f ? "Inter-ExtraBold" : "Helvetica-Bold";
  return StyleSheet.create({
    page: {
      paddingHorizontal: m ? 52 : 32, paddingTop: 0, paddingBottom: 24,
      fontSize: 8.5, fontFamily: _fR, color: t.text, backgroundColor: "#FFFFFF",
    },

    // Header
    headerBg: {
      backgroundColor: t.headerBg,
      marginHorizontal: m ? -52 : -32, paddingHorizontal: m ? 52 : 32,
      paddingTop: m ? 28 : 14, paddingBottom: m ? 20 : 10,
      borderBottomWidth: m ? 0.5 : 0.75, borderBottomColor: t.tBorder,
    },
    headerBrand: { fontSize: m ? 5.5 : 9, fontFamily: m ? _fM : _fB, color: m ? t.light : t.headerSub, letterSpacing: m ? 3.5 : 2, marginBottom: m ? 10 : 3 },
    headerRow:   { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    headerTitle: { fontSize: m ? 26 : 16, fontFamily: m ? _fB : _fB, color: t.headerFg, letterSpacing: m ? -0.8 : 0.3 },
    headerMeta:  { fontSize: m ? 8 : 8, fontFamily: m ? _fL : _fR, color: m ? t.muted : t.headerSub, marginTop: m ? 7 : 3 },
    headerDate:  { fontSize: m ? 7 : 7.5, color: t.light, fontFamily: m ? _fL : _fR, textAlign: "right" },
    accentBar:   { height: m ? 0 : 3, backgroundColor: t.accent, marginHorizontal: m ? -52 : -32, marginBottom: 0 },

    // Hero — commanding number, generous whitespace, twin hairlines
    heroBanner: {
      marginTop: m ? 36 : 12, marginBottom: m ? 30 : 10,
      padding: m ? "26 0" : "11 14", borderRadius: m ? 0 : 5,
      backgroundColor: m ? "transparent" : t.grandBg,
      borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? t.tBorder : "transparent",
      borderBottomWidth: m ? 0.5 : 0, borderBottomColor: m ? t.tBorder : "transparent",
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    heroTag:    { fontSize: m ? 5.5 : 6.5, color: m ? t.muted : t.grandSub, fontFamily: m ? _fM : _fB, letterSpacing: m ? 2.5 : 0.5, marginBottom: m ? 12 : 4 },
    heroAmt:    { fontSize: m ? 44 : 22, fontFamily: m ? _fEB : _fB, color: m ? t.text : t.grandFg, letterSpacing: m ? -1.5 : 0 },
    heroRight:  { alignItems: "flex-end" },
    heroRLabel: { fontSize: m ? 5 : 6.5, color: m ? t.light : t.grandSub, fontFamily: m ? _fM : _fB, letterSpacing: m ? 2 : 0, marginBottom: m ? 6 : 3 },
    heroRVal:   { fontSize: m ? 14 : 10, color: m ? t.text : t.grandFg, fontFamily: m ? _fSB : _fB },
    heroRSub:   { fontSize: m ? 6.5 : 7, color: m ? t.light : t.grandSub, fontFamily: m ? _fL : _fR, marginTop: m ? 5 : 2 },

    // KPI strip — floating numbers, hairline top, maximum air
    kpiStrip:  { flexDirection: "row", gap: m ? 24 : 5, marginBottom: m ? 30 : 10 },
    kpiBox: {
      flex: 1,
      borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? t.tBorder : "transparent",
      borderWidth: m ? 0 : 0.75, borderColor: t.kpiBdr, borderRadius: m ? 0 : 4,
      backgroundColor: m ? "transparent" : t.kpiBg, padding: m ? "16 0" : "6 8",
    },
    kpiLabel:  { fontSize: m ? 5.5 : 6, color: m ? t.light : t.kpiLabel, fontFamily: m ? _fM : _fB, letterSpacing: m ? 2 : 0.4, marginBottom: m ? 9 : 3 },
    kpiValue:  { fontSize: m ? 18 : 10, fontFamily: m ? _fSB : _fB, color: t.text, letterSpacing: m ? -0.3 : 0 },
    kpiSub:    { fontSize: m ? 6.5 : 6.5, color: t.light, fontFamily: m ? _fL : _fR, marginTop: m ? 5 : 2 },

    // Section header — tracked CAPS, ghost rule
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: m ? 12 : 5, gap: 8 },
    sectionTitle:  { fontSize: m ? 5.5 : 7.5, fontFamily: m ? _fM : _fB, color: t.light, letterSpacing: m ? 2.5 : 0.8, textTransform: "uppercase" },
    sectionLine:   { flex: 1, borderBottomWidth: m ? 0.5 : 0.75, borderColor: t.tBorder },

    // Waterfall — open rows, ghost dividers
    waterfallRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: m ? "9 0" : "5 8", borderBottomWidth: m ? 0.5 : 0.5, borderColor: t.tBorder },
    waterfallTotal: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      padding: m ? "16 0" : "7 8",
      backgroundColor: m ? "transparent" : t.grandBg, borderRadius: m ? 0 : 3,
      borderTopWidth: m ? 0.75 : 0, borderTopColor: m ? t.text : "transparent",
    },

    // Summary table — no box, ghost row lines, tracked headers
    tHeadRow:   { flexDirection: "row", backgroundColor: m ? "transparent" : t.tHeadBg, borderRadius: m ? 0 : "2 2 0 0" as unknown as number, borderBottomWidth: m ? 0.5 : 0, borderBottomColor: m ? t.tBorder : "transparent", paddingTop: m ? 8 : 0 },
    tHCell:     { padding: m ? "4 5" : "4 5", color: m ? t.muted : t.tHeadFg, fontFamily: m ? _fM : _fB, fontSize: m ? 5.5 : 7, letterSpacing: m ? 1.8 : 0.2 },
    tRow:       { flexDirection: "row", borderTopWidth: m ? 0.5 : 0.5, borderColor: t.tBorder },
    tAltRow:    { flexDirection: "row", borderTopWidth: m ? 0.5 : 0.5, borderColor: t.tBorder, backgroundColor: "transparent" },
    tCell:      { padding: m ? "7 5" : "3.5 5", fontSize: 7.5 },
    tCellBold:  { padding: m ? "7 5" : "3.5 5", fontSize: 7.5, fontFamily: m ? _fSB : _fB },
    tTotalRow:  { flexDirection: "row", borderTopWidth: m ? 0.75 : 1, borderColor: m ? t.text : t.accent, backgroundColor: m ? "transparent" : t.tTotalBg },
    tTotalCell: { padding: m ? "8 5" : "4 5", fontSize: 7.5, fontFamily: m ? _fSB : _fB, color: m ? t.text : t.tTotalFg },
    table:      { borderWidth: m ? 0 : 0.75, borderColor: t.tBorder, borderRadius: m ? 0 : 3, overflow: "hidden" },

    // Model block — commanding name, max breathing room
    modelBlock:  { marginBottom: m ? 32 : 10, borderWidth: m ? 0 : 0.75, borderTopWidth: m ? 0.5 : 0, borderTopColor: m ? t.tBorder : "transparent", borderColor: t.tBorder, borderRadius: m ? 0 : 4, overflow: "hidden" },
    modelHead: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: m ? "22 0 14 0" : "7 10",
      backgroundColor: m ? "transparent" : t.tHeadBg,
      borderBottomWidth: m ? 0.5 : 0, borderBottomColor: m ? t.tBorder : "transparent",
    },
    modelName:   { fontSize: m ? 16 : 9.5, fontFamily: m ? _fSB : _fB, color: t.text, letterSpacing: m ? -0.3 : 0 },
    modelMeta:   { fontSize: m ? 7 : 7, color: t.light, fontFamily: m ? _fL : _fR, marginTop: m ? 4 : 2 },
    modelTotal:  { fontSize: m ? 16 : 10, fontFamily: m ? _fSB : _fB, color: t.text, letterSpacing: m ? -0.3 : 0 },
    modelTotLbl: { fontSize: m ? 5 : 6, color: t.light, marginBottom: m ? 4 : 2, textAlign: "right", fontFamily: m ? _fM : _fB, letterSpacing: m ? 1.5 : 0.3 },

    // Calc rows — ghost hairlines, generous vertical breathing
    calcRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: m ? 0 : 10, paddingVertical: m ? 8 : 4.5, borderTopWidth: m ? 0.5 : 0.5, borderColor: t.tBorder },
    calcAlt:    { flexDirection: "row", alignItems: "center", paddingHorizontal: m ? 0 : 10, paddingVertical: m ? 8 : 4.5, borderTopWidth: m ? 0.5 : 0.5, borderColor: t.tBorder, backgroundColor: "transparent" },
    calcLabel:  { width: "28%", fontSize: m ? 7.5 : 7.5, fontFamily: m ? _fSB : _fB, color: t.text },
    calcFormula:{ flex: 1, fontSize: m ? 7 : 7.5, color: t.light, fontFamily: m ? _fL : _fR, paddingLeft: m ? 12 : 10 },
    calcAmt:    { width: "22%", fontSize: m ? 8 : 8, fontFamily: m ? _fSB : _fB, color: t.text, textAlign: "right" },
    badge:      { paddingHorizontal: 5, paddingVertical: 2, borderRadius: m ? 2 : 8, fontSize: 6.5, fontFamily: m ? _fM : _fB, marginLeft: 6 },
    badgeMet:   { backgroundColor: t.greenBg, color: t.green },
    badgeNo:    { backgroundColor: t.redBg, color: t.red },
    badgeTeal:  { backgroundColor: "#ECFEFF", color: "#0E7490" },

    // Block subtotal — commanding total, tracked label
    blockSubtotal: {
      flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14,
      paddingHorizontal: m ? 0 : 10, paddingVertical: m ? 16 : 5,
      borderTopWidth: m ? 0.5 : 1, borderColor: m ? t.tBorder : t.accent,
      backgroundColor: m ? "transparent" : t.kpiBg,
    },
    blockSubLabel: { fontSize: m ? 5.5 : 7.5, fontFamily: m ? _fM : _fB, color: t.light, letterSpacing: m ? 2 : 0 },
    blockSubValue: { fontSize: m ? 15 : 9, fontFamily: m ? _fSB : _fB, color: t.text, letterSpacing: m ? -0.3 : 0 },

    // Footer
    footerBar:  { marginTop: 16, paddingTop: 8, borderTopWidth: m ? 0.5 : 0.75, borderColor: t.tBorder, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    footerText: { fontSize: m ? 6.5 : 6.5, color: t.light, fontFamily: m ? _fL : _fR },
  });
}

// ─── Model Block (transaction log page) ──────────────────────────────────────
type CalcEntry = {
  key: string;
  label: string;
  formula: string;
  amount: number;
  credit?: boolean;  // green
  debit?: boolean;   // red
  showBadge?: boolean;
  eligible?: boolean;
  teal?: boolean;
};

function ModelBlock({
  row,
  policies,
  basePercent,
  bonusPercent,
  rebatesForModel,
  finesForModel,
  S,
  t,
}: {
  row: IncentiveReportRow;
  policies: PolicyAchievementEntry[];
  basePercent: number;
  bonusPercent: number;
  rebatesForModel: RebateRow[];
  finesForModel: CrCaughtExportRow[];
  S: ReturnType<typeof makeStyles>;
  t: PdfTheme;
}) {
  const actPolicies = policies.filter(p => p.type === "activation-incentive" && p.modelName === row.modelName);
  const stockPolicy = policies.find(p => p.type === "stock-in" && p.modelName === row.modelName);
  const dlrPolicy   = policies.find(p => p.type === "dealer-incentive");

  const entries: CalcEntry[] = [];

  // Base %
  if (row.priceSubperiods.length === 1) {
    const sp = row.priceSubperiods[0];
    if (sp.basePercentSubtotal > 0)
      entries.push({ key: "base-0", label: `Base ${basePercent}%`, formula: `${sp.qty} × ${fmtPKR(sp.dealerPrice)} × ${basePercent}%`, amount: sp.basePercentSubtotal, credit: true });
    if (sp.bonusPercentSubtotal > 0)
      entries.push({ key: "bonus-0", label: `Bonus ${bonusPercent}%`, formula: `${sp.qty} × ${fmtPKR(sp.dealerPrice)} × ${bonusPercent}%`, amount: sp.bonusPercentSubtotal, credit: true });
  } else {
    row.priceSubperiods.forEach((sp, i) => {
      if (sp.basePercentSubtotal > 0)
        entries.push({ key: `base-${i}`, label: i === 0 ? `Base ${basePercent}%` : "", formula: `${sp.qty} units @ ${fmtPKR(sp.dealerPrice)} × ${basePercent}%`, amount: sp.basePercentSubtotal, credit: true });
    });
    if (row.basePercentEarned > 0 && row.priceSubperiods.filter(s => s.basePercentSubtotal > 0).length > 1)
      entries.push({ key: "base-sub", label: "", formula: `Subtotal Base ${basePercent}%`, amount: row.basePercentEarned });
    row.priceSubperiods.forEach((sp, i) => {
      if (sp.bonusPercentSubtotal > 0)
        entries.push({ key: `bonus-${i}`, label: i === 0 ? `Bonus ${bonusPercent}%` : "", formula: `${sp.qty} units @ ${fmtPKR(sp.dealerPrice)} × ${bonusPercent}%`, amount: sp.bonusPercentSubtotal, credit: true });
    });
  }

  // Activation incentive
  if (actPolicies.length > 0) {
    actPolicies.forEach((ap, i) => {
      const qty = ap.eligibleQty ?? ap.actualQty;
      const note = ap.targetQty != null ? `  (min. ${ap.targetQty} — ${qty} actual)` : "";
      entries.push({ key: `act-${i}`, label: i === 0 ? "Act. Incentive" : "", formula: `${qty} × ${fmtPKR(ap.perUnitAmount)}${note}`, amount: ap.earned, credit: ap.eligible, showBadge: true, eligible: ap.eligible });
    });
  } else if (row.activationIncentiveEarned > 0) {
    entries.push({ key: "act", label: "Act. Incentive", formula: `${row.qtyActivated} × policy rate`, amount: row.activationIncentiveEarned, credit: true });
  }

  // Stock-In
  if (row.stockInEarned > 0 || stockPolicy) {
    const rate = stockPolicy ? fmtPKR(stockPolicy.perUnitAmount) : "policy rate";
    const note = stockPolicy?.targetQty != null ? `  (min. ${stockPolicy.targetQty} required)` : "";
    entries.push({ key: "stock", label: "Stock-In", formula: `${row.effectiveStockInQty} × ${rate}${note}`, amount: row.stockInEarned, credit: row.stockInEarned > 0, showBadge: !!stockPolicy, eligible: stockPolicy?.eligible });
  }

  // Dealer Incentive
  if (row.dealerIncentiveEarned > 0) {
    const note = dlrPolicy ? `  (target: ${dlrPolicy.targetQty ?? "—"} activations)` : "";
    const rate = dlrPolicy ? fmtPKR(dlrPolicy.perUnitAmount) : "policy rate";
    entries.push({ key: "dlr", label: "Dealer Inc.", formula: `${row.qtyActivated} × ${rate}${note}`, amount: row.dealerIncentiveEarned, credit: true });
  }

  // Rebates for this model
  rebatesForModel.forEach((rb, i) => {
    entries.push({
      key: `rebate-${i}`,
      label: i === 0 ? "Rebate" : "",
      formula: `${rb.rebateDate} · drop ${fmtPKR(rb.rebatePerUnit)}/unit × ${rb.eligibleQty} units`,
      amount: rb.totalRebateAmount,
      teal: true,
    });
  });

  // Fines for this model
  finesForModel.forEach((f, i) => {
    if (f.fineAmount > 0)
      entries.push({
        key: `fine-${i}`,
        label: i === 0 ? "CR Fine" : "",
        formula: `${f.caughtDate} · ${f.quantity} unit${f.quantity !== 1 ? "s" : ""} caught`,
        amount: f.fineAmount,
        debit: true,
      });
  });

  const rebateSubtotal = rebatesForModel.reduce((s, r) => s + r.totalRebateAmount, 0);
  const fineSubtotal   = finesForModel.reduce((s, f) => s + f.fineAmount, 0);
  const modelNet = row.total + rebateSubtotal - fineSubtotal;

  return (
    <View style={S.modelBlock}>
      <View style={S.modelHead}>
        <View>
          <Text style={S.modelName}>{row.modelName}</Text>
          <Text style={S.modelMeta}>
            {row.qtyActivated} activation{row.qtyActivated !== 1 ? "s" : ""}
            {row.qtyActivatedCrossRegion > 0 ? `  ·  ${row.qtyActivatedCrossRegion} cross-region` : ""}
            {row.stockInRegularQty > 0 ? `  ·  ${row.stockInRegularQty} stocked` : ""}
          </Text>
        </View>
        <View>
          <Text style={S.modelTotLbl}>NET</Text>
          <Text style={S.modelTotal}>{fmtPKR(modelNet)}</Text>
        </View>
      </View>

      {entries.map((e, idx) => (
        <View key={e.key} style={idx % 2 === 0 ? S.calcRow : S.calcAlt}>
          <Text style={S.calcLabel}>{e.label}</Text>
          <Text style={S.calcFormula}>{e.formula}</Text>
          <Text style={[S.calcAmt, e.debit ? { color: t.red } : e.teal ? { color: "#0E7490" } : e.credit ? { color: t.green } : {}]}>
            {e.debit ? `−${fmtPKR(e.amount)}` : e.amount > 0 ? (e.teal ? `+${fmtPKR(e.amount)}` : fmtPKR(e.amount)) : "—"}
          </Text>
        </View>
      ))}

      <View style={S.blockSubtotal}>
        <Text style={S.blockSubLabel}>MODEL NET</Text>
        <Text style={S.blockSubValue}>{fmtPKR(modelNet)}</Text>
      </View>
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function buildLedgerPDF(
  report: IncentiveReport,
  dealerName: string,
  policies: PolicyAchievementEntry[],
  rebateRows: RebateRow[],
  crCaughtRows: CrCaughtExportRow[],
  crCaughtLoss: { totalFines: number },
  rebateTotal: number,
  theme: PdfTheme = NAVAL
): Promise<Buffer> {
  ensureInterFont(); const S = makeStyles(theme);
  const t = theme;

  const rows = report.rows.filter(r => r.total > 0 || r.qtyActivated > 0);
  const tb = report.targetBonus;
  const bonusPercent = tb.bonusPercent ?? 1;
  const net = report.totals.grandTotal + rebateTotal - crCaughtLoss.totalFines;
  const totalPages = 1 + (rows.length > 0 ? 1 : 0);

  // Summary page models: top 8 by total
  const summaryRows = [...report.rows]
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  function Header({ sub }: { sub?: string }) {
    return (
      <>
        <View style={S.headerBg}>
          <Text style={S.headerBrand}>OPPO PAKISTAN</Text>
          <View style={S.headerRow}>
            <View>
              <Text style={S.headerTitle}>Monthly Dealer Ledger{sub ? ` — ${sub}` : ""}</Text>
              <Text style={S.headerMeta}>{dealerName}  ·  {report.periodStart}  →  {report.periodEnd}</Text>
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

  function Footer({ page }: { page: number }) {
    return (
      <View style={S.footerBar}>
        <Text style={S.footerText}>OPPO Pakistan  ·  {dealerName}  ·  Monthly Ledger  ·  Confidential</Text>
        <Text style={S.footerText}>Page {page} of {totalPages}  ·  {today()}</Text>
      </View>
    );
  }

  const doc = (
    <Document>
      {/* ══ Page 1: Summary ══ */}
      <Page size="A4" style={S.page}>
        <Header />

        {/* Hero */}
        <View style={S.heroBanner}>
          <View>
            <Text style={S.heroTag}>NET RECEIVABLE FROM OPPO — {report.periodStart} to {report.periodEnd}</Text>
            <Text style={S.heroAmt}>{fmtPKR(net)}</Text>
          </View>
          <View style={S.heroRight}>
            <Text style={S.heroRLabel}>PERIOD SUMMARY</Text>
            <Text style={S.heroRVal}>{report.totalActivations} Activations</Text>
            <Text style={S.heroRSub}>
              {report.rows.filter(r => r.total > 0).length} models  ·  {policies.filter(p => p.eligible).length}/{policies.length} policies met
            </Text>
          </View>
        </View>

        {/* KPI strip */}
        <View style={S.kpiStrip}>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>TOTAL ACTIVATIONS</Text>
            <Text style={S.kpiValue}>{report.totalActivations}</Text>
            {report.totalActivationsCrossRegion > 0 && <Text style={S.kpiSub}>{report.totalActivationsCrossRegion} cross-region</Text>}
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiLabel}>GROSS INCENTIVE</Text>
            <Text style={S.kpiValue}>{fmtPKR(report.totals.grandTotal)}</Text>
          </View>
          <View style={[S.kpiBox, !t.minimal ? { borderColor: rebateTotal > 0 ? "#0891B2" : t.kpiBdr, backgroundColor: rebateTotal > 0 ? "#ECFEFF" : t.kpiBg } : {}]}>
            <Text style={[S.kpiLabel, { color: rebateTotal > 0 ? "#0E7490" : t.kpiLabel }]}>+ REBATES</Text>
            <Text style={[S.kpiValue, { color: rebateTotal > 0 ? "#0E7490" : t.light }]}>{rebateTotal > 0 ? fmtPKR(rebateTotal) : "—"}</Text>
            {rebateRows.length > 0 && <Text style={S.kpiSub}>{rebateRows.length} price-drop event{rebateRows.length !== 1 ? "s" : ""}</Text>}
          </View>
          <View style={[S.kpiBox, !t.minimal ? { borderColor: crCaughtLoss.totalFines > 0 ? t.red : t.kpiBdr, backgroundColor: crCaughtLoss.totalFines > 0 ? t.redBg : t.kpiBg } : {}]}>
            <Text style={[S.kpiLabel, { color: crCaughtLoss.totalFines > 0 ? t.red : t.kpiLabel }]}>− FINES</Text>
            <Text style={[S.kpiValue, { color: crCaughtLoss.totalFines > 0 ? t.red : t.light }]}>{crCaughtLoss.totalFines > 0 ? fmtPKR(crCaughtLoss.totalFines) : "—"}</Text>
          </View>
        </View>

        {/* Financial Waterfall */}
        <View style={[S.sectionHeader, { marginBottom: 6 }]}>
          <Text style={S.sectionTitle}>Financial Waterfall</Text>
          <View style={S.sectionLine} />
        </View>
        <View style={{ borderWidth: t.minimal ? 0 : 0.75, borderColor: t.tBorder, borderRadius: t.minimal ? 0 : 3, overflow: "hidden", marginBottom: t.minimal ? 20 : 12 }}>
          {[
            { label: "Gross Incentives",     val: report.totals.grandTotal,     sign: "",  color: t.accent },
            ...(rebateTotal > 0 ? [{ label: "Price-Drop Rebates", val: rebateTotal, sign: "+", color: "#0E7490" }] : []),
            ...(crCaughtLoss.totalFines > 0 ? [{ label: "CR Fines (Deducted)", val: crCaughtLoss.totalFines, sign: "−", color: t.red }] : []),
          ].map((e, i) => (
            <View key={e.label} style={[S.waterfallRow, { backgroundColor: t.minimal ? "transparent" : (i % 2 === 1 ? t.tAlt : "#FFFFFF") }]}>
              <Text style={{ fontSize: 8, color: t.muted }}>{e.sign ? `${e.sign}  ` : "    "}{e.label}</Text>
              <Text style={{ fontSize: 8, fontFamily: _fB, color: e.color }}>
                {e.sign === "−" ? `−${fmtPKR(e.val)}` : fmtPKR(e.val)}
              </Text>
            </View>
          ))}
          <View style={S.waterfallTotal}>
            <Text style={{ fontSize: 8, fontFamily: _fB, color: t.minimal ? t.muted : t.grandSub }}>= NET RECEIVABLE</Text>
            <Text style={{ fontSize: 9, fontFamily: _fB, color: t.minimal ? t.text : t.grandFg }}>{fmtPKR(net)}</Text>
          </View>
        </View>

        {/* Model Summary Table */}
        <View style={[S.sectionHeader, { marginBottom: 5 }]}>
          <Text style={S.sectionTitle}>Model Summary</Text>
          <View style={S.sectionLine} />
          <Text style={S.sectionTitle}>{rows.length} models</Text>
        </View>
        <View style={S.table}>
          <View style={S.tHeadRow}>
            <Text style={[S.tHCell, { flex: 3 }]}>Model</Text>
            <Text style={[S.tHCell, { width: "10%", textAlign: "right" }]}>Qty</Text>
            <Text style={[S.tHCell, { width: "20%", textAlign: "right" }]}>Gross Incentive</Text>
            <Text style={[S.tHCell, { width: "18%", textAlign: "right" }]}>Rebates</Text>
            <Text style={[S.tHCell, { width: "20%", textAlign: "right" }]}>Model Net</Text>
          </View>
          {summaryRows.map((r, i) => {
            const rbt = rebateRows.filter(rb => rb.modelName === r.modelName).reduce((s, rb) => s + rb.totalRebateAmount, 0);
            const fns = crCaughtRows.filter(f => f.modelName === r.modelName).reduce((s, f) => s + f.fineAmount, 0);
            const mNet = r.total + rbt - fns;
            return (
              <View key={r.modelId} style={i % 2 === 1 ? S.tAltRow : S.tRow}>
                <Text style={[S.tCellBold, { flex: 3 }]}>{r.modelName}</Text>
                <Text style={[S.tCell, { width: "10%", textAlign: "right" }]}>{r.qtyActivated}</Text>
                <Text style={[S.tCell, { width: "20%", textAlign: "right", color: t.accent }]}>{fmtPKR(r.total)}</Text>
                <Text style={[S.tCell, { width: "18%", textAlign: "right", color: rbt > 0 ? "#0E7490" : t.light }]}>{rbt > 0 ? `+${fmtPKR(rbt)}` : "—"}</Text>
                <Text style={[S.tCellBold, { width: "20%", textAlign: "right" }]}>{fmtPKR(mNet)}</Text>
              </View>
            );
          })}
          {summaryRows.length < rows.length && (
            <View style={S.tRow}>
              <Text style={[S.tCell, { flex: 1, color: t.muted, fontFamily: _fL }]}>
                + {rows.length - summaryRows.length} more models — see Transaction Log
              </Text>
            </View>
          )}
          <View style={S.tTotalRow}>
            <Text style={[S.tTotalCell, { flex: 3 }]}>NET RECEIVABLE</Text>
            <Text style={[S.tTotalCell, { width: "10%" }]}></Text>
            <Text style={[S.tTotalCell, { width: "20%", textAlign: "right" }]}>{fmtPKR(report.totals.grandTotal)}</Text>
            <Text style={[S.tTotalCell, { width: "18%", textAlign: "right" }]}>{rebateTotal > 0 ? `+${fmtPKR(rebateTotal)}` : "—"}</Text>
            <Text style={[S.tTotalCell, { width: "20%", textAlign: "right" }]}>{fmtPKR(net)}</Text>
          </View>
        </View>

        <Footer page={1} />
      </Page>

      {/* ══ Page 2+: Transaction Log (model-grouped) ══ */}
      {rows.length > 0 && (
        <Page size="A4" style={S.page}>
          <Header sub="Transaction Log" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: t.minimal ? 16 : 8, marginBottom: t.minimal ? 14 : 10 }}>
            <Text style={[S.sectionTitle, { color: t.minimal ? t.muted : t.accent }]}>PER-MODEL TRANSACTION LOG</Text>
            <View style={S.sectionLine} />
            <Text style={S.sectionTitle}>{rows.length} MODELS</Text>
          </View>

          {rows.map((row) => (
            <ModelBlock
              key={row.modelId}
              row={row}
              policies={policies}
              basePercent={report.baseIncentivePercent}
              bonusPercent={bonusPercent}
              rebatesForModel={rebateRows.filter(r => r.modelName === row.modelName)}
              finesForModel={crCaughtRows.filter(r => r.modelName === row.modelName)}
              S={S}
              t={t}
            />
          ))}

          {/* Grand total */}
          <View style={{ marginTop: t.minimal ? 20 : 6, padding: t.minimal ? "18 0" : "10 14", borderRadius: t.minimal ? 0 : 5, backgroundColor: t.minimal ? "transparent" : t.grandBg, borderTopWidth: t.minimal ? 0.5 : 0, borderTopColor: t.minimal ? t.tBorder : "transparent", borderBottomWidth: t.minimal ? 0.5 : 0, borderBottomColor: t.minimal ? t.tBorder : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: t.minimal ? 6 : 7, color: t.minimal ? t.muted : t.grandSub, fontFamily: _fB, letterSpacing: t.minimal ? 1.5 : 0.5, marginBottom: t.minimal ? 8 : 4 }}>GRAND NET RECEIVABLE FROM OPPO</Text>
              <Text style={{ fontSize: t.minimal ? 36 : 18, fontFamily: _fEB, color: t.minimal ? t.text : t.grandFg, letterSpacing: t.minimal ? -1 : 0 }}>{fmtPKR(net)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {[
                { l: "Gross Incentives", v: report.totals.grandTotal },
                ...(rebateTotal > 0 ? [{ l: "+ Rebates", v: rebateTotal }] : []),
                ...(crCaughtLoss.totalFines > 0 ? [{ l: "− Fines", v: crCaughtLoss.totalFines, neg: true }] : []),
              ].map(e => (
                <View key={e.l} style={{ flexDirection: "row", gap: 10, marginBottom: t.minimal ? 3 : 1 }}>
                  <Text style={{ fontSize: t.minimal ? 5.5 : 7, color: t.muted, letterSpacing: t.minimal ? 0.5 : 0 }}>{e.l}</Text>
                  <Text style={{ fontSize: t.minimal ? 6 : 7, color: (e as {neg?: boolean}).neg ? t.red : t.text, fontFamily: _fB }}>
                    {(e as {neg?: boolean}).neg ? `−${fmtPKR(e.v)}` : fmtPKR(e.v)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Footer page={2} />
        </Page>
      )}
    </Document>
  );

  return await renderToBuffer(doc);
}
