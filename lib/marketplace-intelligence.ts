// Second-layer inventory intelligence engine.
// Pure heuristics — reseller operational logic, inventory diagnostics, no AI claims.
// Takes a ScoredItem (output of scoring engine) and returns deep marketplace signals.

import type { ScoredItem, Platform } from "./types";

// ─── Signal Types ─────────────────────────────────────────────────────────────

export type VelocityRiskLevel = "accelerating" | "steady" | "decelerating" | "stalled" | "dead";
export type DecayStage = "fresh" | "fading" | "suppressed" | "buried" | "zombie";
export type FrictionLevel = "none" | "low" | "moderate" | "high" | "blocking";
export type PlatformFit = "strong" | "moderate" | "weak";
export type PriceTierCompetition = "low" | "moderate" | "high";
export type PromotionROI = "high" | "moderate" | "low" | "not_recommended";
export type RecoveryPriority = "critical" | "high" | "medium" | "low";
export type BarrierSeverity = "high" | "medium" | "low";

export interface VelocityRisk {
  level: VelocityRiskLevel;
  views_per_day: number;
  watcher_conversion_rate: number; // watchers / views (0–1)
  diagnosis: string;
  signal: string;
}

export interface VisibilityDecay {
  stage: DecayStage;
  suppression_probability: number; // 0–100
  days_until_critical: number | null; // null = already critical
  diagnosis: string;
}

export interface PricingFriction {
  level: FrictionLevel;
  score: number; // 0–100, higher = more friction
  shipping_friction: boolean;
  price_rejection_signals: boolean;
  trust_gap: boolean;
  recommendations: string[];
}

export interface SaturationSignal {
  score: number; // 0–100, higher = more saturated
  platform_fit: PlatformFit;
  price_tier_competition: PriceTierCompetition;
  diagnosis: string;
}

export interface PromotionPotential {
  roi_class: PromotionROI;
  estimated_visibility_lift: number; // percentage
  platform_supports: boolean;
  diagnosis: string;
  recommended_rate?: number; // fraction of sale price, e.g. 0.05 = 5%
}

export interface ConversionBarrier {
  type: string;
  severity: BarrierSeverity;
  label: string;
}

export interface ConversionRisk {
  score: number; // 0–100, higher = more at risk
  primary_barrier: "price" | "trust" | "visibility" | "competition" | "specifics" | "photos" | "shipping" | "title" | "none";
  barriers: ConversionBarrier[];
}

export interface RecoveryPathItem {
  priority: RecoveryPriority;
  action: string;
  label: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  reasoning: string;
  time_to_impact: string;
}

export interface MarketplaceSignals {
  velocityRisk: VelocityRisk;
  staleProbability: number; // 0–100
  saturationScore: SaturationSignal;
  pricingFriction: PricingFriction;
  visibilityDecay: VisibilityDecay;
  promotionPotential: PromotionPotential;
  conversionRisk: ConversionRisk;
  recoveryPriority: RecoveryPathItem[];
  generatedAt: string;
}

// ─── Platform / Category Fitness ─────────────────────────────────────────────

const PLATFORM_CATEGORY_FIT: Partial<Record<Platform, Record<string, PlatformFit>>> = {
  eBay: {
    sneakers: "strong", electronics: "strong", collectibles: "strong",
    "trading cards": "strong", vintage: "strong", "vintage clothing": "strong",
    handbags: "moderate", shirts: "moderate", jeans: "moderate", jewelry: "moderate",
  },
  Poshmark: {
    handbags: "strong", dresses: "strong", shirts: "strong", jeans: "strong",
    "vintage clothing": "strong", jewelry: "strong", sneakers: "moderate",
    streetwear: "moderate",
  },
  Mercari: {
    electronics: "strong", sneakers: "moderate", shirts: "moderate",
    collectibles: "moderate", handbags: "moderate",
  },
  Depop: {
    "vintage clothing": "strong", streetwear: "strong", shirts: "strong",
    jeans: "strong", dresses: "strong",
  },
  "Facebook Marketplace": {
    electronics: "moderate",
  },
  StockX: {
    sneakers: "strong", streetwear: "strong",
  },
  GOAT: {
    sneakers: "strong",
  },
  Whatnot: {
    "trading cards": "strong", collectibles: "strong",
  },
  Grailed: {
    streetwear: "strong", jeans: "strong", shirts: "strong",
    "vintage clothing": "strong",
  },
};

