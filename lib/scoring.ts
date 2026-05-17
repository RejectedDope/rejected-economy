import type {
  InventoryItem,
  ScoredItem,
  VisibilityRisk,
  RecoveryAction,
  RecoveryActionDetail,
  DashboardStats,
  AgingBucket,
  PlatformBucket,
  PricingPosition,
  PricingAnalysis,
} from "./types";

// ─── Scoring Specification ────────────────────────────────────────────────────
//
// DEAD INVENTORY SCORE (0–100, higher = more dead)
//
//   Factor                    Max pts  Weight
//   ─────────────────────────────────────────
//   days_listed               35 pts   35%   — freshness cliff at 90d, dead zone 180d+
//   pricing_competitiveness   20 pts   20%   — price rejection signals from engagement
//   visibility_signals        15 pts   15%   — watcher deficit, view velocity, promotion
//   title_strength            10 pts   10%   — primary search index signal
//   item_specifics            10 pts   10%   — Cassini filter penalty if missing
//   photo_coverage             5 pts    5%   — low photos = low CTR and buyer trust
//   shipping_competitiveness   5 pts    5%   — high shipping kills low-value conversions
//   ─────────────────────────────────────────
//   Total                    100 pts  100%
//
// LISTING HEALTH SCORE (0–100, higher = healthier)
// Positive framing — specifics, photos, title, freshness.
//
// VISIBILITY RISK (Low / Medium / High / Critical)
//   Low:      0–29  — within normal sell-through window
//   Medium:  30–49  — showing age or quality gaps, optimize now
//   High:    50–74  — clear problems, action needed this week
//   Critical: 75+   — multiple stacked problems, immediate recovery required
//
// ─────────────────────────────────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  days_listed:            { max: 35, label: "Listing Age",             note: "Freshness cliff at 90d · dead zone at 180d+" },
  pricing_competitiveness:{ max: 20, label: "Pricing Competitiveness", note: "Views without watchers = price rejection signal" },
  visibility_signals:     { max: 15, label: "Visibility Signals",      note: "Watcher deficit, view velocity, promotion gap" },
  title_strength:         { max: 10, label: "Title Keyword Strength",  note: "Primary search index — 80 chars of real keywords" },
  item_specifics:         { max: 10, label: "Item Specifics",          note: "Missing = invisible in filtered search (Cassini)" },
  photo_coverage:         { max: 5,  label: "Photo Coverage",          note: "1 photo = ~40% lower conversion than 4+" },
  shipping_competitiveness:{ max: 5, label: "Shipping",                note: "High shipping cost kills low-value conversions" },
} as const;

// ─── Dead Inventory Score ─────────────────────────────────────────────────────

export function calcDeadScore(item: InventoryItem): number {
  let score = 0;

  // ── days_listed: 35 pts max ──────────────────────────────────────────────
  // The freshness cliff is real — eBay's Cassini buries 90d+ listings.
  // But age alone doesn't make a listing dead. Multiple signals must stack.
  if (item.days_listed <= 14)       score += 0;
  else if (item.days_listed <= 30)  score += 6;
  else if (item.days_listed <= 60)  score += 14;
  else if (item.days_listed <= 90)  score += 22;
  else if (item.days_listed <= 180) score += 28;
  else                              score += 35; // 181d+ = buried, no freshness left

  // ── pricing_competitiveness: 20 pts max ─────────────────────────────────
  // Price rejection: high views + zero watchers = buyers are seeing it and walking.
  // That's a price signal, not a quality signal. The market has spoken.
  let pricingPts = 0;
  if (item.views >= 100 && item.watchers === 0)                              pricingPts += 12; // hard rejection
  else if (item.views >= 60  && item.watchers <= 1 && item.days_listed >= 30) pricingPts += 8;
  else if (item.views >= 25  && item.watchers === 0 && item.days_listed >= 45) pricingPts += 5;
  // Stale pricing: no markdown despite significant age
  if (item.days_listed >= 90 && (!item.original_price || item.price >= item.original_price * 0.97))
    pricingPts += 8;
  else if (item.days_listed >= 60 && (!item.original_price || item.price >= item.original_price * 0.97))
    pricingPts += 5;
  score += Math.min(20, pricingPts);

  // ── visibility_signals: 15 pts max ──────────────────────────────────────
  // Watcher deficit and view velocity measure how much algorithmic placement remains.
  let visPts = 0;
  if (item.watchers === 0 && item.days_listed >= 60)       visPts += 7; // dead in the water
  else if (item.watchers === 0 && item.days_listed >= 30)  visPts += 4;
  else if (item.watchers <= 1 && item.days_listed >= 90)   visPts += 3;
  const viewsPerDay = item.days_listed > 0 ? item.views / item.days_listed : item.views;
  if (viewsPerDay < 0.5 && item.days_listed >= 30)         visPts += 5; // nearly no traffic
  else if (viewsPerDay < 1.0 && item.days_listed >= 60)    visPts += 3;
  if (!item.has_promoted_listing && item.days_listed >= 90 && item.watchers <= 1) visPts += 3;
  score += Math.min(15, visPts);

  // ── title_keyword_strength: 10 pts max ──────────────────────────────────
  if (item.title_keyword_strength < 40)      score += 10;
  else if (item.title_keyword_strength < 60) score += 6;
  else if (item.title_keyword_strength < 75) score += 2;

  // ── item_specifics: 10 pts max ──────────────────────────────────────────
  if (!item.item_specifics_complete) score += 10;

  // ── photo_coverage: 5 pts max ───────────────────────────────────────────
  if (item.image_count === 1)     score += 5;
  else if (item.image_count <= 3) score += 3;
  else if (item.image_count <= 5) score += 1;

  // ── shipping_competitiveness: 5 pts max ─────────────────────────────────
  if (item.shipping_cost && item.shipping_cost > item.price * 0.25)       score += 5;
  else if (item.shipping_cost && item.shipping_cost > item.price * 0.15)  score += 3;
  else if (item.shipping_type !== "free" && item.price < 40)               score += 2;

  return Math.min(100, Math.round(score));
}

