---
name: Alhamd Sales Console
description: Auditable OPPO dealer management — every unit, every activation, every incentive.
colors:
  verified-green: "oklch(0.637 0.145 162.48)"
  ink: "oklch(0.129 0.042 264.695)"
  surface: "oklch(0.984 0.003 247.858)"
  card-white: "oklch(1 0 0)"
  muted-fill: "oklch(0.970 0 0)"
  subdued: "oklch(0.554 0.046 257.417)"
  divider: "oklch(0.922 0 0)"
  danger: "oklch(0.577 0.245 27.325)"
  sidebar-surface: "oklch(0.985 0 0)"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  "2xl": "1.125rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.verified-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "oklch(0.57 0.145 162.48)"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost-hover:
    backgroundColor: "{colors.muted-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  nav-item-active:
    backgroundColor: "{colors.verified-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "{colors.subdued}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
---

# Design System: Alhamd Sales Console

## 1. Overview

**Creative North Star: "The Clear Register"**

The Alhamd Sales Console is an auditable operations tool — not a dashboard for admiring metrics, but an instrument for confirming truth. Every screen answers a question a dealer, officer, or accountant would actually ask: How much stock do I hold? What rebates are owed to me? Is this activation approved? The interface earns trust not by looking impressive but by being unambiguous. Every number is legible. Every status is unequivocal. Every action has a visible outcome.

The dominant surface is light, not because "light is safe" but because clarity demands a neutral field. The one charged color — Verified Green — is reserved for things that have cleared the system: approved activations, confirmed rebates, primary actions. Its rarity is the point. When it appears, it means something passed. This system explicitly rejects: consumer-app gradient energy, decorative data displays where styling competes with content, dashboard hero-metrics that exist for visual drama rather than operational clarity, and any component that draws more attention to itself than to the data it contains.

**Key Characteristics:**
- Typographic density over spatial extravagance — information-first layout
- A single chromatic accent in a achromatic field; color encodes significance, not decoration
- Monospace data values; proportional labels; clear hierarchy between the two
- Motion used only for state — the sliding nav pill communicates location, not personality
- Flat surfaces with minimal shadow; depth conveyed by tonal surface layering, not lift

## 2. Colors: The Clear Register Palette

One charged color against a near-neutral field. Everything else is achromatic or near-achromatic.

### Primary
- **Verified Green** (`oklch(0.637 0.145 162.48)` / approx. `#059669`): Primary actions, active nav states, confirmed/approved status indicators. This color means *something passed through the system*. It is not a brand color in the decorative sense — it is a semantic signal. Never use it for ambient decoration, card backgrounds, section markers, or loading states.

### Neutral
- **Ink** (`oklch(0.129 0.042 264.695)` / approx. `#0F172A`): All body text, headings, primary data values. The darkest surface; reserve for foreground text only.
- **Surface** (`oklch(0.984 0.003 247.858)` / approx. `#F8FAFC`): Page background. Near-white with a trace of slate blue — imperceptibly tinted, not cream or warm.
- **Card White** (`oklch(1 0 0)` / `#FFFFFF`): Card and popover backgrounds. The one-step lift above the page surface is enough to separate content regions without shadow.
- **Muted Fill** (`oklch(0.970 0 0)`): Secondary surface — sidebar panels, table row hover, inactive tab backgrounds, `<kbd>` elements.
- **Subdued** (`oklch(0.554 0.046 257.417)` / approx. `#64748B`): Secondary text, labels, placeholder copy, nav items in default state. Must clear 4.5:1 against Card White (it does: 5.1:1).
- **Divider** (`oklch(0.922 0 0)` / approx. `#E2E8F0`): Borders, input strokes, table separators, card borders.
- **Danger** (`oklch(0.577 0.245 27.325)` / approx. `#DC2626`): Destructive actions, error states, voided/rejected status, fines. Never used decoratively.
- **Sidebar Surface** (`oklch(0.985 0 0)`): The sidebar panel background — one shade lighter than Muted Fill, distinct from both the page and card surfaces.

### Named Rules

**The One Voice Rule.** Verified Green appears on ≤10% of any given screen. When it is present everywhere, it means nothing. Scope it to: the active nav item, primary buttons, success/approved badges, and confirmed numeric values in reports. Nowhere else.

**The Silent Chart Rule.** Charts use achromatic gray steps by default (`oklch(0.87 0 0)` through `oklch(0.269 0 0)`). Verified Green enters a chart only when representing the dealer's own confirmed incentive or rebate position — where the green literally means "this is yours." Color in a chart encodes financial significance, not aesthetic variety.

**The Status Color Rule.** Status colors (green, amber, red) must always be paired with a text label or icon. Never encode status through color alone. Users may be on low-contrast screens; Pakistani field environments have variable ambient light.

## 3. Typography

