# OPPO SaaS Phase 3 — Owner Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the owner super-admin panel at `/admin/*` so the owner can create dealer accounts, view their KPI dashboards, renew subscriptions, and see revenue summary.

**Architecture:** All `/admin/*` routes are server components protected by `isAuthenticated()`. The middleware (Phase 2) checks `oppo_session` cookie existence; the layout does the full HMAC verify. Dealer creation generates a temp password (bcrypt-hashed), stores it in `dealer_users`, and displays it once in a credentials modal. No SMTP — only `mailto:` links.

**Tech Stack:** Existing `isAuthenticated()` from `lib/auth.ts`; `bcryptjs` (already installed); Drizzle ORM on Supabase Postgres.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/admin/dealers.ts` | Create | Server-only: CRUD for dealer tenants and users |
| `app/admin/layout.tsx` | Create | Auth gate: full isAuthenticated() verify |
| `app/admin/page.tsx` | Create | Redirect /admin → /admin/dealers |
| `app/admin/dealers/page.tsx` | Create | Tenant list table with status badges |
| `app/admin/dealers/new/page.tsx` | Create | Create tenant form + credentials display |
| `app/admin/dealers/new/actions.ts` | Create | createTenantAction |
| `app/admin/dealers/[id]/page.tsx` | Create | Dealer KPI dashboard (read-only) |
| `app/admin/dealers/[id]/renew/page.tsx` | Create | Extend subscription form |
| `app/admin/dealers/[id]/renew/actions.ts` | Create | renewTenantAction |
| `app/admin/revenue/page.tsx` | Create | Summary: active/expiring/suspended counts |

---

## Task 1: Create lib/admin/dealers.ts

**Files:**
- Create: `lib/admin/dealers.ts`

All functions are server-only and assume Postgres schema from Phase 1.

- [ ] **Step 1: Write the file**

Create `lib/admin/dealers.ts`:

```typescript
import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db/client";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenantListRow {
  id: string;
  businessName: string;
  ownerEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  userCount: number;
}

export interface TenantDetail {
  id: string;
  businessName: string;
  ownerEmail: string;
  planMonths: number;
  startedAt: string;
  expiresAt: string;
  status: string;
  createdAt: string;
  users: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }[];
}

export interface CreateTenantInput {
  businessName: string;
  ownerEmail: string;
  planMonths: number;
  adminEmail: string;
}

export interface CreateTenantResult {
  tenantId: string;
  userId: string;
  tempPassword: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listTenants(): Promise<TenantListRow[]> {
  const userCounts = db
    .select({
      tenantId: schema.dealerUsers.tenantId,
      n: count().as("n"),
    })
    .from(schema.dealerUsers)
    .groupBy(schema.dealerUsers.tenantId)
    .as("uc");

  const rows = await db
    .select({
      id: schema.dealerTenants.id,
      businessName: schema.dealerTenants.businessName,
      ownerEmail: schema.dealerTenants.ownerEmail,
      status: schema.dealerTenants.status,
      expiresAt: schema.dealerTenants.expiresAt,
      createdAt: schema.dealerTenants.createdAt,
      userCount: sql<number>`coalesce(${userCounts.n}, 0)`,
    })
    .from(schema.dealerTenants)
    .leftJoin(userCounts, eq(userCounts.tenantId, schema.dealerTenants.id))
    .where(sql`${schema.dealerTenants.id} != 'owner'`)
    .orderBy(desc(schema.dealerTenants.createdAt));

  return rows.map((r) => ({ ...r, userCount: Number(r.userCount) }));
}

export async function getTenantById(id: string): Promise<TenantDetail | null> {
  const tenantRows = await db
    .select()
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, id))
    .limit(1);

  if (tenantRows.length === 0) return null;
  const tenant = tenantRows[0];

  const userRows = await db
    .select({
      id: schema.dealerUsers.id,
      email: schema.dealerUsers.email,
      role: schema.dealerUsers.role,
      isActive: schema.dealerUsers.isActive,
      createdAt: schema.dealerUsers.createdAt,
    })
    .from(schema.dealerUsers)
    .where(eq(schema.dealerUsers.tenantId, id))
    .orderBy(asc(schema.dealerUsers.email));

  return { ...tenant, users: userRows };
}

