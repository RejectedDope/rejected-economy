import type { RecoveryActionDetail } from "@/lib/types";
import type { PrioritizedItem } from "@/lib/inventory/prioritization";

export type RecoveryFilterState = {
  urgency: "all" | "immediate" | "this_week" | "this_month";
  platform: string;
  sort: "cash" | "age" | "score";
};

export const DEFAULT_FILTERS: RecoveryFilterState = {
  urgency: "all",
  platform: "",
  sort: "cash",
};

export function filterRecoveryPlan(
  plan: RecoveryActionDetail[],
  filters: RecoveryFilterState
): RecoveryActionDetail[] {
  let result = plan;

  if (filters.urgency !== "all") {
    result = result.filter((p) => p.urgency === filters.urgency);
  }

  if (filters.platform) {
    result = result
      .map((p) => {
        const filtered = p.items.filter((i) => i.platform === filters.platform);
        return {
          ...p,
          items: filtered,
          estimated_cash_recovery: filtered.reduce((s, i) => s + i.estimated_recovery, 0),
        };
      })
      .filter((p) => p.items.length > 0);
  }

  if (filters.sort === "cash") {
    result = [...result].sort((a, b) => b.estimated_cash_recovery - a.estimated_cash_recovery);
  }

  return result;
}

export function filterPriorityQueue(
  priority: PrioritizedItem[],
  filters: RecoveryFilterState
): PrioritizedItem[] {
  let result = priority;

  if (filters.urgency !== "all") {
    const urgencyBands: Record<string, [number, number]> = {
      immediate:  [60, 100],
      this_week:  [30, 59],
      this_month: [0, 29],
    };
    const [min, max] = urgencyBands[filters.urgency] ?? [0, 100];
    result = result.filter((p) => p.urgency_score >= min && p.urgency_score <= max);
  }

  if (filters.platform) {
    result = result.filter((p) => p.item.platform === filters.platform);
  }

  if (filters.sort === "cash") {
    result = [...result].sort((a, b) => b.estimated_recovery - a.estimated_recovery);
  } else if (filters.sort === "age") {
    result = [...result].sort((a, b) => b.item.days_listed - a.item.days_listed);
  } else if (filters.sort === "score") {
    result = [...result].sort((a, b) => b.item.dead_inventory_score - a.item.dead_inventory_score);
  }

  return result;
}

export function getAvailablePlatforms(priority: PrioritizedItem[]): string[] {
  return [...new Set(priority.map((p) => p.item.platform))].sort();
}
