import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .eq("key", "public_gallery_enabled")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = row not found
      console.error("[admin/settings] GET error:", error);
      return NextResponse.json({ error: "Chyba databázy" }, { status: 500 });
    }

    return NextResponse.json({
      public_gallery_enabled: data?.value ?? false,
    });
  } catch (err) {
    console.error("[admin/settings] GET error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (typeof body.public_gallery_enabled !== "boolean") {
      return NextResponse.json(
        { error: "Neplatná hodnota nastavenia" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Upsert — create or update the setting
    const { error } = await supabase.from("settings").upsert(
      {
        key: "public_gallery_enabled",
        value: body.public_gallery_enabled,
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("[admin/settings] PUT error:", error);
      return NextResponse.json(
        { error: "Chyba pri ukladaní nastavenia" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      public_gallery_enabled: body.public_gallery_enabled,
    });
  } catch (err) {
    console.error("[admin/settings] PUT error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
