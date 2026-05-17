# OPPO SaaS Phase 2 — Dealer Auth & Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email+password dealer auth, subscription gating middleware, and a functional dealer portal (`/dealer/*`) where dealers can manage their activations, purchases, and inventory.

**Architecture:** Stateless HMAC token (`dealer_session` cookie) embeds tenantId, userId, role, subscription status, and expiresAt. Middleware on Edge runtime (Web Crypto API) verifies the token without a DB call and gates `/dealer/*` routes. Server actions call `getDealerSession()` to get tenantId and thread it into every query.

**Tech Stack:** Web Crypto `crypto.subtle` (Edge-compatible HMAC); bcryptjs (password verify, already installed); Next.js App Router middleware.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/constants.ts` | Modify | Add DEALER_SESSION_COOKIE, DEALER_ACTIVE_ID_COOKIE |
| `lib/dealer-session.ts` | Create | Edge-safe token make/parse (no server-only, no node:crypto) |
| `lib/dealer-auth.ts` | Create | Server-only: verifyDealerCredentials, startDealerSession, endDealerSession, getDealerSession |
| `middleware.ts` | Create | Edge routing: /admin/* → oppo_session check; /dealer/* → dealer_session check |
| `app/dealer/login/page.tsx` | Create | Login page (redirect if already authed) |
| `app/dealer/login/login-form.tsx` | Create | Client form using useActionState |
| `app/dealer/login/actions.ts` | Create | loginAction server action |
| `app/dealer/expired/page.tsx` | Create | Lock screen shown when subscription expired/suspended |
| `app/dealer/actions.ts` | Create | logoutAction (clears dealer_session cookie) |
| `app/dealer/layout.tsx` | Create | Auth gate + grace banner + dealer chrome |
| `components/dealer/dealer-top-bar.tsx` | Create | Top bar with business name, dealer switcher, logout |
| `components/dealer/dealer-sidebar.tsx` | Create | Desktop sidebar nav |
| `components/dealer/dealer-bottom-nav.tsx` | Create | Mobile bottom nav |
| `components/dealer/dealer-grace-banner.tsx` | Create | Banner shown when X-Grace header is set |
| `app/dealer/dashboard/page.tsx` | Create | Dealer dashboard (today stats, month KPIs) |
| `app/dealer/dashboard/actions.ts` | Create | getDealerDashboardAction |
| `app/dealer/activations/page.tsx` | Create | Activations list + add form |
| `app/dealer/activations/actions.ts` | Create | listActivationsAction, createActivationAction, deleteActivationAction |
| `app/dealer/ids/page.tsx` | Create | List dealer IDs for this tenant |
| `app/dealer/ids/actions.ts` | Create | setActiveDealerIdAction |

---

## Task 1: Add dealer session constants to lib/constants.ts

**Files:**
- Modify: `lib/constants.ts`

- [ ] **Step 1: Append two new cookie name constants**

Open `lib/constants.ts` and add at the end:

```typescript
export const DEALER_SESSION_COOKIE = "dealer_session";
export const DEALER_ACTIVE_ID_COOKIE = "dealer_active_id";
```

- [ ] **Step 2: Verify no duplicate symbols**

```powershell
Select-String -Path "lib\constants.ts" -Pattern "DEALER_SESSION_COOKIE|DEALER_ACTIVE_ID_COOKIE"
```

Expected: exactly 2 matches, one per constant.

- [ ] **Step 3: Commit**

```powershell
git add lib/constants.ts
git commit -m "feat(phase2): add dealer session cookie constants"
```

---

## Task 2: Create lib/dealer-session.ts (Edge-compatible token)

**Files:**
- Create: `lib/dealer-session.ts`

This file must NOT import `server-only`, `node:crypto`, or `next/headers` — it must run on Edge runtime (used by middleware).

- [ ] **Step 1: Write the file**

Create `lib/dealer-session.ts`:

```typescript
// Edge-compatible — uses Web Crypto API (crypto.subtle), not node:crypto.
// Do NOT add "server-only" import — this file is used by middleware (Edge runtime).

