import { describe, it, expect } from "vitest";
import {
  normalizePlatform,
  normalizePrice,
  normalizePositiveInt,
  normalizeDaysListed,
  normalizeTitle,
  normalizeShippingType,
  normalizeBoolean,
  normalizeCategory,
  detectDuplicates,
  normalizeInventoryRow,
  dateStringToDaysListed,
} from "@/lib/ingestion/normalize";

// ─── Platform Normalization ───────────────────────────────────────────────────

describe("normalizePlatform", () => {
  it("maps common aliases", () => {
    expect(normalizePlatform("ebay")).toBe("eBay");
    expect(normalizePlatform("EBAY")).toBe("eBay");
    expect(normalizePlatform("eBay")).toBe("eBay");
    expect(normalizePlatform("poshmark")).toBe("Poshmark");
    expect(normalizePlatform("Posh")).toBe("Poshmark");
    expect(normalizePlatform("fb")).toBe("Facebook Marketplace");
    expect(normalizePlatform("fbmp")).toBe("Facebook Marketplace");
  });

  it("falls back to Other for unknown platforms", () => {
    expect(normalizePlatform("Amazon")).toBe("Other");
    expect(normalizePlatform("")).toBe("Other");
    expect(normalizePlatform(null)).toBe("Other");
    expect(normalizePlatform(undefined)).toBe("Other");
  });
});

// ─── Price Normalization ──────────────────────────────────────────────────────

describe("normalizePrice", () => {
  it("parses valid prices", () => {
    expect(normalizePrice("$19.99")).toEqual({ ok: true, value: 19.99 });
    expect(normalizePrice("1,200.00")).toEqual({ ok: true, value: 1200.0 });
    expect(normalizePrice(85)).toEqual({ ok: true, value: 85 });
    expect(normalizePrice("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects negative prices", () => {
    expect(normalizePrice("-5")).toEqual(
      expect.objectContaining({ ok: false, reason: "negative_price" })
    );
  });

  it("rejects prices over $1M", () => {
    const r = normalizePrice(1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("exceeds_max");
  });

  it("rejects non-numeric strings", () => {
    expect(normalizePrice("free")).toEqual(
      expect.objectContaining({ ok: false })
    );
    expect(normalizePrice("N/A")).toEqual(
      expect.objectContaining({ ok: false })
    );
  });

  it("rejects null/undefined/empty", () => {
    expect(normalizePrice(null)).toEqual(expect.objectContaining({ ok: false, reason: "missing" }));
    expect(normalizePrice(undefined)).toEqual(expect.objectContaining({ ok: false, reason: "missing" }));
    expect(normalizePrice("")).toEqual(expect.objectContaining({ ok: false, reason: "missing" }));
  });

  it("strips $ and commas", () => {
    expect(normalizePrice("$2,500.00")).toEqual({ ok: true, value: 2500.0 });
  });
});

// ─── Integer Normalization ────────────────────────────────────────────────────

describe("normalizePositiveInt", () => {
  it("parses valid integers", () => {
    expect(normalizePositiveInt("42")).toEqual({ ok: true, value: 42 });
    expect(normalizePositiveInt(0)).toEqual({ ok: true, value: 0 });
    expect(normalizePositiveInt("1,000")).toEqual({ ok: true, value: 1000 });
  });

  it("rejects floats (truncates to int)", () => {
    const r = normalizePositiveInt("3.7");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(3);
  });

  it("rejects values exceeding max", () => {
    const r = normalizePositiveInt(200_000, 100_000);
    expect(r.ok).toBe(false);
  });

  it("rejects negative values", () => {
    expect(normalizePositiveInt(-1)).toEqual(
      expect.objectContaining({ ok: false, reason: "negative_value" })
    );
  });
});

// ─── Days Listed ─────────────────────────────────────────────────────────────

describe("normalizeDaysListed", () => {
  it("defaults to 0 for missing values", () => {
    expect(normalizeDaysListed(null)).toEqual({ ok: true, value: 0 });
    expect(normalizeDaysListed(undefined)).toEqual({ ok: true, value: 0 });
    expect(normalizeDaysListed("")).toEqual({ ok: true, value: 0 });
  });

  it("accepts valid day counts", () => {
    expect(normalizeDaysListed("365")).toEqual({ ok: true, value: 365 });
    expect(normalizeDaysListed(90)).toEqual({ ok: true, value: 90 });
  });

  it("rejects days > 3650 (10 years)", () => {
    expect(normalizeDaysListed(5000).ok).toBe(false);
  });
});

// ─── Title Normalization ──────────────────────────────────────────────────────

describe("normalizeTitle", () => {
  it("accepts normal titles", () => {
    const r = normalizeTitle("Nike Air Max 90 Size 11");
    expect(r).toEqual(expect.objectContaining({ ok: true }));
    if (r.ok) expect(r.warnings).toHaveLength(0);
  });

  it("truncates titles > 80 chars with a warning", () => {
    const long = "A".repeat(100);
    const r = normalizeTitle(long);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.length).toBe(80);
      expect(r.warnings.some((w) => w.includes("title_truncated"))).toBe(true);
    }
  });

  it("warns on short titles < 10 chars", () => {
    const r = normalizeTitle("Shirt");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.some((w) => w.includes("too_short"))).toBe(true);
    }
  });

  it("rejects empty/null titles", () => {
    expect(normalizeTitle("")).toEqual(expect.objectContaining({ ok: false }));
    expect(normalizeTitle(null)).toEqual(expect.objectContaining({ ok: false }));
    expect(normalizeTitle("   ")).toEqual(expect.objectContaining({ ok: false }));
  });

  it("strips control characters", () => {
    const r = normalizeTitle("Nice\x00Shirt\x1FItem");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toMatch(/[\x00-\x1F]/);
  });
});