// ─── Listing Health Score ─────────────────────────────────────────────────────

export function calcHealthScore(item: InventoryItem): number {
  let score = 0;

  // Item specifics complete: 20 pts
  if (item.item_specifics_complete) score += 20;

  // Photo count: 20 pts
  if (item.image_count >= 8)      score += 20;
  else if (item.image_count >= 4) score += 15;
  else if (item.image_count >= 2) score += 8;

  // Title keyword strength: 30 pts (linear)
  score += Math.round((item.title_keyword_strength / 100) * 30);

  // Freshness: 30 pts — inverse decay curve
  if (item.days_listed <= 14)       score += 30;
  else if (item.days_listed <= 30)  score += 25;
  else if (item.days_listed <= 60)  score += 18;
  else if (item.days_listed <= 90)  score += 10;
  else if (item.days_listed <= 180) score += 4;
  // 180d+: 0 freshness points

  return Math.min(100, Math.round(score));
}

// ─── Visibility Risk ──────────────────────────────────────────────────────────

export function calcVisibilityRisk(item: InventoryItem): VisibilityRisk {
  const dead = calcDeadScore(item);
  if (dead >= 75) return "Critical";
  if (dead >= 50) return "High";
  if (dead >= 30) return "Medium";
  return "Low";
}

// ─── Pricing Position ─────────────────────────────────────────────────────────
// Classifies whether the listed price is the problem, based on engagement signals.
// No real market data needed — derived purely from views/watchers behavior.