export type DealerRole = "admin" | "exec";
export type SubscriptionStatus = "active" | "grace" | "expired" | "suspended";

export interface DealerTokenPayload {
  tenantId: string;
  userId: string;
  role: DealerRole;
  expiresAt: string; // ISO date YYYY-MM-DD — tenant subscription expiry
  status: SubscriptionStatus;
}

export interface ParsedDealerToken extends DealerTokenPayload {
  issuedAt: number; // ms since epoch
}

// Token format: issued.tenantId.userId.role.expiresAt.status.random.sig  (8 dot-separated parts)
// Body = first 7 parts joined by "."; sig = HMAC-SHA256(secret, body) as lowercase hex.

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const s = process.env.DEALER_SESSION_SECRET;
  if (!s) throw new Error("DEALER_SESSION_SECRET environment variable is required");
  return s;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function makeDealerToken(payload: DealerTokenPayload): Promise<string> {
  const issued = Date.now().toString();
  const random = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const body = [
    issued,
    payload.tenantId,
    payload.userId,
    payload.role,
    payload.expiresAt,
    payload.status,
    random,
  ].join(".");
  const key = await importKey(getSecret());
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${toHex(sigBuf)}`;
}

export async function parseDealerToken(token: string): Promise<ParsedDealerToken | null> {
  const parts = token.split(".");
  if (parts.length !== 8) return null;
  const [issued, tenantId, userId, role, expiresAt, status, , sig] = parts;
  const body = parts.slice(0, 7).join(".");

  let key: CryptoKey;
  try {
    key = await importKey(getSecret());
  } catch {
    return null;
  }

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromHex(sig),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > TTL_MS) return null;

  if (!["admin", "exec"].includes(role)) return null;
  if (!["active", "grace", "expired", "suspended"].includes(status)) return null;
  if (!tenantId || !userId) return null;

  return {
    tenantId,
    userId,
    role: role as DealerRole,
    expiresAt,
    status: status as SubscriptionStatus,
    issuedAt,
  };
}
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer-session"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```powershell
git add lib/dealer-session.ts
git commit -m "feat(phase2): add Edge-compatible dealer session token functions"
```

---

## Task 3: Create lib/dealer-auth.ts (server-only session management)

**Files:**
- Create: `lib/dealer-auth.ts`

- [ ] **Step 1: Write the file**

Create `lib/dealer-auth.ts`:

```typescript
import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db, schema } from "./db/client";
import { eq } from "drizzle-orm";
import {
  makeDealerToken,
  parseDealerToken,
  type DealerTokenPayload,
  type ParsedDealerToken,
} from "./dealer-session";
import { DEALER_SESSION_COOKIE } from "./constants";

const SESSION_MAX_AGE_SECS = 30 * 24 * 3600; // 30 days

export type DealerCredentialResult = {
  tenantId: string;
  userId: string;
  role: "admin" | "exec";
  expiresAt: string;
  status: string;
};

export async function verifyDealerCredentials(
  email: string,
  password: string,
): Promise<DealerCredentialResult | null> {
  const rows = await db
    .select({
      userId: schema.dealerUsers.id,
      tenantId: schema.dealerUsers.tenantId,
      role: schema.dealerUsers.role,
      hash: schema.dealerUsers.passwordHash,
      isActive: schema.dealerUsers.isActive,
      tenantStatus: schema.dealerTenants.status,
      tenantExpiresAt: schema.dealerTenants.expiresAt,
    })
    .from(schema.dealerUsers)
    .innerJoin(
      schema.dealerTenants,
      eq(schema.dealerUsers.tenantId, schema.dealerTenants.id),
    )
    .where(eq(schema.dealerUsers.email, email.toLowerCase().trim()))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row.isActive) return null;

  const ok = await bcrypt.compare(password, row.hash);
  if (!ok) return null;

  return {
    tenantId: row.tenantId,
    userId: row.userId,
    role: row.role as "admin" | "exec",
    expiresAt: row.tenantExpiresAt,
    status: row.tenantStatus,
  };
}

