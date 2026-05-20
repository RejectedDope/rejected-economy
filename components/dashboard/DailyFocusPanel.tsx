"use client";

import Link from "next/link";
import { Zap, AlertCircle } from "lucide-react";
import type { ScoredItem } from "@/lib/types";
import { getActionLabel, getActionUrgency } from "@/lib/recovery/registry";
import { formatCurrency } from "@/lib/utils";

const URGENCY_BADGE: Record<string, string> = {
  immediate: "border-red-500/30 bg-red-500/10 text-red-400",
  this_week: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  this_month: "border-zinc-700 bg-zinc-800 text-zinc-400",
};

type Props = {
  items: ScoredItem[];
};

export function DailyFocusPanel({ items }: Props) {
  const actionable = items
    .filter((i) => i.status === "active" && i.dead_inventory_score >= 50)
    .sort((a, b) => b.dead_inventory_score - a.dead_inventory_score)
    .slice(0, 5);

  if (actionable.length === 0) return null;

  const immediateCount = actionable.filter(
    (i) => getActionUrgency(i.primary_recovery_action) === "immediate"
  ).length;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Today&apos;s Focus
          </span>
          {immediateCount > 0 && (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400">
              {immediateCount} immediate
            </span>
          )}
        </div>
        <Link
          href="/recovery"
          className="text-xs font-bold text-[#E935C1] hover:underline"
        >
          Full Plan →
        </Link>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {actionable.map((item) => {
          const urgency = getActionUrgency(item.primary_recovery_action);
          return (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200" title={item.title}>
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${URGENCY_BADGE[urgency]}`}
                  >
                    {getActionLabel(item.primary_recovery_action)}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    Score {item.dead_inventory_score}/100
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-zinc-300">
                  {formatCurrency(item.price)}
                </p>
                <p className="text-[10px] text-emerald-500">
                  ~{formatCurrency(item.estimated_recovery)} recoverable
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-800 px-5 py-2.5">
        <Link
          href="/recovery"
          className="flex items-center gap-1.5 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          <AlertCircle className="h-3 w-3" />
          See full recovery plan with step-by-step actions
        </Link>
      </div>
    </div>
  );
}
