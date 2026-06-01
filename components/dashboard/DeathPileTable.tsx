"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import type { ScoredItem } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist Now",
  strategic_markdown: "Mark Down",
  bundle: "Bundle It",
  move_platform: "Move Platform",
  optimize_specifics: "Fix Specifics",
  add_photos: "Add Photos",
  liquidate: "Liquidate",
  hold: "Hold",
};

interface DeathPileTableProps {
  items: ScoredItem[];
}

export function DeathPileTable({ items }: DeathPileTableProps) {
  const sorted = [...items]
    .filter((i) => i.status === "active")
    .sort((a, b) => b.dead_inventory_score - a.dead_inventory_score)
    .slice(0, 8);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            High-Risk Death Pile
          </h3>
          <p className="mt-0.5 text-xs text-zinc-600">sorted by decay score</p>
        </div>
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-xs text-[#E935C1] hover:text-[#FF2D95]"
        >
          View All <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-zinc-800">
        {sorted.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-zinc-800/50"
          >
            {/* Title + platform */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/inventory/${item.id}`}
                className="block truncate text-sm font-medium text-zinc-200 hover:text-[#FF2D95]"
              >
                {item.title}
              </Link>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-zinc-600">{item.platform}</span>
                <span className="text-zinc-800">·</span>
                <span className="text-xs text-zinc-600">{item.days_listed}d listed</span>
                <span className="text-zinc-800">·</span>
                <span className="text-xs text-zinc-500">{formatCurrency(item.price)}</span>
              </div>
            </div>

            {/* Dead score bar */}
            <div className="hidden w-24 md:block">
              <div className="mb-1 flex justify-between">
                <span className="text-[10px] text-zinc-600">decay</span>
                <span className="text-[10px] font-bold text-zinc-400">
                  {item.dead_inventory_score}
                </span>
              </div>
              <Progress
                value={item.dead_inventory_score}
                className="h-1.5"
                indicatorClassName={
                  item.dead_inventory_score >= 75
                    ? "bg-[#FF2D95]"
                    : item.dead_inventory_score >= 55
                    ? "bg-orange-400"
                    : item.dead_inventory_score >= 30
                    ? "bg-yellow-400"
                    : "bg-emerald-400"
                }
              />
            </div>

            {/* Risk badge */}
            <Badge
              variant={item.visibility_risk.toLowerCase() as "critical" | "high" | "medium" | "low"}
              className="hidden shrink-0 sm:inline-flex"
            >
              {item.visibility_risk}
            </Badge>

            {/* Action */}
            <span className="shrink-0 text-xs font-semibold text-[#E935C1]">
              {ACTION_LABELS[item.primary_recovery_action]}
            </span>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="px-6 py-10 text-center text-sm text-zinc-600">
          No high-risk inventory — clean operation.
        </div>
      )}
    </div>
  );
}
