import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ─── Cron: Nightly Snapshot Writer ────────────────────────────────────────────
// Scheduled via vercel.json cron config.
// Protected by CRON_SECRET — Vercel injects Authorization: Bearer <secret>
// on every cron invocation. Reject all other callers.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();

  // ── Auth: verify CRON_SECRET ──────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.warn("runtime", "CRON_SECRET not set — cron endpoint will reject all calls");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (authHeader !== expected) {
    logger.warn("runtime", "Cron snapshot request rejected — invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Guard: Supabase must be configured ───────────────────────────────────
  const { supabaseConfigured } = await import("@/lib/env");
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured", skipped: true }, { status: 200 });
  }

  // ── Run snapshot for all active users ────────────────────────────────────
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get all distinct user IDs with active inventory
    const { data: userRows, error: userErr } = await supabase
      .from("inventory_items")
      .select("user_id")
      .eq("status", "active")
      .limit(1000);

    if (userErr) {
      logger.supabaseError("inventory_items", "cron-snapshot-users", userErr.message);
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    const userIds = Array.from(new Set((userRows ?? []).map((r) => r.user_id as string)));
    logger.info("scoring", "Cron snapshot: processing users", { count: userIds.length });

    let totalWritten = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const result = await runUserSnapshot(userId);
        totalWritten += result.written;
        totalSkipped += result.skipped;
        if (result.error) errors.push(`${userId}: ${result.error}`);
      } catch (err) {
        errors.push(`${userId}: ${String(err)}`);
      }
    }

    // Write portfolio snapshot for each user
    for (const userId of userIds) {
      try {
        await runUserPortfolioSnapshot(userId);
      } catch {
        // Non-fatal — item snapshots already written
      }
    }

    const durationMs = Date.now() - start;
    logger.info("scoring", "Cron snapshot complete", {
      users: userIds.length,
      written: totalWritten,
      skipped: totalSkipped,
      durationMs,
      errors: errors.length,
    });

    return NextResponse.json({
      ok: true,
      users: userIds.length,
      written: totalWritten,
      skipped: totalSkipped,
      durationMs,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (err) {
    logger.error("runtime", "Cron snapshot failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Per-user snapshot logic ──────────────────────────────────────────────────
// Mirrors writeItemSnapshots but operates on a given userId without
// requiring an active session cookie (cron has no session).

async function runUserSnapshot(userId: string): Promise<{ written: number; skipped: number; error?: string }> {
  const SNAPSHOT_INTERVAL_MS = 20 * 60 * 60 * 1000;

  const { createClient } = await import("@/lib/supabase/server");
  const { scoreItem } = await import("@/lib/scoring");
  const { calcSellThroughProbability, calcRecoveryProbability, calcPricingRisk } = await import("@/lib/recovery-engine");
  type InventoryItem = import("@/lib/types").InventoryItem;
  type RecoveryAction = import("@/lib/types").RecoveryAction;
  type RecoveryActionType = import("@/lib/supabase/database.types").RecoveryActionType;

  function toDbAction(action: string): RecoveryActionType {
    if (action === "title_rewrite") return "adjust_shipping";
    const valid: RecoveryActionType[] = [
      "relist_now", "strategic_markdown", "bundle", "move_platform",
      "optimize_specifics", "add_photos", "liquidate", "hold",
      "sell_similar", "adjust_shipping",
    ];
    return valid.includes(action as RecoveryActionType) ? (action as RecoveryActionType) : "hold";
  }

  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(500);

  if (error) return { written: 0, skipped: 0, error: error.message };
  if (!items || items.length === 0) return { written: 0, skipped: 0 };

  const typedItems = items as unknown as InventoryItem[];
  const idList = typedItems.map((i) => i.id);

  const { data: recentSnaps } = await supabase
    .from("scoring_snapshots")
    .select("item_id, scored_at")
    .eq("user_id", userId)
    .in("item_id", idList)
    .order("scored_at", { ascending: false });

  const lastSnapshotAt = new Map<string, Date>();
  for (const snap of recentSnaps ?? []) {
    if (!lastSnapshotAt.has(snap.item_id)) {
      lastSnapshotAt.set(snap.item_id, new Date(snap.scored_at));
    }
  }

  const now = new Date();
  const toWrite: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const raw of typedItems) {
    const last = lastSnapshotAt.get(raw.id);
    if (last && now.getTime() - last.getTime() < SNAPSHOT_INTERVAL_MS) {
      skipped++;
      continue;
    }
    const scored = scoreItem(raw);
    const sellThrough = calcSellThroughProbability(scored);
    const recoveryProb = calcRecoveryProbability(scored, sellThrough);
    const pricingRisk = calcPricingRisk(scored);

    toWrite.push({
      item_id: raw.id,
      user_id: userId,
      dead_inventory_score: scored.dead_inventory_score,
      listing_health_score: scored.listing_health_score,
      visibility_risk: scored.visibility_risk,
      primary_action: toDbAction(scored.primary_recovery_action as RecoveryAction),
      estimated_recovery: scored.estimated_recovery,
      price_at_snapshot: raw.price,
      days_at_snapshot: raw.days_listed,
      sell_through_probability: sellThrough,
      recovery_probability: recoveryProb,
      pricing_risk: pricingRisk,
      scored_at: now.toISOString(),
    });
  }

  if (toWrite.length === 0) return { written: 0, skipped };

  const { error: insertErr } = await supabase.from("scoring_snapshots").insert(toWrite);
  if (insertErr) return { written: 0, skipped, error: insertErr.message };

  return { written: toWrite.length, skipped };
}

async function runUserPortfolioSnapshot(userId: string): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("inventory_items")
    .select("price, status")
    .eq("user_id", userId);

  if (!items || items.length === 0) return;

  const active = items.filter((i) => i.status === "active");
  const totalItems = active.length;
  const trappedCash = active.reduce((s: number, i: { price: number }) => s + (i.price ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("portfolio_metrics").upsert({
    user_id: userId,
    metric_date: today,
    active_count: totalItems,
    total_active_value: trappedCash,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,metric_date" });
}