function getPlatformFit(platform: Platform, category: string): PlatformFit {
  const catKey = category.toLowerCase();
  const platformMap = PLATFORM_CATEGORY_FIT[platform] ?? {};
  return platformMap[catKey] ?? "moderate";
}

// ─── Velocity Risk ────────────────────────────────────────────────────────────

export function calcVelocityRisk(item: ScoredItem): VelocityRisk {
  const views_per_day = item.days_listed > 0 ? item.views / item.days_listed : item.views;
  const watcher_conversion_rate = item.views > 0 ? item.watchers / item.views : 0;

  let level: VelocityRiskLevel;
  let diagnosis: string;
  let signal: string;

  if (item.days_listed < 7) {
    level = "steady";
    diagnosis = "Listing is new — not enough data to assess velocity. Monitor for 7–14 days before taking action.";
    signal = "New listing · baseline data not yet available";
  } else if (views_per_day < 0.1 && item.days_listed >= 30) {
    level = "dead";
    diagnosis = "Near-zero traffic — this listing has been algorithmically removed from buyer discovery. A full relist is required to restore impressions.";
    signal = `${views_per_day.toFixed(2)} views/day · effectively zero impressions`;
  } else if (views_per_day < 0.5 && item.days_listed >= 21) {
    level = "stalled";
    diagnosis = "Traffic has stalled well below the threshold for organic conversion. Low-velocity listings lose placement priority in search results.";
    signal = `${views_per_day.toFixed(1)} views/day · below conversion threshold`;
  } else if (watcher_conversion_rate < 0.01 && item.views >= 30 && item.days_listed >= 30) {
    level = "decelerating";
    diagnosis = "Visible but not converting — buyers are seeing the listing and leaving without watching. This is a price or quality signal, not a visibility problem.";
    signal = `${Math.round(watcher_conversion_rate * 100)}% watcher rate · price or quality rejection`;
  } else if (watcher_conversion_rate >= 0.12 && item.watchers >= 3) {
    level = "accelerating";
    diagnosis = "Strong watcher-to-view conversion — high buyer intent. This listing may be priced below market. Consider holding at current price or testing a slight increase.";
    signal = `${Math.round(watcher_conversion_rate * 100)}% watcher rate · strong buyer intent`;
  } else {
    level = "steady";
    diagnosis = "Traffic and engagement are within normal resale sell-through patterns. Monitor for 30 days before intervening.";
    signal = `${views_per_day.toFixed(1)} views/day · ${item.watchers} watcher${item.watchers !== 1 ? "s" : ""}`;
  }

  return {
    level,
    views_per_day: Math.round(views_per_day * 10) / 10,
    watcher_conversion_rate: Math.round(watcher_conversion_rate * 1000) / 1000,
    diagnosis,
    signal,
  };
}

// ─── Visibility Decay ─────────────────────────────────────────────────────────

export function calcVisibilityDecay(item: ScoredItem): VisibilityDecay {
  let stage: DecayStage;
  let suppression_probability: number;
  let days_until_critical: number | null;
  let diagnosis: string;

  if (item.days_listed <= 14) {
    stage = "fresh";
    suppression_probability = 5;
    days_until_critical = 76; // 90d cliff
    diagnosis = "Listing is in the peak organic visibility window. Algorithm is actively surfacing it to buyers.";
  } else if (item.days_listed <= 45) {
    stage = "fading";
    suppression_probability = 20;
    days_until_critical = Math.max(0, 90 - item.days_listed);
    diagnosis = "Past the 'new listing' boost window. Impressions are declining naturally as the listing ages out of fresh placement.";
  } else if (item.days_listed <= 90) {
    const suppressionBase = 30 + Math.round(((item.days_listed - 45) / 45) * 30);
    suppression_probability = Math.min(75, item.watchers === 0 ? suppressionBase + 15 : suppressionBase);
    stage = "suppressed";
    days_until_critical = Math.max(0, 90 - item.days_listed);
    diagnosis = `Approaching the 90-day freshness cliff. ${item.watchers === 0 ? "No watcher traction amplifies suppression risk." : "Watcher activity is providing limited algorithmic protection."}`;
  } else if (item.days_listed <= 365) {
    stage = "buried";
    suppression_probability = Math.min(92, 65 + Math.round(((item.days_listed - 90) / 275) * 27));
    days_until_critical = null;
    diagnosis = "Past the 90-day algorithm cliff. This listing is running on a fraction of its original placement. Standard search results bury it under fresh listings.";
  } else {
    stage = "zombie";
    suppression_probability = 96;
    days_until_critical = null;
    diagnosis = "Zombie listing — over one year active. The platform algorithm has effectively de-indexed this from regular buyer discovery. Only buyers actively searching for this exact item will find it.";
  }

  return {
    stage,
    suppression_probability: Math.min(100, suppression_probability),
    days_until_critical,
    diagnosis,
  };
}