export async function createTenant(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const now = new Date().toISOString();
  const startedAt = now.slice(0, 10);
  const expiresAt = addMonths(startedAt, input.planMonths);

  await db.insert(schema.dealerTenants).values({
    id: tenantId,
    businessName: input.businessName.trim(),
    ownerEmail: input.ownerEmail.toLowerCase().trim(),
    planMonths: input.planMonths,
    startedAt,
    expiresAt,
    status: "active",
    createdAt: now,
  });

  await db.insert(schema.dealerUsers).values({
    id: userId,
    tenantId,
    email: input.adminEmail.toLowerCase().trim(),
    passwordHash,
    role: "admin",
    isActive: true,
    createdAt: now,
  });

  await logAudit({
    action: "admin_tenant_created",
    summary: `Created dealer tenant: ${input.businessName}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
    payload: { businessName: input.businessName, adminEmail: input.adminEmail, planMonths: input.planMonths },
  });

  return { tenantId, userId, tempPassword };
}

export async function renewTenant(id: string, months: number): Promise<void> {
  const rows = await db
    .select({ expiresAt: schema.dealerTenants.expiresAt, status: schema.dealerTenants.status })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, id))
    .limit(1);

  if (rows.length === 0) throw new Error(`Tenant ${id} not found`);

  const current = rows[0];
  // If already expired, renew from today; otherwise extend from current expiry.
  const base =
    current.status === "expired" || current.expiresAt < new Date().toISOString().slice(0, 10)
      ? new Date().toISOString().slice(0, 10)
      : current.expiresAt;

  const newExpiry = addMonths(base, months);

  await db
    .update(schema.dealerTenants)
    .set({ expiresAt: newExpiry, status: "active" })
    .where(eq(schema.dealerTenants.id, id));

  await logAudit({
    action: "admin_tenant_renewed",
    summary: `Renewed tenant ${id} by ${months} months to ${newExpiry}`,
    entityType: "dealer_tenant",
    entityId: id,
    payload: { months, newExpiry },
  });
}

export async function getRevenueSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const graceCutoff = addDays(today, -7); // 7-day grace window

  const rows = await db
    .select({
      status: schema.dealerTenants.status,
      expiresAt: schema.dealerTenants.expiresAt,
    })
    .from(schema.dealerTenants)
    .where(sql`${schema.dealerTenants.id} != 'owner'`);

  let active = 0;
  let expiringSoon = 0; // expires within 30 days
  let grace = 0;
  let expired = 0;
  let suspended = 0;

  const in30Days = addDays(today, 30);

  for (const row of rows) {
    if (row.status === "suspended") { suspended++; continue; }
    if (row.status === "grace") { grace++; continue; }
    if (row.status === "expired") { expired++; continue; }
    // active
    active++;
    if (row.expiresAt <= in30Days) expiringSoon++;
  }

  return { total: rows.length, active, expiringSoon, grace, expired, suspended };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join("");
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/dealers"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add lib/admin/dealers.ts
git commit -m "feat(phase3): add admin dealer management functions"
```

---

## Task 2: Create admin layout + root redirect

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Write the layout**

Create `app/admin/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/feature/sidebar";
import { TopBar } from "@/components/feature/top-bar";
import { BottomNav } from "@/components/feature/bottom-nav";

// Admin nav items injected into the owner sidebar.
// The existing Sidebar renders NAV_ITEMS from nav-config.ts.
// We reuse the full owner layout — admin routes sit alongside owner routes.

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/unlock");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar dealers={[]} activeDealerId={null} />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
          <nav className="flex flex-col gap-1 p-3">
            {[
              { href: "/admin/dealers", label: "Dealers" },
              { href: "/admin/revenue", label: "Revenue" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the redirect page**

Create `app/admin/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/dealers");
}
```

- [ ] **Step 3: Commit**

```powershell
git add app/admin/
git commit -m "feat(phase3): add admin layout with auth gate"
```

---

## Task 3: Create /admin/dealers list page

**Files:**
- Create: `app/admin/dealers/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/admin/dealers/page.tsx`:

```typescript
import Link from "next/link";
import { listTenants } from "@/lib/admin/dealers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";
import { Plus } from "lucide-react";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "grace") return "secondary";
  if (status === "expired" || status === "suspended") return "destructive";
  return "outline";
}

