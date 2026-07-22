import "server-only";
import { cookies } from "next/headers";
import { db, schema } from "./db/client";
import { and, asc, eq } from "drizzle-orm";

const ACTIVE_DEALER_COOKIE = "oppo_active_dealer";

export const OWNER_TENANT_ID = "owner";

/**
 * Owner-tenant Dealer IDs.
 *
 * Hidden "favour" IDs are excluded by default: they must not appear in the ID
 * switcher, dashboards or reports. Pass `includeHidden` only where a hidden ID
 * legitimately belongs — the IDs management page (so it can be un-hidden), the
 * inter-ID transfer pickers, and name lookups for movements already on screen.
 */
export async function listDealerIds(opts?: { includeHidden?: boolean }) {
  return db
    .select()
    .from(schema.dealerIds)
    .where(
      opts?.includeHidden
        ? eq(schema.dealerIds.tenantId, OWNER_TENANT_ID)
        : and(eq(schema.dealerIds.tenantId, OWNER_TENANT_ID), eq(schema.dealerIds.isHidden, false)),
    )
    .orderBy(asc(schema.dealerIds.name));
}

export async function getDealerIdById(id: string) {
  const rows = await db
    .select()
    .from(schema.dealerIds)
    .where(eq(schema.dealerIds.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Returns the currently selected dealer ID, falling back to the first
 *  active one (or any) when no cookie has been set or the cookie is stale.
 *  Self-heals: if the cookied ID was deleted, rewrites the cookie to the fallback. */
export async function getActiveDealerId(): Promise<schema.DealerId["id"] | null> {
  const all = await listDealerIds();
  if (all.length === 0) return null;
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(ACTIVE_DEALER_COOKIE)?.value;
  if (cookieVal && all.find((d) => d.id === cookieVal)) {
    return cookieVal;
  }
  const fallback = all.find((d) => d.isActive)?.id ?? all[0].id;
  // Self-heal stale cookie. Cookies in Server Components can only be set inside
  // Server Actions or Route Handlers; ignore errors silently.
  try {
    cookieStore.set(ACTIVE_DEALER_COOKIE, fallback, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    /* Read-only context — fine, will heal next write */
  }
  return fallback;
}

export async function getActiveDealer(): Promise<schema.DealerId | null> {
  const id = await getActiveDealerId();
  if (!id) return null;
  return getDealerIdById(id);
}

export async function setActiveDealerId(id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_DEALER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 3600,
  });
}
