"use client";

import { useReducer, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import type { RecoveryActionLog } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relisted",
  strategic_markdown: "Price Drop",
  bundle: "Bundled",
  move_platform: "Moved Platform",
  optimize_specifics: "Fixed Specifics",
  add_photos: "Added Photos",
  liquidate: "Liquidated",
  hold: "Sold / Hold",
  sell_similar: "Sold Similar",
  adjust_shipping: "Adjusted Shipping",
};

const OUTCOME_COLORS: Record<string, string> = {
  sold: "text-emerald-400",
  still_active: "text-zinc-400",
  ended: "text-red-400",
  no_change: "text-zinc-500",
};

type State = { logs: RecoveryActionLog[]; loading: boolean };
type Action = { type: "loaded"; logs: RecoveryActionLog[] };

function reducer(state: State, action: Action): State {
  return { logs: action.logs, loading: false };
}

export function ItemRecoveryLog({ itemId }: { itemId: string }) {
  const [state, dispatch] = useReducer(reducer, { logs: [], loading: true });

  useEffect(() => {
    let cancelled = false;

    import("@/app/actions/recovery")
      .then(({ fetchRecoveryLogs }) => fetchRecoveryLogs(itemId, 10))
      .then((result) => {
        if (!cancelled) dispatch({ type: "loaded", logs: result.logs });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "loaded", logs: [] });
      });

    return () => { cancelled = true; };
  }, [itemId]);

  if (state.loading || state.logs.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
        Recovery Log
      </p>
      <div className="space-y-3">
        {state.logs.map((log) => (
          <div key={log.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-300">
                {ACTION_LABELS[log.action_type] ?? log.action_type}
              </p>
              {log.notes && (
                <p className="truncate text-xs text-zinc-600">{log.notes}</p>
              )}
              <p className="text-[10px] text-zinc-700">
                {new Date(log.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {log.outcome && (
                <p className={`text-xs font-bold ${OUTCOME_COLORS[log.outcome] ?? "text-zinc-400"}`}>
                  {log.outcome.replace("_", " ")}
                </p>
              )}
              {log.recovery_amount != null && log.recovery_amount > 0 && (
                <p className="text-xs font-semibold text-emerald-400">
                  {formatCurrency(log.recovery_amount)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
