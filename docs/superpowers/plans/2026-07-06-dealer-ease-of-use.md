# Dealer Portal Ease-of-Use Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dealer portal self-explanatory — plain-language labels with in-context "?" help, a first-login guided tour, and an in-app Help page — without changing any financial logic.

**Architecture:** One typed help-content registry (`lib/dealer/help-content.ts`) is the single source of truth, consumed by a reusable `<HelpTip>` popover, a new `/dealer/help` page, and (later) the bilingual manual. A `driver.js` guided tour highlights real elements tagged with `data-tour` attributes; a `localStorage` flag makes it run once. All changes are display strings + new client components.

**Tech Stack:** Next.js App Router v16 · TypeScript · Tailwind v4 · base-ui/react (Popover) · lucide-react · driver.js (new) · vitest (node env).

## Global Constraints

- **Zero financial change:** no edits to `lib/incentive-engine/`, `lib/db/`, any query, or any calculation. Display strings + new UI only.
- **Dealer portal only:** touch only `app/dealer/`, `components/dealer/`, `lib/dealer/`, `components/ui/` additions. No owner/accountant/admin/staff files.
- **No DB schema change.** Tour-seen state lives in `localStorage` key `dealer_tour_v1_done`.
- **Interface stays English** (simplified). No Urdu in UI.
- **Feature-gating respected:** never show a tooltip/tour-step/help-entry for a feature the dealer lacks. Gate helper: `isFeatureEnabled(features, key)` from `@/lib/dealer-features`.
- **Capacitor/mobile safe:** tooltips must open on tap/click (not hover-only); tour must work with the mobile bottom-nav.
- **Tests:** vitest, node environment, files matching `lib/**/*.test.ts`. Import `{ describe, expect, it } from "vitest"` (globals are off).
- **Branch:** `feat/dealer-ease-of-use`. Commit after every task.

---

### Task 1: Help-content registry

**Files:**
- Create: `lib/dealer/help-content.ts`
- Test: `lib/dealer/help-content.test.ts`

**Interfaces:**
- Produces: `HelpTopic` (union), `HelpTerm { id; label; short; long?; topic }`, `HELP: Record<string, HelpTerm>`, `getHelp(id: string): HelpTerm | undefined`, `topicId(topic: HelpTopic): string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/dealer/help-content.test.ts
import { describe, expect, it } from "vitest";
import { HELP, getHelp, topicId } from "@/lib/dealer/help-content";

describe("dealer help-content registry", () => {
  it("every entry's map key matches its id", () => {
    for (const [key, entry] of Object.entries(HELP)) expect(entry.id).toBe(key);
  });
  it("every entry has non-empty label, short and topic", () => {
    for (const entry of Object.values(HELP)) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.short.length).toBeGreaterThan(0);
      expect(entry.topic.length).toBeGreaterThan(0);
    }
  });
  it("getHelp returns undefined for unknown ids", () => {
    expect(getHelp("does-not-exist")).toBeUndefined();
  });
  it("topicId slugifies a topic", () => {
    expect(topicId("Cross-region")).toBe("cross-region");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dealer/help-content.test.ts`
Expected: FAIL — cannot resolve `@/lib/dealer/help-content`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/dealer/help-content.ts
export type HelpTopic = "Money" | "Stock" | "Activations" | "Cross-region" | "Reports";

export interface HelpTerm {
  id: string;
  label: string;   // simple on-screen label
  short: string;   // one-line tooltip
  long?: string;   // fuller Help-page text
  topic: HelpTopic;
}