// ─── Pricing Friction ─────────────────────────────────────────────────────────

export function calcPricingFriction(item: ScoredItem): PricingFriction {
  let score = 0;
  const recommendations: string[] = [];
  let shipping_friction = false;
  let price_rejection_signals = false;
  let trust_gap = false;

  // Shipping friction
  const shippingRatio = item.shipping_cost ? item.shipping_cost / Math.max(item.price, 1) : 0;
  if (shippingRatio > 0.25) {
    score += 30;
    shipping_friction = true;
    recommendations.push(
      `Shipping is ${Math.round(shippingRatio * 100)}% of item price — buyers see this as a price hike. Fold shipping into the item price and offer free shipping.`
    );
  } else if (shippingRatio > 0.15) {
    score += 15;
    shipping_friction = true;
    recommendations.push("High shipping-to-price ratio is reducing conversion. Consider free shipping with cost folded into the listing price.");
  } else if (item.shipping_type !== "free" && item.price < 30) {
    score += 10;
    shipping_friction = true;
    recommendations.push("Items under $30 convert significantly better with free shipping included in the price.");
  }

  // Price rejection signals
  if (item.views >= 100 && item.watchers === 0) {
    score += 35;
    price_rejection_signals = true;
    recommendations.push(
      `${item.views} views, 0 watchers — buyers have seen this price and declined. A 15–20% markdown is the minimum needed to create movement.`
    );
  } else if (item.views >= 50 && item.watchers <= 1 && item.days_listed >= 30) {
    score += 20;
    price_rejection_signals = true;
    recommendations.push("Low watcher-to-view conversion after 30+ days. Test a 10–15% price reduction.");
  } else if (item.views >= 25 && item.watchers === 0 && item.days_listed >= 45) {
    score += 10;
    price_rejection_signals = true;
    recommendations.push("Views accumulating without any watcher conversion — price may be above buyer expectations at this age.");
  }

  // No markdown despite age
  if (item.days_listed >= 90 && (!item.original_price || item.price >= item.original_price * 0.97)) {
    score += 15;
    recommendations.push("No price reduction after 90+ days. Market price for this item may have shifted since the original listing.");
  } else if (item.days_listed >= 60 && (!item.original_price || item.price >= item.original_price * 0.97)) {
    score += 8;
  }

  // Trust gap — quality gaps that create buyer hesitation
  if (item.image_count <= 1) {
    score += 20;
    trust_gap = true;
    recommendations.push("Single photo creates strong buyer hesitation. Add 4–8+ angles: condition, tags, measurements, any flaws.");
  } else if (item.image_count <= 3) {
    score += 10;
    trust_gap = true;
    recommendations.push("Low photo count reduces buyer confidence. Shoot all angles and any condition details to close the trust gap.");
  }

  if (!item.item_specifics_complete) {
    score += 10;
    trust_gap = true;
    recommendations.push("Missing item specifics hides this listing from buyers using category filters. Complete all fields — it's free and immediate.");
  }

  const finalScore = Math.min(100, score);

  let level: FrictionLevel;
  if (finalScore >= 70) level = "blocking";
  else if (finalScore >= 50) level = "high";
  else if (finalScore >= 30) level = "moderate";
  else if (finalScore >= 10) level = "low";
  else level = "none";

  return {
    level,
    score: finalScore,
    shipping_friction,
    price_rejection_signals,
    trust_gap,
    recommendations: recommendations.slice(0, 3),
  };
}

// ─── Saturation Analysis ──────────────────────────────────────────────────────

