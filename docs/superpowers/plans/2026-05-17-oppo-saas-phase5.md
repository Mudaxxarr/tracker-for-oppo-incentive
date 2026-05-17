# OPPO SaaS Phase 5 — Exec Role Restricted Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict `dealer_users` with `role='exec'` to a 3-tab mobile-focused view (Dashboard, Activations, Inventory), block deletion server-side, and redirect any attempt to access other dealer routes back to the dashboard.

**Architecture:** The dealer layout reads `role` from `getDealerSession()` and conditionally renders a 3-tab nav instead of the full 5-tab nav. A shared `requireAdminRole()` guard in server actions throws if the session role is `exec`. Route access for non-3-tab pages is handled by a redirect in a dedicated exec guard component.

**Tech Stack:** Next.js App Router server components; existing `getDealerSession()` from `lib/dealer-auth.ts`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/dealer-role.ts` | Create | `requireAdminRole()` guard + `EXEC_ALLOWED_PATHS` constant |
| `components/dealer/dealer-exec-sidebar.tsx` | Create | 3-tab sidebar for exec role |
| `components/dealer/dealer-exec-bottom-nav.tsx` | Create | 3-tab bottom nav for exec role |
| `app/dealer/layout.tsx` | Modify | Switch sidebar/bottom-nav based on role; add exec route guard |
| `app/dealer/activations/actions.ts` | Modify | `deleteDealerActivationAction` already blocks exec — verify |
| `app/dealer/activations/page.tsx` | Modify | Hide delete button for exec role (already conditional on `isAdmin`) |
| `app/dealer/dashboard/page.tsx` | Modify | Simplified exec dashboard view |

---

## Task 1: Create lib/dealer-role.ts

**Files:**
- Create: `lib/dealer-role.ts`

- [ ] **Step 1: Write the file**

Create `lib/dealer-role.ts`:

```typescript
import "server-only";
import { getDealerSession } from "./dealer-auth";

export const EXEC_ALLOWED_PATHS = [
  "/dealer/dashboard",
  "/dealer/activations",
  "/dealer/inventory",
];

/** Throws if current session role is not 'admin'. Use in any write action
 *  that exec users must not perform (delete, purchase, policy changes). */
export async function requireAdminRole(): Promise<void> {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");
  if (session.role !== "admin") {
    throw new Error("This action requires admin role.");
  }
}

/** Returns true if the given path is accessible to exec users. */
export function isExecAllowed(pathname: string): boolean {
  return EXEC_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer-role"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add lib/dealer-role.ts
git commit -m "feat(phase5): add dealer-role guard and exec allowed paths"
```

---

## Task 2: Create exec-restricted nav components

**Files:**
- Create: `components/dealer/dealer-exec-sidebar.tsx`
- Create: `components/dealer/dealer-exec-bottom-nav.tsx`

Exec users see only 3 tabs: Dashboard, Activations, Inventory.

- [ ] **Step 1: Write exec sidebar**

Create `components/dealer/dealer-exec-sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Smartphone, Warehouse } from "lucide-react";

const NAV = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/activations", label: "Activations", icon: Smartphone },
  { href: "/dealer/inventory", label: "Inventory", icon: Warehouse },
];

export function DealerExecSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
      <nav className="flex flex-col gap-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Write exec bottom nav**

Create `components/dealer/dealer-exec-bottom-nav.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LayoutDashboard, Smartphone, Warehouse } from "lucide-react";

const NAV = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/activations", label: "Activations", icon: Smartphone },
  { href: "/dealer/inventory", label: "Inventory", icon: Warehouse },
];

export function DealerExecBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                layoutId="exec-tab-indicator"
                className="absolute inset-x-1 inset-y-1 rounded-lg bg-primary/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative size-5" />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "exec-sidebar|exec-bottom"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add components/dealer/dealer-exec-sidebar.tsx components/dealer/dealer-exec-bottom-nav.tsx
git commit -m "feat(phase5): add 3-tab exec nav components"
```

---

## Task 3: Update dealer layout to switch nav by role and guard exec routes

**Files:**
- Modify: `app/dealer/layout.tsx`

- [ ] **Step 1: Read the current dealer layout**

Read `app/dealer/layout.tsx` (written in Phase 2).

- [ ] **Step 2: Replace the layout**

Replace `app/dealer/layout.tsx` with the role-aware version:

