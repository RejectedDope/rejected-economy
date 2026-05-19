// Safe CSV parser for inventory imports.
// Wraps PapaParse with size limits, encoding guards, and row normalization.
// Browser-safe: no Node.js fs imports.

import Papa from "papaparse";
import { normalizeInventoryRow, type RowNormResult, type NormalizedRow } from "./normalize";
import { logger } from "@/lib/logger";

export const CSV_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const CSV_MAX_ROWS = 10_000;

export type CsvParseResult = {
  ok: boolean;
  rows: NormalizedRow[];
  errors: CsvRowError[];
  warnings: CsvRowError[];
  skipped: number;
  totalParsed: number;
  truncated: boolean;
};

export type CsvRowError = {
  rowIndex: number;
  field?: string;
  message: string;
};

// ─── Column Aliases ───────────────────────────────────────────────────────────
// Maps common export column names → our internal field names.
// Both eBay Seller Hub and Poshmark CSV exports are covered.

const COLUMN_ALIASES: Record<string, string> = {
  // Title variants
  "item title": "title",
  "listing title": "title",
  "title": "title",

  // Price variants
  "current price": "price",
  "buy it now price": "price",
  "listing price": "price",
  "price": "price",
  "sold price": "price",

  // Original price
  "start price": "original_price",
  "original price": "original_price",
  "original_price": "original_price",

  // Platform
  "platform": "platform",
  "marketplace": "platform",
  "site": "platform",

  // Category
  "category": "category",
  "ebay category": "category",
  "item category": "category",

  // Days listed
  "days listed": "days_listed",
  "days_listed": "days_listed",
  "age": "days_listed",
  "listing age": "days_listed",

  // Photos
  "photo count": "image_count",
  "image count": "image_count",
  "photos": "image_count",
  "num photos": "image_count",
  "image_count": "image_count",

  // Engagement
  "views": "views",
  "page views": "views",
  "total views": "views",
  "watchers": "watchers",
  "watching": "watchers",
  "total watchers": "watchers",
  "impressions": "impressions",

  // Condition / specifics
  "item specifics": "item_specifics_complete",
  "specifics complete": "item_specifics_complete",

  // Shipping
  "shipping type": "shipping_type",
  "shipping service": "shipping_type",
  "shipping cost": "shipping_cost",
  "shipping price": "shipping_cost",
};

function normalizeHeader(raw: string): string {
  const key = raw.trim().toLowerCase();
  return COLUMN_ALIASES[key] ?? key.replace(/\s+/g, "_");
}

function remapRow(raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const mapped = normalizeHeader(k);
    out[mapped] = v;
  }
  return out;
}

// ─── Parse Entry Point ────────────────────────────────────────────────────────

