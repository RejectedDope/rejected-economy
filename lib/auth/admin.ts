// ============================================================
// RESALEIQ — Admin Authentication Guard
// Server-side only. Never import in client components.
//
// SECURITY MODEL
// ==============
// Admin access is enforced in three independent layers:
//
//   Layer 1 — Middleware (proxy.ts):
//     /admin/* redirects to /login if no Supabase session cookie.
//     Fastest rejection — happens before page render.
//
//   Layer 2 — Admin Layout (app/admin/layout.tsx):
//     Calls supabase.auth.getUser() server-side (validates token
//     against Supabase, not just cookie presence). Redirects to
//     /login if user is null.
//
//   Layer 3 — Per-page guard (this module):
//     Individual pages call requireAdmin() for defense-in-depth.
//     Returns a typed result — pages can render appropriate errors
//     rather than crashing silently.
//
// Layer 3 is redundant by design. If the layout breaks or gets
// bypassed (e.g. during a framework upgrade), pages still protect
// themselves.
//
// FUTURE ROLES
// ============
// Currently, admin = any authenticated user. When multi-user access
// is needed, add a `user_roles` table and check role in requireAdmin().
// The return type already supports this extension.
// ============================================================

import { logger } from "@/lib/logger";

export type AdminAuthResult =
  | { ok: true;  userId: string; email: string | undefined }
  | { ok: false; reason: "unauthenticated" | "supabase_error" | "unconfigured"; message: string };

/**
 * Verifies the current request is from an authenticated user.
 * Must be called from a Server Component or Server Action.
 *
 * Usage:
 *   const auth = await requireAdmin();
 *   if (!auth.ok) { redirect("/login"); }
 *   // auth.userId is safe to use
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const { supabaseConfigured } = await import("@/lib/env");

  if (!supabaseConfigured) {
    return {
      ok: false,
      reason: "unconfigured",
      message: "Supabase is not configured — admin panel unavailable in this environment",
    };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // getUser() validates the token against Supabase Auth server.
    // This is safe against tampered cookies — unlike getSession() which
    // only reads the cookie without server validation.
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      logger.error("auth", "Admin auth check failed", error, { errorCode: error.message });
      return {
        ok: false,
        reason: "supabase_error",
        message: "Authentication check failed — please try again",
      };
    }

    if (!user) {
      return {
        ok: false,
        reason: "unauthenticated",
        message: "Authentication required",
      };
    }

    return {
      ok: true,
      userId: user.id,
      email: user.email,
    };
  } catch (err) {
    logger.error("auth", "Unexpected error in admin auth guard", err);
    return {
      ok: false,
      reason: "supabase_error",
      message: "Authentication system error",
    };
  }
}

/**
 * Checks if a Supabase error indicates an RLS/permission violation.
 * Useful for distinguishing "no data" from "access denied" in query results.
 */
export function isPermissionError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42501" ||       // PostgreSQL: insufficient_privilege
    error.code === "PGRST301" ||    // PostgREST: JWT expired
    error.code === "PGRST302" ||    // PostgREST: JWT invalid
    (error.message?.includes("permission denied") ?? false) ||
    (error.message?.includes("row-level security") ?? false)
  );
}
