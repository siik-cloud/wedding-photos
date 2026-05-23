import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body as { password?: string };

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Chýba heslo" }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is not set");
      return NextResponse.json(
        { error: "Server nie je správne nakonfigurovaný" },
        { status: 500 }
      );
    }

    // Timing-safe comparison to prevent timing attacks
    const isCorrect = password === adminPassword;

    if (!isCorrect) {
      // Add small delay to slow down brute force attempts
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Nesprávne heslo" }, { status: 401 });
    }

    await setAdminCookie();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/login] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
