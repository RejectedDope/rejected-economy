// ============================================================
// RESALEIQ — Prioritization & Action Queue Module
// Pure functions. No side effects. No DB calls.
// ============================================================

import type { ScoredItem } from "@/lib/types";
import { calcLifecycleStage, type LifecycleStage } from "@/lib/inventory/lifecycle";
import { calcEffortLevel, calcRecoveryROI } from "@/lib/inventory/portfolio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrioritizedItem {
  item: ScoredItem;
  lifecycle_stage: LifecycleStage;
  urgency_score: number;      // 0-100
  recovery_roi: number;       // 0-100
  is_quick_win: boolean;
  effort_level: "low" | "medium" | "high";
  reasoning: string;
  action: string;             // RecoveryAction
  estimated_recovery: number;
}

export interface ActionQueueItem {
  action: string;             // RecoveryAction
  action_label: string;
  items: ScoredItem[];
  total_recoverable: number;
  urgency: "immediate" | "this_week" | "this_month";
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  batch_efficiency: boolean;  // multiple items can be batched
}

// ─── Action Labels ────────────────────────────────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist Now",
  strategic_markdown: "Strategic Markdown",
  bundle: "Bundle It",
  move_platform: "Move Platform",
  optimize_specifics: "Fix Item Specifics",
  add_photos: "Add More Photos",
  liquidate: "Liquidate",
  hold: "Hold — Monitor",
  sell_similar: "Use Sell Similar",
  title_rewrite: "Rewrite Title",
};

// ─── Urgency Score ────────────────────────────────────────────────────────────

export function calcUrgencyScore(item: ScoredItem): number {
  const { days_listed, views, watchers, dead_inventory_score } = item;

  // Age component
  let age = 0;
  if (days_listed > 365) age = 60;
  else if (days_listed > 180) age = 45;
  else if (days_listed > 90) age = 30;
  else if (days_listed > 60) age = 20;
  else if (days_listed > 30) age = 10;

  // Engagement component
  let engagement = 0;
  if (views >= 100 && watchers === 0) engagement = 25;
  else if (views >= 50 && watchers <= 1) engagement = 15;

  // Score component
  let scoreBoost = 0;
  if (dead_inventory_score >= 75) scoreBoost = 15;
  else if (dead_inventory_score >= 50) scoreBoost = 10;
  else if (dead_inventory_score >= 30) scoreBoost = 5;

  return Math.min(100, age + engagement + scoreBoost);
}

// ─── Reasoning Text ───────────────────────────────────────────────────────────

export function buildReasoningText(item: ScoredItem, stage: LifecycleStage): string {
  const { days_listed, views, watchers, dead_inventory_score, primary_recovery_action } = item;

  if (stage === "liquidating") {
    return `${days_listed} days listed with ${views} views and ${watchers} watchers — the market has spoken. Liquidate now.`;
  }

  if (stage === "critical") {
    return `${days_listed} days on the shelf with a dead score of ${dead_inventory_score} — deep decay across every signal. Immediate action required.`;
  }

  if (stage === "stale") {
    if (views > 0 && watchers === 0) {
      return `${views} views but zero watchers after ${days_listed} days — buyers are seeing it and passing. ${ACTION_LABELS[primary_recovery_action] ?? primary_recovery_action} to break the pattern.`;
    }
    return `${days_listed} days listed without gaining traction. Algorithm has deprioritized this listing — ${ACTION_LABELS[primary_recovery_action] ?? primary_recovery_action} before it goes further.`;
  }

  if (stage === "slowing") {
    return `${days_listed} days in and engagement is fading. Optimize now before the 90-day cliff hits impressions.`;
  }

  if (views >= 50 && watchers === 0) {
    return `${views} views and zero watchers — price or presentation is blocking the sale. ${Action_label_for(primary_recovery_action)} recommended.`;
  }

  return `${days_listed} days listed with ${views} views and ${watchers} watchers. Dead score: ${dead_inventory_score}. ${Action_label_for(primary_recovery_action)} recommended.`;
}

