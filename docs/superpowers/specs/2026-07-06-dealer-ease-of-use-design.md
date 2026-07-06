# Dealer Portal — Ease-of-Use Pass (Design Spec)

- **Date:** 2026-07-06
- **Status:** Approved (brainstorming) → ready for implementation plan
- **Owner goal:** "A 12-year-old should open the app and understand everything on their own."
- **Sub-project:** 1 of 3 (this) → 2) Dashboard animations & polish → 3) Bilingual (EN + Urdu) user manual. This spec covers sub-project 1 only.

## 1. Background

The dealer portal (`app/dealer/(portal)/`) is already visually polished (minimalist "Apple-shell" theme, ring metric cards, Recharts trend, KPI cards). The gap is **comprehension**: labels use financial jargon ("Net receivable", "Sell-through", "CR exposure", "Aged stock", "Stock-In Incentive") that a typical dealer — or a child — cannot parse. This sub-project makes the app self-explanatory **without changing any financial logic**.

Interface language stays **English but simplified** (owner decision). Urdu is deferred to the separate manual (sub-project 3).

## 2. Goals / Non-goals

**Goals**
1. Replace jargon with plain English on the 6 core dealer screens, with in-context "?" help.
2. A first-login **guided tour** that highlights real elements step-by-step (replayable).
3. An in-app **Help page** so a dealer can self-serve answers.
4. A **single source of truth** for all help text, reusable by tooltips, the Help page, and later the bilingual manual.

**Non-goals (explicitly out of scope)**
- No changes to any calculation, DB query, or financial value — display strings and new UI only.
- No changes to Owner / Accountant / Staff / Admin portals — dealer portal only.
- No database schema changes (tour-seen flag lives in `localStorage`).
- No Urdu in the interface (manual only, later).
- Empty-state guidance and friendly-confirmation rewrites are deferred (can be added later).

## 3. Scope

**Simplify + tooltips on 6 core screens (phase 1):**
Dashboard, Add Activation, Add Purchase, Inventory, Reports, Cross-region.
Remaining ~9 dealer screens are phase 2 (later), not this spec.

**Whole-app pieces:** guided tour + Help page + top-bar "?" reach every screen.

## 4. Architecture

### 4.1 Help content registry (single source of truth)
`lib/dealer/help-content.ts`

```ts
export type HelpTopic = "Money" | "Stock" | "Activations" | "Cross-region" | "Reports";

export interface HelpTerm {
  id: string;        // stable key, e.g. "net-receivable"
  label: string;     // simple on-screen label, e.g. "Your net payout"
  short: string;     // one-line plain explanation (tooltip)
  long?: string;     // fuller explanation (Help page)
  topic: HelpTopic;  // grouping for the Help page
}

export const HELP: Record<string, HelpTerm> = { /* … */ };
export function getHelp(id: string): HelpTerm | undefined { return HELP[id]; }
```

This one file feeds: (a) `<HelpTip>` tooltips, (b) the Help page, (c) — later — the EN/Urdu manual. No duplicated copy, no drift.

### 4.2 `<HelpTip>` component
`components/dealer/help-tip.tsx` (client)

- Props: `{ term: string; className?: string }`.
- Renders a small `Info`/`HelpCircle` (lucide) icon button.
- On **tap/click** opens a popover with the term's `short` text + an "Learn more" link to `/dealer/help#<topic>`.
- **Mobile-first:** use a click/tap popover (base-ui/shadcn Popover), NOT hover-only tooltip, so it works on touch.
- Accessibility: `aria-label` from label, keyboard-openable, dismiss on outside-click/Esc.
- **Safe fail:** unknown `term` → render nothing (dev-only `console.warn`).

### 4.3 Guided tour (driver.js)
- New dependency: **`driver.js`** (~5kb, bundled by Next — no external network, Capacitor/CSP safe).
- `lib/dealer/tour-steps.ts` — ordered array: `{ target: string /* [data-tour="…"] */, title: string, description: string }`.
- `components/dealer/dealer-tour.tsx` (client) — runs driver.js; mounted in the dealer layout.
- **Targets:** real elements tagged with `data-tour="net-payout" | "earnings-chart" | "quick-actions" | "main-nav" | "help-button"`. The nav tag is applied to BOTH the desktop sidebar and mobile bottom-nav so whichever is visible gets highlighted.
- **First-run trigger:** on mount, if `localStorage["dealer_tour_v1_done"]` is unset → start tour → set flag on finish/skip.
- **Replay:** a "Replay guided tour" button on the Help page (and the top-bar "?" can offer it) clears/reruns regardless of flag.
- **Graceful skip:** filter steps whose target element is absent (feature-gated off / different screen) before starting; driver.js skips missing targets.
- Steps (~7): Welcome → Your net payout → Earnings graph → Add buttons → Menu → Help "?" → Done.