function daysRemaining(expiresAt: string): number {
  return differenceInDays(parseISO(expiresAt), new Date());
}

export default async function AdminDealersPage() {
  const tenants = await listTenants();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dealers</h1>
        <Button asChild size="sm">
          <Link href="/admin/dealers/new">
            <Plus className="mr-1 size-4" />
            New Dealer
          </Link>
        </Button>
      </div>

      {tenants.length === 0 && (
        <p className="text-sm text-muted-foreground">No dealer accounts yet.</p>
      )}

      <div className="space-y-2">
        {tenants.map((t) => {
          const days = daysRemaining(t.expiresAt);
          return (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{t.businessName}</p>
                  <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.ownerEmail} &middot; {t.userCount} user{t.userCount !== 1 ? "s" : ""} &middot;{" "}
                  {days > 0 ? `${days} days left` : `expired ${Math.abs(days)} days ago`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/dealers/${t.id}`}>View</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/dealers/${t.id}/renew`}>Renew</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/dealers/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add app/admin/dealers/page.tsx
git commit -m "feat(phase3): add admin dealers list with status badges"
```

---

## Task 4: Create /admin/dealers/new (create tenant form + credentials)

**Files:**
- Create: `app/admin/dealers/new/actions.ts`
- Create: `app/admin/dealers/new/page.tsx`

- [ ] **Step 1: Write the server action**

Create `app/admin/dealers/new/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createTenant } from "@/lib/admin/dealers";
import { z } from "zod";

const Schema = z.object({
  businessName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  adminEmail: z.string().email(),
  planMonths: z.coerce.number().int().min(1).max(60),
});

export type CreateTenantState = {
  error?: string;
  credentials?: {
    tenantId: string;
    adminEmail: string;
    tempPassword: string;
    mailtoLink: string;
  };
};

export async function createTenantAction(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  let result: Awaited<ReturnType<typeof createTenant>>;
  try {
    result = await createTenant({
      businessName: d.businessName,
      ownerEmail: d.ownerEmail,
      adminEmail: d.adminEmail,
      planMonths: d.planMonths,
    });
  } catch (err) {
    throw new Error("Failed to create dealer account", { cause: err });
  }

  const subject = encodeURIComponent("Your OPPO Tracker Dealer Account");
  const body = encodeURIComponent(
    `Dear ${d.businessName},\n\nYour dealer account has been created.\n\nLogin URL: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.com"}/dealer/login\nEmail: ${d.adminEmail}\nTemp Password: ${result.tempPassword}\n\nPlease change your password after first login.\n\nRegards`,
  );
  const mailtoLink = `mailto:${d.adminEmail}?subject=${subject}&body=${body}`;

  return {
    credentials: {
      tenantId: result.tenantId,
      adminEmail: d.adminEmail,
      tempPassword: result.tempPassword,
      mailtoLink,
    },
  };
}
```

- [ ] **Step 2: Write the page (form + credentials reveal)**

Create `app/admin/dealers/new/page.tsx`:

```typescript
"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTenantAction, type CreateTenantState } from "./actions";
import { Copy, Mail } from "lucide-react";
import Link from "next/link";

export default function NewDealerPage() {
  const [state, formAction, pending] = useActionState<CreateTenantState, FormData>(
    createTenantAction,
    {},
  );

  if (state.credentials) {
    const c = state.credentials;
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dealer Created</h1>
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-base text-green-800 dark:text-green-200">
              Credentials — share these once, they will not be shown again
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <CredRow label="Email" value={c.adminEmail} />
            <CredRow label="Temp Password" value={c.tempPassword} mono />
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button asChild size="sm">
              <a href={c.mailtoLink}>
                <Mail className="mr-1 size-4" />
                Open in Mail
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/dealers">Back to dealers</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">New Dealer Account</h1>
      <form action={formAction} className="max-w-md">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Field id="businessName" label="Business Name" placeholder="Al-Hassan Electronics" />
            <Field id="ownerEmail" label="Owner Email" type="email" placeholder="owner@example.com" />
            <Field
              id="adminEmail"
              label="Admin Login Email"
              type="email"
              placeholder="admin@example.com"
            />
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="planMonths">
                Plan Duration (months)
              </label>
              <Input
                id="planMonths"
                name="planMonths"
                type="number"
                min={1}
                max={60}
                defaultValue={12}
                disabled={pending}
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Account"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/dealers">Cancel</Link>
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input id={id} name={id} type={type} placeholder={placeholder} required />
    </div>
  );
}

function CredRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  function copy() {
    navigator.clipboard.writeText(value).catch(() => {});
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
      <button type="button" onClick={copy} className="text-muted-foreground hover:text-foreground">
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/dealers/new"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add app/admin/dealers/new/
git commit -m "feat(phase3): add create dealer form with temp password credentials display"
```

---

## Task 5: Create /admin/dealers/[id] (dealer KPI view)

**Files:**
- Create: `app/admin/dealers/[id]/page.tsx`

This page shows the dealer's own KPI data using the existing query functions with the dealer's `tenantId`.

- [ ] **Step 1: Write the page**

Create `app/admin/dealers/[id]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantById } from "@/lib/admin/dealers";
import { db, schema } from "@/lib/db/client";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/feature/kpi-card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Smartphone, CalendarDays, Package } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

async function getTenantKpis(tenantId: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [todayRows, monthRows, purchaseRows] = await Promise.all([
    db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.activationDate, today),
        ),
      ),
    db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          gte(schema.activations.activationDate, monthStart),
          lte(schema.activations.activationDate, monthEnd),
        ),
      ),
    db
      .select({ c: count() })
      .from(schema.purchases)
      .where(eq(schema.purchases.tenantId, tenantId)),
  ]);

  return {
    todayActivations: todayRows[0]?.c ?? 0,
    monthActivations: monthRows[0]?.c ?? 0,
    totalPurchases: purchaseRows[0]?.c ?? 0,
  };
}

