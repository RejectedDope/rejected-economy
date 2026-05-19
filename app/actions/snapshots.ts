"use server";

import { createClient } from "@/lib/supabase/server";
import { scoreItem } from "@/lib/scoring";
import {
  calcSellThroughProbability,
  calcRecoveryProbability,
  calcPricingRisk,
} from "@/lib/recovery-engine";
import type { InventoryItem, RecoveryAction } from "@/lib/types";
import type { RecoveryActionType } from "@/lib/supabase/database.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDbAction(action: string): RecoveryActionType {
  if (action === "title_rewrite") return "adjust_shipping";
  const valid: RecoveryActionType[] = [
    "relist_now", "strategic_markdown", "bundle", "move_platform",
    "optimize_specifics", "add_photos", "liquidate", "hold",
    "sell_similar", "adjust_shipping",
  ];
  return valid.includes(action as RecoveryActionType)
    ? (action as RecoveryActionType)
    : "hold";
}

function calcDaysComponent(days: number): number {
  if (days <= 14) return 0;
  if (days <= 30) return 6;
  if (days <= 60) return 14;
  if (days <= 90) return 22;
  if (days <= 180) return 28;
  if (days < 365) return 35;
  return 38;
}

const SNAPSHOT_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20 hours — prevents duplicate daily writes

// ─── Write Item Snapshots ─────────────────────────────────────────────────────
// Batch-scores active items and persists to scoring_snapshots.
// Skips items already snapshotted within the dedup window.

export async function writeItemSnapshots(
  itemIds?: string[]
): Promise<{ written: number; skipped: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { written: 0, skipped: 0, error: "Not authenticated" };

  let query = supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(500);

  if (itemIds && itemIds.length > 0) query = query.in("id", itemIds);

  const { data: items, error: fetchError } = await query;
  if (fetchError) return { written: 0, skipped: 0, error: fetchError.message };
  if (!items || items.length === 0) return { written: 0, skipped: 0 };

  const typedItems = items as unknown as InventoryItem[];
  const idList = typedItems.map((i) => i.id);

  // Fetch most-recent snapshot per item for dedup
  const { data: recentSnaps } = await supabase
    .from("scoring_snapshots")
    .select("item_id, scored_at")
    .eq("user_id", user.id)
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
      user_id: user.id,
      dead_inventory_score: scored.dead_inventory_score,
      listing_health_score: scored.listing_health_score,
      visibility_risk: scored.visibility_risk,
      primary_action: toDbAction(scored.primary_recovery_action as RecoveryAction),
      estimated_recovery: scored.estimated_recovery,
      score_days_component: calcDaysComponent(raw.days_listed),
      score_specifics_component: raw.item_specifics_complete ? 0 : 10,
      score_photos_component: raw.image_count >= 4 ? 0 : raw.image_count === 0 ? 5 : 3,
      score_title_component:
        raw.title_keyword_strength <= 30 ? 10 :
        raw.title_keyword_strength <= 60 ? 5 : 0,
      sell_through_probability: sellThrough,
      recovery_probability: recoveryProb,
      pricing_risk: pricingRisk,
      price_at_snapshot: raw.price,
      days_at_snapshot: raw.days_listed,
      scored_at: now.toISOString(),
    });
  }

  if (toWrite.length === 0) return { written: 0, skipped };

  const CHUNK = 100;
  let written = 0;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const { error } = await supabase
      .from("scoring_snapshots")
      .insert(toWrite.slice(i, i + CHUNK));
    if (!error) written += Math.min(CHUNK, toWrite.length - i);
  }

  return { written, skipped };
}

// ─── Write Portfolio Snapshot ─────────────────────────────────────────────────
// Captures portfolio-level health metrics into inventory_snapshots + portfolio_metrics.

