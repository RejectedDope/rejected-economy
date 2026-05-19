"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Action Effectiveness ─────────────────────────────────────────────────────
// Aggregates recovery_actions to surface per-action success rates.
// Used to weight recommendations and display "what works" in the recovery page.

export interface ActionEffectivenessRow {
  action_type: string;
  total: number;
  sold: number;
  still_active: number;
  ended: number;
  no_change: number;
  success_rate: number; // sold / total (0–100)
  avg_recovery: number; // average recovery_amount when outcome = sold
}

export async function fetchActionEffectiveness(): Promise<{
  rows: ActionEffectivenessRow[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { rows: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("recovery_actions")
    .select("action_type, outcome, recovery_amount")
    .eq("user_id", user.id)
    .eq("action_status", "completed");

  if (error) return { rows: [], error: error.message };

  const buckets = new Map<
    string,
    { total: number; sold: number; still_active: number; ended: number; no_change: number; recovery_sum: number; recovery_count: number }
  >();

  for (const row of data ?? []) {
    const key = row.action_type as string;
    if (!buckets.has(key)) {
      buckets.set(key, { total: 0, sold: 0, still_active: 0, ended: 0, no_change: 0, recovery_sum: 0, recovery_count: 0 });
    }
    const b = buckets.get(key)!;
    b.total++;
    const outcome = (row.outcome ?? "no_change") as string;
    if (outcome === "sold") { b.sold++; b.recovery_sum += (row.recovery_amount as number) ?? 0; b.recovery_count++; }
    else if (outcome === "still_active") b.still_active++;
    else if (outcome === "ended") b.ended++;
    else b.no_change++;
  }

  const rows: ActionEffectivenessRow[] = Array.from(buckets.entries())
    .map(([action_type, b]) => ({
      action_type,
      total: b.total,
      sold: b.sold,
      still_active: b.still_active,
      ended: b.ended,
      no_change: b.no_change,
      success_rate: b.total > 0 ? Math.round((b.sold / b.total) * 100) : 0,
      avg_recovery: b.recovery_count > 0
        ? Math.round((b.recovery_sum / b.recovery_count) * 100) / 100
        : 0,
    }))
    .sort((a, b) => b.success_rate - a.success_rate);

  return { rows };
}

// ─── Category Recovery Patterns ───────────────────────────────────────────────
// Groups sold items by category to identify which categories recover fastest.

export interface CategoryRecoveryPattern {
  category: string;
  sold_count: number;
  avg_days_listed: number; // days_listed at time of action (proxy for time-to-sale)
  avg_recovery: number;
  top_action: string; // most common action that led to sale
}

export async function fetchCategoryRecoveryPatterns(): Promise<{
  patterns: CategoryRecoveryPattern[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { patterns: [], error: "Not authenticated" };

  // Join recovery_actions (sold outcomes) with inventory_items (for category)
  const { data, error } = await supabase
    .from("recovery_actions")
    .select("action_type, recovery_amount, days_listed_snapshot, item_id")
    .eq("user_id", user.id)
    .eq("action_status", "completed")
    .eq("outcome", "sold");

  if (error) return { patterns: [], error: error.message };
  if (!data || data.length === 0) return { patterns: [] };

  // Fetch categories for the item_ids
  const itemIds = [...new Set(data.map((r) => r.item_id as string))];
  const { data: itemData } = await supabase
    .from("inventory_items")
    .select("id, category")
    .in("id", itemIds);

  const categoryMap = new Map<string, string>();
  for (const item of itemData ?? []) {
    categoryMap.set(item.id as string, (item.category as string) ?? "Other");
  }

  const catBuckets = new Map<
    string,
    { sold: number; days_sum: number; recovery_sum: number; actions: Record<string, number> }
  >();

  for (const row of data) {
    const cat = categoryMap.get(row.item_id as string) ?? "Other";
    if (!catBuckets.has(cat)) {
      catBuckets.set(cat, { sold: 0, days_sum: 0, recovery_sum: 0, actions: {} });
    }
    const b = catBuckets.get(cat)!;
    b.sold++;
    b.days_sum += (row.days_listed_snapshot as number) ?? 0;
    b.recovery_sum += (row.recovery_amount as number) ?? 0;
    const at = (row.action_type as string) ?? "hold";
    b.actions[at] = (b.actions[at] ?? 0) + 1;
  }

  const patterns: CategoryRecoveryPattern[] = Array.from(catBuckets.entries())
    .map(([category, b]) => ({
      category,
      sold_count: b.sold,
      avg_days_listed: b.sold > 0 ? Math.round(b.days_sum / b.sold) : 0,
      avg_recovery: b.sold > 0 ? Math.round((b.recovery_sum / b.sold) * 100) / 100 : 0,
      top_action: Object.entries(b.actions).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "hold",
    }))
    .filter((p) => p.sold_count >= 2) // only meaningful sample sizes
    .sort((a, b) => b.sold_count - a.sold_count);

  return { patterns };
}