### 4.4 Help page
`app/dealer/(portal)/help/page.tsx` — route `/dealer/help`, title "Help".

- Header: one-line intro + **"Replay guided tour"** button.
- Body: sections grouped by `HelpTopic`; each term shows `label` + `long` (fallback `short`).
- **FAQ** block: 5–6 common questions (e.g., "How is my net payout calculated?", "What is at-risk amount?", "Why did my stock drop?").
- Respects feature-gating: hide entries for features the dealer doesn't have.

### 4.5 Navigation placement
- Add **"Help"** link to `DealerSidebar` (desktop).
- Add a persistent **"?" icon** in `DealerTopBar` (reachable from every screen; also serves mobile since bottom-nav is full).
- Do **not** add Help to `DealerBottomNav` (space-constrained).

### 4.6 Relabeling (display strings only)
Swap jargon → simple English and attach `<HelpTip>` on key terms. Dashboard starter set:

| Current | New |
|---|---|
| Net receivable | Your net payout |
| Incentive earned | Bonus earned |
| Target gap | Units left to target |
| CR exposure | At-risk amount |
| Aged stock | Old stock (30+ days) |
| Sell-through | Sold vs stock |
| Stock value on hand | Stock value |
| Stock-In Incentive | Stock bonus |
| Activation Incentive | Activation bonus |
| Dealer Incentive | Dealer bonus |
| Price-drop Rebate | Price-drop refund |
| CR / Fines / Deductions | Fines & deductions |
| Gross receivable | Total before fines |

The other 5 screens' terms are catalogued into `HELP` during implementation using the same pattern.

## 5. Data flow

Static content only. `HELP` and `tour-steps` are compile-time constants imported by client components. No new server queries, no new API routes, no DB reads/writes. Tour state is a single `localStorage` boolean.

## 6. Error handling & edge cases

- `<HelpTip term="…">` with missing id → renders nothing (safe), warns in dev.
- Tour target element not in DOM → that step is filtered/skipped; tour never crashes.
- Feature-gated-off feature → no tooltip, no tour step, no help entry shown.
- `prefers-reduced-motion` respected by driver.js config; tour always skippable.
- `localStorage` unavailable (rare) → tour simply always/never runs; no crash.

## 7. Safety (financial-accuracy & multi-tenant guarantees)

- Zero changes to `lib/incentive-engine/`, `lib/db/queries/*`, schema, or any calculation.
- Dealer portal files only; no owner/accountant/admin/staff files touched.
- Role checks and tenant scoping untouched.

## 8. Testing / verification

- **Unit (vitest):** registry integrity — every `HELP` entry has `label`, `short`, `topic`; every `tour-steps` target is a known `data-tour` value.
- **Real run:** dealer login → first-login tour fires once → tooltips open on tap/click (same interaction on mobile and desktop — no hover dependency) → Help page renders all topics + FAQ + replay works → 6 relabeled screens read clearly.
- **Capacitor:** verify tour + popovers on the Android build (touch targets, bottom-nav highlight).

## 9. New dependency

- `driver.js` (guided tour). Nothing else.

## 10. Files (create / modify)

**Create**
- `lib/dealer/help-content.ts`
- `lib/dealer/tour-steps.ts`
- `components/dealer/help-tip.tsx`
- `components/dealer/dealer-tour.tsx`
- `app/dealer/(portal)/help/page.tsx`
- `lib/dealer/__tests__/help-content.test.ts`

**Modify**
- 6 core screen components (labels + `<HelpTip>` + `data-tour` attrs)
- `app/dealer/(portal)/layout.tsx` (mount `<DealerTour />`)
- `components/dealer/dealer-sidebar.tsx` (Help link)
- `components/dealer/dealer-top-bar.tsx` ("?" button)
- `package.json` (`driver.js`)

## 11. Future / follow-ups (not this spec)

- Phase 2: extend simple-words + tooltips to remaining dealer screens.
- Optionally promote tour-seen flag from `localStorage` to a per-dealer DB preference.
- Sub-project 2: dashboard animations & transitions (framer-motion — already installed).
- Sub-project 3: bilingual (EN + Urdu) user manual, sourced from `HELP`.
