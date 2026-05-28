"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportBatch = {
  batch_id: string;
  imported_at: string;
  item_count: number;
  platform: string | null;
  source: string | null; // 'csv_import' | 'ocr_import' | 'ebay_sync' | 'manual'
};

// ─── Fetch Import Batches ─────────────────────────────────────────────────────

export async function fetchImportBatches(
  limit = 20
): Promise<{ batches: ImportBatch[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { batches: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("inventory_items")
      .select("import_batch_id, created_at, platform, sync_source")
      .eq("user_id", user.id)
      .not("import_batch_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return { batches: [], error: error.message };

    // Group by batch_id client-side
    const batchMap = new Map<
      string,
      { imported_at: string; item_count: number; platform: string | null; source: string | null }
    >();

    for (const row of data ?? []) {
      const batchId = row.import_batch_id as string;
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          imported_at: row.created_at as string,
          item_count: 1,
          platform: (row.platform as string | null) ?? null,
          source: (row.sync_source as string | null) ?? null,
        });
      } else {
        const existing = batchMap.get(batchId)!;
        existing.item_count++;
        // Keep earliest created_at as the batch import time
        if ((row.created_at as string) < existing.imported_at) {
          existing.imported_at = row.created_at as string;
        }
      }
    }

    // Convert to array, already sorted newest-first from the DB query
    // Re-sort by imported_at descending after grouping
    const batches: ImportBatch[] = Array.from(batchMap.entries())
      .map(([batch_id, info]) => ({
        batch_id,
        imported_at: info.imported_at,
        item_count: info.item_count,
        platform: info.platform,
        source: info.source,
      }))
      .sort((a, b) => (a.imported_at < b.imported_at ? 1 : -1))
      .slice(0, limit);

    return { batches };
  } catch (err) {
    return { batches: [], error: String(err) };
  }
}

// ─── Fetch Batch Details ──────────────────────────────────────────────────────

export async function fetchBatchDetails(
  batchId: string
): Promise<{
  items: { id: string; title: string; price: number; platform: string }[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { items: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, title, price, platform")
      .eq("user_id", user.id)
      .eq("import_batch_id", batchId)
      .limit(50);

    if (error) return { items: [], error: error.message };

    return {
      items: (data ?? []) as { id: string; title: string; price: number; platform: string }[],
    };
  } catch (err) {
    return { items: [], error: String(err) };
  }
}
