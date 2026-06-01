"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type MarketplacePlatform =
  | "ebay"
  | "poshmark"
  | "mercari"
  | "depop"
  | "facebook"
  | "stockx"
  | "goat"
  | "whatnot"
  | "grailed";

export type ConnectionStatus = "connected" | "disconnected" | "expired" | "error" | "pending";

export type MarketplaceConnection = {
  id: string;
  platform: MarketplacePlatform;
  status: ConnectionStatus;
  account_name: string | null;
  account_id: string | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  sync_enabled: boolean;
  token_expires_at: string | null;
  connected_at: string | null;
  created_at: string;
};

export type FetchConnectionsResult = {
  connections: MarketplaceConnection[];
  error?: string;
};

export async function fetchMarketplaceConnections(): Promise<FetchConnectionsResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { connections: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("marketplace_connections")
      .select("id,platform,status,account_name,account_id,last_sync_at,last_sync_error,sync_enabled,token_expires_at,connected_at,created_at")
      .eq("user_id", user.id)
      .order("platform");

    if (error) return { connections: [], error: error.message };
    return { connections: (data ?? []) as MarketplaceConnection[] };
  } catch {
    return { connections: [], error: "Failed to fetch connections" };
  }
}

export type GetConnectionStatusResult = {
  platform: MarketplacePlatform;
  status: ConnectionStatus;
  accountName: string | null;
  lastSyncAt: string | null;
  isExpired: boolean;
};

export async function getConnectionStatus(
  platform: MarketplacePlatform
): Promise<GetConnectionStatusResult | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("marketplace_connections")
      .select("platform,status,account_name,last_sync_at,token_expires_at")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .single();

    if (!data) return null;

    const isExpired =
      data.status === "expired" ||
      (data.token_expires_at != null && new Date(data.token_expires_at) < new Date());

    return {
      platform: data.platform as MarketplacePlatform,
      status: isExpired ? "expired" : (data.status as ConnectionStatus),
      accountName: data.account_name,
      lastSyncAt: data.last_sync_at,
      isExpired,
    };
  } catch {
    return null;
  }
}

// ─── eBay OAuth ───────────────────────────────────────────────────────────────

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.account",
].join(" ");

export async function getEbayAuthUrl(): Promise<{ url: string | null; error?: string }> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const redirectUri = process.env.EBAY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return { url: null, error: "eBay OAuth not configured" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { url: null, error: "Not authenticated" };

    const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString("base64url");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: EBAY_SCOPES,
      state,
    });

    const url = `https://auth.ebay.com/oauth2/authorize?${params.toString()}`;
    return { url };
  } catch (err) {
    logger.error("runtime", "Failed to build eBay auth URL", { error: String(err) });
    return { url: null, error: "Failed to initiate connection" };
  }
}

export async function disconnectMarketplace(
  platform: MarketplacePlatform
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("marketplace_connections")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        sync_enabled: false,
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("platform", platform);

    if (error) return { ok: false, error: error.message };

    logger.info("runtime", "Marketplace disconnected", { userId: user.id, platform });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Manual Sync ─────────────────────────────────────────────────────────────

export type ManualSyncResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  ended: number;
  error?: string;
};

export async function triggerManualSync(
  platform: "ebay"
): Promise<ManualSyncResult> {
  const empty: ManualSyncResult = { ok: false, inserted: 0, updated: 0, ended: 0 };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...empty, error: "Not authenticated" };

    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("id, access_token, refresh_token, token_expires_at")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("status", "connected")
      .maybeSingle();

    if (!conn) return { ...empty, error: "No active connection found — connect eBay first" };

    let accessToken: string = conn.access_token;

    // Token refresh if within 5-minute buffer
    const bufferMs  = 5 * 60 * 1000;
    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (expiresAt < Date.now() + bufferMs) {
      if (!conn.refresh_token) {
        await supabase
          .from("marketplace_connections")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", conn.id);
        return { ...empty, error: "eBay token expired — please reconnect" };
      }
      const { refreshEbayToken } = await import("@/lib/sync/ebay-client");
      const refreshed = await refreshEbayToken(user.id, conn.refresh_token, supabase);
      if (!refreshed) {
        await supabase
          .from("marketplace_connections")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", conn.id);
        return { ...empty, error: "Token refresh failed — please reconnect eBay" };
      }
      accessToken = refreshed.accessToken;
    }

    const { fetchEbayListings } = await import("@/lib/sync/ebay-client");
    const listings = await fetchEbayListings(accessToken);

    const { reconcileEbayListings } = await import("@/lib/sync/reconciler");
    const result = await reconcileEbayListings(user.id, listings, supabase);

    const now = new Date().toISOString();
    await supabase
      .from("marketplace_connections")
      .update({ last_sync_at: now, last_sync_error: null, updated_at: now })
      .eq("id", conn.id);

    logger.info("runtime", "Manual eBay sync completed", {
      userId: user.id,
      inserted: result.inserted,
      updated: result.updated,
      ended: result.ended,
    });

    return { ok: true, inserted: result.inserted, updated: result.updated, ended: result.ended };
  } catch (err) {
    logger.error("runtime", "Manual sync failed", { error: String(err) });
    return { ...empty, error: String(err) };
  }
}

export async function toggleSyncEnabled(
  platform: MarketplacePlatform,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("marketplace_connections")
      .update({ sync_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("platform", platform);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
