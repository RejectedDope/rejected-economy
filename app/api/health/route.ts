import { NextResponse } from "next/server";
import { envDiagnostics, supabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// Diagnostics endpoint — confirms env vars are wired correctly in production.
// Never exposes actual key values, only presence/format status.
export async function GET() {
  const diag = envDiagnostics();

  // Validate URL format
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlValid = url.startsWith("https://") && url.includes(".supabase.co");

  // Validate key format (Supabase anon keys are JWTs: 3 base64 segments)
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const keySegments = key.split(".");
  const keyLooksLikeJwt = keySegments.length === 3 && keySegments.every((s) => s.length > 0);

  const status = supabaseConfigured && urlValid && keyLooksLikeJwt ? "ok" : "misconfigured";

  return NextResponse.json({
    status,
    supabase_configured: supabaseConfigured,
    url_valid: urlValid,
    key_is_jwt: keyLooksLikeJwt,
    env: diag,
    timestamp: new Date().toISOString(),
  });
}
