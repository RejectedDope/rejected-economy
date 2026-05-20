// Pre-insert validation for imported inventory rows.
// Runs before any DB write. Quarantines records that violate hard rules.
// Warnings are attached to valid records and surfaced in the review UI.

import type { NormalizedRow } from "./normalize";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrustRule =
  | "price_unreasonable"
  | "price_far_above_original"
  | "shipping_exceeds_price"
  | "age_implausible"
  | "title_too_short"
  | "image_count_excessive"
  | "intra_batch_duplicate"
  | "zero_price_with_title";

export type TrustViolation = {
  field: string;
  rule: TrustRule;
  severity: "reject" | "warn";
  original?: unknown;
  message: string;
};

export type TrustCheckResult = {
  ok: boolean;
  violations: TrustViolation[];
  warnings: TrustViolation[];
};

export type QuarantinedRow = {
  row: NormalizedRow;
  rowIndex: number;
  violations: TrustViolation[];
};

export type BatchTrustResult = {
  valid: NormalizedRow[];
  quarantined: QuarantinedRow[];
  warnings: Map<number, TrustViolation[]>;
  validCount: number;
  quarantinedCount: number;
};

// ─── Per-Row Validation ───────────────────────────────────────────────────────

export function checkRowTrust(row: NormalizedRow): TrustCheckResult {
  const violations: TrustViolation[] = [];
  const warnings: TrustViolation[] = [];

  // Price hard ceiling — $50k+ is almost certainly a data error
  if (row.price > 50_000) {
    violations.push({
      field: "price",
      rule: "price_unreasonable",
      severity: "reject",
      original: row.price,
      message: `Price $${row.price.toFixed(2)} exceeds $50,000 — likely a data error`,
    });
  }

  // Zero price on a named item is suspicious (free giveaway vs. missing data)
  if (row.price === 0 && row.title.trim().length > 0) {
    violations.push({
      field: "price",
      rule: "zero_price_with_title",
      severity: "reject",
      original: row.price,
      message: `Price is $0 for "${row.title}" — missing price data`,
    });
  }

  // Implausible age — if dateStringToDaysListed produced something > 3650 that
  // somehow slipped through, reject it
  if (row.days_listed > 3650) {
    violations.push({
      field: "days_listed",
      rule: "age_implausible",
      severity: "reject",
      original: row.days_listed,
      message: `Listed ${row.days_listed} days (over 10 years) — likely a date parsing error`,
    });
  }

  // Title too short to be a real listing
  if (row.title.trim().length < 3) {
    violations.push({
      field: "title",
      rule: "title_too_short",
      severity: "reject",
      original: row.title,
      message: `Title "${row.title}" is too short to be a valid listing`,
    });
  }

  // ── Warnings (don't block, surface in review) ────────────────────────────

  // Shipping cost larger than the item price
  if (
    row.shipping_cost !== undefined &&
    row.shipping_cost > 0 &&
    row.price > 0 &&
    row.shipping_cost > row.price
  ) {
    warnings.push({
      field: "shipping_cost",
      rule: "shipping_exceeds_price",
      severity: "warn",
      original: row.shipping_cost,
      message: `Shipping cost ($${row.shipping_cost}) exceeds item price ($${row.price})`,
    });
  }

  // Price far above original (data entry error or legitimate premium)
  if (
    row.original_price !== undefined &&
    row.original_price > 0 &&
    row.price > row.original_price * 10
  ) {
    warnings.push({
      field: "price",
      rule: "price_far_above_original",
      severity: "warn",
      original: row.price,
      message: `Price is ${(row.price / row.original_price).toFixed(1)}× the original price — verify this is correct`,
    });
  }

  // Image count beyond any platform's max
  if (row.image_count > 50) {
    warnings.push({
      field: "image_count",
      rule: "image_count_excessive",
      severity: "warn",
      original: row.image_count,
      message: `${row.image_count} images — most platforms allow 12–24 max`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
  };
}

// ─── Batch Validation ─────────────────────────────────────────────────────────

export function checkBatchTrust(rows: NormalizedRow[]): BatchTrustResult {
  const valid: NormalizedRow[] = [];
  const quarantined: QuarantinedRow[] = [];
  const warnings = new Map<number, TrustViolation[]>();

  // Intra-batch duplicate index: platform|title|price → first row index
  const dedupeIndex = new Map<string, number>();

  rows.forEach((row, idx) => {
    const result = checkRowTrust(row);
    const rowWarnings = [...result.warnings];

    // Intra-batch duplicate detection (warn, don't reject — server-side dedupe handles rejection)
    const dedupeKey = `${row.platform.toLowerCase()}|${row.title.toLowerCase().replace(/\s+/g, " ").trim()}|${row.price.toFixed(2)}`;
    if (dedupeIndex.has(dedupeKey)) {
      rowWarnings.push({
        field: "title",
        rule: "intra_batch_duplicate",
        severity: "warn",
        message: `Same as row ${dedupeIndex.get(dedupeKey)! + 1} in this batch (same platform, title, and price)`,
      });
    } else {
      dedupeIndex.set(dedupeKey, idx);
    }

    if (rowWarnings.length > 0) {
      warnings.set(idx, rowWarnings);
    }

    if (!result.ok) {
      quarantined.push({ row, rowIndex: idx, violations: result.violations });
    } else {
      valid.push(row);
    }
  });

  return {
    valid,
    quarantined,
    warnings,
    validCount: valid.length,
    quarantinedCount: quarantined.length,
  };
}

// ─── Violation Summaries ──────────────────────────────────────────────────────

export function summarizeViolations(quarantined: QuarantinedRow[]): string {
  const ruleCount = new Map<TrustRule, number>();
  for (const { violations } of quarantined) {
    for (const v of violations) {
      ruleCount.set(v.rule, (ruleCount.get(v.rule) ?? 0) + 1);
    }
  }
  return Array.from(ruleCount.entries())
    .map(([rule, count]) => `${count} ${rule.replace(/_/g, " ")}`)
    .join(", ");
}
