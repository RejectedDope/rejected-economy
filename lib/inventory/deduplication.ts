// ============================================================
// RESALEIQ — Deduplication Module
// Pure functions. No side effects. No DB calls.
// ============================================================

import type { InventoryItem } from "@/lib/types";
import type { NormalizedRow } from "@/lib/ingestion/normalize";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DedupeMatch {
  incoming_index: number;   // index in incoming array
  existing_id: string;
  confidence: "high" | "medium" | "low";
  matched_fields: string[];
  recommendation: "skip" | "update" | "merge";
  reasoning: string;
}

export interface DedupeResult {
  unique: NormalizedRow[];
  matches: DedupeMatch[];
  match_count: number;
  unique_count: number;
}

// ─── String Normalization ─────────────────────────────────────────────────────

export function normalizeForDedup(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "");
}

// ─── Title Similarity ─────────────────────────────────────────────────────────

export function titleSimilarity(a: string, b: string): number {
  const normA = normalizeForDedup(a);
  const normB = normalizeForDedup(b);

  const wordsA = new Set(normA.split(" ").filter(Boolean));
  const wordsB = new Set(normB.split(" ").filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set<string>();
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersection.add(word);
    }
  }

  return intersection.size / Math.max(wordsA.size, wordsB.size);
}

// ─── Dedupe Against Existing Inventory ───────────────────────────────────────

export function dedupeAgainstExisting(
  incoming: NormalizedRow[],
  existing: InventoryItem[]
): DedupeResult {
  const activeExisting = existing.filter((i) => i.status === "active");

  const matches: DedupeMatch[] = [];
  const matchedIncomingIndices = new Set<number>();

  for (let idx = 0; idx < incoming.length; idx++) {
    const row = incoming[idx];

    for (const existing_item of activeExisting) {
      const sim = titleSimilarity(row.title, existing_item.title);
      const samePlatform = row.platform === existing_item.platform;

      // Price within 5%
      const priceDiff =
        Math.abs(row.price - existing_item.price) /
        Math.max(existing_item.price, 1);
      const priceClose = priceDiff <= 0.05;

      let confidence: "high" | "medium" | "low" | null = null;
      const matched_fields: string[] = [];
      let recommendation: "skip" | "update" | "merge" = "skip";
      let reasoning = "";

      if (samePlatform && sim >= 0.85 && priceClose) {
        // HIGH: same platform, near-identical title, price within 5%
        confidence = "high";
        matched_fields.push("platform", "title", "price");
        recommendation = "skip";
        reasoning = `Same platform (${row.platform}), title similarity ${(sim * 100).toFixed(0)}%, price within ${(priceDiff * 100).toFixed(1)}% — almost certainly the same listing.`;
      } else if (samePlatform && sim >= 0.65) {
        // MEDIUM: same platform, similar title
        confidence = "medium";
        matched_fields.push("platform", "title");
        recommendation = "update";
        reasoning = `Same platform (${row.platform}) with title similarity ${(sim * 100).toFixed(0)}% — likely the same item with updated details.`;
      } else if (!samePlatform && sim >= 0.80) {
        // LOW: different platform, high title similarity
        confidence = "low";
        matched_fields.push("title");
        recommendation = "merge";
        reasoning = `Title similarity ${(sim * 100).toFixed(0)}% across different platforms (${existing_item.platform} vs ${row.platform}) — possible cross-platform duplicate.`;
      }

      if (confidence !== null) {
        matches.push({
          incoming_index: idx,
          existing_id: existing_item.id,
          confidence,
          matched_fields,
          recommendation,
          reasoning,
        });
        matchedIncomingIndices.add(idx);
        // First match wins — stop checking remaining existing items for this row
        break;
      }
    }
  }

  const unique = incoming.filter((_, idx) => !matchedIncomingIndices.has(idx));

  return {
    unique,
    matches,
    match_count: matches.length,
    unique_count: unique.length,
  };
}

// ─── Dedupe Within Batch ──────────────────────────────────────────────────────

export function dedupeWithinBatch(incoming: NormalizedRow[]): {
  unique: NormalizedRow[];
  duplicates: Array<{ item: NormalizedRow; firstSeenAt: number }>;
} {
  const seen = new Map<string, number>(); // key → index of first occurrence
  const unique: NormalizedRow[] = [];
  const duplicates: Array<{ item: NormalizedRow; firstSeenAt: number }> = [];

  for (let idx = 0; idx < incoming.length; idx++) {
    const row = incoming[idx];
    const key = `${row.platform}|${normalizeForDedup(row.title)}|${row.price.toFixed(0)}`;

    if (seen.has(key)) {
      duplicates.push({ item: row, firstSeenAt: seen.get(key)! });
    } else {
      seen.set(key, idx);
      unique.push(row);
    }
  }

  return { unique, duplicates };
}
