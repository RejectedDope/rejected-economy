// ============================================================
// RESALEIQ — Recovery Tracking & Effectiveness Analytics
// Pure functions. No side effects. No DB calls.
// Operates on RecoveryActionLog arrays from Supabase queries.
// ============================================================

import type { RecoveryActionLog, RecoveryAction } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionSuccessRate {
  action: RecoveryAction;
  total: number;
  sold: number;
  still_active: number;
  ended: number;
  no_change: number;
  pending: number;
  sell_through_rate: number;    // 0–100: % of completed actions that resulted in sold
  avg_days_to_outcome: number;  // avg days from action to outcome (completed logs only)
}

export interface RecoveryFunnel {
  total_actions: number;
  pending: number;
  completed: number;
  skipped: number;
  snoozed: number;
  sold_count: number;           // completed → outcome = "sold"
  no_change_count: number;
  still_active_count: number;
  ended_count: number;
  overall_sell_through_rate: number;   // 0–100
  total_recovered_value: number;       // sum of recovery_amount where outcome = sold
}

export interface RecoveryEffectivenessReport {
  funnel: RecoveryFunnel;
  by_action: ActionSuccessRate[];
  top_action: RecoveryAction | null;   // highest sell_through_rate with >= 2 completions
  avg_days_to_sale: number;            // across all sold outcomes
  total_cash_recovered: number;
}

export interface RecoveryTimelineEvent {
  date: string;                        // ISO timestamp
  action_type: RecoveryAction;
  action_status: RecoveryActionLog["action_status"];
  outcome?: RecoveryActionLog["outcome"];
  days_to_outcome?: number;
  recovery_amount?: number;
  dead_score_at_action?: number;
}

// ─── Recovery Funnel ──────────────────────────────────────────────────────────

export function calcRecoveryFunnel(logs: RecoveryActionLog[]): RecoveryFunnel {
  if (logs.length === 0) {
    return {
      total_actions: 0,
      pending: 0,
      completed: 0,
      skipped: 0,
      snoozed: 0,
      sold_count: 0,
      no_change_count: 0,
      still_active_count: 0,
      ended_count: 0,
      overall_sell_through_rate: 0,
      total_recovered_value: 0,
    };
  }

  let pending = 0, completed = 0, skipped = 0, snoozed = 0;
  let sold_count = 0, no_change_count = 0, still_active_count = 0, ended_count = 0;
  let total_recovered_value = 0;

  for (const log of logs) {
    switch (log.action_status) {
      case "pending":  pending++;  break;
      case "completed": completed++; break;
      case "skipped":  skipped++;  break;
      case "snoozed":  snoozed++;  break;
    }
    if (log.action_status === "completed") {
      switch (log.outcome) {
        case "sold":         sold_count++;         break;
        case "no_change":    no_change_count++;    break;
        case "still_active": still_active_count++; break;
        case "ended":        ended_count++;        break;
      }
      if (log.outcome === "sold" && log.recovery_amount) {
        total_recovered_value += log.recovery_amount;
      }
    }
  }

  const completed_with_outcome = sold_count + no_change_count + still_active_count + ended_count;
  const overall_sell_through_rate =
    completed_with_outcome > 0
      ? Math.round((sold_count / completed_with_outcome) * 100)
      : 0;

  return {
    total_actions: logs.length,
    pending,
    completed,
    skipped,
    snoozed,
    sold_count,
    no_change_count,
    still_active_count,
    ended_count,
    overall_sell_through_rate,
    total_recovered_value,
  };
}

// ─── Action Success Rates ─────────────────────────────────────────────────────

export function calcActionSuccessRates(logs: RecoveryActionLog[]): ActionSuccessRate[] {
  const byAction = new Map<RecoveryAction, RecoveryActionLog[]>();

  for (const log of logs) {
    const bucket = byAction.get(log.action_type);
    if (bucket) {
      bucket.push(log);
    } else {
      byAction.set(log.action_type, [log]);
    }
  }

  const rates: ActionSuccessRate[] = [];

  for (const [action, actionLogs] of byAction) {
    let sold = 0, still_active = 0, ended = 0, no_change = 0, pending = 0;
    let days_sum = 0, days_count = 0;

    for (const log of actionLogs) {
      if (log.action_status === "pending") { pending++; continue; }
      switch (log.outcome) {
        case "sold":         sold++;         break;
        case "still_active": still_active++; break;
        case "ended":        ended++;        break;
        case "no_change":    no_change++;    break;
      }
      if (log.days_to_outcome !== undefined) {
        days_sum += log.days_to_outcome;
        days_count++;
      }
    }

    const completed_with_outcome = sold + still_active + ended + no_change;
    const sell_through_rate =
      completed_with_outcome > 0
        ? Math.round((sold / completed_with_outcome) * 100)
        : 0;

    rates.push({
      action,
      total: actionLogs.length,
      sold,
      still_active,
      ended,
      no_change,
      pending,
      sell_through_rate,
      avg_days_to_outcome: days_count > 0 ? Math.round(days_sum / days_count) : 0,
    });
  }

  // Sort by sell_through_rate desc
  rates.sort((a, b) => b.sell_through_rate - a.sell_through_rate);
  return rates;
}

// ─── Top Performing Action ────────────────────────────────────────────────────

export function getTopPerformingAction(
  rates: ActionSuccessRate[],
  minCompletions = 2
): RecoveryAction | null {
  const qualified = rates.filter(
    (r) => r.sold + r.still_active + r.ended + r.no_change >= minCompletions
  );
  return qualified.length > 0 ? qualified[0].action : null;
}

// ─── Average Days to Sale ─────────────────────────────────────────────────────

export function calcAvgDaysToSale(logs: RecoveryActionLog[]): number {
  const sold = logs.filter(
    (l) => l.action_status === "completed" &&
           l.outcome === "sold" &&
           l.days_to_outcome !== undefined
  );
  if (sold.length === 0) return 0;
  const total = sold.reduce((sum, l) => sum + (l.days_to_outcome ?? 0), 0);
  return Math.round(total / sold.length);
}

// ─── Full Effectiveness Report ────────────────────────────────────────────────

export function calcRecoveryEffectiveness(
  logs: RecoveryActionLog[]
): RecoveryEffectivenessReport {
  const funnel = calcRecoveryFunnel(logs);
  const by_action = calcActionSuccessRates(logs);
  const top_action = getTopPerformingAction(by_action);
  const avg_days_to_sale = calcAvgDaysToSale(logs);

  return {
    funnel,
    by_action,
    top_action,
    avg_days_to_sale,
    total_cash_recovered: funnel.total_recovered_value,
  };
}

// ─── Recovery Timeline ────────────────────────────────────────────────────────

export function buildRecoveryTimeline(
  logs: RecoveryActionLog[]
): RecoveryTimelineEvent[] {
  const timeline: RecoveryTimelineEvent[] = logs.map((log) => ({
    date: log.created_at,
    action_type: log.action_type,
    action_status: log.action_status,
    outcome: log.outcome,
    days_to_outcome: log.days_to_outcome,
    recovery_amount: log.recovery_amount,
    dead_score_at_action: log.dead_score_snapshot,
  }));

  // Sort chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return timeline;
}

// ─── Recovery Rate ────────────────────────────────────────────────────────────
// Simple: what % of COMPLETED actions resulted in a sale

export function calcRecoveryRate(logs: RecoveryActionLog[]): number {
  const completed = logs.filter((l) => l.action_status === "completed");
  if (completed.length === 0) return 0;
  const sold = completed.filter((l) => l.outcome === "sold").length;
  return Math.round((sold / completed.length) * 100);
}
