// ============================================================
// RESALEIQ — Portfolio Health Module
// Pure functions. No side effects. No DB calls.
// ============================================================

import type { ScoredItem } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CategoryRisk {
  category: string;
  count: number;
  avg_days: number;
  total_value: number;
  dead_count: number;       // score >= 50
  dead_pct: number;
  risk_level: "low" | "medium" | "high";
  concentration_pct: number; // % of total portfolio by count
}

export interface RecoveryOpportunity {
  item_id: string;
  title: string;
  value: number;
  recovery_estimate: number;
  days_listed: number;
  action: string;           // RecoveryAction
  effort: "low" | "medium" | "high";
  roi_score: number;        // 0-100
  is_quick_win: boolean;
}

export interface AgingDistribution {
  pct_fresh: number;        // 0-30d
  pct_normal: number;       // 31-90d
  pct_aging: number;        // 91-180d
  pct_stale: number;        // 181d+
  healthy: boolean;         // true if pct_fresh + pct_normal >= 60
}

export interface PortfolioHealth {
  score: number;                  // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  total_active: number;
  total_value: number;
  trapped_cash: number;           // value in dead/stale items (score >= 50)
  trapped_pct: number;
  stale_count: number;            // score >= 30
  critical_count: number;         // score >= 75
  recovery_opportunity: number;   // sum of estimated_recovery for score >= 50
  avg_dead_score: number;
  avg_days_listed: number;
  category_risks: CategoryRisk[];
  aging_distribution: AgingDistribution;
  top_opportunities: RecoveryOpportunity[];
}

// ─── Effort Level ─────────────────────────────────────────────────────────────

export function calcEffortLevel(action: string): "low" | "medium" | "high" {
  const LOW_EFFORT = new Set([
    "title_rewrite",
    "optimize_specifics",
    "strategic_markdown",
    "add_promoted_listing",
    "fix_shipping",
  ]);

  const HIGH_EFFORT = new Set([
    "relist_now",
    "move_platform",
    "bundle",
    "liquidate",
  ]);

  if (LOW_EFFORT.has(action)) return "low";
  if (HIGH_EFFORT.has(action)) return "high";
  return "medium";
}

// ─── Recovery ROI ─────────────────────────────────────────────────────────────

export function calcRecoveryROI(item: ScoredItem): number {
  const base = (item.estimated_recovery / Math.max(item.price, 1)) * 50;

  let urgencyBoost = 0;
  if (item.dead_inventory_score >= 75) urgencyBoost = 30;
  else if (item.dead_inventory_score >= 50) urgencyBoost = 20;
  else if (item.dead_inventory_score >= 30) urgencyBoost = 10;

  const effort = calcEffortLevel(item.primary_recovery_action);
  let effortPenalty = 0;
  if (effort === "high") effortPenalty = 15;
  else if (effort === "medium") effortPenalty = 5;

  return Math.min(100, Math.max(0, Math.round(base + urgencyBoost - effortPenalty)));
}

// ─── Category Risks ───────────────────────────────────────────────────────────

export function calcCategoryRisks(items: ScoredItem[]): CategoryRisk[] {
  const active = items.filter((i) => i.status === "active");
  const totalCount = active.length;

  // Group by category
  const groups = new Map<string, ScoredItem[]>();
  for (const item of active) {
    const cat = item.category || "Other";
    const bucket = groups.get(cat);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(cat, [item]);
    }
  }

  const risks: CategoryRisk[] = [];

  for (const [category, catItems] of groups) {
    const count = catItems.length;
    const avg_days =
      count > 0
        ? catItems.reduce((sum, i) => sum + i.days_listed, 0) / count
        : 0;
    const total_value = catItems.reduce((sum, i) => sum + i.price, 0);
    const dead_count = catItems.filter((i) => i.dead_inventory_score >= 50).length;
    const dead_pct = count > 0 ? (dead_count / count) * 100 : 0;
    const concentration_pct = totalCount > 0 ? (count / totalCount) * 100 : 0;

    let risk_level: "low" | "medium" | "high";
    if (dead_pct > 60 || avg_days > 150) risk_level = "high";
    else if (dead_pct > 30 || avg_days > 90) risk_level = "medium";
    else risk_level = "low";

    risks.push({
      category,
      count,
      avg_days,
      total_value,
      dead_count,
      dead_pct,
      risk_level,
      concentration_pct,
    });
  }

  // Sort by total_value desc, return top 8
  risks.sort((a, b) => b.total_value - a.total_value);
  return risks.slice(0, 8);
}