```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDealerSession } from "@/lib/dealer-auth";
import { isExecAllowed } from "@/lib/dealer-role";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerTopBar } from "@/components/dealer/dealer-top-bar";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";
import { DealerBottomNav } from "@/components/dealer/dealer-bottom-nav";
import { DealerExecSidebar } from "@/components/dealer/dealer-exec-sidebar";
import { DealerExecBottomNav } from "@/components/dealer/dealer-exec-bottom-nav";
import { DealerGraceBanner } from "@/components/dealer/dealer-grace-banner";
import { PageTransition } from "@/components/feature/page-transition";

export default async function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  if (session.status === "expired" || session.status === "suspended") {
    redirect("/dealer/expired");
  }

  // Exec role route guard — redirect to dashboard if accessing a restricted path
  const headerStore = await headers();
  const pathname = headerStore.get("x-invoke-path") ?? "";
  if (session.role === "exec" && pathname && !isExecAllowed(pathname)) {
    redirect("/dealer/dashboard");
  }

  const tenantRows = await db
    .select({ businessName: schema.dealerTenants.businessName })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, session.tenantId))
    .limit(1);
  const businessName = tenantRows[0]?.businessName ?? "Dealer Portal";

  const isGrace = headerStore.get("x-grace") === "true";
  const isExec = session.role === "exec";

  return (
    <div className="flex min-h-screen flex-col">
      <DealerTopBar businessName={businessName} />
      {isGrace && <DealerGraceBanner />}
      <div className="flex flex-1">
        {isExec ? <DealerExecSidebar /> : <DealerSidebar />}
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
      {isExec ? <DealerExecBottomNav /> : <DealerBottomNav />}
    </div>
  );
}
```

**Note on pathname detection:** Next.js does not expose the current pathname in a server component header by default. The `x-invoke-path` header used above may not be available. An alternative approach: pass the pathname check responsibility to a client component `ExecGuard` that uses `usePathname()` and redirects on the client:

If `x-invoke-path` is not set, replace the exec route guard block with a client-side guard component instead:

```typescript
// app/dealer/layout.tsx — instead of the server-side path check:
import { ExecRouteGuard } from "@/components/dealer/exec-route-guard";

// In JSX, add this as a child (renders null if allowed, triggers redirect if not):
{isExec && <ExecRouteGuard />}
```

And create `components/dealer/exec-route-guard.tsx`:

```typescript
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { EXEC_ALLOWED_PATHS } from "@/lib/dealer-role";

// This must be a client component — server components can't read pathname.
// lib/dealer-role.ts is server-only; re-define the paths here to avoid bundling server code.
const ALLOWED = ["/dealer/dashboard", "/dealer/activations", "/dealer/inventory"];

export function ExecRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const allowed = ALLOWED.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!allowed) {
      router.replace("/dealer/dashboard");
    }
  }, [pathname, router]);

  return null;
}
```

Use this approach: create the `ExecRouteGuard` component and use it in the layout. Remove the server-side pathname check. Update `app/dealer/layout.tsx` accordingly.

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/layout"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add app/dealer/layout.tsx components/dealer/exec-route-guard.tsx
git commit -m "feat(phase5): switch dealer layout to role-aware nav; add exec route guard"
```

---

## Task 4: Block exec deletion server-side

**Files:**
- Verify: `app/dealer/activations/actions.ts`

Phase 2's `deleteDealerActivationAction` already contains:
```typescript
if (role === "exec") throw new Error("Exec users cannot delete activations.");
```

And the UI already uses `isAdmin` to conditionally show the delete button. This task verifies both are correct.

- [ ] **Step 1: Verify the delete action has the exec check**

```powershell
Select-String -Path "app\dealer\activations\actions.ts" -Pattern "exec"
```

Expected: at least one match showing the `role === "exec"` check.

- [ ] **Step 2: Verify the delete button is hidden for exec in the page**

```powershell
Select-String -Path "app\dealer\activations\page.tsx" -Pattern "isAdmin"
```

Expected: a match where `isAdmin` guards the delete button render.

- [ ] **Step 3: Add requireAdminRole to any purchase write actions (if implemented)**

If `app/dealer/purchases/actions.ts` exists and has write actions, import and call `requireAdminRole()`:

```typescript
import { requireAdminRole } from "@/lib/dealer-role";

export async function createDealerPurchaseAction(...) {
  // exec users CAN create purchases — no restriction here
}

