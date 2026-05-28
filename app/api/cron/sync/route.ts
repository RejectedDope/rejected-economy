import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ─── Cron: eBay Inventory Sync ────────────────────────────────────────────────
// Runs every 4 hours. Fetches live eBay listings for every connected account
// and reconciles them against local inventory_items.
// Protected by CRON_SECRET per Vercel cron authentication pattern.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();

  // Auth: verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("runtime", "Sync cron rejected — invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: service client required
  const { isServiceClientConfigured } = await import("@/lib/supabase/service");
  if (!isServiceClientConfigured()) {
    logger.warn("runtime", "Sync cron skipped — service role not configured");
    return NextResponse.json({ skipped: true, reason: "service_role_not_configured" }, { status: 200 });
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { refreshEbayToken, fetchEbayListings } = await import("@/lib/sync/ebay-client");
    const { reconcileEbayListings } = await import("@/lib/sync/reconciler");

    const supabase = createServiceClient();

    // Fetch all connected eBay marketplace connections
    const { data: connections, error: connErr } = await supabase
      .from("marketplace_connections")
      .select("id, user_id, access_token, refresh_token, token_expires_at")
      .eq("platform", "ebay")
      .eq("status", "connected");

    if (connErr) {
      logger.error("runtime", "Failed to fetch eBay connections", connErr);
      return NextResponse.json({ error: connErr.message }, { status: 500 });
    }

    const allConnections = connections ?? [];
    let totalItemsSynced = 0;
    let failures         = 0;
    let connectionsProcessed = 0;

    for (const conn of allConnections) {
      const { id: connectionId, user_id: userId, token_expires_at } = conn;
      let accessToken: string = conn.access_token;

      try {
        // Check token expiry (5-minute buffer)
        const bufferMs   = 5 * 60 * 1000;
        const expiresAt  = token_expires_at ? new Date(token_expires_at).getTime() : 0;
        const isExpired  = expiresAt < Date.now() + bufferMs;

        if (isExpired) {
          if (!conn.refresh_token) {
            logger.warn("runtime", "eBay token expired and no refresh token available", { userId, connectionId });
            await supabase
              .from("marketplace_connections")
              .update({ status: "expired", updated_at: new Date().toISOString() })
              .eq("id", connectionId);
            failures++;
            continue;
          }

          const refreshed = await refreshEbayToken(userId, conn.refresh_token, supabase);
          if (!refreshed) {
            logger.warn("runtime", "eBay token refresh failed — marking connection expired", { userId, connectionId });
            await supabase
              .from("marketplace_connections")
              .update({ status: "expired", updated_at: new Date().toISOString() })
              .eq("id", connectionId);
            failures++;
            continue;
          }

          accessToken = refreshed.accessToken;
        }

        // Create a sync_job record for this run
        const { data: jobData, error: jobErr } = await supabase
          .from("sync_jobs")
          .insert({
            user_id:         userId,
            job_type:        "inventory_sync",
            source_platform: "ebay",
            status:          "running",
            started_at:      new Date().toISOString(),
          })
          .select("id")
          .single();

        if (jobErr) {
          logger.warn("runtime", "Failed to create sync_job record", { userId, error: jobErr.message });
        }

        const jobId = jobData?.id ?? null;

        // Fetch live eBay listings
        const listings = await fetchEbayListings(accessToken);

        // Reconcile against local inventory_items
        const reconcileResult = await reconcileEbayListings(userId, listings, supabase);

        const itemsSynced = reconcileResult.inserted + reconcileResult.updated;
        totalItemsSynced += itemsSynced;
        connectionsProcessed++;

        // Update sync_job to completed
        if (jobId) {
          await supabase
            .from("sync_jobs")
            .update({
              status:          "completed",
              items_processed: itemsSynced,
              items_failed:    reconcileResult.errors.length,
              completed_at:    new Date().toISOString(),
              updated_at:      new Date().toISOString(),
            })
            .eq("id", jobId);
        }

        // Update marketplace_connection: last_sync_at, clear last_sync_error
        await supabase
          .from("marketplace_connections")
          .update({
            last_sync_at:    new Date().toISOString(),
            last_sync_error: null,
            updated_at:      new Date().toISOString(),
          })
          .eq("id", connectionId);

      } catch (err) {
        failures++;
        logger.error("runtime", "Sync failed for eBay connection", err, { userId, connectionId });

        // Record failure on the connection (best-effort)
        try {
          await supabase
            .from("marketplace_connections")
            .update({
              last_sync_error: String(err),
              updated_at:      new Date().toISOString(),
            })
            .eq("id", connectionId);
        } catch {
          // non-fatal
        }
      }
    }

    const durationMs = Date.now() - start;

    logger.info("runtime", "Sync cron complete", {
      connectionsProcessed,
      connectionsTotal: allConnections.length,
      totalItemsSynced,
      failures,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      connectionsProcessed,
      connectionsTotal: allConnections.length,
      totalItemsSynced,
      failures,
      durationMs,
    });
  } catch (err) {
    logger.error("runtime", "Sync cron unexpected error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
