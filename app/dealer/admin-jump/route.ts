import { NextRequest, NextResponse } from "next/server";

// Hidden route — navigating here takes the owner back to the admin panel.
// The admin panel's own PIN-guard handles re-authentication if the session has lapsed.
export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/admin`);
}