**Body Font:** Inter (with `system-ui, sans-serif` fallback)
**Data/Mono Font:** Geist Mono (with `ui-monospace, monospace` fallback)

**Character:** One family, two registers. Inter handles all labels, headings, and prose — its optical sizing holds at 12px and its numerals are proportional by default. Geist Mono renders all financial values, stock counts, PKR amounts, and model codes — its fixed-width cells prevent numbers from shifting as they change, which matters for real-time updates and PDF alignment.

### Hierarchy

- **Headline** (600 weight, 1.125rem / 18px, –0.01em tracking, 1.4 line-height): Page titles, section headers, modal headers. The ceiling for most product surfaces; nothing larger in daily-use screens.
- **Title** (600 weight, 0.875rem / 14px, normal tracking, 1.5 line-height): Card headings, table column group headers, form section labels. Shares size with body; differentiated by weight alone.
- **Body** (400 weight, 0.875rem / 14px, normal tracking, 1.6 line-height): All explanatory text, descriptions, dialog content. 65–75ch max-width on prose.
- **Label** (500 weight, 0.75rem / 12px, 0.02em tracking, 1.4 line-height): Form labels, table column headers, nav item text, badge text. Uppercase only for role-indicator pills (e.g. "Sales Officer") — never for section eyebrows.
- **Data** (Geist Mono, 400 weight, 0.875rem / 14px, 1.5 line-height): PKR amounts, unit counts, model codes, activation IDs, any number the user will compare or scan. Tabular figures; columns align without intervention.

### Named Rules

**The Number Rule.** All financial values and stock counts render in Geist Mono. No exceptions. When a value next to a label looks identical in typeface, the hierarchy has failed.

**The Scale Floor Rule.** Nothing below 12px (0.75rem) in the interface. The smallest text is Label at 12px. Going smaller to fit more data is prohibited — reduce columns or reflow the layout instead.

## 4. Elevation

This system is **flat by default**. No ambient floating. Depth is expressed through tonal surface layering: the sidebar sits one step lighter than the page; cards sit one step lighter than the sidebar; modals lift above the page with a backdrop overlay, not a dramatic drop-shadow. The hierarchy is: Page Surface → Card White → Popover White, each separated by a 1px `Divider`-color border rather than shadow.

Shadows appear only as a response to state. A card that is being dragged or a dropdown that is open may acquire a shadow; at rest, it has none.

### Shadow Vocabulary

- **Ambient Low** (`0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px -1px oklch(0 0 0 / 0.1)`): Applied to popovers, dropdown menus, and command palette when open. Never on resting cards.
- **Ambient Mid** (`0 4px 12px 0 oklch(0 0 0 / 0.08), 0 2px 4px -2px oklch(0 0 0 / 0.06)`): Applied to modals and sheets. Combined with a `oklch(0 0 0 / 0.3)` backdrop.

### Named Rules

**The Flat-By-Default Rule.** Cards, panels, and sidebars are borderlined, not shadowed, at rest. A resting surface with a drop-shadow is a design decision that requires justification. If in doubt, use a 1px Divider border.

## 5. Components

### Buttons

Inter 500, 0.875rem. Inline-flex, vertically centered, with icon-gap 0.375rem when icons accompany labels.

- **Shape:** Gently curved (0.5rem / 8px radius — `rounded-md`)
- **Primary:** Verified Green background, white text, `0.5rem 1rem` padding. Hover: darken to `oklch(0.57 0.145 162.48)`. Focus-visible: 2px ring offset at Verified Green. Disabled: Divider background, Subdued text, `not-allowed` cursor.
- **Destructive:** Danger background, white text. Same shape and padding as Primary. Never co-located on the same row as Primary without a separator.
- **Ghost:** Transparent background, Ink text. Hover: Muted Fill background. Used for secondary/cancel actions.
- **Outline:** 1px Divider border, transparent background, Ink text. Hover: Muted Fill fill. Used where Ghost reads as too invisible.

### Cards / Containers

The primary content container for dashboard summaries, detail panels, and form sections.

- **Corner Style:** Gently rounded (0.875rem / 14px — `rounded-xl`)
- **Background:** Card White
- **Shadow Strategy:** None at rest. Ambient Low on hover if interactive.
- **Border:** 1px Divider
- **Internal Padding:** 1.5rem (24px)
- **Nested cards:** Prohibited. A card inside a card is always the wrong structure — use a bordered inner section or a table row instead.

### Inputs / Fields

- **Style:** 1px Divider border, Card White background, `rounded-md` (0.5rem), height 2.25rem (36px), `0.75rem` side padding
- **Focus:** Border shifts to Verified Green, 3px glow ring at `oklch(0.637 0.145 162.48 / 0.15)`
- **Error:** Border shifts to Danger. Error message below in Label size, Danger color, paired with a warning icon.
- **Disabled:** Muted Fill background, Subdued text, `not-allowed` cursor.
- **Labels:** Always visible above the field, never inside as placeholder-only. Placeholder text is supplementary context, never the primary label.