export async function startDealerSession(payload: DealerTokenPayload): Promise<void> {
  const token = await makeDealerToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(DEALER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endDealerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEALER_SESSION_COOKIE);
}

export async function getDealerSession(): Promise<ParsedDealerToken | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEALER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return parseDealerToken(token);
}
```

- [ ] **Step 2: Verify type check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer-auth"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add lib/dealer-auth.ts
git commit -m "feat(phase2): add server-only dealer auth functions"
```

---

## Task 4: Create middleware.ts (Edge routing)

**Files:**
- Create: `middleware.ts` (project root, next to `next.config.ts`)

- [ ] **Step 1: Write the file**

Create `middleware.ts` at the project root:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { parseDealerToken } from "./lib/dealer-session";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── Admin routes ─────────────────────────────────────────────────────────
  // Quick cookie-existence check. Cryptographic verification happens in
  // app/admin/layout.tsx via isAuthenticated() (runs on Node.js runtime).
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("oppo_session")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/unlock", req.url));
    }
    return NextResponse.next();
  }

  // ── Dealer public routes ──────────────────────────────────────────────────
  if (pathname === "/dealer/login" || pathname === "/dealer/expired") {
    return NextResponse.next();
  }

  // ── Dealer protected routes ───────────────────────────────────────────────
  if (pathname.startsWith("/dealer")) {
    const raw = req.cookies.get("dealer_session")?.value;
    if (!raw) {
      return NextResponse.redirect(new URL("/dealer/login", req.url));
    }

    const session = await parseDealerToken(raw);
    if (!session) {
      // Invalid or expired token — clear cookie and re-login
      const res = NextResponse.redirect(new URL("/dealer/login", req.url));
      res.cookies.delete("dealer_session");
      return res;
    }

    if (session.status === "expired" || session.status === "suspended") {
      return NextResponse.redirect(new URL("/dealer/expired", req.url));
    }

    const res = NextResponse.next();
    if (session.status === "grace") {
      res.headers.set("x-grace", "true");
    }
    // Forward session claims as headers so layout.tsx can avoid a DB call.
    res.headers.set("x-dealer-tenant-id", session.tenantId);
    res.headers.set("x-dealer-user-id", session.userId);
    res.headers.set("x-dealer-role", session.role);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dealer/:path*"],
};
```

- [ ] **Step 2: Verify Next.js recognises the middleware**

```powershell
npx next build 2>&1 | Select-String "middleware" | Select-Object -First 5
```

Expected: lines mentioning middleware compilation with no errors. (If build fails for other reasons that's OK — we only care about the middleware lines.)

- [ ] **Step 3: Commit**

```powershell
git add middleware.ts
git commit -m "feat(phase2): add Edge middleware for /admin and /dealer route gating"
```

---

## Task 5: Create dealer login page

**Files:**
- Create: `app/dealer/login/page.tsx`
- Create: `app/dealer/login/login-form.tsx`
- Create: `app/dealer/login/actions.ts`

- [ ] **Step 1: Write the server action**

Create `app/dealer/login/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { verifyDealerCredentials, startDealerSession } from "@/lib/dealer-auth";
import { logToAudit } from "@/lib/audit";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: "Email and password are required." };

  let creds: Awaited<ReturnType<typeof verifyDealerCredentials>>;
  try {
    creds = await verifyDealerCredentials(email, password);
  } catch (err) {
    await logToAudit("dealer_login_error", { email, error: String(err) });
    throw new Error("Login failed — database error. Please try again.", { cause: err });
  }

  if (!creds) return { error: "Invalid email or password." };

  await startDealerSession({
    tenantId: creds.tenantId,
    userId: creds.userId,
    role: creds.role,
    expiresAt: creds.expiresAt,
    status: creds.status as "active" | "grace" | "expired" | "suspended",
  });

  if (creds.status === "expired" || creds.status === "suspended") {
    redirect("/dealer/expired");
  }

  redirect("/dealer/dashboard");
}
```

- [ ] **Step 2: Write the client form**

Create `app/dealer/login/login-form.tsx`:

```typescript
"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="size-4" />
            Dealer Login
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              disabled={pending}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={pending}
              placeholder="••••••••"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

