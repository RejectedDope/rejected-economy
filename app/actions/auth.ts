"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signInAction(
  email: string,
  password: string
): Promise<AuthResult> {
  logger.info("auth", "Sign in attempt", { email });

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.warn("auth", "Sign in failed", { email, error: error.message, code: error.code });
      return { ok: false, error: error.message };
    }

    logger.info("auth", "Sign in successful", { userId: data.user?.id, email });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication service unavailable";
    logger.error("auth", "Sign in threw", err);
    return { ok: false, error: message };
  }
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUpAction(
  email: string,
  password: string,
  emailRedirectTo: string
): Promise<AuthResult & { requiresConfirmation?: boolean }> {
  logger.info("auth", "Sign up attempt", { email });

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      logger.warn("auth", "Sign up failed", { email, error: error.message, code: error.code });
      return { ok: false, error: error.message };
    }

    // identities empty = email already exists (Supabase soft-fails duplicate signups)
    if (data.user && data.user.identities?.length === 0) {
      logger.warn("auth", "Sign up attempted for existing account", { email });
      return { ok: false, error: "An account with this email already exists. Try signing in instead." };
    }

    const requiresConfirmation = !data.session;
    logger.info("auth", "Sign up successful", {
      userId: data.user?.id,
      email,
      requiresConfirmation,
    });

    return { ok: true, requiresConfirmation };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration service unavailable";
    logger.error("auth", "Sign up threw", err);
    return { ok: false, error: message };
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn("auth", "Sign out error", { userId: user?.id, error: error.message });
      return { ok: false, error: error.message };
    }

    logger.info("auth", "Sign out successful", { userId: user?.id });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign out failed";
    logger.error("auth", "Sign out threw", err);
    return { ok: false, error: message };
  }
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<{
  user: { id: string; email: string | undefined } | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) return { user: null, error: error.message };
    if (!user) return { user: null };

    return { user: { id: user.id, email: user.email } };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : "Auth check failed" };
  }
}
