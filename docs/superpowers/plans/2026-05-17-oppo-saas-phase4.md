# OPPO SaaS Phase 4 — PWA + Mobile UI + Animation Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app installable on Android as a PWA, ensure all UI works well on mobile (cards instead of tables at <768px, 44px touch targets, single-column forms), and polish framer-motion animations per spec.

**Architecture:** `@ducanh2912/next-pwa` wraps `nextConfig`; service worker + manifest served from `public/`; `AddToHomeScreen` banner stored in localStorage; all animation durations capped at 220ms; existing `PageTransition` upgraded in place.

**Tech Stack:** `@ducanh2912/next-pwa`; framer-motion (already installed); Tailwind v4 responsive utilities.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add `@ducanh2912/next-pwa` to dependencies |
| `next.config.ts` | Modify | Wrap config with `withPWA` |
| `public/manifest.json` | Create | PWA manifest |
| `public/icons/icon-192.png` | Create | PWA icon 192×192 (placeholder) |
| `public/icons/icon-512.png` | Create | PWA icon 512×512 (placeholder) |
| `app/layout.tsx` | Modify | Add `<link rel="manifest">` + `<meta name="theme-color">` |
| `components/feature/add-to-home-screen.tsx` | Create | Dismissible install banner |
| `app/layout.tsx` | Modify | Import AddToHomeScreen banner |
| `components/feature/page-transition.tsx` | Modify | Upgrade to spec animation (already close) |
| `components/feature/kpi-card.tsx` | Modify | Add spring scale animation on mount |
| `components/feature/bottom-nav.tsx` | Modify | Add `layoutId` spring tab indicator |
| `app/(app)/activations/activations-client.tsx` | Modify | Card list on mobile (hide table columns) |
| `app/(app)/purchases/purchases-client.tsx` | Modify | Card list on mobile |

---

## Task 1: Install @ducanh2912/next-pwa

- [ ] **Step 1: Install the package**

```powershell
npm install @ducanh2912/next-pwa
```

- [ ] **Step 2: Verify it installed**

```powershell
Select-String -Path "package.json" -Pattern "next-pwa"
```

Expected: `"@ducanh2912/next-pwa": "..."` in dependencies.

- [ ] **Step 3: Commit**

```powershell
git add package.json package-lock.json
git commit -m "feat(phase4): add @ducanh2912/next-pwa"
```

---

## Task 2: Wrap next.config.ts with withPWA

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Rewrite the config**

The current `next.config.ts` contains only the `turbopack` option. Replace it:

```typescript
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {
    ignoreIssue: [
      { path: "**/next.config.ts", title: "Encountered unexpected file in NFT list" },
    ],
  },
};

export default withPWA(nextConfig);
```

- [ ] **Step 2: Verify the build still passes**

```powershell
npm run build 2>&1 | Select-Object -Last 10
```

Expected: build completes with "Compiled successfully" or similar; no `withPWA` import errors.

- [ ] **Step 3: Commit**

```powershell
git add next.config.ts
git commit -m "feat(phase4): wrap Next.js config with withPWA"
```

---

## Task 3: Create PWA manifest and icons

**Files:**
- Create: `public/manifest.json`
- Create placeholder icons using Node.js (no new packages — sharp is already a transitive Next.js dep)

- [ ] **Step 1: Write the manifest**

Create `public/manifest.json`:

```json
{
  "name": "Alhamd OPPO Tracker",
  "short_name": "OPPO Tracker",
  "description": "Track every OPPO phone, every activation, every incentive.",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0A6E5C",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Generate placeholder PNG icons**

Run this one-off script (uses sharp which Next.js already installed):

```powershell
node -e "
const sharp = require('sharp');
const fs = require('fs');
fs.mkdirSync('public/icons', { recursive: true });

const svg192 = Buffer.from('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"192\" height=\"192\"><rect width=\"192\" height=\"192\" fill=\"#0A6E5C\" rx=\"24\"/><text x=\"96\" y=\"130\" font-family=\"Arial\" font-size=\"96\" fill=\"white\" text-anchor=\"middle\">O</text></svg>');
const svg512 = Buffer.from('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"512\" height=\"512\"><rect width=\"512\" height=\"512\" fill=\"#0A6E5C\" rx=\"64\"/><text x=\"256\" y=\"346\" font-family=\"Arial\" font-size=\"256\" fill=\"white\" text-anchor=\"middle\">O</text></svg>');

