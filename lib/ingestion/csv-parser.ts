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
// Covers: eBay Seller Hub, Poshmark, Mercari, Depop, StockX, GOAT, generic.

const COLUMN_ALIASES: Record<string, string> = {
  // ── Title ──────────────────────────────────────────────────────────────────
  "title": "title",
  "item title": "title",
  "listing title": "title",
  "listing name": "title",       // Poshmark
  "item name": "title",
  "product name": "title",
  "name": "title",
  "description": "title",       // fallback for minimal exports

  // ── Price ──────────────────────────────────────────────────────────────────
  "price": "price",
  "current price": "price",
  "buy it now price": "price",
  "buy it now": "price",
  "listing price": "price",
  "selling price": "price",
  "sale price": "price",
  "ask price": "price",
  "lowest ask": "price",         // StockX
  "ask": "price",                // GOAT
  "net proceeds": "price",       // Poshmark net (close enough)
  "amount": "price",

  // ── Original / retail price ────────────────────────────────────────────────
  "original price": "original_price",
  "original_price": "original_price",
  "start price": "original_price",  // eBay Seller Hub
  "retail price": "original_price",
  "msrp": "original_price",
  "cost": "original_price",
  "cost basis": "original_price",

  // ── Platform ───────────────────────────────────────────────────────────────
  "platform": "platform",
  "marketplace": "platform",
  "site": "platform",
  "source": "platform",

  // ── Category ───────────────────────────────────────────────────────────────
  "category": "category",
  "ebay category": "category",
  "item category": "category",
  "department": "category",
  "type": "category",
  "product type": "category",

  // ── Days listed / date ─────────────────────────────────────────────────────
  "days listed": "days_listed",
  "days_listed": "days_listed",
  "age": "days_listed",
  "listing age": "days_listed",
  "listed date": "listed_date",  // will convert to days_listed
  "date listed": "listed_date",
  "list date": "listed_date",
  "created": "listed_date",
  "created date": "listed_date",
  "date created": "listed_date",
  "posted": "listed_date",
  "posted date": "listed_date",
  "start date": "listed_date",   // eBay Seller Hub
  "listing date": "listed_date",
  "listed": "listed_date",

  // ── Photos ─────────────────────────────────────────────────────────────────
  "photos": "image_count",
  "photo count": "image_count",
  "image count": "image_count",
  "num photos": "image_count",
  "image_count": "image_count",
  "number of photos": "image_count",
  "photo #": "image_count",

  // ── Engagement ─────────────────────────────────────────────────────────────
  "views": "views",
  "page views": "views",
  "total views": "views",
  "visit count": "views",
  "watchers": "watchers",
  "watching": "watchers",
  "total watchers": "watchers",
  "likes": "watchers",           // Poshmark/Depop — proxy for interest
  "saves": "watchers",           // Depop saves
  "favorites": "watchers",
  "hearts": "watchers",          // Depop hearts
  "impressions": "impressions",
  "search appearances": "impressions",

  // ── Specifics / quality ────────────────────────────────────────────────────
  "item specifics": "item_specifics_complete",
  "specifics complete": "item_specifics_complete",
  "has specifics": "item_specifics_complete",

  // ── Shipping ───────────────────────────────────────────────────────────────
  "shipping type": "shipping_type",
  "shipping service": "shipping_type",
  "shipping method": "shipping_type",
  "shipping cost": "shipping_cost",
  "shipping price": "shipping_cost",
  "postage cost": "shipping_cost",
  "delivery cost": "shipping_cost",

  // ── SKU / identifiers (mapped to sku for reference, not a required field) ──
  "sku": "sku",
  "custom label": "sku",
  "custom label (sku)": "sku",
  "item id": "sku",
  "listing id": "sku",
  "asin": "sku",
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

// Detect platform from filename so single-platform exports auto-populate.
export function detectPlatformFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.includes("poshmark")) return "Poshmark";
  if (lower.includes("ebay") || lower.includes("e-bay")) return "eBay";
  if (lower.includes("mercari")) return "Mercari";
  if (lower.includes("depop")) return "Depop";
  if (lower.includes("facebook") || lower.includes("fbmp")) return "Facebook Marketplace";
  if (lower.includes("stockx")) return "StockX";
  if (lower.includes("goat")) return "GOAT";
  if (lower.includes("whatnot")) return "Whatnot";
  if (lower.includes("grailed")) return "Grailed";
  return null;
}

// Detect which required fields are present in a set of CSV headers.
export function detectMappedFields(headers: string[]): {
  hasTitle: boolean;
  hasPrice: boolean;
  hasPlatform: boolean;
  hasDays: boolean;
  detectedFields: string[];
} {
  const mapped = headers.map((h) => normalizeHeader(h));
  const titleFields = ["title"];
  const priceFields = ["price", "original_price"];
  const platformFields = ["platform"];
  const daysFields = ["days_listed", "listed_date"];

  return {
    hasTitle: mapped.some((f) => titleFields.includes(f)),
    hasPrice: mapped.some((f) => priceFields.includes(f)),
    hasPlatform: mapped.some((f) => platformFields.includes(f)),
    hasDays: mapped.some((f) => daysFields.includes(f)),
    detectedFields: mapped.filter((f) => f !== f.replace(/\s+/g, "_") || COLUMN_ALIASES[f]),
  };
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

      // Auto-inject platform from filename when rows have no platform column
      const platformFromFile = detectPlatformFromFilename(file.name);

      capped.forEach((rawRow, idx) => {
        const remapped = remapRow(rawRow);
        // If no platform column detected, inject from filename
        if ((!remapped.platform || remapped.platform === "") && platformFromFile) {
          remapped.platform = platformFromFile;
        }
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

      const platformFromFile = detectPlatformFromFilename(file.name);

      capped.forEach((rawRow, idx) => {
        const rowNum = idx + 1;
        const row: Record<string, unknown> = { ...rawRow };
        if ((!row.platform || row.platform === "") && platformFromFile) {
          row.platform = platformFromFile;
        }
        const r = normalizeInventoryRow(row);
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