export function calcSaturationSignal(item: ScoredItem): SaturationSignal {
  const platform_fit = getPlatformFit(item.platform, item.category);

  let price_tier_competition: PriceTierCompetition;
  if (item.price < 25) price_tier_competition = "high";
  else if (item.price < 75) price_tier_competition = "moderate";
  else price_tier_competition = "low";

  let satScore = 0;
  if (platform_fit === "weak") satScore += 40;
  else if (platform_fit === "moderate") satScore += 15;

  if (price_tier_competition === "high") satScore += 25;
  else if (price_tier_competition === "moderate") satScore += 10;

  // Age compounds saturation pressure
  if (item.days_listed >= 90 && price_tier_competition === "high") satScore += 15;
  else if (item.days_listed >= 90) satScore += 8;

  const score = Math.min(100, satScore);

  let diagnosis: string;
  if (platform_fit === "strong" && price_tier_competition === "low") {
    diagnosis = `${item.platform} is a strong fit for ${item.category} at this price point. Limited direct competition in this tier.`;
  } else if (platform_fit === "weak") {
    diagnosis = `${item.platform} has limited buyer depth for ${item.category}. The audience for this item is concentrated on a different platform.`;
  } else if (price_tier_competition === "high") {
    diagnosis = `${item.category} items under $25 face commodity-level competition. Listing quality and specifics completeness are the critical differentiators.`;
  } else {
    diagnosis = `Moderate competition in ${item.category} on ${item.platform}. Listing quality and price are the primary conversion levers.`;
  }

  return { score, platform_fit, price_tier_competition, diagnosis };
}

// ─── Promotion Potential ──────────────────────────────────────────────────────

const PLATFORMS_WITH_PROMOTED: Set<Platform> = new Set(["eBay", "Poshmark"]);

export function calcPromotionPotential(item: ScoredItem): PromotionPotential {
  const platform_supports = PLATFORMS_WITH_PROMOTED.has(item.platform);

  if (!platform_supports) {
    return {
      roi_class: "not_recommended",
      estimated_visibility_lift: 0,
      platform_supports: false,
      diagnosis: `${item.platform} does not offer promoted listings. Rely on organic optimization and cross-listing.`,
    };
  }

  if (item.days_listed < 30) {
    return {
      roi_class: "not_recommended",
      estimated_visibility_lift: 15,
      platform_supports: true,
      diagnosis: "Too early for promotion — let organic placement run for 30 days first. Promotion ROI is more predictable once baseline engagement data exists.",
    };
  }

  if (item.price < 20) {
    return {
      roi_class: "not_recommended",
      estimated_visibility_lift: 20,
      platform_supports: true,
      diagnosis: `At $${item.price.toFixed(0)}, promotion fees (typically 2–15% of sale price) make ROI marginal. Bundle with similar items to raise the promoted price point.`,
    };
  }

  const hasQuality = item.item_specifics_complete && item.image_count >= 4;
  const isAging = item.days_listed >= 60 && item.days_listed < 365;
  const hasEngagement = item.views >= 20;

  if (hasQuality && isAging && hasEngagement) {
    const recommended_rate = item.price >= 100 ? 0.05 : 0.08;
    return {
      roi_class: "high",
      estimated_visibility_lift: 35,
      platform_supports: true,
      diagnosis: `Strong candidate — quality listing with organic traffic and enough age to benefit from paid amplification. A ${Math.round(recommended_rate * 100)}% ad rate should produce positive ROI.`,
      recommended_rate,
    };
  }

  if (isAging && !hasQuality) {
    return {
      roi_class: "low",
      estimated_visibility_lift: 15,
      platform_supports: true,
      diagnosis: "Fix listing quality first — complete item specifics and add photos before investing in paid visibility. Promotion amplifies existing listing quality; it doesn't compensate for gaps.",
    };
  }

  if (isAging && hasQuality) {
    return {
      roi_class: "moderate",
      estimated_visibility_lift: 25,
      platform_supports: true,
      diagnosis: "Reasonable promotion candidate. Organic traffic signals suggest demand exists — paid visibility can accelerate sell-through from current position.",
      recommended_rate: 0.07,
    };
  }

  return {
    roi_class: "low",
    estimated_visibility_lift: 10,
    platform_supports: true,
    diagnosis: "Limited promotion ROI at current listing age and engagement level. Focus on organic optimization to build baseline performance first.",
  };
}

// ─── Conversion Risk ──────────────────────────────────────────────────────────

