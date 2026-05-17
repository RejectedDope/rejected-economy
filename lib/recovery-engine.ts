import type {
  ScoredItem,
  Platform,
  RecoveryAction,
  RecoveryAnalysis,
  PlatformGuidance,
  PlatformGuidanceStep,
  WarningSignal,
  PricingRisk,
  SaturationLevel,
  SellThroughVelocity,
  MarketplaceHeuristics,
} from "./types";

// ─── Platform Heuristics ──────────────────────────────────────────────────────
// Real behavioral rules derived from how each platform's algorithm works.
// Used to tailor recovery guidance to the platform the item is listed on.

export const PLATFORM_HEURISTICS: Record<Platform, MarketplaceHeuristics> = {
  eBay: {
    platform: "eBay",
    algorithm_type: "Cassini keyword + recency",
    freshness_cliff_days: 90,
    stale_threshold_days: 60,
    sell_similar_resets_freshness: true,
    item_specifics_critical: true,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: true,
    free_shipping_boost: true,
    best_offer_available: true,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: "Tue–Thu 7–9pm local",
    strengths: ["electronics", "collectibles", "vintage", "auto parts", "media"],
    weaknesses: ["fast fashion", "trending streetwear", "luxury authentication"],
  },
  Poshmark: {
    platform: "Poshmark",
    algorithm_type: "Share recency + follower graph",
    freshness_cliff_days: 7,
    stale_threshold_days: 3,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: true,
    price_edit_resets_position: false,
    promoted_listings_available: true,
    free_shipping_boost: false,
    best_offer_available: true,
    price_drop_notification_threshold: 10,
    peak_posting_hours: "8–10am and 7–9pm",
    strengths: ["women's fashion", "luxury handbags", "branded activewear", "shoes"],
    weaknesses: ["electronics", "media", "men's streetwear", "non-apparel"],
  },
  Mercari: {
    platform: "Mercari",
    algorithm_type: "Price competitiveness + recency",
    freshness_cliff_days: 14,
    stale_threshold_days: 7,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: true,
    promoted_listings_available: true,
    free_shipping_boost: true,
    best_offer_available: true,
    price_drop_notification_threshold: 5,
    peak_posting_hours: "evenings and weekends",
    strengths: ["toys", "home goods", "electronics", "casual fashion"],
    weaknesses: ["high-end luxury", "vintage collectibles"],
  },
  Depop: {
    platform: "Depop",
    algorithm_type: "Aesthetic + social graph + hashtags",
    freshness_cliff_days: 14,
    stale_threshold_days: 7,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: true,
    free_shipping_boost: false,
    best_offer_available: true,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: "evenings",
    strengths: ["vintage", "y2k", "streetwear", "aesthetic clothing"],
    weaknesses: ["electronics", "home goods", "non-apparel"],
  },
  "Facebook Marketplace": {
    platform: "Facebook Marketplace",
    algorithm_type: "Local proximity + price",
    freshness_cliff_days: 30,
    stale_threshold_days: 14,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: true,
    promoted_listings_available: true,
    free_shipping_boost: false,
    best_offer_available: false,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: "weekends",
    strengths: ["furniture", "local goods", "large items", "home appliances"],
    weaknesses: ["small collectibles", "fashion", "authentication-required items"],
  },
  StockX: {
    platform: "StockX",
    algorithm_type: "Bid/ask spread + market price",
    freshness_cliff_days: 60,
    stale_threshold_days: 30,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: false,
    free_shipping_boost: false,
    best_offer_available: false,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: undefined,
    strengths: ["sneakers", "streetwear", "trading cards", "watches"],
    weaknesses: ["non-authenticated items", "vintage", "used clothing"],
  },
  GOAT: {
    platform: "GOAT",
    algorithm_type: "Price competitiveness + authentication",
    freshness_cliff_days: 60,
    stale_threshold_days: 30,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: false,
    free_shipping_boost: false,
    best_offer_available: true,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: undefined,
    strengths: ["sneakers", "luxury footwear"],
    weaknesses: ["non-footwear items", "vintage", "mass market shoes"],
  },
  Whatnot: {
    platform: "Whatnot",
    algorithm_type: "Live auction + show schedule",
    freshness_cliff_days: 1,
    stale_threshold_days: 1,
    sell_similar_resets_freshness: true,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: false,
    free_shipping_boost: false,
    best_offer_available: false,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: "prime time streams 7–10pm",
    strengths: ["trading cards", "sports memorabilia", "collectibles", "vintage toys"],
    weaknesses: ["fashion", "electronics", "items without collector communities"],
  },
  Grailed: {
    platform: "Grailed",
    algorithm_type: "Recency + brand relevance + followers",
    freshness_cliff_days: 21,
    stale_threshold_days: 14,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: true,
    free_shipping_boost: false,
    best_offer_available: true,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: "evenings and weekends",
    strengths: ["men's designer", "luxury streetwear", "archive fashion", "high-end menswear"],
    weaknesses: ["women's fashion", "non-apparel", "fast fashion"],
  },
  Other: {
    platform: "Other",
    algorithm_type: "Unknown",
    freshness_cliff_days: 30,
    stale_threshold_days: 14,
    sell_similar_resets_freshness: false,
    item_specifics_critical: false,
    sharing_required: false,
    price_edit_resets_position: false,
    promoted_listings_available: false,
    free_shipping_boost: false,
    best_offer_available: false,
    price_drop_notification_threshold: undefined,
    peak_posting_hours: undefined,
    strengths: [],
    weaknesses: [],
  },
};

