import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db, schema } from "./db/client";
import { eq } from "drizzle-orm";
import { cache } from "react";
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

// H-B: cached per-request so multiple calls in one render don't hit DB repeatedly
const checkTenantActive = cache(async (tenantId: string): Promise<boolean> => {
  const rows = await db
    .select({ status: schema.dealerTenants.status })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, tenantId))
    .limit(1);
  if (rows.length === 0) return false;
  const { status } = rows[0];
  return status === "active" || status === "grace";
});

export async function getDealerSession(): Promise<ParsedDealerToken | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEALER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = await parseDealerToken(token);
  if (!parsed) return null;
  const active = await checkTenantActive(parsed.tenantId);
  if (!active) return null;
  return parsed;
}
