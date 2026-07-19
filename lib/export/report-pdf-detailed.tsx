import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { ensureInterFont, interFontReady, playfairFontReady } from "@/lib/export/pdf-fonts";
import type { StockRow } from "@/lib/db/queries/purchases";
import type { IncentiveReport, IncentiveReportRow } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { RebateRow } from "@/lib/db/queries/rebates";
import type { CrCaughtExportRow } from "@/lib/db/queries/cr-caught";
import { NAVAL, type PdfTheme } from "./pdf-themes";
import { buildDealerIncentiveBreakdown, isZeroDealerIncentivePolicy, type DealerIncentiveBreakdown } from "@/lib/report-utils";

const POLICY_LABEL: Record<PolicyAchievementEntry["type"], string> = {
  "target-bonus": "Target Bonus",
  "stock-in": "Stock-In",
  "activation-incentive": "Activation Incentive",
  "dealer-incentive": "Dealer Incentive",
};

// ─── Palette ──────────────────────────────────────────────────────────────────
// Warm monochrome document palette + muted pastel chips for semantic state only.
const PASTEL = {
  greenBg: "#EDF3EC", greenFg: "#346538",
  redBg:   "#FDEBEC", redFg:   "#9F2F2D",
  blueBg:  "#E1F3FE", blueFg:  "#1F6C9F",
  yellowBg:"#FBF3DB", yellowFg:"#956400",
};

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

let _fL  = "Helvetica-Oblique";
let _fR  = "Helvetica";
let _fM  = "Helvetica";
let _fSB = "Helvetica-Bold";
let _fB  = "Helvetica-Bold";
let _fEB = "Helvetica-Bold";
let _serif = "Times-Roman";

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeS(theme: PdfTheme) {
  const C = buildC(theme);
  const m = theme.minimal;
  const f = interFontReady;
  _fL  = f ? "Inter-Light"     : "Helvetica-Oblique";
  _fR  = f ? "Inter"           : "Helvetica";
  _fM  = f ? "Inter-Medium"    : "Helvetica";
  _fSB = f ? "Inter-Semibold"  : "Helvetica-Bold";
  _fB  = f ? "Inter-Bold"      : "Helvetica-Bold";
  _fEB = f ? "Inter-ExtraBold" : "Helvetica-Bold";
  _serif = playfairFontReady ? "Playfair" : "Times-Roman";
  return StyleSheet.create({
    page: { paddingHorizontal: 36, paddingTop: 0, paddingBottom: 24, fontSize: 8.5, fontFamily: _fR, color: C.text, backgroundColor: "#FFFFFF" },

    // Header — quiet band, hairline rule
    headerBg:    { backgroundColor: C.headerBg, marginHorizontal: -36, paddingHorizontal: 36, paddingTop: 16, paddingBottom: 12, borderBottomWidth: m ? 0.75 : 0, borderBottomColor: m ? C.border : "transparent" },
    accentBar:   { height: m ? 0 : 3, backgroundColor: C.accent, marginHorizontal: -36, marginBottom: 0 },
    headerRow:   { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    headerBrand: { fontSize: m ? 5.5 : 9, fontFamily: m ? _fM : _fB, color: m ? C.light : C.headerSub, letterSpacing: m ? 3.5 : 2, marginBottom: m ? 10 : 3 },
    headerTitle: { fontSize: m ? 22 : 16, fontFamily: _fB, color: C.headerSub === "#93C5FD" ? "#FFFFFF" : C.text, letterSpacing: m ? -0.8 : 0.3 },
    headerMeta:  { fontSize: 8, fontFamily: m ? _fL : _fR, color: m ? C.muted : C.headerSub, marginTop: m ? 7 : 3 },
    headerDate:  { fontSize: 7.5, color: C.light, fontFamily: m ? _fL : _fR, textAlign: "right" },

    // Plain-language intro
    intro: { marginTop: 12, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
    introText: { fontSize: 8, color: C.muted, lineHeight: 1.6 },

    // THE ANSWER — answer-first hero (no filled band; ruled, typographic)
    answerWrap:  { marginTop: 14, marginBottom: 6, paddingVertical: 14, borderTopWidth: 1.25, borderTopColor: C.text, borderBottomWidth: 0.5, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    answerTag:   { fontSize: 6, color: C.light, fontFamily: _fM, letterSpacing: 2.5, marginBottom: 8 },
    answerAmt:   { fontSize: 30, fontFamily: _fEB, color: C.text, letterSpacing: -1 },
    answerSub:   { fontSize: 7, color: C.muted, marginTop: 6, fontFamily: m ? _fL : _fR },
    eqChip:      { borderWidth: 0.75, borderColor: C.border, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 6, minWidth: 72, alignItems: "center", justifyContent: "center" },
    eqChipLabel: { fontSize: 5.5, fontFamily: _fM, letterSpacing: 1.2, color: C.light, marginBottom: 3, textAlign: "center" },
    eqChipVal:   { fontSize: 9, fontFamily: _fSB, color: C.text, textAlign: "center" },
    eqSignBox:   { width: 15, alignItems: "center", justifyContent: "center" },
    eqSign:      { fontSize: 10, fontFamily: _fM, color: C.light, lineHeight: 1 },

    // Numbered step header
    stepHead:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 4 },
    stepNum:   { width: 14, height: 14, borderWidth: 1, borderColor: C.text, borderRadius: 7, alignItems: "center", justifyContent: "center" },
    stepNumTx: { fontSize: 7.5, fontFamily: _fB, color: C.text },
    stepTitle: { fontSize: 9.5, fontFamily: _fB, color: C.text, letterSpacing: -0.2 },
    stepLine:  { flex: 1, borderBottomWidth: 0.5, borderColor: C.border },
    stepHint:  { fontSize: 7, color: C.light, marginBottom: 8, marginLeft: 22, fontFamily: m ? _fL : _fR, lineHeight: 1.5 },

    // Stat tiles (Step 1)
    tiles: { flexDirection: "row", gap: 8, marginBottom: 2 },
    tile:  { flex: 1, borderWidth: 0.75, borderColor: C.border, borderRadius: 6, padding: "9 8", backgroundColor: "#FFFFFF", alignItems: "center" },
    tileLabel: { fontSize: 5.5, color: C.light, fontFamily: _fM, letterSpacing: 1.5, marginBottom: 6, textAlign: "center" },
    tileVal:   { fontSize: 14, fontFamily: _fSB, color: C.text, letterSpacing: -0.3, textAlign: "center" },
    tileSub:   { fontSize: 6.5, color: C.light, marginTop: 4, fontFamily: m ? _fL : _fR, textAlign: "center", lineHeight: 1.4 },

    // Model card (Step 2)
    card:      { marginBottom: 10, borderWidth: 0.75, borderColor: C.border, borderRadius: 6, overflow: "hidden" },
    cardHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
    cardModel: { fontSize: 10, fontFamily: _fSB, color: C.text, letterSpacing: -0.2 },
    cardMeta:  { fontSize: 6.5, color: C.light, fontFamily: m ? _fL : _fR, marginTop: 3 },
    cardTotLabel: { fontSize: 5.5, color: C.light, marginBottom: 3, textAlign: "right", fontFamily: _fM, letterSpacing: 1.2 },
    cardTotValue: { fontSize: 11, fontFamily: _fB, color: C.accent, textAlign: "right" },
    calcRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4.5, borderTopWidth: 0.4, borderColor: C.border },
    calcLabel: { width: "24%", fontSize: 7.5, fontFamily: _fSB, color: C.text },
    calcFormula: { flex: 1, fontSize: 7.5, color: C.muted },
    calcAmount:  { width: "20%", fontSize: 8, fontFamily: _fB, color: C.text, textAlign: "right" },
    cardTotal:   { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 0.75, borderColor: C.text },
    cardTotalLabel: { fontSize: 7, fontFamily: _fM, color: C.muted, letterSpacing: 0.8 },
    cardTotalValue: { fontSize: 9.5, fontFamily: _fB, color: C.accent },

    // Pastel state chips
    chip:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999, fontSize: 5.5, fontFamily: _fB, letterSpacing: 0.6, marginLeft: 6 },
    chipMet:   { backgroundColor: PASTEL.greenBg, color: PASTEL.greenFg },
    chipNo:    { backgroundColor: PASTEL.redBg, color: PASTEL.redFg },
    chipOwed:  { backgroundColor: PASTEL.blueBg, color: PASTEL.blueFg },

    // Ledger tables (Steps 3–5 + Final)
    tbl:      { borderWidth: 0.75, borderColor: C.border, borderRadius: 6, overflow: "hidden" },
    tHead:    { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingTop: 3 },
    tHCell:   { padding: "4 6", color: C.light, fontFamily: _fM, fontSize: 6, letterSpacing: 1.2 },
    tRow:     { flexDirection: "row", borderTopWidth: 0.4, borderColor: C.border },
    tCell:    { padding: "4.5 6", fontSize: 7.5 },
    tCellB:   { padding: "4.5 6", fontSize: 7.5, fontFamily: _fSB },
    tSub:     { flexDirection: "row", borderTopWidth: 0.6, borderColor: C.muted },
    tSubCell: { padding: "5 6", fontSize: 7.5, fontFamily: _fSB, color: C.muted },
    tTot:     { flexDirection: "row", borderTopWidth: 1, borderColor: C.text },
    tTotCell: { padding: "6 6", fontSize: 8.5, fontFamily: _fB, color: C.text },

    // Final check box
    checkBox:  { marginTop: 10, borderWidth: 0.75, borderColor: C.border, borderRadius: 6, padding: "10 12", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    checkText: { fontSize: 7.5, color: C.muted, lineHeight: 1.6, flex: 1, paddingRight: 12 },

    // Footer
    footerBar:  { marginTop: 16, paddingTop: 8, borderTopWidth: 0.5, borderColor: C.border, flexDirection: "row", justifyContent: "space-between" },
    footerText: { fontSize: 6.5, color: C.light, fontFamily: m ? _fL : _fR },

    // Hidden-insights page — editorial, warm-monochrome, pastel only for state
    insOpen:    { marginTop: 18, paddingBottom: 14, borderBottomWidth: 1.25, borderBottomColor: C.text },
    insEyebrow: { fontSize: 6, color: C.light, fontFamily: _fM, letterSpacing: 2.5, marginBottom: 8 },
    insTitle:   { fontSize: 23, fontFamily: _fEB, color: C.text, letterSpacing: -0.4, lineHeight: 1.1 },
    insSub:     { fontSize: 7.5, color: C.muted, marginTop: 7, fontFamily: m ? _fL : _fR, lineHeight: 1.6, maxWidth: 380 },
    bigCard:    { flex: 1, borderWidth: 0.75, borderColor: C.border, borderRadius: 8, padding: "12 14" },
    bigCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    bigCardLbl: { fontSize: 5.5, color: C.light, fontFamily: _fM, letterSpacing: 1.5 },
    bigCardName:{ fontSize: 16, fontFamily: _fSB, color: C.text, letterSpacing: -0.3, marginTop: 8 },
    bigCardSub: { fontSize: 6.5, color: C.light, marginTop: 5, fontFamily: m ? _fL : _fR, lineHeight: 1.5 },
    tagPill:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999, fontSize: 5, fontFamily: _fB, letterSpacing: 0.8 },
    barTrack:   { height: 3, backgroundColor: "#ECEBE8", borderRadius: 1.5, flex: 1 },
    barFill:    { height: 3, borderRadius: 1.5 },
    insNote:    { fontSize: 6.5, color: C.light, marginTop: 6, fontFamily: m ? _fL : _fR, lineHeight: 1.6 },
  });
}
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