- [ ] **Step 3: Write the page**

Create `app/dealer/login/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { LoginForm } from "./login-form";

export default async function DealerLoginPage() {
  const session = await getDealerSession();
  if (session && session.status !== "expired" && session.status !== "suspended") {
    redirect("/dealer/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Alhamd OPPO Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to your dealer account</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/login"
```

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add app/dealer/login/
git commit -m "feat(phase2): add dealer login page with email+password auth"
```

---

## Task 6: Create dealer/expired page + logout action

**Files:**
- Create: `app/dealer/expired/page.tsx`
- Create: `app/dealer/actions.ts`

- [ ] **Step 1: Write the logout action**

Create `app/dealer/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { endDealerSession } from "@/lib/dealer-auth";

export async function logoutAction(): Promise<void> {
  await endDealerSession();
  redirect("/dealer/login");
}
```

- [ ] **Step 2: Write the expired page**

Create `app/dealer/expired/page.tsx`:

```typescript
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "../actions";

export default function DealerExpiredPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <ShieldOff className="mx-auto size-12 text-destructive" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Subscription Inactive</h1>
          <p className="text-sm text-muted-foreground">
            Your dealer subscription has expired or been suspended. Contact the
            administrator to renew access.
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out and try again
          </Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/expired|dealer/actions"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add app/dealer/expired/ app/dealer/actions.ts
git commit -m "feat(phase2): add dealer expired screen and logout action"
```

---

## Task 7: Create dealer navigation components

**Files:**
- Create: `components/dealer/dealer-top-bar.tsx`
- Create: `components/dealer/dealer-sidebar.tsx`
- Create: `components/dealer/dealer-bottom-nav.tsx`
- Create: `components/dealer/dealer-grace-banner.tsx`

The dealer nav has 5 routes: Dashboard, Activations, Purchases, Inventory, IDs.

- [ ] **Step 1: Define dealer nav config inline in sidebar (no separate config file needed)**

Create `components/dealer/dealer-sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Smartphone,
  ShoppingCart,
  Warehouse,
  IdCard,
} from "lucide-react";

const NAV = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/activations", label: "Activations", icon: Smartphone },
  { href: "/dealer/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/dealer/inventory", label: "Inventory", icon: Warehouse },
  { href: "/dealer/ids", label: "IDs", icon: IdCard },
];

