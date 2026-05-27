import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ─── eBay OAuth Callback ──────────────────────────────────────────────────────
// Exchanges the authorization code for access + refresh tokens.
// Stores tokens in marketplace_connections with service client.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const successUrl   = `${redirectBase}/settings/integrations?connected=ebay`;
  const failureUrl   = `${redirectBase}/settings/integrations?error=ebay_auth_failed`;

  if (error || !code || !state) {
    logger.warn("runtime", "eBay OAuth callback rejected", { error, hasCode: !!code });
    return NextResponse.redirect(failureUrl);
  }

  const clientId     = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const redirectUri  = process.env.EBAY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    logger.error("runtime", "eBay OAuth env vars missing");
    return NextResponse.redirect(failureUrl);
  }

  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
    if (!userId) throw new Error("missing userId");

    // Reject states older than 10 minutes
    const age = Date.now() - (decoded.ts ?? 0);
    if (age > 10 * 60 * 1000) throw new Error("state expired");
  } catch (err) {
    logger.warn("runtime", "eBay OAuth state invalid", { error: String(err) });
    return NextResponse.redirect(failureUrl);
  }

  // Exchange code for tokens
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error("runtime", "eBay token exchange failed", { status: tokenRes.status, body });
      return NextResponse.redirect(failureUrl);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const now = new Date().toISOString();

    // Fetch eBay account info to get display name
    let accountName: string | null = null;
    try {
      const userRes = await fetch("https://apiz.ebay.com/commerce/identity/v1/user/", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json() as { username?: string };
        accountName = userData.username ?? null;
      }
    } catch {
      // Non-fatal — accountName stays null
    }

    const { isServiceClientConfigured } = await import("@/lib/supabase/service");
    if (!isServiceClientConfigured()) {
      logger.warn("runtime", "Service client not configured — cannot persist eBay tokens");
      return NextResponse.redirect(failureUrl);
    }

    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();

    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        user_id:          userId,
        platform:         "ebay",
        status:           "connected",
        access_token:     tokens.access_token,
        refresh_token:    tokens.refresh_token,
        token_expires_at: expiresAt,
        account_name:     accountName,
        sync_enabled:     true,
        connected_at:     now,
        updated_at:       now,
      }, { onConflict: "user_id,platform" });

    if (upsertError) {
      logger.error("runtime", "Failed to persist eBay tokens", { error: upsertError.message });
      return NextResponse.redirect(failureUrl);
    }

    // Track telemetry event (fire-and-forget)
    import("@/lib/telemetry/events").then(({ trackEvent }) => {
      trackEvent(userId, "marketplace_connected", "integration", { platform: "ebay" }).catch(() => {});
    }).catch(() => {});

    logger.info("runtime", "eBay connection established", { userId });
    return NextResponse.redirect(successUrl);
  } catch (err) {
    logger.error("runtime", "eBay OAuth callback error", { error: String(err) });
    return NextResponse.redirect(failureUrl);
  }
}
