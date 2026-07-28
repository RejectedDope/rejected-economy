import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ResearchRequest = z.object({
  query: z.string().min(2).max(300),
  categoryId: z.string().optional(),
  condition: z.string().optional(),
  marketplaceId: z.string().default("EBAY_US"),
  limit: z.number().int().min(1).max(50).default(20),
});

type EbayToken = { access_token: string; expires_in: number };
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayApplicationToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`eBay OAuth failed: ${response.status}`);
  }

  const data = (await response.json()) as EbayToken;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

function parseMoney(value?: string) {
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizePrices(prices: number[]) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };

  return {
    count: sorted.length,
    min: sorted[0],
    p25: Number(percentile(0.25).toFixed(2)),
    median: Number(percentile(0.5).toFixed(2)),
    p75: Number(percentile(0.75).toFixed(2)),
    max: sorted.at(-1),
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = ResearchRequest.parse(await request.json());
    const token = await getEbayApplicationToken();

    const params = new URLSearchParams({
      q: input.query,
      limit: String(input.limit),
    });
    if (input.categoryId) params.set("category_ids", input.categoryId);

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": input.marketplaceId,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: "eBay research request failed", status: response.status, detail },
        { status: 502 },
      );
    }

    const data = await response.json();
    const activeComps = (data.itemSummaries ?? []).map((item: any) => ({
      itemId: item.itemId,
      title: item.title,
      price: parseMoney(item.price?.value),
      currency: item.price?.currency ?? null,
      condition: item.condition ?? null,
      categoryId: item.categories?.[0]?.categoryId ?? null,
      categoryName: item.categories?.[0]?.categoryName ?? null,
      imageUrl: item.image?.imageUrl ?? null,
      itemWebUrl: item.itemWebUrl ?? null,
      seller: item.seller?.username ?? null,
      buyingOptions: item.buyingOptions ?? [],
      itemLocation: item.itemLocation ?? null,
    }));

    const prices = activeComps
      .map((item: { price: number | null }) => item.price)
      .filter((price: number | null): price is number => price !== null);

    return NextResponse.json({
      query: input.query,
      marketplaceId: input.marketplaceId,
      researchedAt: new Date().toISOString(),
      evidence: {
        activeSupply: {
          source: "eBay Browse API",
          countReturned: activeComps.length,
          totalMatching: data.total ?? null,
          priceDistribution: summarizePrices(prices),
          items: activeComps,
        },
        soldEvidence: {
          available: false,
          items: [],
          note: "The eBay Browse API returns active purchasable listings, not completed sold comparables. Do not represent these prices as sold data.",
        },
      },
      interpretationRules: [
        "Active asking prices measure supply and seller expectations, not realized market value.",
        "Do not calculate sell-through without reliable sold and active counts from comparable time windows.",
        "Use exact or near-exact sold evidence from a separately connected legitimate source when available.",
      ],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown research error" },
      { status: 500 },
    );
  }
}
