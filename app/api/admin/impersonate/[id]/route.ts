import { type NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { and, asc, eq } from "drizzle-orm";
import { makeDealerToken } from "@/lib/dealer-session";
import { ADMIN_PREVIEW_RETURN_COOKIE, DEALER_SESSION_COOKIE } from "@/lib/constants";
import { resolveManagerReturnPath } from "@/lib/admin/manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { id: tenantId } = await params;

  const [tenantRows, userRows] = await Promise.all([
    db
      .select({
        expiresAt: schema.dealerTenants.expiresAt,
        status: schema.dealerTenants.status,
      })
      .from(schema.dealerTenants)
      .where(eq(schema.dealerTenants.id, tenantId))
      .limit(1),
    db
      .select({ id: schema.dealerUsers.id, role: schema.dealerUsers.role })
      .from(schema.dealerUsers)
      .where(and(
        eq(schema.dealerUsers.tenantId, tenantId),
        eq(schema.dealerUsers.role, "admin"),
        eq(schema.dealerUsers.isActive, true),
      ))
      .orderBy(asc(schema.dealerUsers.createdAt))
      .limit(1),
  ]);

  if (tenantRows.length === 0 || userRows.length === 0) {
    return NextResponse.json({ error: "Tenant or user not found" }, { status: 404 });
  }

  const tenant = tenantRows[0];
  const user = userRows[0];

  const token = await makeDealerToken({
    tenantId,
    userId: user.id,
    role: user.role as "admin" | "exec",
    expiresAt: tenant.expiresAt,
    status: tenant.status as "active" | "grace" | "expired" | "suspended",
  });

  const response = NextResponse.redirect(new URL("/dealer/dashboard", req.url));
  response.cookies.set(DEALER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  const requestedReturnTo = req.nextUrl.searchParams.get("returnTo");
  if (requestedReturnTo) {
    response.cookies.set(
      ADMIN_PREVIEW_RETURN_COOKIE,
      resolveManagerReturnPath(requestedReturnTo, tenantId),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 3600,
        secure: process.env.NODE_ENV === "production",
      },
    );
  } else {
    response.cookies.delete(ADMIN_PREVIEW_RETURN_COOKIE);
  }
  return response;
}