sharp(svg192).png().toFile('public/icons/icon-192.png', (e) => { if(e) console.error(e); else console.log('icon-192 done'); });
sharp(svg512).png().toFile('public/icons/icon-512.png', (e) => { if(e) console.error(e); else console.log('icon-512 done'); });
"
```

Expected output:
```
icon-192 done
icon-512 done
```

If `sharp` is not found (it may not be in PATH), try:
```powershell
node -e "const sharp = require('./node_modules/sharp'); ..."
```
Or replace with any 192×192 and 512×512 PNG files (can be solid color placeholders).

- [ ] **Step 3: Verify files exist**

```powershell
ls public/icons/
```

Expected: `icon-192.png`, `icon-512.png`.

- [ ] **Step 4: Commit**

```powershell
git add public/manifest.json public/icons/
git commit -m "feat(phase4): add PWA manifest and placeholder icons"
```

---

## Task 4: Add manifest link and theme-color to app/layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read current layout**

Current `app/layout.tsx` has `export const metadata` and a `RootLayout` function.

- [ ] **Step 2: Add manifest + theme-color to metadata and head**

Update `app/layout.tsx` — add the manifest link and theme-color meta. In Next.js 16 App Router, use the `metadata` object's `manifest` field and `themeColor`:

```typescript
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/constants";
import { AddToHomeScreen } from "@/components/feature/add-to-home-screen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Track every OPPO phone, every activation, every incentive — auditable.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0A6E5C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
        <AddToHomeScreen />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "app/layout"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add app/layout.tsx
git commit -m "feat(phase4): add PWA manifest link and theme-color to root layout"
```

---

## Task 5: Create AddToHomeScreen banner component

**Files:**
- Create: `components/feature/add-to-home-screen.tsx`

This component detects if the app is running in a browser (not standalone PWA mode) and shows a dismissible install banner. Dismissed state is persisted in localStorage under `pwa_banner_dismissed`.

- [ ] **Step 1: Write the component**

Create `components/feature/add-to-home-screen.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

const STORAGE_KEY = "pwa_banner_dismissed";

export function AddToHomeScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if already in standalone mode (installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error — iOS Safari
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Don't show if dismissed before
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }

    // Only show on mobile
    if (window.innerWidth >= 768) return;

    // Delay slightly so it doesn't flash on first render
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="banner"
      className="fixed inset-x-0 bottom-16 z-50 mx-3 flex items-start gap-3 rounded-xl border bg-card p-4 shadow-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
    >
      <Share className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Install OPPO Tracker</p>
        <p className="text-xs text-muted-foreground">
          Tap <Share className="inline size-3" /> then &quot;Add to Home Screen&quot; for offline access.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "add-to-home"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add components/feature/add-to-home-screen.tsx
git commit -m "feat(phase4): add dismissible PWA install banner"
```

---

## Task 6: Upgrade page transition animation

**Files:**
- Modify: `components/feature/page-transition.tsx`

Current implementation already uses `AnimatePresence` + opacity + y. Upgrade to match spec (y:8→0 + opacity, 0.18s ease-out) and ensure it's applied to dealer routes too.

- [ ] **Step 1: Update the transition**

Current file:
```typescript
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -4 }}
transition={{ duration: 0.2, ease: "easeOut" }}
```

Spec requires: y 8→0 + opacity, 0.18s. Replace the motion.div attributes:

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

The only change is `duration: 0.2` → `duration: 0.18`.

- [ ] **Step 2: Add PageTransition to dealer layout**

Open `app/dealer/layout.tsx`. Wrap `{children}` in `<PageTransition>`:

```typescript
import { PageTransition } from "@/components/feature/page-transition";

// Inside the JSX:
<main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
  <div className="px-3 py-4 md:px-6 md:py-6">
    <PageTransition>{children}</PageTransition>
  </div>