### Navigation

The sidebar nav uses **Inter Label (12px, 500)** for item text, and `rounded-md` corners on items.

- **Default state:** Subdued text, transparent background.
- **Hover state:** Ink text, Muted Fill background. Transition 150ms ease-out.
- **Active state:** White text on Verified Green background (the pill covers the active item). The sliding pill animates at 220ms `cubic-bezier(0.22, 1, 0.36, 1)` — fast enough to feel native, slow enough to communicate location.
- **Mobile:** The sidebar collapses below `md` (768px). A bottom tab bar or a hamburger sheet replaces it; the visual language matches (Verified Green active state, Icon + Label pairs).
- **Role indicators:** Amber (`text-amber-600`) uppercase label above the nav group for Staff roles (SO / Accountant). This is the only instance of a role-specific color token.

### Status Badges

Small, inline indicators. Label size (12px, 500), `rounded-sm` (0.375rem), `0.125rem 0.5rem` padding. Always paired with a text label — never color-only.

- **Confirmed / Active:** Verified Green tint background (`oklch(0.95 0.04 162.48)`), dark green text (`oklch(0.40 0.145 162.48)`)
- **Pending / Review:** Amber tint background, dark amber text
- **Voided / Rejected / Danger:** Red tint background, dark red text
- **Neutral / Informational:** Muted Fill background, Subdued text

### Sliding Pill Nav (Signature Component)

The signature navigation component: a `position: absolute` background rectangle that transitions between nav item positions when the active route changes. Implemented via `getBoundingClientRect` diff in a `useEffect` keyed to `pathname`. This is the one piece of pure "feel" motion in the product — 220ms, ease-out, tracking both `top` and `height` for items of varying sizes.

The pill is decorative and aria-hidden. It does not convey state — the active item's text contrast does. Reduce-motion behavior: remove the transition, render the pill in its final position instantly.

## 6. Do's and Don'ts

### Do:

- **Do** render all PKR amounts, unit counts, and stock figures in Geist Mono so columns align without manual tabular-nums overrides.
- **Do** pair every status color with a text label or icon. Green-only, amber-only, red-only status is inaccessible on variable ambient-light mobile screens.
- **Do** use a 1px Divider-color border on cards and panels at rest. Skip shadows; earn them only on interactive / floating states.
- **Do** reserve Verified Green exclusively for confirmed/approved states and primary actions. If it appears on a decorative element, that element is wrong.
- **Do** keep the achromatic chart palette. When Verified Green enters a chart, it must mean "confirmed incentive" or "cleared stock" — a financial signal, not a visual accent.
- **Do** set focus rings using Verified Green at full opacity (`outline: 2px solid oklch(0.637 0.145 162.48)`, `outline-offset: 2px`). The ring must be visible against both Card White and Muted Fill.
- **Do** reduce motion to instant transitions when `prefers-reduced-motion: reduce` is set. The sliding nav pill, page-in animation, and bar-shimmer must all fallback.
- **Do** cap line length at 65–75ch for any prose block (descriptions, empty states, error messages). Data tables may run wider.

### Don't:

- **Don't** use gradient text (`background-clip: text` + gradient). Prohibited in this system. Emphasis is weight or size, never gradient.
- **Don't** use color as the sole encoding of financial status. A red number with no label is ambiguous — is it negative, voided, or critical? Always pair.
- **Don't** put decorative side-stripe borders (`border-left` > 1px as a colored accent) on cards, alerts, or list items. Rewrite with a background tint or a full border.
- **Don't** put the active color (Verified Green) on inactive states, hover states, or ambient decoration. It means "confirmed." Diluting that meaning by using it freely destroys the semantic contract.
- **Don't** build nested cards. A card inside a card is structural laziness. Use a bordered section, a table row, or an indented list instead.
- **Don't** use display or slab fonts in UI labels, button text, table headers, or data values. Inter is the system font at all sizes.
- **Don't** introduce a cream, sand, beige, or warm-tinted body background. This surface is intentionally cool-neutral (slate-50). Warmth is carried by the Verified Green accent, not by the background hue.
- **Don't** build hero-metric layouts (giant number, tiny label, gradient accent) for dashboard KPIs. KPI cards are compact and text-led; the number is in Geist Mono, the context is in Inter Label.
- **Don't** use Verified Green for loading states, progress indicators, or ambient animation. The color means "done." A loading state is not done.
- **Don't** open modals as a first response to any action. Inline validation, progressive disclosure, and side panels are preferred. If a modal is necessary, it must be the only elevated layer; nesting modals is prohibited.