// ─── Aging Distribution ───────────────────────────────────────────────────────

export function calcAgingDistribution(items: ScoredItem[]): AgingDistribution {
  const active = items.filter((i) => i.status === "active");
  const total = active.length;

  if (total === 0) {
    return {
      pct_fresh: 0,
      pct_normal: 0,
      pct_aging: 0,
      pct_stale: 0,
      healthy: false,
    };
  }

  let fresh = 0;   // 0-30d
  let normal = 0;  // 31-90d
  let aging = 0;   // 91-180d
  let stale = 0;   // 181d+

  for (const item of active) {
    const d = item.days_listed;
    if (d <= 30) fresh++;
    else if (d <= 90) normal++;
    else if (d <= 180) aging++;
    else stale++;
  }

  const pct_fresh = (fresh / total) * 100;
  const pct_normal = (normal / total) * 100;
  const pct_aging = (aging / total) * 100;
  const pct_stale = (stale / total) * 100;

  return {
    pct_fresh,
    pct_normal,
    pct_aging,
    pct_stale,
    healthy: pct_fresh + pct_normal >= 60,
  };
}

// ─── Recovery Opportunities ───────────────────────────────────────────────────

export function calcRecoveryOpportunities(
  items: ScoredItem[],
  limit = 5
): RecoveryOpportunity[] {
  const candidates = items.filter(
    (i) => i.status === "active" && i.dead_inventory_score >= 30
  );

  const opportunities: RecoveryOpportunity[] = candidates.map((item) => {
    const effort = calcEffortLevel(item.primary_recovery_action);
    const roi_score = calcRecoveryROI(item);
    const is_quick_win = roi_score >= 60 && effort === "low";

    return {
      item_id: item.id,
      title: item.title,
      value: item.price,
      recovery_estimate: item.estimated_recovery,
      days_listed: item.days_listed,
      action: item.primary_recovery_action,
      effort,
      roi_score,
      is_quick_win,
    };
  });

  // Sort by roi_score desc
  opportunities.sort((a, b) => b.roi_score - a.roi_score);
  return opportunities.slice(0, limit);
}

// ─── Portfolio Health ─────────────────────────────────────────────────────────

export function calcPortfolioHealth(items: ScoredItem[]): PortfolioHealth {
  const active = items.filter((i) => i.status === "active");
  const total_active = active.length;

  const total_value = active.reduce((sum, i) => sum + i.price, 0);

  const trapped_cash = active
    .filter((i) => i.dead_inventory_score >= 50)
    .reduce((sum, i) => sum + i.price, 0);

  const trapped_pct = total_value > 0 ? (trapped_cash / total_value) * 100 : 0;

  const stale_count = active.filter((i) => i.dead_inventory_score >= 30).length;
  const critical_count = active.filter((i) => i.dead_inventory_score >= 75).length;

  const recovery_opportunity = active
    .filter((i) => i.dead_inventory_score >= 50)
    .reduce((sum, i) => sum + i.estimated_recovery, 0);

  const avg_dead_score =
    total_active > 0
      ? active.reduce((sum, i) => sum + i.dead_inventory_score, 0) / total_active
      : 0;

  const avg_days_listed =
    total_active > 0
      ? active.reduce((sum, i) => sum + i.days_listed, 0) / total_active
      : 0;

  const category_risks = calcCategoryRisks(active);
  const aging_distribution = calcAgingDistribution(active);
  const top_opportunities = calcRecoveryOpportunities(active, 5);

  // Score calculation
  const rawScore =
    100 -
    trapped_pct * 0.5 -
    (total_active > 0 ? (critical_count / total_active) * 100 * 0.3 : 0) -
    Math.max(0, avg_days_listed - 60) * 0.2;

  const score = Math.min(100, Math.max(0, rawScore));

  let grade: "A" | "B" | "C" | "D" | "F";
  if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 30) grade = "D";
  else grade = "F";

  return {
    score,
    grade,
    total_active,
    total_value,
    trapped_cash,
    trapped_pct,
    stale_count,
    critical_count,
    recovery_opportunity,
    avg_dead_score,
    avg_days_listed,
    category_risks,
    aging_distribution,
    top_opportunities,
  };
}

// ─── Portfolio Score (convenience) ───────────────────────────────────────────

export function calcPortfolioScore(items: ScoredItem[]): number {
  return calcPortfolioHealth(items).score;
}
