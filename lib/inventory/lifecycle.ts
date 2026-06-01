// ============================================================
// RESALEIQ — Inventory Lifecycle Module
// Pure functions. No side effects. No DB calls.
// ============================================================

import type { InventoryItem } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LifecycleStage =
  | "newly_imported"
  | "active"
  | "slowing"
  | "stale"
  | "critical"
  | "liquidating"
  | "sold"
  | "archived";

export type LifecycleUrgency = "none" | "watch" | "act" | "immediate" | "terminal";

export interface LifecycleStageInfo {
  stage: LifecycleStage;
  label: string;
  description: string;
  urgency: LifecycleUrgency;
  color: string;       // tailwind text class
  badge_bg: string;    // tailwind bg/border class
}

// ─── Stage Calculation ────────────────────────────────────────────────────────

export function calcLifecycleStage(item: InventoryItem): LifecycleStage {
  const { status, primary_recovery_action, days_listed, dead_inventory_score } = item;

  // Terminal statuses
  if (status === "sold") return "sold";
  if (status === "ended") return "archived";

  // Liquidating: explicit action + deep age
  if (primary_recovery_action === "liquidate" && days_listed > 120) {
    return "liquidating";
  }

  const score = dead_inventory_score ?? 0;

  // Critical
  if (days_listed >= 180 || score >= 75) return "critical";

  // Stale
  if (days_listed >= 90 || score >= 50) return "stale";

  // Slowing
  if (days_listed >= 60 || score >= 30) return "slowing";

  // Active
  if (days_listed >= 14) return "active";

  // Default
  return "newly_imported";
}

// ─── Stage Info ───────────────────────────────────────────────────────────────

const STAGE_INFO_MAP: Record<LifecycleStage, Omit<LifecycleStageInfo, "stage">> = {
  newly_imported: {
    label: "New Import",
    description: "Listing is fresh and within peak organic visibility window",
    urgency: "none",
    color: "text-emerald-400",
    badge_bg: "bg-emerald-400/10 border-emerald-400/30",
  },
  active: {
    label: "Active",
    description: "Listing is performing within normal sell-through window",
    urgency: "watch",
    color: "text-zinc-300",
    badge_bg: "bg-zinc-800 border-zinc-700",
  },
  slowing: {
    label: "Slowing",
    description: "Engagement declining. Targeted optimization needed before 90-day cliff",
    urgency: "act",
    color: "text-yellow-400",
    badge_bg: "bg-yellow-400/10 border-yellow-400/30",
  },
  stale: {
    label: "Stale",
    description: "Past the freshness cliff. Algorithm has deprioritized this listing",
    urgency: "act",
    color: "text-orange-400",
    badge_bg: "bg-orange-400/10 border-orange-400/30",
  },
  critical: {
    label: "Critical",
    description: "Deep decay. Multiple stacked problems. Immediate recovery action required",
    urgency: "immediate",
    color: "text-[#FF2D95]",
    badge_bg: "bg-[#FF2D95]/10 border-[#FF2D95]/30",
  },
  liquidating: {
    label: "Liquidating",
    description: "Carrying cost exceeds upside. Price to clear or bundle",
    urgency: "terminal",
    color: "text-zinc-500",
    badge_bg: "bg-zinc-800 border-zinc-700",
  },
  sold: {
    label: "Sold",
    description: "Item has sold. Archive or record for metrics",
    urgency: "none",
    color: "text-emerald-400",
    badge_bg: "bg-emerald-400/10 border-emerald-400/30",
  },
  archived: {
    label: "Archived",
    description: "Listing ended. Removed from active inventory",
    urgency: "none",
    color: "text-zinc-600",
    badge_bg: "bg-zinc-900 border-zinc-800",
  },
};

export function getLifecycleInfo(stage: LifecycleStage): LifecycleStageInfo {
  return { stage, ...STAGE_INFO_MAP[stage] };
}

// ─── Escalation Detection ─────────────────────────────────────────────────────

// Severity order for escalation comparison.
// sold and archived are terminal — they don't escalate.
const ESCALATION_ORDER: LifecycleStage[] = [
  "newly_imported",
  "active",
  "slowing",
  "stale",
  "critical",
  "liquidating",
];

// Stages considered "degraded" — escalation only counts when arriving here.
const DEGRADED_START_IDX = ESCALATION_ORDER.indexOf("slowing");

export function detectEscalation(prev: LifecycleStage, current: LifecycleStage): boolean {
  const prevIdx = ESCALATION_ORDER.indexOf(prev);
  const currIdx = ESCALATION_ORDER.indexOf(current);

  // Either stage is terminal (sold/archived) → not an escalation
  if (prevIdx === -1 || currIdx === -1) return false;

  // Must move forward AND arrive at a degraded stage (slowing or worse)
  return currIdx > prevIdx && currIdx >= DEGRADED_START_IDX;
}

// ─── Aging Acceleration ───────────────────────────────────────────────────────

export function calcAgingAcceleration(item: InventoryItem): number {
  const {
    views,
    days_listed,
    watchers,
    price,
    original_price,
    image_count,
    item_specifics_complete,
    has_promoted_listing,
  } = item;

  let score = 0;

  // Low view velocity + established listing
  const viewsPerDay = days_listed > 0 ? views / days_listed : 0;
  if (viewsPerDay < 0.3 && days_listed >= 30) {
    score += 30;
  }

  // Zero watchers on aging listing
  if (watchers === 0 && days_listed >= 60) {
    score += 25;
  }

  // No markdown taken — price near or above original
  const hasMarkdown =
    original_price !== undefined && price < original_price * 0.97;
  if (!hasMarkdown && days_listed >= 90) {
    score += 20;
  }

  // Thin photo coverage
  if (image_count <= 2) {
    score += 10;
  }

  // Missing item specifics
  if (!item_specifics_complete) {
    score += 10;
  }

  // Promoted listing slows decay
  if (has_promoted_listing && days_listed >= 60) {
    score -= 15;
  }

  return Math.min(100, Math.max(0, score));
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export function groupItemsByLifecycle(
  items: InventoryItem[]
): Map<LifecycleStage, InventoryItem[]> {
  const map = new Map<LifecycleStage, InventoryItem[]>();

  for (const item of items) {
    const stage = calcLifecycleStage(item);
    const bucket = map.get(stage);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(stage, [item]);
    }
  }

  return map;
}