export async function deleteDealerPurchaseAction(...) {
  await requireAdminRole(); // exec cannot delete purchases
  // ... rest of action
}
```

- [ ] **Step 4: Commit**

```powershell
git add app/dealer/
git commit -m "feat(phase5): verify and enforce exec delete restriction server-side"
```

---

## Task 5: Simplified exec dashboard view

**Files:**
- Modify: `app/dealer/dashboard/page.tsx`

Spec: Exec dashboard shows today count, month total, dealer name — simplified version.

- [ ] **Step 1: Read the current dealer dashboard page**

Read `app/dealer/dashboard/page.tsx` (written in Phase 2).

- [ ] **Step 2: Add exec-specific simplified view**

Update `app/dealer/dashboard/page.tsx` to fetch the session role and render a simpler layout for exec:

```typescript
import { getDealerDashboardStats } from "./actions";
import { getDealerSession } from "@/lib/dealer-auth";
import { KpiCard } from "@/components/feature/kpi-card";
import { Smartphone, CalendarDays, Package } from "lucide-react";

export default async function DealerDashboardPage() {
  const [session, stats] = await Promise.all([
    getDealerSession(),
    getDealerDashboardStats(),
  ]);

  const isExec = session?.role === "exec";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {isExec ? "Welcome" : "Dashboard"}
        </h1>
        {stats.dealerName && (
          <p className="text-sm text-muted-foreground">{stats.dealerName}</p>
        )}
      </div>

      <div className={`grid gap-4 ${isExec ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <KpiCard
          label="Today's Activations"
          value={stats.todayActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label="Month Activations"
          value={stats.monthActivations}
          icon={<CalendarDays className="size-4" />}
        />
        {!isExec && (
          <KpiCard
            label="Purchase Records"
            value={stats.totalStock}
            icon={<Package className="size-4" />}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/dashboard"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add app/dealer/dashboard/page.tsx
git commit -m "feat(phase5): add simplified exec dashboard with 2-KPI layout"
```

---

## Task 6: Inventory page — read-only for exec

**Files:**
- Verify / Create: `app/dealer/inventory/page.tsx`

Phase 2 has a stub inventory page. For Phase 5, the inventory page needs to be read-only (no add/edit buttons). Since the stub has no write actions, it's already read-only.

- [ ] **Step 1: Verify inventory page has no destructive actions**

```powershell
Select-String -Path "app\dealer\inventory\page.tsx" -Pattern "delete|remove|create|action"
```

Expected: no matches (stub page has no actions).

- [ ] **Step 2: If the full inventory page has been implemented**, verify that write actions use `requireAdminRole()` or are hidden for exec. If not implemented, the stub satisfies the spec requirement.

- [ ] **Step 3: Commit tag**

```powershell
git tag phase5-complete
```

---

## Task 7: End-to-end smoke test

- [ ] **Step 1: Create an exec user in the database**

Using Supabase dashboard or a seed script, create a `dealer_users` row with `role='exec'` for an existing tenant.

- [ ] **Step 2: Log in as exec user**

Open `/dealer/login` → enter exec credentials → should redirect to `/dealer/dashboard`.

- [ ] **Step 3: Verify 3-tab nav**

Should see only 3 tabs: Dashboard, Activations, Inventory. Sidebar should show only these 3 items.

- [ ] **Step 4: Verify route restriction**

Manually navigate to `/dealer/purchases` — should be redirected to `/dealer/dashboard` within ~100ms by the `ExecRouteGuard`.

- [ ] **Step 5: Verify delete is absent**

Go to `/dealer/activations` as exec user. Should see activations list but no delete button.

- [ ] **Step 6: Verify delete is blocked server-side**

Attempt a direct POST to the delete action (e.g., via curl or browser console). Should receive "Exec users cannot delete activations." error.

- [ ] **Step 7: Log in as admin user**

Switch to admin credentials. Should see full 5-tab nav. Delete buttons should be visible.

- [ ] **Step 8: Verify exec dashboard layout**

Exec dashboard should show 2 KPIs (Today, Month). Admin dashboard shows 3 KPIs (Today, Month, Purchases).

---

## Summary: What Each Phase Delivers

| Phase | Deliverable | Key Files |
|---|---|---|
| 1 | SQLite → Supabase Postgres, tenant_id on all tables | `lib/db/schema.ts`, `lib/db/client.ts`, all query files |
| 2 | Dealer auth, `/dealer/*` portal, subscription gating | `middleware.ts`, `lib/dealer-auth.ts`, `app/dealer/**` |
| 3 | Owner admin panel to create/manage dealers | `lib/admin/dealers.ts`, `app/admin/**` |
| 4 | PWA install, mobile-responsive UI, animation polish | `next.config.ts`, `public/manifest.json`, component updates |
| 5 | Exec role: 3-tab nav, no delete, read-only inventory | `lib/dealer-role.ts`, exec nav components, layout update |
