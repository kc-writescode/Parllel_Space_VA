import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Restaurant creation and onboarding routing are handled client-side
      // by the use-restaurant hook (browser → Supabase directly, no server
      // DB calls which time out due to undici network issues).
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