function Action_label_for(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// ─── Prioritize Recovery ──────────────────────────────────────────────────────

export function prioritizeRecovery(items: ScoredItem[]): PrioritizedItem[] {
  const active = items.filter((i) => i.status === "active");

  const prioritized: PrioritizedItem[] = active.map((item) => {
    const lifecycle_stage = calcLifecycleStage(item);
    const urgency_score = calcUrgencyScore(item);
    const recovery_roi = calcRecoveryROI(item);
    const effort_level = calcEffortLevel(item.primary_recovery_action);
    const is_quick_win =
      urgency_score >= 50 && effort_level === "low" && item.estimated_recovery >= 20;
    const reasoning = buildReasoningText(item, lifecycle_stage);

    return {
      item,
      lifecycle_stage,
      urgency_score,
      recovery_roi,
      is_quick_win,
      effort_level,
      reasoning,
      action: item.primary_recovery_action,
      estimated_recovery: item.estimated_recovery,
    };
  });

  // Sort by urgency_score desc, then roi desc
  prioritized.sort((a, b) => {
    if (b.urgency_score !== a.urgency_score) return b.urgency_score - a.urgency_score;
    return b.recovery_roi - a.recovery_roi;
  });

  return prioritized;
}

// ─── Action Queue ─────────────────────────────────────────────────────────────

export function buildActionQueue(items: ScoredItem[]): ActionQueueItem[] {
  const active = items.filter((i) => i.status === "active");

  // Group by primary_recovery_action
  const groups = new Map<string, ScoredItem[]>();
  for (const item of active) {
    const action = item.primary_recovery_action;
    const bucket = groups.get(action);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(action, [item]);
    }
  }

  const queue: ActionQueueItem[] = [];

  for (const [action, actionItems] of groups) {
    const total_recoverable = actionItems.reduce(
      (sum, i) => sum + i.estimated_recovery,
      0
    );

    // Urgency: check max urgency score across all items in the group
    const maxUrgency = Math.max(...actionItems.map(calcUrgencyScore));
    let urgency: "immediate" | "this_week" | "this_month";
    if (maxUrgency >= 60) urgency = "immediate";
    else if (maxUrgency >= 30) urgency = "this_week";
    else urgency = "this_month";

    // Effort by action type
    const LOW_EFFORT_ACTIONS = new Set([
      "title_rewrite",
      "optimize_specifics",
      "strategic_markdown",
    ]);
    const HIGH_EFFORT_ACTIONS = new Set([
      "relist_now",
      "move_platform",
      "liquidate",
    ]);
    let effort: "low" | "medium" | "high";
    if (LOW_EFFORT_ACTIONS.has(action)) effort = "low";
    else if (HIGH_EFFORT_ACTIONS.has(action)) effort = "high";
    else effort = "medium";

    // Impact by total recoverable value
    let impact: "low" | "medium" | "high";
    if (total_recoverable > 200) impact = "high";
    else if (total_recoverable > 50) impact = "medium";
    else impact = "low";

    const batch_efficiency = actionItems.length >= 3;

    queue.push({
      action,
      action_label: ACTION_LABELS[action] ?? action,
      items: actionItems,
      total_recoverable,
      urgency,
      effort,
      impact,
      batch_efficiency,
    });
  }

  // Sort: immediate first, then by total_recoverable desc
  queue.sort((a, b) => {
    const urgencyRank = { immediate: 0, this_week: 1, this_month: 2 };
    if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) {
      return urgencyRank[a.urgency] - urgencyRank[b.urgency];
    }
    return b.total_recoverable - a.total_recoverable;
  });

  return queue;
}

// ─── Quick Wins ───────────────────────────────────────────────────────────────

export function getQuickWins(items: ScoredItem[]): ScoredItem[] {
  const active = items.filter((i) => i.status === "active");

  const wins = active.filter((item) => {
    const urgency = calcUrgencyScore(item);
    const effort = calcEffortLevel(item.primary_recovery_action);
    return urgency >= 40 && effort === "low" && item.estimated_recovery >= 15;
  });

  // Sort by estimated_recovery desc
  wins.sort((a, b) => b.estimated_recovery - a.estimated_recovery);
  return wins;
}

// ─── Liquidation Candidates ───────────────────────────────────────────────────

export function getLiquidationCandidates(items: ScoredItem[]): ScoredItem[] {
  const active = items.filter((i) => i.status === "active");

  const candidates = active.filter(
    (item) =>
      item.days_listed >= 365 ||
      (item.days_listed >= 180 && item.dead_inventory_score >= 75)
  );

  candidates.sort((a, b) => b.days_listed - a.days_listed);
  return candidates;
}

// ─── Escalation Detection ─────────────────────────────────────────────────────
// Identifies items that need immediate attention beyond normal prioritization.
// Returns items with escalation reason for surfacing in the UI.

export interface EscalatedItem {
  item: ScoredItem;
  reason: string;
  severity: "urgent" | "critical";
}

export function detectEscalations(items: ScoredItem[]): EscalatedItem[] {
  const active = items.filter((i) => i.status === "active");
  const results: EscalatedItem[] = [];

  for (const item of active) {
    // Year-plus listing — market has permanently rejected at current price
    if (item.days_listed >= 365) {
      results.push({
        item,
        reason: `${item.days_listed}d listed — market rejection confirmed`,
        severity: "critical",
      });
      continue;
    }

    // Critical score + significant cash trapped
    if (item.dead_inventory_score >= 80 && item.price >= 25) {
      results.push({
        item,
        reason: `Score ${item.dead_inventory_score}/100 · $${item.price.toFixed(0)} trapped`,
        severity: "critical",
      });
      continue;
    }

    // High views, zero watchers, aged listing — price rejection pattern
    if (item.views >= 100 && item.watchers === 0 && item.days_listed >= 60) {
      results.push({
        item,
        reason: `${item.views} views, 0 watchers — price rejection signal`,
        severity: "urgent",
      });
      continue;
    }

    // High dead score without any engagement
    if (item.dead_inventory_score >= 70 && item.views <= 5 && item.days_listed >= 90) {
      results.push({
        item,
        reason: `Score ${item.dead_inventory_score}/100 · invisible listing`,
        severity: "urgent",
      });
    }
  }

  // Sort: critical first, then by dead score desc
  results.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.item.dead_inventory_score - a.item.dead_inventory_score;
  });

  return results;
}