export const HELP: Record<string, HelpTerm> = {
  "net-receivable": { id: "net-receivable", label: "Your net payout", topic: "Money",
    short: "Money the company owes you after bonuses are added and fines removed.",
    long: "This is your final take-home for the period: every bonus you earned, plus price-drop refunds, minus any cross-region fines or deductions." },
  "gross-receivable": { id: "gross-receivable", label: "Total before fines", topic: "Money",
    short: "Everything you earned before any fines are subtracted." },
  "incentive-earned": { id: "incentive-earned", label: "Bonus earned", topic: "Money",
    short: "Your total bonus before price-drop refunds and fines." },
  "base-incentive": { id: "base-incentive", label: "Base bonus %", topic: "Money",
    short: "Your standard bonus percentage on each activation." },
  "stock-in-incentive": { id: "stock-in-incentive", label: "Stock bonus", topic: "Money",
    short: "Bonus for buying qualifying stock." },
  "activation-incentive": { id: "activation-incentive", label: "Activation bonus", topic: "Money",
    short: "Bonus earned per qualifying activation." },
  "dealer-incentive": { id: "dealer-incentive", label: "Dealer bonus", topic: "Money",
    short: "Your dealer-level bonus based on total activations." },
  "price-drop-rebate": { id: "price-drop-rebate", label: "Price-drop refund", topic: "Money",
    short: "Refund you get when a phone's dealer price dropped after you stocked it." },
  "cr-fines": { id: "cr-fines", label: "Fines & deductions", topic: "Cross-region",
    short: "Amounts subtracted for cross-region catches or penalties." },
  "cr-exposure": { id: "cr-exposure", label: "At-risk amount", topic: "Cross-region",
    short: "Money at risk from cross-region phones that may be flagged.",
    long: "Cross-region phones (sold outside your region) can be caught and fined. This is the bonus money that could be reversed if that happens." },
  "target-gap": { id: "target-gap", label: "Units left to target", topic: "Activations",
    short: "How many more activations you need to hit your target bonus." },
  "today-activations": { id: "today-activations", label: "Activations today", topic: "Activations",
    short: "Phones you activated today." },
  "sell-through": { id: "sell-through", label: "Sold vs stock", topic: "Stock",
    short: "The share of your available phones that you have already sold." },
  "stock-value": { id: "stock-value", label: "Stock value", topic: "Stock",
    short: "Total worth of the phones you have on hand right now." },
  "aged-stock": { id: "aged-stock", label: "Old stock (30+ days)", topic: "Stock",
    short: "Stock that has stayed unsold for more than 30 days." },
};

export function getHelp(id: string): HelpTerm | undefined {
  return HELP[id];
}

export function topicId(topic: HelpTopic): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dealer/help-content.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dealer/help-content.ts lib/dealer/help-content.test.ts
git commit -m "feat(dealer): help-content registry (single source of truth)"
```

---

### Task 2: Guided-tour step definitions

**Files:**
- Create: `lib/dealer/tour-steps.ts`
- Test: `lib/dealer/tour-steps.test.ts`

**Interfaces:**
- Produces: `TOUR_DATA_KEYS` (readonly tuple: `"net-payout" | "earnings-chart" | "quick-actions" | "main-nav" | "help-button"`), `TourStep { element?: string; title: string; description: string }`, `TOUR_STEPS: TourStep[]`.
- Consumed by: Task 6 (`DealerTour`) and Tasks 4–5 (the `data-tour` attributes must use these exact keys).

- [ ] **Step 1: Write the failing test**

```ts
// lib/dealer/tour-steps.test.ts
import { describe, expect, it } from "vitest";
import { TOUR_STEPS, TOUR_DATA_KEYS } from "@/lib/dealer/tour-steps";

