// ============================================================
// RESALEIQ — Environment Variable Validation
// Centralizes all env access. Fails fast with clear diagnostics.
// Import from here instead of calling process.env directly.
// ============================================================

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

// ─── Supabase ─────────────────────────────────────────────────────────────────

const rawSupabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? PLACEHOLDER_URL;
const rawSupabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PLACEHOLDER_KEY;

/**
 * True when Supabase is configured with real credentials.
 * False in local dev without a .env.local, or in preview deploys without env vars.
 * Use this guard before any Supabase query to avoid crashing on unconfigured builds.
 */
export const supabaseConfigured =
  rawSupabaseUrl !== PLACEHOLDER_URL &&
  rawSupabaseUrl.startsWith("https://") &&
  rawSupabaseKey !== PLACEHOLDER_KEY &&
  rawSupabaseKey.length > 20;

export const env = {
  supabase: {
    url: rawSupabaseUrl,
    anonKey: rawSupabaseKey,
    configured: supabaseConfigured,
  },
} as const;

// ─── Runtime validation (server-side only) ────────────────────────────────────

/**
 * Call at the top of server components or route handlers that require Supabase.
 * Returns a typed error object instead of throwing — lets callers render a
 * meaningful error state rather than crashing the entire page.
 */
export function requireSupabase(): { ok: true } | { ok: false; reason: string } {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL is not set" };
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL === PLACEHOLDER_URL) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL is still the placeholder value" };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set" };
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === PLACEHOLDER_KEY) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_ANON_KEY is still the placeholder value" };
  }
  return { ok: true };
}

/**
 * Diagnostic summary for server logs and error states.
 * Never exposes key values — only presence/absence status.
 */
export function envDiagnostics(): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? (process.env.NEXT_PUBLIC_SUPABASE_URL === PLACEHOLDER_URL ? "placeholder" : "set")
      : "missing",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === PLACEHOLDER_KEY ? "placeholder" : "set")
      : "missing",
    NODE_ENV: process.env.NODE_ENV ?? "unknown",
    VERCEL_ENV: process.env.VERCEL_ENV ?? "not-vercel",
  };
}