export default async function AdminDealerDetailPage({ params }: Props) {
  const { id } = await params;
  const [tenant, kpis] = await Promise.all([
    getTenantById(id),
    getTenantKpis(id),
  ]);

  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.businessName}</h1>
          <p className="text-sm text-muted-foreground">{tenant.ownerEmail}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/dealers/${id}/renew`}>Renew</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/dealers">Back</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Badge>{tenant.status}</Badge>
        <span className="text-muted-foreground">Expires: {tenant.expiresAt}</span>
        <span className="text-muted-foreground">&middot; Plan: {tenant.planMonths} months</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Today's Activations"
          value={kpis.todayActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label="Month Activations"
          value={kpis.monthActivations}
          icon={<CalendarDays className="size-4" />}
        />
        <KpiCard
          label="Total Purchases"
          value={kpis.totalPurchases}
          icon={<Package className="size-4" />}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Users</h2>
        <div className="space-y-2">
          {tenant.users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.role} &middot; {u.isActive ? "Active" : "Inactive"} &middot; joined{" "}
                  {u.createdAt.slice(0, 10)}
                </p>
              </div>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/dealers/\[id\]"
```

Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add "app/admin/dealers/[id]/page.tsx"
git commit -m "feat(phase3): add admin dealer detail page with KPI dashboard"
```

---

## Task 6: Create /admin/dealers/[id]/renew

**Files:**
- Create: `app/admin/dealers/[id]/renew/actions.ts`
- Create: `app/admin/dealers/[id]/renew/page.tsx`

- [ ] **Step 1: Write the renew action**

Create `app/admin/dealers/[id]/renew/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { renewTenant } from "@/lib/admin/dealers";
import { z } from "zod";

