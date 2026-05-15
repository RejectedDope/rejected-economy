import type {
  InventoryItem,
  ScoredItem,
  VisibilityRisk,
  RecoveryAction,
  RecoveryActionDetail,
  DashboardStats,
  AgingBucket,
  PlatformBucket,
} from "./types";

// ─── Scoring Specification ────────────────────────────────────────────────────
//
// DEAD INVENTORY SCORE (0–100, higher = more dead)
// The single most important number. Tells you how buried a listing is.
//
//   Signal                  Max pts   Rationale
//   ─────────────────────── ───────   ──────────────────────────────────────────
//   days_listed             60 pts    Primary decay driver. eBay buries listings
//                                     algorithmically after 90 days. 180d+ is a
//                                     full cliff — buyers have scrolled past it
//                                     hundreds of times.
//   item_specifics missing  15 pts    Missing specifics = invisible in filtered
//                                     searches. eBay's Cassini algo explicitly
//                                     penalizes incomplete listings.
//   low photo count         12 pts    Single-photo listings convert ~40% worse
//                                     than 4+ photo listings. Buyers need to see
//                                     the thing to trust it.
//   weak title keywords     13 pts    Poor keyword coverage = fewer organic
//                                     impressions. Title is the primary search
//                                     index signal.
//   ─────────────────────── ───────
//   Total possible          100 pts
//
// LISTING HEALTH SCORE (0–100, higher = healthier)
// Positive framing of listing quality — specifics, photos, title, freshness.
//
// VISIBILITY RISK (Low / Medium / High / Critical)
// Derived from the dead score. Drives action urgency and UI color coding.
//   Low:      0–29   — within normal sell-through window
//   Medium:  30–49   — showing age, optimizations will help
//   High:    50–74   — algorithm has likely deprioritized, action needed
//   Critical: 75+    — functionally invisible, recovery required now
//
// ─────────────────────────────────────────────────────────────────────────────

// Exported for use in UI tooltips / "How scoring works" sections
export const SCORE_WEIGHTS = {
  days_listed: { max: 60, label: "Days Listed", note: "Primary decay driver" },
  item_specifics: { max: 15, label: "Item Specifics Missing", note: "Invisible in filtered search" },
  photo_count: { max: 12, label: "Photo Count", note: "Low photos = low CTR" },
  title_strength: { max: 13, label: "Title Keyword Strength", note: "Primary search index signal" },
} as const;

// ─── Dead Inventory Score ─────────────────────────────────────────────────────

export function calcDeadScore(item: InventoryItem): number {
  let score = 0;

  // ── days_listed: 60 pts max ──────────────────────────────────────────────
  // Steps align with real platform behavior:
  //   0–30d   normal — fresh listing still getting initial impressions
  //  31–60d   aging  — impressions decaying, still indexed
  //  61–90d   late   — approaching the eBay 90-day algorithm penalty cliff
  //  91–180d  stale  — deprioritized in search, watchers gone cold
  // 181–365d  dead   — buried, algorithmic equity exhausted
  //   365d+   same cap, time past a year adds no new signal
  if (item.days_listed <= 30)       score += 0;
  else if (item.days_listed <= 60)  score += 15;
  else if (item.days_listed <= 90)  score += 35;
  else if (item.days_listed <= 180) score += 50;
  else                              score += 60; // 60 is the hard cap for age alone

  // ── item_specifics_complete: 15 pts ─────────────────────────────────────
  // eBay's Cassini algorithm explicitly uses item specifics as a ranking signal.
  // A listing without specifics won't appear in filtered searches at all.
  if (!item.item_specifics_complete) score += 15;

  // ── image_count: 12 pts ─────────────────────────────────────────────────
  // 1 photo = maximum penalty. Buyers won't click without visual trust.
  // 2–3 photos = partial penalty. Still well below the 4-photo quality floor.
  if (item.image_count === 1)      score += 12;
  else if (item.image_count <= 3)  score += 5;

  // ── title_keyword_strength: 13 pts ──────────────────────────────────────
  // Titles are the primary search index for eBay. Weak keyword coverage
  // means fewer organic impressions regardless of how good the listing is.
  if (item.title_keyword_strength < 40)      score += 13;
  else if (item.title_keyword_strength < 60) score += 7;
  else if (item.title_keyword_strength < 75) score += 3;

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

  // Freshness: 30 pts — inverse decay curve mirrors dead score age brackets
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
  // Thresholds calibrated so that 90+ days with any quality issue = High,
  // and 142+ days with a quality listing = High (algorithm has buried it).
  if (dead >= 75) return "Critical";
  if (dead >= 50) return "High";    // NOTE: 50, not 55 — catches 91-180d listings
  if (dead >= 30) return "Medium";
  return "Low";
}

