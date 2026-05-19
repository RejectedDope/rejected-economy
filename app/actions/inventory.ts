"use server";

import { createClient } from "@/lib/supabase/server";
import { scoreItem } from "@/lib/scoring";
import { dedupeAgainstExisting } from "@/lib/inventory/deduplication";
import { logger } from "@/lib/logger";
import type { NormalizedRow } from "@/lib/ingestion/normalize";
import type { InventoryItem } from "@/lib/types";
import type { InventoryItemInsert, RecoveryActionType } from "@/lib/supabase/database.types";

// ─── Type guard: map app RecoveryAction → DB RecoveryActionType ───────────────

function toDbAction(action: string): RecoveryActionType {
  if (action === "title_rewrite") return "adjust_shipping"; // enum divergence — tracked in database.types.ts
  const valid: RecoveryActionType[] = [
    "relist_now","strategic_markdown","bundle","move_platform",
    "optimize_specifics","add_photos","liquidate","hold","sell_similar","adjust_shipping",
  ];
  return valid.includes(action as RecoveryActionType)
    ? (action as RecoveryActionType)
    : "hold";
}

// ─── Import Inventory Items ───────────────────────────────────────────────────

export type ImportResult = {
  inserted: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  batch_id: string;
};

export async function importInventoryItems(
  rows: NormalizedRow[],
  checkDuplicates = true,
  sessionMeta?: { fileName?: string; fileType?: string; fileSizeBytes?: number }
): Promise<ImportResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const batch_id = crypto.randomUUID();
  const startedAt = Date.now();
  const errors: string[] = [];
  let skipped = 0;
  let duplicates = 0;

  logger.info("ingestion", "Import started", {
    userId: user.id,
    rowCount: rows.length,
    batchId: batch_id,
    fileName: sessionMeta?.fileName,
  });

  // Log upload session
  const { data: sessionRow } = await supabase.from("upload_sessions").insert({
    user_id: user.id,
    file_name: sessionMeta?.fileName ?? "unknown",
    file_size_bytes: sessionMeta?.fileSizeBytes ?? null,
    file_type: sessionMeta?.fileType ?? "csv",
    status: "parsing",
    rows_in_file: rows.length,
    batch_id,
    started_at: new Date().toISOString(),
  }).select("id").single();

  const sessionId = sessionRow?.id as string | undefined;

  // Fetch existing active inventory for dedup
  let existingItems: InventoryItem[] = [];
  if (checkDuplicates) {
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(2000);
    existingItems = (data ?? []) as unknown as InventoryItem[];
  }

  // Deduplicate incoming rows against existing inventory
  const { unique, matches } = checkDuplicates
    ? dedupeAgainstExisting(rows, existingItems)
    : { unique: rows, matches: [] };

  duplicates = matches.length;

  if (unique.length === 0) {
    return { inserted: 0, skipped: rows.length, duplicates, errors, batch_id };
  }

  // Score each row and build insert payloads
  const inserts: InventoryItemInsert[] = [];
  const now = new Date().toISOString();

  for (const row of unique) {
    try {
      // Build a minimal InventoryItem for scoring
      const item: InventoryItem = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: row.title,
        platform: row.platform,
        category: row.category,
        price: row.price,
        original_price: row.original_price,
        days_listed: row.days_listed,
        item_specifics_complete: row.item_specifics_complete,
        image_count: row.image_count,
        title_keyword_strength: row.title_keyword_strength,
        has_promoted_listing: row.has_promoted_listing,
        shipping_type: row.shipping_type,
        shipping_cost: row.shipping_cost,
        views: row.views,
        watchers: row.watchers,
        impressions: row.impressions,
        status: "active",
        created_at: now,
        updated_at: now,
      };

      const scored = scoreItem(item);

      inserts.push({
        id: item.id,
        user_id: user.id,
        title: scored.title,
        platform: scored.platform,
        category: scored.category ?? null,
        price: scored.price,
        original_price: scored.original_price ?? null,
        days_listed: scored.days_listed,
        item_specifics_complete: scored.item_specifics_complete,
        image_count: scored.image_count,
        title_keyword_strength: scored.title_keyword_strength,
        has_promoted_listing: scored.has_promoted_listing,
        shipping_type: scored.shipping_type,
        shipping_cost: scored.shipping_cost ?? null,
        views: scored.views,
        watchers: scored.watchers,
        impressions: scored.impressions,
        status: "active",
        dead_inventory_score: scored.dead_inventory_score,
        listing_health_score: scored.listing_health_score,
        visibility_risk: scored.visibility_risk,
        primary_recovery_action: toDbAction(scored.primary_recovery_action),
        estimated_recovery: scored.estimated_recovery,
        last_scored_at: now,
        import_batch_id: batch_id,
        created_at: now,
        updated_at: now,
      } as InventoryItemInsert);
    } catch (err) {
      errors.push(`Row "${row.title}": ${String(err)}`);
      skipped++;
    }
  }

  // Batch insert (chunks of 100 for Supabase row limits)
  const CHUNK = 100;
  let inserted = 0;

  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from("inventory_items").insert(chunk);
    if (error) {
      errors.push(`Batch ${Math.floor(i / CHUNK) + 1}: ${error.message}`);
      skipped += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }

  // Finalize upload session
  const durationMs = Date.now() - startedAt;
  if (sessionId) {
    await supabase.from("upload_sessions").update({
      status: errors.length === 0 ? "complete" : inserted > 0 ? "partial" : "failed",
      rows_imported: inserted,
      rows_failed: skipped,
      rows_duplicates: duplicates,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      error_log: errors.length > 0 ? errors : null,
    }).eq("id", sessionId);
  }

  logger.info("ingestion", "Import complete", {
    userId: user.id,
    batchId: batch_id,
    inserted,
    skipped,
    duplicates,
    errors: errors.length,
    durationMs,
  });

  return { inserted, skipped, duplicates, errors, batch_id };
}