// ─── Pricing Risk ─────────────────────────────────────────────────────────────
// A well-optimized listing that still isn't selling usually has a price problem.

export function calcPricingRisk(item: ScoredItem): PricingRisk {
  const { days_listed, listing_health_score, dead_inventory_score } = item;

  // Fully optimized listing that's been sitting 90+ days = price is the issue
  if (listing_health_score >= 70 && days_listed >= 90) return "Critical";

  // Good listing, aging — price is likely holding it back
  if (listing_health_score >= 55 && days_listed >= 60) return "High";

  // Listing has quality issues — fix those first before assuming price is wrong
  if (dead_inventory_score >= 50) return "Medium";

  return "Low";
}

// ─── Competition Saturation ───────────────────────────────────────────────────
// Saturation is proxied from views vs watchers ratio + days with no movement.
// High views + zero watchers = market is flooded, buyers have options.

export function calcSaturation(item: ScoredItem): SaturationLevel {
  const { views, watchers, days_listed } = item;

  // High impressions but no watchers = lots of competition, buyers skipping past
  if (views > 200 && watchers === 0 && days_listed >= 30) return "High";
  if (views > 100 && watchers <= 1 && days_listed >= 45) return "High";

  // Moderate views, low engagement = some competition
  if (views > 50 && watchers <= 2 && days_listed >= 30) return "Medium";
  if (views > 30 && watchers === 0) return "Medium";

  return "Low";
}

// ─── Sell-Through Velocity ───────────────────────────────────────────────────
// How fast does this category/item typically move on this platform?
// Uses watcher accumulation rate as a proxy for demand signal.

export function calcSellThroughVelocity(item: ScoredItem): SellThroughVelocity {
  const { days_listed, watchers, views } = item;

  if (days_listed === 0) return "Fast";

  const watchersPerDay = watchers / days_listed;
  const viewsPerDay = views / days_listed;

  // Strong engagement = fast moving
  if (watchersPerDay >= 0.5 || (watchers >= 5 && days_listed <= 30)) return "Fast";

  // Stalled: been up a while, barely any engagement
  if (days_listed >= 90 && watchers <= 1 && viewsPerDay < 1) return "Stalled";

  // Slow: aging with modest engagement
  if (days_listed >= 60 && watchersPerDay < 0.1) return "Slow";

  return "Normal";
}

// ─── Sell-Through Probability ─────────────────────────────────────────────────
// Probability (0–100) of selling in the next 30 days with no changes.

export function calcSellThroughProbability(item: ScoredItem): number {
  const { dead_inventory_score, days_listed, watchers, views } = item;

  // Base probability inverted from dead score
  let base = 100 - dead_inventory_score;

  // Watcher signal: each watcher meaningfully improves probability
  const watcherBoost = Math.min(25, watchers * 5);
  base += watcherBoost;

  // View decay: high views with no watchers suggests mismatched price/demand
  if (views > 100 && watchers === 0) base -= 15;

  // Severe age penalty
  if (days_listed > 365) base -= 20;
  else if (days_listed > 180) base -= 10;

  return Math.max(2, Math.min(95, Math.round(base)));
}

// ─── Recovery Probability ─────────────────────────────────────────────────────
// Probability (0–100) of selling in next 30 days AFTER taking the primary action.

export function calcRecoveryProbability(
  item: ScoredItem,
  baseProbability: number
): number {
  const action = item.primary_recovery_action;

  const lifts: Record<RecoveryAction, number> = {
    relist_now:          35, // fresh impressions clock — biggest single lift
    sell_similar:        28, // new listing copy, original stays active
    optimize_specifics:  25, // enters filtered search immediately
    title_rewrite:       22, // better keyword coverage = more impressions
    strategic_markdown:  20, // triggers watcher notifications
    add_photos:          15, // improves CTR but slower to show
    move_platform:       20, // new audience, different sell-through pool
    bundle:              10, // bundles have lower individual conversion
    liquidate:           50, // priced to move — nearly guaranteed if priced right
    hold:                 0, // no action = no lift
  };

  return Math.max(5, Math.min(95, Math.round(baseProbability + (lifts[action] ?? 0))));
}

// ─── Warning Signals ─────────────────────────────────────────────────────────
// Generate specific, prioritized warnings for what's wrong with this listing.

