// Normalization utilities for inventory ingestion.
// All functions are pure — no side effects, no DB calls.
// Used by CSV/XLSX parsers and the review workflow before staging writes.

import type { Platform, ShippingType } from "@/lib/types";


// ─── Platform Normalization ───────────────────────────────────────────────────

const PLATFORM_MAP: Record<string, Platform> = {
  ebay: "eBay",
  "e-bay": "eBay",
  "e bay": "eBay",
  poshmark: "Poshmark",
  posh: "Poshmark",
  mercari: "Mercari",
  depop: "Depop",
  "facebook marketplace": "Facebook Marketplace",
  facebook: "Facebook Marketplace",
  fb: "Facebook Marketplace",
  fbmp: "Facebook Marketplace",
  stockx: "StockX",
  goat: "GOAT",
  whatnot: "Whatnot",
  grailed: "Grailed",
  other: "Other",
};

export function normalizePlatform(raw: string | undefined | null): Platform {
  if (!raw) return "Other";
  const key = raw.trim().toLowerCase();
  return PLATFORM_MAP[key] ?? "Other";
}

// ─── Price Normalization ──────────────────────────────────────────────────────

export type PriceNormResult =
  | { ok: true; value: number }
  | { ok: false; reason: string };

export function normalizePrice(raw: string | number | undefined | null): PriceNormResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, reason: "missing" };
  }
  const str = String(raw).replace(/[$,\s]/g, "");
  const n = parseFloat(str);
  if (!isFinite(n)) return { ok: false, reason: `not_a_number: ${raw}` };
  if (n < 0) return { ok: false, reason: "negative_price" };
  if (n > 1_000_000) return { ok: false, reason: "exceeds_max: $1,000,000" };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

// ─── Quantity / Integer Normalization ─────────────────────────────────────────

export type IntNormResult =
  | { ok: true; value: number }
  | { ok: false; reason: string };

export function normalizePositiveInt(
  raw: string | number | undefined | null,
  max = 100_000
): IntNormResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, reason: "missing" };
  }
  const str = String(raw).replace(/[,\s]/g, "");
  const n = parseInt(str, 10);
  if (!isFinite(n) || isNaN(n)) return { ok: false, reason: `not_an_integer: ${raw}` };
  if (n < 0) return { ok: false, reason: "negative_value" };
  if (n > max) return { ok: false, reason: `exceeds_max: ${max}` };
  return { ok: true, value: n };
}

// ─── Days Listed Normalization ────────────────────────────────────────────────

export function normalizeDaysListed(
  raw: string | number | undefined | null
): IntNormResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: 0 };
  }
  return normalizePositiveInt(raw, 3650);
}

// ─── Date → Days Listed ───────────────────────────────────────────────────────
// Converts a listing date string to days-since-listed.
// Accepts ISO 8601, MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, MMM DD YYYY, etc.

export function dateStringToDaysListed(raw: string | undefined | null): IntNormResult {
  if (!raw || raw.trim() === "") return { ok: true, value: 0 };

  const s = raw.trim();

  // Try native Date parsing (handles ISO 8601 and many locale formats)
  let d = new Date(s);

  // If native fails, try MM/DD/YYYY
  if (isNaN(d.getTime())) {
    const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (parts) {
      const [, m, day, y] = parts;
      const year = y.length === 2 ? `20${y}` : y;
      d = new Date(`${year}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`);
    }
  }

  if (isNaN(d.getTime())) return { ok: true, value: 0 };

  const msPerDay = 86_400_000;
  const days = Math.round((Date.now() - d.getTime()) / msPerDay);
  if (days < 0) return { ok: true, value: 0 };
  return { ok: true, value: Math.min(days, 3650) };
}

// ─── Title Normalization ──────────────────────────────────────────────────────

export type TitleNormResult =
  | { ok: true; value: string; warnings: string[] }
  | { ok: false; reason: string };