// ─── Fetch User Inventory ─────────────────────────────────────────────────────

export type FetchInventoryResult = {
  items: InventoryItem[];
  total: number;
  error?: string;
};

export async function fetchUserInventory(
  status: "active" | "sold" | "all" = "active",
  limit = 500
): Promise<FetchInventoryResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], total: 0, error: "Not authenticated" };

  let query = supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", user.id)
    .order("dead_inventory_score", { ascending: false })
    .limit(limit);

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return { items: [], total: 0, error: error.message };

  return {
    items: (data ?? []) as unknown as InventoryItem[],
    total: data?.length ?? 0,
  };
}

// ─── Update Item Status ───────────────────────────────────────────────────────

export async function updateItemStatus(
  itemId: string,
  status: "sold" | "ended" | "relisted" | "active",
  recoveryAmount?: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("inventory_items")
    .update(update)
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  // Log recovery action if marked sold
  if (status === "sold") {
    await supabase.from("recovery_actions").insert({
      item_id: itemId,
      user_id: user.id,
      action_type: "hold",
      action_status: "completed",
      outcome: "sold",
      recovery_amount: recoveryAmount ?? null,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  }

  return { ok: true };
}

// ─── Log Recovery Action ──────────────────────────────────────────────────────

export async function logRecoveryAction(
  itemId: string,
  actionType: string,
  status: "completed" | "skipped" | "snoozed" = "completed",
  opts: {
    outcome?: "sold" | "still_active" | "ended" | "no_change";
    recoveryAmount?: number;
    notes?: string;
    snoozedUntil?: string;
    daysListed?: number;
    deadScore?: number;
    price?: number;
  } = {}
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("recovery_actions").insert({
    item_id: itemId,
    user_id: user.id,
    action_type: toDbAction(actionType),
    action_status: status,
    outcome: opts.outcome ?? null,
    recovery_amount: opts.recoveryAmount ?? null,
    notes: opts.notes ?? null,
    snoozed_until: opts.snoozedUntil ?? null,
    days_listed_snapshot: opts.daysListed ?? null,
    dead_score_snapshot: opts.deadScore ?? null,
    price_snapshot: opts.price ?? null,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Fetch Single Item by ID ──────────────────────────────────────────────────

export async function fetchInventoryItemById(
  id: string
): Promise<{ item: InventoryItem | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { item: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return { item: null, error: error.message };
  return { item: data as unknown as InventoryItem };
}

// ─── Delete Item ──────────────────────────────────────────────────────────────

export async function deleteInventoryItem(
  itemId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
