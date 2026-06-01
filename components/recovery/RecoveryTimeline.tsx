"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Clock, TrendingDown } from "lucide-react";
import { fetchRecoveryLogs } from "@/app/actions/recovery";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";
import type { RecoveryActionLog } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  relist_now:          "Relisted",
  sell_similar:        "Sell Similar",
  strategic_markdown:  "Markdown",
  title_rewrite:       "Title Rewrite",
  optimize_specifics:  "Fixed Specifics",
  add_photos:          "Added Photos",
  bundle:              "Bundled",
  move_platform:       "Moved Platform",
  liquidate:           "Liquidated",
  hold:                "Monitored",
  adjust_shipping:     "Shipping Adjusted",
};

const OUTCOME_CONFIG = {
  sold: { icon: CheckCircle2, color: "text-emerald-400", label: "Sold" },
  still_active: { icon: RefreshCw, color: "text-blue-400", label: "Still Active" },
  ended: { icon: Clock, color: "text-zinc-500", label: "Ended" },
  no_change: { icon: TrendingDown, color: "text-zinc-600", label: "No Change" },
} as const;

export function RecoveryTimeline({ limit = 20 }: { limit?: number }) {
  const [logs, setLogs] = useState<RecoveryActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecoveryLogs(undefined, limit)
      .then(({ logs }) => setLogs(logs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center">
        <p className="text-sm text-zinc-600">
          No recovery actions logged yet. Mark items as sold or relisted to build your history.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Recovery History
        </span>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {logs.map((log) => {
          const outcome = log.outcome
            ? OUTCOME_CONFIG[log.outcome as keyof typeof OUTCOME_CONFIG]
            : null;
          const Icon = outcome?.icon ?? Clock;
          const actionLabel = ACTION_LABELS[log.action_type] ?? log.action_type;

          return (
            <div key={log.id} className="flex items-center gap-3 px-5 py-3">
              <Icon
                className={`h-4 w-4 shrink-0 ${outcome?.color ?? "text-zinc-600"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-300">{actionLabel}</p>
                <p className="text-[11px] text-zinc-600">
                  {log.created_at ? formatRelativeTime(log.created_at) : "—"}
                  {log.dead_score_snapshot != null &&
                    ` · score was ${log.dead_score_snapshot}/100`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {log.recovery_amount != null && log.recovery_amount > 0 && (
                  <p className="text-xs font-bold text-emerald-400">
                    +{formatCurrency(log.recovery_amount)}
                  </p>
                )}
                {outcome && (
                  <p className={`text-[10px] font-bold uppercase ${outcome.color}`}>
                    {outcome.label}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