export function normalizeTitle(raw: string | undefined | null): TitleNormResult {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, reason: "empty_title" };
  }
  const warnings: string[] = [];
  let title = raw.trim();

  if (title.length > 80) {
    warnings.push(`title_truncated: ${title.length} chars → 80`);
    title = title.slice(0, 80);
  }
  if (title.length < 10) {
    warnings.push("title_too_short");
  }
  // Strip control characters
  title = title.replace(/[\x00-\x1F\x7F]/g, " ").trim();

  return { ok: true, value: title, warnings };
}

// ─── Shipping Type Normalization ──────────────────────────────────────────────

const SHIPPING_MAP: Record<string, ShippingType> = {
  free: "free",
  "free shipping": "free",
  "0": "free",
  calculated: "calculated",
  calc: "calculated",
  flat: "flat",
  "flat rate": "flat",
  "local pickup": "local_pickup",
  "local pick up": "local_pickup",
  "pickup only": "local_pickup",
};

export function normalizeShippingType(raw: string | undefined | null): ShippingType {
  if (!raw) return "calculated";
  const key = raw.trim().toLowerCase();
  return SHIPPING_MAP[key] ?? "calculated";
}

// ─── Boolean Flag Normalization ───────────────────────────────────────────────

export function normalizeBoolean(raw: string | boolean | number | undefined | null): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (!raw) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

// ─── Category Normalization ───────────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string> = {
  sneakers: "Sneakers",
  shoes: "Sneakers",
  footwear: "Sneakers",
  "t-shirts": "Shirts",
  tshirts: "Shirts",
  tees: "Shirts",
  shirts: "Shirts",
  jeans: "Jeans",
  denim: "Jeans",
  pants: "Pants",
  trousers: "Pants",
  dresses: "Dresses",
  handbags: "Handbags",
  bags: "Handbags",
  purses: "Handbags",
  jewelry: "Jewelry",
  jewellery: "Jewelry",
  electronics: "Electronics",
  collectibles: "Collectibles",
  "trading cards": "Trading Cards",
  cards: "Trading Cards",
  "vintage clothing": "Vintage Clothing",
  vintage: "Vintage Clothing",
  streetwear: "Streetwear",
};