// ─── Primary Recovery Action ──────────────────────────────────────────────────
// Returns the single highest-ROI action for this item.

export function calcPrimaryAction(item: InventoryItem): RecoveryAction {
  const risk = calcVisibilityRisk(item);

  if (risk === "Critical") {
    // Under $15: not worth a solo relist — bundle with similar items to hit
    // a viable price point and justify shipping.
    if (item.price < 15) return "bundle";
    // Over a year: sunk cost too deep, carrying cost outweighs potential margin.
    // Time to liquidate or donate for the write-off.
    if (item.days_listed > 365) return "liquidate";
    // High-value item in the death pile: fresh listing is worth the effort.
    // New impressions clock, new buyer pool exposure.
    return "relist_now";
  }

  if (risk === "High") {
    // Missing specifics is the fastest win — fix it without ending the listing.
    // Immediately enters filtered search results.
    if (!item.item_specifics_complete) return "optimize_specifics";
    // Listing quality is fine but it's been sitting long enough that a price
    // drop triggers watcher notifications and "Recently Lowered" filter placement.
    return "strategic_markdown";
  }

  if (risk === "Medium") {
    // Quick wins in priority order:
    if (!item.item_specifics_complete) return "optimize_specifics";
    if (item.image_count <= 2)         return "add_photos";
    // Listing looks fully optimized but isn't selling — platform audience mismatch.
    // Different buyers, different sell-through.
    if (
      item.days_listed >= 60 &&
      item.image_count >= 4 &&
      item.title_keyword_strength >= 80
    ) return "move_platform";
    // Has age but no obvious quality fix — markdown to trigger activity.
    if (item.days_listed >= 60) return "strategic_markdown";
    // Fresh enough and well-listed — more photos will close the gap.
    return "add_photos";
  }

  // Low risk — listing is healthy. Only nudge if title is weak.
  if (item.title_keyword_strength < 60) return "optimize_specifics";
  return "hold";
}

// ─── Estimated Cash Recovery ──────────────────────────────────────────────────
// What percentage of the listed price can realistically be recovered
// by executing the recommended action. These are conservative estimates.

export function calcEstimatedRecovery(item: InventoryItem): number {
  const action = calcPrimaryAction(item);
  const price = item.price;

  const recoveryRates: Record<RecoveryAction, number> = {
    hold:                1.00, // no action needed, expect full price
    add_photos:          0.90, // better photos → near-full recovery
    optimize_specifics:  0.85, // quick listing fix, high recovery
    relist_now:          0.78, // fresh start, slight price concession likely
    strategic_markdown:  0.65, // deliberate price cut to trigger activity
    move_platform:       0.72, // platform shift, minor friction cost
    bundle:              0.50, // bundled items sell for less per-unit
    liquidate:           0.25, // 20–30 cents on the dollar, clearing the shelf
  };

  return Math.round(price * (recoveryRates[action] ?? 0.6) * 100) / 100;
}

// ─── Composite Scorer ─────────────────────────────────────────────────────────