export function calcConversionRisk(item: ScoredItem): ConversionRisk {
  const barriers: ConversionBarrier[] = [];
  let score = 0;

  if (item.image_count <= 1) {
    barriers.push({ type: "photos", severity: "high", label: "Single photo — buyers can't assess condition" });
    score += 25;
  } else if (item.image_count <= 3) {
    barriers.push({ type: "photos", severity: "medium", label: "Low photo count reduces buyer confidence" });
    score += 12;
  }

  if (!item.item_specifics_complete) {
    barriers.push({ type: "specifics", severity: "high", label: "Missing specifics — invisible in filtered search" });
    score += 20;
  }

  const watcherRate = item.views > 0 ? item.watchers / item.views : 0;
  if (item.views >= 100 && item.watchers === 0) {
    barriers.push({ type: "price", severity: "high", label: `${item.views} views, 0 watchers — price rejection confirmed` });
    score += 30;
  } else if (item.views >= 50 && watcherRate < 0.01) {
    barriers.push({ type: "price", severity: "medium", label: "Low watcher conversion suggests price friction" });
    score += 15;
  }

  if (item.days_listed >= 90 && item.views < 30) {
    barriers.push({ type: "visibility", severity: "high", label: "Suppressed placement — listing not reaching buyers" });
    score += 20;
  }

  if (item.shipping_cost && item.shipping_cost > item.price * 0.25) {
    barriers.push({ type: "shipping", severity: "medium", label: "High shipping ratio inflates effective price" });
    score += 10;
  }

  if (item.title_keyword_strength < 40) {
    barriers.push({ type: "title", severity: "high", label: "Weak title keywords — low search discovery" });
    score += 15;
  } else if (item.title_keyword_strength < 60) {
    barriers.push({ type: "title", severity: "low", label: "Title keyword strength could be improved" });
    score += 5;
  }

  const finalScore = Math.min(100, score);
  const sortedBarriers = [...barriers].sort((a, b) => {
    const order: Record<BarrierSeverity, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const primaryBarrier = sortedBarriers.find((b) => b.severity === "high")?.type as ConversionRisk["primary_barrier"] ?? "none";

  return { score: finalScore, primary_barrier: primaryBarrier, barriers: sortedBarriers };
}

// ─── Stale Probability ────────────────────────────────────────────────────────

export function calcStaleProbability(item: ScoredItem): number {
  let score = 0;

  if (item.days_listed >= 365) score += 50;
  else if (item.days_listed >= 180) score += 35;
  else if (item.days_listed >= 90) score += 25;
  else if (item.days_listed >= 60) score += 15;
  else if (item.days_listed >= 30) score += 8;

  if (item.views >= 50 && item.watchers === 0) score += 25;
  else if (item.views >= 30 && item.watchers === 0 && item.days_listed >= 45) score += 15;
  else if (item.watchers === 0 && item.days_listed >= 60) score += 10;

  if (item.days_listed >= 90 && (!item.original_price || item.price >= item.original_price * 0.97)) {
    score += 15;
  } else if (item.days_listed >= 60 && (!item.original_price || item.price >= item.original_price * 0.97)) {
    score += 8;
  }

  const vpd = item.days_listed > 0 ? item.views / item.days_listed : item.views;
  if (vpd < 0.2 && item.days_listed >= 30) score += 10;

  return Math.min(100, Math.round(score));
}

// ─── Recovery Priority Builder ────────────────────────────────────────────────

type PartialSignals = Omit<MarketplaceSignals, "recoveryPriority" | "generatedAt">;

export function buildRecoveryPriority(item: ScoredItem, signals: PartialSignals): RecoveryPathItem[] {
  const items: RecoveryPathItem[] = [];

  // Year+ zombie: single critical action
  if (item.days_listed >= 365) {
    items.push({
      priority: "critical",
      action: item.price < 20 ? "bundle" : "liquidate",
      label: item.price < 20 ? "Bundle & Clear" : "Liquidate at Market Price",
      effort: "low",
      impact: "high",
      reasoning: `This listing has been active for ${item.days_listed} days. Carrying cost in capital lock-up now outweighs realistic upside. Price to clear at 20–30 cents on the dollar, or bundle with similar items.`,
      time_to_impact: "1–3 days after repricing",
    });
    return items;
  }

  // Title keyword weakness — free fix, high ROI
  if (item.title_keyword_strength < 50) {
    items.push({
      priority: signals.visibilityDecay.stage === "buried" ? "high" : "medium",
      action: "title_rewrite",
      label: "Rewrite Title for Better Search Discovery",
      effort: "low",
      impact: "high",
      reasoning: `Title keyword strength is ${item.title_keyword_strength}/100. The search algorithm indexes title words one-by-one — fill all 80 characters with brand, model, colorway, condition, and key attributes. Free fix, immediate impact.`,
      time_to_impact: "Within 24 hours of edit",
    });
  }

  // Missing item specifics — filter visibility
  if (!item.item_specifics_complete) {
    items.push({
      priority: item.days_listed >= 60 ? "high" : "medium",
      action: "optimize_specifics",
      label: "Complete Item Specifics",
      effort: "low",
      impact: "high",
      reasoning: "Missing item specifics hides this listing from buyers using category filters — size, brand, condition. Completing specifics is the single highest-ROI free optimization on eBay.",
      time_to_impact: "Immediate — within hours of edit",
    });
  }

  // Low photos — trust gap
  if (item.image_count <= 2) {
    items.push({
      priority: "medium",
      action: "add_photos",
      label: "Add More Photos",
      effort: "medium",
      impact: "medium",
      reasoning: `${item.image_count} photo${item.image_count > 1 ? "s" : ""} — listings with 8+ photos convert 40% better. Shoot all angles, tags, measurements, any flaws. Buyers need visual evidence to build trust.`,
      time_to_impact: "Within 24–48 hours of upload",
    });
  }

  // Price rejection — markdown
  if (signals.pricingFriction.price_rejection_signals) {
    items.push({
      priority: item.views >= 100 && item.watchers === 0 ? "critical" : "high",
      action: "strategic_markdown",
      label: "Price Reduction — Clear the Conversion Barrier",
      effort: "low",
      impact: "high",
      reasoning: signals.pricingFriction.recommendations[0] ??
        "Price rejection signal detected. A targeted markdown triggers watcher notifications and renewed buyer interest.",
      time_to_impact: "Watcher notification sent within minutes of price drop",
    });
  }

  // Shipping friction
  if (signals.pricingFriction.shipping_friction && item.price < 40) {
    items.push({
      priority: "medium",
      action: "fix_shipping",
      label: "Switch to Free Shipping",
      effort: "low",
      impact: "medium",
      reasoning: "High shipping cost inflates the buyer's effective price on a low-value item. Fold shipping into the item price and offer free shipping — conversion rates improve significantly for sub-$40 items.",
      time_to_impact: "Immediate upon edit",
    });
  }

  // Wrong platform
  if (signals.saturationScore.platform_fit === "weak") {
    items.push({
      priority: "medium",
      action: "move_platform",
      label: "Cross-list to Better-Fit Platform",
      effort: "high",
      impact: "high",
      reasoning: signals.saturationScore.diagnosis,
      time_to_impact: "New listing visible within 1–24 hours on destination platform",
    });
  }

  // Buried listing — needs relist
  if ((signals.visibilityDecay.stage === "buried" || signals.visibilityDecay.stage === "suppressed") && item.days_listed >= 90) {
    const alreadyHasAction = items.some((i) => i.action === "relist_now");
    if (!alreadyHasAction) {
      items.push({
        priority: "high",
        action: "relist_now",
        label: "Relist for Fresh Impressions",
        effort: "medium",
        impact: "high",
        reasoning: `${signals.visibilityDecay.diagnosis} Ending and creating a fresh listing resets the impressions clock — the fastest full visibility restore available.`,
        time_to_impact: "New impressions begin within 2–6 hours of relisting",
      });
    }
  }

  // Promoted listing opportunity
  if (signals.promotionPotential.roi_class === "high") {
    items.push({
      priority: "medium",
      action: "add_promoted_listing",
      label: "Add Promoted Listing",
      effort: "low",
      impact: "medium",
      reasoning: signals.promotionPotential.diagnosis,
      time_to_impact: "Promoted visibility increase within 24 hours",
    });
  }

  const priorityOrder: Record<RecoveryPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ─── Main Intelligence Engine ─────────────────────────────────────────────────

export function analyzeMarketplaceSignals(item: ScoredItem): MarketplaceSignals {
  const velocityRisk = calcVelocityRisk(item);
  const visibilityDecay = calcVisibilityDecay(item);
  const pricingFriction = calcPricingFriction(item);
  const saturationScore = calcSaturationSignal(item);
  const promotionPotential = calcPromotionPotential(item);
  const conversionRisk = calcConversionRisk(item);
  const staleProbability = calcStaleProbability(item);

  const partialSignals: PartialSignals = {
    velocityRisk,
    staleProbability,
    saturationScore,
    pricingFriction,
    visibilityDecay,
    promotionPotential,
    conversionRisk,
  };

  return {
    ...partialSignals,
    recoveryPriority: buildRecoveryPriority(item, partialSignals),
    generatedAt: new Date().toISOString(),
  };
}
