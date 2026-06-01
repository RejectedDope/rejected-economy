// ─── eBay API Client ──────────────────────────────────────────────────────────
// Fetches seller inventory and offers from the eBay Inventory and Offer APIs.
// Handles token refresh, pagination (max 10 pages), and merges listings by SKU.

import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EbayInventoryItem = {
  sku: string;
  product?: { title: string; description?: string; imageUrls?: string[] };
  condition?: string;
  availability?: { shipToLocationAvailability?: { quantity: number } };
};

export type EbayOffer = {
  offerId: string;
  sku: string;
  listingId?: string;
  status: string; // PUBLISHED, UNPUBLISHED, ENDED
  pricingSummary?: { price: { value: string; currency: string } };
};

export type SyncedListing = {
  sku: string;
  listingId: string | null;
  title: string;
  price: number | null;
  condition: string;
  quantity: number;
  isActive: boolean;
};

export type EbayTokenRefreshResult = {
  accessToken: string;
  expiresAt: string;
} | null;

// ─── Condition mapping ────────────────────────────────────────────────────────

const CONDITION_MAP: Record<string, string> = {
  NEW:                      "New",
  LIKE_NEW:                 "Like New",
  NEW_OTHER:                "New (Other)",
  NEW_WITH_DEFECTS:         "New with Defects",
  CERTIFIED_REFURBISHED:    "Certified Refurbished",
  EXCELLENT_REFURBISHED:    "Excellent Refurbished",
  VERY_GOOD_REFURBISHED:    "Very Good Refurbished",
  GOOD_REFURBISHED:         "Good Refurbished",
  USED_EXCELLENT:           "Used - Excellent",
  USED_VERY_GOOD:           "Used - Very Good",
  USED_GOOD:                "Used - Good",
  USED_ACCEPTABLE:          "Used - Acceptable",
  FOR_PARTS_OR_NOT_WORKING: "For Parts or Not Working",
};

function mapCondition(raw: string | undefined): string {
  if (!raw) return "Unknown";
  return CONDITION_MAP[raw.toUpperCase()] ?? raw;
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshEbayToken(
  userId: string,
  currentRefreshToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<EbayTokenRefreshResult> {
  const clientId     = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn("runtime", "eBay token refresh skipped — credentials not configured", { userId });
    return null;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: currentRefreshToken,
      }).toString(),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn("runtime", "eBay token refresh failed — non-OK response", {
        userId,
        status: res.status,
        body,
      });
      return null;
    }

    const json = await res.json() as {
      access_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

    // Persist the refreshed token back to marketplace_connections
    const { error: updateErr } = await supabase
      .from("marketplace_connections")
      .update({
        access_token:     json.access_token,
        token_expires_at: expiresAt,
        status:           "connected",
        updated_at:       new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("platform", "ebay");

    if (updateErr) {
      logger.warn("runtime", "Failed to persist refreshed eBay token", {
        userId,
        error: updateErr.message,
      });
    }

    return { accessToken: json.access_token, expiresAt };
  } catch (err) {
    logger.warn("runtime", "eBay token refresh threw unexpectedly", {
      userId,
      error: String(err),
    });
    return null;
  }
}

// ─── Fetch Inventory Items ────────────────────────────────────────────────────

export async function fetchEbayInventoryItems(accessToken: string): Promise<EbayInventoryItem[]> {
  const items: EbayInventoryItem[] = [];
  const limit = 200;
  let offset  = 0;
  let page    = 0;
  const maxPages = 10;

  try {
    while (page < maxPages) {
      const url = `https://api.ebay.com/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`;

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type":  "application/json",
        },
      });

      if (!res.ok) {
        logger.warn("runtime", "eBay fetchInventoryItems non-OK response", { status: res.status, offset });
        break;
      }

      const json = await res.json() as {
        inventoryItems?: EbayInventoryItem[];
        next?: string;
        total?: number;
      };

      const batch = json.inventoryItems ?? [];
      items.push(...batch);

      // Stop if there is no next page or we got fewer items than the limit
      if (!json.next || batch.length < limit) break;

      offset += limit;
      page++;
    }
  } catch (err) {
    logger.warn("runtime", "fetchEbayInventoryItems threw unexpectedly", { error: String(err) });
  }

  return items;
}

// ─── Fetch Offers ─────────────────────────────────────────────────────────────

export async function fetchEbayOffers(accessToken: string): Promise<EbayOffer[]> {
  const offers: EbayOffer[] = [];
  const limit = 200;
  let offset  = 0;
  let page    = 0;
  const maxPages = 10;

  try {
    while (page < maxPages) {
      const url = `https://api.ebay.com/sell/inventory/v1/offer?limit=${limit}&offset=${offset}`;

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type":  "application/json",
        },
      });

      if (!res.ok) {
        logger.warn("runtime", "eBay fetchOffers non-OK response", { status: res.status, offset });
        break;
      }

      const json = await res.json() as {
        offers?: EbayOffer[];
        next?: string;
        total?: number;
      };

      const batch = json.offers ?? [];
      offers.push(...batch);

      if (!json.next || batch.length < limit) break;

      offset += limit;
      page++;
    }
  } catch (err) {
    logger.warn("runtime", "fetchEbayOffers threw unexpectedly", { error: String(err) });
  }

  return offers;
}

// ─── Fetch & Merge Listings ───────────────────────────────────────────────────

export async function fetchEbayListings(accessToken: string): Promise<SyncedListing[]> {
  const [inventoryItems, offers] = await Promise.all([
    fetchEbayInventoryItems(accessToken),
    fetchEbayOffers(accessToken),
  ]);

  // Build offer map keyed by SKU for fast lookup
  const offerBySku = new Map<string, EbayOffer>();
  for (const offer of offers) {
    // Prefer PUBLISHED offers; only overwrite if we haven't stored a published one yet
    const existing = offerBySku.get(offer.sku);
    if (!existing || offer.status === "PUBLISHED") {
      offerBySku.set(offer.sku, offer);
    }
  }

  const listings: SyncedListing[] = [];

  for (const item of inventoryItems) {
    // Only include items with a title
    const title = item.product?.title;
    if (!title) continue;

    const offer     = offerBySku.get(item.sku);
    const listingId = offer?.listingId ?? null;
    const isActive  = offer?.status === "PUBLISHED";

    const priceRaw = offer?.pricingSummary?.price?.value;
    const price    = priceRaw != null ? parseFloat(priceRaw) : null;

    const quantity = item.availability?.shipToLocationAvailability?.quantity ?? 0;

    listings.push({
      sku:       item.sku,
      listingId,
      title,
      price:     price !== null && !isNaN(price) ? price : null,
      condition: mapCondition(item.condition),
      quantity,
      isActive,
    });
  }

  return listings;
}
