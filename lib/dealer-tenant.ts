import "server-only";
import { cookies } from "next/headers";
import { db, schema } from "./db/client";
import { and, asc, eq } from "drizzle-orm";
import { DEALER_ACTIVE_ID_COOKIE } from "./constants";

export async function getTenantById(tenantId: string) {
  const rows = await db
    .select()
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDealerIdsForTenant(tenantId: string) {
  return db
    .select()
    .from(schema.dealerIds)
    .where(and(eq(schema.dealerIds.tenantId, tenantId), eq(schema.dealerIds.isActive, true)))
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

  const fallback = all[0].id;
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
