import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearAdminCookie();
  // Redirect back to /admin using the request's own origin
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  return NextResponse.redirect(`${origin}/admin`, { status: 303 });
}
