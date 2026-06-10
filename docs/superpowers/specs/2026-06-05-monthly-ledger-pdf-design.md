# Monthly Ledger PDF + Dual-Theme System — Design Spec
_2026-06-05_

## Scope
1. **Dual-theme system** — Arctic Minimal (B) and Naval Elevated (C) — applied to all existing PDF reports and the new ledger.
2. **Monthly Ledger PDF** (`buildLedgerPDF`) — dealer-facing monthly financial statement.

---

## Theme System

**File:** `lib/export/pdf-themes.ts`

Two presets share one `PdfTheme` type. All color-bearing styles in PDF builders are driven by theme tokens.

| Token | Naval | Arctic |
|---|---|---|
| `headerBg` | `#0B1629` | `#FFFFFF` |
| `headerFg` | `#FFFFFF` | `#111827` |
| `headerSub` | `#93C5FD` | `#9CA3AF` |
| `accent` | `#2563EB` | `#111827` |
| `kpiBg` | `#EFF6FF` | `#F9FAFB` |
| `kpiBdr` | `#BFDBFE` | `#E5E7EB` |
| `kpiLabel` | `#1E40AF` | `#6B7280` |
| `grandBg` | `#1E3A5F` | `#111827` |
| `grandFg` | `#FFFFFF` | `#FFFFFF` |
| `grandSub` | `#93C5FD` | `#9CA3AF` |
| `tHeadBg` | `#1E293B` | `#111827` |
| `green` | `#15803D` | `#15803D` |
| `red` | `#B91C1C` | `#C00000` |

**Integration:** Each builder gets `theme: PdfTheme = NAVAL` as last parameter. Module-level `let C` and `let S` are reassigned at the start of each builder call — safe in Node.js single-threaded context.

**UI:** Theme toggle pill (Arctic / Naval) next to each PDF download button. Appends `&theme=arctic` or `&theme=naval` to the API URL.

---

## Monthly Ledger PDF

**File:** `lib/export/report-pdf-ledger.tsx`
**Format key:** `ledger-pdf`

### Page 1 — Summary
- Themed header band (dealer name, period)
- Hero box: NET RECEIVABLE (dominant)
- KPI strip: Total Activations | Gross Incentive | +Rebates | −Fines
- Financial waterfall (Gross → +Rebates → −Fines → Net)
- Model summary table: Model | Activations | Gross | Rebates | Net

### Page 2+ — Model Transaction Log
Per model block:
- Model header bar (name, activation count, model total)
- Calc rows: Base %, Bonus %, Activation Inc., Stock-In, Dealer Inc., Rebates, Fines
- Model subtotal bar
- Footer: dealer · period · page N of T · CONFIDENTIAL

### Data shape
```typescript
buildLedgerPDF(
  report: IncentiveReport,
  dealerName: string,
  policies: PolicyAchievementEntry[],
  rebateRows: RebateRow[],
  crCaughtRows: CrCaughtExportRow[],
  crCaughtLoss: { totalFines: number },
  rebateTotal: number,
  theme: PdfTheme
): Promise<Buffer>
```

Reuses existing data already fetched for `analytics-pdf` — no new DB queries.

---

## API Changes

`GET /api/report` gains `theme` query param (`arctic` | `naval`, default `naval`).
New `fmt === "ledger-pdf"` branch mirrors `analytics-pdf` data fetching.

## UI Changes

`reports-client.tsx`: `exportLink` passes `&theme=${activeTheme}`. Download dropdown gains a theme toggle above the PDF section. New "Monthly Ledger" item in PDF group.