const Schema = z.object({
  months: z.coerce.number().int().min(1).max(60),
  tenantId: z.string().min(1),
});

export type RenewState = { error?: string };

export async function renewTenantAction(
  _prev: RenewState,
  formData: FormData,
): Promise<RenewState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tenantId, months } = parsed.data;

  try {
    await renewTenant(tenantId, months);
  } catch (err) {
    throw new Error("Failed to renew subscription", { cause: err });
  }

  redirect(`/admin/dealers/${tenantId}`);
}
```

- [ ] **Step 2: Write the renew page**

Create `app/admin/dealers/[id]/renew/page.tsx`:

```typescript
"use client";

import { useActionState } from "react";
import { use } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { renewTenantAction, type RenewState } from "./actions";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default function RenewPage({ params }: Props) {
  const { id } = use(params);
  const [state, formAction, pending] = useActionState<RenewState, FormData>(
    renewTenantAction,
    {},
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Renew Subscription</h1>
      <form action={formAction} className="max-w-sm">
        <input type="hidden" name="tenantId" value={id} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extend by months</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="months">
                Months to add
              </label>
              <Input
                id="months"
                name="months"
                type="number"
                min={1}
                max={60}
                defaultValue={12}
                disabled={pending}
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Renewing…" : "Renew"}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/dealers/${id}`}>Cancel</Link>
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/dealers/\[id\]/renew"
```

Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add "app/admin/dealers/[id]/renew/"
git commit -m "feat(phase3): add admin subscription renewal form"
```

---

## Task 7: Create /admin/revenue summary page

**Files:**
- Create: `app/admin/revenue/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/admin/revenue/page.tsx`:

```typescript
import { getRevenueSummary } from "@/lib/admin/dealers";
import { KpiCard } from "@/components/feature/kpi-card";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Users } from "lucide-react";

export default async function AdminRevenuePage() {
  const s = await getRevenueSummary();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Revenue Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total Dealers"
          value={s.total}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Active"
          value={s.active}
          icon={<CheckCircle2 className="size-4" />}
        />
        <KpiCard
          label="Expiring in 30 Days"
          value={s.expiringSoon}
          icon={<Clock className="size-4" />}
          highlightZero
        />
        <KpiCard
          label="Grace Period"
          value={s.grace}
          icon={<AlertTriangle className="size-4" />}
          highlightZero
        />
        <KpiCard
          label="Expired"
          value={s.expired}
          icon={<XCircle className="size-4" />}
          highlightZero
        />
        <KpiCard
          label="Suspended"
          value={s.suspended}
          icon={<XCircle className="size-4" />}
          highlightZero
        />
      </div>
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
git add app/admin/revenue/
git commit -m "feat(phase3): add admin revenue summary page"
```

---

## Task 8: End-to-end smoke test

- [ ] **Step 1: Start dev server and navigate to `/admin/dealers`**

Should see the dealers list (empty if no tenants yet).

- [ ] **Step 2: Create a dealer account**

Click "New Dealer" → fill in form → submit. Should see credentials modal with email and temp password. Should show "Open in Mail" button with `mailto:` link.

- [ ] **Step 3: Verify dealer appears in list**

Navigate to `/admin/dealers`. New dealer should appear with "active" badge.

- [ ] **Step 4: View dealer KPI dashboard**

Click "View" → should see KPI cards with 0 values (no activity yet).

- [ ] **Step 5: Renew subscription**

Click "Renew" → enter 12 → submit. Should redirect to dealer detail with updated expiry.

- [ ] **Step 6: Test dealer login with created credentials**

Open `/dealer/login` → enter the admin email + temp password → should log in successfully.

- [ ] **Step 7: Verify owner admin auth guard**

Log out of owner session. Navigate to `/admin/dealers` → should redirect to `/unlock`.

- [ ] **Step 8: Commit tag**

```powershell
git tag phase3-complete
```