export function DealerSidebar() {
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

- [ ] **Step 2: Create dealer bottom nav**

Create `components/dealer/dealer-bottom-nav.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Smartphone,
  ShoppingCart,
  Warehouse,
  IdCard,
} from "lucide-react";

const NAV = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/activations", label: "Activations", icon: Smartphone },
  { href: "/dealer/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/dealer/inventory", label: "Inventory", icon: Warehouse },
  { href: "/dealer/ids", label: "IDs", icon: IdCard },
];

export function DealerBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 backdrop-blur md:hidden"
      style={{
        gridTemplateColumns: `repeat(${NAV.length}, 1fr)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
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
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Create dealer top bar**

Create `components/dealer/dealer-top-bar.tsx`:

```typescript
import { ThemeToggle } from "@/components/feature/theme-toggle";
import { logoutAction } from "@/app/dealer/actions";
import { Button } from "@/components/ui/button";
import { Activity, LogOut } from "lucide-react";

interface DealerTopBarProps {
  businessName: string;
}

export function DealerTopBar({ businessName }: DealerTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
        <Activity className="size-5 shrink-0 text-primary" />
        <span className="truncate text-sm">{businessName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="icon" title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create grace banner**

Create `components/dealer/dealer-grace-banner.tsx`:

```typescript
import { AlertTriangle } from "lucide-react";

export function DealerGraceBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        Your subscription has expired. Access continues in grace period — contact
        your administrator to renew.
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "components/dealer"
```

Expected: no output.

- [ ] **Step 6: Commit**

```powershell
git add components/dealer/
git commit -m "feat(phase2): add dealer nav components (sidebar, bottom nav, top bar, grace banner)"
```

---

## Task 8: Create app/dealer/layout.tsx

**Files:**
- Create: `app/dealer/layout.tsx`

The layout:
1. Calls `getDealerSession()` — if null, middleware already redirected, so this is a safety net.
2. Fetches the tenant's business name.
3. Reads `x-grace` header to show the grace banner.
4. Renders dealer chrome (top bar, sidebar, bottom nav).

- [ ] **Step 1: Write the layout**

Create `app/dealer/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDealerSession } from "@/lib/dealer-auth";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerTopBar } from "@/components/dealer/dealer-top-bar";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";
import { DealerBottomNav } from "@/components/dealer/dealer-bottom-nav";
import { DealerGraceBanner } from "@/components/dealer/dealer-grace-banner";

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

  const tenantRows = await db
    .select({ businessName: schema.dealerTenants.businessName })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, session.tenantId))
    .limit(1);
  const businessName = tenantRows[0]?.businessName ?? "Dealer Portal";

  const headerStore = await headers();
  const isGrace = headerStore.get("x-grace") === "true";

  return (
    <div className="flex min-h-screen flex-col">
      <DealerTopBar businessName={businessName} />
      {isGrace && <DealerGraceBanner />}
      <div className="flex flex-1">
        <DealerSidebar />
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
      <DealerBottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/layout"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add app/dealer/layout.tsx
git commit -m "feat(phase2): add dealer layout with auth gate and grace banner"
```

---

## Task 9: Create dealer dashboard

**Files:**
- Create: `app/dealer/dashboard/actions.ts`
- Create: `app/dealer/dashboard/page.tsx`

The dashboard shows: today's activation count, month's activation count, current stock count, and a greeting.

- [ ] **Step 1: Write dashboard actions**

Create `app/dealer/dashboard/actions.ts`:

```typescript
"use server";

import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { db, schema } from "@/lib/db/client";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";

export type DealerDashboardStats = {
  todayActivations: number;
  monthActivations: number;
  totalStock: number;
  dealerName: string | null;
};

export async function getDealerDashboardStats(): Promise<DealerDashboardStats> {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");

  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  let todayActivations = 0;
  let monthActivations = 0;
  let totalStock = 0;
  let dealerName: string | null = null;

  if (dealerId) {
    // today
    const todayRows = await db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.dealerId, dealerId),
          eq(schema.activations.activationDate, today),
        ),
      );
    todayActivations = todayRows[0]?.c ?? 0;

    // month
    const monthRows = await db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.dealerId, dealerId),
          gte(schema.activations.activationDate, monthStart),
          lte(schema.activations.activationDate, monthEnd),
        ),
      );
    monthActivations = monthRows[0]?.c ?? 0;

    // stock = purchases qty - activations qty (simplified)
    const purchaseRows = await db
      .select({ c: count() })
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.tenantId, tenantId),
          eq(schema.purchases.dealerId, dealerId),
        ),
      );
    // Use count of purchase rows as a proxy (full inventory calc is in inventory page)
    totalStock = purchaseRows[0]?.c ?? 0;

    const dealerRows = await db
      .select({ name: schema.dealerIds.name })
      .from(schema.dealerIds)
      .where(
        and(
          eq(schema.dealerIds.tenantId, tenantId),
          eq(schema.dealerIds.id, dealerId),
        ),
      )
      .limit(1);
    dealerName = dealerRows[0]?.name ?? null;
  }

  return { todayActivations, monthActivations, totalStock, dealerName };
}
```

Note: `getActiveDealerIdForTenant` is defined in the next step.

- [ ] **Step 2: Create lib/dealer-tenant.ts (active dealer helper)**

Create `lib/dealer-tenant.ts`:

```typescript
import "server-only";
import { cookies } from "next/headers";
import { db, schema } from "./db/client";
import { and, asc, eq } from "drizzle-orm";
import { DEALER_ACTIVE_ID_COOKIE } from "./constants";

export async function listDealerIdsForTenant(tenantId: string) {
  return db
    .select()
    .from(schema.dealerIds)
    .where(eq(schema.dealerIds.tenantId, tenantId))
    .orderBy(asc(schema.dealerIds.name));
}