// ─── Shipping Type ────────────────────────────────────────────────────────────

describe("normalizeShippingType", () => {
  it("maps aliases", () => {
    expect(normalizeShippingType("free shipping")).toBe("free");
    expect(normalizeShippingType("0")).toBe("free");
    expect(normalizeShippingType("flat rate")).toBe("flat");
    expect(normalizeShippingType("local pick up")).toBe("local_pickup");
  });

  it("defaults to calculated for unknown values", () => {
    expect(normalizeShippingType("unknown")).toBe("calculated");
    expect(normalizeShippingType(null)).toBe("calculated");
  });
});

// ─── Boolean Normalization ────────────────────────────────────────────────────

describe("normalizeBoolean", () => {
  it("handles truthy values", () => {
    expect(normalizeBoolean("true")).toBe(true);
    expect(normalizeBoolean("yes")).toBe(true);
    expect(normalizeBoolean("1")).toBe(true);
    expect(normalizeBoolean(true)).toBe(true);
    expect(normalizeBoolean(1)).toBe(true);
  });

  it("handles falsy values", () => {
    expect(normalizeBoolean("false")).toBe(false);
    expect(normalizeBoolean("no")).toBe(false);
    expect(normalizeBoolean("0")).toBe(false);
    expect(normalizeBoolean(null)).toBe(false);
    expect(normalizeBoolean(undefined)).toBe(false);
    expect(normalizeBoolean("")).toBe(false);
  });
});

// ─── Category Normalization ───────────────────────────────────────────────────

describe("normalizeCategory", () => {
  it("normalizes aliases", () => {
    expect(normalizeCategory("sneakers")).toBe("Sneakers");
    expect(normalizeCategory("shoes")).toBe("Sneakers");
    expect(normalizeCategory("tshirts")).toBe("Shirts");
    expect(normalizeCategory("denim")).toBe("Jeans");
    expect(normalizeCategory("purses")).toBe("Handbags");
    expect(normalizeCategory("jewellery")).toBe("Jewelry");
  });

  it("passes through unknown categories as-is", () => {
    expect(normalizeCategory("Vintage Watches")).toBe("Vintage Watches");
  });

  it("returns Other for empty/null", () => {
    expect(normalizeCategory(null)).toBe("Other");
    expect(normalizeCategory("")).toBe("Other");
  });
});

// ─── Duplicate Detection ──────────────────────────────────────────────────────

describe("detectDuplicates", () => {
  const base = { title: "Nike Air Max 90 Size 11", platform: "eBay", price: 185 };

  it("returns empty duplicates for unique items", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, title: "Vintage Levi Jeans", platform: "Poshmark", price: 45, id: "b" },
    ];
    const { unique, duplicates } = detectDuplicates(items);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it("detects exact duplicates by title+platform+price", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, id: "b" },
      { ...base, id: "c" },
    ];
    const { unique, duplicates } = detectDuplicates(items);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(2);
  });

  it("treats same title different price as NOT duplicate", () => {
    const items = [
      { ...base, id: "a", price: 185 },
      { ...base, id: "b", price: 175 },
    ];
    const { unique, duplicates } = detectDuplicates(items);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it("is case-insensitive for title comparison", () => {
    const items = [
      { ...base, id: "a", title: "Nike Air Max 90" },
      { ...base, id: "b", title: "NIKE AIR MAX 90" },
    ];
    const { unique, duplicates } = detectDuplicates(items);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
  });

  it("includes firstSeenAt index in duplicates", () => {
    const items = [base, base];
    const { duplicates } = detectDuplicates(items);
    expect(duplicates[0].firstSeenAt).toBe(0);
  });
});

// ─── Full Row Normalization ───────────────────────────────────────────────────