export function calcPricingPosition(item: InventoryItem): PricingAnalysis {
  const signals: string[] = [];
  let overpricedScore = 0;
  let underpricedScore = 0;

  // Liquidation: year+ with views but no traction — market has permanently rejected this price
  if (item.days_listed > 365 && item.views > 30) {
    return {
      position: "liquidation_candidate",
      label: "Liquidation Candidate",
      confidence: "high",
      signals: [
        `${item.days_listed} days listed — buyers have repeatedly passed on this price`,
        "Carrying cost now exceeds realistic upside. Price to clear or donate.",
      ],
      suggested_markdown_pct: 0.70,
    };
  }

  // Price rejection: high views with zero or near-zero watcher conversion
  if (item.views >= 100 && item.watchers === 0) {
    overpricedScore += 3;
    signals.push(`${item.views} views, 0 watchers — buyers see it, none commit. Classic price rejection.`);
  } else if (item.views >= 60 && item.watchers <= 1 && item.days_listed >= 30) {
    overpricedScore += 2;
    signals.push(`${item.views} views, ${item.watchers} watcher — low conversion rate for this volume`);
  } else if (item.views >= 25 && item.watchers === 0 && item.days_listed >= 45) {
    overpricedScore += 1;
    signals.push("Views accumulating without watchers — consider a price test");
  }

  // No markdown despite significant age — price has not adjusted to market
  if (item.days_listed >= 90 && (!item.original_price || item.price >= item.original_price * 0.97)) {
    overpricedScore += 2;
    signals.push("No price reduction after 90+ days — market price may have moved below this listing");
  } else if (item.days_listed >= 60 && (!item.original_price || item.price >= item.original_price * 0.97)) {
    overpricedScore += 1;
    signals.push("No markdown after 60+ days — worth testing a 10–15% reduction");
  }

  // Underpriced signals: strong watcher-to-view conversion
  if (item.watchers >= 3 && item.views > 0) {
    const rate = item.watchers / Math.max(item.views, 1);
    if (rate >= 0.15) {
      underpricedScore += 3;
      signals.push(`${Math.round(rate * 100)}% watcher rate — strong buyer intent, could price higher`);
    } else if (rate >= 0.08) {
      underpricedScore += 1;
      signals.push("Solid watcher-to-view ratio — price is resonating with buyers");
    }
  }
  if (item.watchers >= 8) {
    underpricedScore += 1;
    signals.push(`${item.watchers} watchers — competitive demand, may be priced below market`);
  }

  if (overpricedScore >= 4) {
    return {
      position: "overpriced",
      label: "Overpriced",
      confidence: "high",
      signals,
      suggested_markdown_pct: item.views >= 100 && item.watchers === 0 ? 0.20 : 0.12,
    };
  }
  if (overpricedScore >= 2) {
    return {
      position: "overpriced",
      label: "Likely Overpriced",
      confidence: "medium",
      signals,
      suggested_markdown_pct: 0.12,
    };
  }
  if (overpricedScore >= 1) {
    return {
      position: "overpriced",
      label: "Possibly Overpriced",
      confidence: "low",
      signals,
      suggested_markdown_pct: 0.10,
    };
  }
  if (underpricedScore >= 3) {
    return {
      position: "underpriced",
      label: "May Be Underpriced",
      confidence: "medium",
      signals,
    };
  }

  return {
    position: "competitive",
    label: "Competitively Priced",
    confidence: overpricedScore === 0 ? "medium" : "low",
    signals: signals.length > 0 ? signals : ["Engagement signals are consistent with market pricing"],
  };
}

// ─── Primary Recovery Action ──────────────────────────────────────────────────
// Single highest-ROI action for this item, ordered by impact and ease.

export function calcPrimaryAction(item: InventoryItem): RecoveryAction {
  // Year+ listings: sunk cost regardless of risk score — carrying cost wins
  if (item.days_listed > 365) {
    return item.price < 15 ? "bundle" : "liquidate";
  }

  const risk = calcVisibilityRisk(item);

  if (risk === "Critical") {
    if (item.price < 15) return "bundle"; // too cheap to justify solo relist
    return "relist_now";                  // full reset: end + fresh listing
  }

  if (risk === "High") {
    if (!item.item_specifics_complete) return "optimize_specifics";
    if (item.title_keyword_strength < 50) return "title_rewrite"; // title is the block
    return "strategic_markdown"; // price drop triggers watcher notifications + filter
  }

  if (risk === "Medium") {
    if (!item.item_specifics_complete) return "optimize_specifics";
    if (item.image_count <= 2) return "add_photos";
    if (item.title_keyword_strength < 55) return "title_rewrite";
    // Good quality listing just needs a freshness refresh — Sell Similar before full relist
    if (
      item.days_listed >= 60 &&
      item.image_count >= 4 &&
      item.title_keyword_strength >= 75 &&
      item.item_specifics_complete
    ) return "sell_similar";
    // Fully optimized but audience is wrong platform
    if (
      item.days_listed >= 60 &&
      item.image_count >= 4 &&
      item.title_keyword_strength >= 80
    ) return "move_platform";
    if (item.days_listed >= 60) return "strategic_markdown";
    return "add_photos";
  }

  // Low risk — listing is healthy
  if (item.title_keyword_strength < 55) return "title_rewrite";
  if (item.title_keyword_strength < 70) return "optimize_specifics";
  return "hold";
}

// ─── Estimated Cash Recovery ──────────────────────────────────────────────────