export function normalizeCategory(raw: string | undefined | null): string {
  if (!raw || raw.trim().length === 0) return "Other";
  const key = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? raw.trim();
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export type DuplicateCheckInput = {
  title: string;
  platform: string;
  price: number;
};

export function generateDedupeKey(item: DuplicateCheckInput): string {
  const title = item.title.toLowerCase().replace(/\s+/g, " ").trim();
  const platform = item.platform.toLowerCase();
  const price = item.price.toFixed(2);
  return `${platform}|${title}|${price}`;
}

export function detectDuplicates<T extends DuplicateCheckInput>(
  items: T[]
): { unique: T[]; duplicates: Array<{ item: T; firstSeenAt: number }> } {
  const seen = new Map<string, number>();
  const unique: T[] = [];
  const duplicates: Array<{ item: T; firstSeenAt: number }> = [];

  items.forEach((item, idx) => {
    const key = generateDedupeKey(item);
    if (seen.has(key)) {
      duplicates.push({ item, firstSeenAt: seen.get(key)! });
    } else {
      seen.set(key, idx);
      unique.push(item);
    }
  });

  return { unique, duplicates };
}

// ─── Row Validator ────────────────────────────────────────────────────────────

export type NormalizationWarning = {
  field: string;
  issue: string;
  original?: string;
};

export type NormalizedRow = {
  title: string;
  platform: Platform;
  category: string;
  price: number;
  original_price?: number;
  days_listed: number;
  item_specifics_complete: boolean;
  image_count: number;
  title_keyword_strength: number;
  has_promoted_listing: boolean;
  shipping_type: ShippingType;
  shipping_cost?: number;
  views: number;
  watchers: number;
  impressions: number;
  status: "active";
  warnings: NormalizationWarning[];
};

export type RowNormResult =
  | { ok: true; row: NormalizedRow }
  | { ok: false; errors: string[]; warnings: NormalizationWarning[] };

export function normalizeInventoryRow(raw: Record<string, unknown>): RowNormResult {
  const errors: string[] = [];
  const warnings: NormalizationWarning[] = [];

  // Title
  const titleResult = normalizeTitle(raw.title as string);
  let title = "";
  if (!titleResult.ok) {
    errors.push(`title: ${titleResult.reason}`);
  } else {
    title = titleResult.value;
    titleResult.warnings.forEach((w) => warnings.push({ field: "title", issue: w }));
  }

  // Original price (resolve first so price can fall back to it)
  let original_price: number | undefined;
  if (raw.original_price !== undefined && raw.original_price !== "") {
    const ogResult = normalizePrice(raw.original_price as string);
    if (ogResult.ok) {
      original_price = ogResult.value;
    } else {
      warnings.push({ field: "original_price", issue: ogResult.reason, original: String(raw.original_price) });
    }
  }

  // Price — if raw.price is missing, fall back to original_price with a warning
  const rawPrice = raw.price !== undefined && raw.price !== "" ? raw.price : raw.original_price;
  const priceResult = normalizePrice(rawPrice as string);
  let price = 0;
  if (!priceResult.ok) {
    errors.push(`price: ${priceResult.reason}`);
  } else {
    price = priceResult.value;
    if (raw.price === undefined || raw.price === "") {
      warnings.push({ field: "price", issue: "price_inferred_from_original_price" });
    }
  }

  // Days listed — prefer days_listed integer; fall back to listed_date string
  let days_listed = 0;
  if (raw.days_listed !== undefined && raw.days_listed !== "") {
    const daysResult = normalizeDaysListed(raw.days_listed as string);
    days_listed = daysResult.ok ? daysResult.value : 0;
    if (!daysResult.ok) warnings.push({ field: "days_listed", issue: daysResult.reason });
  } else if (raw.listed_date !== undefined && raw.listed_date !== "") {
    const dateResult = dateStringToDaysListed(raw.listed_date as string);
    days_listed = dateResult.ok ? dateResult.value : 0;
    if (days_listed > 0) {
      warnings.push({ field: "days_listed", issue: `inferred_from_date: ${String(raw.listed_date)}` });
    }
  }

  // Image count
  const imgResult = normalizePositiveInt((raw.image_count ?? raw.photo_count ?? 1) as string | number, 24);
  const image_count = imgResult.ok ? imgResult.value : 1;

  // Title keyword strength (0–100, default 50)
  const tkResult = normalizePositiveInt((raw.title_keyword_strength ?? 50) as string | number, 100);
  const title_keyword_strength = tkResult.ok ? Math.min(100, tkResult.value) : 50;

  // Views / watchers / impressions
  const viewsResult = normalizePositiveInt((raw.views ?? 0) as string | number);
  const watchersResult = normalizePositiveInt((raw.watchers ?? 0) as string | number);
  const impressionsResult = normalizePositiveInt((raw.impressions ?? 0) as string | number);

  // Shipping cost (optional)
  let shipping_cost: number | undefined;
  if (raw.shipping_cost !== undefined && raw.shipping_cost !== "") {
    const scResult = normalizePrice(raw.shipping_cost as string);
    if (scResult.ok) shipping_cost = scResult.value;
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    row: {
      title,
      platform: normalizePlatform(raw.platform as string),
      category: normalizeCategory(raw.category as string),
      price,
      ...(original_price !== undefined ? { original_price } : {}),
      days_listed,
      item_specifics_complete: normalizeBoolean(raw.item_specifics_complete as string | boolean | number | null),
      image_count,
      title_keyword_strength,
      has_promoted_listing: normalizeBoolean(raw.has_promoted_listing as string | boolean | number | null),
      shipping_type: normalizeShippingType(raw.shipping_type as string),
      ...(shipping_cost !== undefined ? { shipping_cost } : {}),
      views: viewsResult.ok ? viewsResult.value : 0,
      watchers: watchersResult.ok ? watchersResult.value : 0,
      impressions: impressionsResult.ok ? impressionsResult.value : 0,
      status: "active",
      warnings,
    },
  };
}
