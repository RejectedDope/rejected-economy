// ─── eBay Listing Reconciler ──────────────────────────────────────────────────
// Reconciles a fresh set of eBay listings against the local inventory_items table.
// Inserts new listings, updates changed ones, and marks ended listings accordingly.
// Scoring fields are left null — they are populated by the automation cron on its
// next run rather than synchronously here.

import { logger } from "@/lib/logger";
import type { SyncedListing } from "./ebay-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReconcileResult = {
  inserted: number;
  updated:  number;
  ended:    number;
  skipped:  number;
  errors:   string[];
  durationMs: number;
};

type ExistingItem = {
  id: string;
  platform_listing_id: string | null;
  title: string | null;
  price: number | null;
  status: string | null;
};

// ─── Reconcile ────────────────────────────────────────────────────────────────

export async function reconcileEbayListings(
  userId: string,
  listings: SyncedListing[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<ReconcileResult> {
  const start = Date.now();
  const result: ReconcileResult = {
    inserted: 0,
    updated:  0,
    ended:    0,
    skipped:  0,
    errors:   [],
    durationMs: 0,
  };

  try {
    // 1. Fetch all existing eBay-synced inventory items for this user
    const { data: existingData, error: fetchErr } = await supabase
      .from("inventory_items")
      .select("id, platform_listing_id, title, price, status")
      .eq("user_id", userId)
      .eq("sync_source", "ebay_sync");

    if (fetchErr) {
      result.errors.push(`Failed to fetch existing items: ${fetchErr.message}`);
      result.durationMs = Date.now() - start;
      return result;
    }

    const existingItems: ExistingItem[] = existingData ?? [];

    // 2. Build map: listingId → existing item
    const existingByListingId = new Map<string, ExistingItem>();
    for (const item of existingItems) {
      if (item.platform_listing_id) {
        existingByListingId.set(item.platform_listing_id, item);
      }
    }

    // 3. Build set of active listing IDs from the new sync for ended-detection
    const activeListingIds = new Set<string>();
    for (const listing of listings) {
      if (listing.isActive && listing.listingId) {
        activeListingIds.add(listing.listingId);
      }
    }

    const now = new Date().toISOString();

    // 4. Process each active listing: upsert into inventory_items
    for (const listing of listings) {
      if (!listing.isActive) {
        result.skipped++;
        continue;
      }

      try {
        const existing = listing.listingId
          ? existingByListingId.get(listing.listingId)
          : undefined;

        if (existing) {
          // UPDATE existing item
          const { error: updateErr } = await supabase
            .from("inventory_items")
            .update({
              title:       listing.title,
              price:       listing.price,
              status:      "active",
              sync_source: "ebay_sync",
              updated_at:  now,
            })
            .eq("id", existing.id);

          if (updateErr) {
            result.errors.push(`Update failed for listing ${listing.listingId}: ${updateErr.message}`);
          } else {
            result.updated++;
          }
        } else {
          // INSERT new item — scoring fields left null for next automation run
          const { error: insertErr } = await supabase
            .from("inventory_items")
            .insert({
              user_id:             userId,
              title:               listing.title,
              price:               listing.price,
              platform:            "eBay",
              status:              "active",
              sync_source:         "ebay_sync",
              platform_listing_id: listing.listingId,
              days_listed:         0,
              // Scoring fields — populated by automation cron on next run
              dead_inventory_score:       null,
              listing_health_score:       null,
              visibility_risk:            null,
              primary_recovery_action:    null,
              estimated_recovery:         null,
              created_at: now,
              updated_at: now,
            });

          if (insertErr) {
            result.errors.push(`Insert failed for SKU ${listing.sku}: ${insertErr.message}`);
          } else {
            result.inserted++;
          }
        }
      } catch (err) {
        result.errors.push(`Unexpected error for SKU ${listing.sku}: ${String(err)}`);
      }
    }

    // 5. Mark ended: existing eBay items whose listingId is NOT in the active set
    for (const item of existingItems) {
      if (
        item.status === "active" &&
        item.platform_listing_id &&
        !activeListingIds.has(item.platform_listing_id)
      ) {
        try {
          const { error: endErr } = await supabase
            .from("inventory_items")
            .update({ status: "ended", updated_at: now })
            .eq("id", item.id);

          if (endErr) {
            result.errors.push(`End-status failed for item ${item.id}: ${endErr.message}`);
          } else {
            result.ended++;
          }
        } catch (err) {
          result.errors.push(`Unexpected error ending item ${item.id}: ${String(err)}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Reconcile threw unexpectedly: ${String(err)}`);
  }

  result.durationMs = Date.now() - start;

  logger.info("runtime", "eBay reconciliation complete", {
    userId,
    inserted:   result.inserted,
    updated:    result.updated,
    ended:      result.ended,
    skipped:    result.skipped,
    errors:     result.errors.length,
    durationMs: result.durationMs,
  });

  return result;
}
