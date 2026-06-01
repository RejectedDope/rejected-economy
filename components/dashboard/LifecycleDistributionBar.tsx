"use client";

import { cn } from "@/lib/utils";
import { groupItemsByLifecycle } from "@/lib/inventory/lifecycle";
import type { ScoredItem } from "@/lib/types";

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CONFIG = [
  { key: "newly_imported", label: "New",        color: "bg-zinc-500",    textColor: "text-zinc-400"    },
  { key: "active",         label: "Active",     color: "bg-emerald-400", textColor: "text-emerald-400" },
  { key: "slowing",        label: "Slowing",    color: "bg-blue-400",    textColor: "text-blue-400"    },
  { key: "stale",          label: "Stale",      color: "bg-yellow-400",  textColor: "text-yellow-400"  },
  { key: "critical",       label: "Critical",   color: "bg-orange-500",  textColor: "text-orange-400"  },
  { key: "liquidating",    label: "Liquidating",color: "bg-[#FF2D95]",   textColor: "text-[#FF2D95]"   },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface LifecycleDistributionBarProps {
  items: ScoredItem[];
}

export function LifecycleDistributionBar({ items }: LifecycleDistributionBarProps) {
  const active = items.filter((i) => i.status === "active");
  if (active.length === 0) return null;

  const groups = groupItemsByLifecycle(active);

  const counts = STAGE_CONFIG.map((s) => ({
    ...s,
    count: groups.get(s.key)?.length ?? 0,
    pct: ((groups.get(s.key)?.length ?? 0) / active.length) * 100,
  })).filter((s) => s.count > 0);

  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Lifecycle Distribution
        </span>
        <span className="text-[10px] text-zinc-600">{active.length} active listings</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {counts.map((s) => (
          <div
            key={s.key}
            className={cn("h-full", s.color)}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.count} (${s.pct.toFixed(0)}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {counts.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", s.color)} />
            <span className={cn("text-[10px] font-semibold", s.textColor)}>
              {s.label}
            </span>
            <span className="text-[10px] text-zinc-600">
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