export function scoreItem(item: InventoryItem): ScoredItem {
  return {
    ...item,
    dead_inventory_score:  calcDeadScore(item),
    listing_health_score:  calcHealthScore(item),
    visibility_risk:       calcVisibilityRisk(item),
    primary_recovery_action: calcPrimaryAction(item),
    estimated_recovery:    calcEstimatedRecovery(item),
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

  // "Dead" = High or Critical risk (score ≥ 50) — these are the listings
  // that are materially underperforming and need action.
  const dead_count = active.filter((i) => i.dead_inventory_score >= 50).length;
  const dead_inventory_pct =
    active.length > 0
      ? Math.round((dead_count / active.length) * 100)
      : 0;

  const critical_count = active.filter((i) => i.visibility_risk === "Critical").length;
  const high_risk_count = active.filter((i) => i.visibility_risk === "High").length;
  const avg_days_listed =
    active.length > 0
      ? Math.round(active.reduce((s, i) => s + i.days_listed, 0) / active.length)
      : 0;

  const buckets: AgingBucket[] = [
    { label: "0–30d",    days_min: 0,   days_max: 30,       count: 0, value: 0 },
    { label: "31–60d",   days_min: 31,  days_max: 60,       count: 0, value: 0 },
    { label: "61–90d",   days_min: 61,  days_max: 90,       count: 0, value: 0 },
    { label: "91–180d",  days_min: 91,  days_max: 180,      count: 0, value: 0 },
    { label: "180d+",    days_min: 181, days_max: Infinity,  count: 0, value: 0 },
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

  // Platform breakdown
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
    platform_breakdown: Array.from(platformMap.values()).sort(
      (a, b) => b.value - a.value
    ),
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
        "eBay's algorithm buries listings after 90 days. End the listing and create a fresh one — same item, new impressions clock. This is the fastest visibility reset available.",
    },
    strategic_markdown: {
      label: "Strategic Markdown",
      urgency: "this_week",
      reasoning:
        "Price drops trigger eBay's 'Recently Lowered' filter and send watchers a notification. A 15–25% cut moves the needle without destroying margin. Do it now, not next month.",
    },
    bundle: {
      label: "Bundle It",
      urgency: "immediate",
      reasoning:
        "Low-priced stale items are drag. Bundle 2–4 related pieces, raise the combined price, and create a listing that justifies shipping cost. Moves cash, clears space.",
    },
    move_platform: {
      label: "Move Platform",
      urgency: "this_week",
      reasoning:
        "This listing is fully optimized but isn't moving — the audience isn't on this platform. Cross-list or migrate to where your buyers actually shop. Different eyeballs, different sell-through.",
    },
    optimize_specifics: {
      label: "Fix Item Specifics",
      urgency: "immediate",
      reasoning:
        "Missing item specifics = invisible in filtered searches. eBay's Cassini algorithm penalizes incomplete listings. Fill every field — it costs you nothing and immediately improves indexing.",
    },
    add_photos: {
      label: "Add More Photos",
      urgency: "this_week",
      reasoning:
        "Single-photo listings have 40% lower conversion than multi-photo. Shoot the item from 6+ angles including tags, flaws, and measurements. Buyers need to see it to buy it.",
    },
    liquidate: {
      label: "Liquidate",
      urgency: "immediate",
      reasoning:
        "This inventory has been dead too long. The carrying cost (space, mental overhead, capital lock-up) now outweighs the margin. Price to move: 20–30 cents on the dollar, sell in lots, or donate for the tax write-off.",
    },
    hold: {
      label: "Hold — Monitor",
      urgency: "this_month",
      reasoning:
        "This listing is performing within normal range. Watch for 30-day sell-through before making changes. Don't fix what isn't broken.",
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
      estimated_cash_recovery: actionItems.reduce(
        (sum, i) => sum + i.estimated_recovery,
        0
      ),
      items: actionItems.sort(
        (a, b) => b.dead_inventory_score - a.dead_inventory_score
      ),
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