export function calcEstimatedRecovery(item: InventoryItem): number {
  const action = calcPrimaryAction(item);
  const price = item.price;

  const recoveryRates: Record<RecoveryAction, number> = {
    hold:                1.00, // no action needed, full price expected
    add_photos:          0.92, // CTR improvement, near-full recovery
    title_rewrite:       0.90, // free fix, high recovery potential
    optimize_specifics:  0.88, // enters filtered search, strong recovery
    sell_similar:        0.82, // fresh impressions, slight price test likely
    relist_now:          0.78, // full reset, small price concession typical
    move_platform:       0.72, // platform shift carries friction cost
    strategic_markdown:  0.65, // deliberate cut to trigger activity
    bundle:              0.50, // bundled items sell for less per unit
    liquidate:           0.25, // 20–30 cents on the dollar
  };

  return Math.round(price * (recoveryRates[action] ?? 0.6) * 100) / 100;
}

// ─── Composite Scorer ─────────────────────────────────────────────────────────

export function scoreItem(item: InventoryItem): ScoredItem {
  return {
    ...item,
    dead_inventory_score:     calcDeadScore(item),
    listing_health_score:     calcHealthScore(item),
    visibility_risk:          calcVisibilityRisk(item),
    primary_recovery_action:  calcPrimaryAction(item),
    estimated_recovery:       calcEstimatedRecovery(item),
  };
}