export function parseCSVFile(
  file: File,
  onComplete: (result: CsvParseResult) => void
): void {
  if (file.size > CSV_MAX_BYTES) {
    onComplete({
      ok: false,
      rows: [],
      errors: [{ rowIndex: 0, message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 10 MB)` }],
      warnings: [],
      skipped: 0,
      totalParsed: 0,
      truncated: false,
    });
    return;
  }

  const rows: NormalizedRow[] = [];
  const errors: CsvRowError[] = [];
  const warnings: CsvRowError[] = [];
  let totalParsed = 0;
  let truncated = false;

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => normalizeHeader(h),
    complete(results) {
      const raw = results.data;

      if (raw.length > CSV_MAX_ROWS) {
        truncated = true;
        logger.warn("ingestion", `CSV truncated: ${raw.length} rows → ${CSV_MAX_ROWS}`);
      }

      const capped = raw.slice(0, CSV_MAX_ROWS);
      totalParsed = capped.length;

      capped.forEach((rawRow, idx) => {
        const remapped = remapRow(rawRow);
        const result: RowNormResult = normalizeInventoryRow(remapped);

        if (!result.ok) {
          errors.push(...result.errors.map((e) => ({ rowIndex: idx + 1, message: e })));
          result.warnings.forEach((w) =>
            warnings.push({ rowIndex: idx + 1, field: w.field, message: w.issue })
          );
        } else {
          rows.push(result.row);
          result.row.warnings.forEach((w) =>
            warnings.push({ rowIndex: idx + 1, field: w.field, message: w.issue })
          );
        }
      });

      logger.info("ingestion", "CSV parse complete", {
        file: file.name,
        total: totalParsed,
        ok: rows.length,
        errors: errors.length,
        warnings: warnings.length,
        truncated,
      });

      onComplete({
        ok: errors.length === 0,
        rows,
        errors,
        warnings,
        skipped: totalParsed - rows.length,
        totalParsed,
        truncated,
      });
    },
    error(err: { message: string }) {
      logger.error("ingestion", "CSV parse failed", { file: file.name, error: err.message });
      onComplete({
        ok: false,
        rows: [],
        errors: [{ rowIndex: 0, message: `Parse error: ${err.message}` }],
        warnings: [],
        skipped: 0,
        totalParsed: 0,
        truncated: false,
      });
    },
  });
}

// ─── Parse from ArrayBuffer (for XLSX sheet → CSV export path) ───────────────

// ─── Extract Raw Headers ──────────────────────────────────────────────────────
// Returns original (non-normalized) column headers from a CSV file.
// Used to power the ColumnMapper UI before full parse.

export function parseCSVHeaders(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      preview: 1,
      complete(results) {
        resolve(results.meta.fields ?? []);
      },
      error() {
        resolve([]);
      },
    });
  });
}

// ─── Parse with Custom Column Mapping ────────────────────────────────────────
// Like parseCSVFile but accepts a user-confirmed ColumnMapping that overrides
// the default COLUMN_ALIASES. Mapping keys are raw CSV header names.

export function parseCSVFileWithMapping(
  file: File,
  customMapping: Record<string, string>,
  onComplete: (result: CsvParseResult) => void
): void {
  const combinedAliases: Record<string, string> = { ...COLUMN_ALIASES };
  for (const [raw, target] of Object.entries(customMapping)) {
    if (target) combinedAliases[raw.trim().toLowerCase()] = target;
  }

  function mappedHeader(raw: string): string {
    const key = raw.trim().toLowerCase();
    return combinedAliases[key] ?? key.replace(/\s+/g, "_");
  }

  const rows: NormalizedRow[] = [];
  const errors: CsvRowError[] = [];
  const warnings: CsvRowError[] = [];
  let totalParsed = 0;
  let truncated = false;

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: mappedHeader,
    complete(results) {
      const raw = results.data;
      if (raw.length > CSV_MAX_ROWS) truncated = true;
      const capped = raw.slice(0, CSV_MAX_ROWS);
      totalParsed = capped.length;

      capped.forEach((rawRow, idx) => {
        const rowNum = idx + 1;
        const r = normalizeInventoryRow(rawRow);
        if (!r.ok) {
          errors.push(...r.errors.map((e) => ({ rowIndex: rowNum, message: e })));
          r.warnings.forEach((w) => warnings.push({ rowIndex: rowNum, field: w.field, message: w.issue }));
        } else {
          rows.push(r.row);
          r.row.warnings.forEach((w) => warnings.push({ rowIndex: rowNum, field: w.field, message: w.issue }));
        }
      });

      onComplete({
        ok: rows.length > 0,
        rows,
        errors,
        warnings,
        skipped: totalParsed - rows.length,
        totalParsed,
        truncated,
      });
    },
    error(err) {
      onComplete({ ok: false, rows: [], errors: [{ rowIndex: 0, message: err.message }], warnings: [], skipped: 0, totalParsed: 0, truncated: false });
    },
  });
}

export function parseCSVString(csvText: string, sourceName: string): CsvParseResult {
  const rows: NormalizedRow[] = [];
  const errors: CsvRowError[] = [];
  const warnings: CsvRowError[] = [];

  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => normalizeHeader(h),
  });

  let totalParsed = 0;
  let truncated = false;

  const raw = results.data;
  if (raw.length > CSV_MAX_ROWS) {
    truncated = true;
  }
  const capped = raw.slice(0, CSV_MAX_ROWS);
  totalParsed = capped.length;

  capped.forEach((rawRow, idx) => {
    const remapped = remapRow(rawRow);
    const result: RowNormResult = normalizeInventoryRow(remapped);
    if (!result.ok) {
      errors.push(...result.errors.map((e) => ({ rowIndex: idx + 1, message: e })));
    } else {
      rows.push(result.row);
      result.row.warnings.forEach((w) =>
        warnings.push({ rowIndex: idx + 1, field: w.field, message: w.issue })
      );
    }
  });

  logger.info("ingestion", "CSV string parse complete", {
    source: sourceName,
    total: totalParsed,
    ok: rows.length,
    errors: errors.length,
  });

  return {
    ok: errors.length === 0,
    rows,
    errors,
    warnings,
    skipped: totalParsed - rows.length,
    totalParsed,
    truncated,
  };
}