describe("normalizeInventoryRow", () => {
  const validRow = {
    title: "Nike Air Max 90 Size 11 DS",
    platform: "ebay",
    category: "sneakers",
    price: "$185.00",
    days_listed: "30",
    image_count: "8",
    views: "42",
    watchers: "7",
  };

  it("accepts a valid row", () => {
    const r = normalizeInventoryRow(validRow);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.platform).toBe("eBay");
      expect(r.row.category).toBe("Sneakers");
      expect(r.row.price).toBe(185);
      expect(r.row.image_count).toBe(8);
      expect(r.row.status).toBe("active");
    }
  });

  it("rejects row with missing title", () => {
    const r = normalizeInventoryRow({ ...validRow, title: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("rejects row with invalid price", () => {
    const r = normalizeInventoryRow({ ...validRow, price: "free" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("price"))).toBe(true);
  });

  it("rejects row with negative price", () => {
    const r = normalizeInventoryRow({ ...validRow, price: "-10" });
    expect(r.ok).toBe(false);
  });

  it("adds warning for original_price parse failure but still succeeds", () => {
    const r = normalizeInventoryRow({ ...validRow, original_price: "n/a" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.warnings.some((w) => w.field === "original_price")).toBe(true);
    }
  });

  it("handles missing optional fields gracefully", () => {
    const minimal = { title: "Plain Shirt", price: "12" };
    const r = normalizeInventoryRow(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.platform).toBe("Other");
      expect(r.row.category).toBe("Other");
      expect(r.row.days_listed).toBe(0);
      expect(r.row.image_count).toBe(1);
    }
  });
});

// ─── Dangerous Input Guard ────────────────────────────────────────────────────

describe("dangerous inputs rejected or sanitized", () => {
  it("strips control characters from title", () => {
    const r = normalizeInventoryRow({
      title: "Nice Item\x00DROP TABLE inventory",
      price: "25",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.row.title).not.toContain("\x00");
  });

  it("rejects massive price values", () => {
    const r = normalizeInventoryRow({ title: "Item", price: "9999999999" });
    expect(r.ok).toBe(false);
  });

  it("handles XSS attempt in title — truncates but accepts as string", () => {
    const r = normalizeInventoryRow({
      title: "<script>alert('xss')</script>",
      price: "25",
    });
    // Schema layer accepts strings; XSS prevention is the UI's responsibility
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Title is stored as plain text — no HTML execution possible in DB
      expect(typeof r.row.title).toBe("string");
    }
  });
});

// ─── dateStringToDaysListed ───────────────────────────────────────────────────

describe("dateStringToDaysListed", () => {
  it("returns 0 for empty/null input", () => {
    expect(dateStringToDaysListed("").ok && dateStringToDaysListed("").value).toBe(0);
    expect(dateStringToDaysListed(null).ok && dateStringToDaysListed(null).value).toBe(0);
    expect(dateStringToDaysListed(undefined).ok && dateStringToDaysListed(undefined).value).toBe(0);
  });

  it("parses ISO 8601 date", () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const result = dateStringToDaysListed(d.toISOString());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeGreaterThanOrEqual(29);
      expect(result.value).toBeLessThanOrEqual(31);
    }
  });

  it("parses YYYY-MM-DD format", () => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    const str = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const result = dateStringToDaysListed(str);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeGreaterThanOrEqual(59);
      expect(result.value).toBeLessThanOrEqual(61);
    }
  });

  it("parses MM/DD/YYYY format", () => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const result = dateStringToDaysListed(`${mm}/${dd}/${yyyy}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeGreaterThanOrEqual(13);
      expect(result.value).toBeLessThanOrEqual(15);
    }
  });

  it("clamps to 0 for future dates", () => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const result = dateStringToDaysListed(d.toISOString().slice(0, 10));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it("returns 0 for unparseable strings", () => {
    const result = dateStringToDaysListed("not a date at all");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });
});

// ─── normalizeInventoryRow — price fallback ───────────────────────────────────

describe("normalizeInventoryRow price fallback", () => {
  it("accepts original_price as fallback when price is missing", () => {
    const r = normalizeInventoryRow({ title: "Test Item", original_price: "45.00" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.price).toBe(45);
      expect(r.row.warnings.some((w) => w.issue === "price_inferred_from_original_price")).toBe(true);
    }
  });

  it("uses price field directly when both present", () => {
    const r = normalizeInventoryRow({ title: "Test Item", price: "30", original_price: "45" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.price).toBe(30);
      expect(r.row.original_price).toBe(45);
    }
  });

  it("rejects row when both price and original_price are missing", () => {
    const r = normalizeInventoryRow({ title: "Test Item" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("price"))).toBe(true);
  });
});

// ─── normalizeInventoryRow — listed_date fallback ─────────────────────────────

describe("normalizeInventoryRow listed_date fallback", () => {
  it("infers days_listed from listed_date when days_listed not present", () => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    const r = normalizeInventoryRow({
      title: "Test Item",
      price: "25",
      listed_date: d.toISOString().slice(0, 10),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.days_listed).toBeGreaterThanOrEqual(44);
      expect(r.row.days_listed).toBeLessThanOrEqual(46);
    }
  });

  it("prefers explicit days_listed over listed_date", () => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    const r = normalizeInventoryRow({
      title: "Test Item",
      price: "25",
      days_listed: "10",
      listed_date: d.toISOString().slice(0, 10),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.row.days_listed).toBe(10);
  });
});