</main>
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "page-transition"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add components/feature/page-transition.tsx app/dealer/layout.tsx
git commit -m "feat(phase4): update page transition to 0.18s per spec; add to dealer layout"
```

---

## Task 7: Add spring animation to KPI cards

**Files:**
- Modify: `components/feature/kpi-card.tsx`

Spec: KPI cards animate with `scale 0.97→1 + opacity, spring {stiffness:320, damping:28}`.

- [ ] **Step 1: Wrap the Card in a motion.div**

The `KpiCard` component already has a `Card` at the root. Wrap the outer `Card` in a `motion.div` with spring scale:

Find the `return (` line inside `KpiCard`. Change it from:

```typescript
  return (
    <Card className={cn(dimmed && "opacity-60", className)}>
```

to:

```typescript
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: dimmed ? 0.6 : 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
    <Card className={cn(dimmed && "opacity-60", className)}>
```

And close the `motion.div` after the closing `</Card>`:

```typescript
    </Card>
    </motion.div>
  );
```

Also remove the `cn(dimmed && "opacity-60", className)` from `Card` since opacity is now handled by the motion.div's animate:

```typescript
    <Card className={cn(className)}>
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "kpi-card"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add components/feature/kpi-card.tsx
git commit -m "feat(phase4): add spring scale animation to KPI cards"
```

---

## Task 8: Add spring tab indicator to bottom nav

**Files:**
- Modify: `components/feature/bottom-nav.tsx`

Spec: bottom nav indicator uses `layoutId="tab-indicator"`, spring {stiffness:400, damping:30}.

- [ ] **Step 1: Add the animated indicator**

Replace the active tab's Link className logic. When a tab is active, render a `motion.div` absolutely behind it with the `layoutId`.

Replace the full bottom-nav.tsx:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import { PRIMARY_MOBILE_NAV, SECONDARY_MOBILE_NAV } from "./nav-config";

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {PRIMARY_MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {active && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-x-1 inset-y-1 rounded-lg bg-primary/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative size-5" />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
      <Sheet>
        <SheetTrigger
          render={
            <button className="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground" />
          }
        >
          <Menu className="size-5" />
          <span>More</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 p-4">
            {SECONDARY_MOBILE_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-card px-3 py-4 text-xs font-medium hover:bg-muted"
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "bottom-nav"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add components/feature/bottom-nav.tsx
git commit -m "feat(phase4): add spring layoutId tab indicator to bottom nav"
```

---

## Task 9: Mobile card layout for activations table

**Files:**
- Modify: `app/(app)/activations/activations-client.tsx`

Spec: Data tables → card list on `<768px`. The activations client currently renders an HTML table. Add a card view for mobile.

- [ ] **Step 1: Read the current activations-client.tsx**

Read `app/(app)/activations/activations-client.tsx` to understand the table structure before modifying.

- [ ] **Step 2: Add responsive card/table switching**

The pattern: wrap the table in `hidden md:block` and add a card list in `md:hidden`. Find the `<table>` or `<div>` that contains the activations table and add this immediately before it:

```typescript
{/* Mobile card list */}
<div className="space-y-2 md:hidden">
  {filteredActivations.map((a) => (
    <div key={a.id} className="rounded-lg border bg-card px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{a.modelName}</p>
          <p className="text-xs text-muted-foreground font-mono">{a.imei ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {a.activationDate} &middot; PKR {a.dealerPriceSnapshot?.toLocaleString() ?? "—"}
          </p>
        </div>
        {/* delete button if present — replicate existing delete logic */}
      </div>
    </div>
  ))}
  {filteredActivations.length === 0 && (
    <p className="py-8 text-center text-sm text-muted-foreground">No activations found.</p>
  )}
</div>

{/* Desktop table */}
<div className="hidden md:block">
  {/* existing table JSX goes here */}
</div>
```

Note: The exact variable names (`filteredActivations`, etc.) depend on the current client component. Read the file first, then apply the pattern. The delete button logic must be replicated for the mobile cards.

- [ ] **Step 3: Ensure all interactive elements are min-h-[44px]**

Scan the activations client for buttons and inputs. Add `min-h-[44px]` or `h-11` to any that are smaller:

```typescript
// Example: form submit button
<Button type="submit" className="min-h-[44px]">...</Button>
// Example: small icon buttons — use size="default" instead of size="icon" on mobile
```

- [ ] **Step 4: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "activations-client"
```

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add "app/(app)/activations/activations-client.tsx"
git commit -m "feat(phase4): add mobile card layout for activations table"
```

---

## Task 10: Mobile card layout for purchases table

**Files:**
- Modify: `app/(app)/purchases/purchases-client.tsx`

Same pattern as Task 9. Apply to the purchases client.

- [ ] **Step 1: Read the current purchases-client.tsx**

Read `app/(app)/purchases/purchases-client.tsx` before modifying.

- [ ] **Step 2: Add mobile card / desktop table split**

Apply the same `hidden md:block` / `md:hidden` pattern as Task 9. For each purchase row in the mobile card view, show: model name, quantity, date, unit price, total.

- [ ] **Step 3: Verify TypeScript + commit**

```powershell
npx tsc --noEmit 2>&1 | Select-String "purchases-client"
git add "app/(app)/purchases/purchases-client.tsx"
git commit -m "feat(phase4): add mobile card layout for purchases table"
```

---

## Task 11: Mobile form layout — single column, min touch targets

**Files:**
- Modify: `app/(app)/activations/activation-form.tsx`
- Modify: `app/(app)/purchases/purchase-form.tsx`

Spec: Forms → single-column full-width on mobile; all interactive elements → `min-h-[44px]`.

- [ ] **Step 1: Update activation-form.tsx**

Read `app/(app)/activations/activation-form.tsx`. Find any grid layouts (e.g., `grid grid-cols-2`) and change to `grid grid-cols-1 sm:grid-cols-2`. Add `min-h-[44px]` to all Input and Button elements.

Pattern to apply:
```typescript
// Before
<div className="grid grid-cols-2 gap-4">
// After
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

// Before
<Input id="..." />
// After
<Input id="..." className="min-h-[44px]" />

// Buttons
<Button className="min-h-[44px]">...</Button>
```

- [ ] **Step 2: Update purchase-form.tsx**

Apply the same pattern to `purchase-form.tsx`.

- [ ] **Step 3: Commit**

```powershell
git add "app/(app)/activations/activation-form.tsx" "app/(app)/purchases/purchase-form.tsx"
git commit -m "feat(phase4): make forms single-column on mobile with 44px touch targets"
```

---

## Task 12: Add stagger animation to list rows

**Files:**
- Modify: `app/(app)/activations/activations-client.tsx`

Spec: List rows animate with `staggerChildren 0.035s, y:6→0 + opacity, 0.14s each`.

- [ ] **Step 1: Wrap the list container and items in motion components**

In `activations-client.tsx`, import `motion` from framer-motion. Wrap the list container:

```typescript
import { motion } from "framer-motion";

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.14, ease: "easeOut" } },
};

// In JSX — wrap the mobile card list container:
<motion.div
  className="space-y-2 md:hidden"
  variants={listVariants}
  initial="hidden"
  animate="show"
>
  {filteredActivations.map((a) => (
    <motion.div key={a.id} variants={itemVariants} className="...">
      ...
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 2: Commit**

```powershell
git add "app/(app)/activations/activations-client.tsx"
git commit -m "feat(phase4): add stagger row animation to activations list"
```

---

## Task 13: End-to-end smoke test + PWA install

- [ ] **Step 1: Build and start in production mode**

PWA is disabled in development (`disable: process.env.NODE_ENV === "development"`). Test with a production build:

```powershell
npm run build
npm run start
```

- [ ] **Step 2: Verify manifest is served**

Open `http://localhost:3000/manifest.json` in a browser. Should see the JSON.

- [ ] **Step 3: Verify service worker is registered**

Open DevTools → Application → Service Workers. Should see a registered worker for the origin.

- [ ] **Step 4: Verify icons load**

Open `http://localhost:3000/icons/icon-192.png` and `icon-512.png`. Should display the placeholder icons.

- [ ] **Step 5: Test on Android Chrome** (if device available)

Open the app URL → Chrome should show "Add to home screen" prompt. Install it. Verify it opens in standalone mode (no browser chrome).

- [ ] **Step 6: Verify install banner**

On mobile viewport (or Chrome DevTools device mode), refresh `/dashboard`. After ~1.5s, the install banner should appear. Dismiss it → should not reappear (localStorage key set).

- [ ] **Step 7: Verify animations**

- Page transitions: navigate between pages — should see 0.18s opacity+y animation
- KPI cards: load dashboard — cards should scale in from 0.97
- Bottom nav: tap different tabs — should see spring indicator sliding

- [ ] **Step 8: Commit tag**

```powershell
git tag phase4-complete
```