export async function getActiveDealerIdForTenant(
  tenantId: string,
): Promise<string | null> {
  const all = await listDealerIdsForTenant(tenantId);
  if (all.length === 0) return null;

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(DEALER_ACTIVE_ID_COOKIE)?.value;
  if (cookieVal && all.find((d) => d.id === cookieVal)) return cookieVal;

  const fallback = all.find((d) => d.isActive)?.id ?? all[0].id;
  try {
    cookieStore.set(DEALER_ACTIVE_ID_COOKIE, fallback, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    // Read-only context — heals on next write
  }
  return fallback;
}

export async function setActiveDealerIdForTenant(id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEALER_ACTIVE_ID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
}
```

- [ ] **Step 3: Write the dashboard page**

Create `app/dealer/dashboard/page.tsx`:

```typescript
import { getDealerDashboardStats } from "./actions";
import { KpiCard } from "@/components/feature/kpi-card";
import { Smartphone, CalendarDays, Package } from "lucide-react";

export default async function DealerDashboardPage() {
  const stats = await getDealerDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {stats.dealerName && (
          <p className="text-sm text-muted-foreground">{stats.dealerName}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Today's Activations"
          value={stats.todayActivations}
          icon={Smartphone}
        />
        <KpiCard
          title="Month Activations"
          value={stats.monthActivations}
          icon={CalendarDays}
        />
        <KpiCard
          title="Purchase Records"
          value={stats.totalStock}
          icon={Package}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/dashboard|dealer-tenant"
```

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add app/dealer/dashboard/ lib/dealer-tenant.ts
git commit -m "feat(phase2): add dealer dashboard with activation and stock KPIs"
```

---

## Task 10: Create dealer activations page

**Files:**
- Create: `app/dealer/activations/actions.ts`
- Create: `app/dealer/activations/page.tsx`
- Create: `app/dealer/activations/dealer-activation-form.tsx`

Reuses the query functions from Phase 1's `lib/db/queries/activations.ts` with `tenantId` from the dealer session.

- [ ] **Step 1: Write the server actions**

Create `app/dealer/activations/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import {
  listActivationsForDealer,
  createActivation,
  deleteActivation,
} from "@/lib/db/queries/activations";
import { listModels } from "@/lib/db/queries/models";
import { logToAudit } from "@/lib/audit";
import { z } from "zod";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function listDealerActivationsAction() {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { activations: [], models: [] };

  const [activations, models] = await Promise.all([
    listActivationsForDealer(tenantId, dealerId),
    listModels(),
  ]);
  return { activations, models };
}

const CreateSchema = z.object({
  modelId: z.string().min(1),
  imei: z.string().min(15).max(17),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salePrice: z.coerce.number().positive(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
});

export type ActivationFormState = { error?: string; success?: boolean };

export async function createDealerActivationAction(
  _prev: ActivationFormState,
  formData: FormData,
): Promise<ActivationFormState> {
  const session = await requireSession();
  const { tenantId, userId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { error: "No active dealer ID selected." };

  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  try {
    await createActivation({
      tenantId,
      dealerId,
      modelId: d.modelId,
      imei: d.imei,
      activationDate: d.activationDate,
      salePrice: d.salePrice,
      customerName: d.customerName ?? null,
      customerPhone: d.customerPhone ?? null,
    });
    await logToAudit("dealer_activation_created", { tenantId, dealerId, imei: d.imei, userId });
  } catch (err) {
    await logToAudit("dealer_activation_error", { tenantId, dealerId, error: String(err), userId });
    throw new Error("Failed to create activation", { cause: err });
  }

  revalidatePath("/dealer/activations");
  return { success: true };
}

export async function deleteDealerActivationAction(id: string): Promise<void> {
  const session = await requireSession();
  const { tenantId, role, userId } = session;
  if (role === "exec") throw new Error("Exec users cannot delete activations.");

  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");

  try {
    await deleteActivation(id, dealerId, tenantId);
    await logToAudit("dealer_activation_deleted", { tenantId, dealerId, id, userId });
  } catch (err) {
    await logToAudit("dealer_activation_delete_error", { tenantId, id, error: String(err), userId });
    throw new Error("Failed to delete activation", { cause: err });
  }

  revalidatePath("/dealer/activations");
}
```

- [ ] **Step 2: Write the activation form**

Create `app/dealer/activations/dealer-activation-form.tsx`:

```typescript
"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  createDealerActivationAction,
  type ActivationFormState,
} from "./actions";

interface Props {
  models: { id: string; name: string }[];
}

export function DealerActivationForm({ models }: Props) {
  const [state, formAction, pending] = useActionState<ActivationFormState, FormData>(
    createDealerActivationAction,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Add Activation</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="modelId">
            Model
          </label>
          <select
            id="modelId"
            name="modelId"
            required
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="imei">
            IMEI
          </label>
          <Input
            id="imei"
            name="imei"
            minLength={15}
            maxLength={17}
            required
            disabled={pending}
            placeholder="359123456789012"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="activationDate">
            Date
          </label>
          <Input
            id="activationDate"
            name="activationDate"
            type="date"
            defaultValue={today}
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="salePrice">
            Sale Price (PKR)
          </label>
          <Input
            id="salePrice"
            name="salePrice"
            type="number"
            min={1}
            required
            disabled={pending}
            placeholder="45000"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="customerName">
            Customer Name
          </label>
          <Input
            id="customerName"
            name="customerName"
            disabled={pending}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="customerPhone">
            Customer Phone
          </label>
          <Input
            id="customerPhone"
            name="customerPhone"
            disabled={pending}
            placeholder="Optional"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">Activation saved.</p>
      )}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Add Activation"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the activations page**

Create `app/dealer/activations/page.tsx`:

```typescript
import { listDealerActivationsAction } from "./actions";
import { DealerActivationForm } from "./dealer-activation-form";
import { deleteDealerActivationAction } from "./actions";
import { getDealerSession } from "@/lib/dealer-auth";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DealerActivationsPage() {
  const [session, data] = await Promise.all([
    getDealerSession(),
    listDealerActivationsAction(),
  ]);
  const isAdmin = session?.role === "admin";
  const { activations, models } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Activations</h1>

      <DealerActivationForm models={models.map((m) => ({ id: m.id, name: m.name }))} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {activations.length} record{activations.length !== 1 ? "s" : ""}
        </h2>
        {activations.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{a.imei}</p>
              <p className="text-xs text-muted-foreground">
                {a.modelId} &middot; {format(new Date(a.activationDate), "dd MMM yyyy")}
              </p>
            </div>
            {isAdmin && (
              <form
                action={async () => {
                  "use server";
                  await deleteDealerActivationAction(a.id);
                }}
              >
                <Button type="submit" variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </form>
            )}
          </div>
        ))}
        {activations.length === 0 && (
          <p className="text-sm text-muted-foreground">No activations yet.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/activations"
```

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add app/dealer/activations/
git commit -m "feat(phase2): add dealer activations page with add/delete"
```

---

## Task 11: Create dealer IDs page

**Files:**
- Create: `app/dealer/ids/actions.ts`
- Create: `app/dealer/ids/page.tsx`

- [ ] **Step 1: Write the actions**

Create `app/dealer/ids/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getDealerSession } from "@/lib/dealer-auth";
import {
  listDealerIdsForTenant,
  setActiveDealerIdForTenant,
} from "@/lib/dealer-tenant";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getDealerIdsAction() {
  const session = await requireSession();
  return listDealerIdsForTenant(session.tenantId);
}

export async function setActiveDealerAction(id: string): Promise<void> {
  const session = await requireSession();
  // Validate the id belongs to this tenant
  const all = await listDealerIdsForTenant(session.tenantId);
  if (!all.find((d) => d.id === id)) throw new Error("Invalid dealer ID.");
  await setActiveDealerIdForTenant(id);
  revalidatePath("/dealer");
}
```

- [ ] **Step 2: Write the page**

Create `app/dealer/ids/page.tsx`:

```typescript
import { getDealerIdsAction, setActiveDealerAction } from "./actions";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { getDealerSession } from "@/lib/dealer-auth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";

export default async function DealerIdsPage() {
  const session = await getDealerSession();
  if (!session) return null;

  const [ids, activeId] = await Promise.all([
    getDealerIdsAction(),
    getActiveDealerIdForTenant(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dealer IDs</h1>
        <p className="text-sm text-muted-foreground">
          Select the active dealer ID for this session.
        </p>
      </div>

      <div className="space-y-2">
        {ids.map((d) => {
          const isActive = d.id === activeId;
          return (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {isActive ? (
                  <CheckCircle2 className="size-5 text-primary" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  {d.note && (
                    <p className="text-xs text-muted-foreground">{d.note}</p>
                  )}
                </div>
              </div>
              {!isActive && (
                <form
                  action={async () => {
                    "use server";
                    await setActiveDealerAction(d.id);
                  }}
                >
                  <Button type="submit" variant="outline" size="sm">
                    Select
                  </Button>
                </form>
              )}
            </div>
          );
        })}
        {ids.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No dealer IDs found. The administrator must add dealer IDs for your account.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "dealer/ids"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add app/dealer/ids/
git commit -m "feat(phase2): add dealer IDs page with active ID selector"
```

---

## Task 12: Add placeholder pages for purchases and inventory

The purchases and inventory pages follow the exact same pattern as activations. For Phase 2, add stubs so the nav links don't 404.

**Files:**
- Create: `app/dealer/purchases/page.tsx`
- Create: `app/dealer/inventory/page.tsx`

- [ ] **Step 1: Write stub pages**

Create `app/dealer/purchases/page.tsx`:

```typescript
export default function DealerPurchasesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Purchases</h1>
      <p className="text-sm text-muted-foreground">Coming soon in Phase 2 implementation.</p>
    </div>
  );
}
```

Create `app/dealer/inventory/page.tsx`:

```typescript
export default function DealerInventoryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <p className="text-sm text-muted-foreground">Coming soon in Phase 2 implementation.</p>
    </div>
  );
}
```

- [ ] **Step 2: Full type check**

```powershell
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add app/dealer/purchases/ app/dealer/inventory/
git commit -m "feat(phase2): add stub pages for purchases and inventory"
```

---

## Task 13: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```powershell
npm run dev
```

- [ ] **Step 2: Verify login page loads**

Open `http://localhost:3000/dealer/login`. Should see email+password form.

- [ ] **Step 3: Verify unauthenticated redirect**

Open `http://localhost:3000/dealer/dashboard` directly. Should redirect to `/dealer/login`.

- [ ] **Step 4: Verify admin redirect**

Open `http://localhost:3000/admin/dealers` directly. Should redirect to `/unlock`.

- [ ] **Step 5: Verify wrong credentials rejected**

Submit login form with wrong email/password. Should show "Invalid email or password." error.

- [ ] **Step 6: Seed a test dealer and log in** (requires Phase 1's seed + DB to be running)

Use the Supabase dashboard or `npm run db:seed` to create a test `dealer_tenants` row and a `dealer_users` row with bcrypt-hashed password. Then log in via `/dealer/login`.

Expected: redirect to `/dealer/dashboard` with KPI cards showing.

- [ ] **Step 7: Verify expired subscription lock**

Temporarily set `dealer_tenants.status = 'expired'` in Supabase. Log out and back in. Should be redirected to `/dealer/expired`.

- [ ] **Step 8: Final commit tag**

```powershell
git tag phase2-complete
```

---

## Notes for Remaining Dealer Pages

`/dealer/purchases` and `/dealer/inventory` follow the identical pattern to `/dealer/activations`:

1. `actions.ts`: `requireSession()` → get `tenantId` → get `dealerId` → call query function
2. `page.tsx`: Server component, fetches data via actions, renders list + form
3. Form: Client component using `useActionState`

The query functions are already tenant-scoped from Phase 1:
- Purchases: `listPurchases({tenantId, dealerId})`, `createPurchase({tenantId, ...})`
- Inventory: `listInventoryForDealer(tenantId, dealerId)`