export function scoreAll(items: InventoryItem[]): ScoredItem[] {
  return items.map(scoreItem);
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export function calcDashboardStats(items: InventoryItem[]): DashboardStats {
  const scored = scoreAll(items);
  const active = scored.filter((i) => i.status === "active");

  const trapped_cash = active.reduce((sum, i) => sum + i.price, 0);

  const dead_count = active.filter((i) => i.dead_inventory_score >= 50).length;
  const dead_inventory_pct =
    active.length > 0 ? Math.round((dead_count / active.length) * 100) : 0;

  const critical_count = active.filter((i) => i.visibility_risk === "Critical").length;
  const high_risk_count = active.filter((i) => i.visibility_risk === "High").length;
  const avg_days_listed =
    active.length > 0
      ? Math.round(active.reduce((s, i) => s + i.days_listed, 0) / active.length)
      : 0;

  const buckets: AgingBucket[] = [
    { label: "0–30d",   days_min: 0,   days_max: 30,      count: 0, value: 0 },
    { label: "31–60d",  days_min: 31,  days_max: 60,      count: 0, value: 0 },
    { label: "61–90d",  days_min: 61,  days_max: 90,      count: 0, value: 0 },
    { label: "91–180d", days_min: 91,  days_max: 180,     count: 0, value: 0 },
    { label: "180d+",   days_min: 181, days_max: Infinity, count: 0, value: 0 },
  ];

  for (const item of active) {
    const bucket = buckets.find(
      (b) => item.days_listed >= b.days_min && item.days_listed <= b.days_max
    );
    if (bucket) {
      bucket.count++;
      bucket.value += item.price;
    }
  }

  const platformMap = new Map<string, PlatformBucket>();
  for (const item of active) {
    const p = item.platform;
    if (!platformMap.has(p)) {
      platformMap.set(p, { platform: p, count: 0, value: 0, dead_count: 0 });
    }
    const bucket = platformMap.get(p)!;
    bucket.count++;
    bucket.value += item.price;
    if (item.dead_inventory_score >= 50) bucket.dead_count++;
  }

  return {
    total_items: active.length,
    trapped_cash,
    dead_inventory_pct,
    critical_count,
    high_risk_count,
    avg_days_listed,
    aging_breakdown: buckets,
    platform_breakdown: Array.from(platformMap.values()).sort((a, b) => b.value - a.value),
  };
}

// ─── Recovery Plan Builder ────────────────────────────────────────────────────

export function buildRecoveryPlan(items: ScoredItem[]): RecoveryActionDetail[] {
  const active = items.filter((i) => i.status === "active");

  const actionMeta: Record<
    RecoveryAction,
    { label: string; urgency: RecoveryActionDetail["urgency"]; reasoning: string }
  > = {
    relist_now: {
      label: "Relist Now",
      urgency: "immediate",
      reasoning:
        "eBay's algorithm buries listings after 90 days. End the listing and create a fresh one — same item, new impressions clock. This is the fastest full visibility reset available.",
    },
    sell_similar: {
      label: "Use Sell Similar",
      urgency: "this_week",
      reasoning:
        "eBay's Sell Similar creates a fresh listing from your existing one — new impressions clock, same details, original listing stays active. Lower effort than a full relist. Use it before the 90-day cliff hits.",
    },
    strategic_markdown: {
      label: "Strategic Markdown",
      urgency: "this_week",
      reasoning:
        "A price drop triggers eBay's 'Recently Lowered Price' filter and sends watchers a notification. A 15–25% cut creates real activity. Do it now — waiting compounds the problem.",
    },
    title_rewrite: {
      label: "Rewrite Title",
      urgency: "immediate",
      reasoning:
        "A weak title is invisible in search. eBay's Cassini indexes your title word-by-word. Fill all 80 characters with brand + model + colorway + condition + SKU. Free fix, immediate indexing improvement.",
    },
    bundle: {
      label: "Bundle It",
      urgency: "immediate",
      reasoning:
        "Low-priced stale items are dead weight. Bundle 2–4 related pieces, set a combined price that justifies shipping, and create one listing worth buying. Moves cash, clears space.",
    },
    move_platform: {
      label: "Move Platform",
      urgency: "this_week",
      reasoning:
        "Fully optimized and still not moving — the buyer for this item isn't on this platform. Cross-list or migrate. Different marketplace, different audience, different sell-through.",
    },
    optimize_specifics: {
      label: "Fix Item Specifics",
      urgency: "immediate",
      reasoning:
        "Missing specifics = invisible in filtered searches. eBay's Cassini algorithm penalizes incomplete listings. Fill every field — free fix, immediate improvement to search placement.",
    },
    add_photos: {
      label: "Add More Photos",
      urgency: "this_week",
      reasoning:
        "Single-photo listings convert 40% worse than 4+ photo listings. Shoot all angles, tags, any flaws, measurements. Buyers need to see the item to trust it enough to buy.",
    },
    liquidate: {
      label: "Liquidate",
      urgency: "immediate",
      reasoning:
        "Carrying cost — space, capital lock-up, mental overhead — now outweighs margin. Price to clear: 20–30 cents on the dollar, sell in lots, or donate for the tax write-off. Clear the shelf.",
    },
    hold: {
      label: "Hold — Monitor",
      urgency: "this_month",
      reasoning:
        "Listing is within normal sell-through range. Watch for 30-day sell-through before making changes. Don't fix what isn't broken.",
    },
  };

  const grouped = new Map<RecoveryAction, ScoredItem[]>();
  for (const item of active) {
    const action = item.primary_recovery_action;
    if (!grouped.has(action)) grouped.set(action, []);
    grouped.get(action)!.push(item);
  }

  const urgencyOrder: Record<RecoveryActionDetail["urgency"], number> = {
    immediate: 0,
    this_week: 1,
    this_month: 2,
  };

  return Array.from(grouped.entries())
    .map(([action, actionItems]) => ({
      action,
      ...actionMeta[action],
      estimated_cash_recovery: actionItems.reduce((sum, i) => sum + i.estimated_recovery, 0),
      items: actionItems.sort((a, b) => b.dead_inventory_score - a.dead_inventory_score),
    }))
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

// ─── Risk Color Maps ──────────────────────────────────────────────────────────

export const RISK_COLORS: Record<VisibilityRisk, string> = {
  Low:      "text-emerald-400",
  Medium:   "text-yellow-400",
  High:     "text-orange-400",
  Critical: "text-[#FF2D95]",
};

export const RISK_BG: Record<VisibilityRisk, string> = {
  Low:      "bg-emerald-400/10 border-emerald-400/30",
  Medium:   "bg-yellow-400/10 border-yellow-400/30",
  High:     "bg-orange-400/10 border-orange-400/30",
  Critical: "bg-[#FF2D95]/10 border-[#FF2D95]/30",
};

// ─── Pricing Position Color Maps ──────────────────────────────────────────────

export const PRICING_COLORS: Record<PricingPosition, string> = {
  overpriced:             "text-[#FF2D95]",
  competitive:            "text-emerald-400",
  underpriced:            "text-blue-400",
  liquidation_candidate:  "text-zinc-500",
};

export const PRICING_BG: Record<PricingPosition, string> = {
  overpriced:             "bg-[#FF2D95]/10 border-[#FF2D95]/30",
  competitive:            "bg-emerald-400/10 border-emerald-400/30",
  underpriced:            "bg-blue-400/10 border-blue-400/30",
  liquidation_candidate:  "bg-zinc-800 border-zinc-700",
};
