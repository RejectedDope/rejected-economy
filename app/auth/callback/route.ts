import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles Supabase email confirmation and magic link callbacks.
// Supabase redirects here with ?code=... after the user clicks their confirmation email.
// We exchange the code for a session, then redirect to the intended destination.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Supabase may send error params (e.g. expired link)
  if (error) {
    const params = new URLSearchParams({
      error: "confirmation_failed",
      message: errorDescription ?? error,
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Successful confirmation — redirect to intended destination
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Code missing or exchange failed
  const params = new URLSearchParams({
    error: "auth_callback_failed",
    message: "The confirmation link is invalid or has expired. Please request a new one.",
  });
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}
