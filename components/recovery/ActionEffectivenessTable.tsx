"use client";

import { useReducer, useEffect } from "react";
import type { ActionEffectivenessRow } from "@/app/actions/analytics";

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist",
  strategic_markdown: "Price Drop",
  bundle: "Bundle",
  move_platform: "Move Platform",
  optimize_specifics: "Fix Specifics",
  add_photos: "Add Photos",
  liquidate: "Liquidate",
  hold: "Hold / Sell",
  sell_similar: "Sell Similar",
  adjust_shipping: "Adjust Shipping",
};

type State = { rows: ActionEffectivenessRow[]; loading: boolean };
type Action = { type: "loaded"; rows: ActionEffectivenessRow[] };

function reducer(state: State, action: Action): State {
  return { rows: action.rows, loading: false };
}

export function ActionEffectivenessTable() {
  const [state, dispatch] = useReducer(reducer, { rows: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/analytics")
      .then(({ fetchActionEffectiveness }) => fetchActionEffectiveness())
      .then((result) => {
        if (!cancelled) dispatch({ type: "loaded", rows: result.rows });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "loaded", rows: [] });
      });
    return () => { cancelled = true; };
  }, []);

  if (state.loading || state.rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
        What&apos;s Working — Action Effectiveness
      </p>
      <div className="space-y-2">
        {state.rows.map((row) => (
          <div key={row.action_type} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-zinc-400">
              {ACTION_LABELS[row.action_type] ?? row.action_type}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${row.success_rate}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-bold text-zinc-300">
              {row.success_rate}%
            </span>
            <span className="w-8 shrink-0 text-right text-[10px] text-zinc-600">
              {row.total}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-zinc-700">
        Sell rate by action type · count shown right
      </p>
    </div>
  );
}