export async function writePortfolioSnapshot(
  snapshotType: "manual" | "import_trigger" | "scheduled" = "manual"
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: rawItems, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(2000);

  if (error) return { ok: false, error: error.message };

  const items = (rawItems ?? []) as unknown as InventoryItem[];
  if (items.length === 0) return { ok: true };

  const scored = items.map(scoreItem);
  const total_value = items.reduce((s, r) => s + r.price, 0);
  const critical = scored.filter((i) => i.dead_inventory_score >= 75);
  const stale = scored.filter((i) => i.dead_inventory_score >= 50 && i.dead_inventory_score < 75);
  const trapped_cash =
    critical.reduce((s, i) => s + i.price, 0) +
    stale.reduce((s, i) => s + i.price, 0) * 0.5;
  const trapped_pct = total_value > 0 ? (trapped_cash / total_value) * 100 : 0;
  const avg_dead = scored.reduce((s, i) => s + i.dead_inventory_score, 0) / scored.length;
  const avg_days = items.reduce((s, r) => s + r.days_listed, 0) / items.length;
  const avg_health = scored.reduce((s, i) => s + i.listing_health_score, 0) / scored.length;
  const total_recovery = scored
    .filter((i) => i.dead_inventory_score >= 50)
    .reduce((s, i) => s + (i.estimated_recovery ?? 0), 0);
  const portfolio_health_score = Math.max(
    0,
    Math.round(
      100 - trapped_pct * 0.4 - (critical.length / items.length) * 100 * 0.4 -
      Math.max(0, avg_dead - 30) * 0.2
    )
  );

  const { error: insErr } = await supabase.from("inventory_snapshots").insert({
    user_id: user.id,
    total_items: items.length,
    active_items: items.length,
    total_value: Math.round(total_value * 100) / 100,
    trapped_cash: Math.round(trapped_cash * 100) / 100,
    trapped_pct: Math.round(trapped_pct * 100) / 100,
    stale_count: stale.length,
    critical_count: critical.length,
    newly_imported_count: items.filter((r) => r.days_listed <= 14).length,
    avg_dead_score: Math.round(avg_dead * 10) / 10,
    avg_days_listed: Math.round(avg_days * 10) / 10,
    avg_listing_health: Math.round(avg_health * 10) / 10,
    total_recovery_opportunity: Math.round(total_recovery * 100) / 100,
    quick_win_count: scored.filter(
      (i) => i.dead_inventory_score >= 30 && i.dead_inventory_score < 60
    ).length,
    liquidation_candidate_count: critical.length,
    portfolio_health_score,
    snapshot_type: snapshotType,
    snapshotted_at: new Date().toISOString(),
  });

  if (insErr) return { ok: false, error: insErr.message };

  // Upsert today's portfolio_metrics row
  const today = new Date().toISOString().split("T")[0];
  const { data: soldToday } = await supabase
    .from("inventory_items")
    .select("price")
    .eq("user_id", user.id)
    .eq("status", "sold")
    .gte("updated_at", today);

  const soldRows = (soldToday ?? []) as { price: number }[];

  await supabase.from("portfolio_metrics").upsert(
    {
      user_id: user.id,
      metric_date: today,
      active_count: items.length,
      sold_count_period: soldRows.length,
      newly_listed_count: items.filter((r) => r.days_listed <= 1).length,
      total_active_value: Math.round(total_value * 100) / 100,
      sold_value_period: soldRows.reduce((s, r) => s + r.price, 0),
      recovery_opportunity: Math.round(total_recovery * 100) / 100,
      dead_inventory_pct: Math.round(trapped_pct * 100) / 100,
      avg_dead_score: Math.round(avg_dead * 10) / 10,
      avg_days_listed: Math.round(avg_days * 10) / 10,
      portfolio_health_score,
      critical_count: critical.length,
      stale_count: stale.length,
      slowing_count: scored.filter(
        (i) => i.dead_inventory_score >= 20 && i.dead_inventory_score < 30
      ).length,
      active_stage_count: scored.filter((i) => i.dead_inventory_score < 20).length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,metric_date" }
  );

  return { ok: true };
}

// ─── Fetch Item Snapshots ─────────────────────────────────────────────────────

export async function fetchItemSnapshots(
  itemId: string,
  limit = 30
): Promise<{ snapshots: Record<string, unknown>[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { snapshots: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("scoring_snapshots")
    .select("*")
    .eq("item_id", itemId)
    .eq("user_id", user.id)
    .order("scored_at", { ascending: false })
    .limit(limit);

  if (error) return { snapshots: [], error: error.message };
  return { snapshots: (data ?? []) as Record<string, unknown>[] };
}

// ─── Fetch Portfolio Trend ────────────────────────────────────────────────────

export async function fetchPortfolioTrend(
  days = 30
): Promise<{ metrics: Record<string, unknown>[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { metrics: [], error: "Not authenticated" };

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("portfolio_metrics")
    .select("*")
    .eq("user_id", user.id)
    .gte("metric_date", since.toISOString().split("T")[0])
    .order("metric_date", { ascending: true });

  if (error) return { metrics: [], error: error.message };
  return { metrics: (data ?? []) as Record<string, unknown>[] };
}