export function generateWarningSignals(item: ScoredItem): WarningSignal[] {
  const signals: WarningSignal[] = [];
  const heuristics = PLATFORM_HEURISTICS[item.platform];

  // ── Staleness ────────────────────────────────────────────────────────────
  if (item.days_listed > 365) {
    signals.push({
      code: "YEAR_OLD_LISTING",
      severity: "critical",
      title: "Listing is over a year old",
      body: `This listing has been active for ${item.days_listed} days. eBay's Cassini algorithm has permanently de-indexed it. Watchers have gone cold. This is not fixable through optimization — only a fresh listing or liquidation will move it.`,
      metric: "~0% organic impressions remaining",
    });
  } else if (item.days_listed > heuristics.freshness_cliff_days) {
    signals.push({
      code: "STALE_LISTING",
      severity: item.days_listed > 180 ? "danger" : "warning",
      title: `Past the ${heuristics.platform} freshness cliff`,
      body: `${heuristics.platform} deprioritizes listings after ${heuristics.freshness_cliff_days} days. At ${item.days_listed} days, this listing is ${item.days_listed - heuristics.freshness_cliff_days} days past that threshold. Algorithmic visibility has decayed significantly.`,
      metric: `${heuristics.freshness_cliff_days}d cliff crossed`,
    });
  } else if (item.days_listed > heuristics.stale_threshold_days) {
    signals.push({
      code: "AGING_LISTING",
      severity: "info",
      title: "Listing starting to age",
      body: `${heuristics.platform} starts deprioritizing listings after ${heuristics.freshness_cliff_days} days. You have ${heuristics.freshness_cliff_days - item.days_listed} days before the algorithm cliff. Optimize now rather than waiting.`,
    });
  }

  // ── Missing Item Specifics ────────────────────────────────────────────────
  if (!item.item_specifics_complete && heuristics.item_specifics_critical) {
    signals.push({
      code: "MISSING_SPECIFICS",
      severity: "danger",
      title: "Item specifics incomplete",
      body: "eBay's Cassini algorithm uses item specifics as a primary filter signal. Buyers browsing by category, size, brand, or condition won't see this listing at all. This costs you filtered search traffic — the highest-intent buyers.",
      metric: "invisible in filtered search",
    });
  } else if (!item.item_specifics_complete) {
    signals.push({
      code: "MISSING_SPECIFICS",
      severity: "warning",
      title: "Item specifics incomplete",
      body: "Incomplete item specifics reduce discoverability. Buyers using search filters won't find this listing.",
    });
  }

  // ── Low Photo Count ────────────────────────────────────────────────────────
  if (item.image_count === 1) {
    signals.push({
      code: "SINGLE_PHOTO",
      severity: "danger",
      title: "Only 1 photo",
      body: "Single-photo listings have roughly 40% lower conversion than listings with 4+ photos. Buyers can't see condition, tags, measurements, or flaws — and they won't buy what they can't see.",
      metric: "~40% lower conversion vs 4+ photos",
    });
  } else if (item.image_count <= 3) {
    signals.push({
      code: "LOW_PHOTO_COUNT",
      severity: "warning",
      title: `Only ${item.image_count} photos`,
      body: "Listings with fewer than 4 photos consistently underperform. Add photos of the tag, all angles, any flaws, and measurements to close the gap.",
      metric: "below 4-photo quality floor",
    });
  }

  // ── Weak Title ─────────────────────────────────────────────────────────────
  if (item.title_keyword_strength < 40) {
    signals.push({
      code: "WEAK_TITLE",
      severity: "danger",
      title: "Title has poor keyword coverage",
      body: "The listing title is the primary search index signal. A weak title means buyers searching for this item won't find it. Include: brand, model, size, color, condition, and any relevant style names (e.g. 'Jordan 1 Retro High OG Chicago 2022 DS Size 10').",
      metric: `keyword score: ${item.title_keyword_strength}/100`,
    });
  } else if (item.title_keyword_strength < 60) {
    signals.push({
      code: "MEDIOCRE_TITLE",
      severity: "warning",
      title: "Title keyword coverage is mediocre",
      body: "The title has room for improvement. Add more specific keywords — exact colorway names, model numbers, item codes, or style names — to capture long-tail search queries.",
      metric: `keyword score: ${item.title_keyword_strength}/100`,
    });
  }

  // ── High Views, Zero Sales Signal ─────────────────────────────────────────
  if (item.views > 150 && item.watchers === 0) {
    signals.push({
      code: "VIEWS_NO_ENGAGEMENT",
      severity: "warning",
      title: "High views, zero watchers",
      body: `${item.views} views with no watchers is a strong price signal. Buyers are finding the listing and immediately moving on — almost always because the price is above market. Check completed sales for this item.`,
      metric: `${item.views} views → 0 watchers`,
    });
  } else if (item.views > 75 && item.watchers === 0 && item.days_listed >= 30) {
    signals.push({
      code: "LOW_ENGAGEMENT_RATE",
      severity: "info",
      title: "Low engagement for impression volume",
      body: "The listing is getting views but no watchers. This can indicate a price-to-value mismatch or photos that fail to convert interest into intent.",
    });
  }

  // ── Poshmark: Not Sharing ──────────────────────────────────────────────────
  if (item.platform === "Poshmark" && item.days_listed > heuristics.stale_threshold_days) {
    signals.push({
      code: "POSHMARK_NOT_SHARED",
      severity: "warning",
      title: "Poshmark listing needs active sharing",
      body: "Poshmark's feed is driven by sharing cadence. An unshared listing from 3+ days ago is invisible. Share to followers and Posh Parties 2–3x per day, focusing on peak hours (8–10am, 7–9pm).",
      metric: "sharing = visibility on Poshmark",
    });
  }

  // ── Mercari: Price Edit Opportunity ───────────────────────────────────────
  if (item.platform === "Mercari" && item.days_listed >= 7) {
    signals.push({
      code: "MERCARI_PRICE_RESET",
      severity: "info",
      title: "Price edit resets Mercari listing position",
      body: "On Mercari, any price edit bumps your listing back to the top of search. Even a $1 reduction gives you fresh visibility without relisting. Do this every 7–10 days on slow movers.",
      metric: "price edit = free relist equivalent",
    });
  }

  return signals.sort((a, b) => {
    const order = { critical: 0, danger: 1, warning: 2, info: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ─── Platform Guidance ────────────────────────────────────────────────────────
// Step-by-step tactical instructions for executing the recommended action
// on the specific platform this item is listed on.

export function generatePlatformGuidance(
  item: ScoredItem
): PlatformGuidance {
  const { platform, primary_recovery_action: action } = item;

  return GUIDANCE_MAP[platform]?.[action]?.(item) ?? genericGuidance(item);
}

function genericGuidance(item: ScoredItem): PlatformGuidance {
  return {
    platform: item.platform,
    action: item.primary_recovery_action,
    title: "Take Recovery Action",
    overview: "Execute the recommended action to improve listing visibility.",
    steps: [
      { instruction: "Review current listing performance.", critical: false },
      { instruction: "Execute the recommended action.", critical: true },
      { instruction: "Monitor engagement over the next 7 days.", critical: false },
    ],
    platform_tips: [],
    estimated_time_to_outcome: "7–14 days",
  };
}

// Per-platform, per-action guidance. Keyed as [Platform][RecoveryAction].
type GuidanceFn = (item: ScoredItem) => PlatformGuidance;
type GuidanceMap = Partial<Record<Platform, Partial<Record<RecoveryAction, GuidanceFn>>>>;

const GUIDANCE_MAP: GuidanceMap = {

  // ──────────────────────────────────────────────────────────────────────────
  // eBay
  // ──────────────────────────────────────────────────────────────────────────

  eBay: {
    relist_now: (item) => ({
      platform: "eBay",
      action: "relist_now",
      title: "End Listing & Relist Fresh",
      overview: "eBay's Cassini algorithm buries listings after 90 days. The only way to reset visibility is to end the current listing and create a brand-new one. New listing = fresh impressions clock, new item number, new buyer pool exposure.",
      steps: [
        { instruction: "End the current active listing from your Seller Hub.", critical: true, note: "Do not use 'Relist' — that preserves the old item history. You need a fresh listing." },
        { instruction: "Before relisting, review completed sales for this exact item to confirm your price is competitive.", critical: true },
        { instruction: `Rewrite your title with full keyword coverage: brand + model + colorway + size + condition. Target 80 characters.`, critical: true },
        { instruction: "Add minimum 6 photos: front, back, tag, any flaws, measurements, detail shots.", critical: item.image_count <= 2 },
        { instruction: item.item_specifics_complete ? "Verify all item specifics are filled in on the new listing." : "Fill out ALL item specifics on the new listing — this is why it wasn't selling.", critical: !item.item_specifics_complete },
        { instruction: "Set shipping to Free if item value supports it — eBay boosts free-shipping listings in search.", critical: false },
        { instruction: "Consider 3–5% Promoted Listings to accelerate initial impressions on the fresh listing.", critical: false },
      ],
      platform_tips: [
        "New listings get a freshness boost in the first 7 days — leverage it with a competitive price.",
        "Tuesday–Thursday evenings (7–9pm your buyers' timezone) typically get the best initial impressions.",
        "Use 'Sell Similar' only if you want to preserve item number continuity — it does NOT reset the algorithm clock like a true fresh listing does.",
      ],
      estimated_time_to_outcome: "1–3 weeks",
      timing_tip: "List Tuesday–Thursday evenings for maximum initial impression traffic.",
    }),

    optimize_specifics: (item) => ({
      platform: "eBay",
      action: "optimize_specifics",
      title: "Complete Item Specifics",
      overview: "eBay's Cassini algorithm uses item specifics as primary filter signals. Buyers using category filters, size selectors, or brand dropdowns won't see your listing at all unless every relevant specific is filled. This is the fastest free visibility improvement available.",
      steps: [
        { instruction: "Open the listing in Seller Hub → Edit.", critical: true },
        { instruction: "Scroll to Item Specifics section. Fill every non-optional field.", critical: true, note: "Required fields in orange must be filled. Recommended fields in gray are also indexed — fill them all." },
        { instruction: "For clothing: brand, size (letter + numeric), color, style, material, condition.", critical: true },
        { instruction: "For electronics: brand, model number, storage/specs, compatibility, condition.", critical: true },
        { instruction: "For collectibles: year, manufacturer, character, material, graded status.", critical: true },
        { instruction: "Save changes. eBay re-indexes within 24–48 hours.", critical: false },
      ],
      platform_tips: [
        "Item specifics are the #1 free action to improve filtered search visibility on eBay.",
        "eBay penalizes 'To Be Specified' entries — enter actual values, not placeholders.",
        "Check the category-specific required fields — apparel has different requirements than electronics.",
      ],
      estimated_time_to_outcome: "2–5 days after re-indexing",
    }),

    strategic_markdown: (item) => ({
      platform: "eBay",
      action: "strategic_markdown",
      title: "Strategic Price Reduction",
      overview: "A price reduction on eBay has two effects: (1) it qualifies for the 'Recently Lowered Price' filter that high-intent buyers use, and (2) it sends a notification to watchers. Both bring fresh eyes to a stale listing. Target a 15–25% reduction.",
      steps: [
        { instruction: "Check eBay completed sales for this item to find what it's actually selling for.", critical: true, note: "Go to eBay → Search → Filter: Sold Listings. Match condition, version, and era." },
        { instruction: `Current price: $${item.price.toFixed(2)}. Calculate your 15% floor: $${(item.price * 0.85).toFixed(2)}. Calculate 25% floor: $${(item.price * 0.75).toFixed(2)}.`, critical: true },
        { instruction: "Edit listing → Update price. Drop by at least 15% to qualify for 'Recently Lowered Price' filter placement.", critical: true },
        { instruction: item.watchers > 0 ? `You have ${item.watchers} watcher(s). A 10%+ price drop triggers an immediate notification to them.` : "No watchers currently. The markdown will qualify for the recently-lowered filter and bring fresh traffic.", critical: false },
        { instruction: "If the item has Best Offer enabled, also lower your auto-accept threshold.", critical: false },
      ],
      platform_tips: [
        `Target the 'Recently Lowered Price' filter — buyers actively browsing this filter are ready to buy.`,
        "A 15% cut is the minimum to meaningfully move the needle. Haircuts under 10% rarely generate activity.",
        "If watchers exist, the price drop notification lands in their eBay messages — high-intent audience.",
        "Still not selling after 2 weeks? Drop another 15% or end-and-relist.",
      ],
      estimated_time_to_outcome: "3–10 days",
    }),

    bundle: (item) => ({
      platform: "eBay",
      action: "bundle",
      title: "Create a Bundle Listing",
      overview: `At $${item.price.toFixed(2)}, this item alone barely justifies shipping cost for the buyer. Bundle it with 2–4 similar items to create a listing that hits a meaningful price point, moves multiple SKUs, and clears shelf space.`,
      steps: [
        { instruction: "Identify 2–4 similar items in your inventory that are also slow-moving.", critical: true },
        { instruction: "Create a new listing with all items photographed together (flat lay) and listed individually in description.", critical: true },
        { instruction: "Price the bundle at a slight discount vs buying each item separately — but at a price that makes sense for shipping.", critical: true, note: "Target $25–$75 bundle value depending on category." },
        { instruction: "Title the bundle listing: '[Brand] Lot of [#] / Bundle — [key attributes]'. eBay buyers actively search for lots.", critical: true },
        { instruction: "In item specifics, use 'Lot' for the Type field.", critical: false },
        { instruction: "End the individual listings once the bundle sells.", critical: false },
      ],
      platform_tips: [
        "'Lot' listings on eBay attract buyers who want to resell or collect multiple items.",
        "Bundle photography matters — a clean flat lay on a neutral background signals quality.",
        "Price to move: the goal is cash in hand, not maximum margin on individual items.",
      ],
      estimated_time_to_outcome: "1–3 weeks",
    }),

    liquidate: (item) => ({
      platform: "eBay",
      action: "liquidate",
      title: "Liquidate — Price to Clear",
      overview: `This listing has been active for ${item.days_listed} days. The carrying cost — storage, mental overhead, tied-up capital — now outweighs any margin upside. Liquidate at 20–30 cents on the dollar, or donate for the tax write-off.`,
      steps: [
        { instruction: `Current price: $${item.price.toFixed(2)}. Set a new 'clear it' price of $${(item.price * 0.25).toFixed(2)}–$${(item.price * 0.35).toFixed(2)}.`, critical: true },
        { instruction: "Enable Best Offer with auto-accept at $" + (item.price * 0.20).toFixed(2) + ". Let buyers make you an offer.", critical: true },
        { instruction: "Alternatively, list as a 7-day auction starting at $0.99 to generate competitive bidding.", critical: false },
        { instruction: "If no movement in 14 days at liquidation price: end the listing and consider a local sale, lot auction, or donation.", critical: false },
        { instruction: "Document the loss for your records — unsold inventory at cost basis is a deductible business loss.", critical: false },
      ],
      platform_tips: [
        "A 7-day $0.99 auction forces a market price discovery — you'll find out exactly what the market will pay.",
        "Donation + tax write-off can be worth more than a $5–10 sale when you factor in your time.",
        "Free up the shelf space — that space has carrying cost too.",
      ],
      estimated_time_to_outcome: "7–21 days",
    }),

    move_platform: (item) => ({
      platform: "eBay",
      action: "move_platform",
      title: "Move to a Better Platform",
      overview: "This listing is fully optimized but not moving on eBay. The audience for this item may be concentrated on a different marketplace. Moving platforms or cross-listing costs minimal effort and opens a completely new buyer pool.",
      steps: [
        { instruction: "Identify the best alternative platform for this item category.", critical: true, note: "Sneakers → StockX/GOAT. Streetwear → Grailed/Depop. Women's fashion → Poshmark. Collectibles → Whatnot." },
        { instruction: "Export your eBay listing photos and description.", critical: false },
        { instruction: "Create the new platform listing using the same optimized title and photos.", critical: true },
        { instruction: "Price competitively for the new platform — pricing norms differ significantly.", critical: true },
        { instruction: "Either end the eBay listing or lower the price dramatically to avoid split attention.", critical: false },
      ],
      platform_tips: [
        "Don't maintain identical listings on two platforms unless you can manually update both when one sells.",
        "New platform = fresh algorithm boost. Your first 30 days of listings typically get elevated visibility.",
        "Research sold comps on the target platform before setting price — don't just copy your eBay price.",
      ],
      estimated_time_to_outcome: "1–4 weeks on new platform",
    }),

    add_photos: (item) => ({
      platform: "eBay",
      action: "add_photos",
      title: "Add Photos",
      overview: `With ${item.image_count} photo${item.image_count === 1 ? "" : "s"}, this listing is below the quality floor. eBay allows up to 24 photos for free. More photos increase buyer confidence and reduce questions — both of which directly improve conversion.`,
      steps: [
        { instruction: "Edit the listing and add photos from multiple angles.", critical: true },
        { instruction: "Required shots: front, back, tag/label (showing brand and size), inside, all flaws.", critical: true },
        { instruction: "For apparel: add a measurements flat lay. For electronics: show all ports/buttons. For collectibles: show all markings.", critical: true },
        { instruction: "Use natural light. No flash. Neutral background. Photos should look like a human took them thoughtfully.", critical: false },
        { instruction: "Aim for 8–12 photos minimum.", critical: false },
      ],
      platform_tips: [
        "The first photo is your clickthrough rate — make it clean, well-lit, and representative.",
        "eBay's search results show the first photo as a thumbnail. Square crops work best.",
        "Flaw photos build trust. A buyer who knows about the flaw before buying won't leave negative feedback.",
      ],
      estimated_time_to_outcome: "3–10 days post-update",
    }),

    sell_similar: (item) => ({
      platform: "eBay",
      action: "sell_similar",
      title: "Use Sell Similar — Fresh Impressions, Zero Effort",
      overview: "eBay's 'Sell Similar' creates a new active listing using your existing one as a template. The original stays live. The new listing gets a fresh impressions clock and surfaces in 'newest first' search. This is the lowest-effort freshness reset available — no data loss, no relist hassle.",
      steps: [
        { instruction: "Go to the listing in Seller Hub → More Actions → Sell Similar.", critical: true },
        { instruction: "Review pre-filled details — title, price, photos, and specifics are copied from the original.", critical: false },
        { instruction: "Adjust the price if needed. This is a good opportunity to test a slightly lower price point.", critical: true, note: "A 5–10% reduction on the fresh listing often gets it sold before the original." },
        { instruction: "Improve the title if it has room — add any missing keywords before submitting.", critical: false },
        { instruction: "Submit. The new listing goes live fresh. Monitor for 14 days.", critical: false },
        { instruction: "When one sells, end the other immediately to avoid double-selling.", critical: true },
      ],
      platform_tips: [
        "Sell Similar gives you a new item number and new impressions history — it is not the same as Revise or Relist.",
        "The fresh listing gets eBay's early-listing visibility boost in the first 7 days. Price it right from the start.",
        "If the fresh listing gets watchers but doesn't sell after 14 days, drop the price 10% and let the watcher notification do the work.",
      ],
      estimated_time_to_outcome: "7–21 days",
      timing_tip: "List the fresh copy Tuesday–Thursday evenings for peak initial traffic.",
    }),

    title_rewrite: (item) => ({
      platform: "eBay",
      action: "title_rewrite",
      title: "Rewrite Your Listing Title",
      overview: `Your title scores ${item.title_keyword_strength}/100 for keyword coverage. eBay's Cassini search is keyword-first — your title is the primary index signal. Every unused character is a missed search impression. A complete rewrite with brand + model + colorway + condition + SKU codes can double organic impressions overnight.`,
      steps: [
        { instruction: "Search eBay for this exact item. Filter to Sold Listings. Study what the highest-priced sold listings used in their titles.", critical: true, note: "You want keywords that buyers actually searched, not keywords you think they search." },
        { instruction: "Open your listing → Revise Item → update the title field.", critical: true },
        { instruction: "Use all 80 characters. Structure: [Brand] + [Model/Style Name] + [Year/Season] + [Colorway] + [Size] + [Condition] + [SKU if applicable].", critical: true },
        { instruction: "Include the exact model number or SKU if known (e.g. 'CV1724-100' not just 'Air Force 1').", critical: false, note: "Buyers searching by SKU are the most specific, highest-intent audience." },
        { instruction: "Remove filler words: 'MUST SEE', 'BEAUTIFUL', 'RARE!!', 'HOT'. Every word must be a search term.", critical: false },
        { instruction: "Save. eBay re-indexes within 24 hours. Monitor impressions over the next 48 hours.", critical: false },
      ],
      platform_tips: [
        "eBay Cassini indexes every word individually. 'Nike Air Jordan 1 Retro High OG' surfaces for 6 different search queries. 'Nike Shoes Nice Condition' surfaces for 3.",
        "Parentheses and punctuation don't help — plain keywords in order of specificity do.",
        "The title rewrite is free and takes 10 minutes. It's the highest ROI action per minute invested.",
      ],
      estimated_time_to_outcome: "2–5 days after re-indexing",
    }),

    hold: () => ({
      platform: "eBay",
      action: "hold",
      title: "Hold — Monitor for 30 Days",
      overview: "This listing is performing within the normal sell-through window. Making changes now risks disrupting momentum. Monitor for another 30 days before taking action.",
      steps: [
        { instruction: "Check back in 30 days. If still unsold, run another analysis.", critical: false },
        { instruction: "Watch the watcher count — if it grows, the listing is working.", critical: false },
      ],
      platform_tips: [
        "Fresh listings get a 7-day boost window. Let it run its course before optimizing.",
      ],
      estimated_time_to_outcome: "30–60 days",
    }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Poshmark
  // ──────────────────────────────────────────────────────────────────────────

  Poshmark: {
    strategic_markdown: (item) => ({
      platform: "Poshmark",
      action: "strategic_markdown",
      title: "Drop Price — Trigger Offer Notifications",
      overview: "On Poshmark, a price drop of 10% or more sends an automatic push notification to everyone who has liked your listing. This is the highest-conversion action available — you're targeting buyers who already showed interest.",
      steps: [
        { instruction: `Current price: $${item.price.toFixed(2)}. Calculate 10% floor: $${(item.price * 0.90).toFixed(2)}.`, critical: true },
        { instruction: "Go to listing → 'Edit' → reduce price by at least 10%.", critical: true },
        { instruction: "Poshmark automatically notifies all likers via push notification.", critical: true, note: "This is free buyer re-engagement. Every liker gets a ping." },
        { instruction: "Share the listing immediately after the price drop for double visibility.", critical: false },
        { instruction: "If no sales in 48 hours, send offers to all likers (Offer to Likers feature).", critical: false },
      ],
      platform_tips: [
        "The 10% threshold triggers the notification — anything less is invisible to likers.",
        "Offer to Likers (OTL) after a price drop doubles your shot at converting interested buyers.",
        "Time your price drops for evenings when buyers are active on the app.",
      ],
      estimated_time_to_outcome: "24–72 hours",
    }),

    relist_now: (item) => ({
      platform: "Poshmark",
      action: "relist_now",
      title: "Relist for Feed Visibility",
      overview: "Poshmark's feed is driven by recency. An old listing has scrolled out of every follower's feed. Relisting (delete + create new) gets you back to the top of search and into the 'Just In' feed section.",
      steps: [
        { instruction: "Screenshot all existing photos and note the price and description.", critical: true },
        { instruction: "Delete the current listing.", critical: true },
        { instruction: "Create a brand new listing with the same photos and description.", critical: true },
        { instruction: "Share to your followers and at least 2 relevant Posh Parties immediately.", critical: true },
        { instruction: "Set up a sharing routine: 3x daily (morning, afternoon, evening).", critical: false },
      ],
      platform_tips: [
        "On Poshmark, sharing is the algorithm. Without daily shares, listings go invisible within 48 hours.",
        "Share to Posh Parties for category-specific exposure — apparel parties drive significant traffic.",
        "A fresh listing + aggressive sharing in the first 24 hours determines its lifetime performance.",
      ],
      estimated_time_to_outcome: "3–14 days",
    }),

    add_photos: (item) => ({
      platform: "Poshmark",
      action: "add_photos",
      title: "Upgrade Listing Photos",
      overview: "Poshmark is an aesthetic-first platform. Buyers scroll fast and make split-second decisions based on photos. Clean, well-styled photos dramatically improve conversion.",
      steps: [
        { instruction: "Reshoot the item with natural lighting on a clean background.", critical: true },
        { instruction: "For apparel: shoot flat lay + styled on a hanger. Include brand tag and interior label.", critical: true },
        { instruction: "Add a detail shot showing any flaws — buyers appreciate transparency.", critical: true },
        { instruction: "Update the listing with the new photos. Relist if the listing is old.", critical: false },
      ],
      platform_tips: [
        "Flat lays on a white or neutral background are the Poshmark standard — deviate at your own risk.",
        "The cover photo thumbnail is everything. It's what buyers see on search.",
        "Natural window light beats any ring light setup for clothing photography.",
      ],
      estimated_time_to_outcome: "3–10 days",
    }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Mercari
  // ──────────────────────────────────────────────────────────────────────────

  Mercari: {
    strategic_markdown: (item) => ({
      platform: "Mercari",
      action: "strategic_markdown",
      title: "Price Edit — Reset Search Position",
      overview: "On Mercari, any price edit moves your listing back toward the top of search results. This is a free visibility reset. Even a $1 reduction counts. For a meaningful conversion lift, target a 10–15% reduction.",
      steps: [
        { instruction: "Go to listing → Edit Price.", critical: true },
        { instruction: `For visibility reset only: drop by $1–$2. Current: $${item.price.toFixed(2)} → Target: $${(item.price - 1).toFixed(2)}.`, critical: false },
        { instruction: `For serious conversion lift: drop 10–15%. Target: $${(item.price * 0.875).toFixed(2)}.`, critical: true },
        { instruction: "Mercari sends a notification to buyers who have liked the item when price drops 5%+.", critical: false },
        { instruction: "Repeat every 7–10 days on slow movers. Each edit resets position.", critical: false },
      ],
      platform_tips: [
        "This is Mercari's single best free feature — use it aggressively on anything sitting 7+ days.",
        "A $1 drop every week keeps you in recency-sorted search without sacrificing margin.",
        "5%+ drops trigger like-notification. Combine reset + notification for maximum impact.",
      ],
      estimated_time_to_outcome: "2–7 days",
    }),

    relist_now: (item) => ({
      platform: "Mercari",
      action: "relist_now",
      title: "Relist for Fresh Visibility",
      overview: "Mercari's search defaults to newest first. An old listing is buried pages deep. Delete and relist to get back to position 1 in your category.",
      steps: [
        { instruction: "Save photos and listing details before deleting.", critical: true },
        { instruction: "Delete the current listing.", critical: true },
        { instruction: "Create a new listing. New listings get featured placement in the first 24 hours.", critical: true },
        { instruction: "Reprice competitively — check recent sold prices before relisting.", critical: true },
        { instruction: "Enable smart pricing or set a floor — Mercari's smart pricing can optimize automatically.", critical: false },
      ],
      platform_tips: [
        "New listings on Mercari get a 24-hour featured boost in category search.",
        "Mercari's buyer base skews casual — price slightly below eBay to account for the less deal-savvy audience.",
        "Free shipping on Mercari (where it makes sense) is a significant conversion boost.",
      ],
      estimated_time_to_outcome: "3–14 days",
    }),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Depop
  // ──────────────────────────────────────────────────────────────────────────

  Depop: {
    relist_now: (item) => ({
      platform: "Depop",
      action: "relist_now",
      title: "Refresh Listing for Explore Feed",
      overview: "Depop's Explore and search feeds favor recency. Listings older than 2 weeks have minimal organic visibility. Delete and relist to get back into the explore feed and follower timelines.",
      steps: [
        { instruction: "Save all photos before deleting.", critical: true },
        { instruction: "Delete the listing.", critical: true },
        { instruction: "Create a new listing with the same photos but a refreshed description with relevant hashtags.", critical: true },
        { instruction: "Use 3–5 hashtags that match the item's aesthetic (e.g. #vintage #y2k #streetwear).", critical: true },
        { instruction: "Post during peak hours (evenings) for maximum follower feed visibility.", critical: false },
      ],
      platform_tips: [
        "Depop is aesthetic-first — the cover photo and brand presentation matter more than on other platforms.",
        "Hashtags on Depop drive significant organic discovery — don't skip them.",
        "Engage with followers and similar sellers to boost your shop's visibility in the algorithm.",
      ],
      estimated_time_to_outcome: "3–14 days",
    }),

    add_photos: (item) => ({
      platform: "Depop",
      action: "add_photos",
      title: "Improve Photography",
      overview: "Depop buyers are heavily influenced by aesthetic. Clean, styled, on-model or flat-lay photos are the norm. Low-quality photos are a conversion killer on this platform specifically.",
      steps: [
        { instruction: "Reshoot with natural light. Aesthetic-first: styled, clean background, consistent with your shop's vibe.", critical: true },
        { instruction: "Consider on-model photography if possible — Depop buyers respond strongly to styled shots.", critical: false },
        { instruction: "Add detail shots: tag, any flaws, material texture.", critical: true },
        { instruction: "Update listing photos. Consider relisting for fresh feed placement.", critical: false },
      ],
      platform_tips: [
        "Depop's core buyer demographic responds to a cohesive shop aesthetic — consistent photo style builds trust.",
        "Styled photos outperform flat lays on Depop vs other platforms.",
        "Video clips (short clips of the item) can significantly boost engagement on Depop.",
      ],
      estimated_time_to_outcome: "5–14 days",
    }),
  },
};

// ─── Full Item Analysis ───────────────────────────────────────────────────────

export function analyzeItem(item: ScoredItem): RecoveryAnalysis {
  const sell_through_probability = calcSellThroughProbability(item);
  const recovery_probability = calcRecoveryProbability(item, sell_through_probability);
  const pricing_risk = calcPricingRisk(item);
  const competition_saturation = calcSaturation(item);
  const sell_through_velocity = calcSellThroughVelocity(item);
  const warning_signals = generateWarningSignals(item);
  const platform_guidance = generatePlatformGuidance(item);

  // Secondary actions: list additional useful actions beyond the primary
  const secondaryActions = buildSecondaryActions(item);

  const estimatedDaysToSale = estimateDaysToSale(item);

  return {
    item_id: item.id,
    analyzed_at: new Date().toISOString(),
    dead_risk_score: item.dead_inventory_score,
    listing_health_score: item.listing_health_score,
    visibility_risk: item.visibility_risk,
    pricing_risk,
    competition_saturation,
    sell_through_velocity,
    sell_through_probability,
    recovery_probability,
    primary_action: item.primary_recovery_action,
    secondary_actions: secondaryActions,
    platform_guidance,
    warning_signals,
    estimated_recovery: item.estimated_recovery,
    estimated_days_to_sale: estimatedDaysToSale,
  };
}

function buildSecondaryActions(item: ScoredItem): RecoveryAction[] {
  const primary = item.primary_recovery_action;
  const secondaries: RecoveryAction[] = [];

  if (item.title_keyword_strength < 60 && primary !== "title_rewrite") {
    secondaries.push("title_rewrite");
  }
  if (!item.item_specifics_complete && primary !== "optimize_specifics") {
    secondaries.push("optimize_specifics");
  }
  if (item.image_count <= 3 && primary !== "add_photos") {
    secondaries.push("add_photos");
  }
  if (item.days_listed >= 60 && primary !== "strategic_markdown" && primary !== "sell_similar") {
    secondaries.push("strategic_markdown");
  }
  if (
    item.listing_health_score >= 65 &&
    item.days_listed >= 90 &&
    primary !== "move_platform"
  ) {
    secondaries.push("move_platform");
  }

  return secondaries.slice(0, 3);
}

function estimateDaysToSale(item: ScoredItem): number {
  const action = item.primary_recovery_action;

  const baseEstimates: Record<RecoveryAction, number> = {
    relist_now:          14,
    sell_similar:        18,
    title_rewrite:       5,
    optimize_specifics:  5,
    strategic_markdown:  7,
    add_photos:          10,
    move_platform:       21,
    bundle:              14,
    liquidate:           7,
    hold:                30,
  };

  let estimate = baseEstimates[action] ?? 21;

  // Watchers reduce time-to-sale (warm audience exists)
  if (item.watchers >= 3) estimate = Math.round(estimate * 0.7);
  else if (item.watchers >= 1) estimate = Math.round(estimate * 0.85);

  return Math.max(1, estimate);
}

export function analyzeAll(items: ScoredItem[]): RecoveryAnalysis[] {
  return items.map(analyzeItem);
}