// ─── Step header ──────────────────────────────────────────────────────────────
function StepHead({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <>
      <View style={S.stepHead} wrap={false}>
        <View style={S.stepNum}><Text style={S.stepNumTx}>{n}</Text></View>
        <Text style={S.stepTitle}>{title}</Text>
        <View style={S.stepLine} />
      </View>
      {hint ? <Text style={S.stepHint}>{hint}</Text> : <View style={{ height: 4 }} />}
    </>
  );
}

// ─── THE ANSWER (hero) ────────────────────────────────────────────────────────
function TheAnswer({ gross, rebates, fines, net, dealerName, ps, pe }: {
  gross: number; rebates: number; fines: number; net: number; dealerName: string; ps: string; pe: string;
}) {
  return (
    <View style={S.answerWrap} wrap={false}>
      <View>
        <Text style={S.answerTag}>THE FINAL ANSWER — OPPO OWES YOU</Text>
        <Text style={S.answerAmt}>{fmtPKR(net)}</Text>
        <Text style={S.answerSub}>{dealerName}  ·  {ps} → {pe}  ·  every rupee below adds up to this number</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={S.eqChip}>
          <Text style={S.eqChipLabel}>EARNED</Text>
          <Text style={S.eqChipVal}>{fmtPKR(gross)}</Text>
        </View>
        <View style={S.eqSignBox}><Text style={S.eqSign}>+</Text></View>
        <View style={S.eqChip}>
          <Text style={S.eqChipLabel}>MONEY BACK</Text>
          <Text style={[S.eqChipVal, { color: rebates > 0 ? PASTEL.greenFg : C.light }]}>{rebates > 0 ? fmtPKR(rebates) : "Rs 0"}</Text>
        </View>
        <View style={S.eqSignBox}><Text style={S.eqSign}>−</Text></View>
        <View style={[S.eqChip, { backgroundColor: fines > 0 ? PASTEL.redBg : "transparent" }]}>
          <Text style={S.eqChipLabel}>FINES</Text>
          <Text style={[S.eqChipVal, { color: fines > 0 ? PASTEL.redFg : C.light }]}>{fines > 0 ? fmtPKR(fines) : "Rs 0"}</Text>
        </View>
        <View style={S.eqSignBox}><Text style={S.eqSign}>=</Text></View>
        <View style={[S.eqChip, { borderColor: C.text, borderWidth: 1.25 }]}>
          <Text style={S.eqChipLabel}>FINAL</Text>
          <Text style={[S.eqChipVal, { fontFamily: _fB }]}>{fmtPKR(net)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Model Card (Step 2) ──────────────────────────────────────────────────────
type CalcRow = {
  key: string;
  label: string;
  formula: string;
  amount: number;
};

function ModelCard({
  row,
  policies,
  basePercent,
  bonusPercent,
  di,
}: {
  row: IncentiveReportRow;
  policies: PolicyAchievementEntry[];
  basePercent: number;
  bonusPercent: number;
  di: DealerIncentiveBreakdown | null;
}) {
  const actPolicies = policies.filter(p => p.type === "activation-incentive" && p.modelName === row.modelName);
  const stockPolicy = policies.find(p => p.type === "stock-in" && p.modelName === row.modelName);

  const rows: CalcRow[] = [];

  if (row.priceSubperiods.length === 1) {
    const sp = row.priceSubperiods[0];
    if (sp.basePercentSubtotal > 0)
      rows.push({ key: "base-0", label: `Base ${basePercent}%`, formula: `${sp.qty} phones × ${fmtPKR(sp.dealerPrice)} each × ${basePercent}%`, amount: sp.basePercentSubtotal });
    if (sp.bonusPercentSubtotal > 0)
      rows.push({ key: "bonus-0", label: `Bonus ${bonusPercent}%`, formula: `${sp.qty} phones × ${fmtPKR(sp.dealerPrice)} each × ${bonusPercent}% (target reached)`, amount: sp.bonusPercentSubtotal });
  } else {
    row.priceSubperiods.forEach((sp, i) => {
      if (sp.basePercentSubtotal > 0)
        rows.push({ key: `base-${i}`, label: i === 0 ? `Base ${basePercent}%` : "", formula: `${sp.qty} phones when price was ${fmtPKR(sp.dealerPrice)} × ${basePercent}%`, amount: sp.basePercentSubtotal });
    });
    if (row.basePercentEarned > 0 && row.priceSubperiods.filter(s => s.basePercentSubtotal > 0).length > 1)
      rows.push({ key: "base-sub", label: "", formula: `Base ${basePercent}% all together`, amount: row.basePercentEarned });

    row.priceSubperiods.forEach((sp, i) => {
      if (sp.bonusPercentSubtotal > 0)
        rows.push({ key: `bonus-${i}`, label: i === 0 ? `Bonus ${bonusPercent}%` : "", formula: `${sp.qty} phones when price was ${fmtPKR(sp.dealerPrice)} × ${bonusPercent}%`, amount: sp.bonusPercentSubtotal });
    });
    if (row.bonusPercentEarned > 0 && row.priceSubperiods.filter(s => s.bonusPercentSubtotal > 0).length > 1)
      rows.push({ key: "bonus-sub", label: "", formula: `Bonus ${bonusPercent}% all together`, amount: row.bonusPercentEarned });
  }

  if (actPolicies.length > 0) {
    actPolicies.forEach((ap, i) => {
      const qty = ap.eligibleQty ?? ap.actualQty;
      const note = ap.targetQty != null ? ` (needed at least ${ap.targetQty}, you did ${qty})` : "";
      rows.push({ key: `act-${i}`, label: i === 0 ? "Activation Inc." : "", formula: `${qty} phones × ${fmtPKR(ap.perUnitAmount)} each${note}`, amount: ap.earned });
    });
  } else if (row.activationIncentiveEarned > 0) {
    rows.push({ key: "act", label: "Activation Inc.", formula: `${row.qtyActivated} phones × policy rate`, amount: row.activationIncentiveEarned });
  }

  if (row.stockInEarned > 0 || stockPolicy) {
    const rate = stockPolicy ? fmtPKR(stockPolicy.perUnitAmount) : "policy rate";
    const note = stockPolicy?.targetQty != null ? ` (needed at least ${stockPolicy.targetQty} purchased)` : "";
    // effectiveStockInQty is per-model-policy based; a model earning only via a
    // combined (grouped) policy has qty 0 here but a real amount — label it plainly.
    const formula = row.effectiveStockInQty > 0 || stockPolicy
      ? `${row.effectiveStockInQty} phones bought × ${rate} each${note}`
      : `combined stock-in policy (grouped target)`;
    rows.push({ key: "stock", label: "Stock-In", formula, amount: row.stockInEarned });
  }

  // Dealer Incentive — ONE whole-shop policy; this row is only this model's share of it.
  const diModel = di?.models.find(m => m.modelId === row.modelId);
  if (di && diModel && diModel.amount > 0) {
    const rate = diModel.perUnit > 0 ? fmtPKR(diModel.perUnit) : "policy rate";
    rows.push({ key: "dlr", label: "Dealer Inc.", formula: `${diModel.qty} phones × ${rate} each (whole-shop target: ${di.targetTotal} activations, all models together)`, amount: diModel.amount });
  }

  return (
    <View style={S.card} wrap={false}>
      <View style={S.cardHead}>
        <View>
          <Text style={S.cardModel}>{row.modelName}</Text>
          <Text style={S.cardMeta}>
            {row.qtyActivated} phone{row.qtyActivated !== 1 ? "s" : ""} activated
            {row.qtyActivatedCrossRegion > 0 ? `  ·  ${row.qtyActivatedCrossRegion} from another region` : ""}
            {row.stockInRegularQty > 0 ? `  ·  ${row.stockInRegularQty} purchased` : ""}
            {row.interIdOutQty > 0 ? `  ·  ${row.interIdOutQty} sent to another shop` : ""}
          </Text>
        </View>
        <View style={{ width: "22%", alignItems: "flex-end" }}>
          <Text style={S.cardTotLabel}>THIS MODEL EARNED</Text>
          <Text style={S.cardTotValue}>{fmtPKR(row.total)}</Text>
        </View>
      </View>

      {rows.map((cr) => (
        <View key={cr.key} style={S.calcRow}>
          <Text style={S.calcLabel}>{cr.label}</Text>
          <Text style={S.calcFormula}>{cr.formula}</Text>
          <Text style={S.calcAmount}>{cr.amount > 0 ? fmtPKR(cr.amount) : "—"}</Text>
        </View>
      ))}

      <View style={S.cardTotal}>
        <Text style={S.cardTotalLabel}>ADD THE ROWS ABOVE —</Text>
        <Text style={S.cardTotalValue}>{fmtPKR(row.total)}</Text>
      </View>
    </View>
  );
}

// ─── Policy Scoreboard (Step 3) ───────────────────────────────────────────────
function PolicyScoreboard({ policies, report }: { policies: PolicyAchievementEntry[]; report: IncentiveReport }) {
  const shown = policies.filter(p => !isZeroDealerIncentivePolicy(p));
  if (shown.length === 0) return null;
  const di = buildDealerIncentiveBreakdown(report);
  const diPolicy = shown.find(p => p.type === "dealer-incentive");
  const nonDi = shown.filter(p => p.type !== "dealer-incentive");
  const totalEarned = shown.filter(p => p.eligible).reduce((s, p) => s + p.earned, 0);

  return (
    <View>
      <View style={S.tbl}>
        <View style={S.tHead}>
          <Text style={[S.tHCell, { width: "18%" }]}>POLICY</Text>
          <Text style={[S.tHCell, { width: "16%" }]}>MODEL</Text>
          <Text style={[S.tHCell, { width: "15%" }]}>PERIOD</Text>
          <Text style={[S.tHCell, { width: "8%",  textAlign: "right" }]}>TARGET</Text>
          <Text style={[S.tHCell, { width: "12%", textAlign: "right" }]}>RATE / %</Text>
          <Text style={[S.tHCell, { width: "8%",  textAlign: "right" }]}>YOU DID</Text>
          <Text style={[S.tHCell, { width: "10%", textAlign: "center" }]}>RESULT</Text>
          <Text style={[S.tHCell, { width: "13%", textAlign: "right" }]}>EARNED</Text>
        </View>
        {nonDi.map((p, i) => {
          const short = !p.eligible && p.targetQty != null ? Math.max(0, p.targetQty - p.actualQty) : 0;
          return (
            <View key={i} style={S.tRow} wrap={false}>
              <View style={{ width: "18%", padding: "4.5 6" }}>
                <Text style={{ fontSize: 7.5, fontFamily: _fSB, color: C.text }}>{POLICY_LABEL[p.type]}</Text>
                {short > 0 && <Text style={{ fontSize: 6, color: PASTEL.redFg, marginTop: 1.5 }}>needed {short} more</Text>}
              </View>
              <Text style={[S.tCell, { width: "16%" }]}>{p.modelName ?? "All models"}</Text>
              <Text style={[S.tCell, { width: "15%", fontSize: 6.5, color: C.light }]}>{p.periodStart} → {p.periodEnd}</Text>
              <Text style={[S.tCell, { width: "8%",  textAlign: "right" }]}>{p.targetQty ?? "—"}</Text>
              <Text style={[S.tCell, { width: "12%", textAlign: "right" }]}>{p.type === "target-bonus" ? `${p.perUnitAmount}%` : fmtPKR(p.perUnitAmount)}</Text>
              <Text style={[S.tCell, { width: "8%",  textAlign: "right" }]}>{p.actualQty}</Text>
              <View style={{ width: "10%", padding: "4 4", alignItems: "center", justifyContent: "center" }}>
                <View style={[S.chip, { marginLeft: 0 }, p.eligible ? S.chipMet : S.chipNo]}>
                  <Text>{p.eligible ? "MET" : "MISSED"}</Text>
                </View>
              </View>
              <Text style={[S.tCellB, { width: "13%", textAlign: "right", color: p.eligible ? PASTEL.greenFg : C.light }]}>{p.earned > 0 ? fmtPKR(p.earned) : "—"}</Text>
            </View>
          );
        })}

        {/* Dealer Incentive — one whole-shop policy + split across activated models */}
        {di && diPolicy && (
          <>
            <View style={S.tRow} wrap={false}>
              <Text style={[S.tCellB, { width: "18%" }]}>{POLICY_LABEL["dealer-incentive"]}</Text>
              <Text style={[S.tCell,  { width: "16%" }]}>All models</Text>
              <Text style={[S.tCell,  { width: "15%", fontSize: 6.5, color: C.light }]}>{diPolicy.periodStart} → {diPolicy.periodEnd}</Text>
              <Text style={[S.tCell,  { width: "8%",  textAlign: "right" }]}>{di.targetTotal}</Text>
              <Text style={[S.tCell,  { width: "12%", textAlign: "right" }]}>{di.perUnit != null ? fmtPKR(di.perUnit) : "—"}</Text>
              <Text style={[S.tCell,  { width: "8%",  textAlign: "right" }]}>{di.actualTotal}</Text>
              <View style={{ width: "10%", padding: "4 4", alignItems: "center", justifyContent: "center" }}>
                <View style={[S.chip, { marginLeft: 0 }, di.eligible ? S.chipMet : S.chipNo]}>
                  <Text>{di.eligible ? "MET" : "MISSED"}</Text>
                </View>
              </View>
              <Text style={[S.tCellB, { width: "13%", textAlign: "right", color: di.eligible ? PASTEL.greenFg : C.light }]}>{fmtPKR(di.totalEarned)}</Text>
            </View>
            {di.eligible && di.models.map(mdl => (
              <View key={mdl.modelId} style={S.tRow} wrap={false}>
                <Text style={[S.tCell, { width: "18%" }]}></Text>
                <Text style={[S.tCell, { width: "16%", fontSize: 7, color: C.muted, paddingLeft: 10 }]}>{mdl.modelName}</Text>
                <Text style={[S.tCell, { width: "15%", fontSize: 6.5, color: C.light }]}>-</Text>
                <Text style={[S.tCell, { width: "8%",  fontSize: 7, color: C.light, textAlign: "right" }]}>-</Text>
                <Text style={[S.tCell, { width: "12%", fontSize: 7, color: C.muted, textAlign: "right" }]}>{mdl.perUnit ? fmtPKR(mdl.perUnit) : "—"}</Text>
                <Text style={[S.tCell, { width: "8%",  fontSize: 7, color: C.muted, textAlign: "right" }]}>{mdl.qty}</Text>
                <Text style={{ width: "10%" }}></Text>
                <Text style={[S.tCellB, { width: "13%", fontSize: 7, color: C.muted, textAlign: "right" }]}>{fmtPKR(mdl.amount)}</Text>
              </View>
            ))}
          </>
        )}
        <View style={S.tTot}>
          <Text style={[S.tTotCell, { width: "87%" }]}>POLICIES PAID YOU IN TOTAL</Text>
          <Text style={[S.tTotCell, { width: "13%", textAlign: "right" }]}>{fmtPKR(totalEarned)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Rebates (Step 4) ─────────────────────────────────────────────────────────
function RebatesSection({ rows, total }: { rows: RebateRow[]; total: number }) {
  return (
    <View style={S.tbl}>
      <View style={S.tHead}>
        <Text style={[S.tHCell, { width: "12%" }]}>DATE</Text>
        <Text style={[S.tHCell, { width: "24%" }]}>MODEL</Text>
        <Text style={[S.tHCell, { width: "44%" }]}>WHAT HAPPENED</Text>
        <Text style={[S.tHCell, { width: "20%", textAlign: "right" }]}>OPPO OWES YOU</Text>
      </View>
      {rows.map((r) => (
        <View key={r.id} style={S.tRow} wrap={false}>
          <Text style={[S.tCell, { width: "12%", fontSize: 6.5, color: C.light }]}>{r.rebateDate}</Text>
          <Text style={[S.tCellB, { width: "24%" }]}>{r.modelName}</Text>
          <Text style={[S.tCell, { width: "44%", color: C.muted }]}>
            Price dropped {fmtPKR(r.oldDealerPrice)} → {fmtPKR(r.newDealerPrice)}. You still had {r.eligibleQty} phone{r.eligibleQty !== 1 ? "s" : ""} bought at the old price, so OPPO pays back {fmtPKR(r.rebatePerUnit)} for each.
          </Text>
          <Text style={[S.tCellB, { width: "20%", textAlign: "right", color: PASTEL.blueFg }]}>+{fmtPKR(r.totalRebateAmount)}</Text>
        </View>
      ))}
      <View style={S.tTot}>
        <Text style={[S.tTotCell, { width: "80%" }]}>TOTAL MONEY BACK (REBATES)</Text>
        <Text style={[S.tTotCell, { width: "20%", textAlign: "right", color: PASTEL.blueFg }]}>+{fmtPKR(total)}</Text>
      </View>
    </View>
  );
}

// ─── Fines (Step 5) ───────────────────────────────────────────────────────────
function FinesSection({ rows, loss }: { rows: CrCaughtExportRow[]; loss: { totalUnits: number; lostIncentive: number; totalFines: number } }) {
  return (
    <View style={S.tbl}>
      <View style={S.tHead}>
        <Text style={[S.tHCell, { width: "12%" }]}>DATE</Text>
        <Text style={[S.tHCell, { width: "24%" }]}>MODEL</Text>
        <Text style={[S.tHCell, { width: "44%" }]}>WHAT HAPPENED</Text>
        <Text style={[S.tHCell, { width: "20%", textAlign: "right" }]}>TAKEN AWAY</Text>
      </View>
      {rows.map((r, idx) => (
        <View key={idx} style={S.tRow} wrap={false}>
          <Text style={[S.tCell, { width: "12%", fontSize: 6.5, color: C.light }]}>{r.caughtDate}</Text>
          <Text style={[S.tCellB, { width: "24%" }]}>{r.modelName}</Text>
          <Text style={[S.tCell, { width: "44%", color: C.muted }]}>
            {r.quantity} phone{r.quantity !== 1 ? "s" : ""} found sold outside your region{r.dealerPriceSnapshot > 0 ? ` (price then: ${fmtPKR(r.dealerPriceSnapshot)})` : ""}.
          </Text>
          <Text style={[S.tCellB, { width: "20%", textAlign: "right", color: PASTEL.redFg }]}>{r.fineAmount > 0 ? `−${fmtPKR(r.fineAmount)}` : "—"}</Text>
        </View>
      ))}
      <View style={S.tTot}>
        <Text style={[S.tTotCell, { width: "80%" }]}>TOTAL FINES DEDUCTED</Text>
        <Text style={[S.tTotCell, { width: "20%", textAlign: "right", color: PASTEL.redFg }]}>−{fmtPKR(loss.totalFines)}</Text>
      </View>
    </View>
  );
}

// ─── Final reconciliation — running balance (the self-check) ──────────────────
function Reconciliation({
  report, bonusPercent, rebateTotal, fines, net,
}: {
  report: IncentiveReport; bonusPercent: number; rebateTotal: number; fines: number; net: number;
}) {
  type Line = { what: string; why: string; amount: number; neg?: boolean };
  const items: Line[] = [
    { what: `Base Incentive ${report.baseIncentivePercent}%`, why: "Every phone activated earns this", amount: report.totals.basePercentEarned },
    { what: `Target Bonus ${bonusPercent}%`, why: "Extra reward for buying enough phones", amount: report.totals.bonusPercentEarned },
    { what: "Activation Incentive", why: "Extra money per phone on special models", amount: report.totals.activationIncentiveEarned },
    { what: "Dealer Incentive", why: "Reward for activating enough phones in total", amount: report.totals.dealerIncentiveEarned },
    { what: "Stock-In Incentive", why: "Reward for purchasing stock", amount: report.totals.stockInEarned },
  ].filter(l => l.amount > 0);
  if (rebateTotal > 0) items.push({ what: "Price-Drop Rebates", why: "Money back because prices fell on stock you held", amount: rebateTotal });
  if (fines > 0) items.push({ what: "CR Caught Fines", why: "Penalty for phones sold outside your region", amount: fines, neg: true });

  let running = 0;
  return (
    <View style={S.tbl}>
      <View style={S.tHead}>
        <Text style={[S.tHCell, { width: "6%" }]}>#</Text>
        <Text style={[S.tHCell, { width: "26%" }]}>WHAT</Text>
        <Text style={[S.tHCell, { width: "34%" }]}>WHY YOU GET IT</Text>
        <Text style={[S.tHCell, { width: "16%", textAlign: "right" }]}>AMOUNT</Text>
        <Text style={[S.tHCell, { width: "18%", textAlign: "right" }]}>RUNNING TOTAL</Text>
      </View>
      {items.map((l, i) => {
        running = l.neg ? running - l.amount : running + l.amount;
        return (
          <View key={i} style={S.tRow} wrap={false}>
            <Text style={[S.tCell, { width: "6%", color: C.light }]}>{i + 1}</Text>
            <Text style={[S.tCellB, { width: "26%", color: l.neg ? PASTEL.redFg : C.text }]}>{l.what}</Text>
            <Text style={[S.tCell, { width: "34%", color: C.muted, fontSize: 7 }]}>{l.why}</Text>
            <Text style={[S.tCellB, { width: "16%", textAlign: "right", color: l.neg ? PASTEL.redFg : C.text }]}>
              {l.neg ? `−${fmtPKR(l.amount)}` : `+${fmtPKR(l.amount)}`}
            </Text>
            <Text style={[S.tCellB, { width: "18%", textAlign: "right", color: C.muted }]}>{fmtPKR(running)}</Text>
          </View>
        );
      })}
      <View style={S.tTot}>
        <Text style={[S.tTotCell, { width: "66%" }]}>FINAL — NET RECEIVABLE FROM OPPO</Text>
        <Text style={[S.tTotCell, { width: "34%", textAlign: "right" }]}>{fmtPKR(net)}</Text>
      </View>
    </View>
  );
}

// ─── Hidden insights (last page) ──────────────────────────────────────────────
function InsightHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <View style={S.stepHead} wrap={false}>
        <Text style={S.stepTitle}>{title}</Text>
        <View style={S.stepLine} />
      </View>
      {hint ? <Text style={[S.stepHint, { marginLeft: 0 }]}>{hint}</Text> : <View style={{ height: 4 }} />}
    </>
  );
}

function InsRow({ label, detail, value, color }: { label: string; detail: string; value: string; color?: string }) {
  return (
    <View style={S.tRow} wrap={false}>
      <Text style={[S.tCellB, { width: "32%" }]}>{label}</Text>
      <Text style={[S.tCell, { width: "46%", color: C.muted, fontSize: 7 }]}>{detail}</Text>
      <Text style={[S.tCellB, { width: "22%", textAlign: "right", color: color ?? C.text }]}>{value}</Text>
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
    /** Live remaining stock of this ID (purchases − activations − transfers out − CR caught). */
    inventory?: StockRow[];
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
  const fines = crCaughtLoss?.totalFines ?? 0;
  const netReceivable = report.totals.grandTotal + rebateTotal - fines;
  const shownPolicies = policies.filter(p => !isZeroDealerIncentivePolicy(p));
  const metCount = shownPolicies.filter(p => p.eligible).length;
  const di = buildDealerIncentiveBreakdown(report);

  // ── Hidden-insights stats (last page) ──
  const latestPrice = (r: IncentiveReportRow) => r.priceSubperiods[r.priceSubperiods.length - 1]?.dealerPrice ?? 0;
  const activeRows = report.rows.filter(r => r.qtyActivated > 0).sort((a, b) => b.qtyActivated - a.qtyActivated);
  const topModel = activeRows[0] ?? null;
  const lowModel = activeRows.length > 1 ? activeRows[activeRows.length - 1] : null;
  const crInUnits = report.totalCrossRegionPurchaseQty;
  const crInProfit = Math.round(report.rows.reduce((s, r) => s + r.stockInCrossRegionQty * latestPrice(r) * 0.05, 0));
  const crOutUnits = crCaughtLoss?.totalUnits ?? crCaughtRows.reduce((s, r) => s + r.quantity, 0);
  const crOutValue = Math.round(crCaughtRows.reduce((s, r) => s + r.quantity * r.dealerPriceSnapshot * 0.05, 0));
  const crNet = crInProfit - crOutValue - fines;
  const interOutUnits = report.rows.reduce((s, r) => s + r.interIdOutQty, 0);
  const topEarner = activeRows.length > 0 ? [...activeRows].sort((a, b) => b.total - a.total)[0] : null;
  const perActivation = report.totalActivations > 0 ? Math.round(netReceivable / report.totalActivations) : 0;
  const missedCount = shownPolicies.length - metCount;
  const hitRate = shownPolicies.length > 0 ? Math.round((metCount / shownPolicies.length) * 100) : null;
  const inventory = (opts?.inventory ?? []).slice().sort((a, b) => b.quantity - a.quantity);
  const invUnits = inventory.reduce((s, r) => s + r.quantity, 0);
  const invValue = inventory.reduce((s, r) => s + r.quantity * (r.dealerPrice ?? 0), 0);
  const activatedIds = new Set(activeRows.map(r => r.modelId));
  const deadStock = inventory.filter(r => !activatedIds.has(r.modelId));
  const monthsCover = report.totalActivations > 0 && invUnits > 0 ? Math.round((invUnits / report.totalActivations) * 10) / 10 : null;

  let step = 0;
  const next = () => ++step;

  const doc = (
    <Document>
      <Page size="A4" style={S.page}>
        <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

        {/* How to read this */}
        <View style={S.intro}>
          <Text style={S.introText}>
            This report explains every rupee OPPO owes you for this period — step by step, in plain words.
            Start with the final answer below, then follow the numbered steps to see exactly where each amount
            comes from. The last table adds everything line by line; its final figure must match the answer at the top.
          </Text>
        </View>

        {/* THE ANSWER */}
        <TheAnswer
          gross={report.totals.grandTotal}
          rebates={rebateTotal}
          fines={fines}
          net={netReceivable}
          dealerName={dealerName}
          ps={report.periodStart}
          pe={report.periodEnd}
        />

        {/* STEP 1 — period at a glance */}
        <StepHead n={next()} title="What happened this period" hint="The raw activity all the money below is built from." />
        <View style={S.tiles}>
          <View style={S.tile}>
            <Text style={S.tileLabel}>PHONES ACTIVATED</Text>
            <Text style={S.tileVal}>{report.totalActivations}</Text>
            <Text style={S.tileSub}>{report.totalActivationsCrossRegion > 0 ? `${report.totalActivationsCrossRegion} from another region` : "all in your own region"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>MODELS THAT EARNED</Text>
            <Text style={S.tileVal}>{rows.length}</Text>
            <Text style={S.tileSub}>of {report.rows.length} models you carry</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>PHONES PURCHASED</Text>
            <Text style={S.tileVal}>{tb.actualQty}</Text>
            <Text style={S.tileSub}>target was {tb.targetQty ?? "—"} — {tb.eligible ? "reached, bonus unlocked" : "not reached, no bonus"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>POLICIES MET</Text>
            <Text style={S.tileVal}>{metCount} / {shownPolicies.length}</Text>
            <Text style={S.tileSub}>{shownPolicies.length - metCount > 0 ? `${shownPolicies.length - metCount} missed — see Step 3` : shownPolicies.length > 0 ? "every policy achieved" : "no policies this period"}</Text>
          </View>
        </View>

        {/* STEP 2 — model by model */}
        <StepHead n={next()} title="Money earned, model by model" hint="Each card shows one phone model. Every row inside is a simple multiplication; the rows add up to the model total on the right." />
        {rows.map(r => (
          <ModelCard
            key={r.modelId}
            row={r}
            policies={policies}
            basePercent={report.baseIncentivePercent}
            bonusPercent={bonusPercent}
            di={di}
          />
        ))}
        {rows.length === 0 && (
          <View style={{ padding: 14, borderWidth: 0.75, borderColor: C.border, borderRadius: 6 }}>
            <Text style={{ textAlign: "center", fontSize: 8.5, color: C.muted }}>No phones were activated in this period, so no model earned incentive.</Text>
          </View>
        )}

        {/* STEP 3 — policy scoreboard */}
        {shownPolicies.length > 0 && (
          <>
            <StepHead n={next()} title="Policy scoreboard — what you hit and what you missed" hint="Every policy OPPO gave you, with its target, what you actually did, and what it paid. MISSED rows show how many more you needed." />
            <PolicyScoreboard policies={policies} report={report} />
          </>
        )}

        {/* STEP 4 — rebates */}
        {rebateRows.length > 0 && (
          <>
            <StepHead n={next()} title="Money back — price-drop rebates" hint="When OPPO lowers a price, you get back the difference for phones you already bought at the old, higher price." />
            <RebatesSection rows={rebateRows} total={rebateTotal} />
          </>
        )}

        {/* STEP 5 — fines */}
        {(crCaughtLoss?.totalUnits ?? 0) > 0 && crCaughtRows.length > 0 && (
          <>
            <StepHead n={next()} title="Money taken away — cross-region fines" hint="Phones caught being sold outside your region carry a cash penalty. These amounts are subtracted from your payout." />
            <FinesSection rows={crCaughtRows} loss={crCaughtLoss!} />
            {crCaughtLoss!.lostIncentive > 0 && (
              <Text style={[S.stepHint, { marginTop: 5 }]}>
                Note: on top of the fines, about {fmtPKR(crCaughtLoss!.lostIncentive)} of incentive was lost because these phones do not earn stock-in rewards.
              </Text>
            )}
          </>
        )}

        {/* FINAL — reconcile it yourself */}
        <StepHead n={next()} title="Add it all up — reconcile it yourself" hint="Start at zero. Add every plus, subtract every minus, and watch the running total. The last line must equal the final answer at the top of this report." />
        <Reconciliation
          report={report}
          bonusPercent={bonusPercent}
          rebateTotal={rebateTotal}
          fines={fines}
          net={netReceivable}
        />

        <View style={S.checkBox} wrap={false}>
          <Text style={S.checkText}>
            Self-check: the FINAL line above should read exactly {fmtPKR(netReceivable)} — the same number shown in
            "The Final Answer" on page 1. If both match, this report is fully reconciled.
          </Text>
          <View style={[S.chip, { marginLeft: 0 }, S.chipMet]}>
            <Text>RECONCILED</Text>
          </View>
        </View>

        {report.totalActivationsCrossRegion > 0 && (
          <Text style={[S.stepHint, { marginTop: 8, marginLeft: 0 }]}>
            Cross-region note: {report.totalActivationsCrossRegion} activation{report.totalActivationsCrossRegion !== 1 ? "s were" : " was"} from another region.
            They still earn base %, bonus %, activation and dealer incentive — but never stock-in rewards.
          </Text>
        )}

        <View style={S.footerBar}>
          <Text style={S.footerText}>OPPO Pakistan  ·  Detailed Incentive Breakup  ·  Confidential</Text>
          <Text style={S.footerText}>Generated: {today()}</Text>
        </View>
      </Page>

      {/* LAST PAGE — hidden insights for future decisions */}
      <Page size="A4" style={S.page}>
        <DocHeader dealerName={dealerName} periodStart={report.periodStart} periodEnd={report.periodEnd} />

        {/* Editorial opening */}
        <View style={S.insOpen} wrap={false}>
          <Text style={S.insEyebrow}>ONE LAST PAGE — THE HIDDEN PICTURE</Text>
          <Text style={S.insTitle}>What this month is telling you</Text>
          <Text style={S.insSub}>
            The same numbers, read for decisions: what moved, what sat still, what cross-region really
            cost, and what is still sitting on your shelf.
          </Text>
        </View>

        {/* Movers — two editorial cards */}
        <View style={[S.tiles, { marginTop: 14 }]}>
          <View style={S.bigCard}>
            <View style={S.bigCardTop}>
              <Text style={S.bigCardLbl}>TOP SELLING MODEL</Text>
              {topModel && <Text style={[S.tagPill, { backgroundColor: PASTEL.greenBg, color: PASTEL.greenFg }]}>BEST MOVER</Text>}
            </View>
            <Text style={S.bigCardName}>{topModel ? topModel.modelName : "No sales yet"}</Text>
            <Text style={S.bigCardSub}>
              {topModel
                ? `${topModel.qtyActivated} activation${topModel.qtyActivated !== 1 ? "s" : ""} this period  ·  earned ${fmtPKR(topModel.total)}`
                : "no phone was activated in this period"}
            </Text>
          </View>
          <View style={S.bigCard}>
            <View style={S.bigCardTop}>
              <Text style={S.bigCardLbl}>LOWEST SELLING MODEL</Text>
              {lowModel && <Text style={[S.tagPill, { backgroundColor: PASTEL.yellowBg, color: PASTEL.yellowFg }]}>WATCH</Text>}
            </View>
            <Text style={S.bigCardName}>{lowModel ? lowModel.modelName : "—"}</Text>
            <Text style={S.bigCardSub}>
              {lowModel
                ? `only ${lowModel.qtyActivated} activation${lowModel.qtyActivated !== 1 ? "s" : ""}  ·  think before re-ordering this one`
                : "only one model sold this period — nothing to compare"}
            </Text>
          </View>
        </View>

        {/* Pulse — four quiet stats */}
        <View style={[S.tiles, { marginTop: 8 }]}>
          <View style={S.tile}>
            <Text style={S.tileLabel}>TOTAL ACTIVATIONS</Text>
            <Text style={S.tileVal}>{report.totalActivations}</Text>
            <Text style={S.tileSub}>{report.totalActivationsCrossRegion > 0 ? `${report.totalActivationsCrossRegion} from another region` : "all in your own region"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>MODELS ACTIVATED</Text>
            <Text style={S.tileVal}>{activeRows.length}</Text>
            <Text style={S.tileSub}>of {report.rows.length} models you carry</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>PHONES PURCHASED</Text>
            <Text style={S.tileVal}>{report.totalRegularPurchaseQty}</Text>
            <Text style={S.tileSub}>regular stock-in this period</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>WORTH PER ACTIVATION</Text>
            <Text style={S.tileVal}>{report.totalActivations > 0 ? fmtPKR(perActivation) : "—"}</Text>
            <Text style={S.tileSub}>net receivable ÷ activations</Text>
          </View>
        </View>

        {/* Remaining inventory of this ID */}
        <InsightHead
          title="Still on the shelf — remaining inventory"
          hint="Live stock of this ID right now: everything purchased, minus activated, minus sent to other shops, minus CR caught."
        />
        {inventory.length > 0 ? (
          <>
            <View style={S.tbl}>
              <View style={S.tHead}>
                <Text style={[S.tHCell, { width: "34%" }]}>MODEL</Text>
                <Text style={[S.tHCell, { width: "16%", textAlign: "right" }]}>IN STOCK</Text>
                <Text style={[S.tHCell, { width: "24%", textAlign: "right" }]}>DEALER PRICE</Text>
                <Text style={[S.tHCell, { width: "26%", textAlign: "right" }]}>VALUE ON SHELF</Text>
              </View>
              {inventory.map((r) => (
                <View key={r.modelId} style={S.tRow} wrap={false}>
                  <Text style={[S.tCellB, { width: "34%" }]}>{r.modelName}</Text>
                  <Text style={[S.tCell, { width: "16%", textAlign: "right" }]}>{r.quantity}</Text>
                  <Text style={[S.tCell, { width: "24%", textAlign: "right", color: C.muted }]}>{r.dealerPrice != null ? fmtPKR(r.dealerPrice) : "—"}</Text>
                  <Text style={[S.tCellB, { width: "26%", textAlign: "right" }]}>{r.dealerPrice != null ? fmtPKR(r.quantity * r.dealerPrice) : "—"}</Text>
                </View>
              ))}
              <View style={S.tTot}>
                <Text style={[S.tTotCell, { width: "34%" }]}>TOTAL</Text>
                <Text style={[S.tTotCell, { width: "16%", textAlign: "right" }]}>{invUnits}</Text>
                <Text style={[S.tTotCell, { width: "50%", textAlign: "right" }]}>{fmtPKR(invValue)}</Text>
              </View>
            </View>
            <Text style={S.insNote}>
              {monthsCover != null ? `At this period's speed (${report.totalActivations} activations), this stock is roughly ${monthsCover} period${monthsCover !== 1 ? "s" : ""} of sales. ` : ""}
              {deadStock.length > 0 ? `${deadStock.length} model${deadStock.length !== 1 ? "s" : ""} (${deadStock.slice(0, 3).map(d => d.modelName).join(", ")}${deadStock.length > 3 ? "…" : ""}) ${deadStock.length !== 1 ? "are" : "is"} sitting in stock with zero activations this period.` : ""}
            </Text>
          </>
        ) : (
          <View style={{ padding: 12, borderWidth: 0.75, borderColor: C.border, borderRadius: 6 }}>
            <Text style={{ textAlign: "center", fontSize: 8, color: C.muted }}>Shelf is empty — every phone bought has been sold or moved on.</Text>
          </View>
        )}

        {/* Cross-region position */}
        <InsightHead title="Cross-region position" hint="Inward brings margin; outward costs margin and may bring fines." />
        <View style={[S.tiles, { marginBottom: 8 }]}>
          <View style={S.tile}>
            <Text style={S.tileLabel}>INWARD CR</Text>
            <Text style={S.tileVal}>{crInUnits > 0 ? crInUnits : "—"}</Text>
            <Text style={S.tileSub}>{crInProfit > 0 ? `+${fmtPKR(crInProfit)} est. margin` : "no inward CR"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>OUTWARD CR</Text>
            <Text style={[S.tileVal, { color: crOutUnits > 0 ? PASTEL.redFg : C.text }]}>{crOutUnits > 0 ? crOutUnits : "—"}</Text>
            <Text style={S.tileSub}>{crOutValue > 0 ? `−${fmtPKR(crOutValue)} margin lost` : "none caught"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>FINES CHARGED</Text>
            <Text style={[S.tileVal, { color: fines > 0 ? PASTEL.redFg : C.text, fontSize: 11 }]}>{fines > 0 ? fmtPKR(fines) : "Rs 0"}</Text>
            <Text style={S.tileSub}>{fines > 0 ? "deducted from payout" : "no penalty this period"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>NET CR POSITION</Text>
            <Text style={[S.tileVal, { color: crNet < 0 ? PASTEL.redFg : crNet > 0 ? PASTEL.greenFg : C.text, fontSize: 11 }]}>{crNet === 0 ? "Rs 0" : `${crNet > 0 ? "+" : "−"}${fmtPKR(Math.abs(crNet))}`}</Text>
            <Text style={S.tileSub}>inward margin minus costs</Text>
          </View>
        </View>

        {/* Policies & money signals */}
        <InsightHead title="Policies & money signals" hint="Every hit is money collected; every miss is money OPPO kept." />
        <View style={[S.tiles, { marginBottom: 8 }]}>
          <View style={S.tile}>
            <Text style={S.tileLabel}>POLICIES MET</Text>
            <Text style={[S.tileVal, { color: metCount > 0 ? PASTEL.greenFg : C.text }]}>{metCount}</Text>
            <Text style={S.tileSub}>of {shownPolicies.length} total{hitRate != null ? `  ·  ${hitRate}% rate` : ""}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>POLICIES MISSED</Text>
            <Text style={[S.tileVal, { color: missedCount > 0 ? PASTEL.redFg : C.text }]}>{missedCount > 0 ? missedCount : "—"}</Text>
            <Text style={S.tileSub}>{missedCount > 0 ? "see scoreboard on page 1" : "every policy achieved"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>REBATES EARNED</Text>
            <Text style={[S.tileVal, { color: rebateTotal > 0 ? PASTEL.blueFg : C.text, fontSize: 11 }]}>{rebateTotal > 0 ? fmtPKR(rebateTotal) : "Rs 0"}</Text>
            <Text style={S.tileSub}>{rebateTotal > 0 ? "price-drop money back" : "no rebates this period"}</Text>
          </View>
          <View style={S.tile}>
            <Text style={S.tileLabel}>SENT TO OTHER SHOPS</Text>
            <Text style={S.tileVal}>{interOutUnits > 0 ? interOutUnits : "—"}</Text>
            <Text style={S.tileSub}>{interOutUnits > 0 ? `${interOutUnits} unit${interOutUnits !== 1 ? "s" : ""} inter-ID` : "no transfers out"}</Text>
          </View>
        </View>

        <View style={S.footerBar}>
          <Text style={S.footerText}>OPPO Pakistan  ·  Detailed Incentive Breakup  ·  Hidden Insights  ·  Confidential</Text>
          <Text style={S.footerText}>Generated: {today()}</Text>
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
