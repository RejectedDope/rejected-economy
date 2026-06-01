// OCR extraction for listing screenshots.
// Browser-only — Tesseract.js runs client-side via WebAssembly.
// No external APIs. No server calls.

import type { ExtractedListingFields } from "./screenshot-parser";

// ─── Price extraction ─────────────────────────────────────────────────────────

function extractPrice(text: string): string | undefined {
  // Match $XX, $XX.XX, $X,XXX patterns
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (match) return match[1].replace(/,/g, "");
  // Match bare number followed by currency keywords
  const bare = text.match(/(?:price|listing|buy)[\s:]+\$?([\d,]+(?:\.\d{1,2})?)/i);
  if (bare) return bare[1].replace(/,/g, "");
  return undefined;
}

// ─── Platform detection ────────────────────────────────────────────────────────

const PLATFORM_KEYWORDS: Array<[RegExp, string]> = [
  [/ebay/i, "eBay"],
  [/poshmark/i, "Poshmark"],
  [/mercari/i, "Mercari"],
  [/depop/i, "Depop"],
  [/facebook\s+marketplace|fb\s+marketplace|fbmp/i, "Facebook Marketplace"],
  [/stockx/i, "StockX"],
  [/goat/i, "GOAT"],
  [/whatnot/i, "Whatnot"],
  [/grailed/i, "Grailed"],
];

function detectPlatform(text: string): string | undefined {
  for (const [pattern, name] of PLATFORM_KEYWORDS) {
    if (pattern.test(text)) return name;
  }
  return undefined;
}

// ─── Days listed extraction ────────────────────────────────────────────────────

function extractDaysListed(text: string): string | undefined {
  // "Listed X days ago" / "X days" / "Xd"
  const patterns = [
    /(\d+)\s+days?\s+ago/i,
    /listed\s+(\d+)\s+days?/i,
    /age[:\s]+(\d+)/i,
    /(\d+)d\s+ago/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1];
  }
  return undefined;
}

// ─── Engagement metrics extraction ────────────────────────────────────────────

function extractMetric(text: string, keywords: string[]): string | undefined {
  for (const kw of keywords) {
    const pat = new RegExp(`(\\d+)\\s*${kw}|${kw}\\s*[:\\s]\\s*(\\d+)`, "i");
    const m = text.match(pat);
    if (m) return m[1] ?? m[2];
  }
  return undefined;
}

// ─── Category normalization ────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/sneaker|shoe|boot|jordan|yeezy|nike|adidas|new balance/i, "Shoes"],
  [/jacket|coat|hoodie|sweater|pullover|outerwear/i, "Tops"],
  [/shirt|tee|t-shirt|polo|blouse/i, "Tops"],
  [/pant|jean|denim|trouser|shorts|legging/i, "Bottoms"],
  [/dress|skirt|romper/i, "Dresses"],
  [/bag|purse|handbag|tote|backpack|wallet/i, "Bags"],
  [/watch|jewelry|ring|necklace|bracelet/i, "Accessories"],
  [/hat|cap|beanie|snapback/i, "Accessories"],
  [/video game|console|playstation|xbox|nintendo|ps4|ps5/i, "Video Games"],
  [/phone|iphone|samsung|android|tablet|ipad/i, "Electronics"],
  [/vinyl|record|cd|cassette/i, "Music"],
  [/book|novel|manga|comic/i, "Books"],
  [/toy|lego|action figure|figurine|doll/i, "Toys"],
  [/card|pokemon|trading card|sports card/i, "Trading Cards"],
];

export function normalizeCategory(text: string): string | undefined {
  for (const [pat, cat] of CATEGORY_KEYWORDS) {
    if (pat.test(text)) return cat;
  }
  return undefined;
}

// ─── Truncated title detection ────────────────────────────────────────────────
// Titles that end mid-word or with an ellipsis are likely OCR artifacts.

function isTruncated(title: string): boolean {
  if (!title) return false;
  if (title.endsWith("...") || title.endsWith("…")) return true;
  // Last word < 3 chars and title is shorter than 40 chars (likely cut off)
  const words = title.trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  return title.length < 40 && lastWord.length <= 2 && !/[.!?)]$/.test(title);
}

// ─── Title extraction ──────────────────────────────────────────────────────────
// Heuristic: longest line that isn't a URL or pure number, in the upper 40% of text.

function extractTitle(lines: string[]): string | undefined {
  const candidates = lines
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 15 &&
      l.length < 120 &&
      !/^[\d$,.\s]+$/.test(l) &&
      !l.startsWith("http") &&
      !/^\d+$/.test(l) &&
      // Exclude obvious UI chrome
      !/^(sold|make offer|buy it now|add to cart|save|share|watch|report|back|menu|search|home)$/i.test(l.trim())
    );

  if (candidates.length === 0) return undefined;

  // Sort by length desc (longer = more descriptive title) but prefer non-truncated
  const sorted = [...candidates].sort((a, b) => {
    const aTrunc = isTruncated(a) ? -10 : 0;
    const bTrunc = isTruncated(b) ? -10 : 0;
    return b.length + bTrunc - (a.length + aTrunc);
  });

  return sorted[0];
}

// ─── Confidence scoring ────────────────────────────────────────────────────────

function scoreConfidence(fields: Omit<ExtractedListingFields, "confidence" | "extractionMethod">): ExtractedListingFields["confidence"] {
  const filled = [fields.title, fields.price, fields.platform].filter(Boolean).length;
  if (filled === 3) return "high";
  if (filled >= 2) return "medium";
  if (filled >= 1) return "low";
  return "none";
}

// ─── Main OCR extraction ───────────────────────────────────────────────────────

export async function extractFromScreenshot(
  imageFile: File,
  onProgress?: (pct: number, status: string) => void
): Promise<ExtractedListingFields> {
  try {
    // Dynamic import — Tesseract.js is large, only load when needed
    const Tesseract = await import("tesseract.js");

    const result = await Tesseract.recognize(imageFile, "eng", {
      logger: (m: { status: string; progress: number }) => {
        if (onProgress && typeof m.progress === "number") {
          const pct = Math.round(m.progress * 100);
          const status = m.status === "recognizing text" ? "Scanning text…"
            : m.status === "loading tesseract core" ? "Loading OCR…"
            : m.status === "initializing tesseract" ? "Initializing…"
            : m.status === "loading language traineddata" ? "Loading language…"
            : m.status === "initializing api" ? "Starting up…"
            : m.status;
          onProgress(pct, status);
        }
      },
    });

    const rawText = result.data.text;
    const lines = rawText.split("\n").filter((l) => l.trim().length > 0);

    const title = extractTitle(lines);
    const platform = detectPlatform(rawText);
    // Infer category from title + full text
    const category = normalizeCategory(`${title ?? ""} ${rawText}`);

    const fields = {
      title,
      price: extractPrice(rawText),
      platform,
      category,
      days_listed: extractDaysListed(rawText),
      views: extractMetric(rawText, ["views", "page views"]),
      watchers: extractMetric(rawText, ["watchers", "watching"]),
    };

    return {
      ...fields,
      confidence: scoreConfidence(fields),
      extractionMethod: "ocr",
    };
  } catch {
    return {
      confidence: "none",
      extractionMethod: "none",
    };
  }
}