describe("dealer guided-tour steps", () => {
  it("first and last steps are element-less (welcome + done modals)", () => {
    expect(TOUR_STEPS[0].element).toBeUndefined();
    expect(TOUR_STEPS.at(-1)!.element).toBeUndefined();
  });
  it("every element selector references a known data-tour key", () => {
    for (const step of TOUR_STEPS) {
      if (!step.element) continue;
      const m = step.element.match(/^\[data-tour="(.+)"\]$/);
      expect(m, `bad selector: ${step.element}`).not.toBeNull();
      expect(TOUR_DATA_KEYS).toContain(m![1] as (typeof TOUR_DATA_KEYS)[number]);
    }
  });
  it("every step has a title and description", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dealer/tour-steps.test.ts`
Expected: FAIL — cannot resolve `@/lib/dealer/tour-steps`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/dealer/tour-steps.ts
export const TOUR_DATA_KEYS = [
  "net-payout",
  "earnings-chart",
  "quick-actions",
  "main-nav",
  "help-button",
] as const;

export type TourDataKey = (typeof TOUR_DATA_KEYS)[number];

export interface TourStep {
  element?: string; // CSS selector like [data-tour="net-payout"]; omit for centered modal
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  { title: "Welcome 👋", description: "Here is a quick 30-second tour of your dashboard." },
  { element: '[data-tour="net-payout"]', title: "Your net payout",
    description: "The money the company owes you — bonuses added, fines removed." },
  { element: '[data-tour="earnings-chart"]', title: "Earnings graph",
    description: "Your last 6 months of earnings at a glance." },
  { element: '[data-tour="quick-actions"]', title: "Add your work here",
    description: "Tap here to add a new activation or a new purchase." },
  { element: '[data-tour="main-nav"]', title: "Everything else",
    description: "Stock, reports and cross-region all live in this menu." },
  { element: '[data-tour="help-button"]', title: "Stuck? Tap Help",
    description: "This “?” opens Help any time — you can replay this tour from there too." },
  { title: "You're ready! 🎉", description: "That's it. Explore freely — Help is always one tap away." },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dealer/tour-steps.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dealer/tour-steps.ts lib/dealer/tour-steps.test.ts
git commit -m "feat(dealer): guided-tour step definitions"
```

---

### Task 3: `<HelpTip>` component

**Files:**
- Create: `components/dealer/help-tip.tsx`

**Interfaces:**
- Consumes: `getHelp`, `topicId` from Task 1; `Popover*` from `@/components/ui/popover`.
- Produces: `HelpTip({ term: string; className?: string })` — a tap/click "?" popover. Renders `null` for unknown terms.

No DOM test environment is configured, so this task is verified by typecheck + build (Task 7 final verify covers runtime). No unit test.

- [ ] **Step 1: Create the component**

```tsx
// components/dealer/help-tip.tsx
"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getHelp, topicId } from "@/lib/dealer/help-content";
import { cn } from "@/lib/utils";

export function HelpTip({ term, className }: { term: string; className?: string }) {
  const entry = getHelp(term);
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`HelpTip: unknown term "${term}"`);
    }
    return null;
  }
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`What is ${entry.label}?`}
        className={cn(
          "inline-grid size-4 shrink-0 cursor-help place-items-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{entry.label}</PopoverTitle>
          <PopoverDescription>{entry.short}</PopoverDescription>
        </PopoverHeader>
        <Link
          href={`/dealer/help#${topicId(entry.topic)}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Learn more →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `components/dealer/help-tip.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/dealer/help-tip.tsx
git commit -m "feat(dealer): HelpTip tap/click popover component"
```

---

### Task 4: Help page + navigation entry points

**Files:**
- Create: `app/dealer/(portal)/help/page.tsx`
- Modify: `components/dealer/dealer-sidebar.tsx` (add Help nav item; add `data-tour="main-nav"` to `<nav>`)
- Modify: `components/dealer/dealer-bottom-nav.tsx` (add `data-tour="main-nav"` to `<nav>`)
- Modify: `components/dealer/dealer-top-bar.tsx` (add "?" Help link with `data-tour="help-button"`)

**Interfaces:**
- Consumes: `HELP`, `topicId`, `HelpTopic` from Task 1; `getDealerSession` from `@/lib/dealer-auth`; `getTenantFeaturesById` from `@/lib/admin/dealers`; `isFeatureEnabled` from `@/lib/dealer-features`.

- [ ] **Step 1: Add the Help nav item + `data-tour` to the sidebar**

In `components/dealer/dealer-sidebar.tsx`: add `HelpCircle` to the lucide import, then append this entry to the end of the `NAV` array (after the `whats-new` item). No `feature` key → always visible; no `primaryMobile` → stays out of the bottom nav.

```ts
  { href: "/dealer/help", label: "Help", icon: HelpCircle },
```

Then add `data-tour="main-nav"` to the sidebar `<nav>` element:

```tsx
      <nav data-tour="main-nav" className="flex flex-1 flex-col gap-1 p-3">
```

- [ ] **Step 2: Add `data-tour` to the bottom nav**

In `components/dealer/dealer-bottom-nav.tsx`, add `data-tour="main-nav"` to the `<nav>` element (keep all existing className/style):

```tsx
    <nav
      data-tour="main-nav"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur md:hidden"
```

- [ ] **Step 3: Add the "?" Help button to the top bar**

In `components/dealer/dealer-top-bar.tsx`: add `import Link from "next/link";` and `HelpCircle` to the lucide import, then add this Link just before the `<ThemeToggle />` inside the right-hand `<div className="flex shrink-0 items-center gap-2">`:

```tsx
          <Link
            href="/dealer/help"
            data-tour="help-button"
            aria-label="Help"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">Help</span>
          </Link>
```

- [ ] **Step 4: Create the Help page**

```tsx
// app/dealer/(portal)/help/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { HELP, topicId, type HelpTopic } from "@/lib/dealer/help-content";

// Hide a whole topic when the dealer doesn't have the matching feature.
const TOPIC_FEATURE: Partial<Record<HelpTopic, "cross_region" | "reports">> = {
  "Cross-region": "cross_region",
  Reports: "reports",
};

const TOPIC_ORDER: HelpTopic[] = ["Money", "Activations", "Stock", "Cross-region", "Reports"];

const FAQ: { q: string; a: string }[] = [
  { q: "How is my net payout worked out?", a: "Start with every bonus you earned, add price-drop refunds, then subtract any cross-region fines. What is left is your net payout." },
  { q: "What is the at-risk amount?", a: "It is bonus money that could be reversed if any cross-region phones you sold get flagged." },
  { q: "Why did my stock go down without a sale?", a: "Stock also drops when a phone is activated, transferred out, or caught as cross-region — not only on direct sales." },
  { q: "How do I see the tour again?", a: "Tap “Replay guided tour” at the top of this page any time." },
];

export default async function DealerHelpPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const features = await getTenantFeaturesById(session.tenantId);

  const topics = TOPIC_ORDER.filter((topic) => {
    const gate = TOPIC_FEATURE[topic];
    return !gate || isFeatureEnabled(features, gate);
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Help</h1>
        <p className="text-sm text-muted-foreground">
          Short, plain-English explanations of everything in your portal.
        </p>
        <Link
          href="/dealer/dashboard?tour=1"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          ▶ Replay guided tour
        </Link>
      </header>

      {topics.map((topic) => {
        const terms = Object.values(HELP).filter((t) => t.topic === topic);
        if (terms.length === 0) return null;
        return (
          <section key={topic} id={topicId(topic)} className="space-y-3 scroll-mt-20">
            <h2 className="text-sm font-semibold text-muted-foreground">{topic}</h2>
            <dl className="divide-y rounded-xl border border-border bg-card">
              {terms.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <dt className="text-sm font-medium">{t.label}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{t.long ?? t.short}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Common questions</h2>
        <dl className="divide-y rounded-xl border border-border bg-card">
          {FAQ.map((f) => (
            <div key={f.q} className="px-4 py-3">
              <dt className="text-sm font-medium">{f.q}</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
```

> Note: confirm `getTenantFeaturesById` is exported from `@/lib/admin/dealers` (it is used the same way in `app/dealer/(portal)/layout.tsx`). If its import path differs, match the layout's import.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/dealer/\(portal\)/help/page.tsx components/dealer/dealer-sidebar.tsx components/dealer/dealer-bottom-nav.tsx components/dealer/dealer-top-bar.tsx
git commit -m "feat(dealer): Help page + sidebar link + top-bar help button"
```

---

### Task 5: Dashboard relabels, HelpTips, and `data-tour` targets

**Files:**
- Modify: `app/dealer/(portal)/dashboard/dealer-dashboard-client.tsx`

**Interfaces:**
- Consumes: `HelpTip` from Task 3; `data-tour` keys from Task 2.

- [ ] **Step 1: Import HelpTip**

Add near the other imports:

```ts
import { HelpTip } from "@/components/dealer/help-tip";
```

- [ ] **Step 2: Relabel the KPI array**

In the `kpis` array, change these `label` strings (leave every `value`/`sub`/icon untouched):

| Current label | New label | Add `helpTerm` |
|---|---|---|
| `"Net receivable"` | `"Your net payout"` | `net-receivable` |
| `"Incentive earned"` | `"Bonus earned"` | `incentive-earned` |
| `"Target gap"` | `"Units left to target"` | `target-gap` |
| `"CR exposure"` | `"At-risk amount"` | `cr-exposure` |
| `"Stock value on hand"` | `"Stock value"` | `stock-value` |
| `"Aged stock"` | `"Old stock (30+ days)"` | `aged-stock` |
| `"Sell-through"` | `"Sold vs stock"` | `sell-through` |
| `"Today activations"` | `"Activations today"` | `today-activations` |

Add an optional `helpTerm?: string` field to the `KpiProps` interface and to each KPI object above, e.g.:

```ts
{ icon: Wallet, label: "Your net payout", helpTerm: "net-receivable", value: formatPKR(netReceivable), accent: true, sub: data.label },
```

- [ ] **Step 3: Render HelpTip inside KpiCard**

In `KpiCard`, change the label line to sit next to a HelpTip when `helpTerm` is set:

```tsx
        <div className="flex items-center gap-1">
          <p className="line-clamp-2 min-h-[2.1rem] text-[11px] font-medium leading-tight text-foreground/70">{label}</p>
          {helpTerm && <HelpTip term={helpTerm} />}
        </div>
```

Update the `KpiCard` signature to destructure `helpTerm`:

```tsx
function KpiCard({ icon: Icon, label, value, sub, accent = false, danger = false, helpTerm }: KpiProps) {
```

- [ ] **Step 4: Relabel the breakdown rows**

In `breakdownRows`, change the label text (keep colors/values):
- `` `Base Incentive (${report.baseIncentivePercent}%)` `` → `` `Base bonus (${report.baseIncentivePercent}%)` ``
- `` `Target Bonus (${tb?.bonusPercent ?? 0}%)` `` → `` `Target bonus (${tb?.bonusPercent ?? 0}%)` ``
- `"Stock-In Incentive"` → `"Stock bonus"`
- `"Activation Incentive"` → `"Activation bonus"`
- `"Dealer Incentive"` → `"Dealer bonus"`
- `"Price-drop Rebate"` → `"Price-drop refund"`
- `"CR / Fines / Deductions"` → `"Fines & deductions"`

And in the summary footer block relabel: `"Gross receivable"` → `"Total before fines"`, `"Less CR fines"` → `"Less fines"`, `"Net receivable"` → `"Your net payout"`. Add a HelpTip beside the big net-payout heading:

```tsx
              <p className="text-xs font-normal text-muted-foreground">Your net payout</p>
```
(the small `<p>Net receivable</p>` at the top of the receivable card — change text, and optionally add `<HelpTip term="net-receivable" />` next to it inside a `flex items-center gap-1` wrapper).

- [ ] **Step 5: Add `data-tour` targets**

- On the receivable card `<div className={cn(cardSurface, "flex flex-col p-5 xl:col-span-5 ...")}>` add `data-tour="net-payout"`.
- On the trend-chart wrapper `<div className="h-full xl:col-span-7">` add `data-tour="earnings-chart"`.
- On the `QuickActions` root `<div>` (inside the `QuickActions` component) add `data-tour="quick-actions"` to its outermost `cardSurface` div.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add "app/dealer/(portal)/dashboard/dealer-dashboard-client.tsx"
git commit -m "feat(dealer): plain-language dashboard labels + HelpTips + tour targets"
```

---

### Task 6: Guided tour runtime (`driver.js`)

**Files:**
- Modify: `package.json` (add `driver.js`)
- Create: `components/dealer/dealer-tour.tsx`
- Modify: `app/dealer/(portal)/layout.tsx` (mount `<DealerTour />`)

**Interfaces:**
- Consumes: `TOUR_STEPS` from Task 2; `data-tour` targets from Tasks 4–5.

- [ ] **Step 1: Install driver.js**

Run: `npm install driver.js`
Expected: `driver.js` added to `dependencies`; lockfile updated.

- [ ] **Step 2: Create the tour component**

```tsx
// components/dealer/dealer-tour.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_STEPS } from "@/lib/dealer/tour-steps";

const SEEN_KEY = "dealer_tour_v1_done";

export function DealerTour() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Tour targets live on the dashboard, so only auto-run there.
    if (pathname !== "/dealer/dashboard") return;

    const forced = searchParams.get("tour") === "1";
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { /* storage blocked */ }
    if (!forced && seen) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Drop steps whose target element is not on the page (feature-gated / not rendered).
    const steps = TOUR_STEPS.filter((s) => !s.element || document.querySelector(s.element));
    if (steps.length === 0) return;

    const d = driver({
      showProgress: true,
      animate: !prefersReduced,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      steps: steps.map((s) => ({
        element: s.element,
        popover: { title: s.title, description: s.description },
      })),
      onDestroyed: () => {
        try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
        if (forced) router.replace("/dealer/dashboard"); // strip ?tour=1
      },
    });

    const t = setTimeout(() => d.drive(), 400); // let the dashboard paint first
    return () => {
      clearTimeout(t);
      d.destroy();
    };
  }, [pathname, searchParams, router]);

  return null;
}
```

- [ ] **Step 3: Mount it in the dealer layout**

In `app/dealer/(portal)/layout.tsx`, add the import and render `<DealerTour />` next to the other client widgets near the bottom of the returned tree (after `<OfflineSync />`):

```tsx
import { DealerTour } from "@/components/dealer/dealer-tour";
```
```tsx
      <InstallPrompt />
      <OfflineSync />
      <DealerTour />
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; `driver.js` CSS bundles without external fetch.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/dealer/dealer-tour.tsx "app/dealer/(portal)/layout.tsx"
git commit -m "feat(dealer): first-login guided tour via driver.js (replayable)"
```

---

### Task 7: Relabels + HelpTips on the remaining 5 core screens

**Files (modify — one screen at a time, commit per screen):**
- `app/dealer/(portal)/reports/dealer-reports-client.tsx`
- `app/dealer/(portal)/activations/dealer-activation-form.tsx`
- `app/dealer/(portal)/purchases/dealer-purchase-form.tsx`
- `app/dealer/(portal)/inventory/dealer-inventory-client.tsx`
- `app/dealer/(portal)/cross-region/dealer-cross-region-client.tsx`

**Procedure (identical for each screen):**
1. Add `import { HelpTip } from "@/components/dealer/help-tip";`.
2. Read the file. For each user-facing metric heading that matches a registry term, (a) replace the visible string with the registry `label`, and (b) place `<HelpTip term="<id>" />` immediately after the heading text, wrapped so they sit inline: `<span className="inline-flex items-center gap-1">Label <HelpTip term="id" /></span>`.
3. Do **not** touch any numeric value, calculation, form field name, server action, or `value=` prop — labels/headings only.

**Reports screen — exact wiring** (`dealer-reports-client.tsx`, the `Stat`/`Stat label=` and `TableHead` texts found in the file):
- `<Stat label="Activation incentive" .../>` → label `"Activation bonus"`, add `<HelpTip term="activation-incentive" />`.
- `<Stat label="Dealer incentive" .../>` → label `"Dealer bonus"`, add `<HelpTip term="dealer-incentive" />`.
- `<TableHead …>Stock-In</TableHead>` and `<TableCell label="Stock-In" …>` → `"Stock bonus"` (+ HelpTip `stock-in-incentive` on the header only).
- `<TableHead …>Activation</TableHead>` / `<TableCell label="Activation" …>` → `"Activation bonus"`.
- Keep the "Cross-region note" sentence as-is (already plain English).

**Activations form — exact wiring** (`dealer-activation-form.tsx`): relabel any visible field label containing "Cross-Region" to "Cross-region (sold outside your area)" and add `<HelpTip term="cr-exposure" />` next to it; relabel a "Backdate"/date field helper text to plain English ("You can log phones activated on an earlier date."). Numeric limits and field `name`s stay unchanged.

**Purchases form — exact wiring** (`dealer-purchase-form.tsx`): relabel the visible `"Cross-Region Transfer-In"` toggle/label (lines ~155/162) to `"Cross-region stock (received from another region)"` and add `<HelpTip term="cr-exposure" />`. Do not change its `value`/state key.

**Inventory screen** (`dealer-inventory-client.tsx`): add `<HelpTip term="aged-stock" />` beside any "Aged"/"Old stock" heading; add `<HelpTip term="stock-value" />` beside the stock-value total heading. Relabel "Aged stock" → "Old stock (30+ days)".

**Cross-region screen** (`dealer-cross-region-client.tsx`): add `<HelpTip term="cr-exposure" />` beside the main heading/summary; relabel any "CR" abbreviations in headings to "Cross-region".

**Per-screen steps (repeat for each of the 5 files):**

- [ ] **Step 1: Apply the relabels + HelpTips for the screen** (per the exact wiring above).
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no new errors.
- [ ] **Step 3: Commit** — e.g. `git commit -m "feat(dealer): plain labels + HelpTips on reports screen"`.

---

### Task 8: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the unit tests**

Run: `npx vitest run`
Expected: registry + tour-steps tests pass; existing `tests/incentive-engine.test.ts` still passes.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds with no new type/lint errors.

- [ ] **Step 3: Manual run (dev)**

Run: `npm run dev`, log in to the dealer portal in a fresh browser profile (clear `localStorage`).
Verify:
- First visit to `/dealer/dashboard` auto-starts the tour; it highlights net payout → chart → quick actions → menu → Help → done; "Done"/close sets the flag so it does not reappear on reload.
- `/dealer/help?` → Help link in sidebar and "?" in top bar both open the Help page; "Replay guided tour" navigates to the dashboard and runs the tour again.
- Each `<HelpTip>` opens on **click/tap** (not hover-only) and shows the plain-English text + "Learn more" link.
- The 6 core screens read in plain English; no numbers changed.

- [ ] **Step 4: Mobile check (narrow viewport / Capacitor)**

At mobile width: tour highlights the **bottom-nav** for the "menu" step; tooltips open on tap; Help reachable via top-bar "?".

- [ ] **Step 5: Feature-gating check**

For a dealer without `cross_region`/`reports`, confirm the Help page hides those topics and the tour skips missing targets without error.

---

## Notes for the implementer

- If `npx tsc --noEmit` is slow, it is still the source of truth for type errors here (no component test env exists).
- `driver.js` styling inherits its default theme; if it clashes with the Apple-shell look, add minimal overrides to `app/globals.css` under a `.driver-popover` scope (optional polish, not required for correctness).
- Never widen scope into owner/accountant/admin files or any `lib/incentive-engine` / `lib/db` module.

---

## CHECKPOINT — 2026-07-06 19:55 (for continuation on any AI platform)

**Status: Tasks 1-7 done and merged. Task 8 (verification) mostly done, a few sub-checks still open.**

- Branch `feat/dealer-ease-of-use` merged to `master` via commit `2ff55a6` (19:22). `master` clean, matches `origin/master`.
- All 8 tasks' commits are in `git log`: `e352f9c` `57cc80a` `222930d` `475ed50` `ef98812` `b2289f2` `9753ca1`→`5197b5c` (5 screens) `3611f6b` (tour-guard fix) `2ff55a6` (merge).
- Re-ran this session: `npx vitest run` → **21/21 pass**.
- Live browser check (localhost:3000, dev server) this session confirmed:
  - Guided tour runs and completes on first dashboard visit.
  - Dashboard: plain labels confirmed ("Your net payout", "Base bonus (4%)", "Fines & deductions", etc.); HelpTip on net-payout opens on click with correct text + "Learn more →".
  - Reports screen: "Activation bonus" / "Dealer bonus" / "Stock bonus" labels + HelpTip icons confirmed.
  - Cross-Region screen: heading HelpTip + plain-English copy confirmed, no raw "CR" abbreviation.
  - Bottom-nav `data-tour="main-nav"` confirmed present in code (`components/dealer/dealer-bottom-nav.tsx:26`); **not** re-verified visually at mobile viewport this session (browser resize tool was unreliable mid-session).

**Task 8 steps 3-5 — closed out 2026-07-07 (live checks against production, oppo-tracker.vercel.app):**
- [x] Activations screen — Add Activation panel: cross-region HelpTip opens ("At-risk amount: Money at risk from cross-region phones that may be flagged."); backdate copy plain ("Price snapshot will use the dealer price effective on the activation date — currently Rs X").
- [x] Purchases screen — Add Purchase panel: Source field HelpTip opens with same cross-region copy.
- [x] Inventory screen — Stock value HelpTip confirmed ("Total worth of the phones you have on hand right now."). Note: `aged-stock` HelpTip actually lives on the Dashboard, not Inventory — confirmed there instead ("Old stock (30+ days): Stock that has stayed unsold for more than 30 days.").
- [x] Mobile-viewport check — `resize_window` browser tool was non-functional this session (viewport stayed 1920px regardless of requested size; confirmed via `window.innerWidth` after the call). Verified structurally via code instead: `components/dealer/dealer-bottom-nav.tsx:26-27` has `data-tour="main-nav"` + `md:hidden` (mobile-only) + `fixed inset-x-0 bottom-0`; `components/dealer/help-tip.tsx` uses a Radix `Popover` with a plain click-triggered `PopoverTrigger` (not hover-only), so tap-to-open works identically on touch. No actual narrow-viewport screenshot was captured — flag if a true device/emulator check is wanted later.
- [x] Feature-gating check — live-tested against dealer "Testing Phase ID" (Reports feature OFF, Cross-Region ON): `/dealer/help` shows the Cross-region section and omits Reports; sidebar nav omits Reports link entirely. Forced tour (`?tour=1`) on the same dealer showed only 4 of the full step set and advanced cleanly through missing-target steps with no error, confirming `dealer-tour.tsx:34`'s `document.querySelector` filter works live, not just in theory.

**Deploy note:** master (commit `2ff55a6` + this checkpoint) was pushed to production via `vercel --prod` on 2026-07-06 — live at https://oppo-tracker.vercel.app (GitHub webhook auto-deploy is still broken; manual deploy required for future changes too).

**Environment notes for whoever continues:**
- Dev server was running via `npm run dev` on `localhost:3000` (background job, this machine only — won't persist to another platform).
- Test login used: admin-preview-as-dealer impersonation of "Khan Mobiles Ayyub Road" via `/admin/dealers/[id]` → "Admin preview" banner.
- No financial/calculation code touched anywhere in this sub-project — all changes are labels + new display-only components, per the Global Constraints above.
