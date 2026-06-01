"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, CheckCircle2, Zap } from "lucide-react";
import { fetchRecoveryStats, type RecoveryStatsResult } from "@/app/actions/recovery";
import { formatCurrency } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  relist_now:          "Relist",
  sell_similar:        "Sell Similar",
  strategic_markdown:  "Markdown",
  title_rewrite:       "Title Rewrite",
  optimize_specifics:  "Fix Specifics",
  add_photos:          "Add Photos",
  bundle:              "Bundle",
  move_platform:       "Move Platform",
  liquidate:           "Liquidate",
  hold:                "Hold",
  adjust_shipping:     "Adjust Shipping",
};

export function RecoveryStatsPanel() {
  const [stats, setStats] = useState<RecoveryStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecoveryStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats || stats.actionsThisMonth === 0) return null;

  const topAction = stats.actionBreakdown[0];

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Recovery This Month
          </span>
        </div>
        <Link
          href="/recovery"
          className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Recovery Center →
        </Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-zinc-800">
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Recovered
          </p>
          <p className="mt-1 text-xl font-black text-emerald-400">
            {stats.recoveredThisMonth > 0
              ? formatCurrency(stats.recoveredThisMonth)
              : "—"}
          </p>
          {stats.recoveredThisWeek > 0 && (
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {formatCurrency(stats.recoveredThisWeek)} this week
            </p>
          )}
        </div>

        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Items Sold
          </p>
          <p className="mt-1 text-xl font-black text-zinc-100">
            {stats.soldThisMonth}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {stats.actionsThisMonth} actions logged
          </p>
        </div>

        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Top Action
          </p>
          {topAction ? (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-[#E935C1]" />
                <p className="text-sm font-bold text-zinc-200">
                  {ACTION_LABELS[topAction.action] ?? topAction.action}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {topAction.count}× logged this month
              </p>
            </>
          ) : (
            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
              <CheckCircle2 className="h-3 w-3" />
              None yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
