import { NextRequest, NextResponse } from "next/server";
import { parseDealerToken } from "./lib/dealer-session";
import { isDealerAppUserAgent } from "./lib/is-dealer-app";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── Installed dealer app: force dealer-only login, zero admin path ────────
  // The Capacitor app appends a UA marker (capacitor.config.ts) so only requests
  // from the installed app take this branch — normal web browsing is untouched.
  if (isDealerAppUserAgent(req.headers.get("user-agent"))) {
    if (pathname === "/" || pathname === "/unlock" || pathname === "/login") {
      const raw = req.cookies.get("dealer_session")?.value;
      const session = raw ? await parseDealerToken(raw) : null;
      const dest = session && session.status !== "expired" && session.status !== "suspended"
        ? "/dealer/dashboard"
        : "/dealer/login";
      return NextResponse.redirect(new URL(dest, req.url));
    }
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
    if (session.status === "active" && session.expiresAt) {
      const daysLeft = Math.ceil(
        (new Date(session.expiresAt).getTime() - Date.now()) / 86400000,
      );
      if (daysLeft <= 7 && daysLeft > 0) {
        res.headers.set("x-expiry-soon", String(daysLeft));
      }
    }
    res.headers.set("x-dealer-tenant-id", session.tenantId);
    res.headers.set("x-dealer-user-id", session.userId);
    res.headers.set("x-dealer-role", session.role);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/unlock", "/login", "/dealer/:path*"],
};
