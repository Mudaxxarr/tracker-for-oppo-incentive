import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Database backup is now managed by Supabase. Use the Supabase dashboard to download a backup." },
    { status: 410 }
  );
}
